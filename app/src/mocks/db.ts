/**
 * In-memory database for the mock API. Seeded from sample_students.json,
 * mutated by requests during the session, wiped on reload. The Admin role
 * exposes a "Reset demo data" button that calls resetDb() and re-seeds.
 */
import { buildSeed } from './seed';
import { seedCareers, seedEvents, seedMessages } from './catalog';
import { seedPartners, seedPostings } from './careers';
import {
  seedAchievements,
  seedEndorsements,
  seedOpportunities,
  seedPerformanceTimeline,
  seedSportsMedia,
} from './sports';
import {
  seedDocuments,
  seedEnrollments,
  seedPlacements,
  seedSignatureDocs,
  seedStaffNotes,
  stampVerification,
} from './staff';
import {
  grantTalentConsent,
  seedDevelopmentHistory,
  seedPhysicalProfiles,
  seedPositionProfiles,
  seedTryoutPlayers,
  type PhysicalProfile,
} from './talent';
import {
  computeMatch,
  seedCollegesFull,
  seedScholarshipApplicationsFull,
  seedScholarshipOutcomesFull,
  seedScholarshipsFull,
  type StudentMatchContext,
} from './colleges';
import { DEMO_PERSONA_IDS } from '../api/personas';
import type {
  AcademicRecord,
  AppStudent,
  AthleticProfile,
  Career,
  CareerInterest,
  CareerPlan,
  CoachEndorsement,
  College,
  CollegeEnrollment,
  ConsentRecord,
  ContactRequest,
  CorporatePartner,
  CounselorRequest,
  Deadline,
  DevelopmentPoint,
  EssayTemplate,
  PositionProfile,
  TalentViewLogEntry,
  TryoutPlayer,
  InternshipApplication,
  InternshipPosting,
  MyStory,
  PerformancePoint,
  PlanAction,
  Racing360Report,
  RecruitingAchievement,
  RecruitmentReel,
  SavedCareer,
  SavedCollege,
  Scholarship,
  ScholarshipApplication,
  ScholarshipMatch,
  ScholarshipOutcome,
  SignatureDoc,
  SportOpportunity,
  StaffNote,
  StudentDocument,
  StudentMessage,
  StudentPlacement,
  TestScore,
  VideoAnalysisResult,
  VideoHighlight,
  VideoUpload,
} from '../api/types';

export interface MockDb {
  students: AppStudent[];
  athleticProfiles: AthleticProfile[];
  academicRecords: AcademicRecord[];
  racing360Reports: Racing360Report[];
  consents: ConsentRecord[];
  scholarships: Scholarship[];
  scholarshipMatches: ScholarshipMatch[];
  scholarshipApplications: ScholarshipApplication[];
  essayTemplates: EssayTemplate[];
  videos: VideoUpload[];
  analyses: VideoAnalysisResult[];
  highlights: VideoHighlight[];
  reels: RecruitmentReel[];
  /* Prompt 2 additions (see openapi_additions.yaml) */
  careers: Career[];
  colleges: College[];
  savedCareers: SavedCareer[];
  savedColleges: SavedCollege[];
  planActions: PlanAction[];
  events: Deadline[];
  messages: StudentMessage[];
  stories: MyStory[];
  scholarshipOutcomes: ScholarshipOutcome[];
  documents: StudentDocument[];
  testScores: TestScore[];
  careerInterests: CareerInterest[];
  /* Prompt 3 additions (career pathway + internships) */
  partners: CorporatePartner[];
  internshipPostings: InternshipPosting[];
  internshipApplications: InternshipApplication[];
  careerPlans: CareerPlan[];
  counselorRequests: CounselorRequest[];
  /* Prompt 5 additions (sports pathway) */
  performanceTimeline: PerformancePoint[];
  opportunities: SportOpportunity[];
  endorsements: CoachEndorsement[];
  achievements: RecruitingAchievement[];
  contactRequests: ContactRequest[];
  /* Prompt 6 additions (staff / partner / admin) */
  staffNotes: StaffNote[];
  placements: StudentPlacement[];
  enrollments: CollegeEnrollment[];
  signatureDocs: SignatureDoc[];
  /* Prompt 6B additions (Talent Insights — club staff only) */
  developmentHistory: Record<string, DevelopmentPoint[]>;
  physicalProfiles: Record<string, PhysicalProfile>;
  tryoutPlayers: TryoutPlayer[];
  positionProfiles: PositionProfile[];
  talentViewLog: TalentViewLogEntry[];
}

