export type Theme = 'light' | 'dark';

/** Same key the dashboard uses, so a shared domain keeps one preference. */
export const THEME_STORAGE_KEY = 'la_theme';

/**
 * The blocking script the layout renders in <head>.
 *
 * It sets `.dark` on <html> from localStorage (falling back to the OS setting)
 * before first paint, so a dark-mode visitor never sees a white flash. Lives in
 * a plain module rather than the client hook so the server layout can import it
 * without pulling the hook into the server graph.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var dark = stored === 'dark' || (stored !== 'light' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`.trim();
