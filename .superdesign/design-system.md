# Design System: Super Travel Luxury

## Product & Brand Context
A luxury-focused, high-contrast design system for 'Super Travel' delivering a premium editorial feel with bold geometric typography, a signature dusty rose accent, and architectural staggered grids.

## Color Palette
- **Primary Background**: `#fdf8f3` (warm luxury off-white)
- **Secondary Background**: `#f5f0eb` (soft textured off-white for services/footer)
- **Primary Text / Charcoal**: `#262626` (deep charcoal ink)
- **Primary Accent**: `#e4a4bd` (signature dusty rose)
- **Muted Text**: `rgba(38, 38, 38, 0.7)` / `#666666`
- **Subtle Borders**: `rgba(38, 38, 38, 0.08)` / `1px #e5ded7`

## Typography System
- **Font Family**: `League Spartan` for both body and headers to maintain geometric consistency.
- **Headings**: `font-weight: 700-900`, `tracking-tighter`, `line-height: 0.8`.
  - Massive Hero H1: `15vw` font-size, line-height `0.8` with one word in lowercase italics with `#e4a4bd` color.
  - Section Headings: `8xl` font size for services grid, `3xl-5xl` for section titles.
- **Utility & Metadata Labels**: `font-size: 10px`, `font-weight: 900`, `letter-spacing: 0.4em`, uppercase.

## Layout & Structural Guides
- **Grid System**: 12-column grid system with generous whitespace.
- **Navigation**: Fixed top navigation (80px height), glassmorphism `rgba(253, 248, 243, 0.8)` with `backdrop-filter: blur(12px)` and 1px border at 5% opacity. Bold uppercase 'SUPER TRAVEL' on left, center menu items in 10px uppercase tracking `0.2em`, pill-shaped CTA (#e4a4bd bg, #262626 text) on far right.
- **Hero Section**: Full viewport height. Left: Massive 15vw headline with italicized `#e4a4bd` word, 2xl body text, arrow-cta with 2px bottom border `#e4a4bd`. Right: Large card with 24px border-radius containing a grayscale-to-color image and a floating circular badge (160px diameter) in `#e4a4bd` with '01' italic text and 4s slow vertical bounce animation.
- **Services Grid**: Background `#f5f0eb`, 8xl headline, 3-column grid separated by 1px borders, 40px padding. Card background shifts from `#fdf8f3` to `#e4a4bd` on hover, 4xl icons transition from `#e4a4bd` to `#262626`.
- **Portfolio Staggered Grid**: Two-column layout where even items (right column) are offset downwards by 100px. 3:4 aspect-ratio images with 16px border-radius. On hover: centered 96px black circle with white 'View Case' text in 10px font. 10px `#e4a4bd` category label below images, 3xl title and tag metadata.
- **Footer**: Background `#f5f0eb`, 12-column split (5 cols brand/mission, 7 cols split into 3 sub-cols for nav/social/locations), 10px bold uppercase headers with `#e4a4bd` color and 8px offset underline.

## Special Components & Motion
- **Floating Concierge Badge**: 160px circle in `#e4a4bd` with `#262626` text, 3xl italic '01' and 8px uppercase tracking-widest text, `animation: bounce-slow 4s ease-in-out infinite`.
- **Reveal-Up Wrapper**: Scroll entrance animation starting with `opacity: 0; transform: translateY(40px)` transitioning to `opacity: 1; transform: translateY(0)` with `cubic-bezier(0.16, 1, 0.3, 1)` and 1s duration.
- **Grayscale-to-Color Interaction**: Images are `grayscale(100%)` by default and transition to `grayscale(0%)` with `scale(1.08)` on hover.

## Strict Rules
- MUST use `League Spartan` for all text elements.
- MUST NOT use vibrant gradients; keep colors solid and muted.
- MUST use `cubic-bezier(0.16, 1, 0.3, 1)` for transitions.
- Images MUST be grayscale by default and reveal color only on interaction.
