import { useEffect, useRef, type FC } from 'react';

export const CosmicBackground: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Resize handler
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Micro stardust particles like in the Liquid Brokers video
    const particleCount = Math.min(80, Math.floor((width * height) / 18000));
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.4 + 0.4,
      baseAlpha: Math.random() * 0.5 + 0.15,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      phase: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -Math.random() * 0.2 - 0.05, // slow upward drift
    }));

    let time = 0;
    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      // Draw each subtle celestial stardust particle
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around boundaries
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const alpha = p.baseAlpha + Math.sin(time * p.twinkleSpeed + p.phase) * (p.baseAlpha * 0.6);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.05, Math.min(0.9, alpha))})`;
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
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Deep Obsidian Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />

      {/* Atmospheric Radial Gradients (Subtle Nebula Glow) */}
      <div 
        className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[550px] rounded-full opacity-20 blur-[130px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(197, 160, 89, 0.25) 0%, rgba(59, 130, 246, 0.15) 50%, transparent 75%)',
        }}
      />
      <div 
        className="absolute top-[35%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-15 blur-[120px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, rgba(197, 160, 89, 0.1) 60%, transparent 80%)',
        }}
      />
    </div>
  );
};
