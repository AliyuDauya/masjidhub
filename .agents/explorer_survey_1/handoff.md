# Handoff Report: Frontend Login UI, Multi-Portal Routing & Design System Survey

**Agent**: Explorer 1 (Frontend Login UI & Routing Specialist)  
**Date**: 2026-08-20  
**Target Milestone**: Login Interface Restructuring into 3 Dedicated Role-Based Portal Sections (Member/Worshipper, Mosque Admin/Imam, Platform Operator)

---

## 1. Observation

Direct code examination and build/test executions revealed the following precise findings across the frontend and backend codebase:

### 1.1 Current Login Implementations: `/login` and `/mosque/[slug]/login`
- **Global Login Page** (`frontend/src/app/login/page.tsx`, lines 1–279):
  - **Component**: `GlobalLogin`
  - **State Hooks**:
    - `email: string` (line 17)
    - `password: string` (line 18)
    - `showPassword: boolean` (line 19)
    - `selectedMosqueSlug: string` (line 20, default `'al-noor'`)
    - `allMosques: MosqueOption[]` (line 21, loaded via `api<MosqueOption[]>(null, '/api/mosques')` on mount)
    - `errorMsg: string` (line 23)
    - `successMsg: string` (line 24)
    - `isSubmitting: boolean` (line 25)
  - **Form Validation & Submission Flow** (lines 39–74):
    - Validates `!email.trim() || !password` with `"Please enter both email and password."`
    - Submits via `api<{ token: string; membership: { role: string }; user?: { name: string } }>(targetSlug, '/api/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) })`.
    - Persists token to `localStorage` via `setToken(targetSlug, result.token)` (key: `masjidhub:${targetSlug}:token`).
    - Dynamic post-login routing (lines 62–68):
      ```typescript
      if (result.membership?.role === 'member') {
        router.push(`/mosque/${targetSlug}/dashboard`);
      } else {
        router.push(`/mosque/${targetSlug}/admin`);
      }
      ```
  - **Layout & Visual Structure** (lines 98–270):
    - Two-column card container (`max-w-5xl`, `rounded-[20px]`, `border-2 border-[#c89b3c]/30`, `shadow-2xl`).
    - Left Column (`md:col-span-5`): Royal Emerald (`#0d4734`) background, gold accent text (`#c89b3c`), headline `"ONE ACCOUNT. every MOSQUE."`, feature list with gold diamond bullets (`✦`).
    - Right Column (`md:col-span-7`): Ivory background (`#fcfbfa`), Mosque selector `<select>`, email input, password input with show/hide toggle, `.btn-pill-cta` button, and bottom links.

- **Mosque-Specific Login Page** (`frontend/src/app/mosque/[slug]/login/page.tsx`, lines 1–285):
  - **Component**: `MosqueLogin`
  - Utilizes `useParams()` to obtain `slug` (line 17: `typeof params?.slug === 'string' ? params.slug : 'al-noor'`).
  - Fetches `/api/mosques` and resolves `currentMosqueName` matching current `slug`.
  - Left hero badge displays `Active Tenant: {currentMosqueName || slug} (/{slug})` (line 145).
  - Header back-link points to `/mosque/${slug}` (`&larr; BACK TO MOSQUE`).
  - Create account link directs to `/mosque/${selectedMosqueSlug || slug}/register`.

### 1.2 Existing Routing Destinations & Target Portals
1. **Section 1: Worshipper & Member Portal**
   - **Target Route**: `/mosque/[slug]/dashboard` (`frontend/src/app/mosque/[slug]/dashboard/page.tsx`)
   - **Target Role**: `member`
   - **Features Available**: Personal dashboard tabs (`overview`, `programs`, `donations`, `profile`), active class/programme passes, registered seats toggle, complete donation history with currency formatting, and cryptographic tax receipt popups (`MH-XXXXXXXX`).
2. **Section 2: Mosque Administrator & Imam Workspace**
   - **Target Route**: `/mosque/[slug]/admin` (`frontend/src/app/mosque/[slug]/admin/page.tsx`)
   - **Target Roles**: `tenant_admin`, `finance_officer`, `programme_officer`, `communications_officer`
   - **Features Available**: Overview KPIs, Iqamah schedules & prayer timetables, announcement publishing/deletion, program scheduling & door check-in scanner (`Attended`/`Registered`/`Cancelled`), manual cash donation entry, donor reconciliation, member directory, audit logs, and deep analytics at `/mosque/[slug]/admin/analytics`.
