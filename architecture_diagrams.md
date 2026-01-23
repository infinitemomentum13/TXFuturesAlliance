# TX Futures Alliance - System Architecture Diagrams

## High-Level System Overview

```mermaid
graph TB
    subgraph "User Interfaces"
        MobileApp[Mobile App<br/>React Native]
        WebDash[Web Dashboard<br/>Vue.js/React]
        CoachPortal[Coach Portal]
        CounselorPortal[Counselor Portal]
    end
    
    subgraph "API Gateway Layer"
        APIGateway[API Gateway<br/>Authentication & Routing]
    end
    
    subgraph "Microservices"
        StudentSvc[Student Service]
        ScholarshipSvc[Scholarship Service]
        VideoSvc[Video Service]
        InternshipSvc[Internship Service]
        AnalyticsSvc[Analytics Service]
        NotificationSvc[Notification Service]
    end
    
    subgraph "AI/ML Models"
        RiskModel[Academic Risk<br/>Prediction]
        MatchModel[Scholarship<br/>Matching Engine]
        VideoModel[Video Analysis<br/>& Highlights]
        TalentModel[Talent Pipeline<br/>Matcher]
    end
    
    subgraph "Data Storage"
        PostgreSQL[(PostgreSQL<br/>Main Database)]
        CloudStorage[Google Cloud<br/>Storage - Videos]
        Redis[Redis<br/>Cache & Sessions]
    end
    
    subgraph "External Integrations"
        Skyward[Skyward<br/>School District]
        ConcreteEngine[Concrete Engine<br/>Edge Computing]
        Racing[Racing de<br/>Santander]
        USYS[US Youth<br/>Soccer]
    end
    
    subgraph "Background Jobs"
        Queue[Cloud Pub/Sub<br/>Message Queue]
        Workers[Worker Processes]
    end
    
    MobileApp --> APIGateway
    WebDash --> APIGateway
    CoachPortal --> APIGateway
    CounselorPortal --> APIGateway
    
    APIGateway --> StudentSvc
    APIGateway --> ScholarshipSvc
    APIGateway --> VideoSvc
    APIGateway --> InternshipSvc
    APIGateway --> AnalyticsSvc
    
    StudentSvc --> PostgreSQL
    ScholarshipSvc --> PostgreSQL
    VideoSvc --> PostgreSQL
    VideoSvc --> CloudStorage
    InternshipSvc --> PostgreSQL
    
    StudentSvc --> Redis
    ScholarshipSvc --> Redis
    
    StudentSvc --> RiskModel
    ScholarshipSvc --> MatchModel
    VideoSvc --> VideoModel
    InternshipSvc --> TalentModel
    
    StudentSvc --> Queue
    ScholarshipSvc --> Queue
    VideoSvc --> Queue
    
    Queue --> Workers
    Workers --> NotificationSvc
    Workers --> PostgreSQL
    
    StudentSvc --> Skyward
    VideoSvc --> ConcreteEngine
    StudentSvc --> Racing
    StudentSvc --> USYS
```

## Student Data Flow

```mermaid
sequenceDiagram
    participant Student
    participant MobileApp
    participant API
    participant StudentSvc
    participant Skyward
    participant RiskModel
    participant DB
    participant Notifications
    
    Note over Student,Notifications: Nightly Grade Sync Process
    
    Skyward->>StudentSvc: Nightly sync trigger
    StudentSvc->>Skyward: Fetch updated grades
    Skyward-->>StudentSvc: Student grade data
    StudentSvc->>DB: Update academic_records
    StudentSvc->>RiskModel: Calculate risk scores
    RiskModel-->>StudentSvc: Risk predictions
    StudentSvc->>DB: Update risk_assessments
    
    alt Student At Risk
        StudentSvc->>Notifications: Trigger alert
        Notifications->>Student: Push notification
        Notifications->>MobileApp: "Your GPA needs attention"
    end
    
    Note over Student,Notifications: Student Views Dashboard
    
    Student->>MobileApp: Open app
    MobileApp->>API: GET /students/{id}
    API->>StudentSvc: Fetch profile
    StudentSvc->>DB: Query student data
    DB-->>StudentSvc: Student profile + grades
    StudentSvc-->>API: Complete profile
    API-->>MobileApp: JSON response
    MobileApp->>Student: Display dashboard
```

## Scholarship Matching Flow

