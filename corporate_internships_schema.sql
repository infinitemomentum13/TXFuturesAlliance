-- ============================================================================
-- TX FUTURES ALLIANCE - CORPORATE PARTNERS & INTERNSHIPS SCHEMA
-- ============================================================================
-- Purpose: Manage corporate relationships, internship postings, student
--          placements, and workforce development pipeline
-- Last Updated: 2026-01-23
-- ============================================================================

-- ============================================================================
-- CORPORATE PARTNERS TABLE
-- Companies partnering with TX Futures Alliance
-- ============================================================================
CREATE TABLE corporate_partners (
    partner_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Company Information
    company_name VARCHAR(300) NOT NULL,
    legal_entity_name VARCHAR(300),
    industry_sector VARCHAR(100) NOT NULL,
    -- "Advanced Manufacturing", "Technology", "Energy", "Healthcare", 
    -- "Aerospace", "Automotive", "Robotics", "Semiconductors", etc.
    sub_sector VARCHAR(200),
    company_size VARCHAR(50),
    -- "Small (1-50)", "Medium (51-250)", "Large (251-1000)", "Enterprise (1000+)"
    
    -- Contact Information
    headquarters_location VARCHAR(300),
    rgv_location VARCHAR(300), -- Their location in RGV if applicable
    website TEXT,
    primary_contact_name VARCHAR(200) NOT NULL,
    primary_contact_title VARCHAR(200),
    primary_contact_email VARCHAR(255) NOT NULL,
    primary_contact_phone VARCHAR(20),
    
    -- Secondary Contacts
    hr_contact JSONB,
    workforce_contact JSONB,
    -- Example:
    -- {
    --   "name": "Jane Smith",
    --   "title": "Workforce Development Manager",
    --   "email": "jane@company.com",
    --   "phone": "555-1234"
    -- }
    
    -- Partnership Details
    partnership_tier VARCHAR(50) NOT NULL,
    -- "Bronze", "Silver", "Gold", "Platinum", "Founding"
    partnership_start_date DATE NOT NULL,
    partnership_end_date DATE,
    partnership_status VARCHAR(50) DEFAULT 'active',
    -- "active", "pending", "expired", "terminated", "on_hold"
    auto_renew BOOLEAN DEFAULT FALSE,
    
    -- Financial Commitment
    annual_contribution DECIMAL(10,2),
    contribution_type VARCHAR(100),
    -- "Cash", "In-Kind", "Scholarships", "Equipment", "Mixed"
    total_committed DECIMAL(12,2),
    total_disbursed DECIMAL(12,2) DEFAULT 0,
    payment_schedule JSONB,
    -- Array of payment installments
    
    -- Benefits & Access Levels
    benefits_package JSONB,
    -- Example:
    -- {
    --   "internship_postings": "Unlimited",
    --   "student_profile_access": true,
    --   "early_talent_access": true,
    --   "branding_opportunities": ["Logo on website", "Mentioned in grants"],
    --   "event_participation": ["Career fairs", "STEM nights"],
    --   "reporting_frequency": "Quarterly",
    --   "dedicated_account_manager": true
    -- }
    
    -- IAM/AAF Status (Advanced Manufacturing)
    iam_aaf_company BOOLEAN DEFAULT FALSE,
    manufacturing_facility_location VARCHAR(300),
    facility_construction_date DATE,
    expected_employment INTEGER,
    current_employment INTEGER,
    
    -- Workforce Needs
    workforce_needs JSONB,
    -- Example:
    -- {
    --   "immediate_needs": [
    --     {"role": "Manufacturing Technician", "headcount": 20, "timeline": "Q2 2025"},
    --     {"role": "Quality Inspector", "headcount": 5, "timeline": "Q3 2025"}
    --   ],
    --   "future_needs": [
    --     {"role": "Automation Engineer", "headcount": 10, "timeline": "2026"}
    --   ],
    --   "required_skills": ["Basic manufacturing", "Blueprint reading", "Quality control"],
    --   "training_programs_needed": ["CNC Operation", "Lean Manufacturing"],
    --   "internship_to_hire_rate": 60
    -- }
    
    -- Scholarship Sponsorship
    scholarship_sponsor BOOLEAN DEFAULT FALSE,
    scholarships_offered INTEGER DEFAULT 0,
    scholarship_total_value DECIMAL(10,2) DEFAULT 0,
    scholarship_criteria JSONB,
    
    -- Concrete Engine Participation
    concrete_engine_partner BOOLEAN DEFAULT FALSE,
    ce_modules_sponsored INTEGER DEFAULT 0,
    ce_student_cohorts_supported INTEGER DEFAULT 0,
    
    -- Engagement Tracking
    internship_postings_active INTEGER DEFAULT 0,
    total_internship_postings INTEGER DEFAULT 0,
    students_hired_to_date INTEGER DEFAULT 0,
    current_active_interns INTEGER DEFAULT 0,
    
    -- ROI & Impact Metrics
    roi_metrics JSONB,
    -- Example:
    -- {
    --   "cost_per_hire": 5000,
    --   "retention_rate": 85,
    --   "time_to_productivity_weeks": 8,
    --   "training_cost_savings": 50000,
    --   "community_goodwill_value": "High"
    -- }
    
    -- Agreement Documents
    partnership_agreement_url TEXT,
    data_use_agreement_url TEXT,
    nda_url TEXT,
    agreement_signed BOOLEAN DEFAULT FALSE,
    agreement_signed_date DATE,
    
    -- Notes & History
    partnership_notes TEXT,
    success_stories TEXT,
    challenges TEXT,
    
    -- Account Management
    account_manager UUID, -- Staff member managing this relationship
    last_contact_date DATE,
    next_contact_scheduled DATE,
    relationship_health VARCHAR(50),
    -- "Excellent", "Good", "Fair", "At Risk", "Poor"
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    CONSTRAINT chk_partnership_tier CHECK (partnership_tier IN 
        ('Bronze', 'Silver', 'Gold', 'Platinum', 'Founding', 'Custom')),
    CONSTRAINT chk_partnership_status CHECK (partnership_status IN 
        ('active', 'pending', 'expired', 'terminated', 'on_hold')),
    CONSTRAINT chk_relationship_health CHECK (relationship_health IN 
        ('Excellent', 'Good', 'Fair', 'At Risk', 'Poor', NULL))
);

