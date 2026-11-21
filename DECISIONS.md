# Architecture & Design Decisions

This file tracks all explicit decisions made that were not specified directly in `PROJECT_BRIEF.md`.

- **2026-11-21**: Reserved `/site` directory for the Astro marketing site and placed the active application inside `/app` (Vite + React + TS).
- **2026-11-21**: Stored all monetary amounts as integer paise (`bigint`) across client calculations, pure logic, and Postgres columns (`amount_paise`, `share_paise`).
- **2026-11-21**: Implemented remainder distribution in equal splits by sorting participant member IDs deterministically and adding 1 paise to the first remainder members.
- **2026-11-21**: Integrated Lucide React for mobile tap targets and PWA icons with `vite-plugin-pwa`.
- **2026-11-21**: Executed and verified database migrations and multi-tenant RLS isolation with two simulated test users using automated Postgres test scripts.
