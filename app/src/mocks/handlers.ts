/**
 * MSW handlers — the stand-in server.
 *
 * Implements EVERY path and method in the three attached OpenAPI specs
 * (student, scholarship, video services) with the same status codes, field
 * names and { data, meta } pagination style, plus the new endpoints defined
 * in openapi_additions.yaml (consents, Racing 360 reports, careers…).
 *
 * Role rules are enforced here too: a Partner requesting a student who has
 * not consented gets a 403, not just a hidden button.
 */
import { http, HttpResponse, delay, type HttpHandler } from 'msw';
import { ensureMatches, getDb, matchContextFor, mockUuid, resetDb } from './db';
import { CAREER_INTEREST_MAP, defaultPlanActions } from './catalog';
import { buildCareerPlanSteps } from './careers';
import {
  computeFit,
  computeHiddenGems,
  computeSummary,
  flagDisagreement,
} from './talent';
import { DEFAULT_STUDENT_ID } from '../api/personas';
import type {
  AppStudent,
  ApprovalItem,
  CareerPlan,
  CaseloadItem,
  ConsentKey,
  ConsentRecord,
  ContactRequest,
  CounselorRequest,
  Deadline,
  DemoRole,
  InternshipApplication,
  InternshipPosting,
  LoginResponse,
  OutcomesReport,
  PathwayCompass,
  PerformancePoint,
  PlanAction,
  Racing360Report,
  RecruitingProfile,
  SavedCareer,
  SavedCollege,
  ScholarshipApplication,
  ScholarshipMatch,
  ScoutResult,
  FairnessReport,
  HiddenGem,
  PositionFit,
  PositionProfile,
  StaffNote,
  StudentDocument,
  TalentPlayerSummary,
  TestScore,
  TryoutEvaluation,
} from '../api/types';

const BASE = '*/api/v1';
const LATENCY_MS = 300;
const FORCE_ERRORS_KEY = 'txfa.forceErrors';

/* ------------------------------ helpers --------------------------------- */

interface TokenPayload {
  user_id: string;
  email: string;
  role: DemoRole;
  student_id?: string;
  display_name?: string;
  child_ids?: string[];
}

function makeToken(p: TokenPayload): string {
  return `demo.${btoa(JSON.stringify(p))}`;
}

function parseToken(req: Request): TokenPayload | null {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token.startsWith('demo.')) return null;
  try {
    return JSON.parse(atob(token.slice(5))) as TokenPayload;
  } catch {
    return null;
  }
}

function err(status: number, error: string, message: string, details?: object) {
  return HttpResponse.json({ error, message, ...(details ? { details } : {}) }, { status });
}

const unauthorized = () => err(401, 'UNAUTHORIZED', 'Authentication required.');
const forbidden = () => err(403, 'FORBIDDEN', 'You do not have permission to access this resource.');
const notFound = (what: string) => err(404, 'NOT_FOUND', `${what} not found.`);

function forceErrorOn(): boolean {
  try {
    return localStorage.getItem(FORCE_ERRORS_KEY) === '1';
  } catch {
    return false;
  }
}

async function guard(req: Request): Promise<Response | null> {
  await delay(LATENCY_MS);
  if (forceErrorOn()) {
    return err(500, 'MOCK_FORCED_ERROR', 'Simulated server error (dev toggle is on).');
  }
  if (!parseToken(req)) return unauthorized();
  return null;
}

function paginate<T>(items: T[], url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size') ?? 20)));
  const start = (page - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    meta: {
      page,
      page_size: pageSize,
      total_items: items.length,
      total_pages: Math.max(1, Math.ceil(items.length / pageSize)),
    },
  };
}

/* ------------------------- access control rules ------------------------- */

function canViewStudent(me: TokenPayload, student: AppStudent): boolean {
  switch (me.role) {
    case 'admin':
    case 'coach':
    case 'club_staff':
      return true;
    case 'student':
      return me.student_id === student.student_id;
    case 'parent':
      return (me.child_ids ?? []).includes(student.student_id);
    case 'partner': {
      // Partners only see students who opted in, and never sensitive fields.
      const c = getDb().consents.find((x) => x.student_id === student.student_id);
      return !!(
        c &&
        (c.consents.sports_to_colleges.granted ||
          c.consents.sports_to_pro_clubs.granted ||
          c.consents.partner_contact.granted)
      );
    }
    default:
      return false;
  }
}

/** Strip fields partners/scouts must never see. */
function partnerView(s: AppStudent): Partial<AppStudent> {
  return {
    student_id: s.student_id,
    first_name: s.first_name,
    last_name: s.last_name,
    date_of_birth: s.date_of_birth,
    gender: s.gender,
    current_grade_level: s.current_grade_level,
    expected_graduation_year: s.expected_graduation_year,
    enrollment_status: s.enrollment_status,
    app_mode: s.app_mode,
    is_sample: true,
  };
}

/** Assemble the recruiting profile; academic snapshot only with consent. */
function buildRecruitingProfile(s: AppStudent): RecruitingProfile {
  const db = getDb();
  const aps = db.athleticProfiles.filter((a) => a.student_id === s.student_id && a.active_status);
  const main = aps[0];
  const c = getConsents(s.student_id);
  // Academic snapshot appears on the recruiting front page ONLY when the
  // student consented to grades sharing — even in the student's own view,
  // so the consent state is always visible to them.
  const gradesOk = c.consents.grades_for_matching.granted;
  const latestAcad = db.academicRecords.filter((r) => r.student_id === s.student_id).slice(-1)[0];
  const positions = [main?.position, ...(main?.secondary_positions?.split(',').map((p) => p.trim()) ?? [])]
    .filter(Boolean) as string[];
  return {
    student_id: s.student_id,
    sport: main?.sport ?? 'Soccer',
    positions,
    dominant_foot: main?.dominant_foot ?? null,
    dominant_hand: main?.dominant_hand ?? null,
    height_inches: main?.height_inches ?? null,
    weight_pounds: main?.weight_pounds ?? null,
    teams: aps.map((a) => ({
      team_name: a.team_name ?? '',
      competitive_level: a.competitive_level ?? null,
      years_experience: a.years_experience ?? null,
    })),
    grad_year: s.expected_graduation_year ?? null,
    skill_level: main?.skill_level ?? null,
    academic_snapshot:
      gradesOk && latestAcad?.gpa_cumulative != null
        ? {
            gpa_cumulative: latestAcad.gpa_cumulative,
            school_year: latestAcad.school_year ?? '',
            source: latestAcad.source_system ?? 'self',
          }
        : null,
    achievements: db.achievements.filter((a) => a.student_id === s.student_id),
    endorsements: db.endorsements.filter((e) => e.student_id === s.student_id),
    video_count: db.videos.filter((v) => v.student_id === s.student_id).length,
    highlight_count: db.highlights.filter((h) => h.student_id === s.student_id).length,
    is_sample: true,
  };
}

/** What a scout sees — first name + last initial, no contact info, ever. */
function buildScoutResult(s: AppStudent): ScoutResult {
  const db = getDb();
  const main = db.athleticProfiles.find((a) => a.student_id === s.student_id && a.active_status);
  const positions = [main?.position, ...(main?.secondary_positions?.split(',').map((p) => p.trim()) ?? [])]
    .filter(Boolean) as string[];
  const age = s.age ?? null;
  return {
    student_id: s.student_id,
    display_name: `${s.first_name} ${(s.last_name ?? '').slice(0, 1)}.`,
    age,
    grad_year: s.expected_graduation_year ?? null,
    gender: s.gender ?? null,
    sport: main?.sport ?? 'Soccer',
    positions,
    competitive_level: main?.competitive_level ?? null,
    team_name: main?.team_name ?? null,
    height_inches: main?.height_inches ?? null,
    overall_rating: main?.overall_rating ?? null,
    open_to: s.pathway_compass?.open_to ?? [],
    under_18: age !== null && age < 18,
    is_sample: true,
  };
}

/* ------------------------- Prompt 6 helpers ----------------------------- */

const NOW_MS = new Date('2026-10-07T12:00:00.000Z').getTime();

/** Caseload aggregation — pathway status, next deadline, missing items,
 *  needs-attention flags. All flags/missing items are i18n keys. */
function buildCaseload(): CaseloadItem[] {
  const db = getDb();
  const out: CaseloadItem[] = [];
  for (const s of db.students) {
    if (s.app_mode !== 'pathways') continue;

    const careerPlans = db.careerPlans.filter((p) => p.student_id === s.student_id);
    const careerApps = db.internshipApplications.filter((a) => a.student_id === s.student_id);
    const savedCareers = db.savedCareers.filter((x) => x.student_id === s.student_id);
    const savedColleges = db.savedColleges.filter((x) => x.student_id === s.student_id);
    const scholApps = db.scholarshipApplications.filter((a) => a.student_id === s.student_id);
    const outcomes = db.scholarshipOutcomes.filter((o) => o.student_id === s.student_id);
    const athletic = db.athleticProfiles.filter((a) => a.student_id === s.student_id && a.active_status);
    const videos = db.videos.filter((v) => v.student_id === s.student_id);
    const contactReqs = db.contactRequests.filter((r) => r.student_id === s.student_id);
    const consents = db.consents.find((c) => c.student_id === s.student_id);
    const compass = s.pathway_compass;
    const records = db.academicRecords.filter((r) => r.student_id === s.student_id);

    // Next deadline: plan actions with due dates + global events.
    const upcoming: Array<{ title_en: string; title_es: string; date: string; kind: string }> = [];
    db.planActions
      .filter((a) => a.student_id === s.student_id && a.status === 'todo' && a.due_date)
      .forEach((a) =>
        upcoming.push({ title_en: a.title_en, title_es: a.title_es, date: a.due_date!, kind: 'task' }),
      );
    db.events.forEach((e) => upcoming.push({ title_en: e.title_en, title_es: e.title_es, date: e.date, kind: e.kind }));
    const future = upcoming
      .filter((d) => new Date(`${d.date}T23:59:59Z`).getTime() >= NOW_MS)
      .sort((a, b) => a.date.localeCompare(b.date));
    const missedCount = upcoming.filter(
      (d) => new Date(`${d.date}T23:59:59Z`).getTime() < NOW_MS && d.kind === 'task',
    ).length;

    const missing: string[] = [];
    if (!compass?.completed) missing.push('compass');
    if (records.length === 0) missing.push('grades');
    if (athletic.length > 0 && videos.length === 0) missing.push('video');
    if (!db.stories.find((st) => st.student_id === s.student_id && st.text.trim())) missing.push('story');
    if (records.length > 0 && !db.testScores.some((ts) => ts.student_id === s.student_id)) missing.push('sat');

    const flags: string[] = [];
    if (missedCount > 0) flags.push('missed_deadline');
    if (records.length >= 2) {
      const last = records[records.length - 1].gpa_cumulative ?? null;
      const prev = records[records.length - 2].gpa_cumulative ?? null;
      if (last !== null && prev !== null && last < prev - 0.2) flags.push('grades_dropped');
    }
    if (consents && Object.values(consents.consents).every((c) => !c.granted)) flags.push('consent_pending');

    out.push({
      student_id: s.student_id,
      first_name: s.first_name,
      last_name: s.last_name,
      grade_level: s.current_grade_level ?? null,
      school_name: s.school_name ?? null,
      app_mode: 'pathways',
      pathway_status: {
        career: { saved: savedCareers.length, plans: careerPlans.length, applications: careerApps.length },
        college: {
          saved: savedColleges.length,
          applications: scholApps.length,
          awarded: outcomes.filter((o) => o.awarded).length,
        },
        sports: {
          has_profile: athletic.length > 0,
          videos: videos.length,
          contact_requests: contactReqs.length,
        },
      },
      next_deadline: future[0] ?? null,
      missing_items: missing,
      needs_attention: flags,
    });
  }
  return out.sort((a, b) => a.last_name.localeCompare(b.last_name));
}