-- Indexes
CREATE INDEX idx_partners_company ON corporate_partners(company_name);
CREATE INDEX idx_partners_industry ON corporate_partners(industry_sector);
CREATE INDEX idx_partners_tier ON corporate_partners(partnership_tier);
CREATE INDEX idx_partners_status ON corporate_partners(partnership_status);
CREATE INDEX idx_partners_iam ON corporate_partners(iam_aaf_company);
CREATE INDEX idx_partners_start_date ON corporate_partners(partnership_start_date);

CREATE TRIGGER update_corporate_partners_updated_at BEFORE UPDATE ON corporate_partners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INTERNSHIP POSTINGS TABLE
-- Job opportunities posted by corporate partners
-- ============================================================================
CREATE TABLE internship_postings (
    posting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID NOT NULL REFERENCES corporate_partners(partner_id) ON DELETE CASCADE,
    
    -- Job Information
    job_title VARCHAR(300) NOT NULL,
    job_category VARCHAR(100),
    -- "Manufacturing", "Engineering", "IT", "Quality", "Logistics", "Admin", etc.
    department VARCHAR(200),
    reports_to VARCHAR(200),
    
    -- Description
    description TEXT NOT NULL,
    responsibilities TEXT,
    learning_objectives TEXT,
    success_criteria TEXT,
    
    -- Requirements
    required_skills TEXT[] NOT NULL,
    -- ["Basic computer skills", "Blueprint reading", "Safety awareness"]
    preferred_skills TEXT[],
    required_education VARCHAR(100),
    -- "High School", "Some College", "Associates", "Bachelors"
    preferred_education VARCHAR(100),
    
    -- Academic Requirements
    minimum_gpa DECIMAL(4,3),
    required_grade_levels INTEGER[], -- [11, 12] for juniors and seniors
    academic_major_preference TEXT[],
    
    -- Technical Skills Matrix
    skills_matrix JSONB,
    -- Example:
    -- {
    --   "required": [
    --     {"skill": "Microsoft Office", "proficiency": "Intermediate"},
    --     {"skill": "Blueprint Reading", "proficiency": "Basic"}
    --   ],
    --   "preferred": [
    --     {"skill": "CAD Software", "proficiency": "Basic"},
    --     {"skill": "CNC Operation", "proficiency": "Beginner"}
    --   ],
    --   "will_train": ["Lean Manufacturing", "Quality Inspection"]
    -- }
    
    -- Location & Schedule
    location VARCHAR(300) NOT NULL,
    remote_option BOOLEAN DEFAULT FALSE,
    hybrid_option BOOLEAN DEFAULT FALSE,
    work_schedule VARCHAR(200),
    -- "Monday-Friday, 8am-5pm", "Flexible", "Rotating shifts", etc.
    
    -- Duration & Commitment
    duration_weeks INTEGER NOT NULL,
    hours_per_week DECIMAL(4,1) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    flexible_start BOOLEAN DEFAULT FALSE,
    
    -- Compensation
    pay_type VARCHAR(50) NOT NULL,
    -- "Hourly", "Stipend", "Unpaid", "Credit Only"
    pay_rate DECIMAL(8,2),
    pay_currency VARCHAR(3) DEFAULT 'USD',
    benefits TEXT,
    -- "Housing assistance", "Transportation stipend", "Meals provided", etc.
    
    -- Conversion Opportunity
    potential_for_hire BOOLEAN DEFAULT FALSE,
    estimated_conversion_rate DECIMAL(5,2),
    full_time_salary_range VARCHAR(100),
    
    -- Application Process
    application_deadline DATE NOT NULL,
    positions_available INTEGER NOT NULL DEFAULT 1,
    positions_filled INTEGER DEFAULT 0,
    application_instructions TEXT,
    required_documents TEXT[],
    -- ["Resume", "Cover Letter", "Transcript", "Letter of Recommendation"]
    
    -- Screening Process
    screening_process JSONB,
    -- Example:
    -- {
    --   "stages": [
    --     {"stage": "Application Review", "duration_days": 7},
    --     {"stage": "Phone Screen", "duration_days": 3},
    --     {"stage": "In-Person Interview", "duration_days": 14},
    --     {"stage": "Skills Assessment", "duration_days": 7},
    --     {"stage": "Final Decision", "duration_days": 7}
    --   ],
    --   "total_timeline_days": 38,
    --   "contact_person": "HR Manager"
    -- }
    
    -- Matching Criteria
    auto_match_enabled BOOLEAN DEFAULT TRUE,
    match_algorithm_version VARCHAR(50),
    target_student_profile JSONB,
    -- Criteria for ideal candidate
    
    -- Posting Status
    posting_status VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- "draft", "published", "closed", "filled", "cancelled", "on_hold"
    published_date TIMESTAMP,
    closed_date TIMESTAMP,
    
    -- Visibility
    visible_to_students BOOLEAN DEFAULT FALSE,
    featured_posting BOOLEAN DEFAULT FALSE,
    priority_level INTEGER DEFAULT 5, -- 1-10, higher = more important
    
    -- Application Statistics
    total_views INTEGER DEFAULT 0,
    total_applications INTEGER DEFAULT 0,
    applications_in_review INTEGER DEFAULT 0,
    interviews_scheduled INTEGER DEFAULT 0,
    offers_extended INTEGER DEFAULT 0,
    offers_accepted INTEGER DEFAULT 0,
    
    -- Diversity Goals
    diversity_hiring_goal BOOLEAN DEFAULT FALSE,
    diversity_criteria TEXT,
    -- "Encourage applications from women in STEM", "First-generation students", etc.
    
    -- Notes
    internal_notes TEXT,
    public_notes TEXT,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    CONSTRAINT chk_posting_status CHECK (posting_status IN 
        ('draft', 'published', 'closed', 'filled', 'cancelled', 'on_hold')),
    CONSTRAINT chk_pay_type CHECK (pay_type IN 
        ('Hourly', 'Stipend', 'Unpaid', 'Credit Only')),
    CONSTRAINT chk_positions CHECK (positions_filled <= positions_available),
    CONSTRAINT chk_priority CHECK (priority_level BETWEEN 1 AND 10)
);

