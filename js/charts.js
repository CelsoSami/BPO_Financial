// ============================================================
// C2 Finance - Gráficos em Canvas (sem bibliotecas externas)
// Compatível com os dois temas (lê CSS vars dinamicamente).
// ============================================================

const _charts = new Map(); // id -> destruidor

const cssVar = (name) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || '#888';
};

const ctxOf = (canvas) => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  const w = r.width || canvas.clientWidth || 320;
  const h = r.height || canvas.clientHeight || 190;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
};

const chartLocale = (v) => fmtCompact(v);

// ---------------- Linha / Área (fluxo) ----------------
const areaChart = (canvasId, { labels, values, color, fill = true }) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const { ctx, w, h } = ctxOf(canvas);
  const pad = { t: 14, r: 10, b: 26, l: 8 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const max = Math.max(...values, 1e-9);
  const min = Math.min(...values, 0);
  const span = (max - min) || 1;
  const xs = (i) => pad.l + (values.length === 1 ? iw / 2 : (i / (values.length - 1)) * iw);
  const ys = (v) => pad.t + ih - ((v - min) / span) * ih;

  let prog = 0;
  const maxes = values.map((v, i) => ({
    x: xs(i),
    y: (() => { const t = Math.min(1, prog * 1.6); return pad.t + ih - (((v - min) / span) * ih) * t; })()
  }));

  const draw = (t) => {
    prog = Math.min(1, t);
    ctx.clearRect(0, 0, w, h);
    const colorMain = color || cssVar('--accent');

    // área de grade leve
    ctx.strokeStyle = cssVar('--stroke-soft');
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const y = pad.t + ih * (1 - f);
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.setLineDash([]);
    });

    // área preenchida
    if (fill) {
      const grad = ctx.createLinearGradient(0, pad.t, 0, h);
      const c = hexToRgba(colorMain, 1);
      grad.addColorStop(0, hexToRgba(colorMain, 0.42));
      grad.addColorStop(1, hexToRgba(colorMain, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(pad.l, h - pad.b);
      values.forEach((v, i) => ctx.lineTo(xs(i), pad.t + ih - ((v - min) / span) * ih * Math.min(1, prog * 1.6)));
      ctx.lineTo(w - pad.r, h - pad.b);
      ctx.closePath();
      ctx.fill();
    }

    // linha
    ctx.strokeStyle = colorMain;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = xs(i), y = pad.t + ih - ((v - min) / span) * ih * Math.min(1, prog * 1.6);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // pontos
    values.forEach((v, i) => {
      const x = xs(i), y = pad.t + ih - ((v - min) / span) * ih * Math.min(1, prog * 1.6);
      if (prog >= (i + 1) / values.length) {
        ctx.fillStyle = colorMain;
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = cssVar('--text');
        ctx.strokeStyle = colorMain;
        ctx.lineWidth = 1.4;
      }
    });

    // rótulos do eixo
    ctx.fillStyle = cssVar('--muted');
    ctx.font = '500 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.ceil(labels.length / 6));
    labels.forEach((lb, i) => {
      if (i % step === 0 || i === labels.length - 1) {
        ctx.fillText(lb, xs(i), h - 8);
      }
    });

    // valor máximo destacado
    const im = values.indexOf(Math.max(...values));
    ctx.fillStyle = colorMain;
    ctx.font = '700 11px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(chartLocale(Math.max(...values)), xs(im) + 8, ys(values[im]) - 6);

    if (t < 1) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  const res = () => areaChart(canvasId, { labels, values, color, fill });
  _charts.set(canvasId, res);
  return res;
};

// ---------------- Barras (comparativo) ----------------
const barChart = (canvasId, { labels, values, colors, horizontal = false }) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const { ctx, w, h } = ctxOf(canvas);
  const pad = { t: 16, r: 10, b: 24, l: 8 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const max = Math.max(...values, 1e-9);
  const n = values.length;
  const slot = iw / n;
  const bw = Math.min(slot * 0.55, 34);
  const ds = cssVar('--bg-b');

  let prog = 0;
  const draw = (t) => {
    prog = Math.min(1, t * 1.3);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = cssVar('--stroke-soft');
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t + ih * 0.9); ctx.lineTo(w - pad.r, pad.t + ih * 0.9); ctx.stroke();
    ctx.setLineDash([]);

    labels.forEach((lb, i) => {
      const hh = (values[i] / max) * ih * 0.9 * prog;
      const x = pad.l + i * slot + (slot - bw) / 2;
      const y = pad.t + ih - hh;
      const c = (colors && colors[i]) || 'var(--accent)';
      const grad = ctx.createLinearGradient(0, y, 0, pad.t + ih);
      grad.addColorStop(0, c);
      grad.addColorStop(1, hexToRgba(c, 0.25));
      ctx.fillStyle = grad;
      rrect(ctx, x, y, bw, hh, [7, 7, 2, 2]);
      ctx.fill();

      ctx.fillStyle = cssVar('--muted');
      ctx.font = '500 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lb, x + bw / 2, h - 8);

      if (prog > 0.75) {
        ctx.fillStyle = cssVar('--text-dim');
        ctx.font = '700 9.5px JetBrains Mono, monospace';
        ctx.fillText(chartLocale(values[i]), x + bw / 2, y - 5);
      }
    });
    if (t < 1) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  const res = () => barChart(canvasId, { labels, values, colors, horizontal });
  _charts.set(canvasId, res);
  return res;
};

// ---------------- Donut (categorias) ----------------
const donutChart = (canvasId, { labels, values, colors }) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const { ctx, w, h } = ctxOf(canvas);
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) / 2 - 12;
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const ring = 17;

  let prog = 0;
  const draw = (t) => {
    prog = Math.min(1, t * 1.1);
    ctx.clearRect(0, 0, w, h);
    let a = -Math.PI / 2;
    values.forEach((v, i) => {
      const slice = (v / total) * Math.PI * 2 * prog;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a, a + slice);
      ctx.arc(cx, cy, r - ring, a + slice, a, true);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      a += slice;
    });

    if (total > 0) {
      ctx.fillStyle = cssVar('--text');
      ctx.font = '800 ' + Math.max(15, r * 0.3) + 'px JetBrains Mono, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(fmtCompact(total), cx, cy - 8);
      ctx.fillStyle = cssVar('--muted');
      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillText('total', cx, cy + 10);
      ctx.textBaseline = 'alphabetic';
    }
    if (t < 1) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  const res = () => donutChart(canvasId, { labels, values, colors });
  _charts.set(canvasId, res);
  return res;
};

