// ============================================================
// C2 Finance - Utilitários (moeda, data, DOM, ícones)
// ============================================================

const fmtMoney = (v, opts = {}) => {
  const n = Number(v || 0);
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency', currency: CURRENCY,
    maximumFractionDigits: 2,
    ...opts
  }).format(n);
};

const fmtCompact = (v) => {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}R$ ${(abs / 1e9).toLocaleString(LOCALE, {maximumFractionDigits: 1})}B`;
  if (abs >= 1e6) return `${sign}R$ ${(abs / 1e6).toLocaleString(LOCALE, {maximumFractionDigits: 1})}M`;
  if (abs >= 1e3) return `${sign}R$ ${(abs / 1e3).toLocaleString(LOCALE, {maximumFractionDigits: 1})}k`;
  return fmtMoney(n);
};

const fmtDate = (d, opts = {}) => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d.length <= 10 ? d + 'T12:00:00' : d) : d;
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString(LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric', ...opts
  });
};

const fmtShort = (d) => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d.length <= 10 ? d + 'T12:00:00' : d) : d;
  return dt.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short' });
};

const toISODate = (d) => {
  if (!d) return null;
  const dt = typeof d === 'string' ? new Date(d.length <= 10 ? d + 'T12:00:00' : d) : d;
  return isNaN(dt) ? null : dt.toISOString().slice(0, 10);
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const daysBetween = (a, b) => {
  const da = new Date(a + 'T12:00:00');
  const db = new Date(b + 'T12:00:00');
  return Math.round((db - da) / 86400000);
};

const monthKey = (d) => {
  const dt = typeof d === 'string' ? new Date(d.length <= 10 ? d + 'T12:00:00' : d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (k) => {
  const [y, m] = k.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(LOCALE, { month: 'short', year: '2-digit' });
};

const lastNMonths = (n) => {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
};

// ---------- DOM ----------
const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };

const debounce = (fn, ms = 250) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const initials = (name) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// ---------- Ícones SVG (stroke minimalista) ----------
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  trend: '<path d="M3 17l5-5 4 4 8-9"/><path d="M16 7h4v4"/>',
  swap: '<path d="M7 4v12M7 16l-3-3M7 16l3-3"/><path d="M17 20V8M17 8l-3 3M17 8l3 3"/>',
  invoice: '<path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21z"/><path d="M9 8h6M9 12h6"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15.5a4.5 4.5 0 0 1 4.5 3.5"/>',
  chart: '<path d="M4 4v16h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow_left: '<path d="M15 18l-6-6 6-6"/>',
  arrow_right: '<path d="M9 6l6 6-6 6"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  dollar: '<path d="M12 3v18M16 6.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.5 2.8 4 3.3 4 1.7 4 3.9-1.8 3.3-4 3.3-4-1.3-4-3"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M16 12h5M3 9h17"/>',
  trending_up: '<path d="M4 16l5-5 4 4 7-8"/><path d="M15 7h5v5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
  receipt: '<path d="M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 20z"/><path d="M9 7h6M9 11h6"/>',
  truck: '<path d="M3 6h11v11H3zM14 9h4l3 3v5h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="18" cy="17.5" r="1.8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
  megaphone: '<path d="M3 11v2h4l6 5V6L7 11zM14 12h4a2 2 0 0 1-2 4"/><path d="M18 8c1.3 1 2 2.3 2 4s-.7 3-2 4"/>',
  plus_circle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  minus_circle: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  bank: '<path d="M3 9l9-5 9 5M5 9v8M9 9v8M15 9v8M19 9v8M3 21h18"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  x: '<path d="M5 5l14 14M19 5L5 19"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  spark: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/>',
  arrow_up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrow_down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/>',
  moon: '<path d="M20 14.1A8.6 8.6 0 1 1 9.9 4a7 7 0 0 0 10.1 10.1z"/>'
};

const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;

// Injeta os ícones por atributo data-i
const mountIcons = (root = document) => {
  root.querySelectorAll('[data-i]').forEach(n => {
    n.innerHTML = icon(n.dataset.i, Number(n.dataset.is) || 20);
  });
};

// toast
const toast = (msg, type = 'ok') => {
  const c = document.getElementById('toasts');
  const n = el(`<div class="toast ${type}"><span>${type==='ok'?icon('check',18):type==='err'?icon('alert',18):icon('spark',18)}</span><span>${esc(msg)}</span></div>`);
  c.appendChild(n);
  mountIcons(n);
  setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 450); }, 3200);
};

// Ripple em botões
const ripple = (btn) => {
  btn.addEventListener('pointerdown', (e) => {
    const r = btn.getBoundingClientRect();
    const d = Math.max(r.width, r.height);
    const s = el(`<span style="position:absolute;width:${d}px;height:${d}px;border-radius:50%;background:rgba(255,255,255,.28);transform:scale(0);transition:transform .6s var(--ease);pointer-events:none;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px"></span>`);
    btn.appendChild(s);
    requestAnimationFrame(() => s.style.transform = 'scale(1)');
    setTimeout(() => s.remove(), 650);
  });
};

// Anima números de 0 até o valor
const animateNumber = (node, target, fmt = fmtMoney) => {
  const dur = 900, t0 = performance.now(), from = 0;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = fmt(from + (target - from) * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

const fileDownload = (filename, content, mime = 'text/plain') => {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 400);
};

const csvEscape = (v) => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCSV = (headers, rows) =>
  [headers.join(';'), ...rows.map(r => r.map(csvEscape).join(';'))].join('\n');

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);