-- Indexes
CREATE INDEX idx_postings_partner ON internship_postings(partner_id);
CREATE INDEX idx_postings_status ON internship_postings(posting_status);
CREATE INDEX idx_postings_deadline ON internship_postings(application_deadline);
CREATE INDEX idx_postings_start_date ON internship_postings(start_date);
CREATE INDEX idx_postings_category ON internship_postings(job_category);
CREATE INDEX idx_postings_published ON internship_postings(published_date);
CREATE INDEX idx_postings_visible ON internship_postings(visible_to_students);

CREATE TRIGGER update_internship_postings_updated_at BEFORE UPDATE ON internship_postings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INTERNSHIP APPLICATIONS TABLE
-- Student applications to internship postings
-- ============================================================================
CREATE TABLE internship_applications (
    application_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    posting_id UUID NOT NULL REFERENCES internship_postings(posting_id) ON DELETE CASCADE,
    
    -- Application Timeline
    application_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Application Status
    status VARCHAR(50) NOT NULL DEFAULT 'submitted',
    -- "submitted", "under_review", "phone_screen_scheduled", "interview_scheduled",
    -- "skills_assessment", "reference_check", "offered", "accepted", "declined", "rejected", "withdrawn"
    status_updated_at TIMESTAMP,
    
    -- Status History (track all status changes)
    status_history JSONB,
    -- Example:
    -- [
    --   {"status": "submitted", "timestamp": "2024-01-15T10:00:00Z", "updated_by": "student"},
    --   {"status": "under_review", "timestamp": "2024-01-16T14:30:00Z", "updated_by": "hr_manager"},
    --   {"status": "interview_scheduled", "timestamp": "2024-01-20T09:00:00Z", "updated_by": "hr_manager"}
    -- ]
    
    -- Submitted Documents
    resume_url TEXT,
    cover_letter_url TEXT,
    transcript_url TEXT,
    recommendation_letters TEXT[], -- Array of URLs
    other_documents JSONB,
    
    -- Application Answers (if posting has specific questions)
    application_responses JSONB,
    -- Example:
    -- {
    --   "why_interested": "Text response...",
    --   "relevant_experience": "Text response...",
    --   "availability": "June-August 2025",
    --   "transportation": "Yes",
    --   "custom_question_1": "Response..."
    -- }
    
    -- Skills Self-Assessment
    skills_claimed TEXT[],
    skills_proficiency JSONB,
    -- Example: {"Skill Name": "Proficiency Level"}
    
    -- Interview Details
    interview_scheduled BOOLEAN DEFAULT FALSE,
    interview_date TIMESTAMP,
    interview_type VARCHAR(50), -- "Phone", "Video", "In-Person", "Panel"
    interview_location TEXT,
    interview_notes TEXT, -- From interviewer
    interview_rating DECIMAL(3,1), -- 1-10 scale
    
    -- Skills Assessment
    assessment_required BOOLEAN DEFAULT FALSE,
    assessment_scheduled BOOLEAN DEFAULT FALSE,
    assessment_date TIMESTAMP,
    assessment_completed BOOLEAN DEFAULT FALSE,
    assessment_score DECIMAL(5,2),
    assessment_notes TEXT,
    
    -- References
    references_requested BOOLEAN DEFAULT FALSE,
    references_received INTEGER DEFAULT 0,
    reference_contacts JSONB,
    
    -- Offer Details
    offer_extended BOOLEAN DEFAULT FALSE,
    offer_date TIMESTAMP,
    offer_letter_url TEXT,
    offer_details JSONB,
    -- Example:
    -- {
    --   "pay_rate": 18.00,
    --   "hours_per_week": 20,
    --   "start_date": "2025-06-01",
    --   "end_date": "2025-08-15",
    --   "benefits": ["Transportation stipend"],
    --   "offer_expires": "2025-05-01"
    -- }
    
    offer_response VARCHAR(50),
    -- "accepted", "declined", "negotiating", "pending"
    offer_response_date TIMESTAMP,
    decline_reason TEXT,
    
    -- Match Score (from AI matching algorithm)
    match_score DECIMAL(5,2), -- 0-100
    match_rationale JSONB,
    
    -- Company Feedback
    company_rating DECIMAL(3,1), -- Company's rating of candidate (1-10)
    company_notes TEXT,
    recommended_for_hire BOOLEAN,
    
    -- Platform Assistance
    counselor_assisted BOOLEAN DEFAULT FALSE,
    assistance_provided TEXT[],
    -- ["Resume review", "Interview prep", "Skills training"]
    
    -- Communication Log
    communications JSONB,
    -- Array of all communications between student and company
    
    -- Notes
    student_notes TEXT,
    counselor_notes TEXT,
    internal_notes TEXT,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate applications
    UNIQUE(student_id, posting_id),
    
    CONSTRAINT chk_app_status CHECK (status IN 
        ('submitted', 'under_review', 'phone_screen_scheduled', 'interview_scheduled',
         'skills_assessment', 'reference_check', 'offered', 'accepted', 'declined', 'rejected', 'withdrawn')),
    CONSTRAINT chk_offer_response CHECK (offer_response IN 
        ('accepted', 'declined', 'negotiating', 'pending', NULL)),
    CONSTRAINT chk_match_score CHECK (match_score BETWEEN 0 AND 100)
);

