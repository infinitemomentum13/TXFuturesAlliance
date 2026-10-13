/**
 * Sample catalog data for the mock API: certificate careers, colleges,
 * global events (tryouts / class starts) and coach/counselor messages.
 *
 * EVERY record here is fictional, RGV-flavored, and marked is_sample
 * (rendered in the UI as "Sample data – to verify"). Pay figures, dates and
 * program details must be verified with local providers before launch.
 */
import type { College, Deadline, StudentMessage } from '../api/types';

const NOW = '2026-10-06T12:00:00.000Z';

/** Map: which Compass interests each career sector speaks to. */
export const CAREER_INTEREST_MAP: Record<string, string[]> = {
  hands_on: ['trades', 'manufacturing', 'transportation', 'logistics'],
  building: ['trades', 'manufacturing', 'energy'],
  tech: ['technology', 'manufacturing', 'aerospace'],
  health: ['healthcare'],
  helping_people: ['healthcare', 'education', 'public_service', 'sports'],
  business: ['business', 'technology', 'logistics'],
  outdoors: ['trades', 'agriculture', 'energy'],
  art: ['design', 'trades'],
  sports: ['sports', 'public_service', 'education'],
};

export { seedCareers, seedPartners, seedPostings, buildCareerPlanSteps } from './careers';

/** @deprecated Replaced by seedCollegesFull() in colleges.ts (Prompt 4). */
export function seedColleges(): College[] {
  const base = { is_sample: true as const };
  return [
    {
      ...base,
      college_id: 'col-sample-001',
      name: 'Sample Rio Grande Valley University',
      type: 'university',
      city: 'Edinburg / Brownsville',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: true,
      spanish_support: true,
      soccer_program: 'both',
      notes_en: 'Large public university in the Valley. Stay close to home.',
      notes_es: 'Universidad pública grande en el Valle. Quédate cerca de casa.',
    },
    {
      ...base,
      college_id: 'col-sample-002',
      name: 'Sample Border Community College',
      type: 'community_college',
      city: 'Brownsville',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: true,
      spanish_support: true,
      soccer_program: 'none',
      notes_en: 'Low-cost two-year degrees and certificates. Easy transfer path.',
      notes_es: 'Carreras de dos años y certificados de bajo costo. Fácil transferencia.',
    },
    {
      ...base,
      college_id: 'col-sample-003',
      name: 'Sample State University – Austin',
      type: 'university',
      city: 'Austin',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: false,
      spanish_support: false,
      soccer_program: 'both',
      notes_en: 'Flagship-style Texas public university.',
      notes_es: 'Universidad pública principal de Texas.',
    },
    {
      ...base,
      college_id: 'col-sample-004',
      name: 'Sample South Texas A&M',
      type: 'university',
      city: 'Kingsville',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: false,
      spanish_support: true,
      soccer_program: 'none',
      notes_en: 'Closest big public campus south of San Antonio.',
      notes_es: 'El campus público grande más cercano al sur de San Antonio.',
    },
    {
      ...base,
      college_id: 'col-sample-005',
      name: 'Sample Universidad del Noreste',
      type: 'university',
      city: 'Monterrey',
      state_or_region: 'Nuevo León',
      country: 'MX',
      in_rgv: false,
      spanish_support: true,
      soccer_program: 'both',
      notes_en: 'Private Mexican university a few hours from the border.',
      notes_es: 'Universidad privada mexicana a pocas horas de la frontera.',
    },
    {
      ...base,
      college_id: 'col-sample-006',
      name: 'Sample Universidad de Matamoros',
      type: 'university',
      city: 'Matamoros',
      state_or_region: 'Tamaulipas',
      country: 'MX',
      in_rgv: true,
      spanish_support: true,
      soccer_program: 'mens',
      notes_en: 'Right across the bridge — an option for cross-border families.',
      notes_es: 'Justo cruzando el puente — una opción para familias de la frontera.',
    },
    {
      ...base,
      college_id: 'col-sample-007',
      name: 'Sample Universidad de la Costa Norte',
      type: 'university',
      city: 'Santander',
      state_or_region: 'Cantabria',
      country: 'ES',
      in_rgv: false,
      spanish_support: true,
      soccer_program: 'both',
      notes_en: 'Public university in Santander — city of TXFA partner Racing Club (sample).',
      notes_es: 'Universidad pública en Santander — ciudad del club socio de TXFA (muestra).',
    },
    {
      ...base,
      college_id: 'col-sample-008',
      name: 'Sample Texas Technical College',
      type: 'technical_college',
      city: 'Harlingen',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: true,
      spanish_support: true,
      soccer_program: 'none',
      notes_en: 'Hands-on technical degrees tied to Valley employers.',
      notes_es: 'Carreras técnicas prácticas ligadas a empleadores del Valle.',
    },
  ];
}