```mermaid
sequenceDiagram
    participant Student
    participant App
    participant ScholarshipSvc
    participant MatchModel
    participant DB
    participant Queue
    
    Note over Student,Queue: AI-Powered Scholarship Matching
    
    Student->>App: Update profile
    App->>ScholarshipSvc: PATCH /students/{id}
    ScholarshipSvc->>DB: Update student_profile
    ScholarshipSvc->>Queue: Trigger match refresh
    
    Queue->>MatchModel: Student profile
    MatchModel->>DB: Fetch scholarships
    DB-->>MatchModel: 1000+ scholarships
    
    MatchModel->>MatchModel: Calculate match scores
    MatchModel->>MatchModel: Rank by probability
    MatchModel->>DB: Store scholarship_matches
    
    Note over Student,Queue: Student Views Matches
    
    Student->>App: View scholarships
    App->>ScholarshipSvc: GET /students/{id}/matches
    ScholarshipSvc->>DB: Fetch top matches
    DB-->>ScholarshipSvc: Ranked scholarships
    ScholarshipSvc-->>App: Match results with rationale
    App->>Student: Display personalized matches
    
    Student->>App: Start application
    App->>ScholarshipSvc: POST /applications
    ScholarshipSvc->>DB: Create application
    ScholarshipSvc-->>App: Application created
```

## Video Upload & Analysis Flow

```mermaid
sequenceDiagram
    participant Coach
    participant App
    participant VideoSvc
    participant GCS
    participant Queue
    participant VideoModel
    participant ConcreteEngine
    participant DB
    
    Note over Coach,DB: Video Upload Process
    
    Coach->>App: Upload video
    App->>VideoSvc: POST /videos
    VideoSvc->>GCS: Request signed URL
    GCS-->>VideoSvc: Upload URL
    VideoSvc-->>App: Signed URL
    App->>GCS: Upload video file
    GCS-->>App: Upload complete
    App->>VideoSvc: Confirm upload
    VideoSvc->>DB: Create video_upload record
    VideoSvc->>Queue: Trigger transcoding
    
    Note over Coach,DB: Video Analysis Process
    
    Queue->>VideoModel: Analyze video
    
    alt Edge Processing Available
        VideoModel->>ConcreteEngine: Deploy to edge
        ConcreteEngine->>ConcreteEngine: Real-time analysis
        ConcreteEngine-->>VideoModel: Results
    else Cloud Processing
        VideoModel->>VideoModel: Cloud analysis
    end
    
    VideoModel->>DB: Store analysis_results
    VideoModel->>DB: Store detected_highlights
    
    Note over Coach,DB: Coach Reviews Analysis
    
    Coach->>App: View analysis
    App->>VideoSvc: GET /analysis/{id}
    VideoSvc->>DB: Fetch results
    DB-->>VideoSvc: Analysis + highlights
    VideoSvc-->>App: Complete analysis
    App->>Coach: Display skill breakdown
    
    Coach->>App: Approve highlights
    App->>VideoSvc: PATCH /highlights
    VideoSvc->>DB: Mark showcase_worthy
```

## Internship Application Flow

```mermaid
sequenceDiagram
    participant Company
    participant Portal
    participant InternshipSvc
    participant Student
    participant App
    participant TalentModel
    participant DB
    participant Notifications
    
    Note over Company,Notifications: Company Posts Internship
    
    Company->>Portal: Create posting
    Portal->>InternshipSvc: POST /internships
    InternshipSvc->>DB: Create posting
    InternshipSvc->>TalentModel: Find matches
    TalentModel->>DB: Query student profiles
    DB-->>TalentModel: Qualified students
    TalentModel-->>InternshipSvc: Matched students
    InternshipSvc->>Notifications: Notify matches
    Notifications->>Student: "New opportunity!"
    
    Note over Company,Notifications: Student Applies
    
    Student->>App: View posting
    App->>InternshipSvc: GET /internships/{id}
    InternshipSvc->>DB: Fetch posting
    DB-->>InternshipSvc: Posting details
    InternshipSvc-->>App: Full posting
    
    Student->>App: Apply
    App->>InternshipSvc: POST /applications
    InternshipSvc->>DB: Create application
    InternshipSvc->>Notifications: Notify company
    Notifications->>Company: "New applicant"
    
    Note over Company,Notifications: Company Reviews
    
    Company->>Portal: Review applicant
    Portal->>InternshipSvc: GET /applications/{id}
    InternshipSvc->>DB: Fetch student profile
    DB-->>InternshipSvc: Full profile + video
    InternshipSvc-->>Portal: Student details
    
    Company->>Portal: Schedule interview
    Portal->>InternshipSvc: PATCH /applications
    InternshipSvc->>DB: Update status
    InternshipSvc->>Notifications: Notify student
    Notifications->>Student: "Interview scheduled!"
```

## Data Relationships Diagram

