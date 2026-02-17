# PFE Platform Refactoring TODO

## Phase 1: Remove Unnecessary Features
- [ ] 1.1 Remove deduplication logic in gradingQueueService.js
- [ ] 1.2 Remove AI-based Grader agent (will replace with test-based grading)

## Phase 2: Implement TestExecutor
- [ ] 2.1 Extend TestExecutor to retrieve test suite configuration
- [ ] 2.2 Parse test definitions (function names, input/output, timeout, weight)
- [ ] 2.3 Execute tests dynamically
- [ ] 2.4 Store results in TestResult table
- [ ] 2.5 Return weighted score

## Phase 3: Update WorkflowManager
- [ ] 3.1 Integrate TestExecutor to get test results
- [ ] 3.2 Calculate final grade based on test results (not AI)
- [ ] 3.3 Use AI only for feedback generation

## Phase 4: Add Analytics Endpoints
- [ ] 4.1 Submission trends over time
- [ ] 4.2 Grade distribution
- [ ] 4.3 Agent activity metrics

## Phase 5: Add Test Suite CRUD for Teachers
- [ ] 5.1 Create test suite endpoint
- [ ] 5.2 Update test suite endpoint
- [ ] 5.3 Delete test suite endpoint
- [ ] 5.4 List test suites endpoint

## Phase 6: Update Frontend
- [ ] 6.1 Add test suite configuration UI
- [ ] 6.2 Add analytics dashboard
