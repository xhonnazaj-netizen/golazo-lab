// Nightly: collects this week's fixtures, tables, top scorers, squads with season stats, transfers and results.
// Writes public/week.json (served with the app) and model/data/espn-results.json (for model training).
import fs from 'node:fs';
import { collectWeek, setLogger } from './collect-lib.mjs';

setLogger((m) => console.log(m));
const t0 = Date.now();
const { week, res } = await collectWeek();
const fx = week.fx.length, teams = Object.keys(week.tm).length;
const players = Object.values(week.tm).reduce((a, t) => a + t.sq.length, 0);
const tr = Object.values(week.tm).reduce((a, t) => a + t.tr.in.length + t.tr.out.length, 0);
console.log(`week ${week.from}..${week.to}: ${fx} fixtures, ${teams} teams, ${players} players, ${tr} transfers in ${Math.round((Date.now() - t0) / 1000)}s`);
if (fx === 0 && teams === 0) {
  console.error('Nothing collected – keeping the old files');
  process.exit(0);
}
fs.mkdirSync('model/data', { recursive: true });
fs.writeFileSync('public/week.json', JSON.stringify(week));
fs.writeFileSync('model/data/espn-results.json', JSON.stringify({ updated: week.updated, lg: res }));
console.log('written public/week.json', Math.round(fs.statSync('public/week.json').size / 1024), 'KB');
