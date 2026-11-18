// Tickets the app suggested before the app recorded them itself (17 Nov 2026, Nations League).
// Each was given before kick-off; results checked against ESPN final scores.
const L = (eid, n, p, ok) => ({ eid, lg: 'uefa.nations', n, p, ok });
const SUG_SEED = [
  { id: '20261117|gol', date: '20261117', cid: 'gol', title: '⚽ Goals 4+', fair: 4.63, res: 'WON', legs: [
    L('401861196', 'Bosnia-Herzegovina over 0.5', 0.87, 1), L('401861191', 'Under 3.5', 0.86, 1), L('401861189', 'Portugal over 0.5', 0.85, 1),
    L('401861194', 'Denmark over 0.5', 0.84, 1), L('401861192', 'Under 3.5', 0.83, 1), L('401861195', 'Over 1.5', 0.81, 1),
    L('401861190', 'Under 3.5', 0.79, 1), L('401861193', 'Over 1.5', 0.76, 1)] },
  { id: '20261117|b6', date: '20261117', cid: 'b6', title: '💎 Best 6', fair: 8.5, res: 'LOST', legs: [
    L('401861190', 'Ukraine over 0.5', 0.78, 1), L('401861194', 'Denmark or draw', 0.73, 0), L('401861192', 'Republic of Ireland over 0.5', 0.72, 1),
    L('401861191', 'Hungary over 0.5', 0.68, 1), L('401861195', 'Sweden or draw', 0.66, 1), L('401861193', 'Israel over 0.5', 0.65, 1)] },
  { id: '20261117|big', date: '20261117', cid: 'big', title: '🎰 Big payout 10+', fair: 14.35, res: 'LOST', legs: [
    L('401861191', 'Hungary over 0.5', 0.68, 1), L('401861195', 'Sweden or draw', 0.66, 1), L('401861193', 'Israel over 0.5', 0.65, 1),
    L('401861189', 'Portugal win', 0.64, 1), L('401861196', 'Bosnia-Herzegovina win', 0.64, 1), L('401861192', 'Kosovo over 0.5', 0.59, 0)] },
  { id: '20261117|long', date: '20261117', cid: 'long', title: '🎯 Long shot 50', fair: 56, res: 'LOST', legs: [
    L('401861194', 'Denmark win', 0.5, 0), L('401861190', 'Ukraine win', 0.53, 1), L('401861193', 'Austria win', 0.53, 0),
    L('401861195', 'Sweden win', 0.4, 0), L('401861191', 'Draw', 0.32, 1)] },
  { id: '20261120|week', date: '20261120', cid: 'week', title: '⭐ Week\'s strongest 7', fair: 2.8, legs: [
    { eid: '401884736', lg: 'ger.1', n: 'Bayern Munich win', p: 0.89 },
    { eid: '401888245', lg: 'tur.1', n: 'Galatasaray win', p: 0.89 },
    { eid: '401875543', lg: 'ned.1', n: 'Feyenoord Rotterdam win', p: 0.82 },
    { eid: '401878338', lg: 'sco.1', n: 'Celtic win', p: 0.8 },
    { eid: '401888249', lg: 'tur.1', n: 'Trabzonspor win', p: 0.92 },
    { eid: '401875545', lg: 'ned.1', n: 'FC Twente win', p: 0.88 },
    { eid: '401878936', lg: 'bel.1', n: 'Union St.-Gilloise win', p: 0.85 },
] },
];
export default SUG_SEED;