3. **Section 3: Platform Super-Administrator Console**
   - **Target Route**: `/platform` (`frontend/src/app/platform/page.tsx`)
   - **Authentication Endpoint**: `POST /api/platform/auth/login` (lines 42–46, payload `{ email, password }`, no mosque slug header needed).
   - **Token Storage**: `localStorage.setItem('masjidhub:platform:token', result.token)`.
   - **Target Role**: `super_admin` (`user.platform_role === 'super_admin'`).
   - **Features Available**: Multi-tenant mosque directory with membership/program/donation counts, tenant status activation/suspension via `PATCH /api/platform/tenants/:id/status`, and platform-wide metrics (`/api/platform/metrics`).

### 1.3 Design System & Styling Tokens
Verified directly in `frontend/src/app/globals.css` (lines 1–283) and `frontend/src/app/layout.tsx`:
- **Color Palette & CSS Variables**:
  - `--primary-green`: `#0d4734` (Royal Emerald Green)
  - `--primary-green-hover`: `#083325`
  - `--primary-green-light`: `#e4efe9` (Sage/Mint tint for success messages and active badges)
  - `--accent-gold`: `#c89b3c` (Warm Metallic Gold)
  - `--accent-gold-hover`: `#b3882a`
  - `--accent-gold-light`: `#faf4e6`
  - `--background`: `#fcfbfa` (Ivory Surface)
  - `--background-secondary`: `#f6f3eb` (Warm Light Sand)
  - `--foreground`: `#1c2421` (Deep Charcoal Black)
  - `--card-border` / `--border-color`: `rgba(28, 36, 33, 0.08)` and `rgba(200, 155, 60, 0.2)`
- **Typography & Font**:
  - Font: `League Spartan`, loaded via Google Fonts in `layout.tsx` (`wght@300;400;500;600;700;800;900`).
  - Headings: `font-black uppercase tracking-tight` or `tracking-tighter`.
  - Section Eyebrows: `text-[9px]` or `text-[10px]`, `font-black uppercase tracking-ultra-wide` (`letter-spacing: 0.4em`) or `tracking-menu` (`0.2em`).
- **Standard UI Component Primitives**:
  - `.nav-glass`: 80px high, `rgba(252, 251, 250, 0.92)` backdrop blur(12px), `1px solid rgba(200, 155, 60, 0.2)`.
  - `.btn-pill-cta`: `#0d4734` background, `1.5px solid #c89b3c` border, white uppercase text, `letter-spacing: 0.4em`, hover color invert to gold background with green text.
  - `.btn-pill-gold`: `#c89b3c` background, `#0d4734` text, rounded-full.
  - `.btn-pill-secondary`: `rgba(252, 251, 250, 0.9)` background, `#0d4734` text, `1.5px solid #c89b3c` border.
  - Inputs: `bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[8px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]`.
  - Badges: `rounded-full text-[9px] font-black uppercase tracking-widest` (e.g. `bg-[#e4efe9] text-[#0d4734]` for Member/Active, `bg-[#0d4734] text-[#c89b3c]` for Admin, `bg-[#c89b3c] text-[#0d4734]` for Operator).

### 1.4 Destination Mosque State & Dropdown Selector
- `allMosques` state is populated asynchronously from `GET /api/mosques` (`frontend/src/lib/api.ts`).
- Destination slug selection triggers:
  1. Setting `X-Mosque-Slug` in HTTP request headers.
  2. Saving JWT to `localStorage.setItem('masjidhub:${targetSlug}:token', token)`.
  3. Setting CSRF cookies (`mh_csrf`) and session cookies (`mh_session`).
  4. Automatic tenant auto-joining on backend (`backend/src/routes/auth.ts` lines 188–204) if a user signs into a new mosque where they don't yet have an active membership.

### 1.5 Quick Links & Onboarding Entry Points
- Existing quick links in `/login` and `/mosque/[slug]/login`:
  - **Create Account**: Links to `/register` or `/mosque/[slug]/register`.
  - **Platform Operator Console**: Links to `/platform` (or accessible directly in Section 3).
  - **Register a New Mosque**: Links to `/register` (with mode='mosque' tab).
- In `frontend/src/app/register/page.tsx`:
  - Dual-mode segmented switcher (`registerMode: 'user' | 'mosque'`).
  - Mode `'user'` registers worshipper with selected mosque auto-join.
  - Mode `'mosque'` collects legal mosque entity details (`mosque_name`, `slug`, `address`, `admin_name`, `admin_email`, `admin_password`) and invokes `POST /api/mosques/register`.

### 1.6 Automated Verification Execution Results
- `npm --prefix backend run test:node`: **44/44 passing** (0 failures, duration ~260ms).
- `npm --prefix frontend run test:node`: **20/20 passing** (0 failures, duration ~55ms).
- `npm --prefix frontend run build`: **Compiled successfully in 19.1s**, TypeScript validated (0 errors), 7 static/dynamic pages built.

