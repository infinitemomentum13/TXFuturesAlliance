-- ============================================================================
-- TX FUTURES ALLIANCE - SCHOLARSHIP DATABASE SCHEMA
-- ============================================================================
-- Purpose: Scholarship catalog, matching algorithm data, application tracking,
--          and outcome measurement
-- Public/Private: Hybrid - scholarship details public, student matches private
-- Last Updated: 2026-01-23
-- ============================================================================

-- ============================================================================
-- SCHOLARSHIPS TABLE
-- Catalog of all available scholarships with eligibility criteria
-- ============================================================================
CREATE TABLE scholarships (
    scholarship_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Information
    name VARCHAR(500) NOT NULL,
    organization VARCHAR(300) NOT NULL,
    organization_type VARCHAR(100),
    -- "University", "Foundation", "Corporate", "Government", "Athletic", "Private"
    
    -- Award Details
    award_type VARCHAR(50) NOT NULL,
    -- "One-time", "Renewable", "Full-ride", "Partial"
    award_amount_min DECIMAL(10,2),
    award_amount_max DECIMAL(10,2),
    typical_award_amount DECIMAL(10,2),
    number_of_awards INTEGER, -- How many scholarships available
    total_funding DECIMAL(12,2), -- Total pool of money
    
    -- Renewable Information
    renewable BOOLEAN DEFAULT FALSE,
    max_years_renewable INTEGER,
    renewal_requirements TEXT,
    -- "Maintain 3.0 GPA", "Continue athletic participation", etc.
    
    -- Deadlines
    application_deadline DATE,
    award_notification_date DATE,
    application_open_date DATE,
    early_deadline DATE, -- If there's an early decision/priority deadline
    rolling_admission BOOLEAN DEFAULT FALSE,
    
    -- Eligibility Criteria (structured)
    eligibility_criteria JSONB NOT NULL,
    -- Example structure:
    -- {
    --   "gpa_minimum": 3.0,
    --   "gpa_scale": 4.0,
    --   "income_maximum": 50000,
    --   "grade_levels": ["11", "12"],
    --   "demographic_requirements": {
    --     "first_generation": true,
    --     "ethnicity": ["Hispanic", "Latino"],
    --     "gender": "Any"
    --   },
    --   "geographic_restrictions": {
    --     "states": ["TX"],
    --     "counties": ["Cameron", "Hidalgo"],
    --     "cities": ["Brownsville"]
    --   },
    --   "athletic_requirements": {
    --     "required": false,
    --     "sports": ["Soccer"],
    --     "skill_level": "Any"
    --   },
    --   "major_restrictions": ["STEM", "Engineering"],
    --   "test_scores": {
    --     "sat_minimum": 1200,
    --     "act_minimum": 26
    --   },
    --   "citizenship": ["US Citizen", "Permanent Resident"],
    --   "special_requirements": ["Essay", "Recommendation Letters", "Interview"]
    -- }
    
    -- Application Requirements
    essay_required BOOLEAN DEFAULT FALSE,
    essay_prompts TEXT[],
    essay_word_limits INTEGER[],
    recommendations_required INTEGER DEFAULT 0,
    recommendation_requirements TEXT,
    transcript_required BOOLEAN DEFAULT FALSE,
    fafsa_required BOOLEAN DEFAULT FALSE,
    css_profile_required BOOLEAN DEFAULT FALSE,
    interview_required BOOLEAN DEFAULT FALSE,
    portfolio_required BOOLEAN DEFAULT FALSE,
    other_requirements TEXT,
    
    -- Application Process
    application_url TEXT,
    application_portal VARCHAR(100),
    -- "Common App", "Organization Website", "Coalition App", "Email", etc.
    application_instructions TEXT,
    
    -- Contact Information
    contact_name VARCHAR(200),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    organization_website TEXT,
    
    -- Historical Data
    award_history JSONB,
    -- Example: [
    --   {"year": 2024, "recipients": 50, "avg_award": 5000, "total_awarded": 250000},
    --   {"year": 2023, "recipients": 48, "avg_award": 4800, "total_awarded": 230400}
    -- ]
    success_rate DECIMAL(5,2), -- Percentage of applicants who win
    -- Calculated from historical data or estimated
    
    -- Categorization & Tags
    categories TEXT[], -- ["Academic", "Athletic", "Need-Based", "Merit-Based"]
    tags TEXT[], -- ["Women in STEM", "Rural Students", "Soccer", "First Gen"]
    target_audience VARCHAR(200),
    
    -- Data Source & Quality
    data_source VARCHAR(100) NOT NULL,
    -- "Manual Entry", "Fastweb API", "Scholarships.com", "Web Scrape", "Organization Direct"
    data_quality_score INTEGER, -- 1-10, how reliable is this data
    last_verified_date DATE,
    verification_status VARCHAR(50),
    -- "Verified", "Needs Verification", "Outdated", "Unverified"
    
    -- Status
    active_status BOOLEAN DEFAULT TRUE,
    archived BOOLEAN DEFAULT FALSE,
    archive_reason TEXT,
    
    -- Notes
    internal_notes TEXT, -- Staff notes, not visible to students
    student_notes TEXT, -- Tips/advice shown to students
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    CONSTRAINT chk_award_type CHECK (award_type IN 
        ('One-time', 'Renewable', 'Full-ride', 'Partial')),
    CONSTRAINT chk_award_amounts CHECK (
        award_amount_min >= 0 AND 
        award_amount_max >= award_amount_min
    ),
    CONSTRAINT chk_success_rate CHECK (success_rate BETWEEN 0 AND 100),
    CONSTRAINT chk_data_quality CHECK (data_quality_score BETWEEN 1 AND 10)
);

