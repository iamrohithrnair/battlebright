export type WeaponType =
  | 'horizontal_spinner'
  | 'vertical_spinner'
  | 'drum_spinner'
  | 'overhead_saw'
  | 'flipper'
  | 'lifter'
  | 'hammer'
  | 'crusher';

export interface Robot {
  robot: string;
  weapon_type: WeaponType;
  weight_lb: number;
  wins: number;
  losses: number;
  ko_wins: number;
  builder: string;
  country: string;
}

export interface Match {
  season: number;
  robot_a: string;
  robot_b: string;
  winner: string;
  method: 'KO' | 'JD';
}

export interface LeaderboardRow {
  rank: number;
  robot: string;
  weapon_type: WeaponType;
  wins: number;
  losses: number;
  win_rate: number;
  ko_rate: number;
  builder: string;
}

export interface RobotMatch {
  season: number;
  opponent: string;
  result: 'Win' | 'Loss';
  method: 'KO' | 'JD';
}

export interface RobotDetail extends Robot {
  win_rate: number;
  ko_rate: number;
  rank: number | null;
  matches: RobotMatch[];
}

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Prediction {
  robot_a: string;
  robot_b: string;
  prob_a: number;
  prob_b: number;
  winner: string;
  loser: string;
  confidence: Confidence;
  head_to_head: { a: number; b: number };
  signals: {
    win_rate: { a: number; b: number };
    ko_rate: { a: number; b: number };
    weapon_edge: { a: number; b: number };
  };
  /** Weighted score contributions, so the UI can show *how* the number was built. */
  contributions: {
    label: string;
    weight: number;
    a: number;
    b: number;
  }[];
  reasons: string[];
  /** Most likely finish, derived from both bots' KO tendencies. */
  projected_method: 'KO' | 'JD';
  ko_likelihood: number;
}

export interface Bucket {
  correct: number;
  total: number;
  accuracy: number;
}

export interface BacktestSample {
  season: number;
  robot_a: string;
  robot_b: string;
  actual: string;
  predicted: string;
  confidence: Confidence;
  correct: boolean;
}

export interface BacktestResult {
  total: number;
  correct: number;
  accuracy: number;
  baseline: number;
  by_confidence: Record<Confidence, Bucket>;
  by_method: Record<'KO' | 'JD', Bucket>;
  by_season: { season: number; correct: number; total: number; accuracy: number }[];
  samples: BacktestSample[];
}

export interface WeaponMeta {
  weapon: WeaponType;
  robots: number;
  wins: number;
  losses: number;
  win_rate: number;
  ko_rate: number;
  battle_wins: number;
  battle_losses: number;
  battle_rate: number;
}

export interface Upset {
  season: number;
  favorite: string;
  fav_prob: number;
  actual_winner: string;
  method: 'KO' | 'JD';
}

export interface BracketMatch {
  a: string;
  b: string;
  winner: string;
  prob_a: number;
  prob_b: number;
  confidence: Confidence;
}

export interface TournamentResult {
  size: number;
  seeds: string[];
  rounds: BracketMatch[][];
  champion: string;
}

/** A single scouting report line, generated from the model's own signals. */
export interface ScoutingReport {
  robot: string;
  archetype: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  /** Opponents the model says this bot beats / loses to most decisively. */
  best_matchups: { opponent: string; prob: number }[];
  worst_matchups: { opponent: string; prob: number }[];
}

/* ---------- Bright Data ---------- */

export interface Provenance {
  url: string;
  zone: string;
  bytes: number;
  ms: number;
  fetched_at: string;
  /** true when served from the in-process cache rather than a fresh unlock. */
  cached: boolean;
  status: 'live' | 'cached' | 'fallback';
}

export interface ScrapedRobot {
  robot: string;
  weapon_type: string | null;
  weight_lb: number | null;
  country: string | null;
  builder: string | null;
  team: string | null;
  /** Short excerpt of the wiki lede, proving we really parsed the page. */
  excerpt: string | null;
  image: string | null;
  /** Season/record mentions found in the page. */
  seasons: string[];
}

export interface IntelResult {
  scraped: ScrapedRobot;
  local: Robot | null;
  /** Field-by-field agreement between the live page and our bundled dataset. */
  diff: { field: string; local: string; live: string; match: boolean }[];
  provenance: Provenance;
}
