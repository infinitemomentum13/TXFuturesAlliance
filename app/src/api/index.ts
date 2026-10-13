/**
 * Endpoint functions — one per API path. Screens call these, never fetch()
 * directly. Each notes its spec source: [student], [scholarship], [video],
 * or [additions] (openapi_additions.yaml).
 */
import { apiClient } from './client';
import type {
  AcademicRecordsResponse,
  AppStudent,
  ApprovalItem,
  AthleticProfile,
  Career,
  CareerInterest,
  CareerPlan,
  CareerPlanStep,
  CaseloadItem,
  College,
  CollegeFitResult,
  ConsentRecord,
  ContactRequest,
  CorporatePartner,
  CounselorRequest,
  Deadline,
  EssayTemplate,
  InternshipApplication,
  InternshipPosting,
  LoginResponse,
  MyStory,
  OpportunityLane,
  OutcomesReport,
  Paginated,
  PathwayCompass,
  PerformancePoint,
  PlanAction,
  Racing360Report,
  RecruitingProfile,
  RecruitmentReel,
  SavedCareer,
  SavedCollege,
  Scholarship,
  ScholarshipApplication,
  ScholarshipMatch,
  ScholarshipOutcome,
  ScoutResult,
  SignatureDoc,
  SportOpportunity,
  StaffNote,
  Student,
  StudentDocument,
  StudentMessage,
  StudentPlacement,
  PartnerApplicant,
  TestScore,
  DevelopmentPoint,
  FairnessReport,
  HiddenGem,
  PositionFit,
  PositionProfile,
  TalentBoardResponse,
  TalentPlayerSummary,
  TalentViewLogEntry,
  TryoutPlayer,
  VideoAnalysisResult,
  VideoHighlight,
  VideoUpload,
} from './types';

/* ------------------------------ Auth [student] ------------------------- */
export const login = (email: string, password: string) =>
  apiClient.post<LoginResponse>('/auth/login', { email, password });

/* ---------------------------- Students [student] ----------------------- */
export const listStudents = (query?: {
  page?: number;
  page_size?: number;
  enrollment_status?: string;
  grade_level?: number;
  search?: string;
}) => apiClient.get<Paginated<AppStudent>>('/students', query);

export const createStudent = (body: Record<string, unknown>) =>
  apiClient.post<Student>('/students', body);

export const getStudent = (studentId: string) =>
  apiClient.get<AppStudent>(`/students/${studentId}`);

export const updateStudent = (studentId: string, body: Partial<AppStudent>) =>
  apiClient.put<Student>(`/students/${studentId}`, body);

export const deleteStudent = (studentId: string) =>
  apiClient.delete<void>(`/students/${studentId}`);

/* ------------------------ Academic records [student] ------------------- */
export const getAcademicRecords = (
  studentId: string,
  query?: { school_year?: string; semester?: string },
) => apiClient.get<AcademicRecordsResponse>(`/students/${studentId}/academic-records`, query);

export const createAcademicRecord = (studentId: string, body: Record<string, unknown>) =>
  apiClient.post<Record<string, unknown>>(`/students/${studentId}/academic-records`, body);

/* ------------------------ Athletic profiles [student] ------------------ */
export const getAthleticProfiles = (studentId: string, activeOnly = true) =>
  apiClient.get<{ data: AthleticProfile[] }>(`/students/${studentId}/athletic-profiles`, {
    active_only: activeOnly,
  });

export const createAthleticProfile = (studentId: string, body: Record<string, unknown>) =>
  apiClient.post<AthleticProfile>(`/students/${studentId}/athletic-profiles`, body);

export const updateAthleticProfile = (studentId: string, profileId: string, body: Record<string, unknown>) =>
  apiClient.put<AthleticProfile>(`/students/${studentId}/athletic-profiles/${profileId}`, body);

/* ------------------------- Scholarships [scholarship] ------------------ */
export const searchScholarships = (query?: {
  search?: string;
  category?: string;
  min_amount?: number;
  max_amount?: number;
  deadline_before?: string;
  deadline_after?: string;
  gpa_min?: number;
  page?: number;
  page_size?: number;
}) => apiClient.get<Paginated<Scholarship>>('/scholarships', query);

