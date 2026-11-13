// Loaded before the page draws so a dark-mode visitor never sees a flash of the light theme.
// The site follows the system setting until the visitor picks a theme with the header toggle.
(function () {
  var root = document.documentElement;
  var query = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var stored = null;
  try { stored = localStorage.getItem('island-days:theme'); } catch (e) {}
  function apply() {
    var theme = stored === 'light' || stored === 'dark' ? stored : query && query.matches ? 'dark' : 'light';
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#121a15' : '#254e3b');
  }
  apply();
  if (query && query.addEventListener) query.addEventListener('change', function () { if (!stored) apply(); });
  window.islandTheme = {
    toggle: function () {
      stored = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('island-days:theme', stored); } catch (e) {}
      apply();
      return stored;
    }
  };
  document.addEventListener('DOMContentLoaded', apply);
})();
