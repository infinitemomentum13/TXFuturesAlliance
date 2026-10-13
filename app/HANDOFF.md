# TX Futures Alliance Pathways — Developer Handoff

**What this is:** a complete, bilingual (English/Spanish) React front end for the
TX Futures Alliance Pathways app (Brownsville, TX / Rio Grande Valley), built with
FC Brownsville youth soccer club and its partnership with Real Racing Club de
Santander in mind. Three pathways: **Career**, **College & University**, **Sports
Career**, plus portals for staff, parents, partners, club staff (Talent Insights),
and an admin outcomes dashboard.

**Current state:** every screen works end-to-end against a **mock API that runs in
the browser** (MSW — Mock Service Worker). There is **no real backend, no real
login, no real database, no real payments, no real external connections** in this
repo. Your job is to stand up the real backend and point the front end at it (see
§3). No screens need to change.

**Users this was designed for:** low-income, bilingual/Spanish-dominant,
first-generation middle/high school students and their families. Design
constraints that should survive the backend swap: fast on cheap Android phones,
large touch targets, plain language (≈6th-grade reading level), Spanish is
first-class ("usted" for parents, "tú" for students), and the app must never judge
a student who chooses work over college.

---

## 1) How to run it locally

Requirements: **Node.js 20+** (nothing else — no Docker, no database).

```bash
npm install
npm run dev        # http://localhost:3000 — mock API runs in the browser
```

Production build:

```bash
npm run build      # outputs static files to dist/
npx vite preview   # serve the build locally to sanity-check it
```

`dist/` is fully static — host it on any static host (Cloudflare Pages, Netlify,
GCP Cloud Storage + CDN, an S3 bucket, or a subfolder of the FC Brownsville
WordPress server). `vite.config.ts` sets `base: './'`, so the build works from a
subpath such as `www.fcbrownsville.com/pathways/` without extra configuration.
Because it's a single-page app, configure a **SPA fallback** (serve `index.html`
for unknown paths) — one line on Cloudflare Pages / Netlify, or a small rewrite
rule in Apache/nginx.

**Demo login (mock mode):** any email + any password works, or click "Continue
with Google" (mock OAuth). After signing in, use the **Demo** menu in the header
to switch roles: Student (6 personas), Parent/Guardian, Coach/Counselor,
Club Staff, Partner, Admin. The Admin → "Demo data" tab has a reset button.

**Environment variables** (create `.env` or set at build time):

| Variable | Default | Meaning |
|---|---|---|
| `VITE_USE_MOCK_API` | `true` | `false` = do not start the browser mock; call a real server instead |
| `VITE_API_BASE_URL` | `/api/v1` | Base URL of the real API, e.g. `https://api.txfuturesalliance.org/api/v1` |

Example, real backend:

```bash
VITE_USE_MOCK_API=false VITE_API_BASE_URL=https://api.example.org/api/v1 npm run build
```

---

## 2) Screens and who sees them

Roles: `student`, `parent`, `coach`, `club_staff`, `partner`, `admin`.
"All" = any signed-in role. Access is enforced twice: the route/screen checks the
role **and** the mock API returns 403 — keep that "defense in depth" in the real
backend (never rely on the UI to hide things).

| Route | Screen | Who sees it |
|---|---|---|
| `/login` | Sign in (password, magic link, Google) | signed-out |
| `/signup-parent` | Parent/guardian account creation | signed-out |
| `/onboarding` | First-run language + pathway intro | all (first run) |
| `/` | Home — role dispatch: student→dashboard, parent→`/parent`, coach→`/staff`, club_staff→`/talent`, partner→`/partner`, admin→`/admin` | all |
| `/career` | Career pathway: Compass results, careers, day-in-life, pay, RGV employers, internships, plan | student (explorer mode gets a lite version); coach/admin view a student's data via `/staff` |
| `/career/:careerId` | Career detail: steps, training, employers, "save" + plan | student |
| `/college` | College pathway: fits list, tracker, scholarships, essays, SAT/ACT, FAFSA/TASFA helper | student; FAFSA helper is parent-facing |
| `/sports` | Sports pathway: recruiting profile, videos, performance timeline, Racing 360 reports, opportunities, Plan B banner | student (explorer → lite); **partner role sees the scout search view here** |
| `/compass` | Pathway Compass intake quiz | student |
| `/compass/results` | Compass results → suggested pathways | student |
| `/profile` | My profile: academics, grades by term, test scores, documents, athletic profile, interests | student |
| `/consent` | Consent Center: all six consent switches + who-has-access log | student (18+ rules apply) and parent (manages children) |
| `/privacy` | Privacy page (DRAFT pending legal review) | all |
| `/staff` | Coach/counselor: caseload table, student detail (notes, tasks, transcript verification, endorsements), bulk EN/ES messaging | `coach`, `admin` |
| `/parent` | Parent portal: approvals inbox (consents, contact requests, signatures), child's plan, deadlines, aid helper link | `parent` |
| `/partner` | Partner portal: postings, applicants (initials only), placements | `partner` |
| `/admin` | Admin: outcomes dashboard (filters, CSV, printable impact report), content CMS with verification stamps, demo tools | `admin` |
| `/talent` | **Talent Insights (FC Brownsville club staff ONLY)**: development board, fair comparisons, hidden gems, tryout evaluation, position profiles, fairness check, audit log | `club_staff` — every other role gets a locked screen **and** a 403 from the API |