export const getScholarship = (scholarshipId: string) =>
  apiClient.get<Scholarship>(`/scholarships/${scholarshipId}`);

/* ---------------------------- Matches [scholarship] -------------------- */
export const getScholarshipMatches = (
  studentId: string,
  query?: { min_score?: number; status?: string; priority?: string; dismissed?: boolean },
) =>
  apiClient.get<{ data: ScholarshipMatch[]; summary: Record<string, number> }>(
    `/students/${studentId}/scholarship-matches`,
    query,
  );

export const generateMatches = (studentId: string, forceRefresh = false) =>
  apiClient.post<{ job_id: string; status: string; estimated_completion: string }>(
    `/students/${studentId}/scholarship-matches`,
    { force_refresh: forceRefresh },
  );

export const getMatch = (studentId: string, matchId: string) =>
  apiClient.get<ScholarshipMatch>(`/students/${studentId}/scholarship-matches/${matchId}`);

export const updateMatch = (
  studentId: string,
  matchId: string,
  body: { bookmarked?: boolean; dismissed?: boolean; dismissed_reason?: string; viewed?: boolean },
) => apiClient.patch<ScholarshipMatch>(`/students/${studentId}/scholarship-matches/${matchId}`, body);

/* -------------------------- Applications [scholarship] ----------------- */
export const getScholarshipApplications = (
  studentId: string,
  query?: { status?: string; outcome?: string },
) =>
  apiClient.get<{ data: ScholarshipApplication[]; summary: Record<string, number> }>(
    `/students/${studentId}/scholarship-applications`,
    query,
  );

export const startApplication = (studentId: string, scholarshipId: string, matchId?: string) =>
  apiClient.post<ScholarshipApplication>(`/students/${studentId}/scholarship-applications`, {
    scholarship_id: scholarshipId,
    match_id: matchId,
  });

export const getApplication = (studentId: string, applicationId: string) =>
  apiClient.get<ScholarshipApplication>(
    `/students/${studentId}/scholarship-applications/${applicationId}`,
  );

export const updateApplication = (
  studentId: string,
  applicationId: string,
  body: Partial<ScholarshipApplication>,
) =>
  apiClient.patch<ScholarshipApplication>(
    `/students/${studentId}/scholarship-applications/${applicationId}`,
    body,
  );

export const submitApplication = (studentId: string, applicationId: string, confirmation?: string) =>
  apiClient.post<ScholarshipApplication>(
    `/students/${studentId}/scholarship-applications/${applicationId}/submit`,
    { submission_confirmation: confirmation },
  );

/* ------- College pathway additions (Prompt 4) [additions] -------------- */
export const getCollegeFits = (studentId: string) =>
  apiClient.get<{ data: CollegeFitResult[] }>(`/students/${studentId}/college-fits`);

export const getScholarshipOutcomes = (studentId: string) =>
  apiClient.get<{ data: ScholarshipOutcome[] }>(`/students/${studentId}/scholarship-outcomes`);

export const requestRecommendation = (studentId: string, applicationId: string, name: string) =>
  apiClient.post<ScholarshipApplication>(
    `/students/${studentId}/scholarship-applications/${applicationId}/recommendations`,
    { recommender_name: name },
  );

export const markRecommendationReceived = (studentId: string, applicationId: string, name: string) =>
  apiClient.post<ScholarshipApplication>(
    `/students/${studentId}/scholarship-applications/${applicationId}/recommendations/${encodeURIComponent(name)}/received`,
    {},
  );

export const recordApplicationOutcome = (
  studentId: string,
  applicationId: string,
  input: { awarded: boolean; award_amount?: number; decision_date?: string },
) =>
  apiClient.post<ScholarshipOutcome>(
    `/students/${studentId}/scholarship-applications/${applicationId}/outcome`,
    input,
  );

export const getEssayDrafts = (studentId: string) =>
  apiClient.get<{ data: EssayTemplate[] }>(`/students/${studentId}/essay-drafts`);

export const createEssayDraft = (
  studentId: string,
  input: { prompt_text: string; word_limit?: number; start_with_story?: boolean },
) => apiClient.post<EssayTemplate>(`/students/${studentId}/essay-drafts`, input);

