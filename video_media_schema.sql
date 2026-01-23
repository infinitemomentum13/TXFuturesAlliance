-- ============================================================================
-- TX FUTURES ALLIANCE - VIDEO & MEDIA STORAGE SCHEMA
-- ============================================================================
-- Purpose: Video upload tracking, AI analysis results, highlight reels,
--          player performance metrics
-- Storage: Google Cloud Storage for files + PostgreSQL for metadata
-- Last Updated: 2026-01-23
-- ============================================================================

-- ============================================================================
-- VIDEO UPLOADS TABLE
-- Metadata for all uploaded videos
-- ============================================================================
CREATE TABLE video_uploads (
    video_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    
    -- Video Classification
    video_type VARCHAR(50) NOT NULL,
    -- "full_match", "highlight_reel", "drill", "scrimmage", "training", "trial", "other"
    sport VARCHAR(50) NOT NULL DEFAULT 'Soccer',
    
    -- Event Information
    event_name VARCHAR(300),
    event_date DATE,
    event_location VARCHAR(300),
    opponent VARCHAR(200), -- For matches
    match_result VARCHAR(50), -- "Win 3-1", "Loss 0-2", "Draw 2-2"
    
    -- Upload Details
    upload_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    uploaded_by UUID NOT NULL, -- student, coach, parent
    uploader_role VARCHAR(50),
    
    -- File Information
    original_filename VARCHAR(500),
    file_size_bytes BIGINT NOT NULL,
    file_size_mb DECIMAL(10,2) GENERATED ALWAYS AS (file_size_bytes / 1048576.0) STORED,
    duration_seconds INTEGER,
    duration_formatted VARCHAR(20), -- "01:45:23" (HH:MM:SS)
    resolution VARCHAR(20), -- "1920x1080", "1280x720", etc.
    frame_rate DECIMAL(5,2), -- 30.00, 60.00, etc.
    codec VARCHAR(50),
    format VARCHAR(20), -- "MP4", "MOV", "AVI", etc.
    
    -- Storage Locations (Google Cloud Storage)
    storage_bucket VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL, -- Full path in bucket
    storage_url TEXT NOT NULL, -- Signed URL or public URL
    thumbnail_url TEXT,
    thumbnail_storage_path TEXT,
    
    -- Transcoding Status
    transcoding_status VARCHAR(50) DEFAULT 'pending',
    -- "pending", "in_progress", "completed", "failed", "not_required"
    transcoded_versions JSONB,
    -- Example:
    -- [
    --   {"quality": "1080p", "url": "...", "file_size_mb": 450},
    --   {"quality": "720p", "url": "...", "file_size_mb": 200},
    --   {"quality": "480p", "url": "...", "file_size_mb": 100}
    -- ]
    
    -- Processing Status
    processing_status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    -- "uploaded", "processing", "analyzed", "failed", "ready"
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_duration_seconds INTEGER,
    processing_errors TEXT,
    
    -- Privacy & Permissions
    privacy_setting VARCHAR(50) NOT NULL DEFAULT 'private',
    -- "private", "team_only", "scouts_allowed", "public", "college_recruiters"
    viewable_by TEXT[], -- Array of user IDs who can view
    sharing_enabled BOOLEAN DEFAULT FALSE,
    share_link TEXT, -- Generated share link if enabled
    share_link_expires_at TIMESTAMP,
    
    -- Consent Verification
    consent_verified BOOLEAN NOT NULL DEFAULT FALSE,
    consent_type VARCHAR(100),
    -- "Student Self-Upload", "Parent Consent", "Coach Upload", "Guardian Consent"
    consent_document_url TEXT,
    consent_date TIMESTAMP,
    
    -- Metadata & Tags
    title VARCHAR(500),
    description TEXT,
    tags TEXT[], -- ["Goal", "Assist", "Defense", "Free Kick", etc.]
    coach_notes TEXT,
    student_notes TEXT,
    
    -- Quality Metrics
    video_quality_score INTEGER, -- 1-10, overall video quality
    clarity_score INTEGER, -- 1-10, how clear is the footage
    angle_quality VARCHAR(50), -- "Excellent", "Good", "Fair", "Poor"
    lighting_quality VARCHAR(50),
    useful_for_analysis BOOLEAN DEFAULT TRUE,
    
    -- View Statistics
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMP,
    unique_viewers INTEGER DEFAULT 0,
    
    -- Flagging System
    flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    flagged_by UUID,
    flagged_at TIMESTAMP,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP, -- Soft delete
    
    CONSTRAINT chk_video_type CHECK (video_type IN 
        ('full_match', 'highlight_reel', 'drill', 'scrimmage', 'training', 'trial', 'other')),
    CONSTRAINT chk_processing_status CHECK (processing_status IN 
        ('uploaded', 'processing', 'analyzed', 'failed', 'ready')),
    CONSTRAINT chk_privacy_setting CHECK (privacy_setting IN 
        ('private', 'team_only', 'scouts_allowed', 'public', 'college_recruiters')),
    CONSTRAINT chk_quality_scores CHECK (
        (video_quality_score IS NULL OR video_quality_score BETWEEN 1 AND 10) AND
        (clarity_score IS NULL OR clarity_score BETWEEN 1 AND 10)
    )
);

