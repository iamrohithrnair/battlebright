import {
  BarChart3,
  Bot,
  Brain,
  FlaskConical,
  Radio,
  Sparkles,
  Swords,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** One-line description used in the mobile menu. */
  blurb: string;
}

/**
 * The canonical nav. `/intel` and `/analyst` are owned by the parallel
 * Bright Data and AI-analyst workstreams; the links live here so the shell
 * stays in one place.
 */
export const NAV_LINKS: NavLink[] = [
  { href: '/predict', label: 'Predict', icon: Swords, blurb: 'Head-to-head win probability' },
  { href: '/roster', label: 'Roster', icon: Bot, blurb: 'All 42 competitors' },
  { href: '/leaderboard', label: 'Leaderboard', icon: BarChart3, blurb: 'Ranked by win rate' },
  { href: '/tournament', label: 'Tournament', icon: Trophy, blurb: 'Simulate a bracket' },
  { href: '/insights', label: 'Insights', icon: FlaskConical, blurb: 'Weapon-class meta' },
  { href: '/model', label: 'Model', icon: Brain, blurb: 'Backtest & transparency' },
  { href: '/intel', label: 'Intel', icon: Radio, blurb: 'Live scrape via Bright Data' },
  { href: '/analyst', label: 'Analyst', icon: Sparkles, blurb: 'Ask the AI analyst' },
];
