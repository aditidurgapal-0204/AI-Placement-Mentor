# AI Placement Mentor

**AI Placement Mentor** is a full-stack, AI-powered placement preparation platform that evaluates a student's placement readiness using structured profile information and resume evidence, then converts that analysis into a personalized preparation roadmap, resume feedback, and mock-interview experience.

The project follows a **hybrid deterministic + generative AI architecture**. Critical decisions such as readiness scoring, evidence selection, validation, and grounding are controlled by backend logic, while Gemini is used for natural-language generation and interactive AI experiences.

---

## Live Project

**Frontend:** Deployed on Vercel  
**Backend:** Deployed on Render  
**Database:** Neon PostgreSQL

**Repository:**  
https://github.com/aditidurgapal-0204/AI-Placement-Mentor

---

# Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [How the Application Works](#how-the-application-works)
- [System Architecture](#system-architecture)
- [Placement Analysis Architecture](#placement-analysis-architecture)
- [AI and Gemini Integration](#ai-and-gemini-integration)
- [REST API](#rest-api)
- [Authentication Flow](#authentication-flow)
- [Resume Processing](#resume-processing)
- [Mock Interview Flow](#mock-interview-flow)
- [Database Architecture](#database-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Security](#security)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Testing](#testing)
- [Important Engineering Decisions](#important-engineering-decisions)
- [Current Limitations](#current-limitations)
- [Technical Highlights](#technical-highlights)
- [Author](#author)

---

# Overview

Students often prepare for placements without knowing:

- How placement-ready they currently are
- Which skills are actually affecting their readiness
- Which areas should be prioritized
- Whether their resume provides sufficient evidence
- How to structure preparation around their available time
- How well they can perform in an interview

AI Placement Mentor addresses these problems through a single platform.

The student provides academic information, preparation levels, placement goals, available preparation time, and optionally a resume.

The system then processes this information through deterministic analysis and controlled AI generation.

### Main user journey

```text
Landing Page
      ↓
Signup / Login
      ↓
5-Step Onboarding
      ↓
Profile + Skills + Goals + Time + Resume
      ↓
Placement Analysis
      ↓
Readiness Score + AI Diagnosis
      ↓
Strengths + Weaknesses + Priorities
      ↓
Personalized Preparation Roadmap
      ↓
Resume Analyzer / Mock Interview
```

---

# Key Features

## 1. AI Placement Readiness Analysis

The authenticated placement analysis evaluates information such as:

- Branch
- Academic year
- CGPA
- Target role
- Target company type
- DSA level
- DBMS level
- Operating Systems level
- Computer Networks level
- Aptitude level
- Communication level
- Preparation timeline
- Daily study hours
- Resume evidence

The system produces:

- Overall readiness score
- AI diagnosis
- Strengths
- Score blockers
- Career risks
- Highest-priority improvement area
- Evidence-backed reasoning

The readiness score is **not generated directly by Gemini**.

The backend calculates the score using deterministic rules and then uses AI for controlled language generation.

---

## 2. Resume-Aware Analysis

The platform can analyze a student's resume and extract evidence such as:

- Projects
- Technologies
- Skills
- Internships / experience
- Certifications
- Leadership
- Extracurricular activities
- GitHub information
- Deployment evidence
- Education
- CGPA

Resume information can then influence placement analysis and technical mock interviews.

This allows the application to reason about the student's actual profile rather than treating every student identically.

---

## 3. Personalized AI Roadmap

The roadmap is generated according to the student's:

- Target role
- Target company type
- Current skill levels
- Weak areas
- Preparation timeline
- Daily study capacity
- Resume evidence
- Placement-analysis priorities

The roadmap is structured month-by-month rather than being a generic list of topics.

Typical roadmap information includes:

- Month
- Focus
- Topics
- Goals
- Preparation priorities

---

## 4. AI Resume Analyzer

The Resume Analyzer is publicly accessible without requiring login.

A user can upload a PDF resume and receive:

- ATS-oriented score
- Content analysis
- Structure analysis
- Skills analysis
- Project / experience analysis
- Impact analysis
- Strengths
- Weaknesses
- Improvement suggestions
- Natural-language summary

The ATS-oriented evaluation is primarily deterministic.

Gemini is used for controlled language generation based on verified resume facts.

---

## 5. AI Mock Interviews

The platform provides two interview modes:

### HR Interview

Evaluates areas such as:

- Relevance
- Clarity
- Structure
- Professionalism
- Communication
- Assertiveness

### Technical Interview

Technical interviews are based on the candidate's resume and technical background.

Questions can be grounded in:

- Projects
- Technologies
- Skills
- Experience
- Resume claims

This prevents the technical interview from becoming a completely random question generator.

The interview evaluates areas such as:

- Technical knowledge
- Concept clarity
- Accuracy
- Problem solving
- Explanation quality
- Resume knowledge

At the end, the user receives a structured performance report.

---

# How the Application Works

The overall system can be viewed as four major layers.

```text
┌──────────────────────────────────────┐
│             Next.js Client           │
│                                      │
│ Landing │ Auth │ Onboarding          │
│ Dashboard │ Resume Analyzer          │
│ Mock Interview                       │
└───────────────────┬──────────────────┘
                    │
                    │ HTTP / JSON
                    │ Multipart PDF
                    ▼
┌──────────────────────────────────────┐
│            Express Backend           │
│                                      │
│ Auth │ AI │ Resume │ Mock Interview  │
└───────────────────┬──────────────────┘
                    │
        ┌───────────┼────────────┐
        ▼           ▼            ▼
     Prisma     Analysis      Gemini
        │         Engines       API
        ▼           │            │
   Neon PostgreSQL  │            │
                    ▼            ▼
              Validated AI Output
```

---

# System Architecture

The most important architectural decision is that the application does **not** simply send the entire user profile to Gemini and ask:

> "Give me a placement score."

Instead, the backend follows a controlled analysis pipeline.

```text
User Profile
     +
Resume
     ↓
Evidence Extraction
     ↓
Canonical Evidence
     ↓
Deterministic Readiness Scoring
     ↓
Mentor Reasoning
     ↓
Presentation-Safe Gemini DTO
     ↓
Gemini Language Generation
     ↓
Grounding Validation
     ↓
Deterministic Fallback
     ↓
Analysis V2 Contract
     ↓
Dashboard
```

This separation makes the AI output more predictable, testable, and auditable.

---

# Placement Analysis Architecture

The placement analysis system is divided into multiple backend services.

## 1. Readiness Engine

Main service:

```text
server/services/readinessEngine.js
```

Supporting services include:

```text
scoreCalculator.js
roleWeightsConfiguration.js
companyRules.js
roleNormalizer.js
evidenceBuilder.js
evidenceRanker.js
projectEvaluator.js
structuredProjectEvidence.js
analysisFactsBuilder.js
```

The readiness engine converts profile and resume information into structured facts and calculates the readiness score.

For example:

```text
CGPA
Target Role
DSA
DBMS
OS
Networks
Aptitude
Communication
Projects
Experience
Leadership
Certifications
Preparation Time
        ↓
Readiness Factors
        ↓
Role / Company Rules
        ↓
Readiness Score
```

The score is therefore controlled by application logic rather than by arbitrary LLM output.

---

# 2. Canonical Evidence

Main service:

```text
server/services/placementAnalysis/canonicalEvidenceService.js
```

The canonical evidence layer creates a consistent representation of information extracted from:

- User profile
- Resume
- Projects
- Skills
- Experience
- Leadership
- Certifications

This is important because different parts of the application should not independently interpret the same resume.

Instead:

```text
Raw Information
      ↓
Canonical Evidence
      ↓
Analysis
      ↓
Roadmap
      ↓
Interview Context
```

---

# 3. Mentor Reasoning

Main service:

```text
server/services/placementAnalysis/mentorReasoningService.js
```

The mentor reasoning layer converts validated evidence into structured insights.

Examples include:

- Strengths
- Score blockers
- Career risks
- Preparation priorities
- Feasibility considerations

At this point the application has already established what evidence actually exists.

---

# 4. Presentation-Safe Gemini DTO

Main service:

```text
server/services/placementAnalysis/analysisLanguageService.js
```

The system does not expose the entire internal analysis object to Gemini.

Instead, it creates a **presentation-safe DTO** containing only the information Gemini needs to express the already-established analysis.

This reduces the chance of:

- Unsupported claims
- Accidental data exposure
- Score modification
- Hallucinated achievements
- Inconsistent reasoning

---

# 5. Gemini Language Generation

Gemini is instructed to:

- Preserve the supplied score
- Preserve insight identity
- Preserve ordering
- Use only supplied evidence
- Avoid inventing facts
- Avoid changing score causality
- Return structured JSON

Gemini therefore acts primarily as a **language-generation layer**.

---

# 6. Grounding Validation

Main service:

```text
server/services/placementAnalysis/geminiGroundingValidator.js
```

Gemini output is not automatically trusted.

The application validates generated content before exposing it as analysis.

Validation covers concepts such as:

- Schema validity
- Insight identity
- Ordering
- Unsupported claims
- Numeric claims
- Evidence grounding
- Score causality

The architecture is therefore:

```text
Gemini Output
      ↓
Validation
      ↓
Valid? ────── No ──────→ Deterministic Fallback
  │
 Yes
  ↓
Dashboard
```

---

# 7. Deterministic Fallback

Main service:

```text
server/services/placementAnalysis/deterministicAnalysisRenderer.js
```

If Gemini:

- Times out
- Returns malformed JSON
- Produces unsupported claims
- Fails grounding validation
- Becomes temporarily unavailable

the backend can render the analysis deterministically from validated facts.

This prevents an external AI service from becoming a single point of failure for the core readiness experience.

---

# AI and Gemini Integration

The project uses Google's Gemini API through the `@google/generative-ai` SDK.

Configured model:

```text
gemini-2.5-flash
```

The Gemini API key is stored server-side.

```text
Browser
   │
   │ Request
   ▼
Express Backend
   │
   │ GEMINI_API_KEY
   ▼
Google Gemini API
```

The browser does **not** directly call Gemini.

---

# Gemini API Calls Used in the Project

There are four major areas where Gemini is used.

---

## 1. Placement Analysis Language Generation

### Purpose

Convert structured mentor reasoning into readable dashboard content.

### Flow

```text
Profile
  +
Resume Evidence
       ↓
Deterministic Analysis
       ↓
Mentor Reasoning
       ↓
Presentation-Safe DTO
       ↓
Gemini
       ↓
Structured JSON
       ↓
Grounding Validation
       ↓
Dashboard
```

Gemini does **not** calculate the readiness score.

The score has already been calculated before the Gemini call.

The model receives information similar to:

```json
{
  "score": 72,
  "strengths": [],
  "scoreBlockers": [],
  "careerRisks": [],
  "priority": {}
}
```

Gemini's job is to turn this into readable language.

---

## 2. Roadmap Generation

### Purpose

Generate a personalized placement-preparation roadmap.

The backend provides structured candidate context including:

- Target role
- Company type
- Current skills
- Weak areas
- Preparation timeline
- Daily study capacity
- Analysis priorities

Gemini generates structured roadmap information such as:

```json
{
  "months": [
    {
      "month": 1,
      "focus": "...",
      "topics": [],
      "goals": []
    }
  ]
}
```

The roadmap generation also has deterministic fallback behavior.

---

## 3. Public Resume Analyzer Summary

Endpoint:

```http
POST /api/resume/analyze
```

The resume is first processed deterministically.

Gemini is then given verified resume facts to generate a natural-language summary.

The model is not supposed to invent:

- Employers
- Technologies
- Achievements
- Metrics
- Scores
- Certifications
- Skills

If the generated summary fails validation, the deterministic result remains available.

---

## 4. Mock Interview Generation and Evaluation

During a mock interview, Gemini can be used to:

- Evaluate candidate answers
- Generate the next question
- Generate follow-up questions
- Produce structured interview feedback

The backend provides context such as:

- Interview type
- Resume context
- Current question
- Candidate answer
- Previous conversation
- Previously asked questions
- Covered topics
- Allowed question categories
- Remaining question count

The generated response follows a structured format similar to:

```json
{
  "evaluation": {
    "ratings": {}
  },
  "nextQuestion": {
    "question": "...",
    "category": "...",
    "topic": "...",
    "isFollowUp": false
  }
}
```

Generated questions are subsequently checked by the backend.

If a question is:

- Repeated
- Irrelevant
- Outside the allowed categories
- Insufficiently grounded

the system can use a deterministic fallback question.

---

# REST API

The frontend communicates with the backend using REST APIs.

The backend normally runs on:

```text
http://localhost:8000
```

The frontend obtains the backend URL through:

```env
NEXT_PUBLIC_API_URL
```

---

# Authentication APIs

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| POST | `/api/auth/signup` | Public | Create account |
| POST | `/api/auth/login` | Public | Authenticate user |
| GET | `/api/auth/profile` | JWT | Get authenticated profile |
| POST | `/api/auth/profile-setup` | JWT | Create/update placement profile |
| POST | `/api/auth/save-onboarding-step` | JWT | Save onboarding information |
| POST | `/api/auth/save-resume-step` | JWT | Process resume onboarding step |
| POST | `/api/auth/forgot-password` | Public | Start password reset |
| POST | `/api/auth/reset-password` | Public | Complete password reset |

---

# `POST /api/auth/signup`

Creates a new user account.

Typical flow:

```text
Signup Form
    ↓
POST /api/auth/signup
    ↓
Validate Input
    ↓
Hash Password
    ↓
Create User
    ↓
Generate JWT
    ↓
Return Authentication Data
```

Passwords are never stored as plaintext.

---

# `POST /api/auth/login`

Authenticates an existing user.

```text
Email + Password
      ↓
POST /api/auth/login
      ↓
Find User
      ↓
Compare bcrypt hash
      ↓
Generate JWT
      ↓
Return Token
```

The frontend subsequently sends the JWT with protected API requests.

---

# Protected API Authentication

Protected requests use:

```http
Authorization: Bearer <JWT>
```

The backend authentication middleware verifies the token before allowing access to protected routes.

---

# `GET /api/auth/profile`

Used by the frontend to restore the authenticated user's profile.

```text
JWT
 ↓
Authentication Middleware
 ↓
User ID
 ↓
Prisma
 ↓
Placement Profile
 ↓
Frontend
```

---

# `POST /api/auth/save-onboarding-step`

Saves onboarding information as the user progresses through the multi-step setup.

This allows the application to persist profile information instead of waiting until the final step.

---

# `POST /api/auth/save-resume-step`

Handles the resume stage of onboarding.

The resume is:

```text
PDF
 ↓
Multipart Upload
 ↓
Memory Processing
 ↓
Text Extraction
 ↓
Resume Parsing
 ↓
Evidence Extraction
 ↓
Profile Storage
```

The original PDF is not permanently stored on the backend filesystem.

---

# Placement Analysis API

## `POST /api/ai/generate-analysis`

This is one of the most important APIs in the application.

### Authentication

JWT required.

### Flow

```text
Frontend
   │
   │ POST /api/ai/generate-analysis
   │ Authorization: Bearer JWT
   ▼
Express
   ↓
JWT Middleware
   ↓
Load User + Placement Profile
   ↓
Readiness Engine
   ↓
Canonical Evidence
   ↓
Mentor Reasoning
   ↓
Presentation-Safe DTO
   ↓
Gemini
   ↓
Grounding Validator
   ↓
Deterministic Fallback if required
   ↓
Analysis V2
   ↓
Roadmap
   ↓
Frontend Dashboard
```

The response contains structured information including:

- Analysis
- Analysis V2
- Roadmap
- Profile data
- Resume availability information

---

# `GET /api/ai/test-gemini`

A diagnostic endpoint used to verify Gemini connectivity.

It is intended for infrastructure/API testing rather than as part of the primary user workflow.

---

# Resume Analyzer API

## `POST /api/resume/analyze`

Public endpoint.

### Content type

```text
multipart/form-data
```

### Resume field

```text
resume
```

### Flow

```text
PDF Upload
    ↓
File Validation
    ↓
5 MB Limit
    ↓
PDF Validation
    ↓
Text Extraction
    ↓
Resume Analysis
    ↓
Verified Facts
    ↓
Optional Gemini Summary
    ↓
Validation
    ↓
Final Response
```

The PDF is processed in memory.

---

# Mock Interview APIs

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| POST | `/api/mock-interview/start` | Public | Start interview |
| POST | `/api/mock-interview/:interviewId/answer` | Public | Submit answer |

---

# `POST /api/mock-interview/start`

Starts either:

```text
HR
```

or:

```text
Technical
```

interview mode.

The request uses multipart form data.

Example:

```text
type=technical
questionLimit=5
resume=<PDF>
```

For technical interviews, resume information is used to ground the interview.

---

# `POST /api/mock-interview/:interviewId/answer`

Submits the candidate's answer.

Example request:

```json
{
  "answer": "My project used..."
}
```

The backend can then:

1. Evaluate the answer.
2. Determine relevant feedback.
3. Generate the next question.
4. Check question grounding.
5. Continue the interview.

When the question limit is reached, the backend produces a final interview report.

---

# Mock Interview Final Report

The final report contains information such as:

- Overall score
- Score label
- Dimension scores
- Strengths
- Improvement areas
- Question-by-question feedback
- Better approaches
- Top priorities
- Final verdict

---

# Authentication Flow

The application uses JWT-based authentication.

```text
User
 ↓
Signup / Login
 ↓
Backend
 ↓
JWT
 ↓
Browser
 ↓
Authorization Header
 ↓
Protected API
 ↓
JWT Middleware
 ↓
User ID
 ↓
Database
```

The current frontend stores the access token in browser `localStorage`.

Protected requests send:

```http
Authorization: Bearer <JWT>
```

---

# Resume Processing

The project uses PDF processing libraries to extract resume text.

The processing pipeline is:

```text
Resume PDF
     ↓
Multer
     ↓
Memory Buffer
     ↓
PDF Text Extraction
     ↓
Section Detection
     ↓
Resume Parsing
     ↓
Structured Evidence
```

The project contains services including:

```text
server/services/publicPdfTextExtractor.js
server/services/readiness/resumeParser.js
server/services/readiness/resumeSectionParser.js
server/services/resume/sectionDetector.js
```

Extracted information can include:

- Education
- Skills
- Projects
- Experience
- Certifications
- Leadership
- Technical technologies
- Deployment information
- Other relevant resume evidence

---

# Database Architecture

The project uses:

```text
PostgreSQL
     +
Prisma ORM
     +
Neon
```

The main database models include:

```text
User
PlacementProfile
```

Conceptually:

```text
User
 │
 └── PlacementProfile
        ├── Academic Information
        ├── Placement Goals
        ├── Skill Levels
        ├── Preparation Time
        ├── Resume Text
        └── Resume Processing Information
```

Prisma handles communication between the Express backend and PostgreSQL.

---

# Technology Stack

## Frontend

| Technology | Purpose |
|---|---|
| Next.js | React framework / App Router |
| React | UI |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Zustand | Client-side state management |
| Lucide React | Icons |

---

## Backend

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express | REST API server |
| JavaScript | Backend implementation |
| Prisma | ORM |
| JWT | Authentication |
| bcryptjs | Password hashing |
| Multer | Multipart file uploads |
| PDF parsing libraries | Resume text extraction |
| Nodemailer | Password-reset email |
| CORS | Cross-origin request control |

---

## Database

```text
PostgreSQL
Neon PostgreSQL
Prisma ORM
```

---

## AI

```text
Google Gemini API
gemini-2.5-flash
@google/generative-ai
```

---

## Deployment

```text
Frontend → Vercel
Backend  → Render
Database → Neon
```

---

# Project Structure

```text
AI-Placement-Mentor/
│
├── client/
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/
│   │   │   ├── mock-interview/
│   │   │   ├── reset-password/
│   │   │   ├── resume-analyzer/
│   │   │   ├── setup/
│   │   │   └── page.tsx
│   │   │
│   │   ├── components/
│   │   │   └── dashboard/
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── analysisResponseAdapter.ts
│   │   │   ├── analysisV2Contract.ts
│   │   │   └── roadmapContract.ts
│   │   │
│   │   └── store/
│   │       ├── useAuthStore.ts
│   │       └── useAnalysisStore.ts
│   │
│   └── package.json
│
├── server/
│   ├── config/
│   ├── configs/
│   ├── contracts/
│   ├── controllers/
│   ├── lib/
│   ├── middleware/
│   │
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   │
│   ├── routes/
│   │
│   ├── services/
│   │   ├── placementAnalysis/
│   │   ├── readiness/
│   │   ├── resume/
│   │   ├── debug/
│   │   ├── geminiService.js
│   │   ├── mockInterviewService.js
│   │   ├── publicResumeAnalyzerService.js
│   │   └── roadmapService.js
│   │
│   ├── test/
│   └── server.js
│
└── README.md
```

---

# Important Backend Services

### Placement Analysis

```text
server/services/placementAnalysis/
```

Contains:

- Analysis orchestration
- Canonical evidence generation
- Mentor reasoning
- Gemini language generation
- Grounding validation
- Deterministic rendering
- Public analysis adaptation
- Score ledger adaptation

---

### Readiness Engine

```text
server/services/readiness/
```

Contains:

- Resume parsing
- Evidence building
- Evidence ranking
- Project evaluation
- Role normalization
- Role weights
- Company rules
- Score calculation
- Analysis facts

---

### Resume Analyzer

```text
server/services/publicResumeAnalyzerService.js
```

Responsible for public resume analysis and ATS-oriented evaluation.

---

### Mock Interview

```text
server/services/mockInterviewService.js
```

Responsible for interview sessions, answer evaluation, question generation, grounding and final reports.

---

### Roadmap

```text
server/services/roadmapService.js
```

Responsible for personalized preparation roadmap generation.

---

# Security

The application includes several security-oriented controls.

## Password Security

Passwords are hashed using:

```text
bcryptjs
```

Plaintext passwords are not stored.

---

## JWT Authentication

Protected endpoints require:

```http
Authorization: Bearer <JWT>
```

JWTs are signed using a server-side secret.

---

## Password Reset

Password-reset functionality uses:

- Separate reset secret
- Expiring reset tokens
- Password-version invalidation

Reset tokens expire after a limited period.

---

## CORS

Production CORS uses an explicit allowlist rather than allowing arbitrary origins.

---

## API Key Protection

The Gemini API key is stored on the backend.

```text
GEMINI_API_KEY
```

The frontend does not receive the Gemini API key.

---

## Resume Upload Protection

Resume uploads include:

- PDF validation
- File size restriction
- In-memory processing

The application does not permanently store uploaded PDF files on the backend filesystem.

---

## AI Output Validation

Gemini responses are not blindly trusted.

Generated analysis passes through application-level validation before becoming trusted dashboard content.

---

# Local Development

## Prerequisites

Install:

- Node.js 20+
- PostgreSQL-compatible database
- Gemini API key

---

# 1. Clone Repository

```bash
git clone https://github.com/aditidurgapal-0204/AI-Placement-Mentor.git

cd AI-Placement-Mentor
```

---

# 2. Backend Setup

```bash
cd server

npm install
```

Generate Prisma client:

```bash
npm run prisma:generate
```

Apply migrations:

```bash
npm run prisma:migrate:deploy
```

Start backend:

```bash
npm start
```

The backend runs on:

```text
http://localhost:8000
```

Health check:

```text
GET /health
```

---

# 3. Frontend Setup

Open another terminal:

```bash
cd client

npm install

npm run dev
```

The Next.js development server runs on:

```text
http://localhost:3000
```

---

# Environment Variables

## Frontend

Create:

```text
client/.env.local
```

Example:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Backend

Create:

```text
server/.env
```

Example configuration:

```env
NODE_ENV=development

PORT=8000

DATABASE_URL=your_postgresql_connection_string

GEMINI_API_KEY=your_gemini_api_key

JWT_SECRET=your_jwt_secret

PASSWORD_RESET_SECRET=your_password_reset_secret

CLIENT_URL=http://localhost:3000

CORS_ORIGINS=http://localhost:3000

SMTP_HOST=your_smtp_host
SMTP_PORT=your_smtp_port
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
EMAIL_FROM=your_email
```

Never commit real credentials to Git.

---

# Deployment

The project is deployed using a separated architecture.

```text
                  Internet
                     │
                     ▼
              ┌─────────────┐
              │   Vercel    │
              │   Next.js   │
              └──────┬──────┘
                     │
                     │ HTTPS API Requests
                     ▼
              ┌─────────────┐
              │   Render    │
              │   Express   │
              └──────┬──────┘
                     │
          ┌──────────┼───────────┐
          ▼          ▼           ▼
       Neon DB    Gemini API   SMTP
```

---

## Frontend Deployment

The frontend is deployed on Vercel.

Typical configuration:

```text
Root Directory: client
Framework: Next.js
```

Environment variable:

```env
NEXT_PUBLIC_API_URL=https://your-backend-url
```

---

## Backend Deployment

The backend is deployed on Render.

Typical configuration:

```text
Root Directory: server
```

Build:

```bash
npm install && npm run prisma:generate && npm run prisma:migrate:deploy
```

Start:

```bash
npm start
```

The backend uses Render's assigned `PORT`.

---

## Database Deployment

The production PostgreSQL database is hosted on Neon.

Prisma is responsible for:

- Database schema
- Migrations
- Query abstraction
- Type-safe database access

---

# Testing

The repository contains backend and frontend tests covering important application behavior.

Backend:

```bash
cd server

npm test
```

Frontend:

```bash
cd client

npm run test:analysis
```

Build and lint:

```bash
npm run lint

npm run build
```

---

# Test Coverage Areas

The repository contains tests covering areas such as:

- Signup behavior
- Authentication
- Mock interviews
- Resume parsing
- Resume evidence
- Evidence propagation
- Readiness scoring
- Mentor reasoning
- Analysis contracts
- Gemini grounding
- Gemini output validation
- Deterministic fallback parity
- Roadmap generation
- Public resume analysis
- Production analysis integration
- Project evidence extraction
- Score ledger behavior

The analysis pipeline has particularly extensive tests because the readiness score and evidence flow are core application logic.

---

# Important Engineering Decisions

## 1. Deterministic Score + AI Explanation

The readiness score is calculated by backend logic.

Gemini does not have authority to arbitrarily change the score.

```text
Deterministic Logic
        ↓
Score
        ↓
Gemini
        ↓
Explanation
```

This makes the score more reproducible.

---

## 2. Evidence Before Language

The system establishes evidence before asking an LLM to generate natural language.

```text
Raw Profile / Resume
        ↓
Evidence
        ↓
Reasoning
        ↓
Language
```

This is safer than:

```text
Raw Resume
        ↓
"Analyze this"
        ↓
Uncontrolled AI Output
```

---

## 3. Grounding Validation

AI-generated output is treated as untrusted until validated.

This is particularly important for a placement application because hallucinating a student's:

- Skill
- Project
- Achievement
- Score
- Experience

could produce misleading career advice.

---

## 4. Deterministic Fallback

Gemini is an external dependency.

Therefore, the application does not make the entire placement-analysis experience dependent on successful AI generation.

If Gemini fails:

```text
Gemini Failure
      ↓
Validation / Error
      ↓
Deterministic Renderer
      ↓
Usable Analysis
```

---

## 5. Role-Aware Analysis

Different placement roles have different expectations.

The project therefore includes role normalization and role-specific weighting rather than treating all candidates identically.

---

## 6. Resume-Aware Technical Interviews

Technical mock interviews use verified resume context.

This makes questions more relevant to the candidate's actual projects and skills.

---

## 7. Contract-Based Frontend Integration

The frontend contains explicit contracts and adapters for structured backend responses.

Important files include:

```text
analysisV2Contract.ts
analysisResponseAdapter.ts
roadmapContract.ts
dashboardAnalysisCompatibility.ts
```

This reduces the chance that a backend response change silently breaks the dashboard.

---

# Current Limitations

The current implementation has several known architectural limitations.

### Backend cold starts

The Render backend can experience cold starts when the service has been idle.

### In-memory interview sessions

Mock interview sessions are currently maintained in backend memory.

Therefore, an interview can be lost after:

- Server restart
- Crash
- Redeployment
- Instance replacement

### Resume persistence

Original uploaded PDF files are not permanently stored.

The application primarily works with extracted resume text and structured evidence.

### JWT storage

Access tokens are currently stored in browser `localStorage`.

A future production-hardening step could use secure HTTP-only cookies.

### No refresh-token system

The current authentication architecture does not use a separate refresh-token/revocation system.

### External AI dependency

Gemini availability can affect generated-language quality, although deterministic fallbacks protect important parts of the analysis pipeline.

---

# Technical Highlights

This project demonstrates practical experience with:

- Full-stack web application architecture
- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Zustand
- Node.js
- Express
- REST API design
- JWT authentication
- bcrypt password hashing
- PostgreSQL
- Prisma ORM
- Neon
- PDF processing
- Multipart file uploads
- Resume parsing
- Evidence extraction
- Deterministic scoring engines
- Role-based weighting
- AI API integration
- Google Gemini
- Structured JSON generation
- Prompt engineering
- LLM grounding
- AI output validation
- Deterministic AI fallbacks
- Mock interview systems
- API contracts
- Error handling
- Automated testing
- Vercel deployment
- Render deployment
- Production database deployment

---

# Architecture in One Diagram

```text
                         USER
                          │
                          ▼
                 ┌─────────────────┐
                 │  Next.js Client │
                 └────────┬────────┘
                          │
                     REST / HTTP
                          │
                          ▼
                 ┌─────────────────┐
                 │ Express Backend │
                 └────────┬────────┘
                          │
             ┌────────────┼─────────────┐
             │            │             │
             ▼            ▼             ▼
          Prisma       Resume        Auth
             │         Pipeline      Middleware
             │            │
             ▼            ▼
        PostgreSQL    Evidence
                        │
                        ▼
                ┌─────────────────┐
                │ Readiness Engine│
                └────────┬────────┘
                         │
                         ▼
                Canonical Evidence
                         │
                         ▼
                Mentor Reasoning
                         │
                         ▼
              Presentation-Safe DTO
                         │
                         ▼
                ┌─────────────────┐
                │  Gemini 2.5     │
                │     Flash       │
                └────────┬────────┘
                         │
                         ▼
                Grounding Validator
                    │          │
                  Valid      Invalid
                    │          │
                    │          ▼
                    │    Deterministic
                    │      Fallback
                    │          │
                    └────┬─────┘
                         ▼
                    Analysis V2
                         │
                         ▼
                     Dashboard
```

---

# Why This Project Is Technically Significant

The main engineering challenge in an AI placement application is not simply connecting an LLM API.

The important problem is ensuring that the AI gives advice based on **real candidate evidence**.

This project addresses that through a hybrid architecture:

```text
Deterministic Software
        +
Generative AI
        +
Evidence Validation
        +
Fallback Logic
```

Deterministic software handles decisions that need to be consistent:

- Readiness scoring
- Evidence selection
- Role weighting
- Validation
- Grounding
- Contract enforcement

Generative AI handles areas where language generation provides value:

- Natural-language diagnosis
- Roadmap wording
- Resume summaries
- Interview evaluation
- Interview question generation

The central design principle is:

> **Use deterministic software for decisions that must be consistent and auditable; use generative AI where natural-language generation and interaction provide the most value.**

---

# Author

## Aditi Durgapal

B.Tech Computer Science & Engineering

GitHub:  
https://github.com/aditidurgapal-0204

---

# Repository

https://github.com/aditidurgapal-0204/AI-Placement-Mentor
