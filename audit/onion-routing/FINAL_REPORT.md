# Technical-Accuracy Audit — Onion Routing (BOLT 4 / Sphinx) Course
**Final report · REVIEW ONLY (no fixes applied) · 2026-06-21**

## 1. Executive summary

A full-coverage technical-accuracy pass over the 13-chapter onion-routing course (38 visuals, 9 exercises, 24 checkpoints, glossary, and snippet registry) flagged 71 candidate findings against the staged BOLT 1/2/3/4/7 primary sources and the published Sphinx/onion/error test vectors. An independent skeptic re-verified every finding by attempting to refute it. After re-verification, **63 findings stand as genuine defects and 8 are cleared as false positives** (the original 71 collapse to 60 distinct issues after de-duplicating the same-root Hazel `feePpm` drift, the `CltvSafetyLab` inverted-constraint cluster, and the two ForwarderPolicyMap stale-comment hits). The single highest-impact cluster is the **`CltvSafetyLab` interactive (4 findings, idx 20–23): its CLTV ordering constraint is inverted, so the "safe" outcome the lab exists to teach is literally unreachable through the UI.** The other Critical/High items are a cross-surface fee-drift (`Hazel→Dave feePpm 3000` vs the course-wide `900 sat` Route A), a false "pads to 1,024 bytes" claim in the error-onion chapter, a garbled HTLC witness script, a reversed error-onion authenticate/encrypt ordering, an HMAC byte-offset error in the error-decode caption, and a capstone buffer view whose hardcoded hop sizes contradict the live trace. Everything else is Low-severity prose typos, terminology drift (`slice` vs `hop payload`), stale code comments, and tooltip wording. No checkpoint answer-key, glossary, or exercise ground-truth error was found; the cryptography in the exercise reference solutions reproduces the official BOLT 4 vectors exactly.

## 2. Counts

From `counts.json` (per-claim verdicts across all audited claims):

| Verdict | Count |
|---|---|
| Correct | 957 |
| Incorrect | 35 |
| Misleading | 33 |
| Unverifiable | 3 |
| Acceptable simplification | 72 |

**Flagged-finding disposition after skeptic re-verification:** of the **71** originally-flagged findings, **63 survived** as genuine problems and **8 were cleared** as false positives (idx 11, 28, 33, 39, 41, 46, 54, 55). After merging same-root duplicates (Hazel `feePpm` = idx 17 + 64 + 66; the two ForwarderPolicyMap stale comments = idx 19 + 70), the report below lists **60 distinct issues**.

---

## 3. Findings by severity

### CRITICAL

---
**[idx 20] CRITICAL**
Claim (quoted): *"Setters enforce the constraint expiryAB ≤ expiryBC ≤ expiryCD: as you move left-to-right across the cards, expiries can only go up. Lower values are clamped to the previous card's value."*
Location(s): `client/src/components/onion-routing-draft/CltvSafetyLab.tsx:264-287` (constraint comment + setters; rendered lab in ch 4-context CLTV-safety beat)
Category: formula
Verdict: Incorrect
Evidence: BOLT 4 `bolt04.md:1499-1500` — *"if the incoming `cltv_expiry` minus the `outgoing_cltv_value` is below the `cltv_expiry_delta` … return an `incorrect_cltv_expiry` error"* ⇒ upstream expiry must EXCEED downstream, so `expiryAB > expiryBC > expiryCD`. The component's own `simulate()` agrees: at defaults (all 140) `daveRevealsAt=139`, `charlieClaimsBobAt=140`, `charlieClaimSucceeds=(140<140)=false`. Clamps at lines 278/284 force `expiryBC≥expiryAB` and `expiryCD≥expiryBC`, making the success precondition unreachable through the UI.
Correct version: Invert to `expiryAB ≥ expiryBC ≥ expiryCD` (sender-side HTLC largest; expiries decrease toward the destination). Comment should read "as you move left-to-right, expiries can only go DOWN; higher values are clamped to the previous card's value."
Recommended fix: Flip every clamp from a lower to an upper bound and reverse the cascade. `handleSetExpiryBC`: `Math.min(expiryAB, …)`; `handleSetExpiryCD`: `Math.min(expiryBC, …)`; `handleSetExpiryAB` cascades DOWN (lower BC/CD if they exceed AB). Turn the `minExpiry` props at lines 350/361 into max bounds and update the input min/max/title text and the lines 264–266 comment. (Fix together with idx 21/22/23 — same root.)

---
**[idx 17 · 64 · 66 — merged] CRITICAL**
Claim (quoted): *Hazel→Dave `feePpm: 3000`* (should be `2000`)
Location(s): `client/src/components/onion-routing-draft/ForwarderPolicyMap.tsx:112` — the policy is rendered to the student via `ChannelUpdateCard` (`ForwarderPolicyMap.tsx:969-974`, `ChannelUpdateCard.tsx:74`). Both diagrams appear in `2.0-pathfinding-101.md` (forwarder-policy-map line 29, route-comparison line 82). Cross-surfaces that depend on the 900-sat figure: `RouteComparisonDiagram.tsx:35,43,53-54,63`, `RouteCalcExercise.tsx:899`, checkpoint `cp-cheapest-route-draft` (`onion-routing-tutorial.tsx:392`). Cross-audit unit `drift-routes` independently flagged the same conflict.
Category: consistency (numeric)
Verdict: Incorrect
Evidence: BOLT 7 fee formula `bolt07.md:981` — `fee_base_msat + (amount_to_forward * fee_proportional_millionths / 1000000)`. On 400,000 sat: `feePpm 2000 → 100 + 800 = 900 sat` (matches every other surface); `feePpm 3000 → 100 + 1200 = 1300 sat`, which breaks the "Route A is the cheapest at 900 sats" lesson and the `cp-cheapest-route-draft` checkpoint. `ForwarderPolicyMap.tsx:100-101` comment: *"These exact values must align with the route comparison below the map."*
Correct version: `{ from: "hazel", to: "dave", baseFee: 100, feePpm: 2000, cltvDelta: 1000 }`
Recommended fix: Change `feePpm: 3000 → 2000` on `ForwarderPolicyMap.tsx:112`. `baseFee:100` and `cltvDelta:1000` already align; no other field changes.

---

### HIGH

---
**[idx 21 · 22 · 23 — CltvSafetyLab inverted-constraint cluster (same root as idx 20)] HIGH**
Claim (quoted): idx 21 `// Cascade upward: BC and CD may need to rise to keep BC ≥ AB and CD ≥ BC`; idx 22 `minExpiry={expiryAB}`; idx 23 `minExpiry={expiryBC}`
Location(s): `CltvSafetyLab.tsx:270` (idx 21), `:350` (idx 22), `:361` (idx 23)
Category: formula
Verdict: Incorrect
Evidence: BOLT 4 `bolt04.md:1499-1503` / `:1353` (`cltv_expiry - cltv_expiry_delta >= outgoing_cltv_value`) ⇒ `AB > BC > CD`. Brute force over `simulate()` under the enforced `AB ≤ BC ≤ CD` yields **0** safe configurations; under the correct `AB > BC > CD` there are 34,220 (e.g. 103/102/101). `sim(160,150,140)=(success,success)` is blocked by the UI; `sim(140,150,160)` (UI-allowed) `=(fail,fail)`.
Correct version: B→C card min should be tied to its DOWNSTREAM neighbor `expiryCD` (idx 22 → `minExpiry={expiryCD}`); C→D card floor should be `MIN_EXPIRY` (idx 23); the cascade comment (idx 21) should read "Cascade downward: BC and CD may need to FALL to keep AB ≥ BC and BC ≥ CD."
Recommended fix: Part of the idx-20 inversion — fix all four together: flip clamps to upper bounds, retarget `minExpiry` props to downstream neighbors / `MIN_EXPIRY`, reverse the setter cascade direction, and rewrite the comment and tooltip text (lines 264-266, 670).

