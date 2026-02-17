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
  const feedback = item.feedback
    ? `<div><strong>Feedback:</strong> ${item.feedback.summary}</div>`
    : '<div class="muted">Feedback not available yet.</div>';

  return `
    <article class="list-item">
      <div><strong>Repo:</strong> ${item.repoUrl}</div>
      <div><strong>Language:</strong> ${item.language}</div>
      <div><strong>Status:</strong> ${item.status}</div>
      <div><strong>Grade:</strong> ${item.grade ?? '-'} / 20</div>
      ${feedback}
    </article>
  `;
}

async function loadSubmissions() {
  const container = document.getElementById('submission-list');
  try {
    const data = await api('/api/student/submissions');
    container.innerHTML = data.length ? data.map(renderSubmission).join('') : '<p class="muted">No submissions yet.</p>';
  } catch (error) {
    container.innerHTML = `<p class="error">${error.message}</p>`;
  }
}

document.getElementById('submission-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = {
    repoUrl: form.get('repoUrl'),
    repoBranch: form.get('repoBranch'),
    language: form.get('language')
  };

  try {
    await api('/api/student/submissions', { method: 'POST', body: JSON.stringify(body) });
    event.currentTarget.reset();
    await loadSubmissions();
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById('logout').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

loadSubmissions();
