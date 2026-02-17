# Enterprise Architecture

## Runtime Modules

- `src/routes`: HTTP contract and request mapping.
- `src/controllers`: thin transport layer with no business logic.
- `src/services`: orchestration, AI integration, queue handling.
- `src/agents`: multi-agent grading pipeline.
- `src/models`: Prisma-backed data access.
- `src/middleware`: security, validation, logging, RBAC, error handling.
- `src/utils`: common helpers, metrics, standardized API responses.
- `src/config`: environment schema, logger, Prisma, Redis.
- `src/workers`: asynchronous grading workers.

## Multi-Agent Orchestration

1. `RepoRetriever` fetches repository tree and source snippets (retry-safe GitHub calls).
2. `TestExecutor` executes weighted language-aware tests and computes the automated grade.
3. Optional AI narrative feedback is generated from test outcomes only.
4. `FeedbackGenerator` builds teacher-visible feedback.
5. `WorkflowManager` manages state transitions and persistence.

## State Transition Model

- `SUBMITTED` -> `PROCESSING` when worker starts grading.
- `PROCESSING` -> `DONE` on successful grading.
- `PROCESSING` -> `FAILED` on unrecoverable error.
- `DONE` -> `APPROVED` when teacher confirms final grade.

## Grading Integrity Model

- Final grade is computed exclusively from automated test execution results.
- AI feedback is narrative only and never affects grade computation.
- Teachers can approve/reject submissions but cannot override computed grades.
- Approval publishes the automated grade and feedback status only.

## Observability

- Structured logs via Pino.
- Request ID propagation from middleware to AI + worker logs.
- Prometheus metrics:
  - `grading_duration_seconds`
  - `grading_failures_total`

## Security Controls

- Helmet hardening.
- Rate limiting.
- Strict CORS allow-list.
- Zod request validation.
- Header role guards (`x-role`: admin/teacher/student).
- Environment validation with startup failure on invalid config.
