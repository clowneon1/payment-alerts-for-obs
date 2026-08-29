---
name: Core Stream Platform
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1b1b1d'
  surface-container: '#201f21'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#cdc2d8'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#313032'
  outline: '#968da1'
  outline-variant: '#4b4455'
  surface-tint: '#d5baff'
  primary: '#d5baff'
  on-primary: '#42008a'
  primary-container: '#9146ff'
  on-primary-container: '#fffcff'
  inverse-primary: '#7a26e7'
  secondary: '#e6feff'
  on-secondary: '#003739'
  secondary-container: '#00f4fe'
  on-secondary-container: '#006c71'
  tertiary: '#ffb4a8'
  on-tertiary: '#680100'
  tertiary-container: '#ea0400'
  on-tertiary-container: '#fffbff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ecdcff'
  primary-fixed-dim: '#d5baff'
  on-primary-fixed: '#270057'
  on-primary-fixed-variant: '#5e00c1'
  secondary-fixed: '#63f7ff'
  secondary-fixed-dim: '#00dce5'
  on-secondary-fixed: '#002021'
  on-secondary-fixed-variant: '#004f53'
  tertiary-fixed: '#ffdad4'
  tertiary-fixed-dim: '#ffb4a8'
  on-tertiary-fixed: '#410000'
  on-tertiary-fixed-variant: '#930200'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
  surface-alt: '#18181b'
  surface-raised: '#1f1f23'
  on-surface-low: '#adadb8'
  live-red: '#EB0400'
  success-green: '#00F593'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 1rem
  margin-mobile: 1rem
  margin-desktop: 2rem
  sidebar-width: 240px
  chat-width: 340px
---

## Brand & Style
The design system focuses on an immersive, "always-on" platform identity inspired by modern streaming culture. The personality is high-energy yet professional, prioritizing the content (the stream) while providing a robust, technical framework for interaction. It targets creators, gamers, and viewers who expect high information density and instant responsiveness.

The style is **Corporate / Modern** with a lean towards **Minimalism**. It eschews excessive decorative elements in favor of sharp, functional hierarchy. By utilizing deep-space neutrals and a vibrant signature purple, the interface creates a "dark mode by default" environment that reduces eye strain and makes live content and status indicators pop with high-contrast clarity.

## Colors
The palette is centered around "Twitch Purple," supported by a grayscale range designed for maximum UI legibility.

- **Primary (#9146FF):** The brand's signature. Used for primary actions, verified badges, and active navigation states.
- **Secondary (#00F5FF):** A high-energy cyan used for accents, online status, and highlighting new features.
- **Tertiary (#EB0400):** Reserved specifically for "LIVE" indicators and critical alerts to ensure immediate user recognition.
- **Neutrals:** The background starts at `#0e0e10` (Level 0). Secondary surfaces like sidebars or card containers use `#18181b` (Level 1). Interactive states or raised elements use `#1f1f23` (Level 2).
- **Typography:** Text is primarily High-Contrast White (#FFFFFF) for body and headlines, with Medium-Contrast Grey (#adadb8) used for secondary metadata and labels.

## Typography
This design system utilizes **Geist** exclusively to maintain a clean, technical, and unified aesthetic across all platform layers. The typeface's geometric precision supports the high-density requirements of chat logs and dashboard metrics.

- **Headlines:** Use heavy weights (700+) to establish clear landmarks within the UI.
- **Body:** Standard body text is kept at 14px for optimal density in sidebars and chat.
- **Labels:** Use uppercase for system labels sparingly; generally, semi-bold sentence case is preferred for readability in dense environments.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. Navigation and interaction sidebars (Chat, Following List) occupy fixed widths to ensure a consistent toolset, while the central content area (The Stream/Dashboard) fluidly scales to fill the remaining viewport.

- **Grid:** A 12-column grid is used for dashboard layouts with a 16px (1rem) gutter.
- **Breakpoints:**
  - **Mobile (<768px):** Single column. Sidebars are hidden behind a hamburger menu or bottom navigation.
  - **Tablet (768px - 1199px):** Sidebar is collapsed to icons-only. Chat remains visible if orientation allows.
  - **Desktop (>1200px):** Full-width layout with persistent left navigation and right-hand chat.
- **Spacing Rhythm:** All margins and paddings must be multiples of 4px.

## Elevation & Depth
The design system avoids soft ambient shadows to maintain a "flat" and fast performance feel. Depth is communicated through **Tonal Layers** and **Low-Contrast Outlines**.

- **Level 0:** Base background (`#0e0e10`).
- **Level 1:** Navigation bars, sidebars, and chat containers (`#18181b`).
- **Level 2:** Cards, hover states, and dropdown menus (`#1f1f23`).
- **Outlines:** Instead of shadows, use 1px solid borders (`#26262c`) to separate adjacent containers of the same color.
- **Active State:** Use a 2px left-border or bottom-border in Primary Purple to indicate the currently active navigation item or tab.

## Shapes
The shape language is **Soft** but leans towards precision. Sharp edges are used for major structural containers to maximize screen real estate, while interactive components receive subtle rounding to feel approachable.

- **Buttons & Inputs:** `0.25rem` (4px) corner radius.
- **Cards & Modals:** `0.5rem` (8px) corner radius.
- **Avatars:** Strictly circular (full-pill) to distinguish people/streamers from content thumbnails.
- **Live Badges:** `0.125rem` (2px) radius to maintain a technical, "tag-like" appearance.

## Components
- **Buttons:** 
  - **Primary:** Solid Purple (`#9146FF`) with White text. No gradients.
  - **Secondary:** Soft Grey (`#2f2f35`) background with White text for low-priority actions.
- **Input Fields:** Dark grey background (`#18181b`) with a 2px border that turns Primary Purple on focus. High-contrast white text for input.
- **Chips & Badges:** Used for category tags. Backgrounds are `#26262c` with a hover state that lightens the surface. "LIVE" badges use Tertiary Red with white bold text.
- **Cards:** Content thumbnails should have a 16:9 aspect ratio. Hovering on a card should reveal a "Primary Purple" border or accent to indicate selectability.
- **Lists:** Channel lists use a 48px avatar, 14px bold title, and 12px secondary text for the game/category. A right-aligned red dot or viewer count indicates live status.
- **Scrollbars:** Custom slim scrollbars (`4px` width) in `#3a3a3d` to prevent visual clutter in long chat feeds.