-- Indexes
CREATE INDEX idx_int_apps_student ON internship_applications(student_id);
CREATE INDEX idx_int_apps_posting ON internship_applications(posting_id);
CREATE INDEX idx_int_apps_status ON internship_applications(status);
CREATE INDEX idx_int_apps_date ON internship_applications(application_date);
CREATE INDEX idx_int_apps_match_score ON internship_applications(match_score DESC);

CREATE TRIGGER update_internship_applications_updated_at BEFORE UPDATE ON internship_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STUDENT PLACEMENTS TABLE
-- Track active internships and outcomes
-- ============================================================================
CREATE TABLE student_placements (
    placement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES corporate_partners(partner_id) ON DELETE CASCADE,
    posting_id UUID REFERENCES internship_postings(posting_id),
    application_id UUID REFERENCES internship_applications(application_id),
    
    -- Placement Details
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    actual_end_date DATE, -- May differ from planned
    
    -- Work Details
    job_title VARCHAR(300) NOT NULL,
    department VARCHAR(200),
    supervisor_name VARCHAR(200),
    supervisor_email VARCHAR(255),
    supervisor_phone VARCHAR(20),
    
    -- Schedule & Commitment
    scheduled_hours_per_week DECIMAL(4,1),
    actual_hours_per_week DECIMAL(4,1),
    total_hours_planned DECIMAL(7,2),
    total_hours_completed DECIMAL(7,2) DEFAULT 0,
    
    -- Compensation
    pay_rate DECIMAL(8,2),
    total_compensation DECIMAL(10,2),
    
    -- Performance Tracking
    performance_reviews JSONB,
    -- Array of review periods
    -- [
    --   {
    --     "review_date": "2025-07-01",
    --     "reviewer": "Supervisor Name",
    --     "ratings": {
    --       "technical_skills": 8,
    --       "work_quality": 9,
    --       "attendance": 10,
    --       "teamwork": 8,
    --       "professionalism": 9
    --     },
    --     "strengths": "...",
    --     "areas_for_improvement": "...",
    --     "overall_rating": 8.8,
    --     "recommend_for_hire": true
    --   }
    -- ]
    
    latest_performance_rating DECIMAL(3,1),
    
    -- Skills Development
    skills_learned TEXT[],
    certifications_earned TEXT[],
    training_completed TEXT[],
    
    -- Attendance Tracking
    attendance_rate DECIMAL(5,2), -- Percentage
    days_absent INTEGER DEFAULT 0,
    days_tardy INTEGER DEFAULT 0,
    attendance_issues BOOLEAN DEFAULT FALSE,
    
    -- Project Assignments
    projects_assigned JSONB,
    -- [
    --   {
    --     "project_name": "Quality Improvement Initiative",
    --     "description": "...",
    --     "start_date": "2025-06-15",
    --     "completion_date": "2025-07-30",
    --     "impact": "Reduced defect rate by 15%"
    --   }
    -- ]
    
    -- Outcomes
    completion_status VARCHAR(50) NOT NULL DEFAULT 'active',
    -- "active", "completed_successfully", "completed_with_issues", "terminated_early", "abandoned"
    termination_reason TEXT,
    
    -- Conversion to Employment
    offered_full_time BOOLEAN DEFAULT FALSE,
    accepted_full_time BOOLEAN,
    full_time_start_date DATE,
    full_time_salary DECIMAL(10,2),
    full_time_position VARCHAR(300),
    
    -- Student Feedback
    student_satisfaction_rating DECIMAL(3,1), -- 1-10
    student_feedback TEXT,
    would_recommend BOOLEAN,
    would_work_again BOOLEAN,
    
    -- Company Feedback
    company_satisfaction_rating DECIMAL(3,1),
    company_feedback TEXT,
    would_hire_again BOOLEAN,
    
    -- Platform Effectiveness
    placement_through_platform BOOLEAN DEFAULT TRUE,
    support_provided TEXT[],
    issues_encountered TEXT[],
    
    -- Notes
    student_notes TEXT,
    supervisor_notes TEXT,
    counselor_notes TEXT,
    internal_notes TEXT,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_completion_status CHECK (completion_status IN 
        ('active', 'completed_successfully', 'completed_with_issues', 'terminated_early', 'abandoned'))
);

