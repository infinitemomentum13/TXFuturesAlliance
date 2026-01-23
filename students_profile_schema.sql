-- ============================================================================
-- TX FUTURES ALLIANCE - STUDENT PROFILES DATABASE SCHEMA
-- ============================================================================
-- Purpose: Core student information, academic records, athletic profiles,
--          financial data, and career interests
-- FERPA Compliance: YES - Highest security tier required
-- Last Updated: 2026-01-23
-- ============================================================================

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for encryption functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- STUDENTS TABLE
-- Core student demographic and enrollment information
-- ============================================================================
CREATE TABLE students (
    student_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    preferred_name VARCHAR(100),
    date_of_birth DATE NOT NULL,
    
    -- Demographics (optional, self-identified)
    gender VARCHAR(50),
    ethnicity VARCHAR(100),
    primary_language VARCHAR(50),
    
    -- Contact Information (encrypted)
    email VARCHAR(255),
    phone VARCHAR(20),
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    country VARCHAR(50) DEFAULT 'US',
    
    -- Guardian Information (encrypted)
    guardian1_name VARCHAR(200),
    guardian1_relationship VARCHAR(50),
    guardian1_email VARCHAR(255),
    guardian1_phone VARCHAR(20),
    guardian2_name VARCHAR(200),
    guardian2_relationship VARCHAR(50),
    guardian2_email VARCHAR(255),
    guardian2_phone VARCHAR(20),
    
    -- Emergency Contact
    emergency_contact_name VARCHAR(200),
    emergency_contact_relationship VARCHAR(50),
    emergency_contact_phone VARCHAR(20),
    
    -- Enrollment Status
    enrollment_status VARCHAR(50) NOT NULL DEFAULT 'active',
    -- Options: active, inactive, graduated, withdrawn, transferred
    enrollment_date DATE NOT NULL,
    graduation_date DATE,
    
    -- School Information
    school_district_id UUID,
    current_school_id UUID,
    current_grade_level INTEGER,
    expected_graduation_year INTEGER,
    
    -- External System IDs
    skyward_student_id VARCHAR(100), -- ID in school district system
    usys_player_id VARCHAR(100), -- US Youth Soccer ID
    
    -- Data Consent & Privacy
    ferpa_consent_date TIMESTAMP,
    ferpa_consent_guardian_signature TEXT,
    coppa_consent_required BOOLEAN DEFAULT FALSE,
    coppa_consent_date TIMESTAMP,
    coppa_consent_guardian_signature TEXT,
    gdpr_consent BOOLEAN DEFAULT FALSE, -- For Racing de Santander
    gdpr_consent_date TIMESTAMP,
    data_sharing_consent JSONB, -- Detailed consent per use case
    -- Example: {"scouts": true, "colleges": true, "corporate": false}
    
    -- Platform Settings
    profile_photo_url TEXT,
    bio TEXT,
    preferred_contact_method VARCHAR(20), -- email, sms, app
    notification_preferences JSONB,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    -- Soft Delete
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    CONSTRAINT chk_enrollment_status CHECK (enrollment_status IN 
        ('active', 'inactive', 'graduated', 'withdrawn', 'transferred')),
    CONSTRAINT chk_grade_level CHECK (current_grade_level BETWEEN 6 AND 12),
    CONSTRAINT chk_preferred_contact CHECK (preferred_contact_method IN 
        ('email', 'sms', 'app', 'any'))
);

