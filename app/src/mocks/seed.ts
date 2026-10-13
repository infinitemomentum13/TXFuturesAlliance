/**
 * Seed adapter: maps sample_students.json (fictional FC Brownsville roster
 * mirror) onto the DB shapes used by the mock server.
 *
 * The sample file uses its own field names (e.g. `primary_position`,
 * `team`, `level`, academic `{term, gpa, source}`). The mock DB stores the
 * OpenAPI/SQL shapes, so this adapter does the mapping in one place. Only
 * the mock server may import sample data — never a screen.
 */
import rawSample from './sample_students.json';
import type {
  AcademicRecord,
  AppStudent,
  AthleticProfile,
  CompetitiveLevel,
  ConsentKey,
  ConsentRecord,
  ConsentState,
  InterestKey,
  Racing360Report,
} from '../api/types';

/* ---------- Raw sample shapes (as shipped in sample_students.json) ------- */

interface SampleAthletic {
  sport: string;
  primary_position: string | null;
  secondary_position: string | null;
  dominant_foot: 'Left' | 'Right' | 'Both' | null;
  team: string | null;
  level: string | null;
  years_playing: number | null;
}

interface SampleAcademic {
  term: string; // "2025-Fall"
  gpa: number;
  source: 'self_reported' | 'uploaded_verified' | 'school_import_pending';
}

interface SampleRacing360 {
  report_date: string;
  source: string;
  sessions?: number;
  minutes_played?: number;
  sprint_30m_sec?: number;
  technical_rating_1_10?: number;
  tactical_rating_1_10?: number;
  evaluator_comment?: string;
}

interface SampleStudent {
  student_id: string;
  is_sample: true;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string;
  age: number;
  gender: string | null;
  primary_language: string | null;
  email: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  guardian1_name: string | null;
  guardian1_relationship: string | null;
  guardian1_email: string | null;
  enrollment_status: AppStudent['enrollment_status'];
  enrollment_date: string;
  current_grade_level: number | null;
  expected_graduation_year: number | null;
  school_name: string | null;
  coppa_consent_required: boolean;
  data_sharing_consent: Record<ConsentKey, boolean>;
  app_mode: 'explorer' | 'pathways';
  athletic_profiles?: SampleAthletic[];
  academic_records?: SampleAcademic[];
  career_interests?: {
    interests: string[];
    suggested_certificates: string[];
    possible_majors: string[];
  };
  pathway_compass?: {
    income_urgency?: AppStudent['pathway_compass'] extends infer P
      ? P extends { income_urgency?: infer U }
        ? U
        : never
      : never;
    open_to?: Array<'rgv' | 'texas' | 'us' | 'mexico' | 'spain' | 'other_country'>;
    first_generation?: boolean | null;
    completed: boolean;
  };
  racing360_reports?: SampleRacing360[];
}

/* ------------------------------ Mappers --------------------------------- */

const NOW = '2026-10-06T12:00:00.000Z';
/** Demo consent history date for the 8 sample students who have consents on. */
const SAMPLE_CONSENT_DATE = '2026-09-01T09:00:00.000Z';

const GRADE_SOURCE_TO_SYSTEM: Record<string, string> = {
  self_reported: 'Manual',
  uploaded_verified: 'Import',
  school_import_pending: 'Skyward',
};

function mapStudent(s: SampleStudent): AppStudent {
  return {
    student_id: s.student_id,
    first_name: s.first_name,
    last_name: s.last_name,
    preferred_name: s.preferred_name,
    date_of_birth: s.date_of_birth,
    gender: s.gender,
    primary_language: s.primary_language,
    email: s.email,
    address: {
      city: s.city,
      state: s.state,
      zip_code: s.zip_code,
      country: s.country,
    },
    guardians: s.guardian1_name
      ? [
          {
            name: s.guardian1_name,
            relationship: s.guardian1_relationship ?? undefined,
            email: s.guardian1_email ?? undefined,
          },
        ]
      : [],
    enrollment_status: s.enrollment_status,
    enrollment_date: s.enrollment_date,
    current_grade_level: s.current_grade_level,
    expected_graduation_year: s.expected_graduation_year,
    data_consent: {
      ferpa_consent: !s.coppa_consent_required,
      gdpr_consent: false,
      data_sharing: {
        scouts: s.data_sharing_consent.sports_to_pro_clubs,
        colleges: s.data_sharing_consent.sports_to_colleges,
        corporate: s.data_sharing_consent.partner_contact,
      },
    },
    // Additions (see StudentProfileExtras in types.ts)
    app_mode: s.app_mode,
    school_name: s.school_name,
    is_sample: true,
    age: s.age,
    pathway_compass: s.pathway_compass
      ? {
          completed: s.pathway_compass.completed,
          income_urgency: s.pathway_compass.income_urgency ?? null,
          open_to: s.pathway_compass.open_to ?? [],
          first_generation: s.pathway_compass.first_generation ?? null,
          completed_at: s.pathway_compass.completed ? '2026-02-01T10:00:00.000Z' : null,
          // Prompt 2: the sample file keeps interests in career_interests;
          // mirror them into the Compass answers so intake prefills.
          interests: (s.career_interests?.interests ?? []) as InterestKey[],
          sport: s.athletic_profiles?.length
            ? {
                plays: true,
                sport: s.athletic_profiles[0].sport,
                position: s.athletic_profiles[0].primary_position,
                level:
                  s.athletic_profiles[0].level === 'Academy'
                    ? ('fcb_academy' as const)
                    : ('club' as const),
              }
            : null,
          grades: s.academic_records?.length
            ? {
                kind: 'gpa_range' as const,
                gpa_range: (() => {
                  const g =
                    s.academic_records!.reduce((a, r) => a + r.gpa, 0) / s.academic_records!.length;
                  return g < 2 ? 'under_2' : g < 3 ? '2_to_3' : g < 3.5 ? '3_to_35' : '35_plus';
                })() as 'under_2' | '2_to_3' | '3_to_35' | '35_plus',
              }
            : null,
        }
      : { completed: false },
    created_at: NOW,
    updated_at: NOW,
  };
}

