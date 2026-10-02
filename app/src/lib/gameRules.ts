/**
 * StreamRealm game rules (client copy). The server (server/app/services/rules.py) is the
 * source of truth; these must stay in sync. The client uses them for previews and labels.
 */
import type { TeamId } from './theme';

export const FRESH_DAYS = 7;
export const FADING_DAYS = 14;
export const CLAIM_RADIUS_M = 40;
export const AGREEMENT_THRESHOLD = 0.67;
export const ANTI_FARM_HOURS = 6;
export const STORM_RAIN_MM_48H = 10;

export const POINTS = {
  explore: 50,
  claim_neutral: 25,
  refresh: 20,
  attack: 30,
  confirm_dispute: 15,
  treasure: 40,
} as const;
export const STORM_MULTIPLIER = 2;
export const STREAK_BONUS_PER_DAY = 10;
export const STREAK_BONUS_MAX = 50;

export type TileStateName = 'fog' | 'owned_fresh' | 'owned_fading' | 'neutral' | 'disputed';
export type Action = keyof Omit<typeof POINTS, 'treasure'>;

export const QUESTIONS = {
  color: ['clear', 'slightly_cloudy', 'brown', 'green', 'other'],
  smell: ['none', 'earthy', 'bad', 'chemical'],
  foam: ['none', 'a_little', 'a_lot'],
  trash: ['none', 'a_few', 'a_lot'],
  flow: ['flowing', 'slow', 'still', 'dry'],
  overall: ['good', 'moderate', 'poor'],
} as const;
export type QuestionId = keyof typeof QUESTIONS;
export type Answers = { [K in QuestionId]: (typeof QUESTIONS)[K][number] };
export const QUESTION_IDS = Object.keys(QUESTIONS) as QuestionId[];
const ORDINAL: QuestionId[] = ['foam', 'trash', 'overall'];

export const PENALTIES: { [K in QuestionId]: Record<string, number> } = {
  color: { clear: 0, slightly_cloudy: 10, brown: 25, green: 25, other: 15 },
  smell: { none: 0, earthy: 5, bad: 30, chemical: 30 },
  foam: { none: 0, a_little: 10, a_lot: 25 },
  trash: { none: 0, a_few: 10, a_lot: 25 },
  flow: { flowing: 0, slow: 5, still: 15, dry: 20 },
  overall: { good: 0, moderate: 10, poor: 20 },
};

export const TREASURE_TYPES = ['pipe', 'trash', 'wildlife', 'plant', 'algae'] as const;
export type TreasureType = (typeof TREASURE_TYPES)[number];

export function healthScore(answers: Partial<Answers>): number {
  let total = 0;
  for (const q of QUESTION_IDS) {
    const v = answers[q];
    if (v) total += PENALTIES[q][v] ?? 0;
  }
  return Math.max(0, Math.min(100, 100 - total));
}

/** Agreement between two checks over the 6 answers, 0..1 (same as the server). */
export function agreement(a: Partial<Answers>, b: Partial<Answers>): number {
  let score = 0;
  for (const q of QUESTION_IDS) {
    const va = a[q];
    const vb = b[q];
    if (!va || !vb) continue;
    if (va === vb) score += 1;
    else if (ORDINAL.includes(q)) {
      const values = QUESTIONS[q] as readonly string[];
      if (Math.abs(values.indexOf(va) - values.indexOf(vb)) === 1) score += 0.5;
    }
  }
  return Math.round((score / QUESTION_IDS.length) * 10000) / 10000;
}

const DAY_MS = 86_400_000;

export function tileState(lastCheckAt: Date | null, disputeOpen: boolean, now: Date): TileStateName {
  if (disputeOpen) return 'disputed';
  if (!lastCheckAt) return 'fog';
  const age = now.getTime() - lastCheckAt.getTime();
  if (age <= FRESH_DAYS * DAY_MS) return 'owned_fresh';
  if (age <= FADING_DAYS * DAY_MS) return 'owned_fading';
  return 'neutral';
}

export function classifyAction(state: TileStateName, ownerTeam: TeamId | null, playerTeam: TeamId): Action {
  if (state === 'fog') return 'explore';
  if (state === 'neutral') return 'claim_neutral';
  if (state === 'disputed') return 'confirm_dispute';
  return ownerTeam === playerTeam ? 'refresh' : 'attack';
}

export function isFarming(lastSamePlayerCheck: Date | null, now: Date): boolean {
  return !!lastSamePlayerCheck && now.getTime() - lastSamePlayerCheck.getTime() < ANTI_FARM_HOURS * 3_600_000;
}

export function streakBonus(streak: number): number {
  return Math.min(STREAK_BONUS_PER_DAY * streak, STREAK_BONUS_MAX);
}

/** Points the player can expect before doing a check (no streak/treasure). */
export function previewPoints(action: Action, storm: boolean): number {
  return POINTS[action] * (storm ? STORM_MULTIPLIER : 1);
}

/** Third check settles a dispute: side that agrees more with it wins; ties go to the defender. */
export function resolveByMajority(defender: Partial<Answers>, attacker: Partial<Answers>, third: Partial<Answers>): 'defender' | 'attacker' {
  return agreement(third, attacker) > agreement(third, defender) ? 'attacker' : 'defender';
}

export const ACTION_LABEL: Record<Action, string> = {
  explore: 'Explore this fog tile',
  claim_neutral: 'Claim this free tile',
  refresh: 'Refresh your tile',
  attack: 'Attack this tile',
  confirm_dispute: 'Settle this dispute',
};

export const STATE_LABEL: Record<TileStateName, string> = {
  fog: 'Unexplored (fog)',
  owned_fresh: 'Fresh',
  owned_fading: 'Fading',
  neutral: 'Free land',
  disputed: 'Disputed',
};

export const ANSWER_LABEL: Record<string, string> = {
  clear: 'Clear', slightly_cloudy: 'Slightly cloudy', brown: 'Brown', green: 'Green', other: 'Other',
  none: 'None', earthy: 'Earthy', bad: 'Bad (sewage, rotten)', chemical: 'Chemical',
  a_little: 'A little', a_lot: 'A lot', a_few: 'A few items',
  flowing: 'Flowing', slow: 'Slow', still: 'Still', dry: 'Dry',
  good: 'Good', moderate: 'Moderate', poor: 'Poor',
};

export const QUESTION_LABEL: Record<QuestionId, string> = {
  color: 'Water color',
  smell: 'Smell',
  foam: 'Foam or oily film',
  trash: 'Trash',
  flow: 'Water flow',
  overall: 'Overall feeling',
};

export const TREASURE_INFO: Record<TreasureType, { label: string; emoji: string; hint: string }> = {
  pipe: { label: 'Pipe or outlet', emoji: '🔧', hint: 'A pipe that flows into the stream' },
  trash: { label: 'Trash hotspot', emoji: '🗑️', hint: 'A place with a lot of trash' },
  wildlife: { label: 'Bird or animal', emoji: '🐦', hint: 'You saw a bird, fish or other animal' },
  plant: { label: 'Strange plant', emoji: '🌿', hint: 'An invasive or unusual plant' },
  algae: { label: 'Algae bloom', emoji: '🟢', hint: 'Green slime or a green layer on the water' },
};
