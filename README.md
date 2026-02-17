# PFE Code Correction Platform (V3)

Clean rewrite of the web platform for automated correction of student programming assignments.

## Features
- GitHub OAuth 2.0 login for all users
- RBAC with `STUDENT` and `TEACHER`
- Teacher onboarding code: only `teacher2026` grants teacher role on first login
- GitHub repository retrieval (source ingestion)
- Automated test execution for C, PHP, JavaScript, Java, and HTML/CSS checks
- Automatic grading (0-20 scale)
- Feedback generation and persistence
- Student and teacher dashboards (legacy admin page removed)

## Folder Structure
- `src/agents`: repo retrieval, test execution, grading, feedback, workflow orchestration
- `src/services`: auth, submission flow, suite management, analytics
- `src/routes`: API endpoints (`/api/auth`, `/api/student`, `/api/teacher`)
- `src/middlewares`: authentication, RBAC, error handling
- `src/config`: environment and Prisma client
- `web`: frontend pages (`index.html`, `student.html`, `teacher.html`)
- `prisma/schema.prisma`: database models

## Environment
Copy `.env.example` to `.env` and configure:
- `JWT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_REDIRECT_URI`

Teacher invite code defaults to `teacher2026` through `TEACHER_INVITE_CODE`.

## Run Locally
1. `npm install`
2. `copy .env.example .env` (Windows) or `cp .env.example .env` (Linux/macOS)
3. Fill OAuth and JWT values in `.env`
4. `npm run prisma:generate`
5. `npm run prisma:sync`
6. `npm run dev`

Open `http://localhost:3000`.

## API Overview
- `GET /api/auth/github`
- `GET /api/auth/github/callback`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET/POST /api/student/submissions`
- `GET /api/student/submissions/:id`
- `GET /api/teacher/submissions`
- `POST /api/teacher/submissions/:id/grade`
- `GET/POST /api/teacher/suites`
- `GET /api/teacher/analytics`

## Security Notes
- OAuth and JWT-based session handling
- Role checks on all protected routes
- Input and execution time limits in test runner
- No plaintext secrets committed; all secrets are env-based

## Legacy Removal
- Old admin pages and legacy backend modules were removed.
- Frontend now includes only login, student dashboard, and teacher dashboard.