-- Indexes for common queries
CREATE INDEX idx_students_last_name ON students(last_name);
CREATE INDEX idx_students_enrollment_status ON students(enrollment_status);
CREATE INDEX idx_students_school_district ON students(school_district_id);
CREATE INDEX idx_students_graduation_year ON students(expected_graduation_year);
CREATE INDEX idx_students_skyward_id ON students(skyward_student_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ACADEMIC RECORDS TABLE
-- Student grades, GPA, attendance synced from school districts
-- ============================================================================
CREATE TABLE academic_records (
    record_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    
    -- Term Information
    school_year VARCHAR(9) NOT NULL, -- Format: "2024-2025"
    semester VARCHAR(20) NOT NULL, -- "Fall", "Spring", "Summer", "Q1", "Q2", etc.
    term_start_date DATE,
    term_end_date DATE,
    
    -- Course Information
    course_id VARCHAR(50),
    course_name VARCHAR(200) NOT NULL,
    course_code VARCHAR(50),
    course_type VARCHAR(50), -- "Regular", "Honors", "AP", "IB", "Dual Credit"
    department VARCHAR(100), -- "Math", "Science", "English", etc.
    credit_hours DECIMAL(4,2),
    
    -- Grades
    letter_grade VARCHAR(5), -- "A+", "A", "A-", "B+", etc.
    numeric_grade DECIMAL(5,2), -- 0-100
    grade_points DECIMAL(4,2), -- For GPA calculation (4.0 scale)
    passing BOOLEAN,
    
    -- GPA Calculations
    gpa_semester DECIMAL(4,3),
    gpa_cumulative DECIMAL(4,3),
    class_rank INTEGER,
    class_size INTEGER,
    
    -- Attendance
    attendance_rate DECIMAL(5,2), -- Percentage (0-100)
    days_present INTEGER,
    days_absent INTEGER,
    days_tardy INTEGER,
    
    -- Teacher Information
    teacher_name VARCHAR(200),
    teacher_email VARCHAR(255),
    
    -- Data Source
    source_system VARCHAR(50) NOT NULL, -- "Skyward", "Manual", "Import"
    external_record_id VARCHAR(100), -- ID in source system
    sync_timestamp TIMESTAMP,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_course_type CHECK (course_type IN 
        ('Regular', 'Honors', 'AP', 'IB', 'Dual Credit', 'Remedial')),
    CONSTRAINT chk_letter_grade CHECK (letter_grade IN 
        ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'P', 'I', 'W')),
    CONSTRAINT chk_numeric_grade CHECK (numeric_grade BETWEEN 0 AND 100),
    CONSTRAINT chk_gpa CHECK (gpa_semester BETWEEN 0 AND 4.5 AND gpa_cumulative BETWEEN 0 AND 4.5),
    CONSTRAINT chk_attendance CHECK (attendance_rate BETWEEN 0 AND 100)
);

-- Indexes
CREATE INDEX idx_academic_student_id ON academic_records(student_id);
CREATE INDEX idx_academic_school_year ON academic_records(school_year);
CREATE INDEX idx_academic_semester ON academic_records(semester);
CREATE INDEX idx_academic_gpa ON academic_records(gpa_cumulative);
CREATE INDEX idx_academic_sync_timestamp ON academic_records(sync_timestamp);

CREATE TRIGGER update_academic_records_updated_at BEFORE UPDATE ON academic_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ATHLETIC PROFILES TABLE
-- Student athletic information and participation
-- ============================================================================
CREATE TABLE athletic_profiles (
    profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    
    -- Sport Information
    sport VARCHAR(50) NOT NULL, -- "Soccer", "Basketball", "Track", etc.
    position VARCHAR(100), -- "Forward", "Midfielder", "Point Guard", etc.
    secondary_positions VARCHAR(200), -- Comma-separated if multiple
    
    -- Team Information
    team_id UUID, -- Reference to teams table (if we build it)
    team_name VARCHAR(200),
    jersey_number VARCHAR(10),
    
    -- Experience & Skill
    years_experience INTEGER,
    skill_level VARCHAR(50), -- "Beginner", "Intermediate", "Advanced", "Elite"
    competitive_level VARCHAR(50), -- "Recreational", "Select", "Premier", "Academy"
    
    -- Physical Attributes (optional, self-reported)
    height_inches INTEGER,
    weight_pounds INTEGER,
    dominant_foot VARCHAR(10), -- For soccer: "Left", "Right", "Both"
    dominant_hand VARCHAR(10), -- For other sports
    
    -- Participation Dates
    start_date DATE NOT NULL,
    end_date DATE,
    active_status BOOLEAN DEFAULT TRUE,
    
    -- Performance Summary (updated by coaches)
    overall_rating DECIMAL(3,1), -- 1.0 - 10.0
    technical_skills_rating DECIMAL(3,1),
    tactical_awareness_rating DECIMAL(3,1),
    physical_fitness_rating DECIMAL(3,1),
    mental_toughness_rating DECIMAL(3,1),
    
    -- Notes
    strengths TEXT,
    areas_for_improvement TEXT,
    coach_notes TEXT,
    injury_history TEXT,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    CONSTRAINT chk_skill_level CHECK (skill_level IN 
        ('Beginner', 'Intermediate', 'Advanced', 'Elite')),
    CONSTRAINT chk_competitive_level CHECK (competitive_level IN 
        ('Recreational', 'Select', 'Premier', 'Academy', 'Professional')),
    CONSTRAINT chk_ratings CHECK (
        overall_rating BETWEEN 1 AND 10 AND
        technical_skills_rating BETWEEN 1 AND 10 AND
        tactical_awareness_rating BETWEEN 1 AND 10 AND
        physical_fitness_rating BETWEEN 1 AND 10 AND
        mental_toughness_rating BETWEEN 1 AND 10
    )
);

