import { useState, useRef, useEffect, type FC, type MouseEvent } from 'react';
import velarisLiquidOrb from '../assets/velaris_liquid_orb.jpg';

export const LiquidSoundOrb: FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotate, setRotate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Parallax tilt calculation
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = -((y / rect.height) * 10);
    const rotateY = (x / rect.width) * 10;
    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  // Organic fluid soundwave caustics animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const renderRipples = () => {
      t += 0.015;
      const w = (canvas.width = canvas.offsetWidth);
      const h = (canvas.height = canvas.offsetHeight);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(w, h) * 0.44;

      // Draw subtle precision concentric acoustic waves
      for (let i = 0; i < 2; i++) {
        const ringT = t + i * 2.2;
        const progress = (ringT % 4) / 4;
        const r = maxR * (0.68 + progress * 0.4);
        const alpha = Math.max(0, (1 - progress) * 0.22);

        ctx.save();
        ctx.beginPath();
        for (let angle = 0; angle < Math.PI * 2; angle += 0.06) {
          const wave = Math.sin(angle * 4 + t * 1.5) * 3 + Math.cos(angle * 2 - t) * 2;
          const curR = r + wave;
          const px = cx + Math.cos(angle) * curR;
          const py = cy + Math.sin(angle) * curR;
          if (angle === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(renderRipples);
    };

    renderRipples();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="relative pt-8 sm:pt-14 flex items-center justify-center select-none">
      {/* Background Soft Atmospheric Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[380px] sm:w-[540px] h-[380px] sm:h-[540px] rounded-full bg-white/[0.03] blur-[120px]" />
      </div>

      {/* 3D Interactive Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        className="relative z-10 w-full max-w-sm sm:max-w-xl aspect-[16/11] sm:aspect-[16/10] flex items-center justify-center cursor-default transition-transform duration-300 ease-out"
        style={{ perspective: '1400px' }}
      >
        {/* Main Acoustic Sphere Display */}
        <div
          className="relative w-full h-full rounded-2xl overflow-hidden border border-white/[0.08] bg-[#050608] shadow-[0_30px_80px_rgba(0,0,0,0.9)] transition-all duration-300 ease-out"
          style={{
            transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale(${isHovered ? 1.015 : 1})`,
            transformStyle: 'preserve-3d',
          }}
        >
          <img
            src={velarisLiquidOrb}
            alt="Velaris Acoustic Sound Sphere"
            className="w-full h-full object-cover rounded-2xl transition-transform duration-700 ease-out"
            style={{
              transform: isHovered ? 'scale(1.04)' : 'scale(1)',
            }}
          />

          {/* Fluid Sound Caustic Overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen"
          />

          {/* Deep Cinematic Matte Vignettes */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-[#050608] via-transparent to-[#050608]/20 opacity-90 pointer-events-none" />
          <div className="absolute inset-0 rounded-2xl border border-white/[0.06] pointer-events-none" />
        </div>

        {/* LEFT PRECISION READOUT PLAQUE */}
        <div
          className="absolute -left-2 sm:left-4 -bottom-4 sm:bottom-6 z-30 rounded-xl border border-white/[0.1] bg-[#050608]/90 backdrop-blur-2xl p-4 text-left shadow-[0_20px_50px_rgba(0,0,0,0.8)] space-y-1.5 w-44 sm:w-56"
          style={{
            transform: `translateZ(25px) rotateX(${rotate.x * 0.4}deg) rotateY(${rotate.y * 0.4}deg)`,
          }}
        >
          <div className="text-[10px] text-neutral-400 font-medium tracking-wider uppercase">
            01 / Cadence studio
          </div>

          <div className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">
            18 min
          </div>

          <p className="text-[11px] text-neutral-400 leading-snug">
            De la note vocale WhatsApp au master audio final.
          </p>
        </div>

        {/* RIGHT PRECISION READOUT PLAQUE */}
        <div
          className="absolute -right-2 sm:right-4 -bottom-4 sm:bottom-6 z-30 rounded-xl border border-white/[0.1] bg-[#050608]/90 backdrop-blur-2xl p-4 text-left shadow-[0_20px_50px_rgba(0,0,0,0.8)] space-y-1.5 w-44 sm:w-56"
          style={{
            transform: `translateZ(25px) rotateX(${rotate.x * 0.4}deg) rotateY(${rotate.y * 0.4}deg)`,
          }}
        >
          <div className="text-[10px] text-neutral-400 font-medium tracking-wider uppercase">
            02 / Marge brute
          </div>

          <div className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">
            92 %
          </div>

          <p className="text-[11px] text-neutral-400 leading-snug">
            Encaissement direct sans intermédiaire sur Wave et OM.
          </p>
        </div>
      </div>
    </div>
  );
};
