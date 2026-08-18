# Routes

## Route Mapping
- `/` (`frontend/src/app/page.tsx`) - Global landing page with mosque discovery search, register modal, and directory grid.
- `/platform` (`frontend/src/app/platform/page.tsx`) - Platform admin console to approve applications and manage tenant mosques.
- `/mosque/[slug]` (`frontend/src/app/mosque/[slug]/page.tsx`) - Mosque public portal displaying prayer times (iqamah), community announcements, and quick links to giving and programs.
- `/mosque/[slug]/admin` (`frontend/src/app/mosque/[slug]/admin/page.tsx`) - Mosque-level admin dashboard.
- `/mosque/[slug]/donations` (`frontend/src/app/mosque/[slug]/donations/page.tsx`) - Donations and giving page with receipt tracking.
- `/mosque/[slug]/programs` (`frontend/src/app/mosque/[slug]/programs/page.tsx`) - Community programs and seat reservation.
- `/mosque/[slug]/login` (`frontend/src/app/mosque/[slug]/login/page.tsx`) - Mosque member/admin login.
- `/mosque/[slug]/register` (`frontend/src/app/mosque/[slug]/register/page.tsx`) - Mosque member registration.