export const updateEssayDraft = (
  studentId: string,
  templateId: string,
  input: { student_draft?: string; finalized?: boolean },
) => apiClient.patch<EssayTemplate>(`/students/${studentId}/essay-drafts/${templateId}`, input);

export const submitAidHelper = (studentId: string) =>
  apiClient.post<{ ok: boolean; demo_only: boolean; stored: boolean }>(
    `/students/${studentId}/financial-aid-helper`,
    {},
  );

/* ----------------------------- Essays [scholarship] -------------------- */
export const generateEssayTemplate = (
  studentId: string,
  applicationId: string,
  body: { prompt_text: string; word_limit?: number; student_context?: object },
) =>
  apiClient.post<EssayTemplate>(
    `/students/${studentId}/scholarship-applications/${applicationId}/essays`,
    body,
  );

export const getEssayTemplate = (studentId: string, applicationId: string, templateId: string) =>
  apiClient.get<EssayTemplate>(
    `/students/${studentId}/scholarship-applications/${applicationId}/essays/${templateId}`,
  );

export const updateEssayTemplate = (
  studentId: string,
  applicationId: string,
  templateId: string,
  body: { student_draft?: string; finalized?: boolean },
) =>
  apiClient.patch<EssayTemplate>(
    `/students/${studentId}/scholarship-applications/${applicationId}/essays/${templateId}`,
    body,
  );

/* ------------------------------ Videos [video] ------------------------- */
export const getVideos = (
  studentId: string,
  query?: { video_type?: string; processing_status?: string; date_from?: string; date_to?: string },
) =>
  apiClient.get<{ data: VideoUpload[]; summary: Record<string, number> }>(
    `/students/${studentId}/videos`,
    query,
  );

export const uploadVideo = (studentId: string, formData: FormData) =>
  apiClient.postForm<{ video_id: string; upload_url: string; status: string }>(
    `/students/${studentId}/videos`,
    formData,
  );

export const getVideo = (studentId: string, videoId: string) =>
  apiClient.get<VideoUpload>(`/students/${studentId}/videos/${videoId}`);

export const updateVideo = (studentId: string, videoId: string, body: Record<string, unknown>) =>
  apiClient.patch<VideoUpload>(`/students/${studentId}/videos/${videoId}`, body);

export const deleteVideo = (studentId: string, videoId: string) =>
  apiClient.delete<void>(`/students/${studentId}/videos/${videoId}`);

/* -------------------------- Video analysis [video] --------------------- */
export const requestVideoAnalysis = (
  studentId: string,
  videoId: string,
  body: { analysis_type: string; priority?: string; deployment_preference?: string },
) =>
  apiClient.post<{ job_id: string; status: string; estimated_completion: string }>(
    `/students/${studentId}/videos/${videoId}/analyze`,
    body,
  );

export const getVideoAnalyses = (studentId: string, videoId: string, analysisType?: string) =>
  apiClient.get<{ data: VideoAnalysisResult[] }>(
    `/students/${studentId}/videos/${videoId}/analysis`,
    { analysis_type: analysisType },
  );

export const getVideoAnalysis = (studentId: string, videoId: string, analysisId: string) =>
  apiClient.get<VideoAnalysisResult>(
    `/students/${studentId}/videos/${videoId}/analysis/${analysisId}`,
  );

export const reviewVideoAnalysis = (
  studentId: string,
  videoId: string,
  analysisId: string,
  body: { coach_agreement?: boolean; coach_notes?: string; reviewed?: boolean },
) =>
  apiClient.patch<VideoAnalysisResult>(
    `/students/${studentId}/videos/${videoId}/analysis/${analysisId}`,
    body,
  );

/* ---------------------------- Highlights [video] ----------------------- */
export const getHighlights = (
  studentId: string,
  query?: { highlight_type?: string; showcase_worthy?: boolean; min_quality_score?: number },
) => apiClient.get<{ data: VideoHighlight[] }>(`/students/${studentId}/highlights`, query);

export const createHighlight = (
  studentId: string,
  body: {
    video_id: string;
    highlight_type: string;
    start_timestamp: string;
    end_timestamp: string;
    title?: string;
    description?: string;
    tags?: string[];
  },
) => apiClient.post<VideoHighlight>(`/students/${studentId}/highlights`, body);

