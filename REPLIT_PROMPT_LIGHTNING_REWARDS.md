# Replit Prompt: Lightning Quiz Rewards with LNURL-Withdraw + Lexe Sidecar

Paste the following into Replit Agent (set to "Build" mode, not "Plan", and NOT "Automation"):

---

Add real Lightning Bitcoin rewards to my existing quiz. When a student scores 90% or above on the Noise Protocol quiz, they can scan a QR code with any Lightning wallet to withdraw sats. The quiz, authentication, database, and frontend already exist — you are wiring in the payment backend and updating the existing reward UI.

## Architecture Overview

This app already has a working full-stack TypeScript codebase:

- **Frontend**: React 19 + Vite + TailwindCSS + Wouter routing (`client/src/`)
- **Backend**: Express + TypeScript (`server/`)
- **Database**: PostgreSQL with Drizzle ORM (`shared/schema.ts`, `server/storage.ts`)
- **Auth**: Email/password + LNURL-auth already working (`server/routes.ts`)
- **Port**: The app runs on port 5000

We are adding two new pieces:

1. **Lexe Sidecar** — a binary that runs at `http://localhost:5393` and proxies requests to my self-custodial Lexe Lightning node.
2. **LNURL-withdraw endpoints** — added to the existing Express backend in `server/routes.ts`.

### Payment Flow

1. Student scores 90%+ on the existing quiz (already implemented in `client/src/pages/noise-tutorial.tsx`)
2. Student clicks the existing "CLAIM BITCOIN REWARD" button
3. Backend generates a unique LNURL-withdraw link, returns it to the frontend
4. Frontend renders the LNURL string as a real QR code (replacing the current placeholder SVG)
5. Student scans QR with any LNURL-compatible wallet (Phoenix, Zeus, Wallet of Satoshi, etc.)
6. Wallet hits our LNURL-withdraw endpoint, gets withdrawal parameters
7. Wallet creates a BOLT11 invoice and sends it to our callback
8. Our backend pays that invoice via the Lexe Sidecar (`POST http://localhost:5393/v2/node/pay_invoice`)
9. Student receives sats

## Step 1: Set Up the Lexe Sidecar

1. Download and read the Lexe Sidecar SDK docs:

```bash
curl -fsSL https://raw.githubusercontent.com/lexe-app/lexe-sidecar-sdk/master/README.md -o LEXE_SIDECAR_DOCS.md
cat LEXE_SIDECAR_DOCS.md
```

2. Install `unzip` as a system dependency using the Replit tool.

3. Install the `lexe-sidecar` binary:

```bash
curl -fsSL https://raw.githubusercontent.com/lexe-app/lexe-sidecar-sdk/master/install.sh | sh
```

4. Prompt me for my `LEXE_CLIENT_CREDENTIALS` value and configure it as a Replit secret.

5. Update the `.replit` file to run the sidecar in parallel with the app. The current `.replit` already uses a parallel workflow pattern. Add a new Lexe Sidecar workflow and run it alongside the existing "Start application" workflow:

```toml
[[workflows.workflow]]
name = "Project"
mode = "parallel"
author = "agent"

[[workflows.workflow.tasks]]
task = "workflow.run"
args = "Start application"

[[workflows.workflow.tasks]]
task = "workflow.run"
args = "Lexe Sidecar"

[[workflows.workflow]]
name = "Lexe Sidecar"
author = "agent"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "./.local/bin/lexe-sidecar"
```

Also update the `[deployment]` section's `run` array to start the sidecar in the background for production:

```toml
[deployment]
deploymentTarget = "autoscale"
build = ["npm", "run", "build"]
publicDir = "dist/public"
run = ["sh", "-c", "./.local/bin/lexe-sidecar & node ./dist/index.cjs"]
```

6. Restart the workflow, wait a few seconds, then confirm sidecar is running:

```bash
curl http://localhost:5393/v2/health
curl http://localhost:5393/v2/node/node_info
```

Do NOT proceed until the sidecar is confirmed working.

## Step 2: Add the Withdrawal Database Table

The database uses **Drizzle ORM with PostgreSQL**. All schema is in `shared/schema.ts`. Add a new table for tracking LNURL withdrawals:

**In `shared/schema.ts`**, add this table alongside the existing `users`, `sessions`, and `lnAuthChallenges` tables:

```typescript
export const lnurlWithdrawals = pgTable("lnurl_withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  k1: varchar("k1", { length: 64 }).notNull().unique(),
  userId: varchar("user_id").notNull(),
  amountMsats: text("amount_msats").notNull(), // millisatoshis as string
  status: text("status").notNull().default("pending"), // pending, claimed, paid, expired, failed
  bolt11Invoice: text("bolt11_invoice"),
  paymentIndex: text("payment_index"),
  errorReason: text("error_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  claimedAt: timestamp("claimed_at"),
  paidAt: timestamp("paid_at"),
});

export type LnurlWithdrawal = typeof lnurlWithdrawals.$inferSelect;
```

