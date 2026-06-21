# Independent ground-truth findings (main agent, to reconcile vs workflow)

## Confirmed
1. **[HIGH/CRITICAL] Hazel feePpm drift 3000 vs 2000.**
   - ForwarderPolicyMap.tsx:112 → Hazel→Dave feePpm:3000 (base100, cltv1000)
   - RouteComparisonDiagram.tsx:43 → Hazel feePpm:2000, total fee 900, htlcAmounts [400_900,400_000]
   - With ppm3000: fee = 100+floor(400000*3000/1e6)=1300 → Route A (1300) > Route C (1225), so "Route A is cheapest" (cp-cheapest-route-draft:392 explanation, RouteComparisonDiagram.tsx:34-63 subtitle "900 sat fee the cheapest") becomes FALSE. Intended ppm = 2000.

2. **[MEDIUM] Packet-size conflation in checkpoint explanation.**
   - onion-routing-tutorial.tsx:356 (cp-naive-shared-secrets-draft explanation): "The BOLT 4 onion packet is fixed at 1300 bytes total" — packet is 1366 bytes; 1300 is the hop_payloads region. Conflates the two canonical numbers.

## Verified CORRECT (ground truth for cross-check)
- Route C fee=1225 (Charlie410+Bob815), CLTV total delta 53 (18+20+15). Matches cp-cheapest-route + policy map (Bob base15/ppm2000/cltv20; Charlie base10/ppm1000/cltv15).
- Route B fee=2002 (Greg1000+Frank1002), CLTV total 60 (18+22+20). Matches (Frank base200/ppm2000/cltv22; Greg base200/ppm2000/cltv20).
- All 24 checkpoint server keys == inline answers (eyeballed). km-privacy-rubric-draft=0 is a KnowledgeMatrix rubric (no inline question).
- All 24 checkpoint marked answers cryptographically sound, incl. cp-payload-shrink-leak-draft=[0] (downstream-only inference correct; upstream NOT inferable).
- RouteComparisonDiagram.tsx:35 "1,018-block CLTV delta" vs :58 "150+18+1000=1168": 1018=delta (excl height 150), 1168=absolute timeout height. Both legit, but potentially confusing. Course treats total delta = 18(final)+sum(forwarder deltas), consistently (53, 60, 1018).
- RouteComparisonDiagram.tsx:15 stale comment "Route A · direct via Bob" (route is via Hazel). Low.

## Additionally confirmed by main agent (post-workflow)
3. **[CRITICAL] CltvSafetyLab inverted CLTV ordering.** UI setters (CltvSafetyLab.tsx:264-287, 350 minExpiry={expiryAB}, 361 minExpiry={expiryBC}) clamp expiryAB≤expiryBC≤expiryCD, but the lab's own simulate() (lines 80-85) and BOLT4 (bolt04.md:322,337,1499-1503) require expiryAB>expiryBC>expiryCD. Success state unreachable. Agent CltvSafetyLab C1-C4 (skepticAgreed=True) correct.
4. **[HIGH] ch11 fabricated test vector.** 11.0-error-onion.md:40 "the spec's own test vector pads to 1,024 bytes, making a 1,060-byte packet" — onion-error-test.json pads failure_len+pad_len to 256 (260 payload + 32 HMAC = 292-byte packet). No 1024/1060 in BOLT4. Confirmed.
5. **[HIGH] ErrorUnwrapDiagram offset.** ErrorUnwrapDiagram.tsx:53 beat 3 "The first two bytes are a u16 giving failure_len" — first 32 bytes are the HMAC; failure_len is at peeled[32:34] (chapter md:101 correct). Caption omits the 32-byte HMAC offset. Confirmed.
