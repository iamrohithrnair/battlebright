/**
 * Every route the demo cares about. `canvas: true` means the page owns a WebGL
 * surface that needs paint-detection before a screenshot is worth taking.
 * `expected: false` marks routes that are still being built by a sibling agent,
 * so a 404 there is reported as "not built yet" rather than a failure.
 */
export const ROUTES = [
  { id: 'hero', path: '/', label: 'Hero arena', canvas: true, expected: true },
  { id: 'predict', path: '/predict', label: 'Matchup studio', canvas: true, expected: true },
  { id: 'roster', path: '/roster', label: 'Roster grid', canvas: false, expected: true },
  { id: 'robot', path: '/roster/Tombstone', label: 'Robot detail — Tombstone', canvas: true, expected: true },
  { id: 'leaderboard', path: '/leaderboard', label: 'Leaderboard', canvas: false, expected: true },
  { id: 'tournament', path: '/tournament', label: 'Tournament bracket', canvas: true, expected: true },
  { id: 'insights', path: '/insights', label: 'Weapon-class meta', canvas: true, expected: true },
  { id: 'model', path: '/model', label: 'Backtest & transparency', canvas: false, expected: true },
  { id: 'intel', path: '/intel', label: 'Bright Data console', canvas: false, expected: true },
  { id: 'analyst', path: '/analyst', label: 'AI analyst', canvas: false, expected: true },
  { id: 'commentary', path: '/commentary', label: 'AI commentator', canvas: false, expected: true },
];
