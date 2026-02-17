document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const submitRepoForm = document.getElementById('submit-repo-form');
  const loginSection = document.getElementById('login-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const studentNameDisplay = document.getElementById('student-name-display');
  const logoutBtn = document.getElementById('logout-btn');
  const submitTeacherSelect = document.getElementById('submit-teacher');

  const navButtons = Array.from(document.querySelectorAll('.nav-item'));
  const views = Array.from(document.querySelectorAll('.view'));
  const workspaceTitle = document.getElementById('workspace-title');
  const workspaceSubtitle = document.getElementById('workspace-subtitle');

  const submissionsTableBody = document.getElementById('submissions-table-body');
  const feedbackSummary = document.getElementById('feedback-summary');
  const feedbackDetails = document.getElementById('feedback-details');
  const feedbackTests = document.getElementById('feedback-tests');
  const requirementsBox = document.getElementById('requirements-box');

  const submissionStatus = document.getElementById('submission-status');
  const progressBar = document.getElementById('submission-progress-bar');

  let signedInStudent = null;
  let submissions = [];
  let selectedSubmissionId = null;

  function sectionMeta(viewId) {
    const map = {
      'view-projects': {
        title: 'Projects',
        subtitle: 'Submit GitHub repositories and review requirements.'
      },
      'view-submissions': {
        title: 'Submissions',
        subtitle: 'Track status: pending, processing, completed, and approved.'
      },
      'view-feedback': {
        title: 'Feedback',
        subtitle: 'Detailed test outcomes and grading comments for each submission.'
      }
    };
    return map[viewId] || map['view-projects'];
  }

  function statusClass(status) {
    const normalized = String(status || '').toLowerCase();
    if (['approved', 'done', 'completed'].includes(normalized)) return 'status approved';
    if (['failed'].includes(normalized)) return 'status failed';
    return 'status pending';
  }

  function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  async function getJson(url, options = undefined) {
    const response = await fetch(url, options);
    const body = await response.json();
    const payload = body && body.success && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
    if (!response.ok) {
      const message = payload?.error?.message || payload?.error || `HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  }

  function setSubmissionStatus(style, text) {
    submissionStatus.className = `status-box ${style}`;
    submissionStatus.textContent = text;
    submissionStatus.classList.remove('hidden');
  }

  function animateProgress(percent) {
    progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
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

  function renderSubmissionTests(testResults = []) {
    if (!Array.isArray(testResults) || !testResults.length) {
      return 'No test results available yet.';
    }

    return testResults
      .map((test) => {
        const status = test.passed ? '<span class="status approved">Passed</span>' : '<span class="status failed">Failed</span>';
        return `${test.test_name || test.testName || 'Unnamed test'} ${status}\nType: ${test.test_type || 'unit'} | Duration: ${safeNumber(test.duration_ms || test.durationMs, 0)} ms${
          test.error_message ? `\nError: ${test.error_message}` : ''
        }`;
      })
      .join('\n\n');
  }

  function selectSubmission(submissionId) {
    const row = submissions.find((item) => Number(item.id) === Number(submissionId));
    if (!row) return;

    selectedSubmissionId = row.id;
    const feedbackText = [
      `Repository: ${row.repo_url}`,
      `Status: ${String(row.status || '').toLowerCase()}`,
      `Grade: ${row.grade !== null && row.grade !== undefined ? `${safeNumber(row.grade).toFixed(2)}/20` : 'Pending'}`,
      '',
      `Teacher feedback: ${row.teacher_feedback || 'No teacher feedback yet.'}`,
      '',
      `Evaluation notes: ${row.evaluation_notes || 'No automated notes yet.'}`
    ].join('\n');

    feedbackSummary.textContent = `Selected submission #${row.id}`;
    feedbackDetails.textContent = feedbackText;
    feedbackTests.textContent = renderSubmissionTests(row.test_results || []);
  }

  function renderSubmissionsTable() {
    if (!Array.isArray(submissions) || !submissions.length) {
      submissionsTableBody.innerHTML = '<tr><td colspan="5" class="empty-row">No submissions yet.</td></tr>';
      return;
    }

    submissionsTableBody.innerHTML = submissions
      .map((row) => {
        const normalizedStatus = String(row.status || '').toLowerCase();
        return `
          <tr>
            <td>${new Date(row.submission_date || row.submissionDate).toLocaleString()}</td>
            <td><a href="${row.repo_url || row.repoUrl}" target="_blank" rel="noopener noreferrer">Open Repo</a></td>
            <td><span class="${statusClass(normalizedStatus)}">${normalizedStatus || 'pending'}</span></td>
            <td>${row.grade !== null && row.grade !== undefined ? `${safeNumber(row.grade).toFixed(2)}/20` : '-'}</td>
            <td><button type="button" class="btn btn-primary row-details" data-id="${row.id}">Details</button></td>
          </tr>
        `;
      })
      .join('');

    submissionsTableBody.querySelectorAll('.row-details').forEach((button) => {
      button.addEventListener('click', () => {
        const submissionId = Number.parseInt(button.getAttribute('data-id'), 10);
        selectSubmission(submissionId);
        activateView('view-feedback');
      });
    });
  }

  function renderRequirements(requirements) {
    if (!requirements || !Array.isArray(requirements.tests) || !requirements.tests.length) {
      requirementsBox.textContent = 'No requirements configured yet for your group/year.';
      return;
    }

    requirementsBox.textContent = requirements.tests
      .map((test, index) => {
        return [
          `${index + 1}. ${test.name || 'Unnamed test'}`,
          `Type: ${test.type || 'unit'}`,
          `Function: ${test.functionName || 'command-based'}`,
          `Timeout: ${safeNumber(test.timeoutMs, 2000)} ms`,
          `Weight: ${safeNumber(test.weight, 1)}`,
          test.expectedOutput !== undefined ? `Expected: ${JSON.stringify(test.expectedOutput)}` : ''
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n');
  }

  async function fetchTeachersForStudent() {
    submitTeacherSelect.innerHTML = '<option value="">Select your teacher</option>';
    try {
      const teacherList = await getJson('/api/teacher/list');
      if (!Array.isArray(teacherList) || !teacherList.length) {
        submitTeacherSelect.innerHTML = '<option value="">No teachers available</option>';
        return;
      }

      teacherList.forEach(({ id, name }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        submitTeacherSelect.appendChild(option);
      });
    } catch (_error) {
      submitTeacherSelect.innerHTML = '<option value="">Failed to load teachers</option>';
    }
  }

  async function fetchSubmissions() {
    if (!signedInStudent) return;
    const rows = await getJson(`/api/student/submissions/${signedInStudent.id}`);
    submissions = Array.isArray(rows) ? rows : [];
    renderSubmissionsTable();

    if (selectedSubmissionId) {
      const current = submissions.find((item) => Number(item.id) === Number(selectedSubmissionId));
      if (current) selectSubmission(current.id);
    }

    const hasProcessing = submissions.some((item) => ['pending', 'processing', 'submitted'].includes(String(item.status || '').toLowerCase()));
    animateProgress(hasProcessing ? 60 : submissions.length > 0 ? 100 : 0);
  }

  async function fetchRequirements() {
    if (!signedInStudent) return;
    try {
      const data = await getJson(`/api/student/requirements/${signedInStudent.id}`);
      renderRequirements(data);
    } catch (_error) {
      requirementsBox.textContent = 'No requirements configured yet for your group/year.';
    }
  }

  async function refreshDashboardData() {
    await Promise.all([fetchSubmissions(), fetchRequirements()]);
  }

  function showDashboard() {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    studentNameDisplay.textContent = signedInStudent.name;
    activateView('view-projects');
    refreshDashboardData().catch(() => null);
  }

  navButtons.forEach((button) => {
    button.addEventListener('click', () => activateView(button.getAttribute('data-target')));
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      name: String(document.getElementById('login-name').value || '').trim(),
      student_id: String(document.getElementById('login-student-id').value || '').trim()
    };

    if (!payload.name || !payload.student_id) {
      alert('Full name and student ID are required.');
      return;
    }

    try {
      const loginResult = await getJson('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      signedInStudent = loginResult;
      localStorage.setItem('student', JSON.stringify(signedInStudent));
      showDashboard();
    } catch (error) {
      alert(`Login failed: ${error.message}`);
    }
  });

  submitRepoForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!signedInStudent) {
      alert('You must be signed in.');
      return;
    }

    try {
      animateProgress(15);
      setSubmissionStatus('pending', 'Submitting repository...');

      const teacherId = Number.parseInt(submitTeacherSelect.value, 10);
      const groupName = String(document.getElementById('submit-group').value || '').trim();
      const year = String(document.getElementById('submit-year').value || '').trim().toUpperCase();
      const repoUrl = String(document.getElementById('repo-url').value || '').trim();

      if (Number.isNaN(teacherId)) throw new Error('Please select your teacher.');
      if (!groupName) throw new Error('Group is required.');
      if (!year) throw new Error('Year is required.');
      if (!repoUrl) throw new Error('Repository URL is required.');

      await getJson('/api/student/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: signedInStudent.id,
          teacherId,
          repoUrl,
          group_name: groupName,
          year
        })
      });

      animateProgress(50);
      setSubmissionStatus('processing', 'Submission accepted. Tests are queued.');
      document.getElementById('repo-url').value = '';

      await refreshDashboardData();
      animateProgress(70);
    } catch (error) {
      setSubmissionStatus('failed', `Submission failed: ${error.message}`);
      animateProgress(0);
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('student');
    window.location.href = '/index.html';
  });

  const storedStudent = localStorage.getItem('student');
  if (storedStudent) {
    try {
      signedInStudent = JSON.parse(storedStudent);
      if (signedInStudent?.id) showDashboard();
    } catch (_error) {
      localStorage.removeItem('student');
    }
  }

  fetchTeachersForStudent();

  setInterval(() => {
    if (signedInStudent) {
      refreshDashboardData().catch(() => null);
    }
  }, 30000);
});
