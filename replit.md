# Programming Lightning

## Overview
Free, open-source educational website teaching Bitcoin Lightning Network through interactive courses. Retro 8-bit Nintendo-style pixel art aesthetic with yellow (#FFD700) color scheme.

Created by Austin (Spiral and HRF grantee), inspired by Programming Bitcoin.

## Recent Changes
- 2026-02-26: Removed screenshot capture/upload from feedback widget (text-only now), removed html2canvas-pro dependency, dropped screenshotBase64 from DB
- 2026-02-26: Server stability fixes — removed process.exit(1) from Vite error handler, fixed Express error handler re-throw, added global uncaughtException/unhandledRejection handlers
- 2026-02-21: "Send to Scratchpad" button on code exercises — dispatches sampleCode via CustomEvent, Scratchpad receives and loads it (with pendingCodeRef buffer for closed panel)
- 2026-02-21: Server-side progress sync for quiz selections and code exercises (userProgress table, useProgress hook)
- 2026-02-18: Added "Pay It Forward" donation page (below Quiz in sidebar)
- 2026-02-18: Donation invoices via Lexe sidecar (POST /api/donate/create-invoice, GET /api/donate/check-payment)
- 2026-02-16: Added Plausible Analytics for traffic/referrer tracking
- 2026-02-16: Custom page_events tracking (page views, duration, user progress)
- 2026-02-16: Admin analytics endpoint (GET /api/admin/analytics)
- 2026-02-16: Lexe Sidecar auto-starts with app server
- 2026-02-12: Added dual authentication (Lightning + Email/Password) with unified sessions table
- 2026-02-12: One-time Bitcoin reward system for quiz completion (90%+ score)
- 2026-02-12: Quiz is now open-access; submission requires login
- 2026-02-12: Login modal with Email and Lightning tabs

## User Preferences
- Retro 8-bit pixel art aesthetic, bright yellow (#FFD700), no rounded corners, pixel shadows
- Light mode default, Dark mode toggle with sun/moon icons
- font-pixel for headings/UI, font-mono for body text

## Project Architecture
- Stack: React + Vite frontend, Express backend, PostgreSQL + Drizzle ORM
- Auth: Dual — LNURL-auth (secp256k1 npm package) + Email/Password (bcryptjs)
- Sessions: Unified sessions table for both auth methods
- Frontend auth: useAuth hook (client/src/hooks/use-auth.ts)
- Login UI: LoginModal component (client/src/components/LoginModal.tsx)
- Quiz: Interactive 10-question quiz in noise-tutorial page, open to all, submit requires login
- Reward: One-time claim per account, tracked by reward_claimed column in users table

## Key Files
- shared/schema.ts — DB schema (users, sessions, lnAuthChallenges, lnurlWithdrawals, pageEvents, userProgress)
- server/routes.ts — API routes (auth, lnauth, reward, tracking, admin analytics)
- server/storage.ts — Storage interface and DB operations
- client/src/hooks/use-auth.ts — Unified auth hook
- client/src/hooks/use-lnauth.ts — LNURL-auth challenge polling (used by LoginModal)
- client/src/hooks/use-progress.ts — Server-side progress sync (quiz selections, code exercises)
- client/src/hooks/use-page-tracking.ts — Auto page view tracking with duration
- client/src/components/LoginModal.tsx — Login modal with Email/Lightning tabs
- client/src/pages/noise-tutorial.tsx — Tutorial + quiz page

## Technical Notes
- LNURL-auth uses secp256k1 npm package for DER signature verification
- Wallets sign k1 directly as message hash without additional SHA256
- Session tokens stored in localStorage as "pl-session-token"
- LN callback creates session in sessions table (unified with email sessions)
- Password hashing: bcryptjs with cost 10
- Analytics: Plausible (external traffic/referrers) + custom page_events table (tutorial progress)
- Tracking sessionId is client-generated, stored in sessionStorage, used for duration update ownership
- Admin analytics: GET /api/admin/analytics?password=<ADMIN_PASSWORD>
- Lexe Sidecar auto-starts via spawn() in server/routes.ts registerRoutes()
- Progress sync: quiz selections and code exercise code saved to userProgress table (debounced 1.5s), hydrated on login from server with localStorage fallback