-- Indexes
CREATE INDEX idx_scholarships_organization ON scholarships(organization);
CREATE INDEX idx_scholarships_deadline ON scholarships(application_deadline);
CREATE INDEX idx_scholarships_active ON scholarships(active_status);
CREATE INDEX idx_scholarships_categories ON scholarships USING GIN(categories);
CREATE INDEX idx_scholarships_tags ON scholarships USING GIN(tags);
CREATE INDEX idx_scholarships_criteria ON scholarships USING GIN(eligibility_criteria);
CREATE INDEX idx_scholarships_award_amount ON scholarships(typical_award_amount);

CREATE TRIGGER update_scholarships_updated_at BEFORE UPDATE ON scholarships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SCHOLARSHIP MATCHES TABLE
-- AI/ML generated matches between students and scholarships
-- ============================================================================
CREATE TABLE scholarship_matches (
    match_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    scholarship_id UUID NOT NULL REFERENCES scholarships(scholarship_id) ON DELETE CASCADE,
    
    -- Match Scoring
    match_score DECIMAL(5,2) NOT NULL, -- 0-100, how good is the match
    probability_of_award DECIMAL(5,2), -- 0-100, estimated chance of winning
    
    -- Match Rationale
    match_rationale JSONB,
    -- Example:
    -- {
    --   "strengths": [
    --     "GPA exceeds minimum by 0.5",
    --     "Strong athletic profile matches requirement",
    --     "Geographic eligibility (Texas resident)"
    --   ],
    --   "weaknesses": [
    --     "SAT score 50 points below average of past winners",
    --     "Missing one recommendation letter"
    --   ],
    --   "requirements_met": 8,
    --   "requirements_total": 10,
    --   "competitive_advantages": ["First-generation college student", "Rural background"]
    -- }
    
    -- ML Model Info
    model_version VARCHAR(50),
    model_confidence DECIMAL(5,2), -- How confident is the model in this match
    calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Application Timeline
    application_deadline DATE,
    days_until_deadline INTEGER GENERATED ALWAYS AS (
        EXTRACT(DAY FROM (application_deadline - CURRENT_DATE))
    ) STORED,
    priority_level VARCHAR(20),
    -- "Critical" (<7 days), "High" (7-30 days), "Medium" (30-60 days), "Low" (>60 days)
    
    -- Application Status
    application_status VARCHAR(50) NOT NULL DEFAULT 'not_started',
    -- "not_started", "in_progress", "submitted", "under_review", 
    -- "finalist", "awarded", "denied", "withdrawn"
    status_updated_at TIMESTAMP,
    
    -- Student Interaction
    viewed_by_student BOOLEAN DEFAULT FALSE,
    viewed_at TIMESTAMP,
    bookmarked BOOLEAN DEFAULT FALSE,
    dismissed BOOLEAN DEFAULT FALSE,
    dismissed_reason TEXT,
    
    -- Counselor Review
    reviewed_by_counselor BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP,
    reviewed_by UUID,
    counselor_notes TEXT,
    counselor_recommendation VARCHAR(50),
    -- "Highly Recommended", "Recommended", "Consider", "Not Recommended"
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate matches
    UNIQUE(student_id, scholarship_id),
    
    CONSTRAINT chk_match_score CHECK (match_score BETWEEN 0 AND 100),
    CONSTRAINT chk_probability CHECK (probability_of_award BETWEEN 0 AND 100),
    CONSTRAINT chk_model_confidence CHECK (model_confidence BETWEEN 0 AND 100),
    CONSTRAINT chk_application_status CHECK (application_status IN 
        ('not_started', 'in_progress', 'submitted', 'under_review', 
         'finalist', 'awarded', 'denied', 'withdrawn')),
    CONSTRAINT chk_priority_level CHECK (priority_level IN 
        ('Critical', 'High', 'Medium', 'Low'))
);