export const updateHighlight = (studentId: string, highlightId: string, body: Record<string, unknown>) =>
  apiClient.patch<VideoHighlight>(`/students/${studentId}/highlights/${highlightId}`, body);

/* ------------------------- Recruitment reels [video] ------------------- */
export const getRecruitmentReels = (studentId: string, status?: string) =>
  apiClient.get<{ data: RecruitmentReel[] }>(`/students/${studentId}/recruitment-reels`, { status });

export const createRecruitmentReel = (
  studentId: string,
  body: {
    reel_name: string;
    reel_type: string;
    target_audience?: string;
    included_highlights: string[];
    auto_select_best?: boolean;
    max_duration_seconds?: number;
  },
) =>
  apiClient.post<{ reel_id: string; job_id: string; status: string }>(
    `/students/${studentId}/recruitment-reels`,
    body,
  );

export const shareRecruitmentReel = (
  studentId: string,
  reelId: string,
  body?: { expires_in_days?: number; password_protected?: boolean },
) =>
  apiClient.post<{ share_link: string; expires_at: string }>(
    `/students/${studentId}/recruitment-reels/${reelId}/share`,
    body ?? {},
  );

/* ============================ ADDITIONS =================================
 * New endpoints, same REST style — documented in openapi_additions.yaml. */

/* Consent Center [additions] */
export const getConsents = (studentId: string) =>
  apiClient.get<ConsentRecord>(`/students/${studentId}/consents`);

export const updateConsents = (studentId: string, consents: Record<string, boolean>) =>
  apiClient.put<ConsentRecord>(`/students/${studentId}/consents`, { consents });

/* Racing 360 reports [additions — field names to confirm] */
export const getRacing360Reports = (studentId: string) =>
  apiClient.get<{ data: Racing360Report[] }>(`/students/${studentId}/racing360-reports`);

export const createRacing360Report = (
  studentId: string,
  body: { report_date: string; metrics?: Record<string, unknown>; coach_notes?: string },
) => apiClient.post<Racing360Report>(`/students/${studentId}/racing360-reports`, body);

/* Admin [additions] */
export const resetDemoData = () => apiClient.post<{ ok: boolean; reset_at: string }>('/admin/reset-demo-data');

