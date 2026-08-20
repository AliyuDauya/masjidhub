## 2026-08-20T13:45:23Z

You are Implementation Worker 1.
Your working directory is: C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\worker_impl_1
Project root directory: C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub

MANDATORY: Read the full specification in C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\ORIGINAL_REQUEST.md and C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\PROJECT.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your objective:
Restructure the login interface into 3 dedicated role-based portal sections in both global `/login` (`frontend/src/app/login/page.tsx`) and mosque portal `/mosque/[slug]/login` (`frontend/src/app/mosque/[slug]/login/page.tsx`):
1. **Section 1: Worshipper & Member Sign-In**:
   - For regular congregants accessing personal dashboards, active class/programme passes, donation history, and tax receipts.
   - Signs in via `POST /api/auth/login` with selected mosque slug.
   - Automatically directs worshippers to `/mosque/[slug]/dashboard`.
2. **Section 2: Mosque Administrator & Imam Workspace**:
   - For masjid committee members, imams, and treasurers managing Iqamah prayer schedules, publishing announcements, registering cash donations, and door check-ins.
   - Signs in via `POST /api/auth/login` with selected mosque slug.
   - Automatically directs administrators to `/mosque/[slug]/admin`.
3. **Section 3: Sovereign Platform Operator**:
   - Dedicated access portal for platform super-administrators overseeing multi-tenant mosque onboarding, tenant status (Active/Suspended), and platform-wide metrics.
   - Signs in via `POST /api/platform/auth/login` without tenant header.
   - Saves platform token `masjidhub:platform:token` and routes directly to `/platform`.

Additional Requirements:
- **Responsive UI & Aesthetic**: Maintain visual harmony with Royal Emerald Green (`#0d4734`), Warm Metallic Gold (`#c89b3c`), and clean ivory surfaces (`#fcfbfa`). Provide smooth switching between the 3 sections with clear role badges, descriptions, and placeholder hints.
- **Mosque Selection**: Destination mosque selection dropdown is integrated and reactive across mosque-specific and global routes.
- **Quick Links**: Provide quick links for new worshippers to create global accounts (`/register` or `/mosque/[slug]/register`) and for mosques to onboard new tenants (`/register` with mosque mode).
- **Authentication, Multi-Tenant Session & Security**: Ensure cookies (`mh_session`, `mh_csrf`), Bearer tokens, and CSRF protection headers work flawlessly across all 3 portals.
- **Verification**: Run `npm --prefix frontend run test:node` and `npm --prefix frontend run build` to ensure 0 errors.

Write your report to C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\worker_impl_1\handoff.md following standard format (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
Update progress in C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\worker_impl_1\progress.md.
When finished, notify me via send_message.
