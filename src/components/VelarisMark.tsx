import type { FC } from 'react';

/* Marque Velaris : sillons de vinyle et bras de lecture doré */
export const VelarisMark: FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <circle cx="16" cy="16" r="14.25" stroke="currentColor" strokeOpacity="0.9" strokeWidth="1.5" />
    <circle cx="16" cy="16" r="10" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1" />
    <path d="M16 8.5a7.5 7.5 0 0 1 7.5 7.5" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" />
    <circle cx="16" cy="16" r="3.25" fill="currentColor" />
    <path d="M24.5 4.5 19 13.5" stroke="#D6AA60" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
