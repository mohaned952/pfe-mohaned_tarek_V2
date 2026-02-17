document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const loginSection = document.getElementById('login-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const logoutBtn = document.getElementById('logout-btn');

  const navButtons = Array.from(document.querySelectorAll('.nav-item'));
  const views = Array.from(document.querySelectorAll('.view'));
  const workspaceTitle = document.getElementById('workspace-title');
  const workspaceSubtitle = document.getElementById('workspace-subtitle');

  const metricTotalStudents = document.getElementById('metric-total-students');
  const metricTotalSubmissions = document.getElementById('metric-total-submissions');
  const metricGraded = document.getElementById('metric-graded');
  const metricUngraded = document.getElementById('metric-ungraded');
  const metricReposProcessed = document.getElementById('metric-repos-processed');
  const metricTestsPassed = document.getElementById('metric-tests-passed');
  const metricTestsFailed = document.getElementById('metric-tests-failed');
  const metricAgentStatus = document.getElementById('metric-agent-status');
  const settingsTeacherInfo = document.getElementById('settings-teacher-info');

  const filterGroup = document.getElementById('filter-group');
  const filterYear = document.getElementById('filter-year');
  const filterGrade = document.getElementById('filter-grade');
  const filterStudentName = document.getElementById('filter-student-name');
  const filterDateFrom = document.getElementById('filter-date-from');
  const filterDateTo = document.getElementById('filter-date-to');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');

  const submissionsTableBody = document.getElementById('submissions-table-body');
  const detailStudentName = document.getElementById('detail-student-name');
  const detailRepoLink = document.getElementById('detail-repo-link');
  const detailEvaluationNotes = document.getElementById('modal-evaluation-notes');
  const detailTests = document.getElementById('detail-tests');
  const detailComputedGrade = document.getElementById('detail-computed-grade');
  const modalTeacherFeedback = document.getElementById('modal-teacher-feedback');
  const correctionInstructions = document.getElementById('correction-instructions');
  const startCorrectionBtn = document.getElementById('start-correction-btn');
  const approveGradeBtn = document.getElementById('approve-grade-btn');

  const bulkCorrectionBtn = document.getElementById('bulk-correction-btn');
  const approveBulkBtn = document.getElementById('approve-bulk-btn');
  const bulkApproveFeedback = document.getElementById('bulk-approve-feedback');

  const saveSuiteBtn = document.getElementById('save-suite-btn');
  const uploadSuiteBtn = document.getElementById('upload-suite-btn');
  const suiteStatus = document.getElementById('suite-status');
  const suiteList = document.getElementById('suite-list');

  const trendIntervalButtons = Array.from(document.querySelectorAll('.seg'));
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const exportPdfBtn = document.getElementById('export-pdf-btn');

  let currentTeacher = null;
  let submissions = [];
  let students = [];
  let suites = [];
  let activeSubmission = null;
  let activeTrendInterval = 'daily';
  let trendChart = null;
  let gradeChart = null;
  let passrateChart = null;

  function sectionMeta(viewId) {
    const map = {
      'view-dashboard': {
        title: 'Dashboard',
        subtitle: 'Overview of students, submissions, and automated grading status.'
      },
      'view-projects': {
        title: 'Projects',
        subtitle: 'Create and maintain project-aligned test suites per group and year.'
      },
      'view-submissions': {
        title: 'Submissions',
        subtitle: 'Review repositories, run automated correction, and approve final grades.'
      },
      'view-test-suites': {
        title: 'Test Suites',
        subtitle: 'Manage required functions, constraints, and weighted tests.'
      },
      'view-analytics': {
        title: 'Analytics',
        subtitle: 'Track trend, grading distribution, and agent-level performance indicators.'
      },
      'view-settings': {
        title: 'Settings',
        subtitle: 'Teacher account and workspace information.'
      }
    };
    return map[viewId] || map['view-dashboard'];
  }

  function isJsonResponse(response) {
    return String(response.headers.get('content-type') || '').includes('application/json');
  }

  async function api(url, options = {}) {
    const response = await fetch(url, options);
    if (!isJsonResponse(response)) {
      throw new Error(`Unexpected response format (HTTP ${response.status})`);
    }
    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error?.message || payload?.error || `HTTP ${response.status}`;
      throw new Error(message);
    }
    if (payload && payload.success && Object.prototype.hasOwnProperty.call(payload, 'data')) {
      return payload.data;
    }
    return payload;
  }

  function statusClass(status) {
    const normalized = String(status || '').toLowerCase();
    if (['approved', 'done', 'completed'].includes(normalized)) return 'status approved';
    if (['failed'].includes(normalized)) return 'status failed';
    return 'status pending';
  }

  function statusLabel(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'done') return 'completed';
    return normalized || 'unknown';
  }

  function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function bucketDate(dateInput, interval) {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return 'Unknown';

    if (interval === 'monthly') {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    }

    if (interval === 'weekly') {
      const day = date.getUTCDay() || 7;
      const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day + 1));
      return monday.toISOString().slice(0, 10);
    }

    return date.toISOString().slice(0, 10);
  }

  function activeFilters() {
    const minGrade = String(filterGrade?.value || '').trim();
    return {
      group: String(filterGroup?.value || '').trim().toLowerCase(),
      year: String(filterYear?.value || '').trim().toUpperCase(),
      minGrade: minGrade === '' ? null : safeNumber(minGrade, 0),
      studentName: String(filterStudentName?.value || '').trim().toLowerCase(),
      fromDate: String(filterDateFrom?.value || '').trim(),
      toDate: String(filterDateTo?.value || '').trim()
    };
  }

  function applySubmissionFilters(rows) {
    const filters = activeFilters();
    return rows.filter((row) => {
      if (filters.group && String(row.group_name || '').toLowerCase() !== filters.group) return false;
      if (filters.year && String(row.year || '').toUpperCase() !== filters.year) return false;
      if (filters.studentName && !String(row.student_name || '').toLowerCase().includes(filters.studentName)) return false;
      if (filters.minGrade !== null && safeNumber(row.grade, -1) < filters.minGrade) return false;

      const submissionDate = new Date(row.submission_date);
      if (!Number.isNaN(submissionDate.getTime())) {
        if (filters.fromDate) {
          const from = new Date(filters.fromDate);
          if (submissionDate < from) return false;
        }
        if (filters.toDate) {
          const to = new Date(filters.toDate);
          to.setHours(23, 59, 59, 999);
          if (submissionDate > to) return false;
        }
      }

      return true;
    });
  }

  function testsSummary(testResults) {
    const tests = Array.isArray(testResults) ? testResults : [];
    const passed = tests.filter((item) => Boolean(item.passed)).length;
    return `${passed}/${tests.length}`;
  }

  function renderSubmissionsTable() {
    const filtered = applySubmissionFilters(submissions);
    if (!filtered.length) {
      submissionsTableBody.innerHTML = '<tr><td colspan="8" class="empty-row">No submissions found.</td></tr>';
      return;
    }

    submissionsTableBody.innerHTML = filtered
      .map((row) => {
        const feedbackReady = String(row.teacher_feedback || row.evaluation_notes || '').trim().length > 0;
        return `
          <tr>
            <td>${row.student_name || 'N/A'}<br><span class="muted">${row.group_name || ''} ${row.year || ''}</span></td>
            <td><a href="${row.repo_url}" target="_blank" rel="noopener noreferrer">Open Repo</a></td>
            <td>${new Date(row.submission_date).toLocaleString()}</td>
            <td><span class="${statusClass(row.status)}">${statusLabel(row.status)}</span></td>
            <td>${row.grade !== null && row.grade !== undefined ? `${safeNumber(row.grade).toFixed(2)}/20` : '-'}</td>
            <td>${testsSummary(row.test_results)}</td>
            <td>${feedbackReady ? '<span class="status approved">Ready</span>' : '<span class="status pending">Pending</span>'}</td>
            <td><button type="button" class="btn btn-outline-dark row-review" data-id="${row.id}">Review</button></td>
          </tr>
        `;
      })
      .join('');

    submissionsTableBody.querySelectorAll('.row-review').forEach((button) => {
      button.addEventListener('click', () => {
        const submissionId = Number.parseInt(button.getAttribute('data-id'), 10);
        const row = submissions.find((item) => Number(item.id) === submissionId);
        if (!row) return;
        selectSubmission(row);
      });
    });
  }

  function renderTestDetails(testResults = []) {
    if (!Array.isArray(testResults) || !testResults.length) {
      detailTests.innerHTML = 'No tests executed yet.';
      return;
    }

    detailTests.innerHTML = testResults
      .map((test) => {
        const badge = test.passed
          ? '<span class="status approved">Passed</span>'
          : '<span class="status failed">Failed</span>';
        return `<div style="padding:0.45rem 0;border-bottom:1px solid #e5ebf4;">
          <strong>${test.test_name || test.testName || 'Unnamed test'}</strong> ${badge}<br>
          <span class="muted">Type: ${test.test_type || 'unit'} | Duration: ${safeNumber(test.duration_ms || test.durationMs, 0)} ms</span>
          ${test.error_message ? `<div style="color:#b42318;margin-top:0.2rem;">Error: ${test.error_message}</div>` : ''}
        </div>`;
      })
      .join('');
  }

  function selectSubmission(row) {
    activeSubmission = row;
    detailStudentName.textContent = `${row.student_name || 'Student'} - ${statusLabel(row.status)}`;
    detailRepoLink.href = row.repo_url || '#';
    detailRepoLink.textContent = row.repo_url || 'No repository URL';
    detailEvaluationNotes.textContent = row.evaluation_notes || 'No evaluation notes yet.';
    detailComputedGrade.textContent =
      row.grade !== null && row.grade !== undefined ? `${safeNumber(row.grade, 0).toFixed(2)} / 20` : 'Pending';
    modalTeacherFeedback.value = row.teacher_feedback || '';
    correctionInstructions.value = row.correction_context || '';
    renderTestDetails(row.test_results || []);
  }

  function renderSuitesList() {
    if (!Array.isArray(suites) || !suites.length) {
      suiteList.innerHTML = '<p class="empty-row">No test suites yet.</p>';
      return;
    }

    suiteList.innerHTML = suites
      .map((suite) => {
        const definition = suite.definition || {};
        const tests = Array.isArray(definition.tests) ? definition.tests : [];
        const version = definition.project?.version || definition.meta?.version || 'v1.0';
        const description = definition.project?.description || 'No project description provided.';
        return `<article class="suite-item">
          <strong>${suite.name}</strong> <span class="muted">(${suite.groupName} / ${suite.year})</span><br>
          <span class="muted">Language: ${String(definition.language || 'auto').toUpperCase()} | Version: ${version}</span>
          <p class="muted">${description}</p>
          <p class="muted">Tests: ${tests.length}</p>
        </article>`;
      })
      .join('');
  }

  function destroyChart(chart) {
    if (chart && typeof chart.destroy === 'function') chart.destroy();
  }

  function ensureChart(canvasId, configuration, existingChart) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof window.Chart === 'undefined') return null;
    destroyChart(existingChart);
    return new window.Chart(canvas.getContext('2d'), configuration);
  }

  function renderCharts() {
    const filtered = applySubmissionFilters(submissions);

    const trendMap = new Map();
    for (const row of filtered) {
      const key = bucketDate(row.submission_date, activeTrendInterval);
      trendMap.set(key, (trendMap.get(key) || 0) + 1);
    }
    const trendLabels = Array.from(trendMap.keys()).sort();
    const trendValues = trendLabels.map((label) => trendMap.get(label) || 0);

    trendChart = ensureChart(
      'trend-chart',
      {
        type: 'line',
        data: {
          labels: trendLabels,
          datasets: [
            {
              label: 'Submissions',
              data: trendValues,
              fill: true,
              backgroundColor: 'rgba(31,79,216,0.12)',
              borderColor: '#1f4fd8',
              tension: 0.3,
              pointRadius: 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }
      },
      trendChart
    );

    const bins = Array.from({ length: 10 }).map((_, index) => ({
      label: `${index * 2}-${index * 2 + 2}`,
      count: 0
    }));
    for (const row of filtered) {
      if (row.grade === null || row.grade === undefined) continue;
      const grade = safeNumber(row.grade, 0);
      const idx = Math.min(9, Math.max(0, Math.floor(grade / 2)));
      bins[idx].count += 1;
    }

    gradeChart = ensureChart(
      'grade-chart',
      {
        type: 'bar',
        data: {
          labels: bins.map((item) => item.label),
          datasets: [
            {
              label: 'Students',
              data: bins.map((item) => item.count),
              backgroundColor: '#3b82f6'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }
      },
      gradeChart
    );

    const allTests = filtered.flatMap((row) => (Array.isArray(row.test_results) ? row.test_results : []));
    const testsPassed = allTests.filter((test) => Boolean(test.passed)).length;
    const testsFailed = allTests.filter((test) => !Boolean(test.passed)).length;

    passrateChart = ensureChart(
      'passrate-chart',
      {
        type: 'doughnut',
        data: {
          labels: ['Passed', 'Failed'],
          datasets: [
            {
              data: [testsPassed, testsFailed],
              backgroundColor: ['#22c55e', '#ef4444']
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      },
      passrateChart
    );
  }

  function renderMetrics() {
    const filtered = applySubmissionFilters(submissions);
    const graded = filtered.filter((row) => row.grade !== null && row.grade !== undefined).length;
    const ungraded = filtered.length - graded;
    const reposProcessed = filtered.filter((row) => ['completed', 'done', 'failed', 'approved'].includes(statusLabel(row.status))).length;

    const allTests = filtered.flatMap((row) => (Array.isArray(row.test_results) ? row.test_results : []));
    const passed = allTests.filter((test) => Boolean(test.passed)).length;
    const failed = allTests.filter((test) => !Boolean(test.passed)).length;

    metricTotalStudents.textContent = String(students.length);
    metricTotalSubmissions.textContent = String(filtered.length);
    metricGraded.textContent = String(graded);
    metricUngraded.textContent = String(ungraded);
    metricReposProcessed.textContent = String(reposProcessed);
    metricTestsPassed.textContent = String(passed);
    metricTestsFailed.textContent = String(failed);
    metricAgentStatus.textContent = 'Ready';

    const agentHealthPill = document.getElementById('agent-health-pill');
    if (agentHealthPill) {
      agentHealthPill.textContent = failed > passed ? 'Agent status: Attention' : 'Agent status: Healthy';
      agentHealthPill.classList.toggle('info', failed <= passed);
    }
  }

  function activateView(viewId) {
    navButtons.forEach((button) => {
      const isActive = button.getAttribute('data-target') === viewId;
      button.classList.toggle('active', isActive);
    });

    views.forEach((view) => {
      view.classList.toggle('active', view.id === viewId);
    });

    const meta = sectionMeta(viewId);
    workspaceTitle.textContent = meta.title;
    workspaceSubtitle.textContent = meta.subtitle;
  }

  function jsonDownload(content, filename, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportFilteredCsv() {
    const rows = applySubmissionFilters(submissions);
    const header = ['submission_id', 'student_name', 'group', 'year', 'status', 'grade', 'repo_url', 'submission_date'];
    const lines = [header.join(',')];
    for (const row of rows) {
      const values = [
        row.id,
        row.student_name,
        row.group_name,
        row.year,
        row.status,
        row.grade === null || row.grade === undefined ? '' : row.grade,
        row.repo_url,
        row.submission_date
      ].map((item) => `"${String(item || '').replace(/"/g, '""')}"`);
      lines.push(values.join(','));
    }
    jsonDownload(lines.join('\n'), 'teacher-report.csv', 'text/csv;charset=utf-8');
  }

  function exportPdfSummary() {
    const rows = applySubmissionFilters(submissions);
    const summary = [
      'PFE Teacher Report',
      `Generated at: ${new Date().toISOString()}`,
      `Teacher: ${currentTeacher?.name || 'Unknown'}`,
      `Submissions: ${rows.length}`,
      `Graded: ${rows.filter((item) => item.grade !== null && item.grade !== undefined).length}`,
      '',
      ...rows.map((item) => `${item.student_name} | ${item.group_name}-${item.year} | ${statusLabel(item.status)} | ${item.grade ?? '-'} /20`)
    ].join('\n');

    jsonDownload(summary, 'teacher-report.pdf', 'application/pdf');
  }

  async function refreshData() {
    if (!currentTeacher) return;
    const teacherId = encodeURIComponent(currentTeacher.id);

    const [submissionsRows, studentsRows, suitesRows] = await Promise.all([
      api(`/api/teacher/submissions?teacherId=${teacherId}`),
      api(`/api/teacher/students?teacherId=${teacherId}`),
      api(`/api/teacher/test-suites?teacherId=${teacherId}`)
    ]);

    submissions = Array.isArray(submissionsRows) ? submissionsRows : [];
    students = Array.isArray(studentsRows) ? studentsRows : [];
    suites = Array.isArray(suitesRows) ? suitesRows : [];

    renderSubmissionsTable();
    renderSuitesList();
    renderMetrics();
    renderCharts();

    if (activeSubmission) {
      const latest = submissions.find((item) => Number(item.id) === Number(activeSubmission.id));
      if (latest) selectSubmission(latest);
    }
  }

  async function loginTeacher(teacherName, password) {
    return api('/api/teacher/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherName, password })
    });
  }

  async function saveSuiteDefinition() {
    const rawText = String(document.getElementById('suite-json').value || '{}').trim();
    const definition = JSON.parse(rawText || '{}');

    const suiteVersion = String(document.getElementById('suite-version').value || '').trim();
    const suiteDescription = String(document.getElementById('suite-description').value || '').trim();
    const language = String(document.getElementById('suite-language').value || '').trim();
    const entrypoint = String(document.getElementById('suite-entrypoint').value || '').trim();

    definition.project = {
      description: suiteDescription,
      version: suiteVersion || 'v1.0'
    };

    if (language) definition.language = language;
    if (entrypoint) definition.entrypoint = entrypoint;

    await api('/api/teacher/test-suites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId: currentTeacher.id,
        groupName: String(document.getElementById('suite-group').value || '').trim(),
        year: String(document.getElementById('suite-year').value || '').trim().toUpperCase(),
        name: String(document.getElementById('suite-name').value || '').trim() || 'Default Suite',
        definition
      })
    });
  }

  navButtons.forEach((button) => {
    button.addEventListener('click', () => activateView(button.getAttribute('data-target')));
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const teacherName = String(document.getElementById('login-teacher-name').value || '').trim();
    const password = String(document.getElementById('login-password').value || '').trim();

    if (!teacherName || !password) {
      alert('Teacher name and password are required.');
      return;
    }

    if (teacherName.toLowerCase() === 'admin' && password === 'admin') {
      localStorage.setItem('admin_password', password);
      window.location.href = '/teacher/admin.html';
      return;
    }

    try {
      currentTeacher = await loginTeacher(teacherName, password);
      localStorage.setItem('teacher', JSON.stringify(currentTeacher));
      loginSection.classList.add('hidden');
      dashboardSection.classList.remove('hidden');
      settingsTeacherInfo.textContent = `Signed in teacher: ${currentTeacher.name} (${currentTeacher.email || 'no-email'})`;
      await refreshData();
      activateView('view-dashboard');
    } catch (error) {
      alert(`Login failed: ${error.message}`);
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('teacher');
    window.location.href = '/index.html';
  });

  [filterGroup, filterYear, filterGrade, filterStudentName, filterDateFrom, filterDateTo].forEach((element) => {
    element?.addEventListener('input', () => {
      renderSubmissionsTable();
      renderMetrics();
      renderCharts();
    });
  });

  clearFiltersBtn.addEventListener('click', () => {
    filterGroup.value = '';
    filterYear.value = '';
    filterGrade.value = '';
    filterStudentName.value = '';
    filterDateFrom.value = '';
    filterDateTo.value = '';
    renderSubmissionsTable();
    renderMetrics();
    renderCharts();
  });

  startCorrectionBtn.addEventListener('click', async () => {
    if (!activeSubmission) {
      alert('Select a submission first.');
      return;
    }

    try {
      await api('/api/teacher/start-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: activeSubmission.id,
          teacherId: currentTeacher.id,
          instructions: String(correctionInstructions.value || '').trim()
        })
      });
      await refreshData();
    } catch (error) {
      alert(error.message);
    }
  });

  approveGradeBtn.addEventListener('click', async () => {
    if (!activeSubmission) {
      alert('Select a submission first.');
      return;
    }

    try {
      await api('/api/teacher/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: activeSubmission.id,
          teacherId: currentTeacher.id,
          teacherFeedback: String(modalTeacherFeedback.value || '').trim()
        })
      });
      await refreshData();
    } catch (error) {
      alert(error.message);
    }
  });

  bulkCorrectionBtn.addEventListener('click', async () => {
    try {
      await api('/api/teacher/start-correction-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: currentTeacher.id,
          filters: activeFilters()
        })
      });
      await refreshData();
    } catch (error) {
      alert(error.message);
    }
  });

  approveBulkBtn.addEventListener('click', async () => {
    try {
      await api('/api/teacher/approve-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: currentTeacher.id,
          teacherFeedback: String(bulkApproveFeedback.value || '').trim(),
          filters: activeFilters()
        })
      });
      await refreshData();
    } catch (error) {
      alert(error.message);
    }
  });

  saveSuiteBtn.addEventListener('click', async () => {
    try {
      await saveSuiteDefinition();
      suiteStatus.textContent = 'Project suite saved successfully.';
      await refreshData();
    } catch (error) {
      suiteStatus.textContent = `Failed to save suite: ${error.message}`;
    }
  });

  uploadSuiteBtn.addEventListener('click', async () => {
    try {
      await api('/api/teacher/test-suites/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: currentTeacher.id,
          groupName: String(document.getElementById('suite-group').value || '').trim(),
          year: String(document.getElementById('suite-year').value || '').trim().toUpperCase(),
          name: String(document.getElementById('suite-name').value || '').trim() || 'Default Suite',
          format: String(document.getElementById('suite-format').value || 'json').trim(),
          content: String(document.getElementById('suite-upload-content').value || '').trim(),
          language: String(document.getElementById('suite-language').value || '').trim(),
          entrypoint: String(document.getElementById('suite-entrypoint').value || '').trim()
        })
      });
      suiteStatus.textContent = 'Suite file uploaded successfully.';
      await refreshData();
    } catch (error) {
      suiteStatus.textContent = `Failed to upload suite: ${error.message}`;
    }
  });

  trendIntervalButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeTrendInterval = String(button.getAttribute('data-interval') || 'daily');
      trendIntervalButtons.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      renderCharts();
    });
  });

  exportCsvBtn.addEventListener('click', exportFilteredCsv);
  exportPdfBtn.addEventListener('click', exportPdfSummary);

  const savedTeacher = localStorage.getItem('teacher');
  if (savedTeacher) {
    try {
      currentTeacher = JSON.parse(savedTeacher);
      if (currentTeacher?.id) {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        settingsTeacherInfo.textContent = `Signed in teacher: ${currentTeacher.name} (${currentTeacher.email || 'no-email'})`;
        refreshData().catch(() => {
          localStorage.removeItem('teacher');
          window.location.reload();
        });
      }
    } catch (_error) {
      localStorage.removeItem('teacher');
    }
  }

  setInterval(() => {
    if (currentTeacher) {
      refreshData().catch(() => null);
    }
  }, 30000);
});