Role routing lives in `src/pages/Home.tsx`; the nav layout (different menus for
students vs club staff) is in `src/components/layout/AppShell.tsx`.

---

## 3) Pointing it at the real backend

### 3.1 The switch

The app talks to data **only** over HTTP, only through `src/api/`. Two build-time
env vars control where:

```bash
VITE_USE_MOCK_API=false \
VITE_API_BASE_URL=https://your-api.example.org/api/v1 \
npm run build
```

- `src/main.tsx` starts the MSW browser worker **only** when
  `VITE_USE_MOCK_API !== 'false'`. The whole `src/mocks/` tree loads via dynamic
  `import()`, so with the mock off it is never fetched at runtime (you may also
  delete `src/mocks/` and `public/mockServiceWorker.js` entirely for production).
- `src/api/client.ts` prefixes every request with `VITE_API_BASE_URL` and sends
  `Authorization: Bearer <token>` from the auth session.
- **Proof the switch works:** this build was tested with
  `VITE_USE_MOCK_API=false` and `VITE_API_BASE_URL=http://127.0.0.1:59999`
  (a dead server). The app boots, the login screen shows
  "We can't reach the server right now", and **all 17 routes** render the same
  friendly can't-reach-server state with a Try-again button (via
  `src/components/QueryBoundary.tsx`) instead of crashing. Re-run any time with a
  dead port to confirm.

### 3.2 What the backend must implement

1. **Endpoints:** the 4 original OpenAPI specs (auth/student service, scholarship
   service, video service — supplied with the project brief) **plus
   `openapi_additions.yaml`** (included at the repo root). The additions file is
   complete and final: it documents every added path, request/response schema,
   suggested SQL table/column for each new field, and which role may call what.
   The mock implements **133 operations across 95 paths** — that is the contract
   the front end expects.
2. **Auth shape:** `POST /auth/login` returns `{ "access_token": "...", ... }`.
   The front end treats the token as opaque and sends it as `Bearer`. Token
   parsing in `src/api/auth.ts` (`decodeToken`) accepts the demo token format
   (`demo.<base64-json>`) **and** a standard JWT (it reads the payload segment).
   If your JWT payload doesn't carry `role` / `student_id` / `child_ids`
   directly, adjust `decodeToken` only — it's the single seam.
   `src/api/auth.ts` is deliberately shaped like Supabase Auth
   (`signInWithPassword`, `signInWithOtp`, `signInWithOAuth`, `signOut`,
   `getSession`, `onAuthChange`), so swapping in `@supabase/supabase-js` touches
   one file.
3. **Error shape:** `{ "error": "CODE", "message": "...", "details": {} }`
   with proper HTTP status codes. Status `0` = network unreachable (front-end
   generated). Notable codes the UI handles: `PARENT_APPROVAL_REQUIRED` (403) on
   contact-request approval and on the club-development consent for minors;
   `VALIDATION` (400); `CONSENT_REQUIRED` (403).
4. **Consent & privacy rules are enforced server-side in the mock — replicate
   them in the real backend:**
   - Consent Center keys: `grades_for_matching`, `sports_to_colleges`,
     `sports_to_pro_clubs`, `videos`, `partner_contact`,
     `club_player_development` (all default OFF).
   - `club_player_development` can be granted **only by a parent — or the
     player themselves at 18+** (`403 PARENT_APPROVAL_REQUIRED` otherwise).
   - Recruiting search returns only opted-in students; display names are
     "First L." (first name + last initial); no contact info is ever returned;
     contact requests from partners to minors require parent approval.
   - **Talent Insights endpoints (`/talent/*`) are `club_staff` only** — 403 for
     everyone else, *including admins* — and additionally filter to FC
     Brownsville players with the `club_player_development` consent granted.
     Every talent view must write to the audit log (`talent_view_log`).
   - Outcomes dashboard returns aggregate numbers only — no student names.
   - Students under 13 use "explorer mode" (parent-led, no open-ended data
     entry) — see `app_mode` on the student record.
