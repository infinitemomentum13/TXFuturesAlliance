/**
 * Prompt 6B seeds — Talent Insights (FC Brownsville club staff only).
 * All fictional (is_sample). See openapi_additions.yaml "TALENT INSIGHTS
 * (Prompt 6B)" for the suggested tables. Development history is generated
 * deterministically (seeded PRNG) so the charts are stable between reloads.
 */
import type {
  AppStudent,
  AthleticProfile,
  ConsentRecord,
  DevelopmentPoint,
  HiddenGem,
  HiddenGemReason,
  PositionAttribute,
  PositionProfile,
  TalentPlayerSummary,
  TryoutPlayer,
} from '../api/types';

/** Players whose parent (or the player, if 18+) turned ON
 *  "Use my player data for club player development" in the sample data.
 *  Spread across birth years, quarters, genders, ZIPs and team levels so
 *  every Talent Insights view has data. Everyone else stays OFF. */
export const TALENT_CONSENTED_IDS = [
  // 2009
  'sample-007', 'sample-015', 'sample-044', 'sample-124', 'sample-126',
  // 2010
  'sample-005', 'sample-031', 'sample-038', 'sample-067', 'sample-101', 'sample-136', 'sample-150',
  // 2011
  'sample-008', 'sample-021', 'sample-094', 'sample-117', 'sample-175',
  // 2012
  'sample-016', 'sample-037', 'sample-071', 'sample-089', 'sample-151',
  // 2013
  'sample-013', 'sample-053', 'sample-108', 'sample-138', 'sample-166',
  // 2014
  'sample-042', 'sample-056', 'sample-077', 'sample-082', 'sample-105', 'sample-111',
] as const;

/** Engineering notes for the generator: a few archetypes so the views show
 *  meaningful patterns (hidden gems, steady stars, late bloomers). */
const HIGH_SLOPE = new Set(['sample-101', 'sample-117', 'sample-166', 'sample-111', 'sample-013', 'sample-067', 'sample-082']);
const STAR = new Set(['sample-044', 'sample-038', 'sample-077', 'sample-094']);
const LOW_MINUTES = new Set(['sample-101', 'sample-117', 'sample-166', 'sample-111', 'sample-013', 'sample-067']);

/** Deterministic PRNG so generated history is stable between sessions. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashId = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const SOURCES: DevelopmentPoint['source'][] = [
  'coach_evaluation',
  'physical_test',
  'match_record',
  'racing360',
  'coach_evaluation',
  'match_record',
  'physical_test',
  'racing360',
];

/** Eight standardized measures over the last 12 months per club player.
 *  History is generated for EVERY FC Brownsville player — the data exists
 *  regardless (coaches evaluate, tests are run); the club_player_development
 *  consent gates whether Talent Insights may USE it (enforced in talentPool). */
export function seedDevelopmentHistory(
  students: AppStudent[],
): Record<string, DevelopmentPoint[]> {
  const out: Record<string, DevelopmentPoint[]> = {};
  for (const s of students) {
    if (!s.date_of_birth) continue;
    const rand = mulberry32(hashId(s.student_id));
    const star = STAR.has(s.student_id);
    const gem = HIGH_SLOPE.has(s.student_id);
    // Slopes are points/month over 12 months — gems climb fast but stay
    // believable (≈ +3 over a year), stars stay high and steady.
    const base = star ? 6.4 + rand() * 0.8 : gem ? 3.4 + rand() * 0.8 : 4.4 + rand() * 1.2;
    const slope = star ? 0.04 + rand() * 0.06 : gem ? 0.22 + rand() * 0.12 : 0.06 + rand() * 0.08;
    // technical/tactical strengths for gems
    const techBias = gem ? 0.5 : rand() * 0.6 - 0.3;
    const physBias = star ? 0.6 : rand() * 0.8 - 0.4;
    const points: DevelopmentPoint[] = [];
    for (let i = 0; i < 8; i++) {
      const monthsAgo = 12 - i * 1.6;
      const date = new Date(Date.UTC(2026, 9, 7) - monthsAgo * 30.4 * 24 * 3600 * 1000);
      const lvl = base + slope * (12 - monthsAgo);
      const jitter = () => (rand() - 0.5) * 0.5;
      const p: DevelopmentPoint = {
        date: date.toISOString().slice(0, 10),
        source: SOURCES[i],
        technical: r1(clamp(lvl + techBias + jitter(), 1, 10)),
        tactical: r1(clamp(lvl + techBias * 0.7 + jitter(), 1, 10)),
        physical: r1(clamp(lvl + physBias + jitter(), 1, 10)),
        mentality: r1(clamp(lvl + rand() * 0.6 - 0.2 + jitter(), 1, 10)),
      };
      if (SOURCES[i] === 'match_record') {
        p.minutes_pct = LOW_MINUTES.has(s.student_id)
          ? Math.round(15 + rand() * 20)
          : Math.round(55 + rand() * 35);
        p.attendance_pct = Math.round(72 + rand() * 26);
      }
      points.push(p);
    }
    out[s.student_id] = points;
  }
  return out;
}

