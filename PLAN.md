# Noise Protocol Coding Exercises — Implementation Plan

## Overview
Add 10 in-browser Python coding exercises to the noise tutorial, following the same embedding pattern as checkpoint questions (`<code-exercise id="...">` tags in markdown → React component). Students write Python in a CodeMirror editor, run it via Pyodide (Python-in-WebAssembly), and see automated test results. Passing all tests triggers a sat reward.

All work on a new branch: `feature/noise-coding-exercises`

---

## Architecture

### In-Browser Python Stack
- **Pyodide** (v0.27+): Python interpreter compiled to WebAssembly. Runs entirely client-side, no backend needed. Supports `hashlib`, `hmac`, `struct` out of the box. For crypto (`x25519`, `chacha20poly1305`), we install the `cryptography` package via Pyodide's micropip.
- **CodeMirror 6** (`@codemirror/view`, `@codemirror/lang-python`): Lightweight code editor with Python syntax highlighting, bracket matching, and indentation.

### Embedding Pattern (same as checkpoints)
1. Markdown files contain `<code-exercise id="generate-keypair"></code-exercise>`
2. `rehype-raw` passes the tag through to React
3. `react-markdown`'s `components` prop maps `"code-exercise"` → `<CodeExercise />` component
4. Exercise data (starter code, tests, hints, solution) lives in a constant `CODE_EXERCISES` in `noise-tutorial.tsx`

---

## New Files

### 1. `client/src/components/CodeExercise.tsx`
The main exercise component. Contains:
- **CodeMirror editor** with Python starter code (function stub + comments)
- **"Run Tests" button** that executes the student's code + test suite in Pyodide
- **Test results panel** showing pass/fail for each test case with descriptive names
- **Collapsible hints** (3 tiers: conceptual → step-by-step → code snippet), same `<details>` style as the Lightning tutorial
- **Sat reward UI** (reuse the same claim flow as CheckpointQuestion) triggered on all tests passing
- **"Reset Code" button** to restore the starter code

State: editor content stored in localStorage per exercise ID so students don't lose work.

