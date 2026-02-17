document.addEventListener('DOMContentLoaded', () => {
  const addTeacherForm = document.getElementById('add-teacher-form');
  const newTeacherName = document.getElementById('new-teacher-name');
  const newTeacherPassword = document.getElementById('new-teacher-password');
  const teachersList = document.getElementById('teachers-list');
  const addTeacherStatus = document.getElementById('add-teacher-status');
  const adminLogoutBtn = document.getElementById('admin-logout-btn');
  const deleteAllStudentsBtn = document.getElementById('delete-all-students-btn');
  const reposProcessedEl = document.getElementById('metric-repos-processed');
  const testsPassedEl = document.getElementById('metric-tests-passed');
  const testsFailedEl = document.getElementById('metric-tests-failed');
  const submissionsTrendChart = document.getElementById('submissions-trend-chart');
  const gradeDistributionChart = document.getElementById('grade-distribution-chart');
  const trendDailyBtn = document.getElementById('trend-daily-btn');
  const trendWeeklyBtn = document.getElementById('trend-weekly-btn');
  const trendMonthlyBtn = document.getElementById('trend-monthly-btn');

  const adminPassword = localStorage.getItem('admin_password');
  if (!adminPassword) {
    window.location.href = '/teacher/index.html';
    return;
  }

  function setStatus(text, colorClass = 'text-gray-700') {
    addTeacherStatus.textContent = text;
    addTeacherStatus.className = `text-sm mt-3 ${colorClass}`;
  }

  async function api(url, options = {}) {
    const response = await fetch(url, options);
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body?.error?.message || body?.error || `HTTP ${response.status}`);
    }
    if (body && body.success && Object.prototype.hasOwnProperty.call(body, 'data')) {
      return body.data;
    }
    return body;
  }

  function renderBarChart(container, rows, labelKey, valueKey) {
    if (!container) return;
    if (!Array.isArray(rows) || rows.length === 0) {
      container.innerHTML = '<p class="text-gray-500 italic">No data available.</p>';
      return;
    }
    const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);
    container.innerHTML = rows
      .map((row) => {
        const value = Number(row[valueKey] || 0);
        const width = Math.max(4, Math.round((value / max) * 100));
        return `<div>
          <div class="flex justify-between"><span>${row[labelKey]}</span><span>${value}</span></div>
          <div class="w-full bg-gray-200 rounded h-2 mt-1"><div class="bg-blue-600 h-2 rounded" style="width:${width}%"></div></div>
        </div>`;
      })
      .join('');
  }

  async function loadTeachers() {
    const rows = await api('/api/teacher/list');
    teachersList.innerHTML = rows.length
      ? rows
          .map(
            (teacher) => `<div class="border rounded p-3 bg-gray-50">
            <p><span class="font-semibold">Name:</span> ${teacher.name}</p>
            <div class="mt-2 flex gap-2">
              <input id="new-password-${teacher.id}" type="text" class="flex-1 border border-gray-300 rounded px-2 py-1 text-xs" placeholder="New password">
              <button class="change-password-btn bg-green-600 text-white text-xs px-2 py-1 rounded" data-id="${teacher.id}">Change Password</button>
              <button class="delete-teacher-btn bg-red-600 text-white text-xs px-2 py-1 rounded" data-id="${teacher.id}">Delete</button>
            </div>
          </div>`
          )
          .join('')
      : '<p class="text-gray-500 italic">No teachers found.</p>';

    teachersList.querySelectorAll('.change-password-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const teacherId = button.getAttribute('data-id');
        const input = document.getElementById(`new-password-${teacherId}`);
        const newPassword = String(input.value || '').trim();
        if (!newPassword) return;
        try {
          await api(`/api/admin/teachers/${teacherId}/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminPassword, newPassword })
          });
          setStatus('Teacher password updated.', 'text-green-700');
          input.value = '';
        } catch (error) {
          setStatus(`Failed: ${error.message}`, 'text-red-700');
        }
      });
    });

    teachersList.querySelectorAll('.delete-teacher-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const teacherId = button.getAttribute('data-id');
        if (!confirm('Delete this teacher account?')) return;
        try {
          await api(`/api/admin/teachers/${teacherId}`, {
            method: 'DELETE',
            headers: { 'x-admin-password': adminPassword }
          });
          setStatus('Teacher deleted.', 'text-green-700');
          await loadTeachers();
        } catch (error) {
          setStatus(`Failed: ${error.message}`, 'text-red-700');
        }
      });
    });
  }

  async function loadAnalytics(interval = 'daily') {
    const [agents, trends, grades] = await Promise.all([
      api('/api/admin/analytics/agents', { headers: { 'x-admin-password': adminPassword } }),
      api(`/api/admin/analytics/submissions?interval=${encodeURIComponent(interval)}`, {
        headers: { 'x-admin-password': adminPassword }
      }),
      api('/api/admin/analytics/grades', {
        headers: { 'x-admin-password': adminPassword }
      })
    ]);

    reposProcessedEl.textContent = agents.reposProcessed;
    testsPassedEl.textContent = agents.testsPassed;
    testsFailedEl.textContent = agents.testsFailed;
    renderBarChart(submissionsTrendChart, trends, 'period', 'count');
    renderBarChart(gradeDistributionChart, grades, 'range', 'count');

    [trendDailyBtn, trendWeeklyBtn, trendMonthlyBtn].forEach((btn) => btn.classList.replace('bg-blue-600', 'bg-gray-600'));
    if (interval === 'daily') trendDailyBtn.classList.replace('bg-gray-600', 'bg-blue-600');
    if (interval === 'weekly') trendWeeklyBtn.classList.replace('bg-gray-600', 'bg-blue-600');
    if (interval === 'monthly') trendMonthlyBtn.classList.replace('bg-gray-600', 'bg-blue-600');
  }

  trendDailyBtn.addEventListener('click', () => loadAnalytics('daily').catch(() => null));
  trendWeeklyBtn.addEventListener('click', () => loadAnalytics('weekly').catch(() => null));
  trendMonthlyBtn.addEventListener('click', () => loadAnalytics('monthly').catch(() => null));

  addTeacherForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = String(newTeacherName.value || '').trim();
    const password = String(newTeacherPassword.value || '').trim();
    if (!name || !password) {
      setStatus('Teacher name and password are required.', 'text-red-700');
      return;
    }

    try {
      await api('/api/admin/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword,
          name,
          password
        })
      });
      setStatus('Teacher added successfully.', 'text-green-700');
      newTeacherName.value = '';
      newTeacherPassword.value = '';
      await loadTeachers();
    } catch (error) {
      setStatus(`Failed to add teacher: ${error.message}`, 'text-red-700');
    }
  });

  deleteAllStudentsBtn.addEventListener('click', async () => {
    if (!confirm('Delete ALL students and ALL submissions?')) return;
    try {
      const result = await api('/api/admin/students', {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword }
      });
      setStatus(result.message || 'All students deleted.', 'text-green-700');
      await loadAnalytics('daily');
    } catch (error) {
      setStatus(`Failed: ${error.message}`, 'text-red-700');
    }
  });

  adminLogoutBtn.addEventListener('click', () => {
    localStorage.removeItem('admin_password');
    localStorage.removeItem('teacher');
    window.location.href = '/index.html';
  });

  loadTeachers().catch((error) => setStatus(error.message, 'text-red-700'));
  loadAnalytics('daily').catch((error) => setStatus(error.message, 'text-red-700'));
});