/** Latest physical-test sub-scores (1–10) used by position profiles. */
export type PhysicalProfile = Record<'speed' | 'agility' | 'endurance' | 'strength', number>;

export function seedPhysicalProfiles(students: AppStudent[]): Record<string, PhysicalProfile> {
  const out: Record<string, PhysicalProfile> = {};
  for (const s of students) {
    if (!s.date_of_birth) continue;
    const rand = mulberry32(hashId(s.student_id) ^ 0x9e37);
    out[s.student_id] = {
      speed: r1(3.5 + rand() * 5.5),
      agility: r1(3.5 + rand() * 5.5),
      endurance: r1(3.5 + rand() * 5.5),
      strength: r1(3 + rand() * 5.5),
    };
  }
  return out;
}

/** Turn ON the club-player-development consent for the sample opted-in
 *  players (granted by a parent in the sample data). Everyone else: OFF. */
export function grantTalentConsent(consents: ConsentRecord[]): void {
  for (const c of consents) {
    if (!(TALENT_CONSENTED_IDS as readonly string[]).includes(c.student_id)) continue;
    c.consents.club_player_development = {
      key: 'club_player_development',
      granted: true,
      granted_at: '2026-08-15T09:00:00.000Z',
      granted_by_role: 'parent',
    };
    c.access_log.push({
      party: 'FC Brownsville player development staff',
      scope: 'club_player_development',
      since: '2026-08-15T09:00:00.000Z',
    });
    c.updated_at = '2026-08-15T09:00:00.000Z';
  }
}

/* --------------------------- Computations ------------------------------ */

const MONTH_MS = 30.4 * 24 * 3600 * 1000;
const NOW_MS = new Date('2026-10-07T12:00:00.000Z').getTime();

const overall = (p: DevelopmentPoint) =>
  ((p.technical ?? 0) + (p.tactical ?? 0) + (p.physical ?? 0) + (p.mentality ?? 0)) / 4;

export function birthQuarter(dateOfBirth: string): 1 | 2 | 3 | 4 {
  const m = Number(dateOfBirth.slice(5, 7));
  return (m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4) as 1 | 2 | 3 | 4;
}

/** Linear-regression slope (points/month) of the overall measure over the
 *  last 6 months — the headline IMPROVEMENT RATE. */
export function improvementRate(points: DevelopmentPoint[]): number {
  const recent = points.filter((p) => NOW_MS - new Date(p.date).getTime() <= 6 * MONTH_MS);
  if (recent.length < 2) return 0;
  const xs = recent.map((p) => (NOW_MS - new Date(p.date).getTime()) / MONTH_MS);
  const ys = recent.map(overall);
  const xm = xs.reduce((a, b) => a + b, 0) / xs.length;
  const ym = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - xm) * (ys[i] - ym); den += (x - xm) ** 2; });
  // slope is per month-ago; negate so "getting better" is positive
  return den === 0 ? 0 : r1(-(num / den));
}