-- Indexes
CREATE INDEX idx_matches_student ON scholarship_matches(student_id);
CREATE INDEX idx_matches_scholarship ON scholarship_matches(scholarship_id);
CREATE INDEX idx_matches_score ON scholarship_matches(match_score DESC);
CREATE INDEX idx_matches_status ON scholarship_matches(application_status);
CREATE INDEX idx_matches_deadline ON scholarship_matches(application_deadline);
CREATE INDEX idx_matches_priority ON scholarship_matches(priority_level);
CREATE INDEX idx_matches_viewed ON scholarship_matches(viewed_by_student);

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON scholarship_matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SCHOLARSHIP APPLICATIONS TABLE
-- Track student applications to scholarships
-- ============================================================================
CREATE TABLE scholarship_applications (
    application_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    scholarship_id UUID NOT NULL REFERENCES scholarships(scholarship_id) ON DELETE CASCADE,
    match_id UUID REFERENCES scholarship_matches(match_id),
    
    -- Application Timeline
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    decision_date TIMESTAMP,
    notification_date TIMESTAMP,
    
    -- Application Status
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
    -- "in_progress", "submitted", "under_review", "finalist", 
    -- "interview_scheduled", "awarded", "denied", "waitlisted", "withdrawn"
    
    -- Outcome
    outcome VARCHAR(50),
    -- "awarded", "denied", "waitlisted", "withdrawn", "pending"
    award_amount DECIMAL(10,2),
    award_years INTEGER, -- If renewable
    
    -- Required Materials Checklist
    materials_checklist JSONB,
    -- Example:
    -- {
    --   "essay": {"required": true, "completed": true, "submitted_at": "2024-01-15"},
    --   "transcript": {"required": true, "completed": true, "submitted_at": "2024-01-10"},
    --   "recommendations": {
    --     "required": 2, 
    --     "completed": 1,
    --     "submissions": [
    --       {"from": "Coach Smith", "submitted_at": "2024-01-12"}
    --     ]
    --   },
    --   "fafsa": {"required": true, "completed": false}
    -- }
    
    completion_percentage INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN materials_checklist IS NULL THEN 0
            ELSE (
                SELECT COUNT(*) FILTER (WHERE value->>'completed' = 'true')::decimal / 
                       COUNT(*)::decimal * 100
                FROM jsonb_each(materials_checklist)
            )::integer
        END
    ) STORED,
    
    -- Documents (store URLs to Cloud Storage)
    essay_urls TEXT[],
    transcript_url TEXT,
    recommendation_letter_urls TEXT[],
    supplemental_document_urls TEXT[],
    
    -- Interview (if applicable)
    interview_scheduled BOOLEAN DEFAULT FALSE,
    interview_date TIMESTAMP,
    interview_location TEXT,
    interview_format VARCHAR(50), -- "In-person", "Video", "Phone"
    interview_completed BOOLEAN DEFAULT FALSE,
    interview_notes TEXT,
    
    -- Communication Log
    communication_log JSONB,
    -- Array of communications with scholarship organization
    -- [
    --   {"date": "2024-01-20", "type": "email", "subject": "Application received", "content": "..."},
    --   {"date": "2024-02-15", "type": "phone", "subject": "Follow-up call", "content": "..."}
    -- ]
    
    -- Support Tracking
    assistance_provided BOOLEAN DEFAULT FALSE,
    assistance_type TEXT[], 
    -- ["Essay Review", "Letter of Rec Coaching", "Interview Prep", "FAFSA Help"]
    assisted_by UUID, -- Staff/counselor who helped
    
    -- Notes
    student_notes TEXT,
    counselor_notes TEXT,
    internal_notes TEXT,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_app_status CHECK (status IN 
        ('in_progress', 'submitted', 'under_review', 'finalist', 
         'interview_scheduled', 'awarded', 'denied', 'waitlisted', 'withdrawn')),
    CONSTRAINT chk_outcome CHECK (outcome IN 
        ('awarded', 'denied', 'waitlisted', 'withdrawn', 'pending', NULL)),
    CONSTRAINT chk_interview_format CHECK (interview_format IN 
        ('In-person', 'Video', 'Phone', 'Written', NULL))
);