// ---------------- Spline de KPI (mini area) ----------------
const sparkline = (canvasId, { values, color }) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const { ctx, w, h } = ctxOf(canvas);
  const max = Math.max(...values, 1);
  ctx.beginPath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, hexToRgba(color || cssVar('--accent'), 0.4));
  grad.addColorStop(1, hexToRgba(color || cssVar('--accent'), 0));
  ctx.fillStyle = grad;
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * (h - 4);
    i === 0 ? ctx.moveTo(x, h) : ctx.lineTo(x, y);
  });
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = color || cssVar('--accent');
  ctx.lineWidth = 2; ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * (h - 4);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  _charts.set(canvasId, () => sparkline(canvasId, { values, color }));
};

const resizeAllCharts = (redraw = false) => {
  [..._charts.entries()].forEach(([id, redrawFn]) => {
    const c = document.getElementById(id);
    if (c && c.offsetParent !== null) redrawFn();
  });
};

window.addEventListener('resize', debounce(() => resizeAllCharts(true), 200));
window.addEventListener('orientationchange', () => setTimeout(() => resizeAllCharts(true), 300));

// helpers
function rrect(ctx, x, y, w, h, [tl, tr, br, bl] = [6, 6, 6, 6]) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.arcTo(x + w, y, x + w, y + h, tr);
  ctx.arcTo(x + w, y + h, x, y + h, br);
  ctx.arcTo(x, y + h, x, y, bl);
  ctx.arcTo(x, y, x + w, y, tl);
  ctx.closePath();
}

function hexToRgba(hex, a) {
  if (!hex) return 'rgba(0,0,0,0)';
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const num = parseInt(full, 16);
  return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${a})`;
}