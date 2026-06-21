# Onion Routing Course — Technical-Accuracy Audit (2026-06-21)

Review-only audit of the Course 2 (onion routing / BOLT 4 / Sphinx) content against the BOLT primary sources and official test vectors. **No course files were modified by the audit.**

## Files in this folder

| File | What it is |
|---|---|
| `FINAL_REPORT.md` | The full report: 60 distinct issues grouped by severity, + secondary wording notes, + coverage appendix, + acceptable-simplifications appendix. Start here. |
| `CHECKLIST.md` | One-line-per-issue fix list, addressable by ID (C1, H1, M1, L1…). Use to request fixes. |
| `CLAIMS_LEDGER.md` | **Full Phase-1 claim inventory** — every one of the 1,100 atomic claims with verdict + BOLT evidence, grouped by unit. The fast path for re-verification. |
| `data/claims-ledger.json` | Same 1,100 claims, machine-readable (fields: `cid, location, quote, category, verdict, severity, evidence, correctVersion, needsAdversarialCheck`), keyed by unit. |
| `data/findings.json` | The 71 flagged problems, machine-readable (the subset a fixer/verifier cares about). |
| `independent-findings.md` | The main agent's own spot-check ground truth (route math, CLTV inversion, checkpoint cluster) used to validate the agent fleet. |

## How a future agent should re-verify (fast path)

1. **Don't re-audit from scratch** — load `data/claims-ledger.json`.
2. **Re-locate each claim by its `quote`, not its `location`.** Line numbers drift as the code changes; the quoted text is the durable anchor.
3. Re-check only what changed: diff the current course text against the `quote`s; for any changed claim, re-verify against the BOLT source cited in its `evidence`.
4. The 71 entries in `data/findings.json` are the actionable set; everything else in the ledger was assessed Correct or an Acceptable simplification.

## Verdict caveats

- Ledger verdicts are the **Phase-1 first-pass** assessment. The 71 problems were then adversarially re-verified; **8 were cleared as false positives** (marked `⚠ CLEARED` in `CLAIMS_LEDGER.md`). The adjudicated list is in `FINAL_REPORT.md` §3–4.
- Counts across all 1,100 claims: **957 Correct · 35 Incorrect · 33 Misleading · 3 Unverifiable · 72 Acceptable-simplification.**

## Primary sources (not committed — public + large; fetch on demand)

All citations reference these files, fetched 2026-06-21 from `github.com/lightning/bolts` (master). Run `./fetch-specs.sh` to recreate them under `/tmp/onion-audit/`, or fetch individually:

| Local name | URL |
|---|---|
| `bolt04.md` | https://raw.githubusercontent.com/lightning/bolts/master/04-onion-routing.md |
| `bolt07.md` | https://raw.githubusercontent.com/lightning/bolts/master/07-routing-gossip.md |
| `01-messaging.md` | https://raw.githubusercontent.com/lightning/bolts/master/01-messaging.md |
| `02-peer-protocol.md` | https://raw.githubusercontent.com/lightning/bolts/master/02-peer-protocol.md |
| `03-transactions.md` | https://raw.githubusercontent.com/lightning/bolts/master/03-transactions.md |
| `onion-test.json` | https://raw.githubusercontent.com/lightning/bolts/master/bolt04/onion-test.json |
| `onion-error-test.json` | https://raw.githubusercontent.com/lightning/bolts/master/bolt04/onion-error-test.json |

> Note: `master` moves. If a citation's line numbers no longer match, the BOLT text was revised — re-read the section, don't assume the course is wrong.

## Method (for provenance)

Two-phase: (1) ~76 per-unit auditors extracted every claim + a first-pass verdict against the staged specs; (2) one independent skeptic per flagged finding tried to refute it; cross-cutting agents checked answer-key equality, route-number drift, packet-byte drift, and terminology. 100% unit coverage (13 chapters, 38 visuals, 9 exercises, 24 checkpoints, glossary, snippets, 4 cross-cutting). Three exercises were executed in Python against the official vectors; the build-packet chain reproduces the official onion vector byte-for-byte.
