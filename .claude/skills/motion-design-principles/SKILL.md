---
name: motion-design-principles
description: Master UI motion design principles for high-end web applications, landing pages, and interactive experiences. Covers spatial choreography, cubic-bezier timing curves, fluid physics, micro-interactions, canvas/WebGL shaders, and framer-motion tokens. Use whenever designing, animating, or reviewing UI transitions, interactive elements, or cinematic hero moments.
---

# UI Motion Design Principles & Interactive Craft

Engineered for luxury, high-craft digital products, financial consoles, and creative tech studios (Linear, Stripe, Apple, Liquid Brokers style). Replaces generic CSS bounces and AI-template hover jumps with deliberate, physics-grounded choreography.

---

## 1. Core Kinetic Rules

### The 3 Laws of High-Craft UI Motion:
1. **Never Animate For Decoration Alone**: Every motion must explain spatial relationships (where something came from, where it went), state transitions (idle → processing → resolved), or hierarchy.
2. **Asymmetric In/Out Easing**:
   - **Enter / Reveal**: Snappy start, long deceleration tail (`cubic-bezier(0.16, 1, 0.3, 1)` or `ease-out`). Duration: 240ms – 400ms.
   - **Exit / Dismiss**: Fast acceleration off-screen without bounce (`cubic-bezier(0.7, 0, 0.84, 0)` or `ease-in`). Duration: 150ms – 220ms.
3. **Choreographed Staggering**: When multiple elements appear (cards, list rows, badges), stagger their entrance by **25ms to 50ms**, never more than 300ms total sequence. Group elements logically so the page resolves instantly.

---

## 2. Timing & Easing Curves Reference

| Motion Type | Duration | Cubic Bézier Curve | Recommended Use |
| :--- | :--- | :--- | :--- |
| **Micro-interaction** | 120ms – 160ms | `cubic-bezier(0.2, 0, 0, 1)` | Button press, toggle switch, tab indicator |
| **Plaque / Card Reveal** | 280ms – 360ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Glassmorphic floating card, modal opening |
| **Parallax / Tilt** | Continuous (lerp 0.08) | Spring damping: 30, stiffness: 200 | 3D orb tilt, cursor spotlight, floating badges |
| **Fluid Ambient** | 6s – 12s infinite | `easeInOutSine` or sin/cos math | Audio acoustic ripple, fluid canvas wave |

---

## 3. The Anti-Slop Motion Filter (What to Ban)

❌ **NEVER USE:**
- Spring bounces with overshoot on menus, dropdowns, or text headings (feels like a 2012 cartoon).
- Constant pulsing or spinning badges unless indicating an active processing state.
- Full-page sliding carousel banners with big arrows.
- Giant decorative 3D shapes that block content or kill CPU/GPU performance.
- Emojis that bounce or shake on hover.

✅ **ALWAYS PREFER:**
- **Optical Smoothness**: Animate `transform` (scale, translate3d) and `opacity` only. Never animate `width`, `height`, `top`, `left`, or `margin` (triggers browser layout reflow).
- **Subtle Parallax**: Depth layers with 15px–25px Z-depth translation and smooth pointer interpolation.
- **Precision Audio Waves**: Dynamic Canvas or WebGL visualizer reacting cleanly to audio frequency data.
- **Glassmorphic Hover Reflection**: Soft white specular highlight (`linear-gradient(135deg, rgba(255,255,255,0.06), transparent)`) shifting on pointer coordinate.

---

## 4. Implementation Guidelines in React & Tailwind

### Tailwind CSS Custom Easing Helpers:
```css
/* Smooth luxury easing */
.ease-luxury {
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}
.ease-press {
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}
```

### Canvas Fluid Acoustic Wave Pattern (60 FPS Performance):
- Keep canvas resolution matched to CSS pixels via `canvas.width = canvas.offsetWidth`.
- Use a single `requestAnimationFrame` loop with time accumulator `t += 0.015`.
- Combine multiple harmonic sines (`sin(angle * 4 + t) * 3 + cos(...)`) to simulate realistic fluid resonance without heavy shaders.

---

## 5. Review Checklist
Before shipping any motion or interactive component:
1. Does it run at a clean 60/120 FPS on mobile and low-power devices?
2. Does it respect `prefers-reduced-motion: reduce`?
3. Does it feel crisp, professional, and serious, rather than juvenile or gimmicky?
4. Does it guide the eye directly to the value proposition or action CTA?