Then add the corresponding storage methods in `server/storage.ts`. Follow the existing pattern — the file uses `DatabaseStorage` class that implements `IStorage` interface. Add these methods:

- `createWithdrawal(k1: string, userId: string, amountMsats: string): Promise<LnurlWithdrawal>`
- `getWithdrawalByK1(k1: string): Promise<LnurlWithdrawal | undefined>`
- `markWithdrawalClaimed(k1: string, bolt11Invoice: string): Promise<void>`
- `markWithdrawalPaid(k1: string, paymentIndex: string): Promise<void>`
- `markWithdrawalFailed(k1: string, reason: string): Promise<void>`
- `markWithdrawalExpired(k1: string): Promise<void>`
- `getWithdrawalsByUserId(userId: string): Promise<LnurlWithdrawal[]>`
- `getRecentWithdrawals(limit: number): Promise<LnurlWithdrawal[]>`

Run `npm run db:push` to apply the schema changes.

## Step 3: Build the LNURL-Withdraw Backend

Add all new endpoints to the existing `server/routes.ts` file. This file already has:
- Auth endpoints (`/api/auth/*`)
- LNURL-auth endpoints (`/api/lnauth/*`)
- Helper functions: `generateK1()`, `encodeLnurl()`, `getBaseUrl()`, `getAuthUser()`
- Imports for `randomBytes`, `secp256k1`, `bech32`, `QRCode`, `bcrypt`

**You can reuse the existing `generateK1()` and `encodeLnurl()` functions** — they already generate 32-byte random hex and bech32-encode LNURL strings.

### Endpoint 1: `POST /api/quiz/claim`

Called by the frontend when the user clicks "CLAIM BITCOIN REWARD". Requires authentication (Bearer token in Authorization header — use the existing `getAuthUser()` helper).

**Request body**: `{ "answers": { "0": 1, "1": 3, "2": 2, ... } }` — a map of question index to selected option index.