-- Indexes
CREATE INDEX idx_placements_student ON student_placements(student_id);
CREATE INDEX idx_placements_partner ON student_placements(partner_id);
CREATE INDEX idx_placements_posting ON student_placements(posting_id);
CREATE INDEX idx_placements_status ON student_placements(completion_status);
CREATE INDEX idx_placements_start_date ON student_placements(start_date);
CREATE INDEX idx_placements_end_date ON student_placements(end_date);
CREATE INDEX idx_placements_offered_ft ON student_placements(offered_full_time);

CREATE TRIGGER update_student_placements_updated_at BEFORE UPDATE ON student_placements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CORPORATE PARTNER ANALYTICS TABLE
-- Track ROI and effectiveness metrics for partners
-- ============================================================================
CREATE TABLE corporate_partner_analytics (
    analytics_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID NOT NULL REFERENCES corporate_partners(partner_id) ON DELETE CASCADE,
    
    -- Time Period
    reporting_period VARCHAR(20) NOT NULL, -- "Q1 2025", "2024 Annual", etc.
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    
    -- Recruitment Metrics
    postings_created INTEGER DEFAULT 0,
    total_applications_received INTEGER DEFAULT 0,
    qualified_applications INTEGER DEFAULT 0,
    interviews_conducted INTEGER DEFAULT 0,
    offers_extended INTEGER DEFAULT 0,
    offers_accepted INTEGER DEFAULT 0,
    
    -- Conversion Metrics
    application_to_interview_rate DECIMAL(5,2),
    interview_to_offer_rate DECIMAL(5,2),
    offer_acceptance_rate DECIMAL(5,2),
    overall_conversion_rate DECIMAL(5,2),
    
    -- Placement Metrics
    active_placements INTEGER DEFAULT 0,
    completed_placements INTEGER DEFAULT 0,
    successful_completions INTEGER DEFAULT 0,
    early_terminations INTEGER DEFAULT 0,
    
    -- Performance Metrics
    avg_student_performance_rating DECIMAL(3,1),
    avg_attendance_rate DECIMAL(5,2),
    skills_certifications_earned INTEGER DEFAULT 0,
    
    -- Hiring Metrics
    interns_converted_to_ft INTEGER DEFAULT 0,
    conversion_to_ft_rate DECIMAL(5,2),
    avg_time_to_hire_days DECIMAL(6,2),
    
    -- Financial Metrics
    total_compensation_paid DECIMAL(12,2),
    cost_per_placement DECIMAL(10,2),
    cost_per_hire DECIMAL(10,2),
    training_cost_savings DECIMAL(10,2),
    estimated_roi_percentage DECIMAL(5,2),
    
    -- Diversity Metrics
    female_placements INTEGER DEFAULT 0,
    minority_placements INTEGER DEFAULT 0,
    first_gen_placements INTEGER DEFAULT 0,
    diversity_percentage DECIMAL(5,2),
    
    -- Satisfaction Metrics
    avg_company_satisfaction DECIMAL(3,1),
    avg_student_satisfaction DECIMAL(3,1),
    recommendation_rate DECIMAL(5,2), -- % who would recommend
    
    -- Pipeline Health
    qualified_candidates_available INTEGER DEFAULT 0,
    future_needs_matched INTEGER DEFAULT 0,
    talent_pipeline_strength VARCHAR(50),
    -- "Strong", "Adequate", "Weak", "Needs Development"
    
    -- Community Impact
    students_served INTEGER DEFAULT 0,
    scholarships_awarded INTEGER DEFAULT 0,
    scholarship_dollars DECIMAL(10,2) DEFAULT 0,
    community_events_participated INTEGER DEFAULT 0,
    
    -- Notes
    key_achievements TEXT,
    challenges_identified TEXT,
    recommendations TEXT,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_rates CHECK (
        (application_to_interview_rate IS NULL OR application_to_interview_rate BETWEEN 0 AND 100) AND
        (interview_to_offer_rate IS NULL OR interview_to_offer_rate BETWEEN 0 AND 100) AND
        (offer_acceptance_rate IS NULL OR offer_acceptance_rate BETWEEN 0 AND 100) AND
        (overall_conversion_rate IS NULL OR overall_conversion_rate BETWEEN 0 AND 100)
    )
);