```mermaid
erDiagram
    STUDENTS ||--o{ ACADEMIC_RECORDS : has
    STUDENTS ||--o{ ATHLETIC_PROFILES : has
    STUDENTS ||--o{ FINANCIAL_PROFILES : has
    STUDENTS ||--o{ CAREER_INTERESTS : has
    STUDENTS ||--o{ VIDEO_UPLOADS : uploads
    STUDENTS ||--o{ SCHOLARSHIP_MATCHES : receives
    STUDENTS ||--o{ SCHOLARSHIP_APPLICATIONS : submits
    STUDENTS ||--o{ INTERNSHIP_APPLICATIONS : submits
    STUDENTS ||--o{ STUDENT_PLACEMENTS : participates
    
    SCHOLARSHIPS ||--o{ SCHOLARSHIP_MATCHES : generates
    SCHOLARSHIPS ||--o{ SCHOLARSHIP_APPLICATIONS : targets
    
    VIDEO_UPLOADS ||--o{ VIDEO_ANALYSIS_RESULTS : analyzed_by
    VIDEO_UPLOADS ||--o{ VIDEO_HIGHLIGHTS : contains
    VIDEO_HIGHLIGHTS }o--|| RECRUITMENT_REELS : compiled_into
    
    CORPORATE_PARTNERS ||--o{ INTERNSHIP_POSTINGS : creates
    INTERNSHIP_POSTINGS ||--o{ INTERNSHIP_APPLICATIONS : receives
    INTERNSHIP_APPLICATIONS ||--o{ STUDENT_PLACEMENTS : converts_to
    
    STUDENTS {
        uuid student_id PK
        string first_name
        string last_name
        date date_of_birth
        string enrollment_status
        decimal gpa_cumulative
    }
    
    SCHOLARSHIPS {
        uuid scholarship_id PK
        string name
        string organization
        decimal typical_award_amount
        date application_deadline
        jsonb eligibility_criteria
    }
    
    VIDEO_UPLOADS {
        uuid video_id PK
        uuid student_id FK
        string video_type
        integer duration_seconds
        string processing_status
    }
    
    CORPORATE_PARTNERS {
        uuid partner_id PK
        string company_name
        string partnership_tier
        boolean iam_aaf_company
    }
```

## ML Model Pipeline

```mermaid
graph LR
    subgraph "Data Collection"
        StudentData[Student Profiles]
        AcademicData[Grade History]
        VideoData[Video Footage]
        ScholarshipData[Scholarship Database]
        OutcomeData[Historical Outcomes]
    end
    
    subgraph "Feature Engineering"
        FeatureExtraction[Feature Extraction]
        DataCleaning[Data Cleaning]
        Normalization[Normalization]
    end
    
    subgraph "Model Training"
        RiskTraining[Academic Risk Model<br/>XGBoost]
        MatchTraining[Scholarship Match Model<br/>Hybrid Recommender]
        VideoTraining[Video Analysis Model<br/>YOLO + CNN]
    end
    
    subgraph "Model Deployment"
        VertexAI[Vertex AI<br/>Cloud Deployment]
        EdgeDeploy[Edge Deployment<br/>Concrete Engine]
    end
    
    subgraph "Inference & Monitoring"
        RealTime[Real-time Predictions]
        BatchJobs[Batch Processing]
        DriftDetection[Model Drift Detection]
        Retraining[Automated Retraining]
    end
    
    StudentData --> FeatureExtraction
    AcademicData --> FeatureExtraction
    VideoData --> FeatureExtraction
    ScholarshipData --> FeatureExtraction
    OutcomeData --> FeatureExtraction
    
    FeatureExtraction --> DataCleaning
    DataCleaning --> Normalization
    
    Normalization --> RiskTraining
    Normalization --> MatchTraining
    Normalization --> VideoTraining
    
    RiskTraining --> VertexAI
    MatchTraining --> VertexAI
    VideoTraining --> EdgeDeploy
    VideoTraining --> VertexAI
    
    VertexAI --> RealTime
    VertexAI --> BatchJobs
    EdgeDeploy --> RealTime
    
    RealTime --> DriftDetection
    BatchJobs --> DriftDetection
    DriftDetection --> Retraining
    Retraining --> RiskTraining
    Retraining --> MatchTraining
    Retraining --> VideoTraining
```

## Concrete Engine Integration

