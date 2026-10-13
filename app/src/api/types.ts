/**
 * TypeScript types for the TX Futures Alliance Pathways app.
 *
 * Types in section A mirror the attached PostgreSQL schemas and the three
 * OpenAPI specs (api_student_service.yaml, api_scholarship_service.yaml,
 * api_video_service.yaml) so the real back end can replace the mock with no
 * screen changes.
 *
 * Types in section B are FRONT-END ADDITIONS for features the specs do not
 * cover yet (certificate careers, Racing 360 reports, consent records,
 * contact requests, colleges, opportunities). They are documented in
 * openapi_additions.yaml and must be reviewed before the real back end is
 * built.
 */

/* ============================== A. FROM SPECS ============================ */

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export type EnrollmentStatus =
  | 'active'
  | 'inactive'
  | 'graduated'
  | 'withdrawn'
  | 'transferred';

export interface StudentAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
}

export interface Guardian {
  name?: string;
  relationship?: string;
  email?: string;
  phone?: string;
}

/** Mirrors Student schema in api_student_service.yaml */
export interface Student {
  student_id: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  preferred_name?: string | null;
  date_of_birth: string; // ISO date
  gender?: string | null;
  ethnicity?: string | null;
  primary_language?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: StudentAddress;
  guardians?: Guardian[];
  enrollment_status: EnrollmentStatus;
  enrollment_date?: string;
  graduation_date?: string | null;
  current_grade_level?: number | null;
  expected_graduation_year?: number | null;
  school_district_id?: string | null;
  current_school_id?: string | null;
  profile_photo_url?: string | null;
  bio?: string | null;
  data_consent?: {
    ferpa_consent?: boolean;
    ferpa_consent_date?: string | null;
    gdpr_consent?: boolean;
    data_sharing?: {
      scouts?: boolean;
      colleges?: boolean;
      corporate?: boolean;
    };
  };
  created_at?: string;
  updated_at?: string;
}

export interface CreateStudentRequest {
  first_name: string;
  last_name: string;
  middle_name?: string;
  preferred_name?: string;
  date_of_birth: string;
  gender?: string;
  ethnicity?: string;
  primary_language?: string;
  email?: string;
  phone?: string;
  guardian_email: string; // required for COPPA if under 13
  enrollment_date?: string;
  current_grade_level?: number;
  school_district_id?: string;
}

export type CourseType = 'Regular' | 'Honors' | 'AP' | 'IB' | 'Dual Credit' | 'Remedial';
export type LetterGrade =
  | 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-'
  | 'D+' | 'D' | 'D-' | 'F' | 'P' | 'I' | 'W';

/** Mirrors AcademicRecord schema */
export interface AcademicRecord {
  record_id: string;
  student_id: string;
  school_year: string; // "2024-2025"
  semester: string; // "Fall" | "Spring" | ...
  course_id?: string | null;
  course_name: string;
  course_code?: string | null;
  course_type?: CourseType | null;
  department?: string | null;
  credit_hours?: number | null;
  letter_grade?: LetterGrade | null;
  numeric_grade?: number | null;
  grade_points?: number | null;
  passing?: boolean | null;
  gpa_semester?: number | null;
  gpa_cumulative?: number | null;
  attendance_rate?: number | null;
  teacher_name?: string | null;
  source_system: string; // "Skyward" | "Manual" | "Import"
  sync_timestamp?: string | null;
  created_at?: string;
  updated_at?: string;
  /**
   * ADDITION (not in spec): grade provenance so the UI can label
   * "Based on self-reported grades". Suggested column on
   * academic_records: grade_source VARCHAR.
   */
  grade_source?: AcademicGradeSource;
}

export interface AcademicRecordsResponse {
  data: AcademicRecord[];
  summary?: {
    current_gpa?: number | null;
    total_credits?: number | null;
    attendance_rate?: number | null;
  };
}

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';
export type CompetitiveLevel =
  | 'Recreational'
  | 'Select'
  | 'Premier'
  | 'Academy'
  | 'Professional';