-- Indexes
CREATE INDEX idx_analytics_partner ON corporate_partner_analytics(partner_id);
CREATE INDEX idx_analytics_period ON corporate_partner_analytics(reporting_period);
CREATE INDEX idx_analytics_dates ON corporate_partner_analytics(period_start_date, period_end_date);

CREATE TRIGGER update_analytics_updated_at BEFORE UPDATE ON corporate_partner_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active internship opportunities
CREATE VIEW active_internship_opportunities AS
SELECT 
    ip.posting_id,
    ip.job_title,
    ip.job_category,
    cp.company_name,
    ip.location,
    ip.pay_rate,
    ip.pay_type,
    ip.duration_weeks,
    ip.application_deadline,
    ip.start_date,
    (ip.positions_available - ip.positions_filled) AS positions_remaining,
    ip.total_applications,
    ip.priority_level
FROM internship_postings ip
JOIN corporate_partners cp ON ip.partner_id = cp.partner_id
WHERE ip.posting_status = 'published'
  AND ip.visible_to_students = TRUE
  AND ip.application_deadline >= CURRENT_DATE
  AND ip.positions_filled < ip.positions_available
ORDER BY ip.application_deadline, ip.priority_level DESC;

-- Student internship dashboard
CREATE VIEW student_internship_dashboard AS
SELECT 
    ia.student_id,
    COUNT(*) FILTER (WHERE ia.status IN ('submitted', 'under_review')) AS applications_pending,
    COUNT(*) FILTER (WHERE ia.status LIKE '%interview%') AS interviews_scheduled,
    COUNT(*) FILTER (WHERE ia.status = 'offered') AS offers_received,
    COUNT(*) FILTER (WHERE ia.status = 'accepted') AS offers_accepted,
    COUNT(DISTINCT sp.placement_id) AS active_placements,
    MAX(ia.application_date) AS last_application_date
