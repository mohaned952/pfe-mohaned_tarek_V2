# PFE Platform 2.0

Production-ready AI-powered automated grading platform with deterministic evaluation, concurrency-safe multi-agent orchestration, CI/CD validation, and enterprise-level reliability.

## System Overview

PFE Platform evaluates student GitHub repositories using a multi-agent grading pipeline and asynchronous worker processing. The platform is designed for reliability, safety, and maintainability in production contexts.

Compatibility note: existing legacy API routes are mounted for transition safety while new modular routes are introduced under `src/`.

## Architecture

### Backend Layout

```text
/src
  /routes
  /controllers
  /services
  /agents
  /models
  /middleware
  /utils
  /config
  /queue
  /workers
```

### Multi-Agent Pipeline

- `RepoRetriever`: pulls repository metadata and source snippets with retry-safe GitHub calls.
- `TestExecutor`: executes weighted language-aware tests and computes the automated grade.
- `FeedbackGenerator`: structured teacher-facing feedback.
- `WorkflowManager`: orchestrates all agents and persists state transitions.

See diagrams in `docs/diagrams/` and full architecture notes in `docs/architecture.md`.

## Grading Integrity Model

- Grades are computed exclusively from automated test execution results.
- AI feedback is narrative-only and cannot assign or alter grades.
- Teachers can approve/reject submissions, but cannot override computed grades.
- Approval validates automated results and publication status only.
- API payloads attempting manual `grade` override are rejected.

## Concurrency and Reliability

- Queue job de-duplication using deterministic `jobId` (`submission:{id}`).
- Retry-safe queue processing (`attempts`, exponential backoff).
- Recovery metadata in `job_executions` table.

## AI Safety and Determinism

- Deterministic prompt strategy.
- Deterministic model settings (`temperature=0`, constrained sampling).
- Schema validation for AI response payload (Zod).
- Prompt/response metadata logging (without secret leakage).

## Security Hardening

- Helmet middleware.
- Rate limiting (`express-rate-limit`).
- Strict CORS allow-list.
- Request validation (Zod).
- Request IDs in logs and response headers.
- Standardized error format.
- Role guards via `x-role` (`admin`, `teacher`, `student`).

## Observability

- Structured logs via Pino.
- Request correlation IDs.
- Prometheus metrics endpoint (`/api/health/metrics`).
- Grading duration and failure counters.

## Database

- Prisma ORM (`prisma/schema.prisma`).
- Migration support (`prisma/migrations`).
- Submission status enum in Prisma model.

## Queue and Worker Architecture

- BullMQ queue for decoupled grading.
- Separate worker process (`npm run worker`).
- Redis-backed reliable jobs and retries.

## API Health Endpoints

- `GET /api/health/live`
- `GET /api/health/ready`
- `GET /api/health/metrics`
- `GET /api/v2/ai/health`
- `POST /api/v2/ai/grade`
- `POST /api/v2/teacher/start-correction`
- `POST /api/v2/student/login`
- `POST /api/v2/student/submit`
- `POST /api/v2/teacher/login`
- `POST /api/v2/admin/login`

## Setup

1. Install dependencies:

```bash
npm ci
```

2. Configure environment:

```bash
cp .env.example .env
# Fill values for GOOGLE_API_KEY, GITHUB_TOKEN, DATABASE_URL
```

3. Apply migrations and generate Prisma client:

```bash
npm run prisma:generate
npm run prisma:migrate:dev
```

4. Start infrastructure:

```bash
docker compose up -d redis
```

5. Run API + worker:

```bash
npm run dev
npm run worker
```

## Docker Deployment

```bash
docker compose up --build -d
```

Services:

- `app` (HTTP API)
- `worker` (grading queue processor)
- `redis` (queue backend)

## Testing

- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- E2E tests: `npm run test:e2e`

Test stack:

- Jest
- Supertest
- Playwright

External services (GitHub and Gemini) should be mocked in test environments.

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) performs:

- dependency install
- Prisma generation
- lint
- unit tests
- integration tests
- Docker build
- container smoke test
- E2E test stage

Merges should be blocked on pipeline failure.

## Scalability Notes

- HTTP path is lightweight: grading is async.
- Worker pool concurrency can be scaled horizontally.
- Queue de-duplication avoids repeated grading runs.
- Redis enables resilient retry and delayed processing patterns.

## Important Security Note

If secrets were ever committed in plain text, rotate them immediately and replace with fresh credentials.