/** Parent approvals inbox — union read model. */
function buildApprovals(s: AppStudent): ApprovalItem[] {
  const db = getDb();
  const items: ApprovalItem[] = [];
  const CONSENT_TEXT: Record<ConsentKey, [string, string, string, string]> = {
    grades_for_matching: [
      'Share grades for scholarship matching',
      'Compartir calificaciones para buscar becas',
      'Lets the app match scholarships using verified grades.',
      'Permite que la app busque becas con calificaciones verificadas.',
    ],
    sports_to_colleges: [
      'Share sports profile with college coaches',
      'Compartir perfil deportivo con entrenadores universitarios',
      'College programs can find the recruiting profile.',
      'Los programas universitarios pueden encontrar el perfil de reclutamiento.',
    ],
    sports_to_pro_clubs: [
      'Share sports profile with pro club scouts',
      'Compartir perfil deportivo con visores de clubes profesionales',
      'Pro club scouts can find the recruiting profile.',
      'Los visores de clubes profesionales pueden encontrar el perfil de reclutamiento.',
    ],
    videos: [
      'Share highlight videos',
      'Compartir videos de highlights',
      'Shared videos become visible to approved viewers.',
      'Los videos compartidos serán visibles para espectadores aprobados.',
    ],
    partner_contact: [
      'Allow contact from corporate partners',
      'Permitir contacto de empresas aliadas',
      'Employers and training schools can request contact.',
      'Empleadores y escuelas de formación pueden solicitar contacto.',
    ],
    club_player_development: [
      'Use player data for club player development',
      'Usar datos del jugador para desarrollo de jugadores del club',
      'FC Brownsville coaches can track development over time. Never visible to scouts, partners or the public.',
      'Los entrenadores de FC Brownsville pueden seguir el desarrollo con el tiempo. Nunca visible para visores, aliados ni el público.',
    ],
  };
  const consents = db.consents.find((c) => c.student_id === s.student_id);
  if (consents) {
    (Object.keys(CONSENT_TEXT) as ConsentKey[]).forEach((key) => {
      const st = consents.consents[key];
      const [te, ts, de, ds] = CONSENT_TEXT[key];
      items.push({
        item_id: `consent-${key}`,
        kind: 'consent',
        ref_id: key,
        title_en: te,
        title_es: ts,
        detail_en: de,
        detail_es: ds,
        status: st.granted ? 'granted' : 'pending',
        created_at: consents.updated_at,
      });
    });
  }
  db.contactRequests
    .filter((r) => r.student_id === s.student_id)
    .forEach((r) =>
      items.push({
        item_id: r.request_id,
        kind: 'contact_request',
        ref_id: r.request_id,
        title_en: `Contact request — ${r.requester_org}`,
        title_es: `Solicitud de contacto — ${r.requester_org}`,
        detail_en: r.message,
        detail_es: r.message,
        status:
          r.status === 'approved'
            ? 'approved'
            : r.status === 'declined'
              ? 'declined'
              : 'pending',
        created_at: r.created_at,
      }),
    );
  db.signatureDocs
    .filter((d) => d.student_id === s.student_id)
    .forEach((d) =>
      items.push({
        item_id: d.doc_id,
        kind: 'signature',
        ref_id: d.doc_id,
        title_en: d.title_en,
        title_es: d.title_es,
        detail_en: 'Needs a parent or guardian signature.',
        detail_es: 'Necesita la firma de un padre, madre o tutor.',
        status: d.status === 'signed' ? 'signed' : 'pending',
        created_at: d.signed_at ?? '2026-09-01T12:00:00.000Z',
      }),
    );
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Aggregate outcomes — computed from mock records, never names. */
function buildOutcomes(f: { school: string | null; grade: string | null; year: string | null }): OutcomesReport {
  const db = getDb();
  const inScope = (sid: string) => {
    const s = db.students.find((x) => x.student_id === sid);
    if (!s) return false;
    if (f.school && s.school_name !== f.school) return false;
    if (f.grade && s.current_grade_level !== Number(f.grade)) return false;
    return true;
  };
  const scopeIds = new Set(db.students.filter((s) => inScope(s.student_id)).map((s) => s.student_id));
  const year = f.year ? Number(f.year) : null;
  const inYear = (date: string | null | undefined) =>
    !year || (date ?? '').slice(0, 4) === String(year);

  const careerStudents = new Set(
    [...db.savedCareers, ...db.careerPlans, ...db.internshipApplications]
      .filter((x) => scopeIds.has(x.student_id))
      .map((x) => x.student_id),
  );
  const collegeStudents = new Set(
    [...db.savedColleges, ...db.scholarshipApplications, ...db.enrollments]
      .filter((x) => scopeIds.has(x.student_id))
      .map((x) => x.student_id),
  );
  const sportsStudents = new Set(
    db.athleticProfiles.filter((a) => scopeIds.has(a.student_id)).map((a) => a.student_id),
  );

  const apps = db.scholarshipApplications.filter((a) => scopeIds.has(a.student_id) && inYear(a.started_at));
  const outcomes = db.scholarshipOutcomes.filter((o) => scopeIds.has(o.student_id) && inYear(o.decision_date));
  const awarded = outcomes.filter((o) => o.awarded);
  const dollars = awarded.reduce((sum, o) => sum + (o.award_amount ?? 0), 0);

  const placements = db.placements.filter((p) => scopeIds.has(p.student_id) && inYear(p.start_date));
  const completed = placements.filter((p) => p.completion_status !== 'active');
  const weeksToJob = completed.length
    ? completed.reduce((sum, p) => {
        const enrollment = db.students.find((x) => x.student_id === p.student_id)?.enrollment_date;
        const start = enrollment ? new Date(enrollment).getTime() : NOW_MS;
        return sum + (new Date(p.start_date).getTime() - start) / (7 * 24 * 3600 * 1000);
      }, 0) / completed.length
    : null;

  const byPartner = db.partners.map((p) => {
    const rows = placements.filter((x) => x.partner_id === p.partner_id);
    return {
      partner_id: p.partner_id,
      partner_name: p.company_name,
      placements: rows.length,
      completed: rows.filter((x) => x.completion_status === 'completed').length,
      converted_to_full_time: rows.filter((x) => x.accepted_full_time).length,
    };
  });

  return {
    filters: { school: f.school, grade: f.grade ? Number(f.grade) : null, year },
    students_served: scopeIds.size,
    by_pathway: {
      career: careerStudents.size,
      college: collegeStudents.size,
      sports: sportsStudents.size,
    },
    certificates_earned: db.documents.filter(
      (d) => d.kind === 'certificate' && scopeIds.has(d.student_id) && inYear(d.uploaded_at),
    ).length,
    avg_weeks_to_first_job: weeksToJob !== null ? Math.round(weeksToJob * 10) / 10 : null,
    scholarships: { applied: apps.length, awarded: awarded.length, dollars },
    college_enrollments: db.enrollments.filter(
      (e) => scopeIds.has(e.student_id) && (!year || e.enrollment_year === year),
    ).length,
    athletes_recruited: db.contactRequests.filter(
      (r) => r.status === 'approved' && scopeIds.has(r.student_id) && inYear(r.created_at),
    ).length,
    placements_by_partner: byPartner.filter((p) => p.placements > 0),
    generated_at: new Date().toISOString(),
  };
}

/** Content CMS upsert — careers / colleges / scholarships / opportunities.
 *  Every write stamps verified_on/verified_by. */
function upsertContent(
  collection: string,
  input: Record<string, unknown>,
  me: TokenPayload,
  recordId: string | null,
): Response {
  const db = getDb();
  const stamp = { verified_on: new Date().toISOString().slice(0, 10), verified_by: me.display_name ?? 'Admin (demo)' };

  const collections = {
    careers: { rows: db.careers, key: 'career_id', prefix: 'car' },
    colleges: { rows: db.colleges, key: 'college_id', prefix: 'col' },
    scholarships: { rows: db.scholarships, key: 'scholarship_id', prefix: 'sch' },
    opportunities: { rows: db.opportunities, key: 'opportunity_id', prefix: 'opp' },
  } as const;
  const col = collections[collection as keyof typeof collections];
  if (!col) return notFound('Collection');

  if (recordId) {
    const row = col.rows.find(
      (r) => String((r as unknown as Record<string, unknown>)[col.key]) === recordId,
    ) as unknown as Record<string, unknown> | undefined;
    if (!row) return notFound('Record');
    Object.assign(row, input, stamp);
    (row as Record<string, unknown>)[col.key] = recordId;
    return HttpResponse.json(row);
  }

  // Create with minimal required fields per collection.
  const id = mockUuid(col.prefix);
  const nameField =
    collection === 'careers' ? 'title_en' : collection === 'opportunities' ? 'title_en' : 'name';
  if (!input[nameField]) return err(400, 'INVALID_INPUT', `${nameField} is required.`);
  const base: Record<string, unknown> = { [col.key]: id, ...input, ...stamp, is_sample: true };
  if (collection === 'careers') {
    Object.assign(base, {
      title_es: input.title_es ?? input.title_en,
      summary_en: input.summary_en ?? '',
      summary_es: input.summary_es ?? input.summary_en ?? '',
      credential: input.credential ?? 'Certificate',
      credential_issuer: input.credential_issuer ?? 'TBD',
      training_length_weeks: input.training_length_weeks ?? 12,
      training_cost_usd: input.training_cost_usd ?? 0,
      funding_options: input.funding_options ?? [],
      min_age_train: input.min_age_train ?? 16,
      min_age_work: input.min_age_work ?? 18,
      time_to_first_paycheck_weeks: input.time_to_first_paycheck_weeks ?? 12,
      pay_rgv_start_usd_hr: input.pay_rgv_start_usd_hr ?? 15,
      pay_tx_start_usd_hr: input.pay_tx_start_usd_hr ?? 17,
      ladder: input.ladder ?? [],
      rgv_sectors: input.rgv_sectors ?? [],
      training_providers: input.training_providers ?? [],
      employer_partner_ids: input.employer_partner_ids ?? [],
      sport_friendly: input.sport_friendly ?? false,
    });
    db.careers.push(base as never);
  } else if (collection === 'colleges') {
    Object.assign(base, {
      type: input.type ?? 'university',
      city: input.city ?? '',
      state_or_region: input.state_or_region ?? '',
      country: input.country ?? 'US',
      in_rgv: input.in_rgv ?? false,
      spanish_support: input.spanish_support ?? false,
      soccer_program: input.soccer_program ?? 'none',
    });
    db.colleges.push(base as never);
  } else if (collection === 'scholarships') {
    Object.assign(base, {
      organization: input.organization ?? 'TBD',
      award_type: input.award_type ?? 'One-time',
      active_status: input.active_status ?? true,
      categories: input.categories ?? [],
    });
    db.scholarships.push(base as never);
  } else {
    Object.assign(base, {
      lane: input.lane ?? 'college',
      sport: input.sport ?? 'Soccer',
      title_es: input.title_es ?? input.title_en,
      org_name: input.org_name ?? 'TBD',
      level_en: input.level_en ?? '',
      level_es: input.level_es ?? input.level_en ?? '',
      age_min: input.age_min ?? 14,
      age_max: input.age_max ?? 18,
      location_en: input.location_en ?? '',
      location_es: input.location_es ?? input.location_en ?? '',
      country: input.country ?? 'US',
      dates_en: input.dates_en ?? 'TBD',
      dates_es: input.dates_es ?? input.dates_en ?? 'TBD',
      cost_usd: input.cost_usd ?? 0,
      requirements_en: input.requirements_en ?? [],
      requirements_es: input.requirements_es ?? [],
    });
    db.opportunities.push(base as never);
  }
  return HttpResponse.json(base, { status: 201 });
}

async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

function findStudent(id: string) {
  return getDb().students.find((s) => s.student_id === id);
}

function getConsents(studentId: string): ConsentRecord {
  const db = getDb();
  let rec = db.consents.find((c) => c.student_id === studentId);
  if (!rec) {
    const blank = (key: ConsentKey) => ({ key, granted: false, granted_at: null, granted_by_role: null });
    rec = {
      student_id: studentId,
      consents: {
        grades_for_matching: blank('grades_for_matching'),
        sports_to_colleges: blank('sports_to_colleges'),
        sports_to_pro_clubs: blank('sports_to_pro_clubs'),
        videos: blank('videos'),
        partner_contact: blank('partner_contact'),
        club_player_development: blank('club_player_development'),
      },
      access_log: [],
      updated_at: new Date().toISOString(),
    };
    db.consents.push(rec);
  }
  return rec;
}

/* ------------------------------ handlers -------------------------------- */

export const handlers: HttpHandler[] = [
  /* ====================== AUTH (student service spec) ==================== */
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    await delay(LATENCY_MS);
    const { email, password, role, student_id } = await body<{
      email?: string;
      password?: string;
      role?: DemoRole;
      student_id?: string;
    }>(request);
    if (!email || !password) {
      return err(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    // Demo behavior: role is carried in the request by the auth adapter;
    // the mock issues a token that carries that role.
    const db = getDb();
    const sid =
      student_id ??
      (role === 'student' || !role
        ? (db.students.find((s) => s.student_id === DEFAULT_STUDENT_ID) ??
           db.students.find((s) => s.app_mode === 'pathways'))?.student_id
        : undefined);
    const payload: TokenPayload = {
      user_id: mockUuid('user'),
      email,
      role: role ?? 'student',
      student_id: sid,
      display_name: email.split('@')[0],
      child_ids:
        role === 'parent'
          ? db.students.filter((s) => s.app_mode === 'explorer').slice(0, 2).map((s) => s.student_id)
          : undefined,
    };
    const res: LoginResponse = {
      access_token: makeToken(payload),
      token_type: 'Bearer',
      expires_in: 3600,
      user: {
        user_id: payload.user_id,
        email: payload.email,
        role: payload.role,
        student_id: payload.student_id,
      },
    };
    return HttpResponse.json(res, { status: 200 });
  }),

  /* ===================== ADMIN (additions spec) ========================= */
  http.post(`${BASE}/admin/reset-demo-data`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (me.role !== 'admin') return forbidden();
    resetDb();
    return HttpResponse.json({ ok: true, reset_at: new Date().toISOString() });
  }),

  /* ======================= STUDENTS (student spec) ====================== */
  http.get(`${BASE}/students`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const url = new URL(request.url);
    const db = getDb();

    if (me.role === 'student' || me.role === 'parent') return forbidden();

    let list = db.students.filter((s) => s.enrollment_status !== undefined);
    const status = url.searchParams.get('enrollment_status');
    const grade = url.searchParams.get('grade_level');
    const search = url.searchParams.get('search')?.toLowerCase();
    if (status) list = list.filter((s) => s.enrollment_status === status);
    if (grade) list = list.filter((s) => s.current_grade_level === Number(grade));
    if (search) {
      list = list.filter((s) =>
        `${s.first_name} ${s.last_name} ${s.email ?? ''}`.toLowerCase().includes(search),
      );
    }
    if (me.role === 'partner') {
      const visible = list.filter((s) => canViewStudent(me, s)).map(partnerView);
      return HttpResponse.json(paginate(visible, url));
    }
    return HttpResponse.json(paginate(list, url));
  }),

  http.post(`${BASE}/students`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (!['admin', 'coach', 'club_staff', 'parent'].includes(me.role)) return forbidden();
    const input = await body<Partial<AppStudent> & { guardian_email?: string }>(request);
    if (!input.first_name || !input.last_name || !input.date_of_birth || !input.guardian_email) {
      return err(400, 'INVALID_INPUT', 'first_name, last_name, date_of_birth and guardian_email are required.');
    }
    const db = getDb();
    if (input.email && db.students.some((s) => s.email === input.email)) {
      return err(409, 'STUDENT_EXISTS', 'A student with this email already exists.');
    }
    const dob = new Date(input.date_of_birth);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
    const student: AppStudent = {
      student_id: mockUuid('student'),
      first_name: input.first_name,
      last_name: input.last_name,
      middle_name: input.middle_name ?? null,
      preferred_name: input.preferred_name ?? null,
      date_of_birth: input.date_of_birth,
      gender: input.gender ?? null,
      ethnicity: input.ethnicity ?? null,
      primary_language: input.primary_language ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      enrollment_status: 'active',
      enrollment_date: input.enrollment_date ?? new Date().toISOString().slice(0, 10),
      current_grade_level: input.current_grade_level ?? null,
      app_mode: age < 13 ? 'explorer' : 'pathways',
      is_sample: false,
      age,
      pathway_compass: { completed: false },
      data_consent: {
        ferpa_consent: false,
        gdpr_consent: false,
        data_sharing: { scouts: false, colleges: false, corporate: false },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.students.push(student);
    getConsents(student.student_id); // create blank consent record
    return HttpResponse.json(student, { status: 201 });
  }),

  http.get(`${BASE}/students/:studentId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s)) return forbidden();
    return HttpResponse.json(me.role === 'partner' ? partnerView(s) : s);
  }),

  http.put(`${BASE}/students/:studentId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const input = await body<Partial<AppStudent>>(request);
    Object.assign(s, input, { student_id: s.student_id, updated_at: new Date().toISOString() });
    return HttpResponse.json(s);
  }),

  http.delete(`${BASE}/students/:studentId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (me.role !== 'admin') return forbidden();
    const db = getDb();
    const idx = db.students.findIndex((s) => s.student_id === params.studentId);
    if (idx === -1) return notFound('Student');
    db.students.splice(idx, 1); // soft-delete in the real back end
    return new HttpResponse(null, { status: 204 });
  }),

  /* =================== ACADEMIC RECORDS (student spec) ================== */
  http.get(`${BASE}/students/:studentId/academic-records`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const url = new URL(request.url);
    let rows = getDb().academicRecords.filter((r) => r.student_id === s.student_id);
    const year = url.searchParams.get('school_year');
    const sem = url.searchParams.get('semester');
    if (year) rows = rows.filter((r) => r.school_year === year);
    if (sem) rows = rows.filter((r) => r.semester === sem);
    const latest = rows[rows.length - 1];
    return HttpResponse.json({
      data: rows,
      summary: {
        current_gpa: latest?.gpa_cumulative ?? null,
        total_credits: rows.reduce((n, r) => n + (r.credit_hours ?? 0), 0),
        attendance_rate: latest?.attendance_rate ?? null,
      },
    });
  }),

  http.post(`${BASE}/students/:studentId/academic-records`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!['admin', 'coach', 'club_staff'].includes(me.role) && me.student_id !== s.student_id) {
      return forbidden();
    }
    const input = await body<Partial<AcademicRecordInput>>(request);
    if (!input.school_year || !input.semester || !input.course_name) {
      return err(400, 'INVALID_INPUT', 'school_year, semester and course_name are required.');
    }
    const rec = {
      record_id: mockUuid('rec'),
      student_id: s.student_id,
      source_system: 'Manual',
      grade_source: 'self_reported',
      ...input,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    getDb().academicRecords.push(rec as never);
    return HttpResponse.json(rec, { status: 201 });
  }),

  /* =================== ATHLETIC PROFILES (student spec) ================= */
  http.get(`${BASE}/students/:studentId/athletic-profiles`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s)) return forbidden();
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('active_only') !== 'false';
    let rows = getDb().athleticProfiles.filter((p) => p.student_id === s.student_id);
    if (activeOnly) rows = rows.filter((p) => p.active_status !== false);
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/athletic-profiles`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!['admin', 'coach', 'club_staff'].includes(me.role)) return forbidden();
    const input = await body<Record<string, unknown>>(request);
    if (!input.sport || !input.start_date) {
      return err(400, 'INVALID_INPUT', 'sport and start_date are required.');
    }
    const profile = {
      profile_id: mockUuid('ath'),
      student_id: s.student_id,
      active_status: true,
      ...input,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    getDb().athleticProfiles.push(profile as never);
    return HttpResponse.json(profile, { status: 201 });
  }),

  http.put(
    `${BASE}/students/:studentId/athletic-profiles/:profileId`,
    async ({ request, params }) => {
      const g = await guard(request);
      if (g) return g;
      const me = parseToken(request)!;
      if (!['admin', 'coach', 'club_staff'].includes(me.role)) return forbidden();
      const p = getDb().athleticProfiles.find(
        (x) => x.profile_id === params.profileId && x.student_id === params.studentId,
      );
      if (!p) return notFound('Athletic profile');
      const input = await body<Record<string, unknown>>(request);
      Object.assign(p, input, { profile_id: p.profile_id, updated_at: new Date().toISOString() });
      return HttpResponse.json(p);
    },
  ),

  /* ===================== SCHOLARSHIPS (scholarship spec) ================ */
  http.get(`${BASE}/scholarships`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (me.role === 'partner') return forbidden();
    const url = new URL(request.url);
    let list = getDb().scholarships.filter((s) => s.active_status !== false);
    const search = url.searchParams.get('search')?.toLowerCase();
    const category = url.searchParams.get('category');
    const minAmount = url.searchParams.get('min_amount');
    const maxAmount = url.searchParams.get('max_amount');
    const before = url.searchParams.get('deadline_before');
    const after = url.searchParams.get('deadline_after');
    const gpaMin = url.searchParams.get('gpa_min');
    if (search) list = list.filter((s) => `${s.name} ${s.organization}`.toLowerCase().includes(search));
    if (category) list = list.filter((s) => s.categories?.includes(category));
    if (minAmount) list = list.filter((s) => (s.award_amount_max ?? 0) >= Number(minAmount));
    if (maxAmount) list = list.filter((s) => (s.award_amount_min ?? 0) <= Number(maxAmount));
    if (before) list = list.filter((s) => s.application_deadline <= before);
    if (after) list = list.filter((s) => s.application_deadline >= after);
    if (gpaMin) {
      list = list.filter(
        (s) => Number((s.eligibility_criteria as { gpa_minimum?: number })?.gpa_minimum ?? 0) <= Number(gpaMin),
      );
    }
    return HttpResponse.json(paginate(list, url));
  }),

  http.get(`${BASE}/scholarships/:scholarshipId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const s = getDb().scholarships.find((x) => x.scholarship_id === params.scholarshipId);
    if (!s) return notFound('Scholarship');
    return HttpResponse.json(s);
  }),

  /* ======================= MATCHES (scholarship spec) =================== */
  http.get(`${BASE}/students/:studentId/scholarship-matches`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    ensureMatches(s.student_id);
    const url = new URL(request.url);
    let rows = getDb()
      .scholarshipMatches.filter((m) => m.student_id === s.student_id)
      .map((m) => ({
        ...m,
        scholarship: getDb().scholarships.find((x) => x.scholarship_id === m.scholarship_id),
      }));
    const minScore = Number(url.searchParams.get('min_score') ?? 60);
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const includeDismissed = url.searchParams.get('dismissed') === 'true';
    rows = rows.filter((m) => m.match_score >= minScore);
    if (status) rows = rows.filter((m) => m.application_status === status);
    if (priority) rows = rows.filter((m) => m.priority_level === priority);
    if (!includeDismissed) rows = rows.filter((m) => !m.dismissed);
    rows.sort((a, b) => b.match_score - a.match_score);
    return HttpResponse.json({
      data: rows,
      summary: {
        total_matches: rows.length,
        high_quality_matches: rows.filter((m) => m.match_score >= 80).length,
        not_started: rows.filter((m) => m.application_status === 'not_started').length,
        in_progress: rows.filter((m) => m.application_status === 'in_progress').length,
        submitted: rows.filter((m) => m.application_status === 'submitted').length,
        total_potential_value: rows.reduce(
          (n, m) => n + (m.scholarship?.typical_award_amount ?? 0),
          0,
        ),
      },
    });
  }),

  http.post(`${BASE}/students/:studentId/scholarship-matches`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const input = await body<{ force_refresh?: boolean }>(request).catch(() => ({} as { force_refresh?: boolean }));
    ensureMatches(s.student_id, !!input?.force_refresh);
    return HttpResponse.json(
      { job_id: mockUuid('job'), status: 'processing', estimated_completion: new Date(Date.now() + 2000).toISOString() },
      { status: 202 },
    );
  }),

  http.get(`${BASE}/students/:studentId/scholarship-matches/:matchId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const m = getDb().scholarshipMatches.find(
      (x) => x.match_id === params.matchId && x.student_id === params.studentId,
    );
    if (!m) return notFound('Match');
    return HttpResponse.json({
      ...m,
      scholarship: getDb().scholarships.find((x) => x.scholarship_id === m.scholarship_id),
    });
  }),

  http.patch(`${BASE}/students/:studentId/scholarship-matches/:matchId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const m = getDb().scholarshipMatches.find(
      (x) => x.match_id === params.matchId && x.student_id === params.studentId,
    );
    if (!m) return notFound('Match');
    const input = await body<Partial<ScholarshipMatch> & { viewed?: boolean }>(request);
    if (input.viewed !== undefined) m.viewed_by_student = input.viewed;
    if (input.bookmarked !== undefined) m.bookmarked = input.bookmarked;
    if (input.dismissed !== undefined) m.dismissed = input.dismissed;
    if (input.dismissed_reason !== undefined) m.dismissed_reason = input.dismissed_reason;
    return HttpResponse.json(m);
  }),

  /* ==================== APPLICATIONS (scholarship spec) ================= */
  http.get(`${BASE}/students/:studentId/scholarship-applications`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const url = new URL(request.url);
    let rows = getDb()
      .scholarshipApplications.filter((a) => a.student_id === s.student_id)
      .map((a) => ({
        ...a,
        scholarship: getDb().scholarships.find((x) => x.scholarship_id === a.scholarship_id),
      }));
    const status = url.searchParams.get('status');
    const outcome = url.searchParams.get('outcome');
    if (status) rows = rows.filter((a) => a.status === status);
    if (outcome) rows = rows.filter((a) => a.outcome === outcome);
    return HttpResponse.json({
      data: rows,
      summary: {
        total_applications: rows.length,
        in_progress: rows.filter((a) => a.status === 'in_progress').length,
        submitted: rows.filter((a) => a.status === 'submitted').length,
        awarded: rows.filter((a) => a.outcome === 'awarded').length,
        total_awarded_amount: rows.reduce((n, a) => n + (a.outcome === 'awarded' ? a.award_amount ?? 0 : 0), 0),
      },
    });
  }),

  http.post(`${BASE}/students/:studentId/scholarship-applications`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const { scholarship_id, match_id } = await body<{ scholarship_id?: string; match_id?: string }>(request);
    if (!scholarship_id) return err(400, 'INVALID_INPUT', 'scholarship_id is required.');
    const db = getDb();
    if (db.scholarshipApplications.some((a) => a.student_id === s.student_id && a.scholarship_id === scholarship_id)) {
      return err(409, 'APPLICATION_EXISTS', 'An application for this scholarship already exists.');
    }
    const app: ScholarshipApplication = {
      application_id: mockUuid('app'),
      student_id: s.student_id,
      scholarship_id,
      match_id: match_id ?? null,
      started_at: new Date().toISOString(),
      status: 'in_progress',
      outcome: 'pending',
      completion_percentage: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.scholarshipApplications.push(app);
    const match = db.scholarshipMatches.find((m) => m.match_id === match_id);
    if (match) match.application_status = 'in_progress';
    return HttpResponse.json(
      { ...app, scholarship: db.scholarships.find((x) => x.scholarship_id === scholarship_id) },
      { status: 201 },
    );
  }),

  http.get(`${BASE}/students/:studentId/scholarship-applications/:appId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const a = getDb().scholarshipApplications.find(
      (x) => x.application_id === params.appId && x.student_id === params.studentId,
    );
    if (!a) return notFound('Application');
    return HttpResponse.json({
      ...a,
      scholarship: getDb().scholarships.find((x) => x.scholarship_id === a.scholarship_id),
    });
  }),

  http.patch(`${BASE}/students/:studentId/scholarship-applications/:appId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const a = getDb().scholarshipApplications.find(
      (x) => x.application_id === params.appId && x.student_id === params.studentId,
    );
    if (!a) return notFound('Application');
    const input = await body<Partial<ScholarshipApplication>>(request);
    Object.assign(a, input, { application_id: a.application_id, updated_at: new Date().toISOString() });
    return HttpResponse.json(a);
  }),

  http.post(`${BASE}/students/:studentId/scholarship-applications/:appId/submit`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const a = getDb().scholarshipApplications.find(
      (x) => x.application_id === params.appId && x.student_id === params.studentId,
    );
    if (!a) return notFound('Application');
    a.status = 'submitted';
    a.submitted_at = new Date().toISOString();
    const match = getDb().scholarshipMatches.find((m) => m.match_id === a.match_id);
    if (match) match.application_status = 'submitted';
    return HttpResponse.json(a);
  }),

  /* ======================= ESSAYS (scholarship spec) ==================== */
  http.post(`${BASE}/students/:studentId/scholarship-applications/:appId/essays`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const a = getDb().scholarshipApplications.find(
      (x) => x.application_id === params.appId && x.student_id === params.studentId,
    );
    if (!a) return notFound('Application');
    const { prompt_text, word_limit } = await body<{ prompt_text?: string; word_limit?: number }>(request);
    if (!prompt_text) return err(400, 'INVALID_INPUT', 'prompt_text is required.');
    const tpl = {
      template_id: mockUuid('essay'),
      application_id: a.application_id,
      student_id: a.student_id,
      scholarship_id: a.scholarship_id,
      prompt_text,
      word_limit: word_limit ?? null,
      ai_generated_draft: null, // AI assist – connected later
      student_draft: null,
      edit_count: 0,
      reviewed_by_counselor: false,
      submitted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    getDb().essayTemplates.push(tpl);
    return HttpResponse.json(tpl, { status: 201 });
  }),

  http.get(`${BASE}/students/:studentId/scholarship-applications/:appId/essays/:templateId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const t = getDb().essayTemplates.find((x) => x.template_id === params.templateId);
    if (!t) return notFound('Essay template');
    return HttpResponse.json(t);
  }),

  http.patch(`${BASE}/students/:studentId/scholarship-applications/:appId/essays/:templateId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const t = getDb().essayTemplates.find((x) => x.template_id === params.templateId);
    if (!t) return notFound('Essay template');
    const input = await body<{ student_draft?: string; finalized?: boolean }>(request);
    if (input.student_draft !== undefined) {
      t.student_draft = input.student_draft;
      t.edit_count = (t.edit_count ?? 0) + 1;
    }
    if (input.finalized) {
      t.final_version = input.student_draft ?? t.student_draft ?? null;
      t.finalized_at = new Date().toISOString();
    }
    t.updated_at = new Date().toISOString();
    return HttpResponse.json(t);
  }),

  /* ========================= VIDEOS (video spec) ======================== */
  http.get(`${BASE}/students/:studentId/videos`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s)) return forbidden();
    const url = new URL(request.url);
    let rows = getDb().videos.filter((v) => v.student_id === s.student_id);
    const type = url.searchParams.get('video_type');
    const status = url.searchParams.get('processing_status');
    const from = url.searchParams.get('date_from');
    const to = url.searchParams.get('date_to');
    if (type) rows = rows.filter((v) => v.video_type === type);
    if (status) rows = rows.filter((v) => v.processing_status === status);
    if (from) rows = rows.filter((v) => (v.event_date ?? '') >= from);
    if (to) rows = rows.filter((v) => (v.event_date ?? '') <= to);
    // Partners only see videos when the videos consent is on.
    if (me.role === 'partner') {
      const c = getConsents(s.student_id);
      if (!c.consents.videos.granted) return forbidden();
      rows = rows.filter((v) => v.privacy_setting === 'scouts_allowed' || v.privacy_setting === 'public' || v.privacy_setting === 'college_recruiters');
    }
    return HttpResponse.json({
      data: rows,
      summary: {
        total_videos: rows.length,
        total_duration_seconds: rows.reduce((n, v) => n + (v.duration_seconds ?? 0), 0),
        total_storage_mb: rows.reduce((n, v) => n + (v.file_size_bytes ?? 0) / 1048576, 0),
        analyzed_count: rows.filter((v) => v.processing_status === 'analyzed').length,
      },
    });
  }),

  http.post(`${BASE}/students/:studentId/videos`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    // multipart/form-data in the real spec; the mock accepts it loosely.
    let videoType: string = 'other';
    let title = '';
    let size = 0;
    try {
      const fd = await request.formData();
      videoType = String(fd.get('video_type') ?? 'other');
      title = String(fd.get('title') ?? '');
      const f = fd.get('file');
      if (f && typeof f === 'object' && 'size' in f) size = (f as File).size;
    } catch {
      /* accept empty */
    }
    if (size > 4 * 1024 * 1024 * 1024) return err(413, 'FILE_TOO_LARGE', 'File too large.');
    const video = {
      video_id: mockUuid('video'),
      student_id: s.student_id,
      video_type: videoType,
      sport: 'Soccer',
      title: title || null,
      upload_date: new Date().toISOString(),
      uploaded_by: me.user_id,
      uploader_role: me.role,
      file_size_bytes: size,
      storage_url: `mock://videos/${s.student_id}/${Date.now()}.mp4`,
      transcoding_status: 'pending',
      processing_status: 'uploaded',
      privacy_setting: 'private',
      consent_verified: true,
      view_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    getDb().videos.push(video as never);
    return HttpResponse.json(
      { video_id: (video as { video_id: string }).video_id, upload_url: `mock://upload/${Date.now()}`, status: 'uploading' },
      { status: 202 },
    );
  }),

  http.get(`${BASE}/students/:studentId/videos/:videoId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const v = getDb().videos.find((x) => x.video_id === params.videoId && x.student_id === params.studentId);
    if (!v) return notFound('Video');
    return HttpResponse.json(v);
  }),

  http.patch(`${BASE}/students/:studentId/videos/:videoId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const v = getDb().videos.find((x) => x.video_id === params.videoId && x.student_id === params.studentId);
    if (!v) return notFound('Video');
    const input = await body<Record<string, unknown>>(request);
    Object.assign(v, input, { video_id: v.video_id, updated_at: new Date().toISOString() });
    return HttpResponse.json(v);
  }),

  http.delete(`${BASE}/students/:studentId/videos/:videoId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const db = getDb();
    const idx = db.videos.findIndex((x) => x.video_id === params.videoId && x.student_id === params.studentId);
    if (idx === -1) return notFound('Video');
    db.videos.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  /* ===================== VIDEO ANALYSIS (video spec) ==================== */
  http.post(`${BASE}/students/:studentId/videos/:videoId/analyze`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const v = getDb().videos.find((x) => x.video_id === params.videoId && x.student_id === params.studentId);
    if (!v) return notFound('Video');
    if (v.processing_status === 'failed') return err(400, 'VIDEO_NOT_READY', 'Video is not ready for analysis.');
    const input = await body<{ analysis_type?: string }>(request);
    const analysis = {
      analysis_id: mockUuid('analysis'),
      video_id: v.video_id,
      student_id: v.student_id,
      analysis_type: input.analysis_type ?? 'skill_assessment',
      ai_model_name: 'MockSkillAssessment_v0',
      ai_model_version: '0.1.0',
      confidence_score: 0,
      processed_at: new Date().toISOString(),
      analysis_results: { note: 'AI analysis – connected later (placeholder).' },
      reviewed_by_coach: false,
      created_at: new Date().toISOString(),
    };
    getDb().analyses.push(analysis as never);
    v.processing_status = 'processing';
    return HttpResponse.json(
      { job_id: mockUuid('job'), status: 'queued', estimated_completion: new Date(Date.now() + 60000).toISOString() },
      { status: 202 },
    );
  }),

  http.get(`${BASE}/students/:studentId/videos/:videoId/analysis`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const url = new URL(request.url);
    let rows = getDb().analyses.filter((a) => a.video_id === params.videoId);
    const type = url.searchParams.get('analysis_type');
    if (type) rows = rows.filter((a) => a.analysis_type === type);
    return HttpResponse.json({ data: rows });
  }),

  http.get(`${BASE}/students/:studentId/videos/:videoId/analysis/:analysisId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const a = getDb().analyses.find((x) => x.analysis_id === params.analysisId);
    if (!a) return notFound('Analysis');
    return HttpResponse.json(a);
  }),

  http.patch(`${BASE}/students/:studentId/videos/:videoId/analysis/:analysisId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const a = getDb().analyses.find((x) => x.analysis_id === params.analysisId);
    if (!a) return notFound('Analysis');
    const input = await body<{ coach_agreement?: boolean; coach_notes?: string; reviewed?: boolean }>(request);
    if (input.coach_agreement !== undefined) a.coach_agreement = input.coach_agreement;
    if (input.coach_notes !== undefined) a.coach_notes = input.coach_notes;
    if (input.reviewed !== undefined) a.reviewed_by_coach = input.reviewed;
    return HttpResponse.json(a);
  }),

  /* ======================= HIGHLIGHTS (video spec) ====================== */
  http.get(`${BASE}/students/:studentId/highlights`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const url = new URL(request.url);
    let rows = getDb().highlights.filter((h) => h.student_id === params.studentId);
    const type = url.searchParams.get('highlight_type');
    const showcase = url.searchParams.get('showcase_worthy');
    const minQ = url.searchParams.get('min_quality_score');
    if (type) rows = rows.filter((h) => h.highlight_type === type);
    if (showcase) rows = rows.filter((h) => h.showcase_worthy === (showcase === 'true'));
    if (minQ) rows = rows.filter((h) => (h.quality_score ?? 0) >= Number(minQ));
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/highlights`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const input = await body<{ video_id?: string; highlight_type?: string; start_timestamp?: string; end_timestamp?: string }>(request);
    if (!input.video_id || !input.highlight_type || !input.start_timestamp || !input.end_timestamp) {
      return err(400, 'INVALID_INPUT', 'video_id, highlight_type, start_timestamp and end_timestamp are required.');
    }
    const video = getDb().videos.find((v) => v.video_id === input.video_id);
    if (!video) return notFound('Video');
    const h = {
      highlight_id: mockUuid('hl'),
      student_id: String(params.studentId),
      auto_detected: false,
      manually_tagged: true,
      clip_generated: false,
      showcase_worthy: false,
      ...input,
      created_at: new Date().toISOString(),
    };
    getDb().highlights.push(h as never);
    return HttpResponse.json(h, { status: 201 });
  }),

  http.patch(`${BASE}/students/:studentId/highlights/:highlightId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const h = getDb().highlights.find((x) => x.highlight_id === params.highlightId && x.student_id === params.studentId);
    if (!h) return notFound('Highlight');
    const input = await body<Record<string, unknown>>(request);
    Object.assign(h, input, { highlight_id: h.highlight_id });
    return HttpResponse.json(h);
  }),

  /* ==================== RECRUITMENT REELS (video spec) ================== */
  http.get(`${BASE}/students/:studentId/recruitment-reels`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const url = new URL(request.url);
    let rows = getDb().reels.filter((r) => r.student_id === params.studentId);
    const status = url.searchParams.get('status');
    if (status) rows = rows.filter((r) => r.status === status);
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/recruitment-reels`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const input = await body<{ reel_name?: string; reel_type?: string; included_highlights?: string[] }>(request);
    if (!input.reel_name || !input.reel_type || !input.included_highlights) {
      return err(400, 'INVALID_INPUT', 'reel_name, reel_type and included_highlights are required.');
    }
    const reel = {
      reel_id: mockUuid('reel'),
      student_id: String(params.studentId),
      reel_name: input.reel_name,
      reel_type: input.reel_type,
      included_highlights: input.included_highlights,
      highlight_count: input.included_highlights.length,
      auto_generated: false,
      status: 'draft',
      share_link_active: false,
      view_count: 0,
      scout_views: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    getDb().reels.push(reel as never);
    return HttpResponse.json(
      { reel_id: reel.reel_id, job_id: mockUuid('job'), status: 'generating' },
      { status: 202 },
    );
  }),

  http.post(`${BASE}/students/:studentId/recruitment-reels/:reelId/share`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const reel = getDb().reels.find((r) => r.reel_id === params.reelId && r.student_id === params.studentId);
    if (!reel) return notFound('Reel');
    const input = await body<{ expires_in_days?: number }>(request);
    const days = input.expires_in_days ?? 90;
    const expires = new Date(Date.now() + days * 86400000).toISOString();
    reel.share_link = `mock://share/${reel.reel_id}`;
    reel.share_link_active = true;
    reel.share_link_expires_at = expires;
    return HttpResponse.json({ share_link: reel.share_link, expires_at: expires });
  }),

  /* ============ CONSENTS (additions — see openapi_additions.yaml) ======= */
  http.get(`${BASE}/students/:studentId/consents`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    return HttpResponse.json(getConsents(s.student_id));
  }),

  http.put(`${BASE}/students/:studentId/consents`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const input = await body<{ consents?: Record<ConsentKey, boolean> }>(request);
    // Prompt 6B: club_player_development may only be granted by a parent —
    // or by the player themselves once 18+.
    if (input.consents?.club_player_development === true && me.role === 'student' && (s.age ?? 0) < 18) {
      return err(
        403,
        'PARENT_APPROVAL_REQUIRED',
        'A parent or guardian must turn on club player development for players under 18.',
      );
    }
    const rec = getConsents(s.student_id);
    const now = new Date().toISOString();
    const LABELS: Record<ConsentKey, string> = {
      grades_for_matching: 'Scholarship matching service',
      sports_to_colleges: 'College coaches',
      sports_to_pro_clubs: 'Professional club scouts',
      videos: 'Highlight video viewers',
      partner_contact: 'Corporate partners',
      club_player_development: 'FC Brownsville player development staff',
    };
    (Object.keys(input.consents ?? {}) as ConsentKey[]).forEach((key) => {
      const want = input.consents![key];
      const cur = rec.consents[key];
      if (want && !cur.granted) {
        rec.consents[key] = { key, granted: true, granted_at: now, granted_by_role: me.role };
      } else if (!want && cur.granted) {
        rec.consents[key] = { key, granted: false, granted_at: null, granted_by_role: null };
      }
    });
    rec.access_log = Object.values(rec.consents)
      .filter((c) => c.granted)
      .map((c) => ({ party: LABELS[c.key], scope: c.key, since: c.granted_at ?? null }));
    rec.updated_at = now;
    return HttpResponse.json(rec);
  }),

  /* ========= RACING 360 REPORTS (additions — field names to confirm) ==== */
  http.get(`${BASE}/students/:studentId/racing360-reports`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s)) return forbidden();
    const rows = getDb()
      .racing360Reports.filter((r) => r.student_id === s.student_id)
      .sort((a, b) => a.report_date.localeCompare(b.report_date));
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/racing360-reports`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (!['admin', 'coach', 'club_staff'].includes(me.role)) return forbidden();
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    const input = await body<{ report_date?: string; metrics?: Record<string, unknown>; coach_notes?: string }>(request);
    if (!input.report_date) return err(400, 'INVALID_INPUT', 'report_date is required.');
    const report: Racing360Report = {
      report_id: mockUuid('r360'),
      student_id: s.student_id,
      report_date: input.report_date,
      source: 'Racing 360 (manual entry — field names to confirm)',
      coach_notes: input.coach_notes ?? null,
      metrics: input.metrics ?? {},
      created_at: new Date().toISOString(),
    };
    getDb().racing360Reports.push(report);
    // Manual metrics feed the performance timeline (player_performance_timeline).
    const m = input.metrics ?? {};
    if (m.technical_rating_1_10 != null || m.tactical_rating_1_10 != null || m.sessions != null) {
      getDb().performanceTimeline.push({
        timeline_id: mockUuid('tl'),
        student_id: s.student_id,
        assessment_date: input.report_date,
        season: null,
        overall_rating:
          m.technical_rating_1_10 != null && m.tactical_rating_1_10 != null
            ? Math.round(((Number(m.technical_rating_1_10) + Number(m.tactical_rating_1_10)) / 2) * 10) / 10
            : null,
        technical_skills: m.technical_rating_1_10 != null ? Number(m.technical_rating_1_10) : null,
        tactical_awareness: m.tactical_rating_1_10 != null ? Number(m.tactical_rating_1_10) : null,
        physical_fitness: null,
        mental_toughness: null,
        trajectory: null,
        assessment_notes:
          typeof m.evaluator_comment === 'string' ? m.evaluator_comment : 'Imported from Racing 360 report. (field names to confirm)',
        coach_observations: input.coach_notes ?? null,
        source: 'racing360',
        created_at: new Date().toISOString(),
      });
    }
    return HttpResponse.json(report, { status: 201 });
  }),

  /* ================= SPORTS PATHWAY (additions, Prompt 5) =============== */

  /** Assembled recruiting "front page". */
  http.get(`${BASE}/students/:studentId/recruiting-profile`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s)) return forbidden();
    return HttpResponse.json(buildRecruitingProfile(s));
  }),

  /** Student (or coach) edits the recruiting front page. */
  http.patch(`${BASE}/students/:studentId/recruiting-profile`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    const isSelf = me.role === 'student' && me.student_id === s.student_id;
    const isStaff = ['coach', 'club_staff', 'admin'].includes(me.role);
    if (!isSelf && !isStaff) return forbidden();
    const input = await body<{
      positions?: string[];
      dominant_foot?: 'Left' | 'Right' | 'Both' | null;
      dominant_hand?: string | null;
      height_inches?: number | null;
      weight_pounds?: number | null;
    }>(request);
    const db = getDb();
    const ap = db.athleticProfiles.find((a) => a.student_id === s.student_id && a.active_status);
    if (ap) {
      if (input.positions?.length) {
        ap.position = input.positions[0];
        ap.secondary_positions = input.positions.slice(1).join(', ') || undefined;
      }
      if (input.dominant_foot !== undefined) ap.dominant_foot = input.dominant_foot ?? undefined;
      if (input.dominant_hand !== undefined) ap.dominant_hand = input.dominant_hand ?? undefined;
      if (input.height_inches !== undefined) ap.height_inches = input.height_inches ?? undefined;
      if (input.weight_pounds !== undefined) ap.weight_pounds = input.weight_pounds ?? undefined;
      ap.updated_at = new Date().toISOString();
    }
    return HttpResponse.json(buildRecruitingProfile(s));
  }),

  /** "See what a scout sees" — the exact consent-stripped scout view of self. */
  http.get(`${BASE}/students/:studentId/recruiting-preview`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s)) return forbidden();
    const c = getConsents(s.student_id);
    const optedIn = c.consents.sports_to_colleges.granted || c.consents.sports_to_pro_clubs.granted;
    const asScout: TokenPayload = {
      user_id: 'preview', email: '', role: 'partner', display_name: 'Scout preview',
    };
    return HttpResponse.json({
      visible: optedIn,
      result: optedIn ? buildScoutResult(s) : null,
      consents: {
        sports_to_colleges: c.consents.sports_to_colleges.granted,
        sports_to_pro_clubs: c.consents.sports_to_pro_clubs.granted,
        videos: c.consents.videos.granted,
        grades_for_matching: c.consents.grades_for_matching.granted,
      },
      videos_visible: c.consents.videos.granted,
      viewer: asScout.role,
    });
  }),

  /** Performance timeline (player_performance_timeline). */
  http.get(`${BASE}/students/:studentId/performance-timeline`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s)) return forbidden();
    const rows = getDb()
      .performanceTimeline.filter((p) => p.student_id === s.student_id)
      .sort((a, b) => a.assessment_date.localeCompare(b.assessment_date));
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/performance-timeline`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (!['admin', 'coach', 'club_staff'].includes(me.role)) return forbidden();
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    const input = await body<Partial<PerformancePoint> & { assessment_date?: string }>(request);
    if (!input.assessment_date) return err(400, 'INVALID_INPUT', 'assessment_date is required.');
    const point: PerformancePoint = {
      timeline_id: mockUuid('tl'),
      student_id: s.student_id,
      assessment_date: input.assessment_date,
      season: input.season ?? null,
      overall_rating: input.overall_rating ?? null,
      technical_skills: input.technical_skills ?? null,
      tactical_awareness: input.tactical_awareness ?? null,
      physical_fitness: input.physical_fitness ?? null,
      mental_toughness: input.mental_toughness ?? null,
      trajectory: input.trajectory ?? null,
      assessment_notes: input.assessment_notes ?? null,
      coach_observations: input.coach_observations ?? null,
      source: 'coach_entry',
      created_at: new Date().toISOString(),
    };
    getDb().performanceTimeline.push(point);
    return HttpResponse.json(point, { status: 201 });
  }),

  /** Opportunities — three lanes (college / national / international). */
  http.get(`${BASE}/opportunities`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const url = new URL(request.url);
    const lane = url.searchParams.get('lane');
    let rows = getDb().opportunities;
    if (lane) rows = rows.filter((o) => o.lane === lane);
    return HttpResponse.json({ data: rows });
  }),

  /** Scout search — partners only see students who opted in. */
  http.get(`${BASE}/recruiting/search`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (!['partner', 'coach', 'club_staff', 'admin'].includes(me.role)) return forbidden();
    const url = new URL(request.url);
    const position = url.searchParams.get('position')?.toLowerCase();
    const gradYear = url.searchParams.get('grad_year');
    const level = url.searchParams.get('level')?.toLowerCase();
    const openTo = url.searchParams.get('open_to');
    let rows = getDb().students.filter((s) => {
      const c = getDb().consents.find((x) => x.student_id === s.student_id);
      return !!(
        c &&
        s.app_mode === 'pathways' &&
        (c.consents.sports_to_colleges.granted || c.consents.sports_to_pro_clubs.granted) &&
        getDb().athleticProfiles.some((a) => a.student_id === s.student_id && a.active_status)
      );
    });
    let results = rows.map(buildScoutResult);
    if (position) results = results.filter((r) => r.positions.some((p) => p.toLowerCase().includes(position)));
    if (gradYear) results = results.filter((r) => r.grad_year === Number(gradYear));
    if (level) results = results.filter((r) => (r.competitive_level ?? '').toLowerCase().includes(level));
    if (openTo) results = results.filter((r) => r.open_to.includes(openTo as never));
    return HttpResponse.json({ data: results, total: results.length });
  }),

  /** Contact requests — scout asks, student (and parent if under 18) approves. */
  http.get(`${BASE}/students/:studentId/contact-requests`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const rows = getDb()
      .contactRequests.filter((r) => r.student_id === s.student_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/contact-requests`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (me.role !== 'partner') return forbidden();
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s)) return forbidden(); // never contact a non-opted-in student
    const input = await body<{ requester_org?: string; requester_role?: ContactRequest['requester_role']; message?: string }>(request);
    if (!input.requester_org || !input.message) {
      return err(400, 'INVALID_INPUT', 'requester_org and message are required.');
    }
    const age = s.age ?? null;
    const req: ContactRequest = {
      request_id: mockUuid('cr'),
      student_id: s.student_id,
      requester_org: input.requester_org,
      requester_role: input.requester_role ?? 'college',
      message: input.message,
      status: age !== null && age < 18 ? 'pending_parent' : 'pending_student',
      created_at: new Date().toISOString(),
    };
    getDb().contactRequests.push(req);
    return HttpResponse.json(req, { status: 201 });
  }),

  http.patch(`${BASE}/students/:studentId/contact-requests/:requestId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    const isSelf = me.role === 'student' && me.student_id === s.student_id;
    const isParent = me.role === 'parent' && (me.child_ids ?? []).includes(s.student_id);
    if (!isSelf && !isParent) return forbidden();
    const req = getDb().contactRequests.find(
      (r) => r.request_id === params.requestId && r.student_id === s.student_id,
    );
    if (!req) return notFound('Contact request');
    const input = await body<{ action?: 'approve' | 'decline' }>(request);
    if (input.action !== 'approve' && input.action !== 'decline') {
      return err(400, 'INVALID_INPUT', 'action must be approve or decline.');
    }
    // Under 18: a student alone cannot approve — a parent must.
    const age = s.age ?? null;
    if (input.action === 'approve' && age !== null && age < 18 && me.role !== 'parent') {
      return err(403, 'PARENT_APPROVAL_REQUIRED', 'A parent or guardian must approve contact for players under 18.');
    }
    req.status = input.action === 'approve' ? 'approved' : 'declined';
    return HttpResponse.json(req);
  }),

  /* ================= CAREERS (additions — certificate careers) ========== */
  http.get(`${BASE}/careers`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const url = new URL(request.url);
    let rows = [...getDb().careers];
    const interest = url.searchParams.get('interest');
    if (interest) {
      const sectors = CAREER_INTEREST_MAP[interest] ?? [];
      rows = rows.filter((c) => sectors.includes(c.sector));
    }
    if (url.searchParams.get('funded') === 'true') rows = rows.filter((c) => c.funded_options.length > 0);
    const maxWeeks = url.searchParams.get('max_weeks');
    if (maxWeeks) rows = rows.filter((c) => c.training_length_weeks <= Number(maxWeeks));
    if (url.searchParams.get('start_under_18') === 'true') rows = rows.filter((c) => c.min_age_work < 18);
    if (url.searchParams.get('sport_friendly') === 'true') rows = rows.filter((c) => c.sport_friendly);
    if (url.searchParams.get('near_rgv') === 'true') {
      const RGV = ['Brownsville', 'Harlingen', 'McAllen', 'Pharr', 'Edinburg', 'Port of Brownsville', 'Online'];
      rows = rows.filter((c) => c.training_providers.some((p) => RGV.some((city) => p.location.includes(city))));
    }
    const sector = url.searchParams.get('sector');
    if (sector) rows = rows.filter((c) => c.sector === sector || c.rgv_sectors.includes(sector));
    const rgvSector = url.searchParams.get('rgv_sector');
    if (rgvSector) rows = rows.filter((c) => c.rgv_sectors.includes(rgvSector));
    const search = url.searchParams.get('search')?.toLowerCase();
    if (search) rows = rows.filter((c) => `${c.title_en} ${c.title_es}`.toLowerCase().includes(search));
    return HttpResponse.json(paginate(rows, url));
  }),

  http.get(`${BASE}/careers/:careerId/employers`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const c = getDb().careers.find((x) => x.career_id === params.careerId);
    if (!c) return notFound('Career');
    const rows = getDb().partners.filter((p) => c.employer_partner_ids.includes(p.partner_id));
    return HttpResponse.json({ data: rows });
  }),

  http.get(`${BASE}/careers/:careerId/plan`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const c = getDb().careers.find((x) => x.career_id === params.careerId);
    if (!c) return notFound('Career');
    return HttpResponse.json({ career_id: c.career_id, steps: buildCareerPlanSteps(c) });
  }),

  http.get(`${BASE}/careers/:careerId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const c = getDb().careers.find((x) => x.career_id === params.careerId);
    if (!c) return notFound('Career');
    return HttpResponse.json(c);
  }),

  http.get(`${BASE}/students/:studentId/saved-careers`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const rows = getDb()
      .savedCareers.filter((x) => x.student_id === s.student_id)
      .map((x) => ({ ...x, career: getDb().careers.find((c) => c.career_id === x.career_id) }));
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/saved-careers`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const input = await body<{ career_id?: string }>(request);
    if (!input.career_id || !getDb().careers.find((c) => c.career_id === input.career_id))
      return err(400, 'INVALID_INPUT', 'career_id must reference an existing career.');
    const dup = getDb().savedCareers.find(
      (x) => x.student_id === s.student_id && x.career_id === input.career_id,
    );
    if (dup) return err(409, 'ALREADY_SAVED', 'This career is already saved.');
    const saved: SavedCareer = {
      saved_id: mockUuid('save'),
      student_id: s.student_id,
      career_id: input.career_id,
      saved_at: new Date().toISOString(),
    };
    getDb().savedCareers.push(saved);
    return HttpResponse.json(saved, { status: 201 });
  }),

  http.delete(`${BASE}/students/:studentId/saved-careers/:savedId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const idx = getDb().savedCareers.findIndex(
      (x) => x.saved_id === params.savedId && x.student_id === s.student_id,
    );
    if (idx === -1) return notFound('Saved career');
    getDb().savedCareers.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  /* ================= COLLEGES (additions) ================= */
  http.get(`${BASE}/colleges`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const url = new URL(request.url);
    let rows = [...getDb().colleges];
    const country = url.searchParams.get('country');
    if (country) rows = rows.filter((c) => c.country === country);
    if (url.searchParams.get('in_rgv') === 'true') rows = rows.filter((c) => c.in_rgv);
    const type = url.searchParams.get('type');
    if (type) rows = rows.filter((c) => c.type === type);
    if (url.searchParams.get('soccer') === 'true') rows = rows.filter((c) => c.soccer_program !== 'none');
    return HttpResponse.json(paginate(rows, url));
  }),

  http.get(`${BASE}/colleges/:collegeId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const c = getDb().colleges.find((x) => x.college_id === params.collegeId);
    if (!c) return notFound('College');
    return HttpResponse.json(c);
  }),

  http.get(`${BASE}/students/:studentId/saved-colleges`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const rows = getDb()
      .savedColleges.filter((x) => x.student_id === s.student_id)
      .map((x) => ({ ...x, college: getDb().colleges.find((c) => c.college_id === x.college_id) }));
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/saved-colleges`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const input = await body<{ college_id?: string }>(request);
    if (!input.college_id || !getDb().colleges.find((c) => c.college_id === input.college_id))
      return err(400, 'INVALID_INPUT', 'college_id must reference an existing college.');
    const dup = getDb().savedColleges.find(
      (x) => x.student_id === s.student_id && x.college_id === input.college_id,
    );
    if (dup) return err(409, 'ALREADY_SAVED', 'This college is already saved.');
    const saved: SavedCollege = {
      saved_id: mockUuid('save'),
      student_id: s.student_id,
      college_id: input.college_id,
      saved_at: new Date().toISOString(),
    };
    getDb().savedColleges.push(saved);
    return HttpResponse.json(saved, { status: 201 });
  }),

  http.delete(`${BASE}/students/:studentId/saved-colleges/:savedId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const idx = getDb().savedColleges.findIndex(
      (x) => x.saved_id === params.savedId && x.student_id === s.student_id,
    );
    if (idx === -1) return notFound('Saved college');
    getDb().savedColleges.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  /* ================= COMPASS (additions) ================= */
  http.get(`${BASE}/students/:studentId/compass`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    return HttpResponse.json(s.pathway_compass ?? { completed: false });
  }),

  http.put(`${BASE}/students/:studentId/compass`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const input = await body<PathwayCompass>(request);
    s.pathway_compass = {
      ...(s.pathway_compass ?? { completed: false }),
      ...input,
      completed: input.completed ?? s.pathway_compass?.completed ?? false,
    };
    if (input.completed && !s.pathway_compass.completed_at)
      s.pathway_compass.completed_at = new Date().toISOString();
    s.updated_at = new Date().toISOString();
    // Keep career_interests (SQL shape) in sync with compass interests.
    if (input.interests) {
      const db = getDb();
      db.careerInterests = db.careerInterests.filter((x) => x.student_id !== s.student_id);
      input.interests.forEach((field, i) => {
        db.careerInterests.push({
          interest_id: `${s.student_id}-int-${i}`,
          student_id: s.student_id,
          career_field: field,
          interest_level: 3,
          date_recorded: new Date().toISOString().slice(0, 10),
        });
      });
    }
    return HttpResponse.json(s.pathway_compass);
  }),

  /* ============ PLAN ACTIONS / DEADLINES / MESSAGES / STORY (additions) = */
  http.get(`${BASE}/students/:studentId/plan-actions`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const db = getDb();
    if (!db.planActions.some((a) => a.student_id === s.student_id)) {
      // Lazily generate a starter plan from the student's Compass answers.
      const hasAthletic = db.athleticProfiles.some(
        (a) => a.student_id === s.student_id && a.active_status,
      );
      defaultPlanActions(s.student_id, s.pathway_compass, hasAthletic).forEach((a, i) => {
        db.planActions.push({
          ...a,
          action_id: `${s.student_id}-plan-${i}`,
          created_at: new Date().toISOString(),
        });
      });
    }
    const rows = db.planActions
      .filter((a) => a.student_id === s.student_id)
      .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/plan-actions`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const input = await body<{ pathway?: PlanAction['pathway']; title_en?: string; title_es?: string; due_date?: string }>(request);
    if (!input.pathway || !input.title_en)
      return err(400, 'INVALID_INPUT', 'pathway and title_en are required.');
    const action: PlanAction = {
      action_id: mockUuid('plan'),
      student_id: s.student_id,
      pathway: input.pathway,
      title_en: input.title_en,
      title_es: input.title_es ?? input.title_en,
      due_date: input.due_date ?? null,
      status: 'todo',
      origin: me.role === 'coach' ? 'coach' : me.role === 'student' ? 'student' : 'system',
      created_at: new Date().toISOString(),
    };
    getDb().planActions.push(action);
    return HttpResponse.json(action, { status: 201 });
  }),

  http.patch(`${BASE}/students/:studentId/plan-actions/:actionId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const a = getDb().planActions.find(
      (x) => x.action_id === params.actionId && x.student_id === s.student_id,
    );
    if (!a) return notFound('Plan action');
    const input = await body<{ status?: 'todo' | 'done'; due_date?: string | null }>(request);
    if (input.status) {
      a.status = input.status;
      a.completed_at = input.status === 'done' ? new Date().toISOString() : null;
    }
    if (input.due_date !== undefined) a.due_date = input.due_date;
    return HttpResponse.json(a);
  }),

  http.get(`${BASE}/students/:studentId/deadlines`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const today = new Date().toISOString().slice(0, 10);
    const fromScholarships: Deadline[] = getDb()
      .scholarships.filter((sch) => sch.active_status && sch.application_deadline)
      .map((sch) => ({
        deadline_id: `dl-${sch.scholarship_id}`,
        kind: 'scholarship' as const,
        title_en: `${sch.name} — application deadline`,
        title_es: `${sch.name} — fecha límite de solicitud`,
        date: sch.application_deadline!,
        ref_id: sch.scholarship_id,
      }));
    const fromPostings: Deadline[] = getDb()
      .internshipPostings.filter(
        (p) => p.posting_status === 'published' && p.positions_filled < p.positions_available,
      )
      .map((p) => ({
        deadline_id: `dl-${p.posting_id}`,
        kind: 'application' as const,
        title_en: `Apply: ${p.job_title} (sample)`,
        title_es: `Aplica: ${p.job_title} (muestra)`,
        date: p.application_deadline,
        ref_id: p.posting_id,
      }));
    const rows = [...getDb().events, ...fromScholarships, ...fromPostings]
      .filter((d) => d.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    return HttpResponse.json({ data: rows });
  }),

  http.get(`${BASE}/students/:studentId/messages`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const rows = getDb()
      .messages.filter((m) => m.student_id === s.student_id)
      .sort((a, b) => b.sent_at.localeCompare(a.sent_at));
    return HttpResponse.json({ data: rows });
  }),

  http.patch(`${BASE}/students/:studentId/messages/:messageId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const m = getDb().messages.find(
      (x) => x.message_id === params.messageId && x.student_id === s.student_id,
    );
    if (!m) return notFound('Message');
    const input = await body<{ read?: boolean }>(request);
    if (input.read) m.read_at = new Date().toISOString();
    return HttpResponse.json(m);
  }),

  http.get(`${BASE}/students/:studentId/my-story`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const story = getDb().stories.find((x) => x.student_id === s.student_id);
    return HttpResponse.json(
      story ?? { student_id: s.student_id, text: '', updated_at: new Date().toISOString() },
    );
  }),

  http.put(`${BASE}/students/:studentId/my-story`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const input = await body<{ text?: string }>(request);
    const db = getDb();
    let story = db.stories.find((x) => x.student_id === s.student_id);
    if (!story) {
      story = { student_id: s.student_id, text: '', updated_at: '' };
      db.stories.push(story);
    }
    story.text = (input.text ?? '').slice(0, 1000);
    story.updated_at = new Date().toISOString();
    return HttpResponse.json(story);
  }),

  /* ================= DOCUMENTS / TEST SCORES / INTERESTS (additions) ==== */
  http.get(`${BASE}/students/:studentId/documents`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    return HttpResponse.json({
      data: getDb().documents.filter((d) => d.student_id === s.student_id),
    });
  }),

  http.post(`${BASE}/students/:studentId/documents`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const input = await body<{ kind?: StudentDocument['kind']; file_name?: string; note?: string }>(request);
    if (!input.kind || !input.file_name)
      return err(400, 'INVALID_INPUT', 'kind and file_name are required.');
    const doc: StudentDocument = {
      document_id: mockUuid('doc'),
      student_id: s.student_id,
      kind: input.kind,
      file_name: input.file_name,
      note: input.note ?? null,
      uploaded_at: new Date().toISOString(),
    };
    getDb().documents.push(doc);
    return HttpResponse.json(doc, { status: 201 });
  }),

  http.delete(`${BASE}/students/:studentId/documents/:documentId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const idx = getDb().documents.findIndex(
      (d) => d.document_id === params.documentId && d.student_id === s.student_id,
    );
    if (idx === -1) return notFound('Document');
    getDb().documents.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/students/:studentId/test-scores`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    return HttpResponse.json({
      data: getDb().testScores.filter((x) => x.student_id === s.student_id),
    });
  }),

  http.post(`${BASE}/students/:studentId/test-scores`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const input = await body<Partial<TestScore>>(request);
    if (!input.test_type || !input.test_date)
      return err(400, 'INVALID_INPUT', 'test_type and test_date are required.');
    const score: TestScore = {
      score_id: mockUuid('score'),
      student_id: s.student_id,
      test_type: input.test_type,
      test_date: input.test_date,
      sat_total: input.sat_total ?? null,
      act_composite: input.act_composite ?? null,
      toefl_total: input.toefl_total ?? null,
      score_value: input.score_value ?? null,
      created_at: new Date().toISOString(),
    };
    getDb().testScores.push(score);
    return HttpResponse.json(score, { status: 201 });
  }),

  http.get(`${BASE}/students/:studentId/interests`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    return HttpResponse.json({
      data: getDb().careerInterests.filter((x) => x.student_id === s.student_id),
    });
  }),

  http.put(`${BASE}/students/:studentId/interests`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const input = await body<{ interests?: Array<{ career_field: string; interest_level?: number }> }>(request);
    const db = getDb();
    db.careerInterests = db.careerInterests.filter((x) => x.student_id !== s.student_id);
    (input.interests ?? []).forEach((row, i) => {
      db.careerInterests.push({
        interest_id: `${s.student_id}-int-${i}`,
        student_id: s.student_id,
        career_field: row.career_field,
        interest_level: Math.min(5, Math.max(1, row.interest_level ?? 3)),
        date_recorded: new Date().toISOString().slice(0, 10),
      });
    });
    return HttpResponse.json({
      data: db.careerInterests.filter((x) => x.student_id === s.student_id),
    });
  }),

  /* ============ SCHOOLS (additions — sample schools only) =============== */
  http.get(`${BASE}/schools`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const names = [...new Set(getDb().students.map((s) => s.school_name).filter(Boolean))].sort();
    return HttpResponse.json({ data: names.map((name) => ({ name, is_sample: true })) });
  }),

  /* ============ MODE PROMOTION (additions — explorer → pathways) ======== */
  http.post(`${BASE}/students/:studentId/promote-to-pathways`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    // Only a parent (of this child) or an admin can promote a student's mode.
    if (me.role !== 'admin' && !(me.role === 'parent' && (me.child_ids ?? []).includes(s.student_id)))
      return forbidden();
    if (s.app_mode === 'pathways')
      return err(409, 'ALREADY_PATHWAYS', 'This student is already in pathways mode.');
    s.app_mode = 'pathways';
    s.updated_at = new Date().toISOString();
    return HttpResponse.json(s);
  }),

  /* ============ INTERNSHIPS (additions — corporate_internships SQL) ==== */
  http.get(`${BASE}/internships`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const url = new URL(request.url);
    const embed = (p: InternshipPosting) => {
      const partner = getDb().partners.find((x) => x.partner_id === p.partner_id);
      return { ...p, company_name: partner?.company_name, partner_sector: partner?.industry_sector };
    };
    let rows = getDb().internshipPostings.filter(
      (p) => p.posting_status === 'published' && p.positions_filled < p.positions_available,
    );
    const career = url.searchParams.get('career_id');
    if (career) rows = rows.filter((p) => p.related_career_id === career);
    if (url.searchParams.get('paid') === 'true') rows = rows.filter((p) => p.pay_type !== 'Unpaid');
    if (url.searchParams.get('sport_friendly') === 'true') rows = rows.filter((p) => p.sport_schedule_friendly);
    const category = url.searchParams.get('category');
    if (category) rows = rows.filter((p) => p.job_category.toLowerCase() === category.toLowerCase());
    rows = [...rows].sort((a, b) => a.application_deadline.localeCompare(b.application_deadline));
    const page = paginate(rows.map(embed), url);
    return HttpResponse.json(page);
  }),

  http.get(`${BASE}/internships/:postingId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const p = getDb().internshipPostings.find((x) => x.posting_id === params.postingId);
    if (!p || p.posting_status !== 'published') return notFound('Posting');
    const partner = getDb().partners.find((x) => x.partner_id === p.partner_id);
    return HttpResponse.json({ ...p, company_name: partner?.company_name, partner_sector: partner?.industry_sector });
  }),

  http.get(`${BASE}/students/:studentId/internship-applications`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const rows = getDb()
      .internshipApplications.filter((x) => x.student_id === s.student_id)
      .map((x) => {
        const p = getDb().internshipPostings.find((y) => y.posting_id === x.posting_id);
        const partner = p && getDb().partners.find((y) => y.partner_id === p.partner_id);
        return { ...x, posting: p ? { ...p, company_name: partner?.company_name } : undefined };
      })
      .sort((a, b) => b.application_date.localeCompare(a.application_date));
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/internship-applications`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    // Only the student themself (or parent of an explorer is N/A — postings
    // are pathways-only) may apply.
    if (me.role !== 'student' || me.student_id !== s.student_id) return forbidden();
    if (s.app_mode === 'explorer')
      return err(403, 'EXPLORER_MODE', 'Explorer mode has no job or internship applications.');
    const input = await body<{ posting_id?: string; application_responses?: Record<string, string> }>(request);
    const posting = getDb().internshipPostings.find((p) => p.posting_id === input.posting_id);
    if (!posting || posting.posting_status !== 'published') return notFound('Posting');
    if (posting.positions_filled >= posting.positions_available)
      return err(409, 'POSTING_FILLED', 'All positions for this posting are filled.');
    if (posting.application_deadline < new Date().toISOString().slice(0, 10))
      return err(409, 'DEADLINE_PASSED', 'The application deadline has passed.');
    const dup = getDb().internshipApplications.find(
      (x) => x.student_id === s.student_id && x.posting_id === posting.posting_id,
    );
    if (dup) return err(409, 'ALREADY_APPLIED', 'You already applied to this posting.');
    const now = new Date().toISOString();
    const app: InternshipApplication = {
      application_id: mockUuid('app'),
      student_id: s.student_id,
      posting_id: posting.posting_id,
      application_date: now,
      status: 'submitted',
      status_updated_at: null,
      status_history: [{ status: 'submitted', timestamp: now, updated_by: 'student' }],
      application_responses: input.application_responses ?? null,
      counselor_assisted: false,
    };
    getDb().internshipApplications.push(app);
    posting.total_applications = (posting.total_applications ?? 0) + 1;
    return HttpResponse.json(app, { status: 201 });
  }),

  http.patch(`${BASE}/students/:studentId/internship-applications/:applicationId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s)) return forbidden();
    const app = getDb().internshipApplications.find(
      (x) => x.application_id === params.applicationId && x.student_id === s.student_id,
    );
    if (!app) return notFound('Application');
    const input = await body<{ action?: string }>(request);
    if (input.action !== 'withdraw')
      return err(400, 'INVALID_INPUT', 'Supported action: "withdraw".');
    if (['withdrawn', 'accepted', 'declined', 'rejected'].includes(app.status))
      return err(409, 'ALREADY_CLOSED', `This application is already ${app.status}.`);
    const now = new Date().toISOString();
    app.status = 'withdrawn';
    app.status_updated_at = now;
    app.status_history.push({ status: 'withdrawn', timestamp: now, updated_by: me.role });
    return HttpResponse.json(app);
  }),

  /* ============ CAREER PLANS (additions — step-by-step My Plan) ======= */
  http.get(`${BASE}/students/:studentId/career-plans`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const rows = getDb()
      .careerPlans.filter((x) => x.student_id === s.student_id)
      .map((x) => ({ ...x, career: getDb().careers.find((c) => c.career_id === x.career_id) }));
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/career-plans`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    if (s.app_mode === 'explorer')
      return err(403, 'EXPLORER_MODE', 'Explorer mode does not build career plans yet.');
    const input = await body<{ career_id?: string }>(request);
    const career = getDb().careers.find((c) => c.career_id === input.career_id);
    if (!career) return err(400, 'INVALID_INPUT', 'career_id must reference an existing career.');
    const dup = getDb().careerPlans.find(
      (x) => x.student_id === s.student_id && x.career_id === career.career_id,
    );
    if (dup) return err(409, 'ALREADY_PLANNED', 'This career is already in your plan.');
    const steps = buildCareerPlanSteps(career);
    const plan: CareerPlan = {
      plan_id: mockUuid('plan'),
      student_id: s.student_id,
      career_id: career.career_id,
      created_at: new Date().toISOString(),
      steps,
    };
    getDb().careerPlans.push(plan);
    // Push the five steps onto the student's dashboard timeline.
    steps.forEach((st) => {
      getDb().planActions.push({
        action_id: mockUuid('act'),
        student_id: s.student_id,
        pathway: 'career',
        title_en: `${career.title_en}: ${st.title_en}`,
        title_es: `${career.title_es}: ${st.title_es}`,
        due_date: st.target_date,
        status: 'todo',
        origin: 'system',
        created_at: new Date().toISOString(),
      });
    });
    return HttpResponse.json(plan, { status: 201 });
  }),

  /* ============ COUNSELOR REQUESTS (additions) ======================== */
  http.get(`${BASE}/students/:studentId/counselor-requests`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s)) return forbidden();
    const rows = getDb()
      .counselorRequests.filter((x) => x.student_id === s.student_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/counselor-requests`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const input = await body<{ topic?: string; career_id?: string; posting_id?: string; body?: string }>(request);
    if (!input.body?.trim())
      return err(400, 'INVALID_INPUT', 'body is required — tell your counselor what you need.');
    const req: CounselorRequest = {
      request_id: mockUuid('req'),
      student_id: s.student_id,
      topic: input.topic ?? 'career',
      career_id: input.career_id ?? null,
      posting_id: input.posting_id ?? null,
      body: input.body.trim(),
      status: 'replied',
      created_at: new Date().toISOString(),
    };
    getDb().counselorRequests.push(req);
    // Mock: the counselor replies right away so the student sees the loop close.
    const career = input.career_id ? getDb().careers.find((c) => c.career_id === input.career_id) : null;
    getDb().messages.push({
      message_id: mockUuid('msg'),
      student_id: s.student_id,
      from_name: 'Ms. Delgado, Counselor (sample)',
      from_role: 'counselor',
      body_en: career
        ? `Got your note about ${career.title_en}. Come by the advising window Tuesday after school and we will look at funding together. (sample)`
        : 'Got your note — come by the advising window Tuesday after school and we will talk it through. (sample)',
      body_es: career
        ? `Recibí tu mensaje sobre ${career.title_es}. Ven a la ventanilla de asesoría el martes después de clases y vemos los apoyos juntos. (muestra)`
        : 'Recibí tu mensaje — ven a la ventanilla de asesoría el martes después de clases y lo platicamos. (muestra)',
      sent_at: new Date().toISOString(),
      read_at: null,
    });
    return HttpResponse.json(req, { status: 201 });
  }),

  /* ============ COLLEGE PATHWAY (Prompt 4 additions) =================== */
  http.get(`${BASE}/students/:studentId/college-fits`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const ctx = matchContextFor(s.student_id);
    const url = new URL(request.url);
    const gender = url.searchParams.get('gender') ?? s.gender ?? null;
    const data = getDb().colleges.map((c) => {
      const why_en: string[] = [];
      const why_es: string[] = [];
      const missing_en: string[] = [];
      const missing_es: string[] = [];
      let score = 0;
      const gpa_ok: boolean | null =
        ctx.gpa == null || c.min_gpa == null ? null : ctx.gpa >= c.min_gpa;
      if (gpa_ok === true) {
        score += 3;
        why_en.push(`Your grades (${ctx.gpa!.toFixed(1)}) clear their ${c.min_gpa} guideline`);
        why_es.push(`Tu promedio (${ctx.gpa!.toFixed(1)}) supera su guía de ${c.min_gpa}`);
      } else if (gpa_ok === false) {
        score -= 2;
        missing_en.push(`Their guideline is a ${c.min_gpa} GPA — talk to your counselor about options`);
        missing_es.push(`Su guía es un promedio de ${c.min_gpa} — habla con tu consejero sobre opciones`);
      }
      if (c.in_rgv && ctx.open_to.includes('rgv')) {
        score += 2;
        why_en.push('You said you want to stay in the Valley');
        why_es.push('Dijiste que quieres quedarte en el Valle');
      }
      const countryMap: Record<string, string[]> = { texas: ['US'], us: ['US'], mexico: ['MX'], spain: ['ES'], other_country: ['OTHER'] };
      const okCountries = ctx.open_to.flatMap((o) => countryMap[o] ?? []);
      if (okCountries.includes(c.country)) {
        score += 2;
        why_en.push(
          c.country === 'US' ? 'In the US, where you said you are open to study'
          : c.country === 'MX' ? 'In Mexico, which you told the Compass interests you'
          : c.country === 'ES' ? 'In Spain — you said you are open to it'
          : 'Abroad, which you said you would consider',
        );
        why_es.push(
          c.country === 'US' ? 'En EE. UU., donde dijiste que estás abierto a estudiar'
          : c.country === 'MX' ? 'En México, que le dijiste al Compass que te interesa'
          : c.country === 'ES' ? 'En España — dijiste que estás abierto'
          : 'En el extranjero, que dijiste que considerarías',
        );
      }
      if (c.soccer_program !== 'none' && ctx.has_athletic_soccer) {
        const genderOk =
          c.soccer_program === 'both' ||
          (c.soccer_program === 'womens' && gender === 'female') ||
          (c.soccer_program === 'mens' && gender !== 'female');
        if (genderOk) {
          score += 2;
          why_en.push(`Has your sport (${c.soccer_level ?? 'college soccer, sample'})`);
          why_es.push(`Tiene tu deporte (${c.soccer_level ?? 'fútbol universitario, muestra'})`);
        }
      }
      if (c.racing_partner) {
        score += 1;
        why_en.push('Linked to the Racing de Santander partnership (sample)');
        why_es.push('Vinculada a la alianza con Racing de Santander (muestra)');
      }
      if (c.spanish_support && (s.primary_language ?? '').toLowerCase().includes('spanish')) {
        score += 1;
        why_en.push('Spanish-language support on campus');
        why_es.push('Apoyo en español en el campus');
      }
      const fit = score >= 6 ? 'strong' : score >= 3 ? 'good' : 'explore';
      return {
        college_id: c.college_id,
        fit,
        gpa_ok,
        why_en,
        why_es,
        missing_en,
        missing_es,
        grades_source: ctx.grades_source,
      };
    });
    return HttpResponse.json({ data });
  }),

  /* Scholarship outcomes (scholarship_outcomes SQL) */
  http.get(`${BASE}/students/:studentId/scholarship-outcomes`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const rows = getDb()
      .scholarshipOutcomes.filter((x) => x.student_id === s.student_id)
      .map((x) => ({ ...x, scholarship: getDb().scholarships.find((y) => y.scholarship_id === x.scholarship_id) }));
    return HttpResponse.json({ data: rows });
  }),

  /* Recommendation letters — modeled inside materials_checklist on the
   * application (SQL JSONB), surfaced as a first-class action. */
  http.post(`${BASE}/students/:studentId/scholarship-applications/:appId/recommendations`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const a = getDb().scholarshipApplications.find(
      (x) => x.application_id === params.appId && x.student_id === s.student_id,
    );
    if (!a) return notFound('Application');
    const input = await body<{ recommender_name?: string }>(request);
    if (!input.recommender_name?.trim())
      return err(400, 'INVALID_INPUT', 'recommender_name is required (e.g. "Coach Ramírez").');
    const mc = (a.materials_checklist ?? {}) as Record<string, unknown>;
    const recs = (mc.recommendation_letters ?? { requested: 0, received: 0, names: [] }) as {
      requested: number; received: number; names: string[];
    };
    recs.requested += 1;
    recs.names = [...(recs.names ?? []), input.recommender_name.trim()];
    mc.recommendation_letters = recs;
    a.materials_checklist = mc;
    return HttpResponse.json(a);
  }),

  http.post(`${BASE}/students/:studentId/scholarship-applications/:appId/recommendations/:name/received`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s)) return forbidden();
    const a = getDb().scholarshipApplications.find(
      (x) => x.application_id === params.appId && x.student_id === s.student_id,
    );
    if (!a) return notFound('Application');
    const mc = (a.materials_checklist ?? {}) as Record<string, unknown>;
    const recs = (mc.recommendation_letters ?? { requested: 0, received: 0, names: [] }) as {
      requested: number; received: number; names: string[];
    };
    recs.received = Math.min(recs.requested, recs.received + 1);
    mc.recommendation_letters = recs;
    a.materials_checklist = mc;
    return HttpResponse.json(a);
  }),

  /* Decision outcome → feeds scholarship_outcomes (SQL) */
  http.post(`${BASE}/students/:studentId/scholarship-applications/:appId/outcome`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s)) return forbidden();
    const a = getDb().scholarshipApplications.find(
      (x) => x.application_id === params.appId && x.student_id === s.student_id,
    );
    if (!a) return notFound('Application');
    const input = await body<{ awarded?: boolean; award_amount?: number; decision_date?: string }>(request);
    if (input.awarded === undefined)
      return err(400, 'INVALID_INPUT', 'awarded (boolean) is required.');
    if (!['submitted', 'under_review', 'finalist', 'waitlisted'].includes(a.status))
      return err(409, 'NOT_DECIDABLE', 'Only submitted applications can record a decision.');
    const now = new Date().toISOString().slice(0, 10);
    a.status = input.awarded ? 'awarded' : 'denied';
    a.outcome = input.awarded ? 'awarded' : 'denied';
    a.decision_date = input.decision_date ?? now;
    if (input.awarded) a.award_amount = input.award_amount ?? null;
    const outcome = {
      outcome_id: mockUuid('out'),
      application_id: a.application_id,
      student_id: s.student_id,
      scholarship_id: a.scholarship_id,
      awarded: input.awarded,
      award_year: new Date(a.decision_date).getFullYear(),
      award_amount: input.awarded ? input.award_amount ?? null : null,
      decision_date: a.decision_date,
      notes: null,
    };
    getDb().scholarshipOutcomes.push(outcome);
    return HttpResponse.json(outcome, { status: 201 });
  }),

  /* Essay helper — standalone (not tied to an application) */
  http.get(`${BASE}/students/:studentId/essay-drafts`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    const rows = getDb().essayTemplates.filter((x) => x.student_id === s.student_id && !x.application_id);
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/essay-drafts`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (me.role !== 'student' || me.student_id !== s.student_id) return forbidden();
    const input = await body<{ prompt_text?: string; word_limit?: number; start_with_story?: boolean }>(request);
    if (!input.prompt_text?.trim()) return err(400, 'INVALID_INPUT', 'prompt_text is required.');
    const story = getDb().stories.find((x) => x.student_id === s.student_id);
    const tpl = {
      template_id: mockUuid('essay'),
      application_id: null,
      student_id: s.student_id,
      scholarship_id: '',
      prompt_text: input.prompt_text.trim(),
      word_limit: input.word_limit ?? 500,
      ai_generated_draft: null, // AI assist – connected later
      student_draft: input.start_with_story && story ? story.text : null,
      edit_count: 0,
      reviewed_by_counselor: false,
      submitted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    getDb().essayTemplates.push(tpl);
    return HttpResponse.json(tpl, { status: 201 });
  }),

  http.patch(`${BASE}/students/:studentId/essay-drafts/:templateId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (me.role !== 'student' || me.student_id !== s.student_id) return forbidden();
    const t = getDb().essayTemplates.find(
      (x) => x.template_id === params.templateId && x.student_id === s.student_id && !x.application_id,
    );
    if (!t) return notFound('Essay draft');
    const input = await body<{ student_draft?: string; finalized?: boolean }>(request);
    if (input.student_draft !== undefined) {
      t.student_draft = input.student_draft;
      t.edit_count = (t.edit_count ?? 0) + 1;
    }
    if (input.finalized) {
      t.final_version = t.student_draft ?? null;
      t.finalized_at = new Date().toISOString();
    }
    t.updated_at = new Date().toISOString();
    return HttpResponse.json(t);
  }),

  /* Financial aid helper — parent-only. DEMO ONLY: the mock accepts the
   * checklist and discards it; nothing about income is ever stored. */
  http.post(`${BASE}/students/:studentId/financial-aid-helper`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    const isParentOfChild = me.role === 'parent' && (me.child_ids ?? []).includes(s.student_id);
    if (!isParentOfChild && me.role !== 'admin') return forbidden();
    return HttpResponse.json({ ok: true, demo_only: true, stored: false });
  }),

  /* ============== STAFF / PARENT / PARTNER / ADMIN (Prompt 6) ========== */

  /** Coach/counselor caseload — aggregated per student. */
  http.get(`${BASE}/staff/caseload`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (!['coach', 'club_staff', 'admin'].includes(me.role)) return forbidden();
    return HttpResponse.json({ data: buildCaseload() });
  }),

  /** Staff notes on a student. */
  http.get(`${BASE}/students/:studentId/staff-notes`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner' || me.role === 'student') return forbidden();
    const rows = getDb()
      .staffNotes.filter((n) => n.student_id === s.student_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/students/:studentId/staff-notes`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (!['coach', 'club_staff', 'admin'].includes(me.role)) return forbidden();
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    const input = await body<{ body?: string }>(request);
    if (!input.body?.trim()) return err(400, 'INVALID_INPUT', 'body is required.');
    const note: StaffNote = {
      note_id: mockUuid('note'),
      student_id: s.student_id,
      author_name: me.display_name ?? 'Staff (demo)',
      author_role: me.role as StaffNote['author_role'],
      body: input.body.trim(),
      created_at: new Date().toISOString(),
    };
    getDb().staffNotes.push(note);
    return HttpResponse.json(note, { status: 201 });
  }),

  /** Endorse a player (coach endorsement on the recruiting profile). */
  http.post(`${BASE}/students/:studentId/endorsements`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (!['coach', 'club_staff', 'admin'].includes(me.role)) return forbidden();
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    const input = await body<{ text_en?: string; coach_org?: string }>(request);
    if (!input.text_en?.trim()) return err(400, 'INVALID_INPUT', 'text_en is required.');
    const endorsement = {
      endorsement_id: mockUuid('end'),
      student_id: s.student_id,
      coach_name: me.display_name ?? 'Coach (demo)',
      coach_org: input.coach_org ?? 'FC Brownsville (sample)',
      text_en: input.text_en.trim(),
      text_es: null,
      created_at: new Date().toISOString(),
    };
    getDb().endorsements.push(endorsement);
    return HttpResponse.json(endorsement, { status: 201 });
  }),

  /** Verify an uploaded transcript/report card (staff only). */
  http.patch(`${BASE}/students/:studentId/documents/:documentId/verify`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (!['coach', 'club_staff', 'admin'].includes(me.role)) return forbidden();
    const doc = getDb().documents.find(
      (d) => d.document_id === params.documentId && d.student_id === params.studentId,
    );
    if (!doc) return notFound('Document');
    Object.assign(doc, {
      verified_at: new Date().toISOString(),
      verified_by: me.display_name ?? 'Staff (demo)',
    });
    // Verified transcripts upgrade the grade source for matching.
    if (doc.kind === 'report_card') {
      const recs = getDb().academicRecords.filter((r) => r.student_id === doc.student_id);
      recs.forEach((r) => {
        r.source_system = 'report_card';
      });
    }
    return HttpResponse.json(doc);
  }),

  /** Bulk message to a caseload (EN/ES templates, staff only). */
  http.post(`${BASE}/staff/bulk-messages`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (!['coach', 'club_staff', 'admin'].includes(me.role)) return forbidden();
    const input = await body<{ student_ids?: string[]; body_en?: string; body_es?: string }>(request);
    if (!input.student_ids?.length || !input.body_en?.trim()) {
      return err(400, 'INVALID_INPUT', 'student_ids and body_en are required.');
    }
    const db = getDb();
    let sent = 0;
    for (const sid of input.student_ids) {
      const s = findStudent(sid);
      if (!s) continue;
      db.messages.push({
        message_id: mockUuid('msg'),
        student_id: sid,
        from_name: me.display_name ?? 'Coach (demo)',
        from_role: me.role === 'coach' ? 'coach' : 'counselor',
        body_en: input.body_en.trim(),
        body_es: input.body_es?.trim() || input.body_en.trim(),
        sent_at: new Date().toISOString(),
        read_at: null,
      });
      sent += 1;
    }
    return HttpResponse.json({ sent }, { status: 201 });
  }),

  /** Parent approvals inbox — union of contact requests, pending consents
   *  and signature documents (read model; actions use existing endpoints). */
  http.get(`${BASE}/students/:studentId/approvals`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    if (!canViewStudent(me, s) || me.role === 'partner') return forbidden();
    return HttpResponse.json({ data: buildApprovals(s) });
  }),

  /** Sign a signature document (parent only). */
  http.post(`${BASE}/students/:studentId/signature-docs/:docId/sign`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    const s = findStudent(String(params.studentId));
    if (!s) return notFound('Student');
    const isParentOfChild = me.role === 'parent' && (me.child_ids ?? []).includes(s.student_id);
    if (!isParentOfChild) return forbidden();
    const doc = getDb().signatureDocs.find(
      (d) => d.doc_id === params.docId && d.student_id === s.student_id,
    );
    if (!doc) return notFound('Document');
    doc.status = 'signed';
    doc.signed_by = me.display_name ?? 'Parent (demo)';
    doc.signed_at = new Date().toISOString();
    return HttpResponse.json(doc);
  }),

  /* ------------------------- Partner portal ---------------------------- */

  /** The demo partner's organization. */
  http.get(`${BASE}/partner/me`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (me.role !== 'partner') return forbidden();
    const p = getDb().partners[0];
    return HttpResponse.json(p);
  }),

  /** Partner's own postings. */
  http.get(`${BASE}/partner/postings`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (me.role !== 'partner') return forbidden();
    const partnerId = getDb().partners[0]?.partner_id;
    const rows = getDb().internshipPostings.filter((p) => p.partner_id === partnerId);
    return HttpResponse.json({ data: rows });
  }),

  http.post(`${BASE}/partner/postings`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (me.role !== 'partner') return forbidden();
    const input = await body<Partial<InternshipPosting>>(request);
    if (!input.job_title || !input.location) {
      return err(400, 'INVALID_INPUT', 'job_title and location are required.');
    }
    const posting: InternshipPosting = {
      posting_id: mockUuid('int'),
      partner_id: getDb().partners[0]?.partner_id ?? 'partner-sample-001',
      job_title: input.job_title,
      job_category: input.job_category ?? 'general',
      description: input.description ?? '',
      required_skills: input.required_skills ?? [],
      location: input.location,
      remote_option: input.remote_option ?? false,
      work_schedule: input.work_schedule ?? 'Flexible',
      duration_weeks: input.duration_weeks ?? 8,
      hours_per_week: input.hours_per_week ?? 10,
      start_date: input.start_date ?? new Date().toISOString().slice(0, 10),
      pay_type: input.pay_type ?? 'Hourly',
      pay_rate: input.pay_rate ?? null,
      potential_for_hire: input.potential_for_hire ?? false,
      application_deadline: input.application_deadline ?? '2027-03-01',
      positions_available: input.positions_available ?? 1,
      positions_filled: 0,
      posting_status: 'Open',
      related_career_id: input.related_career_id ?? null,
      sport_schedule_friendly: input.sport_schedule_friendly ?? false,
      is_sample: true,
    } as InternshipPosting;
    getDb().internshipPostings.push(posting);
    return HttpResponse.json(posting, { status: 201 });
  }),

  http.patch(`${BASE}/partner/postings/:postingId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (me.role !== 'partner') return forbidden();
    const p = getDb().internshipPostings.find((x) => x.posting_id === params.postingId);
    if (!p) return notFound('Posting');
    const input = await body<Partial<InternshipPosting>>(request);
    Object.assign(p, input, { posting_id: p.posting_id, partner_id: p.partner_id });
    return HttpResponse.json(p);
  }),

  /** Applicants to the partner's postings (student-safe view). */
  http.get(`${BASE}/partner/applicants`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (me.role !== 'partner') return forbidden();
    const db = getDb();
    const partnerId = db.partners[0]?.partner_id;
    const postingIds = db.internshipPostings.filter((p) => p.partner_id === partnerId).map((p) => p.posting_id);
    const rows = db.internshipApplications
      .filter((a) => postingIds.includes(a.posting_id))
      .map((a) => {
        const s = db.students.find((x) => x.student_id === a.student_id);
        const posting = db.internshipPostings.find((p) => p.posting_id === a.posting_id);
        return {
          application_id: a.application_id,
          posting_id: a.posting_id,
          posting_title: posting?.job_title ?? a.posting_id,
          student_display: s ? `${s.first_name} ${(s.last_name ?? '').slice(0, 1)}.` : '—',
          status: a.status,
          applied_at: a.application_date,
        };
      });
    return HttpResponse.json({ data: rows });
  }),

  /** Partner's placements (student-safe subset). */
  http.get(`${BASE}/partner/placements`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (me.role !== 'partner') return forbidden();
    const partnerId = getDb().partners[0]?.partner_id;
    const rows = getDb().placements.filter((p) => p.partner_id === partnerId);
    return HttpResponse.json({ data: rows });
  }),

  /* ------------------- Admin outcomes + content CMS -------------------- */

  /** Aggregate outcomes dashboard — never names. */
  http.get(`${BASE}/admin/outcomes`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (!['admin', 'club_staff'].includes(me.role)) return forbidden();
    const url = new URL(request.url);
    return HttpResponse.json(
      buildOutcomes({
        school: url.searchParams.get('school'),
        grade: url.searchParams.get('grade'),
        year: url.searchParams.get('year'),
      }),
    );
  }),

  /** Content management — add/edit catalog records (admin only). */
  http.post(`${BASE}/admin/content/:collection`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (me.role !== 'admin') return forbidden();
    return upsertContent(String(params.collection), await body<Record<string, unknown>>(request), me, null);
  }),

  http.patch(`${BASE}/admin/content/:collection/:recordId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = parseToken(request)!;
    if (me.role !== 'admin') return forbidden();
    return upsertContent(
      String(params.collection),
      await body<Record<string, unknown>>(request),
      me,
      String(params.recordId),
    );
  }),

  /* ================= TALENT INSIGHTS (Prompt 6B) =================
   * Club staff ONLY — players, parents, partners, scouts and even admins
   * get a 403. Every player-level response is filtered by the
   * club_player_development consent, and every view is logged. */

  http.get(`${BASE}/talent/players`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = requireClubStaff(request);
    if (me instanceof Response) return me;
    logTalentView(me, null, null, 'board');
    return HttpResponse.json({
      players: talentSummaries(),
      consent_off_count: clubPlayerCount() - talentPool().length,
    });
  }),

  http.get(`${BASE}/talent/players/:studentId/timeline`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = requireClubStaff(request);
    if (me instanceof Response) return me;
    const db = getDb();
    const s = talentPool().find((x) => x.student_id === params.studentId);
    if (!s) return notFound('Player');
    logTalentView(me, s.student_id, `${s.first_name} ${s.last_name}`, 'player_timeline');
    return HttpResponse.json({
      summary: talentSummaries().find((x) => x.student_id === s.student_id),
      points: db.developmentHistory[s.student_id] ?? [],
    });
  }),

  http.get(`${BASE}/talent/hidden-gems`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = requireClubStaff(request);
    if (me instanceof Response) return me;
    const db = getDb();
    logTalentView(me, null, null, 'hidden_gems');
    const gems: HiddenGem[] = computeHiddenGems(talentSummaries(), db.developmentHistory);
    return HttpResponse.json({ gems });
  }),

  http.get(`${BASE}/talent/tryouts`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = requireClubStaff(request);
    if (me instanceof Response) return me;
    const db = getDb();
    logTalentView(me, null, null, 'tryouts');
    return HttpResponse.json({ players: db.tryoutPlayers });
  }),

  http.post(`${BASE}/talent/tryouts/:tryoutPlayerId/evaluations`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = requireClubStaff(request);
    if (me instanceof Response) return me;
    const db = getDb();
    const tp = db.tryoutPlayers.find((x) => x.tryout_player_id === params.tryoutPlayerId);
    if (!tp) return notFound('Tryout player');
    const input = await body<{
      technical?: number; tactical?: number; physical?: number; mentality?: number; notes?: string;
    }>(request);
    const clamp5 = (n: unknown) => Math.min(5, Math.max(1, Math.round(Number(n) || 1)));
    const ev: TryoutEvaluation = {
      evaluation_id: mockUuid('tev'),
      tryout_player_id: tp.tryout_player_id,
      evaluator_name: me.display_name ?? 'Club staff (sample)',
      technical: clamp5(input.technical),
      tactical: clamp5(input.tactical),
      physical: clamp5(input.physical),
      mentality: clamp5(input.mentality),
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
    };
    tp.evaluations.push(ev);
    Object.assign(tp, flagDisagreement(tp.evaluations));
    logTalentView(me, tp.student_id, `${tp.first_name} ${tp.last_name}`, 'tryout_evaluation');
    return HttpResponse.json(tp, { status: 201 });
  }),

  http.get(`${BASE}/talent/position-profiles`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = requireClubStaff(request);
    if (me instanceof Response) return me;
    return HttpResponse.json({ profiles: getDb().positionProfiles });
  }),

  http.post(`${BASE}/talent/position-profiles`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = requireClubStaff(request);
    if (me instanceof Response) return me;
    const db = getDb();
    const input = await body<{ position?: string; attributes?: PositionProfile['attributes']; notes?: string }>(request);
    if (!input.position?.trim() || !input.attributes?.length)
      return err(400, 'VALIDATION', 'position and at least one attribute are required.');
    const profile: PositionProfile = {
      profile_id: mockUuid('pp'),
      position: input.position.trim(),
      attributes: input.attributes,
      notes: input.notes ?? null,
      created_by: me.display_name ?? 'Club staff (sample)',
      updated_at: new Date().toISOString(),
    };
    db.positionProfiles.push(profile);
    return HttpResponse.json(profile, { status: 201 });
  }),

  http.patch(`${BASE}/talent/position-profiles/:profileId`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = requireClubStaff(request);
    if (me instanceof Response) return me;
    const db = getDb();
    const profile = db.positionProfiles.find((x) => x.profile_id === params.profileId);
    if (!profile) return notFound('Position profile');
    const input = await body<{ position?: string; attributes?: PositionProfile['attributes']; notes?: string }>(request);
    if (input.position !== undefined) profile.position = input.position;
    if (input.attributes !== undefined) profile.attributes = input.attributes;
    if (input.notes !== undefined) profile.notes = input.notes;
    profile.updated_at = new Date().toISOString();
    return HttpResponse.json(profile);
  }),

  http.get(`${BASE}/talent/position-profiles/:profileId/fits`, async ({ request, params }) => {
    const g = await guard(request);
    if (g) return g;
    const me = requireClubStaff(request);
    if (me instanceof Response) return me;
    const db = getDb();
    const profile = db.positionProfiles.find((x) => x.profile_id === params.profileId);
    if (!profile) return notFound('Position profile');
    logTalentView(me, null, null, 'position_fits');
    const fits: PositionFit[] = talentSummaries()
      .map((p) => {
        const { fit_score, top_matches } = computeFit(p, db.physicalProfiles[p.student_id], profile);
        return {
          player: p,
          fit_score,
          plays_elsewhere:
            !!p.primary_position && p.primary_position.toLowerCase() !== profile.position.toLowerCase(),
          top_matches,
        };
      })
      .sort((a, b) => b.fit_score - a.fit_score);
    return HttpResponse.json({ fits });
  }),

  http.get(`${BASE}/talent/fairness`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = requireClubStaff(request);
    if (me instanceof Response) return me;
    logTalentView(me, null, null, 'fairness');
    return HttpResponse.json(buildFairness());
  }),

  http.get(`${BASE}/talent/audit`, async ({ request }) => {
    const g = await guard(request);
    if (g) return g;
    const me = requireClubStaff(request);
    if (me instanceof Response) return me;
    return HttpResponse.json({ entries: getDb().talentViewLog.slice(-50).reverse() });
  }),
]

/* -------------------- Talent Insights helpers (P6B) -------------------- */

/** Club staff only — decision support for FC Brownsville coaches. */
function requireClubStaff(request: Request): TokenPayload | Response {
  const me = parseToken(request);
  if (!me) return unauthorized();
  if (me.role !== 'club_staff') return forbidden();
  return me;
}

/** Registered with FC Brownsville or attended an FC Brownsville tryout. */
function isClubPlayer(s: AppStudent): boolean {
  const db = getDb();
  const team = db.athleticProfiles.find((a) => a.student_id === s.student_id)?.team_name ?? '';
  if (team.includes('FC Brownsville')) return true;
  return db.tryoutPlayers.some((tp) => tp.student_id === s.student_id);
}

function clubPlayerCount(): number {
  return getDb().students.filter(isClubPlayer).length;
}

/** The ONLY players Talent Insights may touch: club players whose parent
 *  (or the player, if 18+) granted club_player_development consent. */
function talentPool(): AppStudent[] {
  const db = getDb();
  return db.students.filter((s) => {
    if (!isClubPlayer(s)) return false;
    if (!db.developmentHistory[s.student_id]) return false; // no data to show yet
    const c = db.consents.find((x) => x.student_id === s.student_id);
    return !!c?.consents.club_player_development?.granted;
  });
}

function talentSummaries(): TalentPlayerSummary[] {
  const db = getDb();
  return talentPool().map((s) =>
    computeSummary(
      s,
      db.athleticProfiles.find((a) => a.student_id === s.student_id),
      db.developmentHistory[s.student_id] ?? [],
    ),
  );
}

function logTalentView(
  me: TokenPayload,
  studentId: string | null,
  playerName: string | null,
  view: string,
): void {
  const db = getDb();
  db.talentViewLog.push({
    log_id: mockUuid('tvl'),
    viewer_name: me.display_name ?? me.email,
    viewer_role: me.role,
    student_id: studentId,
    player_name: playerName,
    view,
    viewed_at: new Date().toISOString(),
  });
  if (db.talentViewLog.length > 200) db.talentViewLog.splice(0, db.talentViewLog.length - 200);
}

/** Fairness check — who is selected for top (Academy) teams, by group. */
function buildFairness(): FairnessReport {
  const pool = talentSummaries();
  const isSelected = (p: TalentPlayerSummary) => p.team_level === 'Academy';
  const mk = (label: string, members: TalentPlayerSummary[]) => {
    const selected = members.filter(isSelected).length;
    return { label, selected, pool: members.length, rate: members.length ? Math.round((selected / members.length) * 100) / 100 : null };
  };
  const quarters = [1, 2, 3, 4] as const;
  const zips = [...new Set(pool.map((p) => p.zip_code ?? '—'))].sort();
  return {
    by_birth_quarter: quarters.map((q) => mk(`q${q}`, pool.filter((p) => p.birth_quarter === q))),
    by_gender: [
      mk('boys', pool.filter((p) => p.gender === 'Male')),
      mk('girls', pool.filter((p) => p.gender === 'Female')),
    ],
    by_zip: zips.map((z) => mk(z, pool.filter((p) => (p.zip_code ?? '—') === z))),
    selected_definition: 'talentPage.selectedDef',
  };
}

interface AcademicRecordInput {
  school_year: string;
  semester: string;
  course_name: string;
}
