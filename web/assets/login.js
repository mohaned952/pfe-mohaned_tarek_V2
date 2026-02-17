(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('oauthRetry') === '1') {
    alert('GitHub login code expired or was already used. Please click sign in again.');
    if (window.history?.replaceState) window.history.replaceState({}, '', '/');
  }

  if (params.get('teacherCodeRequired') === '1') {
    alert('Teacher account not found. Enter the invitation code to register as teacher.');
    if (window.history?.replaceState) window.history.replaceState({}, '', '/');
  }
})();
