# Programming Lightning Website

## Project Overview

Educational platform for learning Bitcoin and Lightning Network programming through interactive tutorials. The site hosts two main tutorials: a Noise Protocol tutorial and a Lightning Network tutorial (Programming Lightning). Users complete coding exercises in Python (executed in-browser via Pyodide/WebAssembly) and earn sats for correct solutions.

## Original Tutorial Source

The Lightning tutorial content was migrated from a Rust-based interactive workshop originally built on Replit. The original tutorial markdown and images live at:
https://github.com/Beige-Coffee/programming-lightning-payment-channels/tree/main/

The original tutorial used Rust exercises. This project converts them to Python (executed via Pyodide in the browser). When editing tutorial content, the original repo is the source of truth for educational text, diagrams, and `<details>` Q&A blocks. Coding exercise directions should reference the Python versions in `lightning-exercises.ts`, not the original Rust code.

## Tech Stack

- **Frontend**: React 19 + TypeScript, Vite, wouter (routing), Tailwind CSS v4, Radix UI, CodeMirror (code editor)
- **Backend**: Express.js + TypeScript (tsx), PostgreSQL with Drizzle ORM
- **Code Execution**: Pyodide (WebAssembly CPython) runs Python exercises in-browser
- **Auth**: Passport.js with email/password + Lightning LNURL-auth
- **Deployment**: Replit (production), local dev with Vite proxy to programminglightning.com API

## Project Structure

```
client/
  src/
    pages/           # Route pages (home, about, blog, lightning-tutorial, noise-tutorial, admin)
    components/      # React components (CodeExercise, CheckpointQuestion, etc.)
    data/            # Exercise definitions (lightning-exercises.ts, code-exercises.ts)
    hooks/           # Custom React hooks
    lib/             # Utilities, query client
  lightning_tutorial/  # Markdown content files for Lightning tutorial
    tutorial_images/   # PNG images referenced by tutorial markdown
    *.md               # Tutorial chapter content
server/
  routes.ts          # API routes (auth, exercise verification, LNURL, analytics)
  storage.ts         # Database access layer
  email.ts           # Email verification via Resend
shared/
  schema.ts          # Drizzle ORM schema (shared between client/server)
```

## Running Locally

```bash
npm run dev          # Full dev server (Express + Vite, port 3000)
npm run dev:local    # Client-only Vite dev (port 3000, proxies API to programminglightning.com)
npm run build        # Production build
npm run check        # TypeScript type checking
```

The local dev server runs at `http://localhost:3000`. The Lightning tutorial is at `/lightning-tutorial`.

## Lightning Tutorial Architecture

### Tutorial Content (Markdown)

Tutorial content lives in `client/lightning_tutorial/*.md`. Files are named with a section.chapter pattern (e.g., `2.1-keys-manager.md`).

The markdown files support custom tags:
- `<checkpoint id="...">` - Knowledge-check questions rendered inline
- `<checkpoint-group>` - Groups multiple checkpoints together
- `<code-intro exerciseId="...">` - Marks where a coding exercise begins (pulls from lightning-exercises.ts)
- `<code-outro>` - Marks the end of a coding exercise section
- `<details><summary>...</summary>...</details>` - Collapsible Q&A sections (preserve these)
- Standard `<img src="./tutorial_images/...">` for diagrams

### Chapter Ordering

Chapter ordering is defined in `client/src/pages/lightning-tutorial.tsx` in the `chapters` array and `sectionOrder`. The current order is:

1. **Introduction**: Intro, Protocols & Fairness
2. **Keys & Derivation**: Key Management, BIP32 Key Derivation, Channel Keys & Public Keys
3. **Payment Channels**: Off-Chain Scaling, Funding Script, Funding Transaction, Refund & Timelocks, Revocable Transactions, Transaction Signing
4. **Commitment Keys**: Revocation Keys, Commitment Secrets, Per-Commitment Key Derivation
5. **Commitment Transactions**: Commitment Scripts, Obscured Commitment Numbers, Assembly, Finalization
6. **HTLCs**: Offered HTLCs, Received HTLCs, HTLC Fees & Dust
7. **Quiz**: Test Your Knowledge
8. **Pay It Forward**: Donate Sats

### Exercise Definitions

Python exercises are defined in `client/src/data/lightning-exercises.ts`. Each exercise has:
- `id` - matches the `exerciseId` in `<code-intro>` tags
- `starterCode` - Python code shown to the user
- `testCode` - Python test functions run via Pyodide
- `hints` - conceptual, steps, and full code hints

Exercise IDs referenced in markdown `<code-intro>` tags are filtered against the `LIGHTNING_EXERCISES` object. Missing IDs are silently skipped (no error).

## Writing Style for Tutorial Content

- Educational, conversational tone. Use "we'll" and "let's" frequently.
- Do NOT use em dashes. Use commas, periods, or parentheses instead.
- Bold key terms on first introduction with `**term**`.
- Use `<details><summary>` blocks for Q&A tangents and deeper dives.
- All coding exercises are in **Python** (not Rust). Exercise directions should reference Python syntax, Python libraries (hashlib, hmac, struct, ecdsa), and Python patterns.
- When explaining exercises, reference the Python function signatures and return types from lightning-exercises.ts.
- Keep images and diagrams in place. Reference them with `<img src="./tutorial_images/filename.png">`.

## Important Conventions

- Path aliases: `@` = `client/src/`, `@shared` = `shared/`
- The `Chapter` type in lightning-tutorial.tsx uses a `section` union type that must match the `sectionOrder` array exactly
- Database schema is in `shared/schema.ts` and pushed via `npm run db:push` (Drizzle Kit)
- Production API is at `programminglightning.com`. Local dev proxies `/api` requests there.
