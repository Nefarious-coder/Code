// 3D SEATVIEW backend — zero-dependency (Node 22+: node:sqlite, SSE for realtime).
'use strict';
const http = require('node:http'), crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const PORT = +process.env.PORT || 3000, HOLD_MS = (+process.env.HOLD_SECONDS || 600) * 1000;
const db = new DatabaseSync(process.env.DB_FILE || ':memory:');
db.exec(`
CREATE TABLE IF NOT EXISTS halls(id TEXT PRIMARY KEY, cinema TEXT, name TEXT, config TEXT NOT NULL, is_demo INT DEFAULT 1);
CREATE TABLE IF NOT EXISTS movies(id TEXT PRIMARY KEY, data TEXT NOT NULL, is_demo INT DEFAULT 1);
CREATE TABLE IF NOT EXISTS showtimes(id TEXT PRIMARY KEY, movie_id TEXT, hall_id TEXT, starts_at TEXT, prices TEXT, is_demo INT DEFAULT 1);
CREATE TABLE IF NOT EXISTS seat_state(showtime_id TEXT, seat_id TEXT, status TEXT CHECK(status IN('held','sold')),
  holder TEXT, expires_at INT, order_id TEXT, PRIMARY KEY(showtime_id, seat_id));
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, showtime_id TEXT, holder TEXT, seats TEXT, total REAL, status TEXT, created_at INT);`);
const q = (s, ...a) => db.prepare(s).all(...a), one = (s, ...a) => db.prepare(s).get(...a), run = (s, ...a) => db.prepare(s).run(...a);
const tx = f => { db.exec('BEGIN IMMEDIATE'); try { const r = f(); db.exec('COMMIT'); return r } catch (e) { db.exec('ROLLBACK'); throw e } };
class ApiError extends Error { constructor(c, code, m) { super(m); this.status = c; this.code = code } }

// ---- clients subscribed per showtime (Server-Sent Events) ----
const subs = new Map();
const publish = (sid, ev) => (subs.get(sid) || new Set()).forEach(r => r.write(`data: ${JSON.stringify(ev)}\n\n`));
const sweep = () => { // expiry of temporary holds
  for (const r of q('SELECT showtime_id,seat_id FROM seat_state WHERE status=? AND expires_at<?', 'held', Date.now())) {
    run('DELETE FROM seat_state WHERE showtime_id=? AND seat_id=?', r.showtime_id, r.seat_id);
    publish(r.showtime_id, { type: 'seat', seat: r.seat_id, status: 'free' }); }
};
setInterval(sweep, 5000).unref();

// ---- services ----
const seatsOf = (st, me) => { sweep(); return q('SELECT seat_id,status,holder,expires_at FROM seat_state WHERE showtime_id=?', st)
  .map(r => ({ seat: r.seat_id, status: r.status === 'sold' ? 'sold' : r.holder === me ? 'mine' : 'held', expiresAt: r.status === 'held' ? r.expires_at : undefined })) };
const hallOfShow = id => { const s = one('SELECT * FROM showtimes WHERE id=?', id); if (!s) throw new ApiError(404, 'SHOWTIME_NOT_FOUND', 'Showtime not found'); s.prices = JSON.parse(s.prices); s.hall = JSON.parse(one('SELECT config FROM halls WHERE id=?', s.hall_id).config); return s };
function priceOf(show, seatId) { const t = show.hall.seats[seatId]; if (!t) throw new ApiError(400, 'UNKNOWN_SEAT', 'Unknown seat ' + seatId); if (t.disabled) throw new ApiError(409, 'SEAT_DISABLED', 'Seat disabled ' + seatId); return show.prices[t.category] }
function hold(showId, holder, seatIds) {
  const show = hallOfShow(showId); if (!seatIds.length || seatIds.length > (show.hall.maxSeats || 8)) throw new ApiError(400, 'BAD_SEAT_COUNT', 'Invalid number of seats');
  const res = tx(() => { sweep(); const exp = Date.now() + HOLD_MS;
    seatIds.forEach(id => { priceOf(show, id); const c = one('SELECT * FROM seat_state WHERE showtime_id=? AND seat_id=?', showId, id);
      if (c && c.holder !== holder) throw new ApiError(409, 'SEAT_TAKEN', 'Seat already taken: ' + id);
      run('INSERT OR REPLACE INTO seat_state VALUES(?,?,?,?,?,NULL)', showId, id, 'held', holder, exp) }); return exp });
  seatIds.forEach(id => publish(showId, { type: 'seat', seat: id, status: 'held' })); return { expiresAt: res };
}
function release(showId, holder, seatIds) {
  seatIds.forEach(id => { if (run("DELETE FROM seat_state WHERE showtime_id=? AND seat_id=? AND holder=? AND status='held'", showId, id, holder).changes) publish(showId, { type: 'seat', seat: id, status: 'free' }) }) }
