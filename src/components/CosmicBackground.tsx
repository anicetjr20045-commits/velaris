import { useEffect, useRef, type FC } from 'react';

export const CosmicBackground: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Subtle, low-density stardust (heavily reduced opacity per brief)
    const particleCount = Math.min(40, Math.floor((width * height) / 35000));
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.0 + 0.3,
      baseAlpha: Math.random() * 0.18 + 0.05,
      twinkleSpeed: Math.random() * 0.015 + 0.003,
      phase: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 0.08,
      vy: -Math.random() * 0.12 - 0.02,
    }));

    let time = 0;
    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const alpha = p.baseAlpha + Math.sin(time * p.twinkleSpeed + p.phase) * (p.baseAlpha * 0.4);
        ctx.fillStyle = `rgba(220, 200, 170, ${Math.max(0.02, Math.min(0.25, alpha))})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#08080a]">
      {/* Barely-there stardust canvas with reduced opacity */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-25" />

      {/* Warm Amber / Bone Atmospheric Ambient Glows (No cold blues) */}
      <div 
        className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-10 blur-[140px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(197, 160, 89, 0.4) 0%, rgba(140, 100, 50, 0.15) 50%, transparent 75%)',
        }}
      />
      <div 
        className="absolute top-[40%] left-1/3 -translate-x-1/2 w-[600px] h-[350px] rounded-full opacity-8 blur-[130px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.25) 0%, transparent 70%)',
        }}
      />
    </div>
  );
};