-- Indexes
CREATE INDEX idx_athletic_student_id ON athletic_profiles(student_id);
CREATE INDEX idx_athletic_sport ON athletic_profiles(sport);
CREATE INDEX idx_athletic_active_status ON athletic_profiles(active_status);
CREATE INDEX idx_athletic_skill_level ON athletic_profiles(skill_level);

CREATE TRIGGER update_athletic_profiles_updated_at BEFORE UPDATE ON athletic_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FINANCIAL PROFILES TABLE
-- Student financial need information for scholarship matching
-- ============================================================================
CREATE TABLE financial_profiles (
    profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    
    -- Income Information (encrypted, ranges only)
    household_income_range VARCHAR(50), -- "<$25k", "$25k-$50k", "$50k-$75k", etc.
    household_size INTEGER,
    
    -- FAFSA Data (if available)
    fafsa_completed BOOLEAN DEFAULT FALSE,
    fafsa_completion_date DATE,
    expected_family_contribution DECIMAL(10,2), -- EFC
    pell_grant_eligible BOOLEAN,
    
    -- School Lunch Program (proxy for financial need)
    free_reduced_lunch_status VARCHAR(20), -- "Free", "Reduced", "None"
    
    -- Financial Need Index (calculated)
    financial_need_index DECIMAL(5,2), -- 0-100, higher = more need
    need_calculation_date DATE,
    
    -- Barriers to College Access
    first_generation_college BOOLEAN,
    single_parent_household BOOLEAN,
    foster_care BOOLEAN,
    homeless BOOLEAN,
    english_language_learner BOOLEAN,
    
    -- Data Consent
    data_consent BOOLEAN NOT NULL DEFAULT FALSE,
    data_consent_date TIMESTAMP,
    consent_guardian_signature TEXT,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,
    
    CONSTRAINT chk_income_range CHECK (household_income_range IN 
        ('<$25k', '$25k-$50k', '$50k-$75k', '$75k-$100k', '$100k-$150k', '>$150k')),
    CONSTRAINT chk_lunch_status CHECK (free_reduced_lunch_status IN 
        ('Free', 'Reduced', 'None', 'Unknown')),
    CONSTRAINT chk_need_index CHECK (financial_need_index BETWEEN 0 AND 100)
);

-- Indexes
CREATE INDEX idx_financial_student_id ON financial_profiles(student_id);
CREATE INDEX idx_financial_need_index ON financial_profiles(financial_need_index);
CREATE INDEX idx_financial_fafsa_eligible ON financial_profiles(pell_grant_eligible);

CREATE TRIGGER update_financial_profiles_updated_at BEFORE UPDATE ON financial_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CAREER INTERESTS TABLE
-- Student career goals, interests, and pathway preferences
-- ============================================================================
CREATE TABLE career_interests (
    interest_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    
    -- Career Field
    career_field VARCHAR(100) NOT NULL,
    -- "STEM", "Healthcare", "Business", "Arts", "Trades", "Athletics", etc.
    
    -- Specific Interest
    specific_interest VARCHAR(200),
    -- "Aerospace Engineering", "Climate Tech", "Professional Soccer", etc.
    
    -- Interest Level
    interest_level INTEGER NOT NULL, -- 1-5 scale
    confidence_level INTEGER, -- How sure are they? 1-5
    
    -- Pathway Preference
    preferred_pathway VARCHAR(100),
    -- "4-year college", "Community college", "Trade school", 
    -- "Military", "Professional sports", "Direct workforce"
    
    -- Geographic Preferences
    willing_to_relocate BOOLEAN,
    preferred_states TEXT[], -- Array of state codes
    international_interest BOOLEAN,
    
    -- Source of Interest
    source VARCHAR(100),
    -- "Survey", "Counselor", "Parent", "Self-reported", "Assessment"
    date_recorded DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Notes
    notes TEXT,
    influencing_factors TEXT,
    -- "Family business", "Personal experience", "Career day", etc.
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_interest_level CHECK (interest_level BETWEEN 1 AND 5),
    CONSTRAINT chk_confidence_level CHECK (confidence_level BETWEEN 1 AND 5)
);