---
**[idx 14] HIGH**
Claim (quoted): *"what about failure messages bigger than 256 bytes… Those get padded to a bigger fixed total instead. In fact, the spec's own test vector pads to 1,024 bytes, making a 1,060-byte packet!"*
Location(s): `client/public/onion_routing_tutorial/11.0-error-onion.md:40`
Category: formula (numeric)
Verdict: Incorrect
Evidence: BOLT 4 `bolt04.md:1134-1136` mandates only `failure_len + pad_len >= 256` (SHOULD be exactly 256); there is no larger fixed total. The spec's own error test vector (`onion-error-test.json` `generate.hops[4].payload`) parses to `failure_len=2, pad_len=254` (sum 256), payload region 260 bytes, return packet 292 bytes (32-byte HMAC + 260). No `1024`/`1060` byte size exists anywhere in `bolt04.md` or `onion-error-test.json`.
Correct version: BOLT 4 requires only `failure_len + pad_len >= 256` (SHOULD == 256). A message longer than ~256 bytes simply shrinks `pad_len` toward 0 while keeping the sum ≥ 256, so the packet grows with the message; there is no fixed 1,024-byte size.
Recommended fix: Delete the two false sentences and replace with: "For failure messages longer than 256 bytes, `pad_len` shrinks toward zero while keeping `failure_len + pad_len` at least 256, so the packet grows with the message; there is no larger fixed size."