-- Indexes
CREATE INDEX idx_video_student ON video_uploads(student_id);
CREATE INDEX idx_video_type ON video_uploads(video_type);
CREATE INDEX idx_video_upload_date ON video_uploads(upload_date);
CREATE INDEX idx_video_processing_status ON video_uploads(processing_status);
CREATE INDEX idx_video_privacy ON video_uploads(privacy_setting);
CREATE INDEX idx_video_tags ON video_uploads USING GIN(tags);
CREATE INDEX idx_video_event_date ON video_uploads(event_date);
CREATE INDEX idx_video_not_deleted ON video_uploads(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER update_video_uploads_updated_at BEFORE UPDATE ON video_uploads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIDEO ANALYSIS RESULTS TABLE
-- AI/ML analysis output for videos
-- ============================================================================
CREATE TABLE video_analysis_results (
    analysis_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES video_uploads(video_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    
    -- Analysis Type
    analysis_type VARCHAR(100) NOT NULL,
    -- "player_identification", "skill_assessment", "tactical_analysis", 
    -- "highlight_detection", "performance_metrics", "comparison"
    
    -- AI Model Information
    ai_model_name VARCHAR(100) NOT NULL,
    ai_model_version VARCHAR(50) NOT NULL,
    confidence_score DECIMAL(5,2), -- 0-100, model's confidence
    
    -- Processing Details
    processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processing_time_seconds INTEGER,
    frames_analyzed INTEGER,
    deployment_location VARCHAR(100), -- "Cloud", "Edge-FieldA", "Concrete-Engine-Module-1"
    
    -- Analysis Results (structured as JSONB for flexibility)
    analysis_results JSONB NOT NULL,
    -- Structure varies by analysis_type
    -- Example for "skill_assessment":
    -- {
    --   "overall_rating": 7.5,
    --   "technical_skills": {
    --     "passing_accuracy": 82,
    --     "first_touch": 75,
    --     "dribbling": 88,
    --     "shooting": 70,
    --     "heading": 65
    --   },
    --   "tactical_awareness": {
    --     "positioning": 78,
    --     "decision_making": 80,
    --     "off_ball_movement": 72,
    --     "defensive_work_rate": 85
    --   },
    --   "physical_attributes": {
    --     "speed": 85,
    --     "agility": 80,
    --     "endurance": 75,
    --     "strength": 70
    --   },
    --   "strengths": ["Dribbling", "Decision Making", "Speed"],
    --   "weaknesses": ["Heading", "Shooting Accuracy"],
    --   "improvement_areas": [
    --     {
    --       "skill": "Shooting",
    --       "current_level": 70,
    --       "target_level": 80,
    --       "recommended_drills": ["shooting-accuracy-drill-1", "power-shooting-drill-2"]
    --     }
    --   ],
    --   "benchmarks": {
    --     "age_group": "U17",
    --     "percentile": 75,
    --     "comparison_group": "Regional Select Level"
    --   }
    -- }
    
    -- Detected Events/Highlights
    detected_events JSONB,
    -- Example:
    -- [
    --   {"event_type": "goal", "timestamp": "00:15:23", "confidence": 95, "description": "Right-footed shot from 18 yards"},
    --   {"event_type": "assist", "timestamp": "00:32:45", "confidence": 88, "description": "Through ball to striker"},
    --   {"event_type": "tackle", "timestamp": "00:48:12", "confidence": 92, "description": "Sliding tackle, won possession"}
    -- ]
    
    -- Performance Statistics
    performance_stats JSONB,
    -- Example:
    -- {
    --   "touches": 87,
    --   "passes_attempted": 52,
    --   "passes_completed": 45,
    --   "pass_accuracy": 86.5,
    --   "shots": 5,
    --   "shots_on_target": 3,
    --   "tackles": 8,
    --   "tackles_won": 6,
    --   "distance_covered_km": 8.5,
    --   "sprints": 12,
    --   "heatmap_data": {...}
    -- }
    
    -- Recommendations
    training_recommendations TEXT[],
    next_steps TEXT[],
    
    -- Comparison to Previous Analyses
    improvement_since_last JSONB,
    -- Example:
    -- {
    --   "previous_analysis_id": "uuid-here",
    --   "previous_date": "2024-10-15",
    --   "changes": {
    --     "passing_accuracy": {"previous": 78, "current": 82, "change": +4},
    --     "dribbling": {"previous": 85, "current": 88, "change": +3},
    --     "shooting": {"previous": 72, "current": 70, "change": -2}
    --   },
    --   "overall_trend": "Improving"
    -- }
    
    -- Human Review
    reviewed_by_coach BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP,
    reviewed_by UUID,
    coach_agreement BOOLEAN, -- Does coach agree with AI assessment?
    coach_adjustments JSONB, -- Any manual corrections
    coach_notes TEXT,
    
    -- Sharing
    shared_with_student BOOLEAN DEFAULT FALSE,
    shared_with_parents BOOLEAN DEFAULT FALSE,
    shared_with_scouts BOOLEAN DEFAULT FALSE,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_confidence_score CHECK (confidence_score BETWEEN 0 AND 100)
);

-- Indexes
CREATE INDEX idx_analysis_video ON video_analysis_results(video_id);
CREATE INDEX idx_analysis_student ON video_analysis_results(student_id);
CREATE INDEX idx_analysis_type ON video_analysis_results(analysis_type);
CREATE INDEX idx_analysis_processed ON video_analysis_results(processed_at);
CREATE INDEX idx_analysis_results ON video_analysis_results USING GIN(analysis_results);

CREATE TRIGGER update_video_analysis_updated_at BEFORE UPDATE ON video_analysis_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIDEO HIGHLIGHTS TABLE
-- Tagged highlights and key moments from videos
-- ============================================================================
CREATE TABLE video_highlights (
    highlight_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES video_uploads(video_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    analysis_id UUID REFERENCES video_analysis_results(analysis_id),
    
    -- Highlight Details
    highlight_type VARCHAR(100) NOT NULL,
    -- "goal", "assist", "save", "tackle", "pass", "dribble", "shot", "header", 
    -- "free_kick", "corner_kick", "penalty", "defensive_play", "skill_move", "other"
    
    -- Timestamp Information
    start_timestamp VARCHAR(20) NOT NULL, -- "00:15:23" (HH:MM:SS)
    end_timestamp VARCHAR(20) NOT NULL,
    start_seconds INTEGER, -- Seconds from start of video
    end_seconds INTEGER,
    duration_seconds INTEGER GENERATED ALWAYS AS (end_seconds - start_seconds) STORED,
    
    -- Detection Method
    auto_detected BOOLEAN NOT NULL DEFAULT FALSE,
    detection_confidence DECIMAL(5,2), -- If auto-detected
    manually_tagged BOOLEAN DEFAULT FALSE,
    tagged_by UUID, -- Coach, student, or system
    
    -- Quality & Importance
    quality_score DECIMAL(3,1), -- 1.0 - 10.0
    importance_score DECIMAL(3,1), -- 1.0 - 10.0 (for recruitment reels)
    recruitability_score DECIMAL(3,1), -- How good is this for recruiting?
    
    -- Description
    title VARCHAR(300),
    description TEXT,
    technical_notes TEXT, -- Coach's technical analysis of this moment
    
    -- Context
    game_situation VARCHAR(200), -- "2-1 up, 70th minute", "0-0, stoppage time"
    significance VARCHAR(200), -- "Game-winning goal", "Crucial defensive play"
    
    -- Clip Generation
    clip_generated BOOLEAN DEFAULT FALSE,
    clip_storage_url TEXT,
    clip_thumbnail_url TEXT,
    
    -- Tags & Categorization
    tags TEXT[], -- ["Speed", "Technical", "Under Pressure", "Left Foot"]
    showcase_worthy BOOLEAN DEFAULT FALSE, -- Include in recruitment reel?
    
    -- Usage Tracking
    included_in_reels INTEGER DEFAULT 0, -- How many reels include this?
    view_count INTEGER DEFAULT 0,
    shared_count INTEGER DEFAULT 0,
    
    -- Feedback
    student_favorite BOOLEAN DEFAULT FALSE,
    coach_featured BOOLEAN DEFAULT FALSE,
    scout_bookmarked_by UUID[],
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_highlight_type CHECK (highlight_type IN 
        ('goal', 'assist', 'save', 'tackle', 'pass', 'dribble', 'shot', 'header',
         'free_kick', 'corner_kick', 'penalty', 'defensive_play', 'skill_move', 'other')),
    CONSTRAINT chk_detection_confidence CHECK (detection_confidence BETWEEN 0 AND 100),
    CONSTRAINT chk_scores CHECK (
        (quality_score IS NULL OR quality_score BETWEEN 1 AND 10) AND
        (importance_score IS NULL OR importance_score BETWEEN 1 AND 10) AND
        (recruitability_score IS NULL OR recruitability_score BETWEEN 1 AND 10)
    )
);

-- Indexes
CREATE INDEX idx_highlights_video ON video_highlights(video_id);
CREATE INDEX idx_highlights_student ON video_highlights(student_id);
CREATE INDEX idx_highlights_type ON video_highlights(highlight_type);
CREATE INDEX idx_highlights_auto_detected ON video_highlights(auto_detected);
CREATE INDEX idx_highlights_showcase ON video_highlights(showcase_worthy);
CREATE INDEX idx_highlights_tags ON video_highlights USING GIN(tags);
CREATE INDEX idx_highlights_created ON video_highlights(created_at);

CREATE TRIGGER update_video_highlights_updated_at BEFORE UPDATE ON video_highlights
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RECRUITMENT REELS TABLE
-- Compiled highlight reels for college/professional recruitment
-- ============================================================================
CREATE TABLE recruitment_reels (
    reel_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    
    -- Reel Information
    reel_name VARCHAR(300) NOT NULL,
    reel_type VARCHAR(50) NOT NULL DEFAULT 'general',
    -- "general", "position_specific", "college_specific", "pro_trial", "scholarship_app"
    
    -- Target Audience
    target_audience VARCHAR(100),
    -- "D1_Colleges", "D2_Colleges", "D3_Colleges", "MLS_Academies", 
    -- "European_Clubs", "Racing_de_Santander", "Specific_School"
    specific_target VARCHAR(300), -- Name of specific college/club if applicable
    
    -- Reel Composition
    included_highlights UUID[], -- Array of highlight_id references
    highlight_count INTEGER,
    total_duration_seconds INTEGER,
    
    -- Reel File
    reel_storage_url TEXT,
    reel_thumbnail_url TEXT,
    file_size_mb DECIMAL(10,2),
    resolution VARCHAR(20),
    format VARCHAR(20),
    
    -- Music & Editing
    music_track VARCHAR(200),
    intro_text TEXT,
    outro_text TEXT,
    overlay_graphics BOOLEAN DEFAULT FALSE,
    professional_edited BOOLEAN DEFAULT FALSE,
    edited_by UUID,
    
    -- Generation Details
    auto_generated BOOLEAN DEFAULT FALSE,
    generation_date TIMESTAMP,
    manual_adjustments_made BOOLEAN DEFAULT FALSE,
    
    -- Distribution
    shared_with TEXT[], -- Array of emails/organizations
    share_link TEXT,
    share_link_active BOOLEAN DEFAULT FALSE,
    share_link_expires_at TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    
    -- Feedback & Results
    scout_views INTEGER DEFAULT 0,
    college_views INTEGER DEFAULT 0,
    led_to_contact BOOLEAN DEFAULT FALSE,
    led_to_offer BOOLEAN DEFAULT FALSE,
    effectiveness_rating DECIMAL(3,1), -- 1-10
    
    -- Version Control
    version INTEGER DEFAULT 1,
    previous_version_id UUID REFERENCES recruitment_reels(reel_id),
    is_current_version BOOLEAN DEFAULT TRUE,
    
    -- Notes
    student_notes TEXT,
    coach_notes TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft',
    -- "draft", "in_review", "approved", "published", "archived"
    approved_by UUID,
    approved_at TIMESTAMP,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_reel_type CHECK (reel_type IN 
        ('general', 'position_specific', 'college_specific', 'pro_trial', 'scholarship_app')),
    CONSTRAINT chk_reel_status CHECK (status IN 
        ('draft', 'in_review', 'approved', 'published', 'archived'))
);

-- Indexes
CREATE INDEX idx_reels_student ON recruitment_reels(student_id);
CREATE INDEX idx_reels_type ON recruitment_reels(reel_type);
CREATE INDEX idx_reels_status ON recruitment_reels(status);
CREATE INDEX idx_reels_current ON recruitment_reels(is_current_version);
CREATE INDEX idx_reels_created ON recruitment_reels(created_at);

CREATE TRIGGER update_recruitment_reels_updated_at BEFORE UPDATE ON recruitment_reels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PLAYER PERFORMANCE TIMELINE TABLE
-- Track performance metrics over time for trend analysis
-- ============================================================================
CREATE TABLE player_performance_timeline (
    timeline_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    analysis_id UUID REFERENCES video_analysis_results(analysis_id),
    
    -- Date & Context
    assessment_date DATE NOT NULL,
    season VARCHAR(50), -- "Fall 2024", "Spring 2025"
    age_at_assessment DECIMAL(4,2), -- 16.5 years old
    
    -- Performance Metrics (aggregate from video analysis)
    overall_rating DECIMAL(3,1),
    technical_skills DECIMAL(3,1),
    tactical_awareness DECIMAL(3,1),
    physical_fitness DECIMAL(3,1),
    mental_toughness DECIMAL(3,1),
    
    -- Detailed Skills (JSONB for flexibility)
    skill_breakdown JSONB,
    
    -- Physical Measurements (if available)
    height_inches INTEGER,
    weight_pounds INTEGER,
    
    -- Comparison Metrics
    percentile_vs_age_group DECIMAL(5,2),
    percentile_vs_skill_level DECIMAL(5,2),
    
    -- Progress Indicators
    improvement_rate DECIMAL(5,2), -- % improvement since last assessment
    trajectory VARCHAR(50), -- "Rapidly Improving", "Improving", "Stable", "Declining"
    
    -- Notes
    assessment_notes TEXT,
    coach_observations TEXT,
    
    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_ratings CHECK (
        (overall_rating IS NULL OR overall_rating BETWEEN 1 AND 10) AND
        (technical_skills IS NULL OR technical_skills BETWEEN 1 AND 10) AND
        (tactical_awareness IS NULL OR tactical_awareness BETWEEN 1 AND 10) AND
        (physical_fitness IS NULL OR physical_fitness BETWEEN 1 AND 10) AND
        (mental_toughness IS NULL OR mental_toughness BETWEEN 1 AND 10)
    ),
    CONSTRAINT chk_percentiles CHECK (
        (percentile_vs_age_group IS NULL OR percentile_vs_age_group BETWEEN 0 AND 100) AND
        (percentile_vs_skill_level IS NULL OR percentile_vs_skill_level BETWEEN 0 AND 100)
    )
);

-- Indexes
CREATE INDEX idx_timeline_student ON player_performance_timeline(student_id);
CREATE INDEX idx_timeline_date ON player_performance_timeline(assessment_date);
CREATE INDEX idx_timeline_season ON player_performance_timeline(season);
CREATE INDEX idx_timeline_rating ON player_performance_timeline(overall_rating);

CREATE TRIGGER update_timeline_updated_at BEFORE UPDATE ON player_performance_timeline
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Student video library summary
CREATE VIEW student_video_library AS
SELECT 
    vu.student_id,
    COUNT(*) AS total_videos,
    COUNT(*) FILTER (WHERE vu.video_type = 'full_match') AS full_matches,
    COUNT(*) FILTER (WHERE vu.video_type = 'highlight_reel') AS highlight_reels,
    COUNT(*) FILTER (WHERE vu.processing_status = 'analyzed') AS analyzed_videos,
    SUM(vu.file_size_mb) AS total_storage_mb,
    SUM(vu.duration_seconds) AS total_duration_seconds,
    MAX(vu.upload_date) AS most_recent_upload,
    COUNT(DISTINCT vh.highlight_id) AS total_highlights,
    COUNT(DISTINCT rr.reel_id) AS recruitment_reels
FROM video_uploads vu
LEFT JOIN video_highlights vh ON vu.video_id = vh.video_id
LEFT JOIN recruitment_reels rr ON vu.student_id = rr.student_id
WHERE vu.deleted_at IS NULL
GROUP BY vu.student_id;

-- Recent video analyses awaiting coach review
CREATE VIEW pending_coach_reviews AS
SELECT 
    var.analysis_id,
    var.student_id,
    s.first_name,
    s.last_name,
    vu.title AS video_title,
    var.analysis_type,
    var.processed_at,
    (CURRENT_TIMESTAMP - var.processed_at) AS days_pending
FROM video_analysis_results var
JOIN video_uploads vu ON var.video_id = vu.video_id
JOIN students s ON var.student_id = s.student_id
WHERE var.reviewed_by_coach = FALSE
ORDER BY var.processed_at;

-- Top recruitment highlights by student
CREATE VIEW top_recruitment_highlights AS
SELECT 
    vh.student_id,
    s.first_name,
    s.last_name,
    COUNT(*) AS total_highlights,
    COUNT(*) FILTER (WHERE vh.showcase_worthy = TRUE) AS showcase_highlights,
    AVG(vh.recruitability_score) AS avg_recruitability,
    MAX(vh.quality_score) AS best_quality_score
FROM video_highlights vh
JOIN students s ON vh.student_id = s.student_id
GROUP BY vh.student_id, s.first_name, s.last_name
HAVING COUNT(*) > 0
ORDER BY avg_recruitability DESC, total_highlights DESC;

-- ============================================================================
-- COMMENTS / NOTES
-- ============================================================================
-- This schema provides:
-- 1. Complete video upload and metadata tracking
-- 2. AI/ML analysis result storage with flexible JSONB structure
-- 3. Highlight detection and tagging system
-- 4. Recruitment reel compilation and distribution
-- 5. Performance timeline tracking for progress monitoring
--
-- Key Features:
-- - Support for both cloud and edge processing
-- - Privacy controls and consent management
-- - Version control for recruitment reels
-- - Detailed performance metrics over time
-- - Views for common dashboard queries
--
-- Integration Points:
-- - Google Cloud Storage for actual video files
-- - Concrete Engine for edge deployment metadata
-- - AI/ML models for analysis
-- - Scout/recruiter portals for reel distribution
--
-- Next Steps:
-- 1. Implement video upload pipeline (multipart, resumable)
-- 2. Build video analysis job queue
-- 3. Create automatic highlight detection triggers
-- 4. Develop recruitment reel generation algorithm
-- ============================================================================
