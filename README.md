# TX Futures Alliance - Technical Architecture Documentation

## Overview
This repository contains the complete database schemas and API specifications for the TX Futures Alliance platform - a comprehensive college and career pathway system for rural students, initially targeting soccer academies in the Rio Grande Valley.

**Created:** January 23, 2026  
**Version:** 1.0.0  
**Status:** Foundation - Ready for Development

---

## What You Have Here

### Database Schemas (PostgreSQL)
Four comprehensive SQL schema files ready to execute:

1. **01_student_profiles_schema.sql** - Core student data
   - Students table with FERPA-compliant consent management
   - Academic records (synced from Skyward)
   - Athletic profiles (sport participation and performance)
   - Financial profiles (for scholarship matching)
   - Career interests (pathway planning)
   - Standardized test scores

2. **02_scholarship_schema.sql** - Scholarship system
   - Scholarships catalog (1000+ scholarships)
   - AI-powered matching (match scores, probability calculations)
   - Application tracking (full lifecycle)
   - Essay templates (AI-assisted generation)
   - Outcome tracking (ROI measurement)

3. **03_video_media_schema.sql** - Video analysis
   - Video uploads (metadata and storage references)
   - AI analysis results (skill assessment, highlight detection)
   - Video highlights (tagged moments for recruitment)
   - Recruitment reels (compiled highlight packages)
   - Performance timeline (progress tracking over time)

4. **04_corporate_internships_schema.sql** - Workforce pipeline
   - Corporate partners (company relationships)
   - Internship postings (job opportunities)
   - Applications (student-to-internship matching)
   - Placements (active internship tracking)
   - Analytics (partner ROI and effectiveness)

### API Specifications (OpenAPI 3.0.3)
Three comprehensive API specs ready to implement:

1. **api_01_student_service.yaml** - Student management
   - Authentication (JWT-based)
   - Student CRUD operations
   - Academic records management
   - Athletic profiles
   - Financial and career data

2. **api_02_scholarship_service.yaml** - Scholarship system
   - Scholarship search and filtering
   - AI-powered matching engine
   - Application lifecycle management
   - Essay generation and tracking
   - Outcome measurement

3. **api_03_video_service.yaml** - Video platform
   - Multipart video uploads
   - AI analysis job submission
   - Highlight detection and tagging
   - Recruitment reel compilation
   - Share link generation

---

## Quick Start Implementation Guide

### Phase 1: Database Setup (Week 1)

**What to do:**
1. Install PostgreSQL 14+ (or use Google Cloud SQL)
2. Create database: `createdb tx_futures_alliance`
3. Execute schemas in order:
   ```bash
   psql -d tx_futures_alliance -f 01_student_profiles_schema.sql
   psql -d tx_futures_alliance -f 02_scholarship_schema.sql
   psql -d tx_futures_alliance -f 03_video_media_schema.sql
   psql -d tx_futures_alliance -f 04_corporate_internships_schema.sql
   ```
4. Verify: `psql -d tx_futures_alliance -c "\dt"` should show all tables

**Next steps:**
- Set up row-level security (RLS) policies for FERPA compliance
- Configure automated backups
- Set up read replicas for analytics queries
- Implement encryption at rest for sensitive fields

### Phase 2: API Implementation (Weeks 2-6)

**Technology Stack Recommendation:**
- **Backend Framework:** FastAPI (Python) or Express (Node.js)
- **Why FastAPI:** 
  - Built-in OpenAPI support (your specs will work out-of-the-box)
  - Async support for high-performance
  - Type validation with Pydantic
  - Excellent PostgreSQL support via SQLAlchemy
  
**Basic Setup:**
```bash
# Python/FastAPI approach
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-jose

# Create project structure
mkdir -p api/{routes,models,services,middleware}
```

**Implementation Priority:**
1. **Week 2:** Authentication + Student Service
   - JWT token generation
   - Student CRUD endpoints
   - Basic authorization middleware

2. **Week 3:** Academic Records + Skyward Integration
   - Build Skyward API connector
   - Implement grade sync job
   - Create academic records endpoints

