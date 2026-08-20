# Plan — MasjidHub Role-Based Login Restructuring

## Objectives
1. Map full architecture across frontend auth routes, backend authentication endpoints, session handling, cookie management, and test suites.
2. Restructure both global `/login` and mosque portal `/mosque/[slug]/login` into 3 distinct role-based sections:
   - Section 1: Worshipper & Member Sign-In -> `/mosque/[slug]/dashboard`
   - Section 2: Mosque Administrator & Imam Workspace -> `/mosque/[slug]/admin`
   - Section 3: Sovereign Platform Operator -> `/platform`
3. Maintain Royal Emerald Green (`#0d4734`), Warm Metallic Gold (`#c89b3c`), responsive layout, role badges, descriptions, quick links for account creation and tenant onboarding, destination mosque dropdown reactivity.
4. Ensure cookie (`mh_session`, `mh_csrf`), Bearer token, and CSRF protection headers work flawlessly across all portals.
5. Create comprehensive E2E test suite (Tiers 1-4) and adversarial coverage hardening (Tier 5).
6. Achieve 100% passing tests for backend (`npm --prefix backend run test:node`), frontend (`npm --prefix frontend run test:node`), and Next.js production build (`npm --prefix frontend run build`).

## Workflow Phases
- **Survey**: Dispatch 3 Explorers (Explorer 1: Frontend Login UI & Routing; Explorer 2: Backend Auth APIs & Session/Cookie Handling; Explorer 3: Test Infrastructure, Vitest/Node test suites & Next.js Build Setup).
- **Synthesis & PROJECT.md**: Consolidate findings, build feature inventory, specify architecture, interfaces, code layout.
- **Track 1: E2E Testing**: Design E2E test harness covering all 4 tiers, verify with test runner.
- **Track 2: Implementation**: Implement components, update routing, styling, state management, role redirection, multi-tenant session preservation.
- **Review & Gate Verification**: 2 Reviewers + 2 Challengers + 1 Forensic Auditor for strict AND gate verification.
- **Adversarial Hardening (Tier 5)**: White-box testing to close edge-case gaps.
- **Final Report**: Deliver full acceptance criteria verification report to user.