5. **File uploads:** video upload is two-step — `POST /students/{id}/videos`
   returns `{ upload_url }` (a presigned URL in the real world), then the client
   PUTs the file to it. Documents (`POST /students/{id}/documents`) and Racing
   360 report files accept metadata only in the mock; real storage
   (S3/GCS/Supabase Storage) is yours to add.

### 3.3 Recommended stack (cheapest that works well)

**Supabase** (free tier covers a pilot) + the static front end on **Cloudflare
Pages** (free). You get Postgres (the SQL schemas map directly), Auth (the auth
adapter is already Supabase-shaped), Storage for videos/documents, and Row Level
Security to enforce the consent rules at the database level. GCP is a fine
alternative (Cloud Run + Cloud SQL) but costs more to keep warm and takes more
setup; there's no reason to pay for it at this scale. The front end does not care
— it only knows `VITE_API_BASE_URL`.

### 3.4 Embedding at fcbrownsville.com/pathways

- Deploy `dist/` to your host, mapped to `/pathways` (works out of the box with
  `base: './'` + SPA fallback).
- `public/embed/fcb-signin-button.html` contains a copy-paste **WordPress Custom
  HTML block** (FC Brownsville gold/black "Player & Family Portal / Portal de
  Jugadores y Familias" button) — point its `href` at the live URL.
- Custom domain / TLS: on Cloudflare Pages, add the domain/subdomain and TLS is
  automatic.

---
## 4) API client map (src/api/)

Every screen call goes through these typed functions. "Spec" column: **original**
= one of the four attached OpenAPI specs; **additions** = documented in
`openapi_additions.yaml` at the repo root (paths, schemas, suggested SQL). All
paths are relative to `VITE_API_BASE_URL` (default `/api/v1`). Input types are the
TypeScript types in `src/api/types.ts` — named after the response types below
(e.g. `createCareerPlan(body: Partial<CareerPlan>)`).

The auth adapter (`src/api/auth.ts`) adds: `signInWithPassword()`,
`signInWithOtp()` (magic link), `signInWithOAuth()` (Google),
`signOut()`, `getSession()`, `onAuthChange()` → `POST /auth/login` (original
auth spec). The Racing 360 adapter (`src/api/racing360.ts`) wraps
`getRacing360Reports()` / `createRacing360Report()` plus file import parsing —
**all Racing 360 logic lives in that one adapter** so the real integration
replaces only that file.

**Auth & students**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `login()` | `POST /auth/login` | `LoginResponse` | original |
| `createStudent()` | `POST /students` | `Student` | original |
| `getStudent()` | `GET /students/{studentId}` | `AppStudent` | original |
| `updateStudent()` | `PUT /students/{studentId}` | `Student` | original |
| `deleteStudent()` | `DELETE /students/{studentId}` | `void` | original |
| `listStudents()` | `GET /students` | `Paginated<AppStudent>` | original |

**Academics & test scores**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getAcademicRecords()` | `GET /students/{studentId}/academic-records` | `AcademicRecordsResponse` | original |
| `createAcademicRecord()` | `POST /students/{studentId}/academic-records` | `Record<string, unknown>` | original |
| `getTestScores()` | `GET /students/{studentId}/test-scores` | `{ data: TestScore[] }` | additions |
| `addTestScore()` | `POST /students/{studentId}/test-scores` | `TestScore` | additions |

**Athletic profiles**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getAthleticProfiles()` | `GET /students/{studentId}/athletic-profiles` | `{ data: AthleticProfile[] }` | original |
| `createAthleticProfile()` | `POST /students/{studentId}/athletic-profiles` | `AthleticProfile` | original |
| `updateAthleticProfile()` | `PUT /students/{studentId}/athletic-profiles/{profileId}` | `AthleticProfile` | original |

**Scholarships & matching**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getScholarship()` | `GET /scholarships/{scholarshipId}` | `Scholarship` | original |
| `getScholarshipMatches()` | `GET /students/{studentId}/scholarship-matches` | `{ data: ScholarshipMatch[]; summary: Record<string, number> }` | original |
| `generateMatches()` | `POST /students/{studentId}/scholarship-matches` | `{ job_id: string; status: string; estimated_completion: string }` | original |
| `getMatch()` | `GET /students/{studentId}/scholarship-matches/{matchId}` | `ScholarshipMatch` | original |
| `updateMatch()` | `PATCH /students/{studentId}/scholarship-matches/{matchId}` | `ScholarshipMatch` | original |
| `getScholarshipApplications()` | `GET /students/{studentId}/scholarship-applications` | `{ data: ScholarshipApplication[]; summary: Record<string, number> }` | original |
| `startApplication()` | `POST /students/{studentId}/scholarship-applications` | `ScholarshipApplication` | original |
| `getApplication()` | `GET /students/{studentId}/scholarship-applications/{applicationId}` | `ScholarshipApplication` | original |
| `updateApplication()` | `PATCH /students/{studentId}/scholarship-applications/{applicationId}` | `ScholarshipApplication` | original |
| `submitApplication()` | `POST /students/{studentId}/scholarship-applications/{applicationId}/submit` | `ScholarshipApplication` | original |
| `getScholarshipOutcomes()` | `GET /students/{studentId}/scholarship-outcomes` | `{ data: ScholarshipOutcome[] }` | original |
| `requestRecommendation()` | `POST /students/{studentId}/scholarship-applications/{applicationId}/recommendations` | `ScholarshipApplication` | original |
| `markRecommendationReceived()` | `POST /students/{studentId}/scholarship-applications/{applicationId}/recommendations/${encodeURIComponent(name)}/received` | `ScholarshipApplication` | original |
| `recordApplicationOutcome()` | `POST /students/{studentId}/scholarship-applications/{applicationId}/outcome` | `ScholarshipOutcome` | original |
| `generateEssayTemplate()` | `POST /students/{studentId}/scholarship-applications/{applicationId}/essays` | `EssayTemplate` | original |
| `getEssayTemplate()` | `GET /students/{studentId}/scholarship-applications/{applicationId}/essays/{templateId}` | `EssayTemplate` | original |
| `updateEssayTemplate()` | `PATCH /students/{studentId}/scholarship-applications/{applicationId}/essays/{templateId}` | `EssayTemplate` | original |
| `searchScholarships()` | `GET /scholarships` | `Paginated<Scholarship>` | original |

**College fits & financial aid**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getCollegeFits()` | `GET /students/{studentId}/college-fits` | `{ data: CollegeFitResult[] }` | original |
| `submitAidHelper()` | `POST /students/{studentId}/financial-aid-helper` | `{ ok: boolean; demo_only: boolean; stored: boolean }` | original |
| `getCollege()` | `GET /colleges/{collegeId}` | `College` | additions |
| `listColleges()` | `GET /colleges` | `Paginated<College>` | additions |

**Essays**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getEssayDrafts()` | `GET /students/{studentId}/essay-drafts` | `{ data: EssayTemplate[] }` | original |
| `createEssayDraft()` | `POST /students/{studentId}/essay-drafts` | `EssayTemplate` | original |
| `updateEssayDraft()` | `PATCH /students/{studentId}/essay-drafts/{templateId}` | `EssayTemplate` | original |

**Videos, highlights & reels**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getVideos()` | `GET /students/{studentId}/videos` | `{ data: VideoUpload[]; summary: Record<string, number> }` | original |
| `uploadVideo()` | `POSTFORM /students/{studentId}/videos` | `{ video_id: string; upload_url: string; status: string }` | original |
| `getVideo()` | `GET /students/{studentId}/videos/{videoId}` | `VideoUpload` | original |
| `updateVideo()` | `PATCH /students/{studentId}/videos/{videoId}` | `VideoUpload` | original |
| `deleteVideo()` | `DELETE /students/{studentId}/videos/{videoId}` | `void` | original |
| `requestVideoAnalysis()` | `POST /students/{studentId}/videos/{videoId}/analyze` | `{ job_id: string; status: string; estimated_completion: string }` | original |
| `getVideoAnalyses()` | `GET /students/{studentId}/videos/{videoId}/analysis` | `{ data: VideoAnalysisResult[] }` | original |
| `getVideoAnalysis()` | `GET /students/{studentId}/videos/{videoId}/analysis/{analysisId}` | `VideoAnalysisResult` | original |
| `reviewVideoAnalysis()` | `PATCH /students/{studentId}/videos/{videoId}/analysis/{analysisId}` | `VideoAnalysisResult` | original |
| `getHighlights()` | `GET /students/{studentId}/highlights` | `{ data: VideoHighlight[] }` | original |
| `updateHighlight()` | `PATCH /students/{studentId}/highlights/{highlightId}` | `VideoHighlight` | original |
| `getRecruitmentReels()` | `GET /students/{studentId}/recruitment-reels` | `{ data: RecruitmentReel[] }` | original |
| `shareRecruitmentReel()` | `POST /students/{studentId}/recruitment-reels/{reelId}/share` | `{ share_link: string; expires_at: string }` | original |
| `createHighlight()` | `POST /students/{studentId}/highlights` | `VideoHighlight` | original |
| `createRecruitmentReel()` | `POST /students/{studentId}/recruitment-reels` | `{ reel_id: string; job_id: string; status: string }` | original |

**Consents & privacy**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getConsents()` | `GET /students/{studentId}/consents` | `ConsentRecord` | additions |
| `updateConsents()` | `PUT /students/{studentId}/consents` | `ConsentRecord` | additions |

**Racing 360 adapter**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getRacing360Reports()` | `GET /students/{studentId}/racing360-reports` | `{ data: Racing360Report[] }` | additions |
| `createRacing360Report()` | `POST /students/{studentId}/racing360-reports` | `Racing360Report` | additions |

**Careers & internships**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getCareer()` | `GET /careers/{careerId}` | `Career` | additions |
| `getCareerEmployers()` | `GET /careers/{careerId}/employers` | `{ data: CorporatePartner[] }` | additions |
| `getCareerPlanPreview()` | `GET /careers/{careerId}/plan` | `{ career_id: string; steps: CareerPlanStep[] }` | additions |
| `getInternship()` | `GET /internships/{postingId}` | `InternshipPosting` | additions |
| `getInternshipApplications()` | `GET /students/{studentId}/internship-applications` | `{ data: InternshipApplication[] }` | additions |
| `applyToInternship()` | `POST /students/{studentId}/internship-applications` | `InternshipApplication` | additions |
| `withdrawInternshipApplication()` | `PATCH /students/{studentId}/internship-applications/{applicationId}` | `InternshipApplication` | additions |
| `getCareerPlans()` | `GET /students/{studentId}/career-plans` | `{ data: CareerPlan[] }` | additions |
| `createCareerPlan()` | `POST /students/{studentId}/career-plans` | `CareerPlan` | additions |
| `getCounselorRequests()` | `GET /students/{studentId}/counselor-requests` | `{ data: CounselorRequest[] }` | additions |
| `createCounselorRequest()` | `POST /students/{studentId}/counselor-requests` | `CounselorRequest` | additions |
| `listCareers()` | `GET /careers` | `Paginated<Career>` | additions |
| `listInternships()` | `GET /internships` | `Paginated<InternshipPosting>` | additions |

**Compass, plans, deadlines, messages, story, documents, interests**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getCompass()` | `GET /students/{studentId}/compass` | `PathwayCompass` | additions |
| `updateCompass()` | `PUT /students/{studentId}/compass` | `PathwayCompass` | additions |
| `getPlanActions()` | `GET /students/{studentId}/plan-actions` | `{ data: PlanAction[] }` | additions |
| `createPlanAction()` | `POST /students/{studentId}/plan-actions` | `PlanAction` | additions |
| `updatePlanAction()` | `PATCH /students/{studentId}/plan-actions/{actionId}` | `PlanAction` | additions |
| `getDeadlines()` | `GET /students/{studentId}/deadlines` | `{ data: Deadline[] }` | additions |
| `getMessages()` | `GET /students/{studentId}/messages` | `{ data: StudentMessage[] }` | additions |
| `markMessageRead()` | `PATCH /students/{studentId}/messages/{messageId}` | `StudentMessage` | additions |
| `getMyStory()` | `GET /students/{studentId}/my-story` | `MyStory` | additions |
| `updateMyStory()` | `PUT /students/{studentId}/my-story` | `MyStory` | additions |
| `getDocuments()` | `GET /students/{studentId}/documents` | `{ data: StudentDocument[] }` | additions |
| `addDocument()` | `POST /students/{studentId}/documents` | `StudentDocument` | additions |
| `deleteDocument()` | `DELETE /students/{studentId}/documents/{documentId}` | `void` | additions |
| `getInterests()` | `GET /students/{studentId}/interests` | `{ data: CareerInterest[] }` | additions |
| `updateInterests()` | `PUT /students/{studentId}/interests` | `{ data: CareerInterest[] }` | additions |
| `promoteToPathways()` | `POST /students/{studentId}/promote-to-pathways` | `AppStudent` | additions |
| `listSchools()` | `GET /schools` | `{ data: Array<{ name: string; is_sample: true }> }` | additions |
| `verifyDocument()` | `PATCH /students/{studentId}/documents/{documentId}/verify` | `StudentDocument` | additions |
| `sendBulkMessage()` | `POST /staff/bulk-messages` | `{ sent: number }` | additions |

**Sports recruiting (P5)**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getRecruitingProfile()` | `GET /students/{studentId}/recruiting-profile` | `RecruitingProfile` | additions |
| `getRecruitingPreview()` | `GET /students/{studentId}/recruiting-preview` | `ScoutPreview` | additions |
| `getPerformanceTimeline()` | `GET /students/{studentId}/performance-timeline` | `{ data: PerformancePoint[] }` | additions |
| `addPerformancePoint()` | `POST /students/{studentId}/performance-timeline` | `PerformancePoint` | additions |
| `listOpportunities()` | `GET /opportunities` | `{ data: SportOpportunity[] }` | additions |
| `getContactRequests()` | `GET /students/{studentId}/contact-requests` | `{ data: ContactRequest[] }` | additions |
| `requestContact()` | `POST /students/{studentId}/contact-requests` | `ContactRequest` | additions |
| `respondContactRequest()` | `PATCH /students/{studentId}/contact-requests/{requestId}` | `ContactRequest` | additions |
| `updateRecruitingProfile()` | `PATCH /students/{studentId}/recruiting-profile` | `RecruitingProfile` | additions |
| `searchRecruitingProfiles()` | `GET /recruiting/search` | `{ data: ScoutResult[]; total: number }` | additions |

**Staff / counselor (P6)**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getCaseload()` | `GET /staff/caseload` | `{ data: CaseloadItem[] }` | additions |
| `getStaffNotes()` | `GET /students/{studentId}/staff-notes` | `{ data: StaffNote[] }` | additions |
| `addStaffNote()` | `POST /students/{studentId}/staff-notes` | `StaffNote` | additions |
| `addEndorsement()` | `POST /students/{studentId}/endorsements` | `CoachEndorsement` | additions |

**Parent (P6)**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getApprovals()` | `GET /students/{studentId}/approvals` | `{ data: ApprovalItem[] }` | additions |
| `signDocument()` | `POST /students/{studentId}/signature-docs/{docId}/sign` | `SignatureDoc` | additions |

**Partner portal (P6)**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getPartnerMe()` | `GET /partner/me` | `CorporatePartner` | additions |
| `getPartnerPostings()` | `GET /partner/postings` | `{ data: InternshipPosting[] }` | additions |
| `createPartnerPosting()` | `POST /partner/postings` | `InternshipPosting` | additions |
| `updatePartnerPosting()` | `PATCH /partner/postings/{postingId}` | `InternshipPosting` | additions |
| `getPartnerApplicants()` | `GET /partner/applicants` | `{ data: PartnerApplicant[] }` | additions |
| `getPartnerPlacements()` | `GET /partner/placements` | `{ data: StudentPlacement[] }` | additions |

**Admin: outcomes, CMS, demo (P6)**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `resetDemoData()` | `POST /admin/reset-demo-data` | `{ ok: boolean; reset_at: string }` | additions |
| `getOutcomes()` | `GET /admin/outcomes` | `OutcomesReport` | additions |
| `createContent()` | `POST /admin/content/{collection}` | `Record<string, unknown>` | additions |
| `updateContent()` | `PATCH /admin/content/{collection}/{recordId}` | `Record<string, unknown>` | additions |

**Talent Insights — club staff only (P6B)**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getTalentPlayers()` | `GET /talent/players` | `TalentBoardResponse` | additions |
| `getTalentTimeline()` | `GET /talent/players/{studentId}/timeline` | `{ summary: TalentPlayerSummary; points: DevelopmentPoint[] }` | additions |
| `getHiddenGems()` | `GET /talent/hidden-gems` | `{ gems: HiddenGem[] }` | additions |
| `getTryoutPlayers()` | `GET /talent/tryouts` | `{ players: TryoutPlayer[] }` | additions |
| `addTryoutEvaluation()` | `POST /talent/tryouts/{tryoutPlayerId}/evaluations` | `TryoutPlayer` | additions |
| `getPositionProfiles()` | `GET /talent/position-profiles` | `{ profiles: PositionProfile[] }` | additions |
| `updatePositionProfile()` | `PATCH /talent/position-profiles/{profileId}` | `PositionProfile` | additions |
| `getPositionFits()` | `GET /talent/position-profiles/{profileId}/fits` | `{ fits: PositionFit[] }` | additions |
| `getTalentFairness()` | `GET /talent/fairness` | `FairnessReport` | additions |
| `getTalentAudit()` | `GET /talent/audit` | `{ entries: TalentViewLogEntry[] }` | additions |
| `createPositionProfile()` | `POST /talent/position-profiles` | `PositionProfile` | additions |

**Other**

| Function | Method & path | Returns | Spec |
|---|---|---|---|
| `getSavedCareers()` | `GET /students/{studentId}/saved-careers` | `{ data: SavedCareer[] }` | additions |
| `saveCareer()` | `POST /students/{studentId}/saved-careers` | `SavedCareer` | additions |
| `unsaveCareer()` | `DELETE /students/{studentId}/saved-careers/{savedId}` | `void` | additions |
| `getSavedColleges()` | `GET /students/{studentId}/saved-colleges` | `{ data: SavedCollege[] }` | additions |
| `saveCollege()` | `POST /students/{studentId}/saved-colleges` | `SavedCollege` | additions |
| `unsaveCollege()` | `DELETE /students/{studentId}/saved-colleges/{savedId}` | `void` | additions |

---

## 5) Front-end fields NOT in the attached SQL schemas

Everything below is marked "addition" in `src/api/types.ts` (search for
`addition` / `Front-end additions` comments) and specified fully in
`openapi_additions.yaml`, including these suggested tables/columns. Summary:

| Area | Field(s) the UI uses | Suggested home |
|---|---|---|
| Careers | `title_es`, `description_es`, `day_in_life_en/es`, `pay_rgv_hourly` (RGV vs Texas pay), `min_age_train`, `verified_on`/`verified_by` | `careers` + new columns; pay split → `career_pay(career_id, region, hourly)` |
| Certificate careers | the catalog mixes degree + certificate careers; `training_type`/`credential` flags | `careers.credential_type` enum |
| Colleges | `name_es`, `cost_per_year`, `acceptance_rate`, `verified_on`/`verified_by` | `colleges` + columns |
| Scholarships | `name_es`/`description_es`, `essay_prompts[]` (structured), `verified_on`/`verified_by` | `scholarships` + `scholarship_essay_prompts` |
| Racing 360 reports | entire report object (all field names "to confirm" with the club) | `racing360_reports` (see additions YAML) |
| Consent records | 6-key consent map incl. **`club_player_development`** (new key), `access_log` | `consent_records` rows per key + `consent_access_log` |
| Grades | `grade_source` (self_reported / report_card / registrar), `confidence` | `academic_records.grade_source`, `.grade_confidence` |
| Student documents | `verified_at` / `verified_by` (counselor verification) | `student_documents` + columns |
| Compass intake | `PathwayCompass` object (income urgency, interests, work preferences) | `pathway_compass` |
| Plan actions / deadlines / messages / My Story | full objects | `plan_actions`, `student_messages`, `my_story` |
| Recruiting (P5) | `RecruitingProfile` (positions, dominant foot/hand, academic snapshot), `PerformancePoint`, `SportOpportunity`, `ContactRequest` | `recruiting_profiles`, `performance_measures`, `sport_opportunities`, `contact_requests` |
| Staff (P6) | `CaseloadItem` (derived read model), `StaffNote` | `staff_notes`; caseload is a **view/query**, not a table |
| Parent (P6) | `ApprovalItem` — a **union read model** merging consents + contact requests + signature docs (writes go to the individual endpoints) | `signature_documents`; approvals endpoint is a join |
| Partner (P6) | `PartnerApplicant` (student shown as "First L." only), placement rollups | reuse `internship_applications`, `student_placements` |
| Admin (P6) | `OutcomesReport` (aggregates only), content CMS stamps | map to `corporate_partner_analytics` + `scholarship_outcomes`; add `verified_on`/`verified_by` to catalog tables |
| Talent Insights (P6B) | `DevelopmentPoint`, `TalentPlayerSummary`, `HiddenGem`, `TryoutPlayer`/`TryoutEvaluation`, `PositionProfile`, `FairnessReport`, `TalentViewLogEntry` | `development_measures`, `physical_test_profiles`, `tryout_players`, `tryout_evaluations`, `position_profiles` + `position_profile_attributes`, `talent_view_log` |

---

## 6) Placeholder checklist (wire these up / get sign-off)

- [ ] **Racing 360 direct connection** — UI shows "Direct connection to Racing 360 – coming soon"; file import (PDF/CSV/image) + manual coach entry work today. All logic is isolated in `src/api/racing360.ts` (+ its mock handler). Every field is labeled "Field names to confirm" — confirm the real report schema with the club before building the integration.
- [ ] **AI highlight detection** on the video library — "AI highlight detection – connected later" placeholder; `POST .../videos/{id}/analyze` exists in the video spec.
- [ ] **AI assist (College pathway)** — "AI assist – connected later".
- [ ] **School district transcript import** — "Connected to school district – coming soon" on the College pathway.
- [ ] **"Sample data – to verify" badges** — careers, colleges, scholarships, opportunities and pay figures are fictional samples; replace with verified data via the admin CMS (each record tracks `verified_on`/`verified_by`).
- [ ] **Eligibility rules boxes** (College: NCAA/NAIA/NJCAA; Sports: international transfers, amateur status, visas, parent consent) — written as "rules to verify"; get compliance sign-off before launch.
- [ ] **Privacy page** — marked "DRAFT – pending legal review".
- [ ] **Photos** — photo placeholders ("real photo goes here") on profile/story.
- [ ] **FAFSA/TASFA helper** — demo-only checklist, stores nothing (`demo_only: true` in the API response); decide whether the real one stores data.
- [ ] **Magic-link email** — mock "sends" instantly; connect a real email provider.
- [ ] **File storage** — uploads collect metadata only; wire S3/GCS/Supabase Storage + presigned URLs.
- [ ] **Content verification** — CMS stamps "verified on [date] by [name]" and flags records older than 6 months; assign a real owner to re-verify.

## 7) Known shortcuts & demo-only code

- **Auth:** `src/api/auth.ts` accepts any email/password in mock mode and issues
  `demo.<base64-json>` tokens. Role switching ("Demo" menu) re-logs-in. Replace
  the adapter internals with Supabase Auth (same function signatures); screens
  won't change.
- **Demo personas/roles:** 6 student personas + role switcher
  (`src/api/personas.ts`, Demo menu in `AppShell.tsx`) — remove for production.
- **Parent demo account** maps to the first two explorer-mode students;
  **partner demo account** maps to the first sample corporate partner. Real
  accounts need user→child and user→organization links.
- **Admin → "Demo data" tab** (`POST /admin/reset-demo-data`, force-error switch)
  is a demo tool — drop it or keep behind a flag.
- **Re-login re-seeds the mock** (demo data resets between sessions) — an artifact
  of the mock, not a real-backend requirement.
- **Talent Insights math is a heuristic:** age adjustment (+0.25 per later birth
  quarter), improvement rate (6-month regression slope), hidden-gems thresholds
  (≥0.25/mo improvement, tech+tact ≥6/10, ≤40% minutes or below-Academy team),
  and disagreement flag (≥2-point spread) are starting points, labeled as such in
  the UI — calibrate with real club data.
- **"Time to first job"** on the outcomes dashboard is computed enrollment→placement
  on a handful of sample placements; define the real metric with TXFA.
- **CSV export / print report** are generated client-side from the outcomes
  endpoint; fine to keep.
- **`?from=fcb`** login attribution is parsed but only cosmetic.

## 8) Compliance notes

- **All 182 students are fictional** (`is_sample: true` on every record in
  `src/mocks/sample_students.json`; emails use the reserved `example.com`
  domain). No real personal data exists anywhere in the project. All generated
  catalog/talent data is likewise marked sample.
- **`public/` contains only** `mockServiceWorker.js` (MSW library file) and
  `embed/fcb-signin-button.html` (a static button snippet). Nothing sensitive.
- **No screen imports sample data directly** — the mock layer
  (`src/mocks/seed.ts`) is the only importer of `sample_students.json`; screens
  and components import nothing from `src/mocks/` (verified by scan).
- **All user-facing strings live in `src/i18n/en.json` / `es.json`** (1,900+
  keys each, full parity). The only literals left outside are language-neutral
  by design: the proper nouns "FAFSA"/"TASFA" and the year-format placeholder
  `2026-2027`. Unused stock component boilerplate with embedded English was
  removed; the shared dialog "Close" and spinner "Loading" labels are translated.