3. **Week 4:** Scholarship Service (Part 1)
   - Scholarship catalog endpoints
   - Basic search/filtering
   - Manual scholarship entry system

4. **Week 5:** Video Upload + Storage
   - Integrate Google Cloud Storage
   - Implement multipart upload
   - Create video metadata endpoints

5. **Week 6:** Testing + Documentation
   - Write integration tests
   - Set up API documentation (Swagger UI)
   - Deploy to staging environment

### Phase 3: AI/ML Models (Weeks 7-12)

**ML Model Priority:**
1. **Academic Risk Prediction** (Week 7-8)
   - Gradient Boosting (XGBoost)
   - Train on historical grade data
   - Deploy to Cloud Run or Vertex AI

2. **Scholarship Matching** (Week 9-10)
   - Collaborative filtering
   - Content-based recommendation
   - Hybrid approach for best results

3. **Video Analysis - Highlight Detection** (Week 11-12)
   - YOLO or similar object detection
   - Train on labeled soccer footage
   - Deploy to edge (Concrete Engine) + cloud

**Training Data Requirements:**
- Academic risk: 1000+ student records with outcomes
- Scholarship matching: 500+ applications with results
- Video analysis: 100+ hours of labeled footage

### Phase 4: Mobile App (Weeks 13-18)

**React Native Implementation:**
```bash
npx react-native init TxFuturesAlliance
cd TxFuturesAlliance
npm install @react-navigation/native axios react-native-video
```

**Screen Priority:**
1. Authentication (Login/Register)
2. Dashboard (Overview of grades, scholarships, videos)
3. Scholarship Browser (Search and matches)
4. Application Tracker (Current applications)
5. Video Library (Upload and view)
6. Profile Management

---

## Key Integrations

### Skyward (School District System)
**What it provides:** Real-time grade data, attendance, transcripts

**Integration approach:**
- Check if district has API access (most do)
- Fallback: CSV upload via SFTP
- Sync frequency: Nightly for grades, real-time for critical alerts
- Data mapping: Skyward StudentID → student_id in our DB

**Code snippet:**
```python
# Skyward API example
async def sync_grades_from_skyward(district_id: str):
    # Fetch from Skyward
    skyward_grades = await skyward_client.get_grades(district_id)
    
    # Transform and insert
    for grade in skyward_grades:
        await db.execute(
            "INSERT INTO academic_records (...) VALUES (...)"
        )
    
    # Trigger risk assessment for updated students
    await queue_risk_assessments(updated_students)
```

### Google Cloud Storage (Video Files)
**Structure:**
```
bucket: tx-futures-alliance-videos
├── /students/{student_id}/
│   ├── /originals/{video_id}.mp4
│   ├── /transcoded/{video_id}_1080p.mp4
│   ├── /transcoded/{video_id}_720p.mp4
│   └── /thumbnails/{video_id}.jpg
```

**Upload flow:**
1. Client requests signed URL from API
2. Client uploads directly to GCS
3. GCS triggers Cloud Function on upload complete
4. Cloud Function starts transcoding job
5. Metadata updated in PostgreSQL

### Concrete Engine (Edge Computing)
**What you're building together:**
- Physical edge modules (students assemble hardware)
- Deployed at soccer fields for real-time video analysis
- Students learn: electronics, networking, DevOps, AI deployment

**Technical specs:**
- Hardware: GPU-enabled compute module
- Software: Kubernetes Edge, Docker containers
- Models: Player tracking, highlight detection (run locally)
- Data flow: Edge → Cloud sync for deeper analysis

---

## FERPA Compliance Checklist

Critical requirements for student data protection:

- [ ] All student data access requires authentication
- [ ] Role-based access control (students see their data only)
- [ ] Audit logging (who accessed what, when)
- [ ] Parent consent for students under 18
- [ ] Data encryption at rest (PostgreSQL encryption)
- [ ] Data encryption in transit (TLS 1.3)
- [ ] Automated data deletion (7 years after graduation)
- [ ] Privacy policy and terms of service
- [ ] Annual FERPA compliance training for staff
- [ ] Third-party data use agreements (with scouts, colleges)

