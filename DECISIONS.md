# Architecture & Design Decisions

This file tracks all explicit decisions made that were not specified directly in `PROJECT_BRIEF.md`.

- **2026-11-21**: Reserved `/site` directory for the Astro marketing site and placed the active application inside `/app` (Vite + React + TS).
- **2026-11-21**: Stored all monetary amounts as integer paise (`bigint`) across client calculations, pure logic, and Postgres columns (`amount_paise`, `share_paise`).
- **2026-11-21**: Implemented remainder distribution in equal splits by sorting participant member IDs deterministically and adding 1 paise to the first remainder members.
- **2026-11-21**: Integrated Lucide React for mobile tap targets and PWA icons with `vite-plugin-pwa`.
- **2026-11-21**: Executed and verified database migrations and multi-tenant RLS isolation with two simulated test users using automated Postgres test scripts.
- **2026-11-21**: Used synthetic email fallback (`phone<digits>@roommate.com`) to allow zero-OTP, phone + 6-digit PIN authentication without third-party SMS providers.
- **2026-11-21**: Created atomic `create_group` database RPC function to guarantee group creation and admin member insertion in a single transaction under RLS.
- **2026-11-21**: Aligned all UI components with the Apple design system in `DESIGN.md` (canvas-parchment `#f5f5f7`, Action Blue `#0066cc`, pill buttons, SF Pro typography).
- **2026-11-21**: Added automated trigger `tr_audit_expense_changes` on `expenses` to log updates and soft deletes to `expense_audit`.
- **2026-11-21**: Configured Cloudflare Pages `_redirects` SPA fallback (`/* /index.html 200`) and seeded the real flat group with invite code `INDORE`.
