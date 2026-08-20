# Original User Request

## Initial Request — 2026-08-20T13:35:55Z

MasjidHub Login Interface Restructuring into 3 Dedicated Role-Based Portal Sections (Member/Worshipper, Mosque Admin/Imam, Platform Operator) and Continued Platform Development.

Working directory: C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub
Integrity mode: development

## Requirements

### R1. 3 Dedicated Role-Based Login Sections
Restructure both `/login` (global platform login) and `/mosque/[slug]/login` (mosque portal login) into 3 distinct, intuitive authentication sections/tabs:
1. **Section 1: Worshipper & Member Sign-In**:
   - For regular congregants accessing personal dashboards, active class/programme passes, donation history, and charitable tax receipts.
   - Automatically directs worshippers to `/mosque/[slug]/dashboard`.
2. **Section 2: Mosque Administrator & Imam Workspace**:
   - For masjid committee members, imams, and treasurers managing Iqamah prayer schedules, publishing announcements, registering cash donations, and door check-ins.
   - Automatically directs administrators to `/mosque/[slug]/admin`.
3. **Section 3: Sovereign Platform Operator**:
   - Dedicated access portal for platform super-administrators overseeing multi-tenant mosque onboarding, tenant status (Active/Suspended), and platform-wide metrics.
   - Automatically directs operators to `/platform`.

### R2. Responsive UI & Royal Emerald/Gold Aesthetic
- Maintain visual harmony with Royal Emerald Green (`#0d4734`), Warm Metallic Gold (`#c89b3c`), and clean ivory surfaces.
- Provide smooth switching or distinct cards between the 3 sections with clear role badges, descriptions, and relevant placeholder hints.
- Include quick links for new worshippers to create global accounts and for mosques to onboard new tenants.

### R3. Authentication, Multi-Tenant Session & Security Preservation
- Ensure cookies (`mh_session`, `mh_csrf`), Bearer tokens, and CSRF protection headers work flawlessly across all 3 portals.
- Preserve 1-click multi-mosque switching and auto-membership linking upon sign-in.

## Verification Resources
- Backend automated test suite: `npm --prefix backend run test:node`
- Frontend automated test suite: `npm --prefix frontend run test:node`
- Production Next.js build verification: `npm --prefix frontend run build`

## Acceptance Criteria

### Role-Based Portals & Usability
- [ ] Login interface presents 3 distinct, clearly labeled sections for Members, Mosque Admins, and Platform Operators.
- [ ] Signing in under Section 1 routes members directly to `/mosque/[slug]/dashboard`.
- [ ] Signing in under Section 2 routes administrators to `/mosque/[slug]/admin`.
- [ ] Section 3 provides direct operator login / routing to `/platform`.
- [ ] Destination mosque selection dropdown is integrated and reactive across mosque-specific and global routes.

### Automated Quality & Build
- [ ] All backend test suites pass with 0 errors.
- [ ] All frontend test suites pass with 0 errors.
- [ ] Next.js production build succeeds with 0 linting, type, or compilation errors.