This endpoint:
1. Verifies the user is authenticated
2. **Validates quiz answers server-side**: The quiz answer key must be duplicated on the server (or in a shared file). Check that the submitted answers score 90%+ (9/10 correct). Return an error if the score is too low. This prevents users from calling the endpoint directly without actually passing the quiz.
3. **Rate limit**: Allow at most 1 successful claim per user per 10 minutes (check `createdAt` of the user's most recent withdrawal in the database). Return an error if claimed too recently.
4. Generates a new k1 using the existing `generateK1()` function
5. Creates a withdrawal record in the database
6. Constructs the LNURL-withdraw URL: `${getBaseUrl(req)}/api/lnurl/withdraw/${k1}`
7. Bech32-encodes it using the existing `encodeLnurl()` function
8. Returns `{ k1, lnurl: <bech32 encoded string>, amountSats: <reward amount> }`

**Important**: Do NOT check `user.rewardClaimed` — allow users to claim rewards multiple times (each time they pass the quiz with 90%+). Remove or ignore the old `rewardClaimed` boolean field.

For the server-side answer key, the 10 quiz questions are defined in `client/src/pages/noise-tutorial.tsx` as the `QUIZ_QUESTIONS` array (starts around line 697). Each has an `answer` field (0-indexed correct option). Copy these answer values to a server-side const in `server/routes.ts`:
```typescript
// Answer key for noise protocol quiz (0-indexed option for each question)
const QUIZ_ANSWER_KEY = [1, 2, 2, 1, 2, 2, 1, 2, 2, 2];
const QUIZ_PASS_THRESHOLD = 0.9; // 90%
```

### Endpoint 2: `GET /api/lnurl/withdraw/:k1`

This is the URL that gets encoded into the QR code. When the wallet scans and decodes the LNURL, it makes a GET request here. Return:

```json
{
  "tag": "withdrawRequest",
  "callback": "https://<APP_URL>/api/lnurl/callback",
  "k1": "<the k1 from the URL>",
  "defaultDescription": "Lightning Quiz Reward - Programming Lightning",
  "minWithdrawable": <reward amount in millisatoshis>,
  "maxWithdrawable": <reward amount in millisatoshis>
}
```

Important details:
- `minWithdrawable` and `maxWithdrawable` must be equal (fixed reward amount). These are in **millisatoshis** (1 sat = 1000 millisats).
- `callback` must be an absolute HTTPS URL. Use `getBaseUrl(req)` for the base URL.
- If the k1 doesn't exist, is already claimed/paid, or has expired (>5 minutes old), return `{"status": "ERROR", "reason": "Withdrawal expired or already claimed"}`.

### Endpoint 3: `GET /api/lnurl/callback?k1=<k1>&pr=<bolt11_invoice>`

The wallet calls this with:
- `k1`: the same k1 from the previous response
- `pr`: a BOLT11 Lightning invoice the wallet created

Your backend must:

1. Validate that k1 exists, is in "pending" status, and hasn't expired (5 min TTL)
2. Mark the withdrawal as "claimed" immediately (prevent double-claims) and store the bolt11 invoice
3. Return `{"status": "OK"}` immediately to the wallet
4. **Pay the invoice asynchronously** (fire-and-forget, do NOT await before responding). Per the LUD-03 spec, the service responds OK first and then attempts payment. This is critical because the Lexe node can take up to 15 seconds to wake up, and wallet HTTP clients will timeout.

The async payment logic (runs after the response is sent):
```typescript
// Fire-and-forget — do NOT await this before sending the response
(async () => {
  try {
    const payRes = await fetch("http://localhost:5393/v2/node/pay_invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice: pr }),
      signal: AbortSignal.timeout(30000), // 30s timeout for async payment
    });
    if (payRes.ok) {
      const payData = await payRes.json();
      // payData format: { "index": "<payment_index>", "created_at": <timestamp_ms> }
      await storage.markWithdrawalPaid(k1, payData.index);
    } else {
      const errData = await payRes.json().catch(() => ({ msg: "Unknown error" }));
      await storage.markWithdrawalFailed(k1, errData.msg || `HTTP ${payRes.status}`);
    }
  } catch (err: any) {
    await storage.markWithdrawalFailed(k1, err.message || "Payment failed");
  }
})();
```

5. If validation fails in step 1 or 2, return `{"status": "ERROR", "reason": "..."}` synchronously.

**Use Node.js 20 native `fetch`** (globally available, no import needed). Do NOT add dependencies like `axios` or `node-fetch`.

### Endpoint 4: `GET /api/lnurl/status/:k1`

The frontend polls this to check if the withdrawal has been completed. Return:

```json
{
  "status": "pending" | "claimed" | "paid" | "expired" | "failed",
  "amountSats": <number>
}
```

### Endpoint 5 (optional): `GET /api/admin/stats`

Protected by `ADMIN_PASSWORD` (query param or basic auth). Returns:
- Current node balance (from `GET http://localhost:5393/v2/node/node_info`, read the `balance` field)
- Total sats paid out
- Recent withdrawal log
- Count of pending withdrawals

## Step 4: Update the Existing Frontend

The quiz component is in `client/src/pages/noise-tutorial.tsx`. The relevant component is `InteractiveQuiz` (starts around line 842). It already has:

- A "CLAIM BITCOIN REWARD" button that calls `handleClaimReward()`
- A placeholder QR code (hardcoded SVG that says "SAMPLE QR - REAL REWARDS COMING SOON")
- Authentication checks and session token handling
- Pass/fail logic (90% threshold, `const passed = percentage >= 90`)

### Changes needed to `InteractiveQuiz`:

**1. Update `handleClaimReward` function** (currently at line 888):

Currently it POSTs to `/api/auth/claim-reward` and just marks a boolean. Change it to:
- POST to `/api/quiz/claim` with the Bearer token AND the user's quiz answers (the `selections` state object, which maps question index to selected option index)
- Request body: `{ answers: selections }` (where `selections` is the existing React state `Record<number, number>`)
- Store the returned `k1` and `lnurl` in new component state variables
- Set `showReward` to true

**2. Replace the placeholder QR code** (currently lines 972-996):

The current code renders a hardcoded SVG with text "SAMPLE QR - REAL REWARDS COMING SOON". Replace this entire block with:
- A real QR code rendered from the `lnurl` string (use a client-side QR library like `qrcode.react`, or fetch a QR data URL from the backend)
- Text showing the reward amount: "Scan to claim X sats!"
- A countdown timer showing time remaining (5 minutes from creation)

**3. Add polling for claim status**:

After the QR code is shown, poll `GET /api/lnurl/status/${k1}` every 2 seconds:
- While `status === "pending"`: show "Waiting for scan..."
- When `status === "claimed"`: show "Processing payment..."
- When `status === "paid"`: show celebration message "X sats sent! ⚡" and stop polling
- When `status === "expired"`: show "Expired" with a "Generate New QR" button
- When `status === "failed"`: show error message with a "Try Again" button

**4. Allow multiple claims — full prop chain to update**:

The `rewardClaimed` boolean flows through several files. Update ALL of them:

- **`client/src/hooks/use-auth.ts`**: The `useAuth()` hook tracks `rewardClaimed: boolean` in its `AuthState` interface (line 9) and has a `markRewardClaimed` callback (line 107). Either remove `rewardClaimed` from the auth state entirely, or ignore it. The old `POST /api/auth/claim-reward` endpoint can be removed from `server/routes.ts` (lines 121-131).

- **`client/src/pages/noise-tutorial.tsx`** lines 379-387: `NoiseTutorialShell` passes `rewardClaimed={auth.rewardClaimed}` as a prop to `InteractiveQuiz`. Remove this prop or ignore it.

- **`InteractiveQuiz` component** (line 845): Receives `rewardClaimed` as a prop. The claim button (line 952) renders conditionally with `!rewardClaimed`. Remove this gating so the button always shows when `passed && !showReward`. Users should be able to claim rewards each time they pass the quiz.

### New dependency needed:

Install `qrcode.react` for client-side QR rendering:
```bash
npm install qrcode.react
```

**Note**: The backend already has the `qrcode` npm package and `bech32` package installed — do NOT reinstall them.

## Step 5: Configuration

Use Replit Secrets for these environment variables:
- `LEXE_CLIENT_CREDENTIALS` — the Lexe wallet credentials (I'll provide this)
- `ADMIN_PASSWORD` — password for the admin endpoint
- `REWARD_AMOUNT_SATS` — reward per correct answer (default: 21)

The following are already configured and should not be changed:
- `DATABASE_URL` — PostgreSQL connection (already set)
- `PORT` — 5000 (already set in `.replit`)

For the LNURL callback URLs, use `getBaseUrl(req)` which already exists in `server/routes.ts` (line 20) — it reads `x-forwarded-proto` and `x-forwarded-host` headers to construct the correct public HTTPS URL on Replit.

## Important Notes

- All LNURL amounts are in **millisatoshis**. 21 sats = 21000 millisats.
- The `callback` URL in the LNURL-withdraw response MUST be HTTPS (Replit provides this automatically).
- Each k1 must be single-use and should expire after 5 minutes.
- The Lexe `pay_invoice` response format is `{"index": "<payment_index_string>", "created_at": <timestamp_ms>}`. Store the `index` for tracking. You can check payment status via `GET http://localhost:5393/v2/node/payment?index=<index>`.
- The Lexe `node_info` response includes several balance fields (all in sats as strings): `balance` (total), `lightning_balance`, `lightning_sendable_balance`, `onchain_balance`. Use `lightning_sendable_balance` to check if you have enough to pay a reward before generating QR codes.
- Handle errors gracefully — if the Lexe node is out of balance, show a friendly message on the frontend.
- **Do NOT create a separate quiz page.** The quiz already exists at the `/noise-tutorial/quiz` route.
- **Do NOT create a separate login/auth system.** Auth already works with email/password and LNURL-auth.
- **Do NOT switch to Python, Flask, or SQLite.** This is a TypeScript/Express/PostgreSQL app.
- **Do NOT change the port.** The app must stay on port 5000.
- The app uses ES modules (`"type": "module"` in package.json) — use `import` not `require`.
- Use `drizzle-kit push` (via `npm run db:push`) to apply schema changes, not raw SQL.

## Existing Files You Will Modify

| File | What to change |
|---|---|
| `shared/schema.ts` | Add `lnurlWithdrawals` table |
| `server/storage.ts` | Add withdrawal CRUD methods to `DatabaseStorage` class and `IStorage` interface |
| `server/routes.ts` | Add LNURL-withdraw endpoints, remove old `/api/auth/claim-reward` endpoint |
| `client/src/pages/noise-tutorial.tsx` | Update `InteractiveQuiz` component: real QR, polling, countdown, remove `rewardClaimed` gating |
| `client/src/hooks/use-auth.ts` | Remove or ignore `rewardClaimed` boolean and `markRewardClaimed` callback |
| `.replit` | Add Lexe Sidecar workflow, update deployment run command |
| `package.json` | Add `qrcode.react` dependency |

## Existing Code You Can Reuse

- `generateK1()` in `server/routes.ts` — generates 32-byte random hex (same format needed for LNURL-withdraw k1)
- `encodeLnurl()` in `server/routes.ts` — bech32-encodes a URL into an `lnurl1...` string
- `getBaseUrl()` in `server/routes.ts` — gets the public HTTPS base URL
- `getAuthUser()` in `server/routes.ts` — extracts authenticated user from Bearer token
- `storage` object in `server/storage.ts` — database access layer, add new methods here
- `qrcode` package (already installed) — for server-side QR generation if needed
- `bech32` package (already installed) — for LNURL encoding

Don't ask for permission, just start building. Begin by setting up the Lexe Sidecar, then build the backend (schema → storage → routes), then update the frontend. Don't stop until the full flow works end-to-end.