/* Careers catalog [additions] */
export const listCareers = (query?: {
  interest?: string;
  funded?: boolean;
  max_weeks?: number;
  start_under_18?: boolean;
  sport_friendly?: boolean;
  near_rgv?: boolean;
  sector?: string;
  rgv_sector?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) => apiClient.get<Paginated<Career>>('/careers', query);

export const getCareer = (careerId: string) => apiClient.get<Career>(`/careers/${careerId}`);

export const getCareerEmployers = (careerId: string) =>
  apiClient.get<{ data: CorporatePartner[] }>(`/careers/${careerId}/employers`);

export const getCareerPlanPreview = (careerId: string) =>
  apiClient.get<{ career_id: string; steps: CareerPlanStep[] }>(`/careers/${careerId}/plan`);

/* Internships & jobs [additions — corporate_internships SQL] */
export const listInternships = (query?: {
  career_id?: string;
  paid?: boolean;
  sport_friendly?: boolean;
  category?: string;
  page?: number;
  page_size?: number;
}) => apiClient.get<Paginated<InternshipPosting>>('/internships', query);

export const getInternship = (postingId: string) =>
  apiClient.get<InternshipPosting>(`/internships/${postingId}`);

export const getInternshipApplications = (studentId: string) =>
  apiClient.get<{ data: InternshipApplication[] }>(`/students/${studentId}/internship-applications`);

export const applyToInternship = (
  studentId: string,
  input: { posting_id: string; application_responses?: Record<string, string> },
) => apiClient.post<InternshipApplication>(`/students/${studentId}/internship-applications`, input);

export const withdrawInternshipApplication = (studentId: string, applicationId: string) =>
  apiClient.patch<InternshipApplication>(
    `/students/${studentId}/internship-applications/${applicationId}`,
    { action: 'withdraw' },
  );

/* Career plans (step-by-step My Plan) [additions] */
export const getCareerPlans = (studentId: string) =>
  apiClient.get<{ data: CareerPlan[] }>(`/students/${studentId}/career-plans`);

export const createCareerPlan = (studentId: string, careerId: string) =>
  apiClient.post<CareerPlan>(`/students/${studentId}/career-plans`, { career_id: careerId });

/* Counselor requests ("Talk to my counselor") [additions] */
export const getCounselorRequests = (studentId: string) =>
  apiClient.get<{ data: CounselorRequest[] }>(`/students/${studentId}/counselor-requests`);

export const createCounselorRequest = (
  studentId: string,
  input: { topic: string; career_id?: string; posting_id?: string; body: string },
) => apiClient.post<CounselorRequest>(`/students/${studentId}/counselor-requests`, input);

/* Colleges catalog [additions] */
export const listColleges = (query?: {
  country?: string;
  in_rgv?: boolean;
  type?: string;
  soccer?: boolean;
  page?: number;
  page_size?: number;
}) => apiClient.get<Paginated<College>>('/colleges', query);

export const getCollege = (collegeId: string) => apiClient.get<College>(`/colleges/${collegeId}`);

/* Saved items [additions] */
export const getSavedCareers = (studentId: string) =>
  apiClient.get<{ data: SavedCareer[] }>(`/students/${studentId}/saved-careers`);

export const saveCareer = (studentId: string, careerId: string) =>
  apiClient.post<SavedCareer>(`/students/${studentId}/saved-careers`, { career_id: careerId });

export const unsaveCareer = (studentId: string, savedId: string) =>
  apiClient.delete<void>(`/students/${studentId}/saved-careers/${savedId}`);

export const getSavedColleges = (studentId: string) =>
  apiClient.get<{ data: SavedCollege[] }>(`/students/${studentId}/saved-colleges`);

export const saveCollege = (studentId: string, collegeId: string) =>
  apiClient.post<SavedCollege>(`/students/${studentId}/saved-colleges`, { college_id: collegeId });

export const unsaveCollege = (studentId: string, savedId: string) =>
  apiClient.delete<void>(`/students/${studentId}/saved-colleges/${savedId}`);

/* Pathway Compass [additions] */
export const getCompass = (studentId: string) =>
  apiClient.get<PathwayCompass>(`/students/${studentId}/compass`);

export const updateCompass = (studentId: string, body: Partial<PathwayCompass>) =>
  apiClient.put<PathwayCompass>(`/students/${studentId}/compass`, body);

/* My Plan, deadlines, messages, My Story [additions] */
export const getPlanActions = (studentId: string) =>
  apiClient.get<{ data: PlanAction[] }>(`/students/${studentId}/plan-actions`);

export const createPlanAction = (
  studentId: string,
  body: { pathway: PlanAction['pathway']; title_en: string; title_es?: string; due_date?: string },
) => apiClient.post<PlanAction>(`/students/${studentId}/plan-actions`, body);

export const updatePlanAction = (
  studentId: string,
  actionId: string,
  body: { status?: 'todo' | 'done'; due_date?: string | null },
) => apiClient.patch<PlanAction>(`/students/${studentId}/plan-actions/${actionId}`, body);

export const getDeadlines = (studentId: string) =>
  apiClient.get<{ data: Deadline[] }>(`/students/${studentId}/deadlines`);

export const getMessages = (studentId: string) =>
  apiClient.get<{ data: StudentMessage[] }>(`/students/${studentId}/messages`);

export const markMessageRead = (studentId: string, messageId: string) =>
  apiClient.patch<StudentMessage>(`/students/${studentId}/messages/${messageId}`, { read: true });

export const getMyStory = (studentId: string) =>
  apiClient.get<MyStory>(`/students/${studentId}/my-story`);

export const updateMyStory = (studentId: string, text: string) =>
  apiClient.put<MyStory>(`/students/${studentId}/my-story`, { text });

/* Documents, test scores, interests [additions] */
export const getDocuments = (studentId: string) =>
  apiClient.get<{ data: StudentDocument[] }>(`/students/${studentId}/documents`);

export const addDocument = (
  studentId: string,
  body: { kind: StudentDocument['kind']; file_name: string; note?: string },
) => apiClient.post<StudentDocument>(`/students/${studentId}/documents`, body);

export const deleteDocument = (studentId: string, documentId: string) =>
  apiClient.delete<void>(`/students/${studentId}/documents/${documentId}`);

export const getTestScores = (studentId: string) =>
  apiClient.get<{ data: TestScore[] }>(`/students/${studentId}/test-scores`);

export const addTestScore = (studentId: string, body: Partial<TestScore>) =>
  apiClient.post<TestScore>(`/students/${studentId}/test-scores`, body);

export const getInterests = (studentId: string) =>
  apiClient.get<{ data: CareerInterest[] }>(`/students/${studentId}/interests`);

export const updateInterests = (
  studentId: string,
  interests: Array<{ career_field: string; interest_level?: number }>,
) => apiClient.put<{ data: CareerInterest[] }>(`/students/${studentId}/interests`, { interests });

/* Mode promotion (explorer → pathways, parent/admin only) [additions] */
export const promoteToPathways = (studentId: string) =>
  apiClient.post<AppStudent>(`/students/${studentId}/promote-to-pathways`);

/* Schools (sample schools only) [additions] */
export const listSchools = () =>
  apiClient.get<{ data: Array<{ name: string; is_sample: true }> }>('/schools');

/* ---------------- Sports pathway (additions, Prompt 5) ---------------- */

export const getRecruitingProfile = (studentId: string) =>
  apiClient.get<RecruitingProfile>(`/students/${studentId}/recruiting-profile`);

export const updateRecruitingProfile = (
  studentId: string,
  body: {
    positions?: string[];
    dominant_foot?: string | null;
    dominant_hand?: string | null;
    height_inches?: number | null;
    weight_pounds?: number | null;
  },
) => apiClient.patch<RecruitingProfile>(`/students/${studentId}/recruiting-profile`, body);

export interface ScoutPreview {
  visible: boolean;
  result: ScoutResult | null;
  consents: {
    sports_to_colleges: boolean;
    sports_to_pro_clubs: boolean;
    videos: boolean;
    grades_for_matching: boolean;
  };
  videos_visible: boolean;
  viewer: string;
}

export const getRecruitingPreview = (studentId: string) =>
  apiClient.get<ScoutPreview>(`/students/${studentId}/recruiting-preview`);

export const getPerformanceTimeline = (studentId: string) =>
  apiClient.get<{ data: PerformancePoint[] }>(`/students/${studentId}/performance-timeline`);

export const addPerformancePoint = (studentId: string, body: Partial<PerformancePoint>) =>
  apiClient.post<PerformancePoint>(`/students/${studentId}/performance-timeline`, body);

export const listOpportunities = (lane?: OpportunityLane) =>
  apiClient.get<{ data: SportOpportunity[] }>('/opportunities', lane ? { lane } : undefined);

export const searchRecruitingProfiles = (query?: {
  position?: string;
  grad_year?: number;
  level?: string;
  open_to?: string;
}) => apiClient.get<{ data: ScoutResult[]; total: number }>('/recruiting/search', query);

export const getContactRequests = (studentId: string) =>
  apiClient.get<{ data: ContactRequest[] }>(`/students/${studentId}/contact-requests`);

export const requestContact = (
  studentId: string,
  body: { requester_org: string; requester_role?: ContactRequest['requester_role']; message: string },
) => apiClient.post<ContactRequest>(`/students/${studentId}/contact-requests`, body);

export const respondContactRequest = (
  studentId: string,
  requestId: string,
  action: 'approve' | 'decline',
) => apiClient.patch<ContactRequest>(`/students/${studentId}/contact-requests/${requestId}`, { action });

/* ---------------- Staff / partner / admin (additions, Prompt 6) -------- */

export const getCaseload = () => apiClient.get<{ data: CaseloadItem[] }>('/staff/caseload');

export const getStaffNotes = (studentId: string) =>
  apiClient.get<{ data: StaffNote[] }>(`/students/${studentId}/staff-notes`);

export const addStaffNote = (studentId: string, body: string) =>
  apiClient.post<StaffNote>(`/students/${studentId}/staff-notes`, { body });

export const addEndorsement = (studentId: string, textEn: string, coachOrg?: string) =>
  apiClient.post(`/students/${studentId}/endorsements`, { text_en: textEn, coach_org: coachOrg });

export const verifyDocument = (studentId: string, documentId: string) =>
  apiClient.patch<StudentDocument>(`/students/${studentId}/documents/${documentId}/verify`, {});

export const sendBulkMessage = (studentIds: string[], bodyEn: string, bodyEs?: string) =>
  apiClient.post<{ sent: number }>('/staff/bulk-messages', {
    student_ids: studentIds,
    body_en: bodyEn,
    body_es: bodyEs,
  });

export const getApprovals = (studentId: string) =>
  apiClient.get<{ data: ApprovalItem[] }>(`/students/${studentId}/approvals`);

export const signDocument = (studentId: string, docId: string) =>
  apiClient.post<SignatureDoc>(`/students/${studentId}/signature-docs/${docId}/sign`, {});

export const getPartnerMe = () => apiClient.get<CorporatePartner>('/partner/me');

export const getPartnerPostings = () =>
  apiClient.get<{ data: InternshipPosting[] }>('/partner/postings');

export const createPartnerPosting = (body: Partial<InternshipPosting>) =>
  apiClient.post<InternshipPosting>('/partner/postings', body);

export const updatePartnerPosting = (postingId: string, body: Partial<InternshipPosting>) =>
  apiClient.patch<InternshipPosting>(`/partner/postings/${postingId}`, body);

export const getPartnerApplicants = () =>
  apiClient.get<{ data: PartnerApplicant[] }>('/partner/applicants');

export const getPartnerPlacements = () =>
  apiClient.get<{ data: StudentPlacement[] }>('/partner/placements');

export const getOutcomes = (filters?: { school?: string; grade?: number; year?: number }) =>
  apiClient.get<OutcomesReport>('/admin/outcomes', filters);

export const createContent = (collection: ContentCollection, body: Record<string, unknown>) =>
  apiClient.post<Record<string, unknown>>(`/admin/content/${collection}`, body);

export const updateContent = (collection: ContentCollection, recordId: string, body: Record<string, unknown>) =>
  apiClient.patch<Record<string, unknown>>(`/admin/content/${collection}/${recordId}`, body);

export type ContentCollection = 'careers' | 'colleges' | 'scholarships' | 'opportunities';

/* --------------------- Talent Insights (Prompt 6B) ----------------------
 * Club staff only. Decision support — never an automatic ranking. */

export const getTalentPlayers = () => apiClient.get<TalentBoardResponse>('/talent/players');

export const getTalentTimeline = (studentId: string) =>
  apiClient.get<{ summary: TalentPlayerSummary; points: DevelopmentPoint[] }>(
    `/talent/players/${studentId}/timeline`,
  );

export const getHiddenGems = () => apiClient.get<{ gems: HiddenGem[] }>('/talent/hidden-gems');

export const getTryoutPlayers = () =>
  apiClient.get<{ players: TryoutPlayer[] }>('/talent/tryouts');

export const addTryoutEvaluation = (
  tryoutPlayerId: string,
  body: { technical: number; tactical: number; physical: number; mentality: number; notes?: string },
) => apiClient.post<TryoutPlayer>(`/talent/tryouts/${tryoutPlayerId}/evaluations`, body);

export const getPositionProfiles = () =>
  apiClient.get<{ profiles: PositionProfile[] }>('/talent/position-profiles');

export const createPositionProfile = (body: {
  position: string;
  attributes: PositionProfile['attributes'];
  notes?: string;
}) => apiClient.post<PositionProfile>('/talent/position-profiles', body);

export const updatePositionProfile = (
  profileId: string,
  body: Partial<Pick<PositionProfile, 'position' | 'attributes' | 'notes'>>,
) => apiClient.patch<PositionProfile>(`/talent/position-profiles/${profileId}`, body);

export const getPositionFits = (profileId: string) =>
  apiClient.get<{ fits: PositionFit[] }>(`/talent/position-profiles/${profileId}/fits`);

export const getTalentFairness = () => apiClient.get<FairnessReport>('/talent/fairness');

export const getTalentAudit = () =>
  apiClient.get<{ entries: TalentViewLogEntry[] }>('/talent/audit');