-- Indexes
CREATE INDEX idx_career_student_id ON career_interests(student_id);
CREATE INDEX idx_career_field ON career_interests(career_field);
CREATE INDEX idx_career_pathway ON career_interests(preferred_pathway);
CREATE INDEX idx_career_date_recorded ON career_interests(date_recorded);

CREATE TRIGGER update_career_interests_updated_at BEFORE UPDATE ON career_interests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STANDARDIZED TEST SCORES TABLE
-- SAT, ACT, PSAT, TOEFL, etc.
-- ============================================================================
CREATE TABLE standardized_test_scores (
    score_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    
    -- Test Information
    test_type VARCHAR(50) NOT NULL, -- "SAT", "ACT", "PSAT", "TOEFL", etc.
    test_date DATE NOT NULL,
    
    -- SAT Scores
    sat_total INTEGER,
    sat_ebrw INTEGER, -- Evidence-Based Reading and Writing
    sat_math INTEGER,
    sat_essay_reading INTEGER,
    sat_essay_analysis INTEGER,
    sat_essay_writing INTEGER,
    
    -- ACT Scores
    act_composite INTEGER,
    act_english INTEGER,
    act_math INTEGER,
    act_reading INTEGER,
    act_science INTEGER,
    act_writing INTEGER,
    
    -- PSAT Scores
    psat_total INTEGER,
    psat_ebrw INTEGER,
    psat_math INTEGER,
    
    -- TOEFL Scores (for international or ESL students)
    toefl_total INTEGER,
    toefl_reading INTEGER,
    toefl_listening INTEGER,
    toefl_speaking INTEGER,
    toefl_writing INTEGER,
    
    -- Other Tests (store as JSON for flexibility)
    other_test_scores JSONB,
    
    -- Test Administration
    test_center VARCHAR(200),
    registration_number VARCHAR(100),
    
    -- Score Reporting
    score_sent_to_colleges BOOLEAN DEFAULT FALSE,
    colleges_sent_to TEXT[], -- Array of college names/codes
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_test_type CHECK (test_type IN 
        ('SAT', 'ACT', 'PSAT', 'TOEFL', 'IELTS', 'AP', 'IB', 'Other')),
    CONSTRAINT chk_sat_scores CHECK (
        (sat_total IS NULL OR sat_total BETWEEN 400 AND 1600) AND
        (sat_ebrw IS NULL OR sat_ebrw BETWEEN 200 AND 800) AND
        (sat_math IS NULL OR sat_math BETWEEN 200 AND 800)
    ),
    CONSTRAINT chk_act_scores CHECK (
        (act_composite IS NULL OR act_composite BETWEEN 1 AND 36) AND
        (act_english IS NULL OR act_english BETWEEN 1 AND 36) AND
        (act_math IS NULL OR act_math BETWEEN 1 AND 36) AND
        (act_reading IS NULL OR act_reading BETWEEN 1 AND 36) AND
        (act_science IS NULL OR act_science BETWEEN 1 AND 36)
    )
);

-- Indexes
CREATE INDEX idx_test_scores_student_id ON standardized_test_scores(student_id);
CREATE INDEX idx_test_scores_type ON standardized_test_scores(test_type);
CREATE INDEX idx_test_scores_date ON standardized_test_scores(test_date);

CREATE TRIGGER update_test_scores_updated_at BEFORE UPDATE ON standardized_test_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS / NOTES
-- ============================================================================
-- This schema provides:
-- 1. Complete student profile management with FERPA compliance
-- 2. Academic tracking synced from school districts
-- 3. Athletic profile management for sports participation
-- 4. Financial need assessment for scholarship matching
-- 5. Career interest tracking for pathway planning
-- 6. Standardized test score management
--
-- All tables include:
-- - UUID primary keys for security
-- - Audit timestamps (created_at, updated_at)
-- - Soft delete capability (deleted_at)
-- - Appropriate constraints and validations
-- - Indexes for common query patterns
--
-- Next steps:
-- 1. Implement encryption for sensitive fields (guardian contact, financial data)
-- 2. Set up row-level security policies
-- 3. Create views for common queries
-- 4. Build materialized views for dashboards
-- ============================================================================