---
**[idx 11] HIGH**
Claim (quoted): *"Above the channel minimum (amount_below_minimum). amt_to_forward must be at least the outgoing channel's htlc_minimum_msat. Whose minimum? Charlie's"*
Location(s): `client/public/onion_routing_tutorial/10.0-forwarding-validation.md:41`
Category: code
Verdict: **CORRECT (cleared on re-verification — see §4).** The skeptic refuted the first pass: BOLT 7 `bolt07.md:522-523` defines `htlc_minimum_msat` as *"the minimum HTLC value … that the channel peer will accept"* (Charlie's), confirming the chapter text. *Moved to Cleared subsection; listed here only to mark the severity downgrade from the original High flag.*

---
**[idx 50] HIGH**
Claim (quoted): *"The first two bytes are a u16 giving `failure_len`, and the next `failure_len` bytes are the failure message itself."*
Location(s): `client/src/components/onion-routing-draft/ErrorUnwrapDiagram.tsx:53` (CAPTIONS[3], decoded-packet beat)
Category: code (numeric)
Verdict: Incorrect
Evidence: BOLT 4 `bolt04.md:1057-1063` — return packet is `[32*byte:hmac][u16:failure_len][failuremsg]…`; the HMAC is the FIRST 32 bytes and `failure_len` is the u16 at offset 32 (bytes 32:34). The diagram's own byte ruler (`errorOnionShared.tsx:530-557`) puts the 32-byte HMAC cell first, and the paired markdown (`11.0-error-onion.md:101`) parses the length prefix at `peeled[32:34]`. The caption mislocates the u16 at offset 0, inside the HMAC.
Correct version: "The leading 32 bytes are the HMAC you just verified. The next two bytes (a u16 at offset 32) give `failure_len`, and the following `failure_len` bytes are the failure message itself."
Recommended fix: In `CAPTIONS[3]` (line 53) prepend the HMAC clause and move the u16 to "offset 32," aligning with BOLT 4, the diagram's own ruler/earlier steps, and the chapter markdown.

---
**[idx 51 · 53 — CapstoneStage hardcoded hop-size cluster (same root)] HIGH**
Claim (quoted): `HOP_BYTES = {bob:60, charlie:80, dave:100}` / `HOP_LEN_HEX = {0x1B, 0x2F, 0x43}` rendered in the subcell directly above the trace-derived `byteLabel` row
Location(s): `client/src/components/onion-routing-draft/CapstoneStage.tsx:29-31` (constants), `:107,111-112` (subcell render) vs `:152` (`byteLabel` row driven by the live trace)
Category: consistency (numeric)
Verdict: Incorrect
Evidence: The live trace `PAYLOADS` (`onion-capstone-trace.ts:223-227`) are 26/26/50-byte TLV streams, so real sizes are Bob 59 B / Charlie 59 B / Dave 83 B with LEN `0x1A/0x1A/0x32` (`trace.ts:310` `size = len(payload)+32`; `scenes.ts:153` `B={bob:59,charlie:59,dave:83}`). The hardcoded canonical 60/80/100 (`0x1B/0x2F/0x43`) print in the subcell while `seg.byteLabel` prints 59/59/83 directly beneath — a visible self-contradiction in the same bar. Both are individually BOLT-valid (`bolt04.md:99-100, :801`); the defect is that the capstone shows both at once.
Correct version: Drive the subcell from the same trace-derived size the `byteLabel` row uses: Bob 59 B / Charlie 59 B / Dave 83 B with LEN `0x1A/0x1A/0x32`.
Recommended fix: Thread `seg.bytes = B[hop]` onto each payload `BufferSegment` in `scenes.ts` (~`:159-160`), render `${HOP_LABEL[hop]} · ${seg.bytes} B` in `SegmentBody` (`CapstoneStage.tsx:107`), derive `lenHex` from `seg.bytes - 33`, and delete the now-unused `HOP_BYTES`/`HOP_LEN_HEX` constants. (Keep `HOP_HMAC_TARGET` — correct.) Alternative: pad the trace TLVs to exactly 60/80/100 B.

---

### MEDIUM

---
**[idx 4 · 65 — same line, merged] MEDIUM**
Claim (quoted): *"Of those 2,600 bytes, the first 1,360 (the original 1,300 plus the 60 new bytes at the back) are what Bob forwards to Charlie."*
Location(s): `client/public/onion_routing_tutorial/7.0-fixed-size-and-filler.md:64`
Category: numeric
Verdict: Incorrect (idx 65 skeptic; supersedes idx 4's "Misleading")
Evidence: BOLT 4 `bolt04.md:960` — forwarded `hop_payloads` is *"truncated to the incoming hop_payloads size"* = 1,300, not 1,360. `bolt04.md:949` — Bob's own 60 bytes are removed from the FRONT (not forwarded). Same file contradicts line 64: line 54 *"the next 1,366-byte packet"*, line 77 *"the 1,300-byte payload area he forwards to Charlie"*. Siblings agree on 1,300: `PeelTraceDiagram.tsx:171`, `ForwarderPeelDiagram.tsx:114`. "First 1,360" wrongly re-includes Bob's own 60-byte payload.
Correct version: "After slicing off his own 60-byte hop payload at the front, bytes 60..1,360 (exactly 1,300 bytes — the same fixed `hop_payloads` size he received, now containing the shifted-forward downstream payloads plus the 60 new filler bytes at the back) are what Bob forwards to Charlie."
Recommended fix: Replace the "first 1,360 … are what Bob forwards" clause as above so it stops double-counting and re-including Bob's removed front payload.

---
**[idx 10] MEDIUM**
Claim (quoted): *"Bob only needs the first s_B of remaining keystream (~60 in our example), he will discard the rest"*
Location(s): `client/public/onion_routing_tutorial/9.0-peeling.md:62`
Category: numeric
Verdict: Misleading (skeptic upgraded from first pass's Acceptable-simplification)
Evidence: BOLT 4 `:941` keystream is twice `hop_payloads` length; `:960` only the decrypted tail past 1,300 is truncated. Bob needs keystream across the entire `1,300 + s_B` region: beyond `s_B` it decrypts Charlie's `hop_payloads` (which Bob forwards) and regenerates the filler at positions 1,300..1,359. The course's own `7.0:77` and `9.0:79-80,64` contradict the literal claim. `s_B` is the size of Bob's own front payload (what he reads), not "the keystream he keeps."
Correct version: The first `s_B` bytes of the decrypted front (≈60) are Bob's own hop payload, which he reads. He still needs keystream across the whole `1,300 + s_B` region; what he discards is the decrypted-buffer tail past byte 1,300 (truncation back to 1,300).
Recommended fix: Rewrite line 62 to separate "Bob's own payload at the front (≈60 bytes, which he reads)" from "the full keystream he needs," and drop the misleading `<g>keystream</g>` anchor on "the first s_B."

---
**[idx 15] MEDIUM**
Claim (quoted): *"…a tighter CLTV of 220 (that's Bob's safety margin, so he can resolve A↔B before C↔D times out)."*
Location(s): `client/src/components/onion-routing-draft/HtlcPropagationDiagram.tsx:78` (`STEP_CAPTIONS[2]`, rendered caption; mounted ch 1.0)
Category: formula
Verdict: Incorrect
Evidence: BOLT 2 `02-peer-protocol.md:2627-2629` — Bob's risk is between his INCOMING (A↔B) and OUTGOING (B↔C) channels; `:2641-2642` the outgoing channel's delta is "the delta across a node." Bob's outgoing channel is B↔C (CLTV 220), not C↔D (180). CHANNELS data (`:121,136,151`): A↔B=240, B↔C=220, C↔D=180; margin = 240−220 = 20. C↔D is Charlie's outgoing channel.
Correct version: "…so he can resolve A↔B before **B↔C** times out."
Recommended fix: In `STEP_CAPTIONS[2]` change "before C↔D times out" to "before B↔C times out."

---
**[idx 16] MEDIUM**
Claim (quoted): HTLC witness scripts using `<RIPEMD160(remote_htlcpubkey)>` and a misplaced `<local_htlcpubkey>`
Location(s): `client/src/components/onion-routing-draft/HtlcPropagationDiagram.tsx:236-281` (`WITNESS_HTLC_OFFERED`/`WITNESS_HTLC_RECEIVED`; rendered verbatim by `WitnessScriptPanel`, `CommitmentTxCard.tsx:561-566,627`, on hover). *Note: the finding's location field names `CommitmentTxCard.tsx` but the buggy data lives in `HtlcPropagationDiagram.tsx`.*
Category: code
Verdict: Misleading
Evidence: BOLT 3 `03-transactions.md:204` (Offered) / `:256` (Received): first branch is `OP_DUP OP_HASH160 <RIPEMD160(SHA256(revocationpubkey))> OP_EQUAL`; the unhashed `<remote_htlcpubkey>` belongs to the second branch (`:208/:260`, before `OP_SWAP OP_SIZE 32 OP_EQUAL`). The repo renders `<RIPEMD160(remote_htlcpubkey)>` (wrong key, missing SHA256) in branch 1 and `<local_htlcpubkey>` where branch 2 needs `<remote_htlcpubkey>` — two garbled references.
Correct version: Branch-1 push → `<RIPEMD160(SHA256(revocationpubkey))>`; branch-2 key push → `<remote_htlcpubkey>` (unhashed). The `<local_htlcpubkey>` in the success sub-branch is correct and stays.
Recommended fix: Edit lines ~238/243 and ~260/265 in both arrays; re-check against BOLT 3 `03-transactions.md:200-218` (Offered) and `252-270` (Received).

---
**[idx 18] MEDIUM**
Claim (quoted): a `capacity` Row rendered as a field of `channel_announcement`
Location(s): `client/src/components/onion-routing-draft/ForwarderPolicyMap.tsx:264-269` (definition), `:836` (popover title), `:856-859` (rendered Row)
Category: consistency
Verdict: Misleading (skeptic upgraded from first pass's Acceptable-simplification)
Evidence: BOLT 7 `bolt07.md:155-168` enumerates `channel_announcement` — four signatures, `len`, `features`, `chain_hash`, `short_channel_id`, `node_id_1/2`, `bitcoin_key_1/2` — and has NO capacity field. `bolt07.md:142-145` confirms capacity is derived off-message by looking up the funding UTXO via `short_channel_id`. The popover invents `capacity` while omitting the four signatures and other real fields.
Correct version: Don't present capacity as a wire field; show the genuine fields, or keep capacity annotated "(derived from funding UTXO, not in the message)."
Recommended fix: Drop the capacity Row (`:856-859`) or annotate it as derived; optionally render the real `short_channel_id`/`node_id_1/2` fields so the box is a faithful subset.

---
**[idx 42] MEDIUM**
Claim (quoted): step order *"Encrypt the return error" (ammag)* before *"Authenticate the return error" (um)*
Location(s): `client/src/components/onion-routing-draft/OperationsLifecycleDiagram.tsx:322-355` (`STEPS[3]` ammag, `STEPS[4]` um, error path)
Category: crypto
Verdict: Incorrect
Evidence: BOLT 4 `bolt04.md:1066-1072` — the erring node FIRST computes the `um`-HMAC over the packet remainder, THEN generates `ammag` and XOR-encrypts the whole packet (MAC-then-encrypt). The course agrees (`11.0-error-onion.md:44-53`: Step 3 "Authenticate with um" → Step 5 "Wrap with ammag"). The diagram renders ammag (`hasTag:false`) before um (`hasTag:true, focus:hmac`), with the step-5 caption computing the tag "over the error packet" last — encrypt-then-MAC, the reverse of spec. (The forward path rho→mu is correctly encrypt-then-MAC.)
Correct version: Swap so `um`/"Authenticate" precedes `ammag`/"Encrypt": authenticate the plaintext 260-byte payload first, then XOR-encrypt the whole packet including the HMAC.
Recommended fix: Swap the two error-path step objects (carry `hasTag`/`focus` flags), update both captions, and adjust the `STEP_4_MS`/`STEP_5_MS` timing comments and `stepDurationMs` indices.

---
**[idx 43] MEDIUM**
Claim (quoted): *"Finally, Bob computes a 32-byte authentication tag … and tacks it on the back."* (error/`um` step)
Location(s): `client/src/components/onion-routing-draft/OperationsLifecycleDiagram.tsx:347-349` (caption + keyedCaption of the bob/error step)
Category: crypto (code)
Verdict: Incorrect
Evidence: BOLT 4 `bolt04.md:1059-1066` — the return packet's `hmac` is the FIRST field (offset 0); it authenticates "the remainder of the packet." Chapter `11.0-error-onion.md:47-48,77,95` says the HMAC is prepended (`error_hmac || payload`). The same file's forward step (`:301-303`, key `mu`) correctly says "on the back," and the file's own comment `:998` says "a FAIL record at the front" — so the error-step "back" is an inversion.
Correct version: "…computes a 32-byte authentication tag … and prepends it to the front (`error_hmac || payload`). Unlike the forward onion's trailing tag, the return error's HMAC goes at the front."
Recommended fix: Change "tacks it on the back" → "prepends it to the front" in both `caption` and `keyedCaption` at lines 347/349. Leave the forward-step strings (`:301/303`) unchanged.

---
**[idx 52] MEDIUM**
Claim (quoted): *"…re-derive its own secret from the single ephemeral key in the packet header."*
Location(s): `client/src/lib/onion-capstone-scenes.ts:303`
Category: crypto
Verdict: Misleading
Evidence: BOLT 4 `bolt04.md:730-741` — the ephemeral key is **blinded at each hop** so hops can't be linked; `:773-776` advances it per hop. The file's own labels (`E_LABEL = {bob:E_AB, charlie:E_AC, dave:E_AD}`, `:98`) and the two preceding scene captions (`:287,293`) teach the chain advancing, so each forwarder derives from a DIFFERENT ephemeral key value. "The single ephemeral key" fuses the single header FIELD with one shared key VALUE.
Correct version: "The packet header carries a single ephemeral-key field, but it is re-blinded at each hop, so every forwarder re-derives its own secret from a different ephemeral key in its own header (E_AB at Bob, E_AC at Charlie, E_AD at Dave)."
Recommended fix: At `:303` distinguish the single header field from its per-hop blinded value, e.g. "…re-derive its own secret from the ephemeral key in its own header — a different, blinded E at each hop."

---

### LOW

*Prose typos and grammar (chapters):*

**[idx 0] LOW** · `1.0-a-lightning-payment.md:18` · glossary · Incorrect · "immedie**e**ately" → "immediately". *Single misspelling; surrounding technical claim is correct.*

**[idx 2] LOW** · `4.0-shared-secrets.md:5` · glossary · Incorrect · "Noise Protoc**l**" → "Noise Protocol".

**[idx 5] LOW** · `7.0-fixed-size-and-filler.md:14` · glossary · Incorrect · "fi**z**ed-size" → "fixed-size".

**[idx 6] LOW** · `7.0-fixed-size-and-filler.md:48` · glossary · Incorrect · "theem" → "them".

**[idx 7] LOW** · `7.0-fixed-size-and-filler.md:58` · glossary · Incorrect · "does't" → "doesn't". *Underlying claim (forwarder learns its payload length only after decrypting) is correct per `bolt04.md:943`.*

**[idx 8] LOW** · `7.0-fixed-size-and-filler.md:66` · glossary · Incorrect · Ungrammatical "While … but". Drop "While": "The mechanism isn't a literal in-place shift, but the result is."

**[idx 9] LOW** · `7.0-fixed-size-and-filler.md:5` · glossary · Incorrect · "fills with **each** per-hop payloads" (number disagreement) → "fills with the per-hop payloads".

*Terminology drift — `slice` vs locked `hop payload` (Low; `slice` is NOT a banned term — `slot` is; the real issue is mixed usage within ch3/ch4):*

**[idx 3] LOW** · `4.0-shared-secrets.md:22` · glossary · Incorrect · "decrypt the slice meant for them" → "decrypt the hop payload meant for them" (line 46 of same chapter already uses "hop payload").

**[idx 28] LOW** · **Cleared — see §4.** *(Skeptic: ch3/ch4 naive-strawman "slice" is sanctioned vocabulary; Acceptable-simplification.)*

**[idx 67] LOW** · `EncryptedSliceReveal.tsx:105` + ch3/ch4 markdown (`3.0:47,53-55,65,74`; `4.0:22`) · glossary · Misleading · Mixed `slice`/`hop payload` for the same per-hop block within chs 3-4. *Note the audit's "slice is banned" rationale is wrong — `slot` is banned, `slice` is not.* Pick one noun for the pre-ch5 strawman and use it consistently.

**[idx 68] LOW** · `NaivePacketDiagram.tsx:107` (and `:108,109,110,581,698`) · glossary · Misleading · Same file renders BOTH "hop payload" and "slice" for the same block. Pick one (lowest-churn: "slice" throughout, matching its `EncryptedSliceReveal` anchor).

**[idx 69] LOW** · `NodeKeyAttemptDiagram.tsx:101,107,113` · glossary · Misleading · Rendered region labels "slice for bob/charlie/dave" while adjacent prose (`4.0:46`) uses "hop payload." Rename to the approved noun or keep "slice" consistently.

*Forwarding-validation chapter:*

**[idx 12] LOW** · `10.0-forwarding-validation.md:41` · code · Misleading · "when the channel was opened, Charlie set the smallest HTLC he'd accept" implies `htlc_minimum_msat` is fixed at channel-open. BOLT 7 `bolt07.md:433-434,517-518,522-523`: it's a revisable `channel_update` field. → "Charlie advertises the smallest HTLC he'll accept in his `channel_update` (and can revise it later)."

**[idx 13] LOW** · `10.0-forwarding-validation.md:45` · numeric · Unverifiable · "LDK fails back any HTLC within 39 blocks (~6.5 hours)…". The 34-block half checks out (BOLT 2 `02-peer-protocol.md:2690-2691`, `3R+2G+2S = 34`); `39×10min = 390min = 6.5h` is internally consistent but the LDK fail-back constant is not in any staged BOLT. Framed as an LDK implementation detail "for a sense of scale." Optional: cite the LDK source.

*Visuals — tooltip / caption / label:*

**[idx 25] LOW** · `PlaintextMessageTear.tsx:263-265` · crypto · Misleading · Shared tooltip "{label} already saw the **entire** payload" fires for Charlie too, but by the time Charlie reads, Bob's slice is already removed (`:105` `isRemoved("bob")` at step≥2; Charlie reads at step 3). The component's own `seenByAt()` never lists Charlie on Bob's slice. Make the tooltip per-hop: Charlie "saw the rest of the payload (his own slice plus Dave's) — not Bob's."

**[idx 26] LOW** · `PlaintextMessageTear.tsx:8-15` · crypto · Misleading · Dev comment claims the naive shrinking "matches BOLT 4 Sphinx behavior." Real Sphinx re-pads `hop_payloads` to a constant 1,300 bytes (`bolt04.md:976-977,984-985`) so the packet never shrinks — the opposite. Comment-only; rewrite to label it the naive model and note real Sphinx does the opposite.

**[idx 27] LOW** · `NodeKeyAttemptDiagram.tsx:309-312` · consistency · Misleading · `payment_hash` rendered as the first field inside a box titled `ONION_PACKET`. BOLT 4 `bolt04.md:155-160` (no payment_hash field) and `:756-760` (associated data is committed via HMAC but "not included in the packet itself"). Remove the row or relocate it labeled "HTLC associated data."

**[idx 29] LOW** · `BlindingFactorDiagram.tsx:63` · glossary · Misleading · The `·` tooltip "Multiplying a private number by G produces a public point" covers only one of three uses of the symbol (`e_AB·B` is ECDH vs a node pubkey; `bf_AB·e_AB` is scalar×scalar yielding a private scalar, per `bolt04.md:737-742,774`). Broaden the tooltip to all three cases; formulas/captions are correct.

**[idx 30] LOW** · `HmacChainDiagram.tsx:91` · crypto · Misleading · Title "Each HMAC commits to the layer beneath it" undercounts: HMAC is over the whole `hop_payloads || associated_data` (`bolt04.md:936,810-811`), including the hop's own entry. The same component's bracket label (`:183`) and ch5 md:86 already state the fuller scope. → "Each HMAC commits to its own payload and everything beneath."

**[idx 31] LOW** · `WrapPrimerDiagram.tsx:914-916` · formula · Incorrect · "single byte equal to (slot_size − 1)". LEN excludes the 1-byte prefix AND the 32-byte HMAC (`bolt04.md:99-100,:801`), so it's `slot_size − 33`. Rendered `SLOT_BIGSIZE_HEX` (`:646-648` = 0x1B/0x2F/0x43) already matches `−33`; the sibling comment `:643-644` is correct. → "(slot_size − 33)".

**[idx 34] LOW** · `WrapPrimerDiagram.tsx:914-915` · glossary · Misleading · Invented term "slot_inner_size" + "(slot_size − 1)" implies the LEN byte encodes `slot_size−1`; it encodes `slot_size−33`. Internal comment only; pairs with idx 31. Drop "slot_inner_size."

**[idx 32] LOW** · `WrapPrimerDiagram.tsx:169,187,191,784` · consistency · Misleading · Two `chacha20` arities for one operation: action panel `chacha20(rho, 0, 1300)` vs KeystreamXorRow `chacha20(rho, 1300)`. Both are spec-equivalent (`bolt04.md:84-85` null-nonce). Pick one convention across all five call sites (incl. comments at `:11,16`).

**[idx 35] LOW** · `PeelPrimerDiagram.tsx:1145,1156` · numeric · Misleading · "keystream · 1,300 B" / `chacha20(rho, 1300)` for the peel/decrypt step. Peel keystream is 2,600 B (`bolt04.md:941,984-986`). The course's own `ValidationFlowDiagram.tsx:552/568` uses `chacha20(rho_B, 2600)[:1300]`. Either match that convention or add a one-line "front 1,300 B of 2,600" caveat (ch5 primer deliberately shows a 1,300-byte buffer).

**[idx 36] LOW** · `XorEncryptionDemo.tsx:32-33,238-240` · consistency · Misleading · `SCID_BYTES = [0x00,0x0a,0xae,0x60,0x00,0x00,0x01,0x00]` decodes to `2734:6291456:256`, not `DEFAULT_SCID "700000:1:0"` (should be `[0x0a,0xae,0x60,0x00,0x00,0x01,0x00,0x00]`). Currently dead (the ref seed is overwritten at `:239` before read). Seed the ref from `parseSCID(DEFAULT_SCID).bytes` so they can't drift, or correct the literal.

**[idx 37] LOW** · `XorEncryptionDemo.tsx:973` (vs `:1187`) · consistency · Misleading · Decoded panel labels TLV type 4 `outgoing_cltv` while the input card uses `outgoing_cltv_value` (the BOLT 4 name, `bolt04.md:197,199`). → `name="outgoing_cltv_value"` at `:973`.

**[idx 38] LOW** · `KdfPipelineDiagram.tsx:994` · crypto · Misleading · "Bob runs HMAC-SHA256 with um over the **encrypted** error." Per `bolt04.md:1066-1072` the `um`-HMAC is over the un-encrypted error; `ammag` XOR is applied afterward. → "…over the error message (before the ammag layer is applied)." Also flip the demo's ammag/um step ordering (`:582-583,655-676`).

**[idx 44] LOW** · `OperationsLifecycleDiagram.tsx:1130-1131` · numeric · Misleading · padding label "~192 bytes." With the diagram's own 256-byte buffer (`:1001`) and the drawn 2-byte FAIL record (LEN 0x02), `pad = 256 − 2 = 254` (matches spec test vector `pad_len = 0x00fe = 254`). → "~254 bytes."

**[idx 45] LOW** · `OperationsLifecycleDiagram.tsx:1055,1130` · numeric · Misleading · Error/return packet `failure_len` is a fixed u16 (`bolt04.md:1061`), not a BigSize, and its rendered value `0x02` is impossible (a `temporary_channel_failure` failuremsg is ≥4 bytes: code + inner `[u16:len]` + channel_update, `bolt04.md:1303-1306`). The component self-describes the cell as "LEN bigsize" (`:998-999`), reusing the forward-hop grammar. Relabel as "failure_len (u16)" with a realistic value, or drop the BigSize-style LEN cell. *(`0x1007` code value is correct.)*

**[idx 49] LOW** · `errorOnionShared.tsx:533` · glossary · Misleading · HMAC cell sub-label renders `um_c` (lowercase) via `failingHop.charAt(0)`, while the same component's caption/keys use `um_charlie`/`um_C` (`:44,267,320`) and sibling `ErrorUnwrapDiagram.tsx:52,368` uses `um_C`. → `um_{...charAt(0).toUpperCase()}` or hardcode `um_C`. (`um` key type itself is correct per `bolt04.md:1067`.)

*Visuals — stale code comments (not student-visible):*

**[idx 19 · 70 — same ForwarderPolicyMap comment, merged] LOW** · `ForwarderPolicyMap.tsx:300-304` (idx 19) / `:302` (idx 70) · consistency · Incorrect · Comment says Dave has "channels with Bob/Eve/Greg." Per `ROUTE_EDGES` (`:88,92,96`) Dave's partners are **Hazel/Greg/Charlie**; "Eve" is only a palette key (`:44`), and Bob has no Dave edge. Comment-only (popover derives partners from real edges at `:470-471`), so no rendered impact. → "channels with Charlie/Greg/Hazel." *(The audit's own suggested "Bob/Frank/Greg" replacement is also wrong.)*

**[idx 24] LOW** · `ChannelUpdateCard.tsx:4` · consistency · Incorrect · Header comment "a 140px wide cream rectangle"; actual width is `200` (`:38`). Comment never renders. → "a 200px wide cream rectangle."

**[idx 40] LOW** · `OperationsLifecycleDiagram.tsx:77-79` · numeric · Incorrect · Comment "payload total minus the **33-byte HMAC**" — the HMAC is 32 bytes; 33 = 1-byte prefix + 32-byte HMAC (`bolt04.md:99-100,:801`). The file's own `:64-65` says "32-byte HMAC." Rendered values 0x1B/0x2F/0x43 are correct. → "minus the 1-byte bigsize prefix and the 32-byte HMAC."

**[idx 47] LOW** · `ForwarderPeelDiagram.tsx:9` · consistency · Incorrect · Header comment "8-step walkthrough"; the `STEPS` array has 7 (`:79-122`, `TOTAL_STEPS=7`). Rendered UI uses `TOTAL_STEPS` only, so students see "of 7." → "7-step" and renumber the comment's step list 1-7.

**[idx 48] LOW** · `PeelTraceDiagram.tsx:102` · numeric · Incorrect · `const OPAQUE_REST_PCT_2600 = 50 - BOB_HOP_PCT_2600; // 39` — `50 − 22 = 28`. Runtime value (28) is correct; the trailing comment `// 39` is stale. → `// 28`.

*Exercises — test-strength / wording (Low; ground truth correct in all cases):*

**[idx 56] LOW** · `onion-routing-exercises-draft.ts:1433` · code · Misleading · "Be sure to use the provided helpers: …, point_mul_pubkey, …" steers the student to a primitive that is the **forwarder-side** op (`bolt04.md:959`), not needed in this sender-side exercise (reference solution at `:1555-1563` never calls it). Drop `point_mul_pubkey` from the imperative list (the starterCode docstring `:1455-1459` already lists it merely as "available").

**[idx 57] LOW** · `onion-routing-exercises-draft.ts:122-123,136-142` · code · Misleading · `test_keys_match_reference` compares the student against a re-statement of the same `HMAC-SHA256(key-type, ss)` recipe, so a swapped-args implementation would pass. Ground truth is correct (reproduces spec `um_key 4da7f292…`/`ammag_key 2f36bb88…`). Add one external-vector assertion using the in-file `BOLT4_SHARED_SECRETS[4]`.

**[idx 58] LOW** · `onion-routing-exercises-draft.ts:1322-1374` · code · Misleading · The two `*_matches_reference` filler tests are self-referential; the real anchor is `test_matches_official_bolt4_filler` (verified correct — reproduces the 268-byte BOLT 4 filler). Separately, the 4-hop test names its third forwarder key `RHO_DAVE` while the docstring route is "(Bob, Charlie, X, Dave)" — rename to `RHO_X`.

**[idx 59] LOW** · `onion-routing-exercises-draft.ts:935-940` · code · Misleading · `test_matches_reference` for `wrap_hop` compares against an in-file duplicate `reference_wrap_hop`, not a frozen vector. Mitigated downstream: the build-packet exercise's `test_matches_official_bolt4_onion_vector` (`:1153`) anchors the student's `wrap_hop` byte-for-byte to the official onion vector. Optional: add a frozen `(buffer, tag)` anchor so this exercise self-anchors.

**[idx 60] LOW** · `onion-routing-exercises-draft.ts:605-615` · code · Misleading · `test_proportional_only_policy` docstring claims it "still uses floor division," but its input `4_000_000 × 2500 = 10_000_000_000` divides evenly by 1,000,000, so a `round()`/`ceil()` solution passes identically. Swap in a fractional case, e.g. `amt=4_999_999, ppm=2000 → 9_999_998_000 // 1_000_000 = 9999` (the BOLT 7 `bolt07.md:1118-1120` worked example), where ceil/round give 10000 and fail.

*Checkpoint explanation prose:*

**[idx 62] LOW** · `onion-routing-tutorial.tsx:416` · checkpoint · Misleading · "when Charlie sees a 2-slice message, he knows he's the **second-to-last forwarder**." The chapter (`3.0:25,37`) defines exactly two forwarders (Bob, Charlie) and Dave as the destination; Charlie is the LAST forwarder. BOLT 4 `bolt04.md:703` calls this position the "second-to-last node." → "the last forwarder before the destination (the second-to-last node in the path)." Answer key (`[1,2]`) unaffected.

**[idx 63] LOW** · `onion-routing-tutorial.tsx:357` · checkpoint · Misleading · "the BOLT 4 onion packet is fixed at 1300 bytes **total**." 1300 is the `hop_payloads` region; the whole packet is 1366 bytes (`bolt04.md:138-160,782`: 1 + 33 + 1300 + 32). → "the BOLT 4 onion packet's `hop_payloads` region is fixed at 1300 bytes." Graded answer (`[0,2]`) unaffected.

---

## 4. Cleared on re-verification (false positives)

These 8 were flagged in the first pass but the skeptic refuted them; **no change is needed**:

- **[idx 11]** `10.0-forwarding-validation.md:41` — "Whose minimum? Charlie's" is **CORRECT**. BOLT 7 `bolt07.md:522-523` defines `htlc_minimum_msat` as "the minimum HTLC value … the channel peer [Charlie] will accept." Do NOT rewrite to "Bob's threshold." *(The narrower idx 12 channel-open-vs-channel_update wording note still stands as Low.)*
- **[idx 28]** `NodeKeyAttemptDiagram.tsx:101` — "slice for bob/charlie/dave" is an **Acceptable simplification**: `slice` is sanctioned ch3/ch4 strawman vocabulary (the locked note bans `slot`, not `slice`).
- **[idx 33]** `WrapPrimerDiagram.tsx:710-712,899` — the component is **CORRECT**: over `BUILD_ORDER` Dave→Charlie→Bob the padding renders 1,300 / 1,200 / 1,120 / 1,060; the audit's quoted intermediates (1,240/1,160) were the error, not the code.
- **[idx 39]** `KeyDerivationCard.tsx:21` — **CORRECT**: the "step 4" text is inside a non-rendered `//` ASCII-art comment; the live callsite (`ForwarderPeelDiagram.tsx:651-656`) renders the correct "used next, in step 3." Optional housekeeping only.
- **[idx 41]** `OperationsLifecycleDiagram.tsx:843` — **CORRECT**: "(size-33)" accurately denotes `LEN = total − 1 (prefix) − 32 (HMAC)`; not confused with the 33-byte pubkey, and not student-visible.
- **[idx 46]** `OperationsLifecycleDiagram.tsx:1205` — **Acceptable simplification**: `0x9b a3…4d` / `0x4f c2…7a` are decorative truncated HMAC placeholders on a generic packet card; no spec value constrains them.
- **[idx 54]** `CapstoneStage.tsx:27` — **CORRECT**: "(size-33)" is an accurate internal note for `LEN = HOP_BYTES − 33`; never rendered. *(The separate idx 51/53 subcell-vs-byteLabel contradiction is the real, still-open High issue.)*
- **[idx 55]** `mathTokens.tsx:124-125` — **Unverifiable / false positive**: the quoted "C-style 0x00-termination" text lives at `bolt04.md:124-125`, not in the repo file; the finding mislabeled a BOLT reference as a course defect.

---

## 5. Secondary notes — redundant / over-explained wording (95 total)

These are **not technical errors** — they are intra-prose repetition, duplicated labels across a caption + its own tooltip, or hints that restate the description. None affects correctness; they are trim candidates for an editorial pass. Grouped by component, with the ~15 highest-value first.

**Most useful to address:**
1. `7.0-fixed-size-and-filler.md:74` — "In case we haven't hammered it home enough…" restates the same "same 60 bytes both times" point already made at lines 46, 48, 79 (4× total).
2. `5.0-onion-routing-101.md:15` — meta-commentary narrating its own bolding ("'deterministic' is bolded because this is very important").
3. `6.0-key-derivation.md:32,38,40,50` — the "five core operations / 4+1 labels" framing repeated 3× after line 3.
4. `exercise-peel-layer-draft` `:672-674` — the "skip HMAC verification (it's ch10)" scoping note stated **four** times (description `:658`, docstring `:672`, steps hint `:816`, code comment `:836`).
5. `exercise-build-packet-draft` `:1028,1043,1206` — "This is the chapter's wrap loop end to end" appears 3× (description + docstring + hint).
6. `ErrorBoomerangDiagram.tsx:177` — "still 292 B" duplicates the keystream-bar label, card header "292 B · fixed," and the caption — the fixed-size invariant asserted in 4+ places on one beat.
7. `PeelTraceDiagram.tsx:173,1126,1432` — "1,300 B" rendered 3× within beat 8 (caption, result-bar label, slice bracket).
8. `WrapPrimerDiagram.tsx:587,773,774,795` — the "1,300" figure appears 3-4× per encrypt beat (region header + keystream label + caption).
9. `CommitmentTxCard.tsx:444` — the locktime tooltip packs obscuring + XOR + basepoint concatenation + privacy rationale into one breath; dense but accurate, could split.
10. `XorEncryptionDemo.tsx:912,996` — the invalid-TLV message rendered twice in near-identical wording, both visible simultaneously.
11. `RouteComparisonDiagram.tsx:35` + `RouteCalcExercise.tsx:886-903` — the "Route A cheaper on fees (900) but blows the 200-block CLTV ceiling (1018)" explanation stated in 3 places across tabs.
12. `ComputedRouteDiagram.tsx:145-149` — the per-forwarder fee math (base + ppm/1e6 × amount) shown 3× (caption math box, channel_update card, FeeCalcCard).
13. `FillerTraceDiagram.tsx:1100,1117` — inline "(N layers)" counts duplicate the hatch-layer info their own hover tooltips already spell out.
14. `KeyDerivationCard.tsx:20-24` — header ASCII-art comment duplicates rendered card content **and** carries the stale step numbers noted in idx 39.
15. `exercise-derive-keys-draft` `:170-176` — steps hint re-explains the `@dataclass` constructor already fully covered by the conceptual hint at `:167-168`.

**Remaining secondary notes by component (counts):**

| Component / unit | Notes | | Component / unit | Notes |
|---|---|---|---|---|
| chapter 4.0-shared-secrets | 3 | | XorEncryptionDemo.tsx | 4 |
| chapter 5.0-onion-routing-101 | 3 | | OnionPacketAnatomyDiagram.tsx | 3 |
| chapter 6.0-key-derivation | 2 | | HmacChainDiagram.tsx | 3 |
| chapter 7.0-fixed-size-and-filler | 3 | | WrapPrimerDiagram.tsx | 3 |
| chapter 8.0-wrapping | 3 | | FillerTraceDiagram.tsx | 3 |
| chapter 10.0-forwarding-validation | 3 | | PayloadShrinkDiagram.tsx | 3 |
| chapter 11.0-error-onion | 2 | | PeelTraceDiagram.tsx | 3 |
| chapter 12.0-capstone-success | 2 | | ErrorBoomerangDiagram.tsx | 3 |
| CommitmentTxCard.tsx | 3 | | ErrorUnwrapDiagram.tsx | 3 |
| RouteComparisonDiagram.tsx | 3 | | errorOnionShared.tsx | 3 |
| ComputedRouteDiagram.tsx | 3 | | mathTokens.tsx | 1 |
| RouteCalcExercise.tsx | 3 | | exercise-derive-keys-draft | 2 |
| FeeCalculatorModal.tsx | 1 | | exercise-build-packet-draft | 3 |
| CltvSafetyLab.tsx | 2 | | exercise-peel-layer-draft | 2 |
| PlaintextMessageTear.tsx | 2 | | exercise-verify-hmac-draft | 2 |
| NaivePacketDiagram.tsx | 3 | | exercise-check-forward-draft | 3 |
| KeyDerivationCard.tsx | 1 | | checkpoints ch3 / ch5 / ch6 / ch10 | 2 / 2 / 2 / 1 |
| | | | snippets (PythonSnippet.tsx) | 4 |

*(Total = 95.)*

---

## Appendix A — Coverage table (from `inventory_summary.json`)

**Coverage confirmation:** all **13 chapters** (1.0–12.0 plus 15.0), **38 visuals**, **9 exercises**, **all 24 checkpoints (ch2–ch11)**, the **glossary (71 entries)**, and the **snippet registry (31 snippets)** were audited, plus the four cross-cutting units (answer-key equality, route drift, packet-byte drift, terminology/characters). **100% unit coverage.**

**3-hop exercise-execution caveat:** the exercise audits that were *executed* (run in Python against the staged vectors) are `exercise-derive-keys-draft`, `exercise-check-forward-draft`, and `exercise-decrypt-error-onion-draft` (all pass, including the official BOLT 4 error vector). The remaining exercises were audited statically (reference solution + test traced against BOLT 4), and the build-packet / derive-shared-secrets chain is anchored to the official onion vector `0002eec7…`. The `CapstoneStage` live 3-hop trace (Bob/Charlie/Dave = 59/59/83 B) was verified by recomputation but **not run in-browser** (see idx 51/53).

| Unit | Kind | Claims | Coverage (1-line) |
|---|---|---|---|
| 1.0-a-lightning-payment | chapter | 11 | Full prose; embedded visuals/checkpoints covered separately. 1 Low typo (idx 0). |
| 2.0-pathfinding-101 | chapter | 28 | Full prose + 4 snippet contexts; numbers recomputed vs BOLT 7. |
| 3.0-the-privacy-problem | chapter | 1 | Prose-only; 14 claims correct/acceptable; 1 Low (ln 23, idx 3). |
| 4.0-shared-secrets | chapter | 26 | Full file vs BOLT 4 ECDH/blinding/construction. Findings idx 1,2,3. |
| 5.0-onion-routing-101 | chapter | 25 | Full prose vs BOLT 4 packet/key-gen/processing. |
| 6.0-key-derivation | chapter | 22 | Full prose; inline math/snippet contexts. |
| 7.0-fixed-size-and-filler | chapter | 28 | Full prose. Findings idx 4/65,5,6,7,8,9. |
| 8.0-wrapping | chapter | 16 | Full prose vs construction/filler/key-gen/AD. |
| 9.0-peeling | chapter | 25 | All prose vs BOLT 4 onion-decryption/filler. Finding idx 10. |
| 10.0-forwarding-validation | chapter | 23 | Full prose vs reader/forward/failure sections. Findings idx 11(cleared),12,13. |
| 11.0-error-onion | chapter | 27 | Full prose vs error-onion section. Finding idx 14. |
| 12.0-capstone-success | chapter | 11 | Full prose vs trace/orchestrator. |
| 15.0-pay-it-forward | chapter | 0 | 5-line donation placeholder; nothing to verify. |
| HtlcPropagationDiagram.tsx | visual | 2 | 9 steps + cards vs BOLT 2/3/7. Findings idx 15,16. |
| LightningNetworkDiagram.tsx | visual | 7 | Topology/counts; all correct. |
| CommitmentTxCard.tsx | visual | 22 | All rendered strings/tooltips; witness simplifications noted. |
| RouteComparisonDiagram.tsx | visual | 31 | Wrapper + both children fully traced. |
| ComputedRouteDiagram.tsx | visual | 21 | Presentational; numbers traced to consumers. |
| RouteCalcExercise.tsx | visual | 24 | Full file + 3 sibling cross-checks. |
| FeeCalculatorModal.tsx | visual | 11 | Calculator; floored-fee formula vs BOLT 7. |
| ForwarderPolicyMap.tsx | visual | 16 | Full file. Findings idx 17/64/66,18,19/70. |
| CltvSafetyLab.tsx | visual | 17 | All 5 steps + setters + simulate(). Findings idx 20-23. |
| ChannelUpdateCard.tsx | visual | 8 | Presentational; sats-not-msat noted. Finding idx 24. |
| PlaintextMessageTear.tsx | visual | 14 | All 6 steps vs siblings + BOLT 4/7. Findings idx 25,26. |
| EncryptedSliceReveal.tsx | visual | 17 | All 6 steps + slices + tooltips; ch3 strawman. Finding idx 67. |
| KnowledgeMatrix.tsx | visual | 6 | Privacy-rubric matrix; correct. |
| NodeKeyAttemptDiagram.tsx | visual | 3 | All 6 steps; ch3/ch4 strawman. Findings idx 27,28(cleared),69. |
| EcdhRecapDiagram.tsx | visual | 14 | All 3 steps both modes; 0 errors. |
| BlindingFactorDiagram.tsx | visual | 2 | 11 substeps; formulas spec-accurate. Finding idx 29. |
| NaivePacketDiagram.tsx | visual | 14 | All 6 steps + data block + popover. Finding idx 68. |
| OnionPacketAnatomyDiagram.tsx | visual | 16 | Static 3-region anatomy + tips. |
| HmacChainDiagram.tsx | visual | 12 | Single-view hover diagram. Finding idx 30. |
| WrapPrimerDiagram.tsx | visual | 20 | All 10 beats vs construction/filler/BigSize. Findings idx 31,32,33(cleared),34. |
| PeelPrimerDiagram.tsx | visual | 18 | All 10 beats. Finding idx 35. |
| XorEncryptionDemo.tsx | visual | 18 | Full file vs key-gen/TLV/SCID. Findings idx 36,37. |
| KdfPipelineDiagram.tsx | visual | 2 | KDF pipeline + error path. Finding idx 38. |
| KeyDerivationCard.tsx | visual | 11 | Shared data-driven card. Finding idx 39(cleared). |
| OperationsLifecycleDiagram.tsx | visual | 22 | All 5 steps both modes. Findings idx 40,41(cleared),42,43,44,45,46(cleared). |
| FillerTraceDiagram.tsx | visual | 28 | All 14 beats; filler split verified. |
| ForwarderPeelDiagram.tsx | visual | 20 | All 7 steps + state machines. Finding idx 47. |
| PaddingStrategyDiagram.tsx | visual | 13 | Padding strategy; 60/80/100 sanctioned. |
| PayloadShrinkDiagram.tsx | visual | 20 | All 4 beats (ch7 strawman). |
| WrapTraceDiagram.tsx | visual | 26 | All 13 beats + special views. |
| PeelTraceDiagram.tsx | visual | 23 | All 10 beats + EnvelopeView. Finding idx 48. |
| ValidationFlowDiagram.tsx | visual | 10 | All 8 beats vs specs + onion vector. |
| ErrorBoomerangDiagram.tsx | visual | 15 | All 5 beats + shared deps; 292 B verified. |
| ErrorUnwrapDiagram.tsx | visual | 13 | All 4 beats. Finding idx 50. |
| errorOnionShared.tsx | visual | 13 | Full file (shared error components). Finding idx 49. |
| OnionCapstoneLab.tsx | visual | 26 | Shell + scenes + trace audited. |
| CapstoneStage.tsx | visual | 6 | Stage + scenes + trace; not run in-browser. Findings idx 51,53,54(cleared). Scene caption idx 52. |
| mathTokens.tsx | visual | 10 | Pure typography utility. idx 55 cleared (BOLT ref mislabel). |
| exercise-derive-shared-secrets-draft | exercise | 17 | Reference chain + official vector. |
| exercise-derive-keys-draft | exercise | 11 | **Executed**; 5/5 tests pass. |
| exercise-generate-filler-draft | exercise | 4 | Full; official 268-byte filler anchor. Finding idx 58. |
| exercise-wrap-hop-draft | exercise | 3 | Reference vs construction. Finding idx 59. |
| exercise-build-packet-draft | exercise | 18 | Full chain anchored to official onion vector. |
| exercise-peel-layer-draft | exercise | 20 | Full block + scaffolding helpers. |
| exercise-verify-hmac-draft | exercise | 16 | End-to-end; mutation-tested. Finding idx 57. |
| exercise-check-forward-draft | exercise | 15 | **Executed**; policy logic vs BOLT 4/7. Finding idx 60. |
| exercise-decrypt-error-onion-draft | exercise | 5 | **Executed**; 8/8 pass incl official error vector. Finding idx 61(cleared). |
| checkpoints ch2–ch11 | checkpoint | 36 | All 24 questions + answers vs BOLT 7/4. Findings idx 62,63 (explanation prose only). |
| glossary | glossary | 33 | All 71 entries vs BOLT 1/2/4/7 + live crypto; 0 errors. |
| snippets | snippets | 31 | All 31 vs BOLT 4/7 + reference solutions. |
| answer-key-equality | cross | 35 | Client vs server `CHECKPOINT_ANSWER_KEY`; all equal. |
| drift-routes | cross | 11 | Route fees/CLTV recomputed; 1 conflict (Hazel ppm — idx 17/64/66). |
| drift-packet-bytes | cross | 25 | 4 chapters + 10 components tabulated vs BOLT 4 byte layout. |
| terminology-characters | cross | 11 | All 13 chapters + 53 components vs locked terminology. |

---

## Appendix B — Acceptable simplifications (author, please confirm intent)

These are deliberate, internally-consistent teaching simplifications the audit did **not** flag as errors. Listed for the author to confirm they remain intended.

**Units — sats instead of msat (course-wide stated simplification):**
- `1.0:20` "10,000-sat payment"; `2.0:50,72` "400,000 / 2,000,000 sats."
- `ChannelUpdateCard.tsx:73`, `FeeCalculatorModal.tsx:205,210,215` — `base_fee (sats)` / `fee_per_millionth` shorthand for `fee_base_msat` / `fee_proportional_millionths`.
- `EncryptedSliceReveal.tsx:57-72` / `PlaintextMessageTear.tsx` — amounts in sats.
- **Note the deliberate reversal in ch12/capstone:** `12.0:9` "1,000,000 msat" and `CapstoneStage.tsx:239,258` use real msat (more accurate). Confirm the sats→msat reader-facing switch between the pathfinding chapters and the capstone is intended.

**Naive strawman framing (ch3/ch4 "first attempt"):**
- `4.0:40,42` — N independent ephemeral key pairs (the rejected attempt-2).
- `EncryptedSliceReveal.tsx:105,297-305,381-388`, `NodeKeyAttemptDiagram.tsx`, `PlaintextMessageTear.tsx:355` — encryption to raw node-identity keys + the `slice` metaphor, before Sphinx is introduced.
- `NaivePacketDiagram.tsx:98,470` — top-level `payment_hash` in the pre-Sphinx packet.

**Fixed example sizes (sanctioned 60/80/100-byte hop payloads):**
- `PeelPrimerDiagram.tsx:1322`, `FillerTraceDiagram.tsx:111`, `ForwarderPeelDiagram.tsx:1545`, `PaddingStrategyDiagram.tsx:75`, `PayloadShrinkDiagram.tsx:61,708` — consistent with `1 + l + 32` (`bolt04.md:801`).
- `XorEncryptionDemo.tsx:100-106` — fixed-width TLV encoding (real BOLT uses truncated `tu32`/`tu64`); round-trip is internally consistent.

**TLV/abbreviation display choices:**
- `5.0:9` "type byte" for the BigSize TLV type; byte-level detail deferred to ch7.
- `5.0:39` HMAC "over the payload" omits the `associated_data` (payment_hash) binding — deferred to later chapters.
- `outgoing_cltv` shorthand and `:` (vs `x`) SCID separator in `XorEncryptionDemo.tsx` / `EncryptedSliceReveal.tsx` — consistent course-wide.

**Witness / commitment simplifications (ch1 context):**
- `CommitmentTxCard.tsx:551-552` — sigs labeled by party, omitting the leading `0` dummy element and lexicographic ordering.
- `1.0:18` — "immediately spendable" `to_remote` (legacy/non-anchor model, consistent with Course 1).

**Error-onion example sizes:**
- `errorOnionShared.tsx:443`, `ErrorBoomerangDiagram.tsx`, `ErrorUnwrapDiagram.tsx` — the running 292-byte error packet ("fixed" = unchanged as it travels back; larger messages handled in ch11 prose).
- `ErrorBoomerangDiagram.tsx:43` / `ErrorUnwrapDiagram.tsx:238` — `temporary_channel_failure` shown as a bare code without its `channel_update` data (stated `check_forward` simplification).

**Exercise scoping:**
- `exercise-build-packet-draft:1028` "only crypto primitives are provided" (student's own prior functions are also callable, as the docstring `:1059` clarifies).
- `exercise-check-forward-draft:536` fee-before-CLTV precedence (BOLT 4 mandates no precedence; the exercise picks a deterministic convention).
- `exercise-verify-hmac-draft` / `exercise-derive-shared-secrets-draft` — synthetic self-vectors, acceptable given the spec anchors present elsewhere in the suite (see idx 57/58/59).