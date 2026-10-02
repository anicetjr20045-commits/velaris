---
name: craft-ui-engineering
description: Strict guidelines and design tokens for high-craft, luxury dark-mode web interfaces, studios, and SaaS platforms. Eliminates AI slop, bans emoji spam, enforces architectural typography, precision glassmorphism, and sober editorial layouts inspired by Linear, Apple, Stripe, and Liquid Brokers.
---

# Craft UI Engineering & Anti-Slop Design System

A rigorous design and implementation standard designed to guarantee that interfaces feel **serious, authoritative, luxurious, and technologically refined**.

---

## 1. The Zero-Tolerance Anti-Slop Directives

### 🚫 1. Absolute Ban on Emojis in Interfaces
- **NEVER** use emojis (`✨`, `🚀`, `🔥`, `💡`, `🎵`, `👋`, `💎`, `👑`, `🎯`) as bullet points, card icons, header accents, button adornments, or marketing badges.
- Emojis instantly downgrade a product to look like a high-school project or a cheap drop-shipping template.
- **Replacement**: Use crisp, monochromatic SVG icons (from `lucide-react`, sized 12px to 16px, `strokeWidth={1.5}`) or pure typography (e.g. `01`, `02`, `03` in monospace or subtle architectural dots).

### 🚫 2. Ban on Rainbow Gradients & Neon Overload
- Do not use loud multi-color gradients (purple-to-orange, cyan-to-magenta).
- Do not use glow effects exceeding `blur-md` or `opacity-15`.
- **Replacement**: Deep graphite tones (`#050608`, `#08090C`, `#0E1015`), architectural white borders (`border-white/[0.08]`), and pure white primary CTAs with subtle dark hover states.

### 🚫 3. Ban on Cliché AI Copywriting & Marketing Fluff
- Ban words like "Révolutionnaire", "Magique", "Superchargez votre quotidien", "Propulsez vos revenus vers les étoiles".
- **Replacement**: Specific, sober, quantifiable technical facts. Example: *"Master audio 24-bit livré en 18 minutes. Encaissement Wave direct à 100% sans commission intermédiaire."*

---

## 2. The Luxury Monochrome Color Token Palette

```css
/* Surface Colors */
--bg-void: #030406;         /* The deepest canvas background */
--bg-surface: #07080B;      /* Card and panel base */
--bg-elevated: #0D0F14;     /* Floating elements and toolbars */
--bg-glass: rgba(10, 12, 16, 0.75); /* Backdrop blur 24px */

/* Borders & Dividers */
--border-subtle: rgba(255, 255, 255, 0.06);
--border-medium: rgba(255, 255, 255, 0.12);
--border-strong: rgba(255, 255, 255, 0.22);

/* Typography & Foregrounds */
--text-primary: #FFFFFF;    /* Headings, primary metrics, active states */
--text-secondary: #9CA3AF;  /* Explanatory copy, field labels */
--text-muted: #6B7280;      /* Metadata, timestamps, footnote tags */
--text-mono: #E5E7EB;       /* Code, financial figures, track numbers */
```

---

## 3. Typography & Hierarchy Rules

1. **Heading Weight & Tracking**:
   - Main Titles: `font-heading font-bold tracking-tight text-white` with tight line-height (`leading-[1.05]`).
   - Section Eyebrows: `text-[10px]` or `text-[11px]`, uppercase, `tracking-widest font-medium text-neutral-400`. Never put an emoji before or after an eyebrow.
2. **Numbers & Technical Telemetry**:
   - Always display metrics, durations, and pricing in tabular numbers or monospace font (`font-mono tracking-tight`).
   - Example: `18 min`, `3 000 FCFA`, `94.8%`, `BPM 102`.
3. **Contrast Discipline**:
   - Ensure body copy is at minimum `#9CA3AF` or `#D1D5DB` on `#050608` background for pristine readability. Never use low-contrast grey on dark grey that strains the eyes.

---

## 4. Architectural Component Patterns

### A. The Precision Telemetry Card (Liquid Brokers Style)
```tsx
<div className="rounded-xl border border-white/[0.08] bg-[#07080B]/80 backdrop-blur-xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
  <div className="flex items-center justify-between">
    <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500">Cadence Studio</span>
    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
  </div>
  <div className="mt-2 text-2xl font-bold font-heading text-white">18 min</div>
  <p className="mt-1 text-xs text-neutral-400">Délai moyen de livraison par commande</p>
</div>
```

### B. The Sovereign Action Button (Pure Monochrome)
```tsx
{/* Primary CTA */}
<button className="rounded-full bg-white text-black hover:bg-neutral-200 px-7 py-3 text-xs font-semibold tracking-tight transition-all active:scale-95 shadow-[0_0_25px_rgba(255,255,255,0.12)]">
  Accéder à l'atelier
</button>

{/* Secondary Architectural CTA */}
<button className="rounded-full border border-white/15 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/30 px-6 py-3 text-xs font-medium text-neutral-300 hover:text-white transition-all">
  Voir la documentation
</button>
```

### C. The Audio / Mixing Console Control
- Minimalist hardware fader styling: hairline tracks (`h-1 bg-neutral-800`), custom white square or pill slider thumbs, digital readout badges with border-white/10.

---

## 5. Pre-Deployment Craft Audit
Before submitting or presenting any frontend work:
- [ ] Are all emojis purged from the UI?
- [ ] Are all icons sourced from Lucide SVG with consistent size and stroke width?
- [ ] Is the primary contrast ratio > 7:1 for white text on dark surface?
- [ ] Does the page avoid cartoonish colors, unnecessary badges, and cliché buzzwords?
- [ ] Are financial figures and telemetry data cleanly formatted with monospace or tabular figures?