FROM internship_applications ia
LEFT JOIN student_placements sp ON ia.student_id = sp.student_id AND sp.completion_status = 'active'
GROUP BY ia.student_id;

-- Corporate partner effectiveness
CREATE VIEW corporate_partner_effectiveness AS
SELECT 
    cp.partner_id,
    cp.company_name,
    cp.partnership_tier,
    COUNT(DISTINCT ip.posting_id) AS total_postings,
    COUNT(DISTINCT ia.application_id) AS total_applications,
    COUNT(DISTINCT sp.placement_id) AS total_placements,
    COUNT(*) FILTER (WHERE sp.completion_status = 'completed_successfully') AS successful_placements,
    COUNT(*) FILTER (WHERE sp.offered_full_time = TRUE) AS full_time_offers,
    AVG(sp.latest_performance_rating) AS avg_performance_rating,
    AVG(sp.company_satisfaction_rating) AS avg_satisfaction
FROM corporate_partners cp
LEFT JOIN internship_postings ip ON cp.partner_id = ip.partner_id
LEFT JOIN internship_applications ia ON ip.posting_id = ia.posting_id
LEFT JOIN student_placements sp ON ia.student_id = sp.student_id AND ia.posting_id = sp.posting_id
WHERE cp.partnership_status = 'active'
GROUP BY cp.partner_id, cp.company_name, cp.partnership_tier
ORDER BY total_placements DESC;

-- ============================================================================
-- COMMENTS / NOTES
-- ============================================================================
-- This schema provides:
-- 1. Complete corporate partnership management
-- 2. Internship posting and application lifecycle
-- 3. Student placement tracking with performance reviews
-- 4. Analytics and ROI measurement for partners
-- 5. Workforce pipeline visibility
--
-- Key Features:
-- - IAM/AAF company tracking (advanced manufacturing focus)
-- - Concrete Engine partnership integration
-- - Diversity hiring goal tracking
-- - Intern-to-hire conversion metrics
-- - Complete feedback loops (student + company satisfaction)
-- - Views for common dashboard queries
--
-- Integration Points:
-- - Student profiles for matching
-- - Concrete Engine for skills development
-- - Scholarship system for corporate sponsorships
-- - Academic tracking for eligibility verification
--
-- Next Steps:
-- 1. Build internship matching algorithm
-- 2. Create automated application workflow
-- 3. Implement performance review scheduling
-- 4. Develop partner portal for self-service posting
-- 5. Build ROI calculator for partners
-- ============================================================================