/** Age adjustment heuristic: within a birth year, a Q4 player is ~9 months
 *  younger than a Q1 player. Add 0.25 level points per later quarter when
 *  comparing — labelled as a heuristic in the UI ("to calibrate"). */
export const QUARTER_ADJUSTMENT = 0.25;

export function computeSummary(
  s: AppStudent,
  profile: AthleticProfile | undefined,
  points: DevelopmentPoint[],
): TalentPlayerSummary {
  const latest = points[points.length - 1];
  const quarter = birthQuarter(s.date_of_birth);
  const current = r1(overall(latest));
  const lastMatch = [...points].reverse().find((p) => p.minutes_pct != null);
  return {
    student_id: s.student_id,
    first_name: s.first_name,
    last_name: s.last_name,
    birth_year: Number(s.date_of_birth.slice(0, 4)),
    birth_quarter: quarter,
    gender: s.gender ?? null,
    zip_code: s.address?.zip_code ?? null,
    primary_position: profile?.position ?? null,
    team: profile?.team_name ?? null,
    team_level: profile?.competitive_level ?? null,
    current_level: current,
    improvement_rate: improvementRate(points),
    age_adjusted_level: r1(Math.min(10, current + QUARTER_ADJUSTMENT * (quarter - 1))),
    minutes_pct: lastMatch?.minutes_pct ?? null,
    attendance_pct: lastMatch?.attendance_pct ?? null,
    latest_scores: {
      technical: latest.technical ?? 0,
      tactical: latest.tactical ?? 0,
      physical: latest.physical ?? 0,
      mentality: latest.mentality ?? 0,
    },
    last_measure_date: latest.date,
  };
}

/** Hidden gems: high improvement + strong technical/tactical + overlooked
 *  (low minutes or below-Academy team level). Reasons in plain words. */
export function computeHiddenGems(
  summaries: TalentPlayerSummary[],
  histories: Record<string, DevelopmentPoint[]>,
): HiddenGem[] {
  const gems: HiddenGem[] = [];
  for (const p of summaries) {
    const strongRatings = (p.latest_scores.technical + p.latest_scores.tactical) / 2;
    const overlooked = (p.minutes_pct ?? 100) <= 40 || p.team_level !== 'Academy';
    if (!(p.improvement_rate >= 0.25 && strongRatings >= 6 && overlooked)) continue;
    const reasons: HiddenGemReason[] = [];
    const hist = histories[p.student_id];
    if (hist && hist.length >= 2) {
      const first = hist[0], last = hist[hist.length - 1];
      const techGain = r1((last.technical ?? 0) - (first.technical ?? 0));
      const months = Math.max(1, Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / MONTH_MS));
      if (techGain > 0) reasons.push({ key: 'improved_dim', params: { dim: 'technical', points: techGain, months } });
    }
    reasons.push({ key: 'strong_ratings', params: { score: r1(strongRatings) } });
    if ((p.minutes_pct ?? 100) <= 40) reasons.push({ key: 'low_minutes', params: { pct: p.minutes_pct ?? 0 } });
    if (p.team_level !== 'Academy') reasons.push({ key: 'low_team_level', params: { level: p.team_level ?? '' } });
    gems.push({ ...p, reasons });
  }
  return gems.sort((a, b) => b.improvement_rate - a.improvement_rate);
}

/* ------------------------------ Tryouts -------------------------------- */

const EVALUATORS = ['Coach Ramírez (FCB)', 'Coach Delgado (FCB)', 'Coach Peña (FCB)'];

function evalScores(rand: () => number, around: number): [number, number, number, number] {
  const g = () => clamp(Math.round(around + (rand() - 0.5) * 1.6), 1, 5);
  return [g(), g(), g(), g()];
}

/** Six sample players attended the October academy tryout; sample-037's
 *  evaluators disagree (flag for a second look). All fictional. */
