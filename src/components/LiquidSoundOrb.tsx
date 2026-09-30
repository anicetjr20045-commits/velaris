import { useState, useRef, useEffect, type FC, type MouseEvent } from 'react';
import velarisLiquidOrb from '../assets/velaris_liquid_orb.jpg';

export const LiquidSoundOrb: FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotate, setRotate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // 3D Parallax Tilt Effect
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    // Smooth angle bounds
    const rotateX = -((y / rect.height) * 14);
    const rotateY = (x / rect.width) * 14;
    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  // Fluid sound wave caustics animation on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const renderRipples = () => {
      t += 0.02;
      const w = (canvas.width = canvas.offsetWidth);
      const h = (canvas.height = canvas.offsetHeight);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(w, h) * 0.46;

      // Draw 3 organic soundwave caustic rings
      for (let i = 0; i < 3; i++) {
        const ringT = t + i * 1.8;
        const progress = (ringT % 4) / 4;
        const r = maxR * (0.65 + progress * 0.45);
        const alpha = Math.max(0, (1 - progress) * 0.35);

        ctx.save();
        ctx.beginPath();
        for (let angle = 0; angle < Math.PI * 2; angle += 0.08) {
          const wave = Math.sin(angle * 5 + t * 2) * 4 + Math.cos(angle * 3 - t) * 3;
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
        ctx.strokeStyle = i % 2 === 0 
          ? `rgba(197, 160, 89, ${alpha})` 
          : `rgba(147, 197, 253, ${alpha * 0.8})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(renderRipples);
    };

    renderRipples();

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="relative pt-6 sm:pt-10 flex items-center justify-center select-none">
      {/* Background Soft Chromatic Bloom */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[320px] sm:w-[480px] h-[320px] sm:h-[480px] rounded-full bg-gradient-to-tr from-[#c5a059]/15 via-[#3b82f6]/10 to-transparent blur-[110px] animate-pulse-subtle" />
      </div>

      {/* 3D Interactive Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        className="relative z-10 w-full max-w-sm sm:max-w-xl aspect-[16/11] sm:aspect-[16/10] flex items-center justify-center cursor-pointer transition-transform duration-300 ease-out"
        style={{
          perspective: '1200px',
        }}
      >
        <div
          className="relative w-full h-full rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-white/[0.08] bg-[#07080a] transition-all duration-300 ease-out"
          style={{
            transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale3d(${isHovered ? 1.02 : 1}, ${isHovered ? 1.02 : 1}, 1)`,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Main Chromatic Liquid Sphere Texture */}
          <img
            src={velarisLiquidOrb}
            alt="Velaris Liquid Sound Sphere"
            className="w-full h-full object-cover rounded-3xl transition-transform duration-700 ease-out"
            style={{
              transform: isHovered ? 'scale(1.06)' : 'scale(1)',
            }}
          />

          {/* Fluid Sound Ripple Overlay Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen"
          />

          {/* Vignette Gradients for Cinematic Deep Space Integration */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-[#07080a] via-transparent to-[#07080a]/30 opacity-80 pointer-events-none" />
          <div className="absolute inset-0 rounded-3xl bg-radial from-transparent via-transparent to-[#07080a]/90 pointer-events-none" />
        </div>

        {/* LEFT FLOATING GLASSMORPHIC BADGE (Identical to Liquid Brokers Reference) */}
        <div
          className="absolute -left-2 sm:left-4 -bottom-4 sm:bottom-8 z-30 rounded-2xl border border-white/[0.12] bg-[#07080a]/75 backdrop-blur-2xl p-3.5 sm:p-4 text-left shadow-[0_20px_50px_rgba(0,0,0,0.65)] space-y-1.5 w-40 sm:w-56 transition-transform duration-300 ease-out hover:scale-105"
          style={{
            transform: `translateZ(30px) rotateX(${rotate.x * 0.5}deg) rotateY(${rotate.y * 0.5}deg)`,
          }}
        >
          <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-white/50 font-semibold tracking-wider uppercase">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Cadence Studio</span>
            </span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/[0.08] text-white text-[10px]">
              ↗
            </span>
          </div>

          <div className="text-xl sm:text-3xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            18 Min
          </div>

          <p className="text-[9px] sm:text-[10px] text-emerald-400 font-medium leading-tight">
            Brief vocal ➔ Chanson HD
          </p>
        </div>

        {/* RIGHT FLOATING GLASSMORPHIC BADGE (Identical to Liquid Brokers Reference) */}
        <div
          className="absolute -right-2 sm:right-4 -bottom-4 sm:bottom-8 z-30 rounded-2xl border border-white/[0.12] bg-[#07080a]/75 backdrop-blur-2xl p-3.5 sm:p-4 text-left shadow-[0_20px_50px_rgba(0,0,0,0.65)] space-y-2 w-40 sm:w-56 transition-transform duration-300 ease-out hover:scale-105"
          style={{
            transform: `translateZ(30px) rotateX(${rotate.x * 0.5}deg) rotateY(${rotate.y * 0.5}deg)`,
          }}
        >
          <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-white/50 font-semibold tracking-wider uppercase">
            <span>Marge Directe</span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/[0.08] text-white text-[10px]">
              ↗
            </span>
          </div>

          <div className="text-xl sm:text-3xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            92%
          </div>

          <div className="w-full bg-white/[0.1] h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-white h-full rounded-full w-[92%] shadow-[0_0_12px_rgba(255,255,255,0.8)]"
            />
          </div>

          <p className="text-[9px] sm:text-[10px] text-white/50 leading-tight">
            100% direct Wave & OM
          </p>
        </div>
      </div>
    </div>
  );
};