-- Indexes
CREATE INDEX idx_applications_student ON scholarship_applications(student_id);
CREATE INDEX idx_applications_scholarship ON scholarship_applications(scholarship_id);
CREATE INDEX idx_applications_status ON scholarship_applications(status);
CREATE INDEX idx_applications_outcome ON scholarship_applications(outcome);
CREATE INDEX idx_applications_submitted ON scholarship_applications(submitted_at);
CREATE INDEX idx_applications_decision ON scholarship_applications(decision_date);

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON scholarship_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SCHOLARSHIP OUTCOMES TABLE
-- Track long-term outcomes and scholarship effectiveness
-- ============================================================================
CREATE TABLE scholarship_outcomes (
    outcome_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES scholarship_applications(application_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    scholarship_id UUID NOT NULL REFERENCES scholarships(scholarship_id) ON DELETE CASCADE,
    
    -- Award Details
    awarded BOOLEAN NOT NULL,
    award_year INTEGER NOT NULL,
    award_amount DECIMAL(10,2),
    
    -- Disbursement Tracking
    disbursement_schedule JSONB,
    -- Example:
    -- [
    --   {"semester": "Fall 2024", "amount": 2500, "disbursed": true, "date": "2024-08-15"},
    --   {"semester": "Spring 2025", "amount": 2500, "disbursed": false, "expected_date": "2025-01-15"}
    -- ]
    total_disbursed DECIMAL(10,2) DEFAULT 0,
    
    -- Renewal Tracking (if renewable)
    renewable BOOLEAN DEFAULT FALSE,
    renewed BOOLEAN,
    renewal_years_remaining INTEGER,
    renewal_gpa_requirement DECIMAL(4,3),
    renewal_status VARCHAR(50),
    -- "Eligible", "Renewed", "Not Renewed", "Lost Due to GPA", "Lost Due to Other", "N/A"
    
    -- College Enrollment (did scholarship lead to college?)
    enrolled_in_college BOOLEAN,
    college_name VARCHAR(300),
    enrollment_date DATE,
    graduation_date DATE,
    graduated BOOLEAN,
    degree_earned VARCHAR(200),
    
    -- Impact Metrics
    scholarship_influenced_decision BOOLEAN,
    -- Did this scholarship make college possible/affordable?
    enabled_college_attendance BOOLEAN,
    reduced_debt BOOLEAN,
    estimated_debt_reduction DECIMAL(10,2),
    
    -- Student Satisfaction
    student_satisfaction_rating INTEGER, -- 1-5 scale
    student_feedback TEXT,
    would_recommend BOOLEAN,
    
    -- Platform Effectiveness
    found_through_platform BOOLEAN DEFAULT TRUE,
    application_assistance_helpful BOOLEAN,
    
    -- Long-term Tracking
    post_graduation_employment BOOLEAN,
    employment_field VARCHAR(200),
    annual_salary DECIMAL(10,2),
    roi_calculation JSONB,
    -- Return on investment for scholarship
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_renewal_status CHECK (renewal_status IN 
        ('Eligible', 'Renewed', 'Not Renewed', 'Lost Due to GPA', 
         'Lost Due to Other', 'N/A', NULL)),
    CONSTRAINT chk_satisfaction CHECK (student_satisfaction_rating BETWEEN 1 AND 5)
);

-- Indexes
CREATE INDEX idx_outcomes_application ON scholarship_outcomes(application_id);
CREATE INDEX idx_outcomes_student ON scholarship_outcomes(student_id);
CREATE INDEX idx_outcomes_scholarship ON scholarship_outcomes(scholarship_id);
CREATE INDEX idx_outcomes_awarded ON scholarship_outcomes(awarded);
CREATE INDEX idx_outcomes_year ON scholarship_outcomes(award_year);

CREATE TRIGGER update_outcomes_updated_at BEFORE UPDATE ON scholarship_outcomes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SCHOLARSHIP ESSAY TEMPLATES TABLE
-- Store AI-generated essay drafts and templates
-- ============================================================================
CREATE TABLE scholarship_essay_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES scholarship_applications(application_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    scholarship_id UUID NOT NULL REFERENCES scholarships(scholarship_id) ON DELETE CASCADE,
    
    -- Essay Prompt
    prompt_text TEXT NOT NULL,
    word_limit INTEGER,
    
    -- AI-Generated Draft
    ai_generated_draft TEXT,
    ai_model_version VARCHAR(50),
    generation_timestamp TIMESTAMP,
    
    -- Student Edits
    student_draft TEXT,
    edit_count INTEGER DEFAULT 0,
    last_edited_at TIMESTAMP,
    
    -- Final Version
    final_version TEXT,
    finalized_at TIMESTAMP,
    word_count INTEGER,
    
    -- Review & Feedback
    reviewed_by_counselor BOOLEAN DEFAULT FALSE,
    counselor_feedback TEXT,
    counselor_approved BOOLEAN,
    
    -- Submission
    submitted BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP,
    submission_method VARCHAR(50), -- "Online Portal", "Email", "Mail"
    
    -- Version History (store as JSONB array)
    version_history JSONB,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_essay_templates_application ON scholarship_essay_templates(application_id);
CREATE INDEX idx_essay_templates_student ON scholarship_essay_templates(student_id);

CREATE TRIGGER update_essay_templates_updated_at BEFORE UPDATE ON scholarship_essay_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active scholarships with upcoming deadlines
CREATE VIEW scholarships_upcoming_deadlines AS
SELECT 
    s.scholarship_id,
    s.name,
    s.organization,
    s.application_deadline,
    s.typical_award_amount,
    s.number_of_awards,
    (s.application_deadline - CURRENT_DATE) AS days_until_deadline
FROM scholarships s
WHERE s.active_status = TRUE
  AND s.application_deadline > CURRENT_DATE
  AND s.application_deadline <= CURRENT_DATE + INTERVAL '90 days'
ORDER BY s.application_deadline;

-- Student scholarship dashboard summary
CREATE VIEW student_scholarship_summary AS
SELECT 
    sm.student_id,
    COUNT(*) AS total_matches,
    COUNT(*) FILTER (WHERE sm.match_score >= 80) AS high_quality_matches,
    COUNT(*) FILTER (WHERE sm.application_status = 'not_started') AS not_started,
    COUNT(*) FILTER (WHERE sm.application_status = 'in_progress') AS in_progress,
    COUNT(*) FILTER (WHERE sm.application_status = 'submitted') AS submitted,
    COUNT(*) FILTER (WHERE sm.application_status = 'awarded') AS awarded,
    COALESCE(SUM(sa.award_amount) FILTER (WHERE sa.outcome = 'awarded'), 0) AS total_awarded_amount
FROM scholarship_matches sm
LEFT JOIN scholarship_applications sa ON sm.match_id = sa.match_id
WHERE sm.dismissed = FALSE
GROUP BY sm.student_id;

-- Scholarship effectiveness report
CREATE VIEW scholarship_effectiveness_report AS
SELECT 
    s.scholarship_id,
    s.name,
    s.organization,
    COUNT(sa.application_id) AS total_applications,
    COUNT(*) FILTER (WHERE sa.outcome = 'awarded') AS awards_granted,
    CASE 
        WHEN COUNT(sa.application_id) > 0 
        THEN (COUNT(*) FILTER (WHERE sa.outcome = 'awarded')::decimal / COUNT(sa.application_id) * 100)
        ELSE 0 
    END AS success_rate,
    COALESCE(AVG(sa.award_amount) FILTER (WHERE sa.outcome = 'awarded'), 0) AS avg_award_amount,
    COALESCE(SUM(sa.award_amount) FILTER (WHERE sa.outcome = 'awarded'), 0) AS total_awarded
FROM scholarships s
LEFT JOIN scholarship_applications sa ON s.scholarship_id = sa.scholarship_id
GROUP BY s.scholarship_id, s.name, s.organization
ORDER BY total_awarded DESC;

-- ============================================================================
-- COMMENTS / NOTES
-- ============================================================================
-- This schema provides:
-- 1. Comprehensive scholarship catalog with structured eligibility criteria
-- 2. AI/ML match scoring and tracking
-- 3. Complete application lifecycle management
-- 4. Outcome tracking for ROI and effectiveness measurement
-- 5. Essay template management with AI assistance
--
-- Key Features:
-- - JSONB for flexible, structured data (criteria, rationale, etc.)
-- - Automated deadline tracking and priority levels
-- - Complete audit trail for all scholarship interactions
-- - Support for renewable scholarships and disbursement tracking
-- - Views for common reporting needs
--
-- Next Steps:
-- 1. Build matching algorithm that populates scholarship_matches
-- 2. Create triggers to auto-update application status
-- 3. Implement notification system for deadline reminders
-- 4. Build scholarship scraping/API integration pipelines
-- ============================================================================