export function seedTryoutPlayers(students: AppStudent[]): TryoutPlayer[] {
  const ids = ['sample-008', 'sample-037', 'sample-105', 'sample-053', 'sample-021', 'sample-138'];
  return ids.map((id, idx) => {
    const s = students.find((x) => x.student_id === id)!;
    const rand = mulberry32(hashId(id) ^ 0x51e5);
    const evaluations = EVALUATORS.slice(0, idx % 2 === 0 ? 2 : 3).map((ev, j) => {
      let [technical, tactical, physical, mentality] = evalScores(rand, 3.2);
      if (id === 'sample-037' && j === 1) { technical = 1; tactical = 2; } // disagreement
      if (id === 'sample-037' && j === 0) { technical = 5; tactical = 4; }
      return {
        evaluation_id: `tev-sample-${id.slice(-3)}-${j + 1}`,
        tryout_player_id: `try-${id}`,
        evaluator_name: ev,
        technical, tactical, physical, mentality,
        notes: j === 0 ? 'Sample evaluation notes.' : null,
        created_at: `2026-10-0${4 + j}T17:00:00.000Z`,
      };
    });
    return {
      tryout_player_id: `try-${id}`,
      student_id: id,
      first_name: s.first_name,
      last_name: s.last_name,
      birth_year: Number(s.date_of_birth.slice(0, 4)),
      birth_quarter: birthQuarter(s.date_of_birth),
      tryout_date: '2026-10-04',
      evaluations,
      ...flagDisagreement(evaluations),
    };
  });
}

export function flagDisagreement(evals: TryoutPlayer['evaluations']) {
  const dims = ['technical', 'tactical', 'physical', 'mentality'] as const;
  const disagreement_dims = dims.filter((d) => {
    const vals = evals.map((e) => e[d]);
    return vals.length >= 2 && Math.max(...vals) - Math.min(...vals) >= 2;
  });
  return { needs_second_look: disagreement_dims.length > 0, disagreement_dims };
}

/* -------------------------- Position profiles -------------------------- */

export function seedPositionProfiles(): PositionProfile[] {
  const w = (attribute: PositionAttribute, weight: number) => ({ attribute, weight });
  return [
    {
      profile_id: 'pp-sample-001',
      position: 'Fullback',
      attributes: [w('speed', 5), w('tactical', 4), w('physical', 4), w('technical', 3), w('agility', 3), w('mentality', 3)],
      notes: 'Recovery speed, crossing, 1v1 defending (sample).',
      created_by: 'Coach Ramírez (FCB)',
      updated_at: '2026-09-20T12:00:00.000Z',
    },
    {
      profile_id: 'pp-sample-002',
      position: 'Striker',
      attributes: [w('technical', 5), w('speed', 4), w('tactical', 4), w('mentality', 4), w('physical', 3), w('strength', 3)],
      notes: 'Finishing, runs in behind, pressing (sample).',
      created_by: 'Coach Delgado (FCB)',
      updated_at: '2026-09-22T12:00:00.000Z',
    },
    {
      profile_id: 'pp-sample-003',
      position: 'Defensive Midfielder',
      attributes: [w('tactical', 5), w('endurance', 4), w('physical', 4), w('mentality', 4), w('technical', 3), w('strength', 3)],
      notes: 'Positioning, ball-winning, distribution (sample).',
      created_by: 'Coach Ramírez (FCB)',
      updated_at: '2026-09-25T12:00:00.000Z',
    },
  ];
}

/** Weighted 0–100 fit of a player against a position profile. */
export function computeFit(
  summary: TalentPlayerSummary,
  physical: PhysicalProfile | undefined,
  profile: PositionProfile,
): { fit_score: number; top_matches: PositionAttribute[] } {
  const value = (a: PositionAttribute): number => {
    if (a in summary.latest_scores) return summary.latest_scores[a as keyof typeof summary.latest_scores];
    return physical?.[a as keyof PhysicalProfile] ?? 5;
  };
  let num = 0, den = 0;
  const scored = profile.attributes.map(({ attribute, weight }) => {
    const v = value(attribute);
    num += v * weight; den += 10 * weight;
    return { attribute, contribution: v * weight };
  });
  scored.sort((a, b) => b.contribution - a.contribution);
  return {
    fit_score: den === 0 ? 0 : Math.round((num / den) * 100),
    top_matches: scored.slice(0, 3).map((x) => x.attribute),
  };
}