```mermaid
graph TB
    subgraph "Student Learning"
        Students[Students]
        BuildHardware[Build Edge<br/>Computing Modules]
        LearnSkills[Learn:<br/>Electronics, Networking,<br/>DevOps, AI]
    end
    
    subgraph "Edge Infrastructure"
        EdgeModule1[Edge Module 1<br/>FC Brownsville Field A]
        EdgeModule2[Edge Module 2<br/>FC Brownsville Field B]
        EdgeModule3[Edge Module 3<br/>Training Facility]
    end
    
    subgraph "Edge Processing"
        Camera1[Camera Feed]
        LocalAI[Local AI Processing<br/>Player Tracking,<br/>Highlight Detection]
        LocalStorage[Local Cache]
    end
    
    subgraph "Cloud Platform"
        CloudSync[Cloud Sync Service]
        CloudAI[Deep Analysis<br/>Skill Assessment,<br/>Comparison]
        CloudStorage[Video Archive]
        Database[(PostgreSQL)]
    end
    
    subgraph "Corporate Workforce Pipeline"
        Skills[Skills Demonstrated:<br/>Manufacturing,<br/>Technical,<br/>Problem-solving]
        Internships[Internship<br/>Opportunities]
        Companies[IAM/AAF<br/>Companies]
    end
    
    Students --> BuildHardware
    BuildHardware --> EdgeModule1
    BuildHardware --> EdgeModule2
    BuildHardware --> EdgeModule3
    BuildHardware --> LearnSkills
    
    EdgeModule1 --> Camera1
    Camera1 --> LocalAI
    LocalAI --> LocalStorage
    
    LocalStorage --> CloudSync
    CloudSync --> CloudAI
    CloudSync --> CloudStorage
    CloudAI --> Database
    
    LearnSkills --> Skills
    Skills --> Internships
    Companies --> Internships
    Internships --> Students
```

## System Monitoring & Alerting

```mermaid
graph TB
    subgraph "Data Collection"
        APIMetrics[API Metrics<br/>Response Time, Errors]
        DBMetrics[Database Metrics<br/>Query Time, Connections]
        MLMetrics[ML Model Metrics<br/>Accuracy, Latency]
        BusinessMetrics[Business Metrics<br/>Applications, Matches]
    end
    
    subgraph "Monitoring Tools"
        CloudMonitoring[Google Cloud<br/>Monitoring]
        Prometheus[Prometheus]
        Grafana[Grafana<br/>Dashboards]
    end
    
    subgraph "Alerting"
        AlertManager[Alert Manager]
        PagerDuty[PagerDuty]
        Slack[Slack Notifications]
        Email[Email Alerts]
    end
    
    subgraph "Response"
        OnCall[On-Call Engineer]
        AutoScale[Auto-scaling]
        IncidentLog[Incident Log]
    end
    
    APIMetrics --> CloudMonitoring
    DBMetrics --> CloudMonitoring
    MLMetrics --> Prometheus
    BusinessMetrics --> Prometheus
    
    CloudMonitoring --> Grafana
    Prometheus --> Grafana
    
    Grafana --> AlertManager
    AlertManager --> PagerDuty
    AlertManager --> Slack
    AlertManager --> Email
    
    PagerDuty --> OnCall
    AlertManager --> AutoScale
    OnCall --> IncidentLog
```

---

## How to Use These Diagrams

### Viewing Mermaid Diagrams
1. **GitHub/GitLab:** Renders automatically in markdown
2. **VS Code:** Install "Mermaid Preview" extension
3. **Online:** Paste into https://mermaid.live/
4. **Export:** Use mermaid-cli to generate PNG/SVG

### When to Reference
- **System Overview:** Understanding how everything connects
- **Data Flow:** Debugging issues or planning features
- **Entity Relationships:** Database design and queries
- **ML Pipeline:** Model training and deployment
- **Monitoring:** Setting up observability

### Updating Diagrams
As you build and architecture evolves, update these diagrams:
1. Add new services/integrations
2. Document new data flows
3. Update entity relationships
4. Track ML model versions

---

## Architecture Decision Records (ADRs)

### Why PostgreSQL?
- FERPA compliance requires ACID transactions
- Complex queries (joins across students, scholarships, videos)
- Strong ecosystem for Python/Node.js
- Managed service available (Cloud SQL)
- Alternative considered: MongoDB (rejected - lacks relational integrity)

### Why Microservices?
- Independent scaling (video processing ≠ scholarship matching)
- Team autonomy (different developers, different services)
- Tech flexibility (Python for ML, Node for real-time)
- Deployment independence (update one service without affecting others)

### Why React Native?
- Cross-platform (iOS + Android from one codebase)
- Large community and mature ecosystem
- Students/parents need mobile-first experience
- Alternative considered: Flutter (rejected - smaller talent pool)

### Why Google Cloud?
- Existing familiarity
- Strong ML/AI services (Vertex AI)
- Good nonprofit pricing
- Excellent Kubernetes support
- Alternative considered: AWS (similar, went with familiarity)

---

These diagrams represent the complete system architecture. Reference them as you build to ensure all pieces connect properly.
