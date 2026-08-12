// ============================================================
// C2 Finance - Gerenciador de Tema (dark padrão ⇄ day/sépia)
// dark = gradiente anil→roxo com lua em contorno branco
// day  = gradiente verde claro→azul celeste com sol em contorno
// ============================================================

const THEMES = { dark: 'dark', day: 'day' };

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
  try { localStorage.setItem(SESSION_THEME, theme); } catch(e) {}
  resizeAllCharts(true);
};

const getTheme = () => {
  try { return localStorage.getItem(SESSION_THEME) || THEMES.dark; }
  catch(e) { return THEMES.dark; }
};

const toggleTheme = () => applyTheme(getTheme() === 'dark' ? 'day' : 'dark');

// Registrar padrão no boot
applyTheme(getTheme());