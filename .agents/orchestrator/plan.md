# MasjidHub Implementation Plan

## Phase 0: Survey & Discovery
- Survey 1: Database & Migrations, Prisma schema, Seed scripts, Models, Environment config
- Survey 2: Backend Architecture, Fastify server, Auth, CSRF, Cookies, CORS, Routes, Services, Audit Logging
- Survey 3: Frontend Architecture, Next.js app, Tenant workspaces, Programmes UI, Donations/Reconciliation UI, Notifications, Role-based Views
- Aggregate findings into `PROJECT.md` (Feature Inventory, Architecture, Milestones, Interface Contracts, Code Layout).

## Phase 1: Dual-Track Execution
- **Track A (E2E Testing Track)**:
  - Design opaque-box test framework & infrastructure (`TEST_INFRA.md`).
  - Tier 1: Feature Coverage (>=5 per feature)
  - Tier 2: Boundary & Corner Cases (>=5 per feature)
  - Tier 3: Cross-Feature Combinations (Pairwise)
  - Tier 4: Real-World Scenarios
  - Publish `TEST_READY.md`
- **Track B (Implementation Track)**:
  - Milestone 1: Versioned Database Migrations & Reproducible Setup (Prisma SQLite baseline migration, migrate deploy script, idempotent seed)
  - Milestone 2: Security Hardening & Session Security (HTTP-only cookies, CSRF protection, request validation schemas, strict CORS, AuditEvent generation)
  - Milestone 3: Administrative Workflows & Frontend Completion (Programme lifecycle & check-in, donation reconciliation & CSV ledger export, in-app notifications, audit log UI)
  - Milestone 4: Comprehensive Automated Test Suite & Multi-Tenant Isolation (Integration tests for 5 roles, multi-mosque global users, adversarial isolation verification)

## Phase 2: Final Integration & Hardening
- Pass 100% E2E test suite (Tiers 1-4)
- Tier 5 Adversarial Coverage Hardening (Challengers -> Worker -> Reviewers)
- Forensic Integrity Audit
- Final Human Report
