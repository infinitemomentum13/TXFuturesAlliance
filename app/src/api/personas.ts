/**
 * Demo personas — six sample students chosen to show very different
 * situations in the demo switcher (Student role). Descriptions are in the
 * i18n dictionaries under "personas.*".
 *
 * Notes on fit vs. the requested archetypes (sample data is fixed):
 * - sample-127 Andrea: girl, health interests, open to Mexico/other
 *   countries. No sample student combines "open to Spain" with health
 *   interests, so Andrea is the closest match.
 * - sample-150 Josué: Matamoros-based player. The only bilingual Matamoros
 *   player in the sample is Isaac (already persona 1); Josué's language is
 *   listed as English in the data.
 */
export const DEMO_PERSONAS = [
  { student_id: 'sample-038', key: 'isaac' },
  { student_id: 'sample-121', key: 'damian' },
  { student_id: 'sample-127', key: 'andrea' },
  { student_id: 'sample-071', key: 'tomas' },
  { student_id: 'sample-150', key: 'josue' },
  { student_id: 'sample-140', key: 'mateo' },
] as const;

export type PersonaKey = (typeof DEMO_PERSONAS)[number]['key'];

export const DEMO_PERSONA_IDS = DEMO_PERSONAS.map((p) => p.student_id);

/** Default demo student when none is chosen: the first pathways persona. */
export const DEFAULT_STUDENT_ID = DEMO_PERSONAS[0].student_id;
