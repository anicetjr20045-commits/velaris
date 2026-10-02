import { useEffect, useId, useRef, type CSSProperties, type FC } from 'react';
import { SONAR_STATE_LABEL, type SonarState } from './sonarState';


interface SonarMascotProps {
  state: SonarState;
  size?: number;
  /* Incrémenté à chaque frappe : la voix de Sonar « réagit » */
  pulse?: number;
  /* Les yeux suivent le pointeur (désactivé si mouvement réduit) */
  trackPointer?: boolean;
  className?: string;
}

/* Hauteurs de la barre-voix, symétriques autour du centre */
const VOICE_BARS = [6, 10, 15, 20, 15, 10, 6];

/* Satellites : WhatsApp, commandes, paroles */
const SATELLITES = [
  { cx: 188, cy: 100, fill: '#34D399' },
  { cx: 56, cy: 176.2, fill: '#D6AA60' },
  { cx: 56, cy: 23.8, fill: '#F5F5F4' },
];

/**
 * Sonar — compagnon du Copilot Velaris.
 * Un disque d'obsidienne cerclé d'or, deux yeux et une voix en égaliseur.
 * Les états (écoute, recherche, rédaction) sont pilotés en CSS via data-state.
 */
export const SonarMascot: FC<SonarMascotProps> = ({
  state,
  size = 160,
  pulse = 0,
  trackPointer = false,
  className = '',
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const gazeRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!trackPointer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;

    const step = () => {
      x += (targetX - x) * 0.12;
      y += (targetY - y) * 0.12;
      gazeRef.current?.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      raf = Math.abs(targetX - x) > 0.02 || Math.abs(targetY - y) > 0.02 ? requestAnimationFrame(step) : 0;
    };

    const onMove = (e: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, dist / 420);
      targetX = (dx / dist) * 6 * reach;
      targetY = (dy / dist) * 4.5 * reach;
      if (!raf) raf = requestAnimationFrame(step);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [trackPointer]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      data-state={state}
      role="img"
      aria-label={`Sonar, ${SONAR_STATE_LABEL[state].toLowerCase()}`}
      className={`vx-sonar overflow-visible ${className}`}
    >
      <defs>
        <radialGradient id={`${uid}-body`} cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#262833" />
          <stop offset="55%" stopColor="#0E1015" />
          <stop offset="100%" stopColor="#050608" />
        </radialGradient>
        <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F3DDAE" />
          <stop offset="45%" stopColor="#D6AA60" />
          <stop offset="100%" stopColor="#5E4419" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0%" stopColor="#D6AA60" stopOpacity="0.32" />
          <stop offset="60%" stopColor="#D6AA60" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#D6AA60" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-sweep`} gradientUnits="userSpaceOnUse" x1="150" y1="112" x2="146" y2="40">
          <stop offset="0%" stopColor="#D6AA60" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#D6AA60" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Halo respirant */}
      <circle className="vx-sonar-glow" cx="100" cy="100" r="82" fill={`url(#${uid}-glow)`} />

      {/* Ondes sonar (état écoute) */}
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          className="vx-sonar-ripple"
          style={{ '--i': i } as CSSProperties}
          cx="100"
          cy="100"
          r="62"
          fill="none"
          stroke="#D6AA60"
          strokeWidth="1"
        />
      ))}

      {/* Balayage radar (état recherche) */}
      <g className="vx-sonar-sweep">
        <path d="M100 100 L188 100 A88 88 0 0 0 167.4 43.4 Z" fill={`url(#${uid}-sweep)`} />
        <line x1="100" y1="100" x2="188" y2="100" stroke="#D6AA60" strokeOpacity="0.55" strokeWidth="1" />
      </g>

      {/* Orbite et satellites de données */}
      <g className="vx-sonar-orbit">
        <circle cx="100" cy="100" r="88" fill="none" stroke="#FFFFFF" strokeOpacity="0.1" strokeDasharray="1 5" />
        {SATELLITES.map((s) => (
          <circle key={s.fill} cx={s.cx} cy={s.cy} r="2.6" fill={s.fill} />
        ))}
      </g>

      {/* Corps */}
      <circle cx="100" cy="100" r="60" fill={`url(#${uid}-body)`} stroke={`url(#${uid}-rim)`} strokeWidth="1.5" />
      <circle cx="100" cy="100" r="52" fill="none" stroke="#FFFFFF" strokeOpacity="0.05" />
      <ellipse cx="80" cy="68" rx="24" ry="9" fill="#FFFFFF" opacity="0.05" transform="rotate(-24 80 68)" />

      {/* Visage */}
      <g ref={gazeRef}>
        <g className="vx-sonar-face">
          <rect className="vx-sonar-eye" x="80" y="82" width="9" height="17" rx="4.5" fill="#F4E7CC" />
          <rect className="vx-sonar-eye" x="111" y="82" width="9" height="17" rx="4.5" fill="#F4E7CC" />
          <g key={pulse} className={pulse > 0 ? 'vx-sonar-kick' : undefined}>
            {VOICE_BARS.map((h, i) => (
              <rect
                key={i}
                className="vx-sonar-bar"
                style={{ '--i': i } as CSSProperties}
                x={100 + (i - 3) * 6 - 1.5}
                y={120 - h / 2}
                width="3"
                height={h}
                rx="1.5"
                fill="#D6AA60"
              />
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
};

/* Version statique miniature pour les avatars de messages */
export const SonarGlyph: FC<{ size?: number }> = ({ size = 28 }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
    <circle cx="16" cy="16" r="15" fill="#0E1015" stroke="#D6AA60" strokeOpacity="0.7" strokeWidth="1" />
    <rect x="11" y="11" width="3" height="6" rx="1.5" fill="#F4E7CC" />
    <rect x="18" y="11" width="3" height="6" rx="1.5" fill="#F4E7CC" />
    <path d="M11.5 21.5h1M14 20.5v2M16 20v3M18 20.5v2M20.5 21.5h-1" stroke="#D6AA60" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);