// Payment is a pluggable provider. 'mock' is for demo; replace with a real PSP adapter (hosted checkout / tokens only — never card data).
const payments = { mock: async ({ total }) => ({ ok: true, ref: 'MOCK-' + crypto.randomUUID().slice(0, 8), total }) };
async function checkout(showId, holder, seatIds, provider = 'mock') {
  const show = hallOfShow(showId), pay = payments[provider]; if (!pay) throw new ApiError(400, 'NO_PROVIDER', 'Unknown payment provider');
  const total = tx(() => { sweep(); return seatIds.reduce((t, id) => { const c = one('SELECT * FROM seat_state WHERE showtime_id=? AND seat_id=?', showId, id);
    if (!c || c.status !== 'held' || c.holder !== holder) throw new ApiError(409, 'HOLD_EXPIRED', 'Hold missing or expired: ' + id); return t + priceOf(show, id) }, 0) });
  const r = await pay({ total, showId }); if (!r.ok) throw new ApiError(402, 'PAYMENT_FAILED', 'Payment failed');
  const oid = 'ORD-' + crypto.randomUUID().slice(0, 8).toUpperCase();
  tx(() => { seatIds.forEach(id => { const u = run("UPDATE seat_state SET status='sold',order_id=?,expires_at=NULL WHERE showtime_id=? AND seat_id=? AND holder=? AND status='held'", oid, showId, id, holder);
      if (!u.changes) throw new ApiError(409, 'HOLD_EXPIRED', 'Hold lost: ' + id) });
    run('INSERT INTO orders VALUES(?,?,?,?,?,?,?)', oid, showId, holder, JSON.stringify(seatIds), total, 'paid', Date.now()) });
  seatIds.forEach(id => publish(showId, { type: 'seat', seat: id, status: 'sold' })); return { orderId: oid, total, paymentRef: r.ref };
}

// ---- HTTP ----
const json = (res, c, o) => { res.writeHead(c, { 'content-type': 'application/json', 'access-control-allow-origin': process.env.CORS_ORIGIN || '*' }); res.end(JSON.stringify(o)) };
const body = req => new Promise((ok, no) => { let b = ''; req.on('data', d => { b += d; if (b.length > 1e5) req.destroy() }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}) } catch { no(new ApiError(400, 'BAD_JSON', 'Invalid JSON')) } }) });
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // admin API stays closed until this env var is set
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname.split('/').filter(Boolean), m = req.method;
  const who = req.headers['x-session'] || u.searchParams.get('session') || '';
  try {
    if (m === 'OPTIONS') return json(res, 204, {});
    if (p[0] !== 'api') { if (m === 'GET' && !p.length) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(require('node:fs').readFileSync(require('node:path').join(__dirname, '../public/index.html'))) } throw new ApiError(404, 'NOT_FOUND', 'Not found') }
    if (p[1] === 'health') return json(res, 200, { ok: true });
    if (p[1] === 'movies' && m === 'GET') return json(res, 200, q('SELECT id,data,is_demo FROM movies').map(r => ({ ...JSON.parse(r.data), id: r.id, isDemo: !!r.is_demo })));
    if (p[1] === 'showtimes' && !p[2]) { const mv = u.searchParams.get('movie'); return json(res, 200, q('SELECT s.id,s.movie_id,s.hall_id,s.starts_at,s.prices,h.cinema,h.name hall,json_extract(h.config,\'$.format\') format FROM showtimes s JOIN halls h ON h.id=s.hall_id WHERE (?1 IS NULL OR s.movie_id=?1) ORDER BY s.starts_at', mv).map(r => ({ ...r, prices: JSON.parse(r.prices) }))) }
    if (p[1] === 'showtimes' && p[2]) {
      const id = p[2];
      if (p[3] === 'hall') return json(res, 200, hallOfShow(id).hall);
      if (p[3] === 'seats' && m === 'GET') return json(res, 200, seatsOf(id, who));
      if (p[3] === 'stream') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' }); res.write(': ok\n\n');
        if (!subs.has(id)) subs.set(id, new Set()); subs.get(id).add(res); req.on('close', () => subs.get(id).delete(res)); return }
      if (p[3] === 'hold' && m === 'POST') { const b = await body(req); return json(res, 200, hold(id, who, b.seats || [])) }
      if (p[3] === 'release' && m === 'POST') { const b = await body(req); release(id, who, b.seats || []); return json(res, 200, { ok: true }) }
      if (p[3] === 'checkout' && m === 'POST') { const b = await body(req); return json(res, 200, await checkout(id, who, b.seats || [], b.provider)) }
    }
    throw new ApiError(404, 'NOT_FOUND', 'Not found');
  } catch (e) { const known = e instanceof ApiError; if (!known) console.error(e); json(res, known ? e.status : 500, { error: { code: known ? e.code : 'INTERNAL', message: known ? e.message : 'Internal error' } }) }
});
module.exports = { db, run, q, one, tx, server, hold, release, checkout, ADMIN_TOKEN };
if (require.main === module) { require('./seed').seed(); server.listen(PORT, () => console.log('3D SEATVIEW API on :' + PORT)) }