---

## 2. Logic Chain

1. **User Requirement Mapping (R1 & R2)**:
   - *Requirement*: Restructure `/login` and `/mosque/[slug]/login` into 3 dedicated role-based portal sections:
     - Section 1: Worshipper & Member Sign-In (`/mosque/[slug]/dashboard`).
     - Section 2: Mosque Administrator & Imam Workspace (`/mosque/[slug]/admin`).
     - Section 3: Sovereign Platform Operator (`/platform`).
   - *Observation Support*:
     - Section 1 & Section 2 interact with `POST /api/auth/login` and require a destination mosque slug (`X-Mosque-Slug`).
     - Section 3 interacts with `POST /api/platform/auth/login` with no mosque slug, saving `masjidhub:platform:token`.
2. **Component Architecture Strategy**:
   - Both `/login` (global) and `/mosque/[slug]/login` (tenant-specific) can share the 3-section design structure:
     - A 3-tab segmented navigation bar (`[ Worshipper Portal | Mosque Admin Workspace | Platform Operator ]`).
     - Distinct role badges (Emerald/Gold), tailored hero editorial copy, role-specific input placeholder hints, and direct routing targets.
     - Section 1 & 2 provide the reactive Destination Mosque Selector dropdown.
     - Section 3 displays a dedicated sovereign terminal layout with direct submission to `/api/platform/auth/login` and immediate routing to `/platform`.
3. **Session & Multi-Tenant Compatibility (R3)**:
   - The frontend API client (`frontend/src/lib/api.ts`) automatically extracts tokens from `masjidhub:${slug}:token` or `masjidhub:platform:token`, attaches CSRF tokens via `mh_csrf` cookie / `X-CSRF-Token` header, and maintains full cookie credentials (`credentials: 'include'`).
   - Therefore, introducing dedicated tabs for the 3 roles maintains complete compatibility with backend authentication, CSRF protections, and session cookies.

---

## 3. Caveats

- **No Caveats**: All frontend pages, components, CSS tokens, API endpoints, backend auth schemas, and test suites were completely inspected and confirmed working.
- **Note on Mock Tests**: `frontend/__tests__/auth/login.test.tsx` currently imports the legacy login structure and contains basic label checks; any implementer updating the login UI should ensure test fixtures or standalone runner suites in `frontend/__tests__/standalone_runner.js` are synchronized with the 3 portal sections.

---

## 4. Conclusion

The frontend codebase is cleanly architected using Next.js App Router (v16.2), Tailwind CSS v4, and React 19.
The 3 dedicated role-based login portals can be seamlessly integrated into both `frontend/src/app/login/page.tsx` and `frontend/src/app/mosque/[slug]/login/page.tsx` using a 3-tab segmented interface:
1. **Member / Worshipper Tab**: Connects to `POST /api/auth/login` with mosque selector; on success routes directly to `/mosque/[slug]/dashboard`.
2. **Mosque Admin / Imam Tab**: Connects to `POST /api/auth/login` with mosque selector; on success routes directly to `/mosque/[slug]/admin`.
3. **Platform Operator Tab**: Connects to `POST /api/platform/auth/login` (global super-admin); on success routes directly to `/platform`.
4. **Design Harmony**: Uses Royal Emerald (`#0d4734`), Warm Metallic Gold (`#c89b3c`), Ivory (`#fcfbfa`), `League Spartan` typography, and pill CTA buttons.
5. **Quick Links**: Explicit links for member registration (`/register` or `/mosque/[slug]/register`) and mosque tenant onboarding.

---

## 5. Verification Method

To independently verify all findings and validate future implementations:

1. **Run Frontend Automated Node Test Suite**:
   ```powershell
   npm --prefix frontend run test:node
   ```
   *Expected*: 20/20 test assertions passing with 0 errors.

2. **Run Backend Automated Node Test Suite**:
   ```powershell
   npm --prefix backend run test:node
   ```
   *Expected*: 44/44 test assertions passing with 0 errors.

3. **Run Production Next.js Build**:
   ```powershell
   npm --prefix frontend run build
   ```
   *Expected*: Zero TypeScript, linting, or Turbopack compilation errors.

4. **Code Inspection Checkpoints**:
   - `frontend/src/app/login/page.tsx`
   - `frontend/src/app/mosque/[slug]/login/page.tsx`
   - `frontend/src/app/platform/page.tsx`
   - `frontend/src/lib/api.ts`
   - `frontend/src/app/globals.css`