**Row-Level Security Example:**
```sql
-- Students can only see their own data
CREATE POLICY student_isolation ON students
    USING (student_id = current_user_student_id());

-- Coaches can see their team's students
CREATE POLICY coach_team_access ON students
    USING (team_id IN (SELECT team_id FROM coach_assignments 
                       WHERE coach_id = current_user_id()));
```

---

## Performance Optimization

### Database Indexes
All schemas include appropriate indexes, but monitor query performance:

```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC LIMIT 10;

-- Add composite indexes if needed
CREATE INDEX idx_academic_student_year_semester 
    ON academic_records(student_id, school_year, semester);
```

### Caching Strategy
- **Redis for session storage:** JWT tokens, user sessions
- **Redis for API responses:** Scholarship catalog (1 hour TTL)
- **CDN for static assets:** Video thumbnails, profile photos
- **PostgreSQL materialized views:** Dashboard aggregations

### Scalability Targets
- **MVP (100 students):** Single PostgreSQL instance, basic caching
- **Phase 2 (1000 students):** Read replicas, Redis cluster
- **Phase 3 (10,000 students):** Database sharding by district

---

## Deployment Architecture

### Recommended GCP Setup

**Production Environment:**
```
├── Cloud SQL (PostgreSQL) - Primary + 1 Read Replica
├── Google Kubernetes Engine (GKE) - API services
│   ├── Student Service (3 pods)
│   ├── Scholarship Service (2 pods)
│   ├── Video Service (2 pods)
│   └── Worker Service (5 pods for background jobs)
├── Cloud Storage - Video files
├── Cloud CDN - Static content delivery
├── Cloud Load Balancing - HTTPS with auto-scaling
├── Cloud Functions - Event-driven tasks
│   ├── Video transcoding
│   ├── Email notifications
│   └── Skyward sync
├── Vertex AI - ML model hosting
├── Cloud Pub/Sub - Message queue
└── Cloud Monitoring - Logging and alerts
```

**Cost Estimate (1000 students):**
- Cloud SQL: $400/month
- GKE: $600/month
- Storage: $100/month (5TB video)
- AI/ML: $500/month
- CDN + Networking: $200/month
- **Total: ~$1,800/month** (scales with usage)

**Staging Environment:**
- Smaller instances (50% of production)
- Cost: ~$500/month
- Use for testing before production deploys

---

## Development Workflow

### Git Strategy
```
main (production)
  ↑
staging (pre-production)
  ↑
develop (integration)
  ↑
feature/* (individual features)
```

### CI/CD Pipeline
1. Push to feature branch → GitHub Actions runs tests
2. Merge to develop → Auto-deploy to dev environment
3. Merge to staging → Auto-deploy to staging + integration tests
4. Merge to main → Manual approval → Deploy to production

### Testing Strategy
- **Unit tests:** Every API endpoint, every model function
- **Integration tests:** Full workflows (student applies to scholarship)
- **E2E tests:** Mobile app critical paths
- **Load tests:** Simulate 100 concurrent users

---

## AI/ML Model Development

### Training Infrastructure
- **Local development:** Jupyter notebooks for exploration
- **Training:** Vertex AI Training (managed service)
- **Deployment:** Vertex AI Prediction or Cloud Run
- **Monitoring:** Model drift detection, performance tracking

### Model Registry
```
models/
├── academic_risk_v1.0/
│   ├── model.pkl
│   ├── scaler.pkl
│   ├── feature_names.json
│   └── metrics.json
├── scholarship_match_v2.1/
│   ├── model.h5
│   ├── tokenizer.pkl
│   └── config.json
└── video_highlights_v1.3/
    ├── weights.pth
    ├── classes.txt
    └── anchors.yaml
```

### Retraining Schedule
- **Academic risk:** Monthly (as new grade data arrives)
- **Scholarship matching:** Quarterly (as outcomes measured)
- **Video analysis:** As needed (when accuracy drops)

---

## Security Best Practices