### 2. `client/src/lib/pyodide-runner.ts`
Manages the Pyodide runtime:
- Lazy-loads Pyodide on first exercise interaction (don't block page load)
- Installs `cryptography` package via micropip on first load
- Exposes `runPythonTests(studentCode: string, testCode: string): Promise<TestResult[]>`
- Runs code in a Web Worker to avoid blocking UI
- Returns structured results: `{ name: string, passed: boolean, message: string }[]`

### 3. `client/src/workers/pyodide-worker.ts` (Web Worker)
- Loads Pyodide in a Web Worker thread
- Receives messages: `{ type: 'run', studentCode, testCode }`
- Returns: `{ type: 'result', results: TestResult[] }` or `{ type: 'error', message }`
- Timeout protection (30s max per run)

---

## Modified Files

### 4. `client/src/pages/noise-tutorial.tsx`
- Add `CODE_EXERCISES` constant (parallel to `CHECKPOINT_QUESTIONS`) containing all 10 exercises
- Add `"code-exercise"` to the `components` prop in the ReactMarkdown renderer
- Track completed exercises in state (same pattern as `completedCheckpoints`)

### 5. Markdown files — add `<code-exercise>` tags
- `1.4-crypto-review.md` — Exercises 1, 2, 3 (generate_keypair, ecdh, hkdf)
- `1.6-noise-setup.md` — Exercise 4 (initialize_handshake_state)
- `1.7-noise-act-1.md` — Exercises 5, 6 (act_one_initiator, act_one_responder)
- `1.8-noise-act-2.md` — Exercises 7, 8 (act_two_responder, act_two_initiator)
- `1.9-noise-act-3.md` — Exercise 9 (act_three_initiator)
- `1.10-sending-messages.md` — Exercise 10 (encrypt_message / decrypt_message)

### 6. `package.json`
- Add: `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-python`, `@codemirror/theme-one-dark`
- Pyodide loaded from CDN (no npm package needed)

---

## The 10 Exercises

### Chapter 1.4 — Crypto Primitives

**Exercise 1: `generate_keypair()`**
- Student implements X25519 keypair generation using `cryptography` library
- Returns `(private_key_bytes, public_key_bytes)` as 32-byte values
- Tests: verify key lengths, verify public key derivation from private key, verify two calls produce different keys

**Exercise 2: `ecdh(local_private_key, remote_public_key)`**
- Perform X25519 key exchange, return 32-byte shared secret
- Tests: verify shared secret matches when computed from both sides (Alice computes with Bob's pubkey = Bob computes with Alice's pubkey), verify output length, verify determinism

**Exercise 3: `hkdf_two_keys(salt, input_key_material)`**
- Implement HKDF-SHA256 extract-then-expand producing exactly 2 × 32-byte keys
- Student uses `hmac` and `hashlib` (no high-level HKDF wrapper)
- Tests: verify against BOLT 8 test vectors, verify output lengths, verify different salts produce different keys

### Chapter 1.6 — Handshake Setup

**Exercise 4: `initialize_symmetric_state(protocol_name)`**
- Initialize `h` (handshake hash) and `ck` (chaining key) from protocol name string
- If len(protocol_name) ≤ 32: h = name padded with zeros; else: h = SHA256(name)
- Set ck = h. Mix in prologue and responder's static public key via MixHash.
- Tests: verify against BOLT 8 test vectors for `"Noise_XK_secp256k1_ChaChaPoly_SHA256"`

### Chapter 1.7 — Act 1

**Exercise 5: `act_one_initiator(h, ck, e_priv, e_pub, rs_pub)`**
- Mix ephemeral public key into h, perform ECDH(e, rs), derive temp_k via HKDF, encrypt empty payload with ChaChaPoly
- Returns: (act1_message, updated_h, updated_ck)
- Tests: verify against BOLT 8 Act 1 test vectors

**Exercise 6: `act_one_responder(h, ck, s_priv, act1_message)`**
- Parse message, extract remote ephemeral key, perform ECDH(s, re), derive temp_k, decrypt and verify MAC
- Returns: (re_pub, updated_h, updated_ck)
- Tests: verify it correctly processes Act 1 from Exercise 5, verify bad MAC is rejected

### Chapter 1.8 — Act 2

**Exercise 7: `act_two_responder(h, ck, e_priv, e_pub, re_pub)`**
- Mix ephemeral key, perform ECDH(e, re) (ee), derive temp_k, encrypt empty payload
- Returns: (act2_message, updated_h, updated_ck)
- Tests: verify against BOLT 8 Act 2 test vectors

**Exercise 8: `act_two_initiator(h, ck, e_priv, act2_message)`**
- Parse message, extract responder ephemeral, perform ECDH(e, re), derive temp_k, decrypt and verify
- Returns: (re_pub, updated_h, updated_ck)
- Tests: verify processes Act 2 correctly, verify bad MAC rejected

### Chapter 1.9 — Act 3

**Exercise 9: `act_three_initiator(h, ck, s_priv, s_pub, re_pub)`**
- Encrypt static public key with temp_k2 (nonce=1), perform ECDH(s, re), derive final transport keys via Split()
- Returns: (act3_message, send_key, recv_key)
- Tests: verify against BOLT 8 Act 3 test vectors, verify transport keys match expected values

### Chapter 1.10 — Sending Messages

**Exercise 10: `encrypt_message(key, nonce, plaintext)` + `decrypt_message(key, nonce, ciphertext)`**
- Encrypt: 2-byte length prefix (encrypted) + encrypted body, both with ChaChaPoly
- Decrypt: reverse the process
- Tests: round-trip a message, verify against BOLT 8 message test vectors, verify nonce increments

---

## Exercise Data Structure

```typescript
interface CodeExercise {
  id: string;
  title: string;
  description: string;           // Brief context shown above the editor
  starterCode: string;           // Python function stub with comments
  testCode: string;              // Python test suite (hidden from student)
  hints: {
    conceptual: string;          // "What this exercise is about"
    steps: string;               // Step-by-step pseudocode
    code: string;                // Near-complete code snippet
  };
  rewardSats: number;            // Sat reward for passing all tests
}
```

---

## Implementation Order

1. Create branch `feature/noise-coding-exercises`
2. Install npm dependencies (CodeMirror packages)
3. Build `pyodide-worker.ts` + `pyodide-runner.ts` (Python execution layer)
4. Build `CodeExercise.tsx` component (editor + test runner + hints + rewards)
5. Wire into `noise-tutorial.tsx` (add component mapping + exercise data)
6. Write all 10 exercises (starter code, test suites, hints)
7. Add `<code-exercise>` tags to markdown files
8. Test end-to-end: load page → write code → run tests → see results → claim sats
