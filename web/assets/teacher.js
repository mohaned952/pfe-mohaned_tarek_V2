async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload.data;
}

function renderSubmission(item) {
  return `
    <article class="list-item">
      <div><strong>Student:</strong> ${item.student?.username || '-'}</div>
      <div><strong>Repo:</strong> ${item.repoUrl}</div>
      <div><strong>Language:</strong> ${item.language}</div>
      <div><strong>Status:</strong> ${item.status}</div>
      <div><strong>Grade:</strong> ${item.grade ?? '-'} / 20</div>
      <button class="btn" data-grade-id="${item.id}">Run Grading</button>
    </article>
  `;
}

async function loadAnalytics() {
  const box = document.getElementById('analytics-box');
  try {
    const data = await api('/api/teacher/analytics');
    box.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    box.textContent = error.message;
  }
}

async function loadSubmissions() {
  const container = document.getElementById('teacher-submission-list');
  try {
    const data = await api('/api/teacher/submissions');
    container.innerHTML = data.length ? data.map(renderSubmission).join('') : '<p class="muted">No submissions available.</p>';

    container.querySelectorAll('[data-grade-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await api(`/api/teacher/submissions/${button.dataset.gradeId}/grade`, { method: 'POST' });
          await loadSubmissions();
          await loadAnalytics();
        } catch (error) {
          alert(error.message);
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    container.innerHTML = `<p class="error">${error.message}</p>`;
  }
}

document.getElementById('suite-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    await api('/api/teacher/suites', {
      method: 'POST',
      body: JSON.stringify({
        title: form.get('title'),
        language: form.get('language'),
        definition: JSON.parse(form.get('definition'))
      })
    });
    event.currentTarget.reset();
    alert('Suite saved');
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById('logout').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

loadAnalytics();
loadSubmissions();