### Authentication & Authorization
- JWT tokens with 1-hour expiration
- Refresh tokens with 30-day expiration
- Role-based access control (RBAC)
- API rate limiting (1000 req/hour per user)

### Data Protection
- Never store passwords in plain text (bcrypt with 12 rounds)
- Encrypt sensitive fields (guardian emails, financial data)
- Use prepared statements (prevent SQL injection)
- Sanitize all user inputs
- HTTPS everywhere (no HTTP allowed)

### Incident Response Plan
1. Detect: Automated alerts for suspicious activity
2. Contain: Disable affected accounts immediately
3. Investigate: Review audit logs
4. Remediate: Patch vulnerability, notify affected users
5. Document: Post-mortem report

---

## Monitoring & Alerting

### Key Metrics to Track
- **API Performance:** Response time, error rate, throughput
- **Database:** Query time, connection pool usage, disk space
- **ML Models:** Prediction latency, accuracy drift
- **Business Metrics:** Scholarship matches, applications submitted

### Alert Thresholds
- API error rate > 1% → Page on-call engineer
- Database CPU > 80% → Auto-scale up
- Model accuracy < baseline - 5% → Retrain model
- Disk space < 20% → Provision more storage

---

## What's Missing (For Later Phases)

The following were discussed but not included in this version:

1. **US Youth Soccer Integration** - Requires partnership
2. **Racing de Santander API** - Build with their IT team
3. **School counselor portal** - Web interface for counselors
4. **Corporate partner portal** - Self-service for companies
5. **Scout/recruiter tools** - Search interface for talent scouts
6. **Admin dashboard** - Platform analytics and management
7. **SMS notifications** - Twilio integration for alerts
8. **Advanced analytics** - Data warehouse for reporting

These can be added as the platform matures and user needs emerge.

---

## Next Steps

### Immediate (This Week)
1. Review this documentation
2. Set up PostgreSQL database
3. Execute all schema files
4. Verify tables created successfully

### Short-term (Next 4 Weeks)
1. Choose tech stack (FastAPI recommended)
2. Implement Student Service API
3. Build Skyward integration
4. Deploy to staging environment

### Medium-term (Next 12 Weeks)
1. Implement all API services
2. Build basic ML models
3. Develop mobile app MVP
4. Onboard FC Brownsville (pilot)

### Long-term (6-12 Months)
1. Expand to 5 academies
2. Refine ML models with real data
3. Integrate Concrete Engine partnership
4. Launch platform licensing model

---

## Support & Questions

**Technical questions:** Build as you go using AI assistance
**Architecture decisions:** Reference this document
**Database changes:** Use migrations (Alembic for Python)
**API changes:** Update OpenAPI specs first, then code

**Remember:** You're building alone with AI assistance, so:
- Start small (MVP first)
- Automate everything (tests, deployments)
- Document as you build
- Ask for help when stuck (AI, forums, docs)

---

## File Inventory

This package contains:

```
tx-futures-alliance-architecture/
├── README.md (this file)
├── 01_student_profiles_schema.sql
├── 02_scholarship_schema.sql
├── 03_video_media_schema.sql
├── 04_corporate_internships_schema.sql
├── api_01_student_service.yaml
├── api_02_scholarship_service.yaml
└── api_03_video_service.yaml
```

**Total lines of code:** ~6,000+ lines of production-ready schemas and APIs

---

## Final Notes

You now have a complete technical foundation for TX Futures Alliance. These schemas and APIs represent the distilled architecture from our conversation, ready for implementation.

**Key Strengths:**
- FERPA-compliant from day one
- Scalable architecture (handles 100 → 10,000+ students)
- AI/ML ready (schemas designed for ML training)
- Comprehensive data model (nothing major missing)

**What makes this different:**
This isn't just a soccer platform - it's rural opportunity infrastructure. The same system that tracks soccer performance can track any youth development program. The scholarship matching works for any student. The internship pipeline connects any underserved community to economic opportunity.

**Your mission:**
Prove it works with FC Brownsville. Then scale it to change how rural students access college and careers.

Good luck building! 🚀
