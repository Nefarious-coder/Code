// DEMO DATA ONLY (is_demo=1). Real Cavea data must be imported via the same tables/config format.
const { run } = require('./server');
// Hall config: explicit geometry + explicit per-seat coordinates (no random layouts).
function makeHall({ id, cinema, name, format, rows, cols, rowPitch, seatPitch, rise, firstZ, screen, aisleAfter = [], vipRows = [], disabled = [] }) {
  const seats = {}, rowDefs = [];
  for (let r = 0; r < rows; r++) { const y = 0.12 + r * rise, z = firstZ + r * rowPitch; rowDefs.push({ row: r + 1, y, z, slopeDeg: +(Math.atan(rise / rowPitch) * 57.3).toFixed(1) });
    let n = 0; for (let c = 0; c < cols; c++) { if (aisleAfter.includes(c)) { } const x = (c - (cols - 1) / 2) * seatPitch;
      seats[`R${r + 1}-${++n}`] = { row: r + 1, num: n, x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3), category: vipRows.includes(r + 1) ? 'vip' : 'standard', disabled: disabled.includes(`R${r + 1}-${n}`) } } }
  return { id, cinema, name, format, maxSeats: 8, dimensions: { width: cols * seatPitch + 3, length: firstZ + rows * rowPitch + 1.4, height: 0.12 + rows * rise + 3.8 }, screen, rows: rowDefs, seats };
}
exports.seed = () => {
  const halls = [
    makeHall({ id: 'ep-4', cinema: 'Cavea East Point', name: 'Hall 4', format: 'standard', rows: 9, cols: 14, rowPitch: 1.3, seatPitch: .72, rise: .3, firstZ: 4.5, screen: { width: 11.5, height: 4.8, bottom: .9, z: -.3 }, vipRows: [4, 5, 6] }),
    makeHall({ id: 'ep-1', cinema: 'Cavea East Point', name: 'Hall 1', format: 'imax', rows: 12, cols: 20, rowPitch: 1.3, seatPitch: .72, rise: .36, firstZ: 5, screen: { width: 13.4, height: 9.4, bottom: .5, z: -.3 }, vipRows: [5, 6, 7, 8, 9, 10] }),
    makeHall({ id: 'tb-2', cinema: 'Cavea Tbilisi Mall', name: 'Hall 2', format: 'screenx', rows: 8, cols: 16, rowPitch: 1.3, seatPitch: .72, rise: .3, firstZ: 4.6, screen: { width: 14.5, height: 6.1, bottom: .9, z: -.3 }, vipRows: [4, 5] })];
  halls.forEach(h => run('INSERT OR REPLACE INTO halls VALUES(?,?,?,?,1)', h.id, h.cinema, h.name, JSON.stringify(h)));
  const mv = [['m1', { title: { ka: 'შურისმაძიებლები: დოქტორი დუმი', en: 'Avengers: Doomsday', ru: 'Мстители: Судный день' }, durationMin: 150, languages: ['EN'], subtitles: ['KA'], formats: ['2D', 'IMAX'], poster: '', youtube: 'irVNGjRFZGk' }],
    ['m2', { title: { ka: 'დემო ფილმი 2', en: 'Demo Film 2', ru: 'Демо фильм 2' }, durationMin: 118, languages: ['KA'], subtitles: [], formats: ['2D'], poster: '' }]];
  mv.forEach(([id, d]) => run('INSERT OR REPLACE INTO movies VALUES(?,?,1)', id, JSON.stringify(d)));
  const day = new Date(Date.now() + 864e5).toISOString().slice(0, 10), P = { standard: 17, vip: 19 }, PI = { standard: 24, vip: 28 };
  [['s1', 'm1', 'ep-4', '18:30', P], ['s2', 'm1', 'ep-1', '20:15', PI], ['s3', 'm1', 'tb-2', '21:00', P], ['s4', 'm2', 'ep-4', '16:00', P]]
    .forEach(([id, m, h, t, pr]) => run('INSERT OR REPLACE INTO showtimes VALUES(?,?,?,?,?,1)', id, m, h, `${day}T${t}`, JSON.stringify(pr)));
  // pre-sold seats for demo
  ['R1-3', 'R1-4', 'R2-8', 'R3-5', 'R5-6', 'R5-7'].forEach(s => run("INSERT OR IGNORE INTO seat_state VALUES('s1',?, 'sold','demo',NULL,'DEMO')", s));
};