let db: MockDb | null = null;

export function getDb(): MockDb {
  if (!db) db = seedDb();
  return db;
}

export function resetDb(): MockDb {
  db = seedDb();
  return db;
}

function seedDb(): MockDb {
  const seed = buildSeed();
  // Prompt 6B — sample players opted in to club player development.
  grantTalentConsent(seed.consents);
  const media = seedSportsMedia();
  const careers = seedCareers();
  const colleges = seedCollegesFull();
  const scholarships = seedScholarshipsFull();
  const opportunities = seedOpportunities();
  // Verification stamps for the admin CMS (Prompt 6).
  stampVerification(careers, colleges, scholarships, opportunities);
  const placements = seedPlacements();
  const partners = seedPartners();
  placements.forEach((p) => {
    p.partner_name = partners.find((x) => x.partner_id === p.partner_id)?.company_name ?? '';
  });
  return {
    ...seed,
    scholarships,
    scholarshipMatches: [],
    scholarshipApplications: seedScholarshipApplicationsFull(),
    essayTemplates: [],
    videos: media.videos,
    analyses: [],
    highlights: media.highlights,
    reels: media.reels,
    careers,
    colleges,
    savedCareers: [],
    savedColleges: [],
    planActions: [],
    events: seedEvents(),
    messages: seedMessages([...DEMO_PERSONA_IDS]),
    stories: [],
    documents: seedDocuments(),
    testScores: [],
    careerInterests: seedCareerInterests(seed),
    partners,
    internshipPostings: seedPostings(),
    internshipApplications: seedInternshipApplications(),
    careerPlans: [],
    counselorRequests: [],
    scholarshipOutcomes: seedScholarshipOutcomesFull(),
    performanceTimeline: seedPerformanceTimeline(),
    opportunities,
    endorsements: seedEndorsements(),
    achievements: seedAchievements(),
    contactRequests: [],
    staffNotes: seedStaffNotes(),
    placements,
    enrollments: seedEnrollments(),
    signatureDocs: seedSignatureDocs(),
    developmentHistory: seedDevelopmentHistory(seed.students),
    physicalProfiles: seedPhysicalProfiles(seed.students),
    tryoutPlayers: seedTryoutPlayers(seed.students),
    positionProfiles: seedPositionProfiles(),
    talentViewLog: [],
  };
}

/** A couple of in-flight applications so the demo shows status tracking. */
function seedInternshipApplications(): InternshipApplication[] {
  return [
    {
      application_id: 'app-sample-001',
      student_id: 'sample-038', // Isaac — warehouse logistics
      posting_id: 'int-sample-001',
      application_date: '2026-10-01T14:20:00.000Z',
      status: 'under_review',
      status_updated_at: '2026-10-04T09:00:00.000Z',
      status_history: [
        { status: 'submitted', timestamp: '2026-10-01T14:20:00.000Z', updated_by: 'student' },
        { status: 'under_review', timestamp: '2026-10-04T09:00:00.000Z', updated_by: 'partner_hr' },
      ],
      application_responses: {
        why_interested: 'I need income soon and I like hands-on work. (sample)',
        availability: 'Weekday evenings and Saturdays',
      },
      counselor_assisted: false,
    },
    {
      application_id: 'app-sample-002',
      student_id: 'sample-121', // Damián — video analysis
      posting_id: 'int-sample-008',
      application_date: '2026-10-03T18:05:00.000Z',
      status: 'submitted',
      status_updated_at: null,
      status_history: [
        { status: 'submitted', timestamp: '2026-10-03T18:05:00.000Z', updated_by: 'student' },
      ],
      application_responses: {
        why_interested: 'I already break down my own match film. (sample)',
        availability: 'Fully flexible',
      },
      counselor_assisted: false,
    },
  ];
}