function mapAthletic(s: SampleStudent, a: SampleAthletic, idx: number): AthleticProfile {
  const levelMap: Record<string, CompetitiveLevel> = {
    Recreational: 'Recreational',
    Select: 'Select',
    Premier: 'Premier',
    Academy: 'Academy',
    Professional: 'Professional',
    // Sample data level — closest spec value is Select (travel/select teams).
    'Competitive / Travel': 'Select',
  };
  return {
    profile_id: `${s.student_id}-ath-${idx}`,
    student_id: s.student_id,
    sport: a.sport,
    position: a.primary_position,
    secondary_positions: a.secondary_position,
    team_name: a.team,
    years_experience: a.years_playing,
    competitive_level: (a.level && levelMap[a.level]) || 'Recreational',
    dominant_foot: a.dominant_foot,
    start_date: s.enrollment_date,
    active_status: true,
    created_at: NOW,
    updated_at: NOW,
  };
}

function mapAcademic(s: SampleStudent, r: SampleAcademic, idx: number): AcademicRecord {
  const [year, semester] = r.term.split('-');
  const endYear = semester === 'Fall' ? String(Number(year) + 1) : year;
  return {
    record_id: `${s.student_id}-acad-${idx}`,
    student_id: s.student_id,
    school_year: `${year}-${endYear}`,
    semester,
    course_name: 'GPA summary (sample)', // sample file carries term GPA, not courses
    gpa_semester: r.gpa,
    gpa_cumulative: r.gpa,
    source_system: GRADE_SOURCE_TO_SYSTEM[r.source] ?? 'Manual',
    grade_source: r.source,
    sync_timestamp: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

function mapRacing360(s: SampleStudent, r: SampleRacing360, idx: number): Racing360Report {
  return {
    report_id: `${s.student_id}-r360-${idx}`,
    student_id: s.student_id,
    report_date: r.report_date,
    source: r.source,
    file_url: null,
    coach_notes: null,
    metrics: {
      sessions: r.sessions,
      minutes_played: r.minutes_played,
      sprint_30m_sec: r.sprint_30m_sec,
      technical_rating_1_10: r.technical_rating_1_10,
      tactical_rating_1_10: r.tactical_rating_1_10,
      evaluator_comment: r.evaluator_comment,
    },
    created_at: NOW,
  };
}

const CONSENT_KEYS: ConsentKey[] = [
  'grades_for_matching',
  'sports_to_colleges',
  'sports_to_pro_clubs',
  'videos',
  'partner_contact',
  'club_player_development',
];

const CONSENT_LABELS: Record<ConsentKey, string> = {
  grades_for_matching: 'Scholarship matching service',
  sports_to_colleges: 'College coaches',
  sports_to_pro_clubs: 'Professional club scouts',
  videos: 'Highlight video viewers',
  partner_contact: 'Corporate partners',
  club_player_development: 'FC Brownsville player development staff',
};

function mapConsents(s: SampleStudent): ConsentRecord {
  const consents = {} as Record<ConsentKey, ConsentState>;
  // Every switch exists for every student; anything missing in the sample
  // JSON defaults to OFF (Prompt 6B added club_player_development).
  CONSENT_KEYS.forEach((key) => {
    const granted = s.data_sharing_consent[key] ?? false;
    consents[key] = {
      key,
      granted,
      granted_at: granted ? SAMPLE_CONSENT_DATE : null,
      granted_by_role: granted ? 'parent' : null,
    };
  });
  const access_log = (Object.values(consents) as ConsentState[])
    .filter((c) => c.granted)
    .map((c) => ({
      party: CONSENT_LABELS[c.key],
      scope: c.key,
      since: c.granted_at ?? null,
    }));
  return { student_id: s.student_id, consents, access_log, updated_at: NOW };
}

/* ------------------------------ Seed build ------------------------------ */

export interface SeedData {
  students: AppStudent[];
  athleticProfiles: AthleticProfile[];
  academicRecords: AcademicRecord[];
  racing360Reports: Racing360Report[];
  consents: ConsentRecord[];
}

export function buildSeed(): SeedData {
  const raw = rawSample as unknown as { students: SampleStudent[] };
  const students: AppStudent[] = [];
  const athleticProfiles: AthleticProfile[] = [];
  const academicRecords: AcademicRecord[] = [];
  const racing360Reports: Racing360Report[] = [];
  const consents: ConsentRecord[] = [];

  for (const s of raw.students) {
    students.push(mapStudent(s));
    (s.athletic_profiles ?? []).forEach((a, i) => athleticProfiles.push(mapAthletic(s, a, i)));
    (s.academic_records ?? []).forEach((r, i) => academicRecords.push(mapAcademic(s, r, i)));
    (s.racing360_reports ?? []).forEach((r, i) => racing360Reports.push(mapRacing360(s, r, i)));
    consents.push(mapConsents(s));
  }
  return { students, athleticProfiles, academicRecords, racing360Reports, consents };
}
