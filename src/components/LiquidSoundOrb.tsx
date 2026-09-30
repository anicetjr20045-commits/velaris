import { useState, useRef, useEffect, type FC, type MouseEvent } from 'react';
import velarisLiquidOrbWebp from '../assets/velaris_liquid_orb.webp';

export const LiquidSoundOrb: FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotate, setRotate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = -((y / rect.height) * 8);
    const rotateY = (x / rect.width) * 8;
    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  // Concentric wave caustics (disabled if reduced motion)
  useEffect(() => {
    if (prefersReducedMotion) return;
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

      for (let i = 0; i < 2; i++) {
        const ringT = t + i * 2.2;
        const progress = (ringT % 4) / 4;
        const r = maxR * (0.7 + progress * 0.35);
        const alpha = Math.max(0, (1 - progress) * 0.18);

        ctx.save();
        ctx.beginPath();
        for (let angle = 0; angle < Math.PI * 2; angle += 0.08) {
          const wave = Math.sin(angle * 4 + t * 1.2) * 2.5 + Math.cos(angle * 2 - t) * 2;
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
        ctx.strokeStyle = `rgba(212, 175, 55, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(renderRipples);
    };

    renderRipples();
    return () => cancelAnimationFrame(animId);
  }, [prefersReducedMotion]);

  return (
    <div className="relative pt-6 sm:pt-10 flex flex-col items-center justify-center select-none w-full">
      {/* Background Subtle Warm Radial Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[320px] sm:w-[460px] h-[320px] sm:h-[460px] rounded-full bg-[#c5a059]/[0.04] blur-[100px]" />
      </div>

      {/* 3D Visual Hero Piece (Unobstructed, cards moved OUT per Point 7) */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        className="relative z-10 w-full max-w-sm sm:max-w-xl aspect-[16/10] flex items-center justify-center cursor-default transition-transform duration-300 ease-out"
        style={{ perspective: '1400px' }}
      >
        <div
          className="relative w-full h-full rounded-2xl overflow-hidden border border-white/[0.1] bg-[#08080a] shadow-[0_20px_60px_rgba(0,0,0,0.85)] transition-all duration-300 ease-out"
          style={{
            transform: prefersReducedMotion ? 'none' : `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale(${isHovered ? 1.01 : 1})`,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Compressed WebP image with lazy loading (Point 11) */}
          <img
            src={velarisLiquidOrbWebp}
            alt="Velaris Sphere Musicale"
            loading="lazy"
            decoding="async"
            width={640}
            height={400}
            className="w-full h-full object-cover rounded-2xl transition-transform duration-700 ease-out"
            style={{
              transform: prefersReducedMotion ? 'none' : (isHovered ? 'scale(1.03)' : 'scale(1)'),
            }}
          />

          {/* Fluid Sound Caustic Overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen"
          />

          {/* Warm Dark Vignettes */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-[#08080a] via-transparent to-[#08080a]/30 opacity-80 pointer-events-none" />
        </div>
      </div>

      {/* SPECIFICATIONS CARDS MOVED CLEANLY BELOW THE ORBE (Point 7 & Point 9) */}
      <div className="relative z-20 w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-left">
        {/* Left card: Cadence */}
        <div className="rounded-xl border border-white/[0.08] bg-[#0c0d11]/80 backdrop-blur-md p-4 space-y-1">
          <div className="text-xs uppercase font-medium tracking-wider text-[#c5a059]">
            Livraison studio
          </div>
          <div className="font-heading text-xl font-bold text-white tracking-tight">
            18 minutes
          </div>
          <p className="text-sm text-zinc-300 leading-snug">
            De la note vocale WhatsApp au master audio finalisé.
          </p>
        </div>

        {/* Right card: Marge nette (Unified term per Point 9) */}
        <div className="rounded-xl border border-white/[0.08] bg-[#0c0d11]/80 backdrop-blur-md p-4 space-y-1">
          <div className="text-xs uppercase font-medium tracking-wider text-[#c5a059]">
            Marge nette
          </div>
          <div className="font-heading text-xl font-bold text-white tracking-tight">
            85 à 95 %
          </div>
          <p className="text-sm text-zinc-300 leading-snug">
            Encaissement direct sur vos comptes Wave & Orange Money.
          </p>
        </div>
      </div>
    </div>
  );
};