/** Mirrors AthleticProfile schema */
export interface AthleticProfile {
  profile_id: string;
  student_id: string;
  sport: string;
  position?: string | null;
  secondary_positions?: string | null;
  team_name?: string | null;
  jersey_number?: string | null;
  years_experience?: number | null;
  skill_level?: SkillLevel | null;
  competitive_level?: CompetitiveLevel | null;
  height_inches?: number | null;
  weight_pounds?: number | null;
  dominant_foot?: 'Left' | 'Right' | 'Both' | null;
  dominant_hand?: string | null;
  start_date: string;
  end_date?: string | null;
  active_status?: boolean;
  overall_rating?: number | null;
  technical_skills_rating?: number | null;
  tactical_awareness_rating?: number | null;
  physical_fitness_rating?: number | null;
  mental_toughness_rating?: number | null;
  strengths?: string | null;
  areas_for_improvement?: string | null;
  coach_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type AwardType = 'One-time' | 'Renewable' | 'Full-ride' | 'Partial';

/** Mirrors Scholarship schema */
export interface Scholarship {
  scholarship_id: string;
  name: string;
  organization: string;
  organization_type?: string | null;
  award_type: AwardType;
  award_amount_min?: number | null;
  award_amount_max?: number | null;
  typical_award_amount?: number | null;
  number_of_awards?: number | null;
  renewable?: boolean;
  max_years_renewable?: number | null;
  application_deadline: string;
  early_deadline?: string | null;
  rolling_admission?: boolean;
  eligibility_criteria?: Record<string, unknown>;
  essay_required?: boolean;
  essay_prompts?: string[];
  recommendations_required?: number;
  transcript_required?: boolean;
  fafsa_required?: boolean;
  application_url?: string | null;
  success_rate?: number | null;
  categories?: string[];
  tags?: string[];
  active_status?: boolean;
  verified_on?: string | null;
  verified_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type MatchApplicationStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'finalist'
  | 'awarded'
  | 'denied'
  | 'withdrawn';

export type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low';

/** Mirrors ScholarshipMatch schema */
export interface ScholarshipMatch {
  match_id: string;
  student_id: string;
  scholarship_id: string;
  scholarship?: Scholarship;
  match_score: number;
  probability_of_award?: number | null;
  match_rationale?: {
    strengths?: string[];
    weaknesses?: string[];
    requirements_met?: number;
    requirements_total?: number;
    competitive_advantages?: string[];
  };
  application_deadline?: string | null;
  days_until_deadline?: number | null;
  priority_level?: PriorityLevel | null;
  application_status?: MatchApplicationStatus;
  viewed_by_student?: boolean;
  bookmarked?: boolean;
  dismissed?: boolean;
  dismissed_reason?: string | null;
  counselor_recommendation?:
    | 'Highly Recommended'
    | 'Recommended'
    | 'Consider'
    | 'Not Recommended'
    | null;
  calculated_at?: string;
  /* Front-end additions (Prompt 4): bilingual, plain-language explanations
   * and grade-source confidence. Real back end may fold these into
   * match_rationale. */
  why_match_en?: string[];
  why_match_es?: string[];
  missing_en?: string[];
  missing_es?: string[];
  grades_source?: GradeSource | 'none';
}

export type ApplicationStatus =
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'finalist'
  | 'interview_scheduled'
  | 'awarded'
  | 'denied'
  | 'waitlisted'
  | 'withdrawn';

export type ApplicationOutcome =
  | 'awarded'
  | 'denied'
  | 'waitlisted'
  | 'withdrawn'
  | 'pending';

/** Mirrors ScholarshipApplication schema */
export interface ScholarshipApplication {
  application_id: string;
  student_id: string;
  scholarship_id: string;
  scholarship?: Scholarship;
  match_id?: string | null;
  started_at?: string;
  submitted_at?: string | null;
  decision_date?: string | null;
  status: ApplicationStatus;
  outcome?: ApplicationOutcome | null;
  award_amount?: number | null;
  award_years?: number | null;
  materials_checklist?: Record<string, unknown>;
  completion_percentage?: number;
  essay_urls?: string[];
  transcript_url?: string | null;
  recommendation_letter_urls?: string[];
  interview_scheduled?: boolean;
  interview_date?: string | null;
  interview_format?: 'In-person' | 'Video' | 'Phone' | 'Written' | null;
  communication_log?: Array<{
    date: string;
    type: string;
    subject?: string;
    content?: string;
  }>;
  assistance_provided?: boolean;
  assistance_type?: string[];
  student_notes?: string | null;
  counselor_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Mirrors EssayTemplate schema */
export interface EssayTemplate {
  template_id: string;
  application_id?: string | null;
  student_id: string;
  scholarship_id: string;
  prompt_text: string;
  word_limit?: number | null;
  ai_generated_draft?: string | null;
  student_draft?: string | null;
  final_version?: string | null;
  finalized_at?: string | null;
  word_count?: number | null;
  edit_count?: number;
  reviewed_by_counselor?: boolean;
  counselor_feedback?: string | null;
  counselor_approved?: boolean;
  submitted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type VideoType =
  | 'full_match'
  | 'highlight_reel'
  | 'drill'
  | 'scrimmage'
  | 'training'
  | 'trial'
  | 'other';
export type VideoPrivacy =
  | 'private'
  | 'team_only'
  | 'scouts_allowed'
  | 'public'
  | 'college_recruiters';
export type ProcessingStatus = 'uploaded' | 'processing' | 'analyzed' | 'failed' | 'ready';

/** Mirrors VideoUpload schema */
export interface VideoUpload {
  video_id: string;
  student_id: string;
  video_type: VideoType;
  sport?: string;
  event_name?: string | null;
  event_date?: string | null;
  event_location?: string | null;
  opponent?: string | null;
  match_result?: string | null;
  upload_date: string;
  uploaded_by?: string | null;
  uploader_role?: string | null;
  original_filename?: string | null;
  file_size_bytes: number;
  file_size_mb?: number;
  duration_seconds?: number | null;
  duration_formatted?: string | null;
  resolution?: string | null;
  frame_rate?: number | null;
  storage_url: string;
  thumbnail_url?: string | null;
  transcoding_status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'not_required';
  transcoded_versions?: Array<{ quality: string; url: string; file_size_mb?: number }>;
  processing_status?: ProcessingStatus;
  privacy_setting?: VideoPrivacy;
  consent_verified?: boolean;
  title?: string | null;
  description?: string | null;
  tags?: string[];
  coach_notes?: string | null;
  student_notes?: string | null;
  video_quality_score?: number | null;
  view_count?: number;
  created_at?: string;
  updated_at?: string;
}

export type AnalysisType =
  | 'player_identification'
  | 'skill_assessment'
  | 'tactical_analysis'
  | 'highlight_detection'
  | 'performance_metrics'
  | 'comparison';

/** Mirrors VideoAnalysisResult schema */
export interface VideoAnalysisResult {
  analysis_id: string;
  video_id: string;
  student_id: string;
  analysis_type: AnalysisType;
  ai_model_name: string;
  ai_model_version?: string | null;
  confidence_score?: number | null;
  processed_at?: string;
  processing_time_seconds?: number | null;
  deployment_location?: string | null;
  analysis_results: Record<string, unknown>;
  detected_events?: Array<{
    event_type?: string;
    timestamp?: string;
    confidence?: number;
    description?: string;
  }>;
  performance_stats?: Record<string, unknown>;
  training_recommendations?: string[];
  reviewed_by_coach?: boolean;
  coach_agreement?: boolean | null;
  coach_notes?: string | null;
  created_at?: string;
}

export type HighlightType =
  | 'goal' | 'assist' | 'save' | 'tackle' | 'pass' | 'dribble' | 'shot'
  | 'header' | 'free_kick' | 'corner_kick' | 'penalty' | 'defensive_play'
  | 'skill_move' | 'other';

/** Mirrors VideoHighlight schema */
export interface VideoHighlight {
  highlight_id: string;
  video_id: string;
  student_id: string;
  analysis_id?: string | null;
  highlight_type: HighlightType;
  start_timestamp: string;
  end_timestamp: string;
  start_seconds?: number | null;
  end_seconds?: number | null;
  duration_seconds?: number;
  auto_detected?: boolean;
  detection_confidence?: number | null;
  manually_tagged?: boolean;
  quality_score?: number | null;
  importance_score?: number | null;
  recruitability_score?: number | null;
  title?: string | null;
  description?: string | null;
  technical_notes?: string | null;
  clip_generated?: boolean;
  clip_storage_url?: string | null;
  clip_thumbnail_url?: string | null;
  tags?: string[];
  showcase_worthy?: boolean;
  student_favorite?: boolean;
  coach_featured?: boolean;
  created_at?: string;
}

export type ReelType =
  | 'general'
  | 'position_specific'
  | 'college_specific'
  | 'pro_trial'
  | 'scholarship_app';
export type ReelStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';

/** Mirrors RecruitmentReel schema */
export interface RecruitmentReel {
  reel_id: string;
  student_id: string;
  reel_name: string;
  reel_type: ReelType;
  target_audience?: string | null;
  specific_target?: string | null;
  included_highlights: string[];
  highlight_count?: number | null;
  total_duration_seconds?: number | null;
  reel_storage_url?: string | null;
  reel_thumbnail_url?: string | null;
  file_size_mb?: number | null;
  resolution?: string | null;
  format?: string | null;
  auto_generated?: boolean;
  generation_date?: string | null;
  share_link?: string | null;
  share_link_active?: boolean;
  share_link_expires_at?: string | null;
  view_count?: number;
  scout_views?: number;
  status?: ReelStatus;
  created_at?: string;
  updated_at?: string;
}

/* ======================= B. FRONT-END ADDITIONS ==========================
 * NOT in the attached SQL schemas / OpenAPI specs. Each is listed in
 * openapi_additions.yaml and must be reviewed before the real back end.
 * ========================================================================= */

/** App mode by age — from sample data ("app_mode"). */
export type AppMode = 'explorer' | 'pathways';

/**
 * Consent Center record. The `students` table has FERPA/COPPA/GDPR columns
 * and a free-form `data_sharing_consent` JSONB; the app needs per-purpose
 * switches with history, so this is a dedicated addition.
 * Suggested table: consent_records (consent_id, student_id, consent_key,
 * granted, granted_at, granted_by_role, revoked_at).
 */
export type ConsentKey =
  | 'grades_for_matching'
  | 'sports_to_colleges'
  | 'sports_to_pro_clubs'
  | 'videos'
  | 'partner_contact'
  | 'club_player_development';

export interface ConsentState {
  key: ConsentKey;
  granted: boolean;
  granted_at?: string | null;
  granted_by_role?: DemoRole | null;
}

export interface ConsentRecord {
  student_id: string;
  consents: Record<ConsentKey, ConsentState>;
  /** Who currently can see what — for the "who has access and since when" list. */
  access_log: Array<{
    party: string; // e.g. "College coaches", "Pro club scouts"
    scope: ConsentKey;
    since: string | null;
  }>;
  updated_at: string;
}

/** Pathway Compass intake answers — new, feeds student profile. */
export type IncomeUrgency =
  | 'right_away'
  | 'within_a_year'
  | 'after_high_school'
  | 'not_a_pressure';

export interface PathwayCompass {
  completed: boolean;
  income_urgency?: IncomeUrgency | null;
  open_to?: Array<'rgv' | 'texas' | 'us' | 'mexico' | 'spain' | 'other_country'>;
  first_generation?: boolean | null;
  completed_at?: string | null;
  /* Prompt 2 additions — the intake collects these too; the sample file only
   * carries the four fields above. */
  interests?: InterestKey[];
  sport?: CompassSport | null;
  grades?: CompassGrades | null;
}

/**
 * Extended profile fields carried by the sample data / front end that the
 * specs' Student schema does not include. Suggested columns on `students`:
 * app_mode VARCHAR, school_name VARCHAR, is_sample BOOLEAN,
 * pathway_compass JSONB.
 */
export interface StudentProfileExtras {
  app_mode?: AppMode;
  school_name?: string | null;
  is_sample?: boolean;
  age?: number;
  pathway_compass?: PathwayCompass;
}

/** Student as the app consumes it: spec fields + additions. */
export type AppStudent = Student & StudentProfileExtras;

/** Grade provenance on academic records (Prompt 4 matching uses the
 *  separate GradeSource type below). */
export type AcademicGradeSource = 'self_reported' | 'uploaded_verified' | 'school_import_pending';

/**
 * Certificate / license career (Pathway 1) — no table in the schemas.
 * Suggested table: careers (career_id, title_en, title_es, ...).
 * Every seeded record is marked sample ("Sample data – to verify").
 */
export interface Career {
  career_id: string;
  title_en: string;
  title_es: string;
  summary_en: string;
  summary_es: string;
  credential: string; // certificate or license
  credential_issuer: string;
  training_length_weeks: number;
  training_cost_usd: number;
  funded_options: string[];
  min_age_train: number;
  min_age_work: number;
  /** Extra clarity when age rules are non-obvious (e.g. CDL 18/21). */
  age_note_en?: string | null;
  age_note_es?: string | null;
  weeks_to_first_paycheck: number;
  starting_pay_rgv_hourly: number; // Sample – to verify
  starting_pay_tx_hourly: number; // Sample – to verify
  career_ladder: string[];
  sector: string;
  /** RGV-relevant sector tags for display (cross-border logistics,
   *  advanced manufacturing, aerospace/space, healthcare, energy…). */
  rgv_sectors: string[];
  training_providers: Array<{ name: string; type: string; location: string }>;
  /** Partner companies hiring for this career (corporate_partners ids). */
  employer_partner_ids: string[];
  /** True when training/shifts commonly fit around a school-sport schedule. */
  sport_friendly: boolean;
  sport_schedule_note_en?: string | null;
  sport_schedule_note_es?: string | null;
  /** How this career connects to the student's sport (sport-linked careers). */
  sport_connection_en?: string | null;
  sport_connection_es?: string | null;
  verified_on?: string | null;
  verified_by?: string | null;
  is_sample: true;
}

/** Student-safe subset of corporate_partners (SQL). Internal fields —
 *  contacts, financials, agreements, ROI — never leave the server. */
export interface CorporatePartner {
  partner_id: string;
  company_name: string;
  industry_sector: string;
  rgv_location: string;
  partnership_tier: string;
  /** Career ids this partner typically hires for. */
  careers_hiring: string[];
  is_sample: true;
}

export type InternshipStatus =
  | 'submitted'
  | 'under_review'
  | 'phone_screen_scheduled'
  | 'interview_scheduled'
  | 'skills_assessment'
  | 'reference_check'
  | 'offered'
  | 'accepted'
  | 'declined'
  | 'rejected'
  | 'withdrawn';

/** Student-facing subset of internship_postings (SQL). Matching internals,
 *  screening internals and application statistics stay server-side. */
export interface InternshipPosting {
  posting_id: string;
  partner_id: string;
  job_title: string;
  job_category: string;
  description: string;
  required_skills: string[];
  required_education?: string | null;
  minimum_gpa?: number | null;
  required_grade_levels?: number[] | null;
  location: string;
  remote_option: boolean;
  work_schedule: string;
  duration_weeks: number;
  hours_per_week: number;
  start_date: string;
  pay_type: 'Hourly' | 'Stipend' | 'Unpaid' | 'Credit Only';
  pay_rate?: number | null;
  potential_for_hire: boolean;
  application_deadline: string;
  positions_available: number;
  positions_filled: number;
  required_documents?: string[];
  posting_status: string;
  /** Front-end addition (not in SQL): link a posting to a catalog career. */
  related_career_id?: string | null;
  /** Front-end addition: flagged by partner as workable around a sport season. */
  sport_schedule_friendly: boolean;
  /** From SQL; used for demo counters only. */
  total_applications?: number;
  /* Joined read-model fields */
  company_name?: string;
  partner_sector?: string;
  is_sample: true;
}

/** Student-facing subset of internship_applications (SQL). */
export interface InternshipApplication {
  application_id: string;
  student_id: string;
  posting_id: string;
  application_date: string;
  status: InternshipStatus;
  status_updated_at: string | null;
  status_history: Array<{ status: InternshipStatus; timestamp: string; updated_by: string }>;
  application_responses?: Record<string, string> | null;
  counselor_assisted: boolean;
  posting?: InternshipPosting;
}

export type CareerPlanStepKey = 'enroll' | 'train' | 'test' | 'certify' | 'apply';

export interface CareerPlanStep {
  step_key: CareerPlanStepKey;
  title_en: string;
  title_es: string;
  detail_en: string;
  detail_es: string;
  target_date: string;
  est_cost_usd: number;
  documents_en: string[];
  documents_es: string[];
}

/** A step-by-step plan for one career (enroll → train → test → certified → apply). */
export interface CareerPlan {
  plan_id: string;
  student_id: string;
  career_id: string;
  created_at: string;
  steps: CareerPlanStep[];
  career?: Career;
}

/** "Talk to my counselor" request — shows up in the counselor caseload. */
export interface CounselorRequest {
  request_id: string;
  student_id: string;
  topic: string;
  career_id?: string | null;
  posting_id?: string | null;
  body: string;
  status: 'sent' | 'replied';
  created_at: string;
}

/**
 * Racing 360 performance report import — field names to confirm with the
 * Racing 360 vendor. Suggested table: racing360_reports
 * (report_id, student_id, report_date, metrics JSONB, source, file_url).
 */
export interface Racing360Report {
  report_id: string;
  student_id: string;
  report_date: string;
  source: string; // "Racing 360 (SAMPLE – field names to confirm)"
  file_url?: string | null;
  coach_notes?: string | null;
  metrics: {
    sessions?: number;
    minutes_played?: number;
    sprint_30m_sec?: number;
    technical_rating_1_10?: number;
    tactical_rating_1_10?: number;
    evaluator_comment?: string;
    [key: string]: unknown; // field names to confirm
  };
  created_at: string;
}

/** Contact request from partner/scout — requires parent approval if under 18. */
export interface ContactRequest {
  request_id: string;
  student_id: string;
  requester_org: string;
  requester_role: 'college' | 'pro_club' | 'employer' | 'training_school';
  message: string;
  status: 'pending_parent' | 'pending_student' | 'approved' | 'declined';
  created_at: string;
}

/* ---------------- Prompt 5 additions (sports pathway) ------------------ */

/**
 * Mirrors player_performance_timeline (video_media_schema.sql).
 * `source` is a front-end addition so the UI can label where each point
 * came from (video analysis, a Racing 360 import, or coach entry).
 */
export interface PerformancePoint {
  timeline_id: string;
  student_id: string;
  assessment_date: string;
  season?: string | null;
  overall_rating?: number | null;
  technical_skills?: number | null;
  tactical_awareness?: number | null;
  physical_fitness?: number | null;
  mental_toughness?: number | null;
  trajectory?: string | null;
  assessment_notes?: string | null;
  coach_observations?: string | null;
  /** Front-end addition — not in the SQL table. */
  source: 'video_analysis' | 'racing360' | 'coach_entry';
  created_at: string;
}

/** Coach endorsement on the recruiting profile — no table in the schemas.
 *  Suggested: coach_endorsements (endorsement_id, student_id, coach_name,
 *  coach_org, text, created_at). Front-end addition. */
export interface CoachEndorsement {
  endorsement_id: string;
  student_id: string;
  coach_name: string;
  coach_org: string;
  text_en: string;
  text_es?: string | null;
  created_at: string;
}

/** Achievement line on the recruiting profile — front-end addition.
 *  Suggested: recruiting_achievements (achievement_id, student_id, text, year). */
export interface RecruitingAchievement {
  achievement_id: string;
  student_id: string;
  text_en: string;
  text_es?: string | null;
  year?: number | null;
}

/**
 * Assembled recruiting "front page" — front-end addition combining
 * athletic_profiles, academic snapshot (consent-gated), achievements,
 * endorsements and video counts. Suggested endpoint:
 * GET /students/{id}/recruiting-profile
 */
export interface RecruitingProfile {
  student_id: string;
  sport: string;
  positions: string[];
  dominant_foot?: string | null;
  dominant_hand?: string | null;
  height_inches?: number | null;
  weight_pounds?: number | null;
  teams: Array<{
    team_name: string;
    competitive_level?: string | null;
    years_experience?: number | null;
  }>;
  grad_year?: number | null;
  skill_level?: string | null;
  /** Present only when the student consented to share grades. */
  academic_snapshot: { gpa_cumulative: number; school_year: string; source: string } | null;
  achievements: RecruitingAchievement[];
  endorsements: CoachEndorsement[];
  video_count: number;
  highlight_count: number;
  is_sample: true;
}

/** Opportunity listing for the three sports lanes — front-end addition.
 *  Suggested: sport_opportunities (opportunity_id, lane, sport, title,
 *  org_name, level, age_min/max, location, dates, cost, requirements). */
export type OpportunityLane = 'college' | 'national' | 'international';

export interface SportOpportunity {
  opportunity_id: string;
  lane: OpportunityLane;
  sport: string;
  title_en: string;
  title_es: string;
  org_name: string;
  level_en: string;
  level_es: string;
  age_min: number;
  age_max: number;
  location_en: string;
  location_es: string;
  country: string;
  dates_en: string;
  dates_es: string;
  cost_usd: number | null;
  cost_note_en?: string | null;
  cost_note_es?: string | null;
  requirements_en: string[];
  requirements_es: string[];
  verified_on?: string | null;
  verified_by?: string | null;
  is_sample: true;
}

/**
 * What a scout sees — front-end addition. Only students who opted in
 * appear at all, and no direct contact info is ever included.
 * First name + last initial only.
 */
export interface ScoutResult {
  student_id: string;
  display_name: string;
  age: number | null;
  grad_year: number | null;
  gender: string | null;
  sport: string;
  positions: string[];
  competitive_level: string | null;
  team_name: string | null;
  height_inches?: number | null;
  overall_rating?: number | null;
  open_to: OpenTo[];
  under_18: boolean;
  is_sample: true;
}

/* ---------------- Prompt 6 additions (staff / partner / admin) --------- */

/**
 * Verification stamp added to catalog records (careers, colleges,
 * scholarships, opportunities) — front-end addition. Suggested columns:
 * verified_on DATE, verified_by VARCHAR on each catalog table.
 * "Needs re-verification" is derived: verified_on older than 6 months.
 */
export interface VerifiedMeta {
  verified_on?: string | null;
  verified_by?: string | null;
}

/** One row of the coach/counselor caseload — aggregated mock-side.
 *  Suggested endpoint: GET /staff/caseload (computed view, no table). */
export interface CaseloadItem {
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level: number | null;
  school_name: string | null;
  app_mode: 'explorer' | 'pathways';
  pathway_status: {
    career: { saved: number; plans: number; applications: number };
    college: { saved: number; applications: number; awarded: number };
    sports: { has_profile: boolean; videos: number; contact_requests: number };
  };
  next_deadline: { title_en: string; title_es: string; date: string; kind: string } | null;
  missing_items: string[]; // i18n keys under staffPage.missing.*
  needs_attention: string[]; // i18n keys under staffPage.flags.*
}

/** Staff note on a student — front-end addition.
 *  Suggested table: staff_notes (note_id, student_id, author_name,
 *  author_role, body, created_at). */
export interface StaffNote {
  note_id: string;
  student_id: string;
  author_name: string;
  author_role: 'coach' | 'club_staff' | 'admin';
  body: string;
  created_at: string;
}

/** Mirrors student_placements SQL table (student-safe subset). */
export interface StudentPlacement {
  placement_id: string;
  student_id: string;
  partner_id: string;
  posting_id?: string | null;
  start_date: string;
  end_date: string;
  actual_end_date?: string | null;
  job_title: string;
  completion_status: 'active' | 'completed' | 'ended_early';
  offered_full_time?: boolean | null;
  accepted_full_time?: boolean | null;
  pay_rate?: number | null;
  partner_name?: string; // embedded for display
}

/** College enrollment record — front-end addition feeding the outcomes
 *  dashboard. Suggested table: college_enrollments (enrollment_id,
 *  student_id, college_id, enrollment_year, status). */
export interface CollegeEnrollment {
  enrollment_id: string;
  student_id: string;
  college_id: string;
  enrollment_year: number;
  status: 'enrolled' | 'attending';
}

/** Document awaiting a parent signature — front-end addition.
 *  Suggested table: signature_documents (doc_id, student_id, title,
 *  status, signed_by, signed_at). */
export interface SignatureDoc {
  doc_id: string;
  student_id: string;
  title_en: string;
  title_es: string;
  status: 'pending' | 'signed';
  signed_by?: string | null;
  signed_at?: string | null;
}

/** One item in the parent approvals inbox — union view, front-end addition.
 *  Actions go through the existing consent / contact-request / signature
 *  endpoints; this is a read model. */
export interface ApprovalItem {
  item_id: string;
  kind: 'contact_request' | 'consent' | 'signature';
  ref_id: string; // request_id / consent key / doc_id
  title_en: string;
  title_es: string;
  detail_en: string;
  detail_es: string;
  status: 'pending' | 'approved' | 'declined' | 'signed' | 'granted';
  created_at: string;
}

/** Aggregate outcomes for grants/sponsors — computed view, never names.
 *  Maps to corporate_partner_analytics + scholarship_outcomes. */
export interface OutcomesReport {
  filters: { school?: string | null; grade?: number | null; year?: number | null };
  students_served: number;
  by_pathway: { career: number; college: number; sports: number };
  certificates_earned: number;
  avg_weeks_to_first_job: number | null;
  scholarships: { applied: number; awarded: number; dollars: number };
  college_enrollments: number;
  athletes_recruited: number;
  placements_by_partner: Array<{
    partner_id: string;
    partner_name: string;
    placements: number;
    completed: number;
    converted_to_full_time: number;
  }>;
  generated_at: string;
}

/** Partner's own applicant row (student-safe). */
export interface PartnerApplicant {
  application_id: string;
  posting_id: string;
  posting_title: string;
  student_display: string; // first name + last initial
  status: string;
  applied_at: string;
}

/* ---------------- Prompt 2 additions (compass, dashboard, profile) ------- */

/** Interest taxonomy used by the Pathway Compass and career matching. */
export type InterestKey =
  | 'hands_on'
  | 'helping_people'
  | 'tech'
  | 'building'
  | 'outdoors'
  | 'business'
  | 'health'
  | 'art'
  | 'sports';

export type OpenTo = 'rgv' | 'texas' | 'us' | 'mexico' | 'spain' | 'other_country';

/** GPA range as self-reported in the Compass (never an exact number). */
export type GpaRange = 'under_2' | '2_to_3' | '3_to_35' | '35_plus';

export interface CompassGrades {
  kind: 'gpa_range' | 'report_card' | 'unknown';
  gpa_range?: GpaRange | null;
  /** File name only — the picker stores no file contents yet. */
  report_card_file_name?: string | null;
}

export type SportLevel = 'school' | 'club' | 'fcb_academy';

export interface CompassSport {
  plays: boolean;
  sport?: string | null;
  position?: string | null;
  level?: SportLevel | null;
}

/**
 * College / university option (Pathway 2) — no table in the schemas.
 * Suggested table: colleges (college_id, name, country, ...).
 * Every seeded record is fictional and marked sample.
 */
export interface College {
  college_id: string;
  name: string;
  type: 'community_college' | 'university' | 'technical_college';
  city: string;
  state_or_region: string;
  country: 'US' | 'MX' | 'ES' | 'OTHER';
  in_rgv: boolean;
  spanish_support: boolean; // Spanish-language programs or support services
  soccer_program: 'mens' | 'womens' | 'both' | 'none';
  /** Athletic association level when there is a program (NCAA D1/D2/D3,
   *  NAIA, NJCAA, Liga MX U, Spanish university league…). Sample values. */
  soccer_level?: string | null;
  /** Annual cost of attendance, USD (sample – to verify). */
  cost_per_year_usd?: number | null;
  /** Typical financial aid a student like ours receives (sample). */
  typical_aid_usd?: number | null;
  /** Language(s) of instruction. */
  language_of_instruction?: string | null;
  admissions_notes_en?: string | null;
  admissions_notes_es?: string | null;
  min_gpa?: number | null;
  /** Soccer scholarships available at this school (sample). */
  soccer_scholarships?: boolean;
  /** Racing de Santander partnership link (Santander pathway). */
  racing_partner?: boolean;
  notes_en?: string | null;
  notes_es?: string | null;
  verified_on?: string | null;
  verified_by?: string | null;
  is_sample: true;
}

/* ---------- Prompt 4: grades source + college matching additions -------- */

/** Where a grade came from. Matching works with any of the three. */
export type GradeSource = 'self_reported' | 'report_card' | 'school_import';

export type CollegeFit = 'strong' | 'good' | 'explore';

/** Computed fit between a student and a school (front-end addition). */
export interface CollegeFitResult {
  college_id: string;
  fit: CollegeFit;
  gpa_ok: boolean | null; // null = no grades on file
  why_en: string[];
  why_es: string[];
  missing_en: string[];
  missing_es: string[];
  /** Confidence in the underlying grades. */
  grades_source: GradeSource | 'none';
}

/* ---------- Prompt 4: scholarship outcomes (scholarship_outcomes SQL) -- */

export interface ScholarshipOutcome {
  outcome_id: string;
  application_id: string;
  student_id: string;
  scholarship_id: string;
  awarded: boolean;
  award_year: number;
  award_amount?: number | null;
  decision_date: string;
  notes?: string | null;
  scholarship?: Scholarship;
}

/* ---------- Prompt 4: essay helper + financial aid helper (additions) -- */

/** One outline section for the essay helper. */
export interface EssayOutlineSection {
  heading_en: string;
  heading_es: string;
  hint_en: string;
  hint_es: string;
}

/** Parent-only FAFSA/TASFA helper — DEMO ONLY, nothing is stored. */
export interface AidHelperState {
  aid_type: 'fafsa' | 'tasfa' | null;
  checked_documents: string[];
  /** true while viewing; never persisted to any storage. */
  demo_only: true;
}

/** Saved items on the student dashboard. Suggested tables: saved_careers, saved_colleges. */
export interface SavedCareer {
  saved_id: string;
  student_id: string;
  career_id: string;
  saved_at: string;
  career?: Career;
}

export interface SavedCollege {
  saved_id: string;
  student_id: string;
  college_id: string;
  saved_at: string;
  college?: College;
}

/**
 * "My Plan" timeline item — one next action with a due date.
 * Suggested table: plan_actions (action_id, student_id, pathway, ...).
 */
export interface PlanAction {
  action_id: string;
  student_id: string;
  pathway: 'career' | 'college' | 'sports';
  title_en: string;
  title_es: string;
  due_date: string | null;
  status: 'todo' | 'done';
  origin: 'system' | 'coach' | 'student';
  created_at: string;
  completed_at?: string | null;
}

/**
 * Upcoming deadline shown on the dashboard — scholarships, tryouts,
 * certificate class start dates. Suggested table: deadlines (or a view
 * unioning scholarship deadlines, partner events and career class starts).
 */
export interface Deadline {
  deadline_id: string;
  kind: 'scholarship' | 'tryout' | 'class_start' | 'application';
  title_en: string;
  title_es: string;
  date: string;
  ref_id?: string | null; // scholarship_id / career_id etc.
}

/** Coach/counselor message on the student dashboard. Suggested table: messages. */
export interface StudentMessage {
  message_id: string;
  student_id: string;
  from_name: string;
  from_role: 'coach' | 'counselor';
  body_en: string;
  body_es: string;
  sent_at: string;
  read_at?: string | null;
}

/**
 * "My Story" — short text the student writes in their own words; reused in
 * scholarship essays and the recruiting profile. Suggested column on
 * students: my_story TEXT.
 */
export interface MyStory {
  student_id: string;
  text: string;
  updated_at: string;
}

/**
 * Student document (report card, certificate earned, award). The picker
 * stores metadata only in this phase — no file bytes.
 * Suggested table: student_documents (document_id, student_id, kind, file_url, ...).
 */
export interface StudentDocument {
  document_id: string;
  student_id: string;
  kind: 'report_card' | 'certificate' | 'award' | 'other';
  file_name: string;
  note?: string | null;
  uploaded_at: string;
  /** Front-end additions (Prompt 6) — counselor transcript verification. */
  verified_at?: string | null;
  verified_by?: string | null;
}

/**
 * Standardized test score — mirrors the standardized_test_scores SQL table,
 * which has no OpenAPI endpoints yet (addition). Only the SAT/ACT/PSAT/TOEFL
 * totals the UI collects; section scores exist in SQL and can be added later.
 */
export interface TestScore {
  score_id: string;
  student_id: string;
  test_type: 'SAT' | 'ACT' | 'PSAT' | 'TOEFL' | 'TSIA2' | 'other';
  test_date: string;
  sat_total?: number | null;
  act_composite?: number | null;
  toefl_total?: number | null;
  score_value?: number | null; // generic fallback for PSAT/TSIA2/other
  created_at: string;
}

/**
 * Career interest — mirrors the career_interests SQL table (career_field +
 * interest_level), which has no OpenAPI endpoints yet (addition). The sample
 * file's string interests map onto career_field with a default level of 3.
 */
export interface CareerInterest {
  interest_id: string;
  student_id: string;
  career_field: string; // InterestKey or free text ("STEM", "Healthcare", ...)
  interest_level: number; // 1-5
  date_recorded: string;
}

/* =============================== AUTH =================================== */

export type DemoRole =
  | 'student'
  | 'parent'
  | 'coach'
  | 'partner'
  | 'club_staff'
  | 'admin';

/** Login response shape from POST /auth/login (api_student_service.yaml). */
export interface LoginResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: {
    user_id: string;
    email: string;
    role: DemoRole;
    student_id?: string;
  };
}

/** Session as exposed by the auth adapter (Supabase-shaped). */
export interface Session {
  access_token: string;
  expires_at: number;
  user: {
    user_id: string;
    email: string;
    role: DemoRole;
    student_id?: string;
    display_name?: string;
    child_ids?: string[];
  };
}

/* =========================================================================
 * TALENT INSIGHTS (Prompt 6B) — ADDITIONS, not in the attached schemas.
 * Club-staff-only decision support for FC Brownsville. Suggested tables in
 * openapi_additions.yaml ("TALENT INSIGHTS (Prompt 6B)"). Every record in
 * this area is gated on BOTH:
 *   1. the player being registered with FC Brownsville or having attended
 *      an FC Brownsville tryout, AND
 *   2. consent key `club_player_development` granted (parent, or player 18+).
 * Nothing here is visible to players, parents, partners or scouts, and
 * every view is written to the view log.
 * ========================================================================= */

/** Standardized 1–10 measures tracked over time on the development board. */
export interface DevelopmentPoint {
  date: string; // ISO date
  source: 'racing360' | 'coach_evaluation' | 'physical_test' | 'match_record';
  /** 1–10 standardized scores; a point may carry only some measures. */
  technical?: number | null;
  tactical?: number | null;
  physical?: number | null;
  mentality?: number | null;
  /** Context measures (percent 0–100) attached to some points. */
  minutes_pct?: number | null;
  attendance_pct?: number | null;
}

/** One row on the Player Development Board. Club staff see names (they are
 *  the player's own club coaches); this never leaves the club staff role. */
export interface TalentPlayerSummary {
  student_id: string;
  first_name: string;
  last_name: string;
  birth_year: number;
  /** 1 = Jan–Mar, 2 = Apr–Jun, 3 = Jul–Sep, 4 = Oct–Dec. */
  birth_quarter: 1 | 2 | 3 | 4;
  gender: string | null;
  zip_code: string | null;
  primary_position: string | null;
  team: string | null;
  team_level: string | null; // Recreational | Competitive / Travel | Academy
  /** Headline: current standardized level (1–10, average of latest scores). */
  current_level: number;
  /** Headline: improvement rate in points per month (last 6 months). */
  improvement_rate: number;
  /** Age-adjusted level — corrects for birth quarter within the birth year. */
  age_adjusted_level: number;
  minutes_pct: number | null;
  attendance_pct: number | null;
  latest_scores: { technical: number; tactical: number; physical: number; mentality: number };
  last_measure_date: string;
}

export interface TalentBoardResponse {
  players: TalentPlayerSummary[];
  /** Players excluded because consent is OFF are never returned — only the count. */
  consent_off_count: number;
}

/** Plain-words explanation for a hidden-gem suggestion (i18n key + params). */
export interface HiddenGemReason {
  key: 'improved_dim' | 'low_minutes' | 'low_team_level' | 'strong_ratings';
  params: Record<string, string | number>;
}

export interface HiddenGem extends TalentPlayerSummary {
  reasons: HiddenGemReason[];
}

/** Fixed tryout rubric — 1–5 per dimension, anchors live in i18n. */
export interface TryoutEvaluation {
  evaluation_id: string;
  tryout_player_id: string;
  evaluator_name: string;
  technical: number;
  tactical: number;
  physical: number;
  mentality: number;
  notes?: string | null;
  created_at: string;
}

export interface TryoutPlayer {
  tryout_player_id: string;
  /** Linked sample student when the attendee is a registered player. */
  student_id: string | null;
  first_name: string;
  last_name: string;
  birth_year: number;
  birth_quarter: 1 | 2 | 3 | 4;
  tryout_date: string;
  evaluations: TryoutEvaluation[];
  /** True when two evaluators differ by 2+ points on any dimension. */
  needs_second_look: boolean;
  disagreement_dims: Array<'technical' | 'tactical' | 'physical' | 'mentality'>;
}

/** Attribute catalog for position profiles (all measured 1–10). */
export type PositionAttribute =
  | 'technical'
  | 'tactical'
  | 'physical'
  | 'mentality'
  | 'speed'
  | 'agility'
  | 'endurance'
  | 'strength';

export interface PositionProfile {
  profile_id: string;
  position: string;
  /** What matters for this position; importance 1 (nice) – 5 (critical). */
  attributes: Array<{ attribute: PositionAttribute; weight: number }>;
  notes?: string | null;
  created_by: string;
  updated_at: string;
}

export interface PositionFit {
  player: TalentPlayerSummary;
  /** 0–100 weighted match against the profile. */
  fit_score: number;
  /** True when the player currently plays a different position. */
  plays_elsewhere: boolean;
  /** Strongest matching attributes, for the "why" line. */
  top_matches: PositionAttribute[];
}

/** Fairness check — who gets selected for top teams, by group. */
export interface FairnessGroup {
  label: string; // i18n key or raw value (e.g. ZIP)
  selected: number;
  pool: number;
  /** selected / pool, 0–1; null when pool is 0. */
  rate: number | null;
}

export interface FairnessReport {
  /** "Selected" = placed on a top (Academy) team. */
  by_birth_quarter: FairnessGroup[];
  by_gender: FairnessGroup[];
  by_zip: FairnessGroup[];
  selected_definition: string; // i18n key
}

/** Audit log — every Talent Insights view, who looked at which player when. */
export interface TalentViewLogEntry {
  log_id: string;
  viewer_name: string;
  viewer_role: string;
  student_id: string | null; // null = board-level view
  player_name: string | null;
  view: string; // e.g. 'board', 'player_timeline', 'tryouts', 'fairness'
  viewed_at: string;
}
