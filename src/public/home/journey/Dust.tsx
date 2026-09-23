import { useEffect, useRef } from 'react';

/**
 * Dust drifting through the light — a small canvas over the stage. ~60 soft
 * motes, warm, slowly rising and swaying. It only animates while the stage is on
 * screen, and not at all under reduced motion (the parent doesn't mount it).
 * The journey timeline fades the canvas in and out per chapter.
 */
export function Dust() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const motes = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.8,
      a: 0.15 + Math.random() * 0.45,
      vy: 0.004 + Math.random() * 0.012,
      sway: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    let visible = true;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.vy * dt;
        m.sway += dt * 0.6;
        if (m.y < -0.02) {
          m.y = 1.02;
          m.x = Math.random();
        }
        const x = (m.x + Math.sin(m.sway) * 0.006) * w;
        const y = m.y * h;
        const g = ctx.createRadialGradient(x, y, 0, x, y, m.r * 3);
        g.addColorStop(0, `rgba(244, 222, 176, ${m.a})`);
        g.addColorStop(1, 'rgba(244, 222, 176, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, m.r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (visible) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(canvas);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} data-j="dust" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}
