// ============================================================
// C2 Finance - Fundo animado sutil (aurora em canvas)
// Substitui o antigo "círculo" decorativo por um movimento de
// luz discreto e profissional, sempre nas cores do tema ativo.
// ============================================================

(() => {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, t = 0, raf = null;
  let colors = ['#1e1e30', '#282a36', '#4b2d8f', '#bd93f9', '#ff79c6'];

  // índices: 2 = --bg-c, 3 = --accent, 4 = --accent-2
  const blobs = [
    { x: .18, y: .20, r: .48, c: 2, sx: .009, sy: .006, ph: 0 },
    { x: .84, y: .32, r: .40, c: 3, sx: .007, sy: .009, ph: 2.1 },
    { x: .46, y: .88, r: .52, c: 4, sx: .006, sy: .008, ph: 4.0 }
  ];

  const hexA = (hex, a) => {
    let h = String(hex || '').replace('#', '');
    if (!h) return `rgba(0,0,0,0)`;
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n)) return `rgba(0,0,0,0)`;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    colors = ['--bg-a', '--bg-b', '--bg-c', '--accent', '--accent-2']
      .map(v => (cs.getPropertyValue(v) || '').trim())
      .map(v => v || '#000000');
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const step = (now) => {
    t = now / 1000;
    ctx.clearRect(0, 0, W, H);
    for (const b of blobs) {
      const cx = W * (b.x + Math.sin(t * b.sx + b.ph) * 0.07);
      const cy = H * (b.y + Math.cos(t * b.sy + b.ph) * 0.07);
      const r = Math.max(W, H) * b.r;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, hexA(colors[b.c], 0.15));
      g.addColorStop(0.55, hexA(colors[b.c], 0.06));
      g.addColorStop(1, hexA(colors[b.c], 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    raf = requestAnimationFrame(step);
  };

  const start = () => { if (!raf) raf = requestAnimationFrame(step); };
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = null; } };

  readColors();
  resize();
  start();

  new MutationObserver(() => readColors())
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
})();
