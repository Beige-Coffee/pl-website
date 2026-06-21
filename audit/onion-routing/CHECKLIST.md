# Onion Course — Fix Checklist (pick by ID)

## CRITICAL
- **C1** `CltvSafetyLab.tsx:264-287,350,361` — CLTV ordering inverted; "safe" state unreachable → flip clamps to `AB≥BC≥CD`.
- **C2** `ForwarderPolicyMap.tsx:112` — Hazel `feePpm:3000` ≠ 2000 used everywhere; breaks "cheapest route" checkpoint → set `2000`.

## HIGH
- **H1** `11.0-error-onion.md:40` — fabricated "pads to 1,024 bytes / 1,060-byte packet" → delete; packet grows with message, no fixed size.
- **H2** `ErrorUnwrapDiagram.tsx:53` — "first two bytes = failure_len" ignores 32-byte HMAC → "u16 at offset 32".
- **H3** `CapstoneStage.tsx:29-31` vs `:152` — subcell shows 60/80/100 while byte row shows 59/59/83 → drive both from trace.
- **H4** `HtlcPropagationDiagram.tsx:236-281` — HTLC witness script wrong keys (`RIPEMD160(remote_htlcpubkey)`, misplaced `local_htlcpubkey`) → BOLT 3 layout.
- **H5** `OperationsLifecycleDiagram.tsx:322-355` — error path encrypts (ammag) before authenticating (um) → swap to MAC-then-encrypt.

## MEDIUM
- **M1** `7.0-fixed-size-and-filler.md:64` — "first 1,360 bytes forwarded" → 1,300 (Bob's 60 sliced off front).
- **M2** `9.0-peeling.md:62` — "needs first s_B of keystream (~60)" conflates his payload with keystream → needs full 1,300+s_B.
- **M3** `HtlcPropagationDiagram.tsx:78` — "resolve A↔B before C↔D" → before **B↔C** (Bob's outgoing).
- **M4** `OperationsLifecycleDiagram.tsx:347-349` — error HMAC "on the back" → prepended to front.
- **M5** `ForwarderPolicyMap.tsx:264-269,856` — `capacity` shown as a `channel_announcement` field (it isn't) → remove/annotate.
- **M6** `onion-capstone-scenes.ts:303` — "single ephemeral key" → re-blinded per hop (E_AB/E_AC/E_AD).
- **M7** `KdfPipelineDiagram.tsx:994` — `um` HMAC "over encrypted error" → over un-encrypted error (before ammag).  *(same root as H5)*
- **M8** *(reserved — H5/M7 are the error-ordering pair)*

## LOW — prose typos
- **L1** `1.0:18` "immedieately" · **L2** `4.0:5` "Protocl" · **L3** `7.0:14` "fized-size" · **L4** `7.0:48` "theem" · **L5** `7.0:58` "does't" · **L6** `7.0:66` "While…but" grammar · **L7** `7.0:5` "each per-hop payloads".

## LOW — terminology (`slice`↔`hop payload` mixed; slice is allowed, just be consistent)
- **L8** `4.0:22` · **L9** `EncryptedSliceReveal.tsx:105`+md · **L10** `NaivePacketDiagram.tsx:107` · **L11** `NodeKeyAttemptDiagram.tsx:101`.

## LOW — captions / tooltips / labels (student-visible)
- **L12** `10.0:41` htlc_minimum "at channel open" → revisable channel_update.
- **L13** `10.0:45` LDK "39 blocks" not in any BOLT (cite source or soften).
- **L14** `PlaintextMessageTear.tsx:263` Charlie "saw entire payload" overfires.
- **L15** `PlaintextMessageTear.tsx:8-15` comment "matches Sphinx" — Sphinx does opposite.
- **L16** `NodeKeyAttemptDiagram.tsx:309` `payment_hash` inside ONION_PACKET box.
- **L17** `HmacChainDiagram.tsx:91` "commits to layer beneath" undercounts own payload.
- **L18** `WrapPrimerDiagram.tsx:914` "(slot_size−1)" → `−33`.
- **L19** `PeelPrimerDiagram.tsx:1145` peel keystream "1,300 B" → 2,600.
- **L20** `XorEncryptionDemo.tsx:32` SCID bytes don't match label · **L21** `:973` `outgoing_cltv` → `outgoing_cltv_value`.
- **L22** `KdfPipelineDiagram.tsx:994` "encrypted error" *(=M7)*.
- **L23** `OperationsLifecycleDiagram.tsx:1130` padding "~192 B" → 254 · **L24** `:1055` `failure_len` as BigSize + impossible `0x02`.
- **L25** `BlindingFactorDiagram.tsx:63` `·` tooltip covers 1 of 3 uses.
- **L26** `errorOnionShared.tsx:533` `um_c` → `um_C`.

## LOW — stale code comments (not rendered)
- **L27** `ForwarderPolicyMap.tsx:300` Dave partners "Bob/Eve/Greg" → Charlie/Greg/Hazel · **L28** `ChannelUpdateCard.tsx:4` "140px"→200 · **L29** `OperationsLifecycleDiagram.tsx:77` "33-byte HMAC"→32 · **L30** `ForwarderPeelDiagram.tsx:9` "8-step"→7 · **L31** `PeelTraceDiagram.tsx:102` `//39`→28.

## LOW — exercise tests (ground truth all correct; tests just weak)
- **L32** `exercise-verify-hmac` self-referential key test · **L33** filler tests self-referential + `RHO_DAVE` name · **L34** `wrap_hop` self-anchored · **L35** `test_proportional_only_policy` divides evenly (floor/round indistinguishable) · **L36** `derive-shared-secrets` mis-steers `point_mul_pubkey`.

## LOW — checkpoint explanation prose (graded answers unaffected)
- **L37** `onion-routing-tutorial.tsx:416` Charlie "second-to-last forwarder" → last forwarder · **L38** `:357` "onion packet fixed at 1300 bytes total" → 1300 is hop_payloads region (packet=1366).

## CONFIRM (not a bug — intended?)
- **Q1** Course uses **sats**, but ch12 capstone switches to **msat** (`12.0:9`, `CapstoneStage.tsx:239`). Intended?

---
*Reply with IDs to fix (e.g. "C1, C2, H1-H5, L1-L7") or "all Critical+High".*