/** Global events merged into the dashboard deadline feed. */
export function seedEvents(): Deadline[] {
  return [
    {
      deadline_id: 'evt-sample-001',
      kind: 'tryout',
      title_en: 'FC Brownsville academy tryouts (sample)',
      title_es: 'Visorías de la academia FC Brownsville (muestra)',
      date: '2026-11-14',
      ref_id: null,
    },
    {
      deadline_id: 'evt-sample-002',
      kind: 'tryout',
      title_en: 'College showcase – South Texas (sample)',
      title_es: 'Showcase universitario – Sur de Texas (muestra)',
      date: '2027-01-23',
      ref_id: null,
    },
    {
      deadline_id: 'evt-sample-003',
      kind: 'class_start',
      title_en: 'Spring certificate classes begin (sample)',
      title_es: 'Empiezan las clases de certificado de primavera (muestra)',
      date: '2027-01-11',
      ref_id: null,
    },
    {
      deadline_id: 'evt-sample-004',
      kind: 'class_start',
      title_en: 'Summer certificate classes begin (sample)',
      title_es: 'Empiezan las clases de certificado de verano (muestra)',
      date: '2027-06-07',
      ref_id: null,
    },
  ];
}

/** Welcome messages from coach/counselor, seeded for the six demo personas. */
export function seedMessages(personaIds: string[]): StudentMessage[] {
  const msgs: StudentMessage[] = [];
  const templates: Array<[string, 'coach' | 'counselor', string, string, string]> = [
    [
      'Coach Ramírez (sample)',
      'coach',
      'Good work this week. Keep your grades steady and come talk to me about the college showcase in January.',
      'Buen trabajo esta semana. Mantén tus calificaciones estables y ven a hablar conmigo sobre el showcase universitario de enero.',
      '2026-10-02T15:30:00.000Z',
    ],
    [
      'Ms. Delgado, Counselor (sample)',
      'counselor',
      'I saw your Pathway Compass results — great start. Let us pick one certificate program to visit this month.',
      'Vi los resultados de tu Pathway Compass — buen comienzo. Escojamos un programa de certificado para visitar este mes.',
      '2026-10-04T09:15:00.000Z',
    ],
  ];
  personaIds.forEach((sid, i) => {
    const [name, role, en, es, sent] = templates[i % templates.length];
    msgs.push({
      message_id: `msg-${sid}-1`,
      student_id: sid,
      from_name: name,
      from_role: role,
      body_en: en,
      body_es: es,
      sent_at: sent,
      read_at: null,
    });
  });
  return msgs;
}

/**
 * Default "My Plan" actions generated from a student's Compass answers when
 * they have none yet. Keeps the demo realistic without hand-seeding 182 rows.
 */
export function defaultPlanActions(
  studentId: string,
  compass: { completed: boolean; income_urgency?: string | null; interests?: string[] } | undefined,
  hasAthletic: boolean,
): Array<Omit<import('../api/types').PlanAction, 'action_id' | 'created_at'>> {
  const actions: Array<Omit<import('../api/types').PlanAction, 'action_id' | 'created_at'>> = [];
  const urgent = compass?.income_urgency === 'right_away' || compass?.income_urgency === 'within_a_year';
  if (!compass?.completed) {
    actions.push({
      student_id: studentId,
      pathway: 'college',
      title_en: 'Finish your Pathway Compass (about 3 minutes)',
      title_es: 'Termina tu Pathway Compass (unos 3 minutos)',
      due_date: '2026-10-20',
      status: 'todo',
      origin: 'system',
    });
    return actions;
  }
  actions.push({
    student_id: studentId,
    pathway: 'career',
    title_en: urgent
      ? 'Visit one certificate program near you'
      : 'Look at two certificate careers and save your favorite',
    title_es: urgent
      ? 'Visita un programa de certificado cerca de ti'
      : 'Mira dos carreras de certificado y guarda tu favorita',
    due_date: '2026-10-31',
    status: 'todo',
    origin: 'system',
  });
  actions.push({
    student_id: studentId,
    pathway: 'college',
    title_en: 'Turn on grade sharing so scholarship matching can start',
    title_es: 'Activa compartir calificaciones para empezar a buscar becas',
    due_date: '2026-11-07',
    status: 'todo',
    origin: 'system',
  });
  if (hasAthletic) {
    actions.push({
      student_id: studentId,
      pathway: 'sports',
      title_en: 'Ask your coach to review your sports profile',
      title_es: 'Pide a tu entrenador que revise tu perfil deportivo',
      due_date: '2026-11-14',
      status: 'todo',
      origin: 'coach',
    });
  }
  return actions;
}

export const CATALOG_NOW = NOW;
