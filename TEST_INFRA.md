# E2E Test Infra: MasjidHub 3-Portal Login Restructuring

## Test Philosophy
- Requirement-driven, opaque-box, verifying user authentication flows across all 3 portals.
- 4-Tier Test Architecture + Tier 5 Adversarial Coverage Hardening.

## Feature Inventory & Test Mapping
| # | Feature | Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|--------|:------:|:------:|:------:|:------:|
| F1 | 3-Section Segmented Login UI | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| F2 | Worshipper Authentication & Routing | ORIGINAL_REQUEST §R1.1 | 5 | 5 | ✓ | ✓ |
| F3 | Mosque Admin Authentication & Routing | ORIGINAL_REQUEST §R1.2 | 5 | 5 | ✓ | ✓ |
| F4 | Platform Operator Authentication & Routing | ORIGINAL_REQUEST §R1.3 | 5 | 5 | ✓ | ✓ |
| F5 | Destination Mosque Selector Dropdown | ORIGINAL_REQUEST §R1, R2 | 5 | 5 | ✓ | ✓ |
| F6 | Responsive Royal Emerald & Gold Aesthetic | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F7 | Quick Links & Onboarding Gateways | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F8 | Session, Cookies & CSRF Invariants | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| F9 | Multi-Tenant Auto-Membership & Switching | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| F10 | Build & Automation Verification | ORIGINAL_REQUEST §Acceptance | 5 | 5 | ✓ | ✓ |

## Test Architecture & Runners
- **Frontend Standalone Runner**: `npm --prefix frontend run test:node`
- **Backend Standalone Runner**: `npm --prefix backend run test:node`
- **Next.js Production Build**: `npm --prefix frontend run build`

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: ≥5 test cases per feature covering isolated happy-path authentication, tab selection, and routing.
- **Tier 2 (Boundary & Corner Cases)**: ≥5 test cases per feature covering invalid credentials, missing passwords, slug pattern violations, inactive/suspended tenants, missing CSRF tokens, non-admin role attempts.
- **Tier 3 (Cross-Feature Combinations)**: Pairwise coverage for multi-mosque switching, cross-tab state resets, cookie + Bearer dual auth.
- **Tier 4 (Real-World Application Scenarios)**: Realistic end-to-end user journeys (e.g., new congregant joining a mosque via sign-in, imam accessing prayer admin console, platform superadmin managing suspended tenants).