/** Sample file carries free-text interests; map them onto the SQL
 *  career_interests shape (career_field + 1-5 level, default 3). */
function seedCareerInterests(seed: ReturnType<typeof buildSeed>): CareerInterest[] {
  const out: CareerInterest[] = [];
  for (const s of seed.students) {
    const interests = s.pathway_compass?.interests ?? [];
    interests.forEach((field, i) => {
      out.push({
        interest_id: `${s.student_id}-int-${i}`,
        student_id: s.student_id,
        career_field: field,
        interest_level: 3,
        date_recorded: '2026-02-01',
      });
    });
  }
  return out;
}


/** Deterministic-enough id for mock-created records. */
export function mockUuid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Prompt 4: match generation with grade-source confidence              */
/* ------------------------------------------------------------------ */

/** Where a student's current grades came from (for confidence labels). */
export function gradesSourceFor(studentId: string): { gpa: number | null; source: StudentMatchContext['grades_source'] } {
  const records = getDb().academicRecords.filter((r) => r.student_id === studentId);
  if (records.length === 0) return { gpa: null, source: 'none' };
  const latest = records.slice(-1)[0];
  const src = (latest.source_system ?? 'self').toLowerCase();
  const source: StudentMatchContext['grades_source'] =
    src === 'school_import' || src === 'district' ? 'school_import'
    : src === 'report_card' || src === 'transcript' ? 'report_card'
    : 'self_reported';
  return { gpa: latest.gpa_cumulative ?? null, source };
}

/** Build the matching context from everything the mock knows. */
export function matchContextFor(studentId: string): StudentMatchContext {
  const db = getDb();
  const s = db.students.find((x) => x.student_id === studentId)!;
  const { gpa, source } = gradesSourceFor(studentId);
  const sat = db.testScores.find((t) => t.student_id === studentId && t.test_type === 'SAT');
  return {
    gpa,
    grades_source: source,
    first_generation: s.pathway_compass?.first_generation ?? null,
    hispanic: (s.ethnicity ?? 'Hispanic').toLowerCase().includes('hispanic'),
    county: 'Cameron', // all sample students live in RGV counties; Cameron is the default
    has_athletic_soccer: db.athleticProfiles.some((a) => a.student_id === studentId && /soccer|fútbol|futbol/i.test(a.sport)),
    open_to: s.pathway_compass?.open_to ?? [],
    interests: s.pathway_compass?.interests ?? [],
    has_sat: !!sat,
    sat_total: sat?.sat_total ?? null,
    fafsa_note_seen: false,
  };
}

/** Generate matches for every active scholarship if the student has none
 *  (or refresh them on force). Returns the student's matches. */
export function ensureMatches(studentId: string, forceRefresh = false): void {
  const db = getDb();
  const existing = db.scholarshipMatches.filter((m) => m.student_id === studentId);
  if (existing.length > 0 && !forceRefresh) return;
  if (forceRefresh) db.scholarshipMatches = db.scholarshipMatches.filter((m) => m.student_id !== studentId);
  const ctx = matchContextFor(studentId);
  for (const sch of db.scholarships) {
    if (!sch.active_status) continue;
    const computed = computeMatch(sch, ctx);
    db.scholarshipMatches.push({
      match_id: mockUuid('match'),
      student_id: studentId,
      scholarship_id: sch.scholarship_id,
      ...computed,
    } as ScholarshipMatch);
  }
}
