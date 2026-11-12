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
    makeHall({ id: 'tb-2', cinema: 'Cavea Tbilisi Mall', name: 'Hall 2', format: 'standard', rows: 8, cols: 16, rowPitch: 1.3, seatPitch: .72, rise: .3, firstZ: 4.6, screen: { width: 12.4, height: 5.2, bottom: .9, z: -.3 }, vipRows: [4, 5] })];
  halls.forEach(h => run('INSERT OR REPLACE INTO halls VALUES(?,?,?,?,1)', h.id, h.cinema, h.name, JSON.stringify(h)));
  const yt = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  // DEMO movie metadata. Durations/languages are placeholders; real posters/metadata come from Cavea.
  const mv = [
    ['m1', { title: { ka: 'შურისმაძიებლები: დოქტორი დუმი', en: 'Avengers: Doomsday' }, durationMin: 150, languages: ['EN'], subtitles: ['KA'], formats: ['2D', 'IMAX'], poster: '', youtube: 'irVNGjRFZGk' }],
    ['m2', { title: { ka: 'დიუნი: ნაწილი მესამე', en: 'Dune: Part Three' }, durationMin: 165, languages: ['EN'], subtitles: ['KA'], formats: ['2D', 'IMAX'], poster: yt('uJqaGLmZpGo'), youtube: 'uJqaGLmZpGo' }],
    ['m3', { title: { ka: 'კატა ქუდით', en: 'The Cat in the Hat' }, durationMin: 90, languages: ['KA'], subtitles: [], formats: ['2D'], poster: yt('Vuv0kqGWjno'), youtube: 'Vuv0kqGWjno' }],
    ['m4', { title: { ka: 'შენ ყველაფრის დანახვა შეგიძლია', en: 'You Can See Everything' }, durationMin: 100, languages: ['EN'], subtitles: ['KA'], formats: ['2D'], poster: yt('HvW_N5p1q44'), youtube: 'HvW_N5p1q44' }],
    ['m5', { title: { ka: 'სკრუჯი', en: 'Scrooge' }, durationMin: 95, languages: ['EN'], subtitles: ['KA'], formats: ['2D'], poster: yt('A7lyvgnDuDE'), youtube: 'A7lyvgnDuDE' }],
    ['m6', { title: { ka: 'გამყინვარების ხანა: დუღილის წერტილი', en: 'Ice Age: Boiling Point' }, durationMin: 90, languages: ['KA'], subtitles: [], formats: ['2D'], poster: yt('3fjmjX0QOIg'), youtube: '3fjmjX0QOIg' }],
    ['m7', { title: { ka: 'განრისხებული ჩიტები 3', en: 'Angry Birds 3' }, durationMin: 95, languages: ['KA'], subtitles: [], formats: ['2D'], poster: yt('FjYzudbOzlY'), youtube: 'FjYzudbOzlY' }],
    ['m8', { title: { ka: 'ჯუმანჯი: ღია სამყარო', en: 'Jumanji: Open World' }, durationMin: 115, languages: ['EN'], subtitles: ['KA'], formats: ['2D', 'IMAX'], poster: yt('lga7vdbXDCw'), youtube: 'lga7vdbXDCw' }]];
  mv.forEach(([id, d]) => run('INSERT OR REPLACE INTO movies VALUES(?,?,1)', id, JSON.stringify(d)));
  const d1 = new Date(Date.now() + 864e5).toISOString().slice(0, 10), d2 = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), P = { standard: 17, vip: 19 }, PI = { standard: 24, vip: 28 };
  const shows = [['s1', 'm1', 'ep-4', d1, '18:30', P], ['s2', 'm1', 'ep-1', d1, '20:15', PI], ['s3', 'm1', 'tb-2', d1, '21:00', P],
    ['s4', 'm2', 'ep-1', d1, '19:00', PI], ['s5', 'm2', 'tb-2', d1, '20:30', P], ['s6', 'm2', 'ep-4', d1, '20:00', P],
    ['s7', 'm3', 'ep-4', d1, '16:00', P], ['s8', 'm3', 'tb-2', d1, '15:00', P], ['s9', 'm3', 'ep-4', d1, '14:00', P],
    ['s10', 'm4', 'ep-4', d1, '21:30', P], ['s11', 'm4', 'tb-2', d1, '19:30', P],
    ['s12', 'm5', 'ep-4', d1, '12:00', P], ['s13', 'm5', 'tb-2', d1, '17:00', P],
    ['s14', 'm6', 'ep-1', d1, '13:00', PI], ['s15', 'm6', 'tb-2', d1, '13:30', P],
    ['s16', 'm7', 'ep-4', d1, '17:30', P], ['s17', 'm7', 'ep-1', d1, '16:30', PI],
    ['s18', 'm8', 'ep-1', d1, '18:00', PI], ['s19', 'm8', 'tb-2', d1, '22:00', P]];
  shows.forEach(([id, m, h, d, t, pr]) => run('INSERT OR REPLACE INTO showtimes VALUES(?,?,?,?,?,1)', id, m, h, `${d}T${t}`, JSON.stringify(pr)));
  // DEMO occupancy: deterministic pseudo-random sold seats per showtime (~15%)
  const hash = str => { let x = 7; for (const c of str) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x };
  shows.forEach(([id, , h]) => Object.keys(halls.find(x => x.id === h).seats).forEach(k => { if (hash(id + k) % 7 === 0) run("INSERT OR IGNORE INTO seat_state VALUES(?,?, 'sold','demo',NULL,'DEMO')", id, k) }));
};
