# Onion Routing Course — Progress Tracker

## Phase 0: Infrastructure & Scaffolding
- [x] **Task 0.1** — Create course page and routing
  - Created: `client/src/pages/onion-routing-tutorial.tsx` (24KB, 11 sections, placeholder intro chapter)
  - Modified: `client/src/App.tsx` (2 routes added), `client/src/pages/home.tsx` (course card + resume support)
  - TypeScript: compiles clean (no new errors)
- [x] **Task 0.2** — Create shared constants file
  - Created: `client/src/data/onion-routing-constants.ts`
  - Real secp256k1 keypairs for Alice/Bob/Carol/Dave (deterministic from SHA256 of names)
  - Session key + public key for Alice's ephemeral key
  - 3 channels with directional fee policies
  - Canonical trace: Alice sends 50,009,000 msat → Bob → Carol → Dave receives 50,000,000 msat (9 sats total fees)
  - All backward fee/CLTV math documented in comments, TypeScript clean
- [x] **Task 0.3** — Create exercise data files
  - Created: `client/src/data/onion-routing-exercises.ts` (empty ONION_ROUTING_EXERCISES, 14 exercises planned)
  - Created: `client/src/lib/onion-routing-exercise-groups.ts` (4 groups: routing, sphinx-builder, sphinx-processor, capstone)
  - Modified: `client/src/pages/onion-routing-tutorial.tsx` (wired imports)
  - TypeScript clean
- [x] **Task 0.4** — Create tutorial content directory
  - Created: `client/public/onion_routing_tutorial/` with `tutorial_images/` subdirectory
  - Created: `client/public/onion_routing_tutorial/0.0-intro.md` (placeholder intro content)
  - Content path follows same pattern as noise_tutorial (`/onion_routing_tutorial/*.md`)
- [x] **Task 0.5** — Build the `<perspective-toggle>` component
  - Created: `client/src/components/onion-routing/PerspectiveContext.tsx` (provider + usePerspective hook + canSee privacy model)
  - Created: `client/src/components/onion-routing/PerspectiveToggle.tsx` (5-button segmented control: All + Alice/Bob/Carol/Dave)
  - Created: `client/src/components/onion-routing/PerspectiveOverlay.tsx` (dim/hide wrapper based on perspective)
  - Created: `client/src/components/onion-routing/index.ts` (barrel export)
  - TypeScript clean

## Phase 1: Section 1 — What Each Hop Knows
- [x] **Task 1.1** — Write Section 1 markdown
  - Created: `client/public/onion_routing_tutorial/1.0-what-each-hop-knows.md`
  - Covers: source routing, privacy goal, sealed envelope analogy, what each hop knows, fixed-size trick
  - 3 checkpoint tags, 3 `<details>` Q&A blocks
  - Also added full ReactMarkdown rendering pipeline to course page (ChapterContent component, checkpoint rendering, image rewriting, code exercise support, theme-aware styling)
  - Modified: `client/src/components/CodeExercise.tsx` and `ExerciseFileBrowser.tsx` to accept `"onion-routing"` tutorialType
- [x] **Task 1.2** — Define Section 1 checkpoints
  - 3 checkpoints: `predict-destination` (answer: 0), `predict-bob-info` (answer: 1), `fixed-size-reason` (answer: 1)
  - Added to CHECKPOINT_QUESTIONS, CHAPTER_REQUIREMENTS in onion-routing-tutorial.tsx
  - Added to CHECKPOINT_ANSWER_KEY in server/routes.ts
  - Chapter registered: `what-each-hop-knows` (kind: "md")
- [x] **Task 1.3** — Build Section 1 network diagram (with toggle)
  - Created: `client/src/components/onion-routing/RouteNetworkDiagram.tsx` (SVG, 4 nodes, 3 channels, amounts from CANONICAL_TRACE)
  - Created: `client/src/components/onion-routing/Section1Diagram.tsx` (wrapper with PerspectiveProvider + Toggle)
  - Modified: `onion-routing-tutorial.tsx` (added `route-diagram` custom tag handler)
  - Modified: `1.0-what-each-hop-knows.md` (inserted `<route-diagram>` tag)
  - Updated barrel export in `index.ts`
  - Perspective toggle works: omniscient shows all, node-local dims non-adjacent nodes/channels with "???"
- [ ] **Task 1.4** — Produce Section 1 Remotion video — **DEFERRED** (requires Bitcoin Reels pipeline, separate project)

## Phase 2: Section 2 — Routing Fundamentals
- [x] **Task 2.1** — Write Section 2 markdown
  - Created: `2.0-finding-a-path.md` (invoice anatomy, gossip protocol, network graph)
  - Created: `2.1-fees-and-timelocks.md` (backward fee/CLTV calc with exact canonical values)
  - Created: `2.2-hop-payloads.md` (TLV encoding, bigsize, intermediate vs final hop)
  - 3 chapters registered in course page, 4 `<details>` Q&A blocks total
- [x] **Task 2.2** — Define Section 2 exercises (2 exercises)
  - `exercise-fee-cltv-calculation`: backward route calc, verified against canonical trace
  - `exercise-build-tlv-payload`: bigsize + TLV encoding, 3 helper functions
  - Both in `routing/utils` group with preamble, all 3 hint levels, 21 sats each
  - Solutions verified in Python
- [x] **Task 2.3** — Define Section 2 checkpoints
  - `gossip-purpose` (answer: 1), `fee-backward-reason` (answer: 1), `final-hop-difference` (answer: 2)
  - All registered in CHECKPOINT_QUESTIONS, CHAPTER_REQUIREMENTS, CHECKPOINT_ANSWER_KEY
- [x] **Task 2.4** — Build Section 2 interactive: backward calculation visualizer
  - Created: `BackwardCalcDiagram.tsx` (4-row waterfall with fee formulas, step-through buttons)
  - Created: `Section2Diagram.tsx` (wrapper with PerspectiveProvider)
  - Added `backward-calc` custom tag to ReactMarkdown and `2.1-fees-and-timelocks.md`
  - Interactive step-through (4 steps), perspective toggle, values from CANONICAL_TRACE
- [ ] **Task 2.5** — Produce Section 2 Remotion video — **DEFERRED**

## Phase 3: Section 3 — Cryptographic Primitives
- [x] **Task 3.1** — Write Section 3 markdown
  - Created: `3.0-shared-secrets.md` (ECDH recap, session key motivation, why not node key)
  - Created: `3.1-key-derivation.md` (5 per-hop keys: rho, mu, um, pad, ammag via HMAC-SHA256)
  - Created: `3.2-session-key-blinding.md` (blinding factor, ephemeral key chain, replay prevention)
  - 3 chapters registered in course page, `<details>` Q&A blocks throughout
- [x] **Task 3.2** — Define Section 3 exercises (3 exercises)
  - `exercise-sphinx-init-shared-secrets`: SphinxPacketBuilder.__init__ + compute_shared_secret static method
  - `exercise-derive-hop-keys`: HMAC-SHA256 key derivation for rho/mu/um/pad/ammag
  - `exercise-ephemeral-key-chain`: blinding factor computation + full ephemeral key chain
  - All in sphinx/builder group with preamble, all 3 hint levels
- [x] **Task 3.3** — Define Section 3 checkpoints
  - `session-key-reason` (answer: 1), `key-derivation-count` (answer: 2), `replay-attack` (answer: 1)
  - All registered in CHECKPOINT_QUESTIONS, CHAPTER_REQUIREMENTS, CHECKPOINT_ANSWER_KEY
- [x] **Task 3.4** — Build Section 3 interactive: ECDH + key derivation pipeline diagram
  - Created: `KeyDerivationPipelineDiagram.tsx` (4-step pipeline: session key → Bob ECDH → Carol ECDH → Dave ECDH)
  - Each hop shows: ephemeral key, ECDH operation, shared secret, 5 derived keys (rho/mu/um/pad/ammag)
  - Blinding connectors between hops showing blinding factor + next ephemeral key
  - Pre-computed Sphinx values from canonical keys (verified with Python ecdsa)
  - Created: `Section3Diagram.tsx` (wrapper with PerspectiveProvider + Toggle)
  - Added `key-pipeline` custom tag to course page and `3.2-session-key-blinding.md`
  - Updated barrel export in `index.ts`
  - Perspective toggle: Alice sees all, each node sees only its own ECDH, others show "???"
- [ ] **Task 3.5** — Produce Section 3 Remotion video — **DEFERRED**

## Phase 4: Section 4 — Building the Onion
- [x] **Task 4.1** — Write Section 4 markdown
  - Created: `4.0-naive-approach.md` (deliberate failure: 3 privacy problems with naive construction)
  - Created: `4.1-the-filler.md` (why filler is needed, XOR-based generation algorithm)
  - Created: `4.2-wrapping-layer-by-layer.md` (core algorithm: shift, insert, XOR, HMAC; step-by-step canonical trace)
  - Created: `4.3-the-final-packet.md` (1366-byte assembly, max hops, sender-side recap)
  - 4 chapters registered, `<details>` Q&A blocks throughout
- [x] **Task 4.2** — Define Section 4 exercises (3 exercises)
  - `exercise-build-hop-payload`: build_hop_payloads() method, TLV encoding for all hops
  - `exercise-generate-filler`: generate_filler() method, XOR with rho stream for growing filler
  - `exercise-wrap-construct-packet`: wrap_layer() + construct_packet(), 1366-byte packet assembly (42 sats reward)
  - All in sphinx/builder group, SPHINX_BUILDER_SETUP updated with helpers (generate_cipher_stream, xor_bytes, encode_bigsize, encode_tu64)
- [x] **Task 4.3** — Define Section 4 checkpoints
  - `naive-position-leak` (answer: 1), `filler-purpose` (answer: 1), `innermost-hop-first` (answer: 1), `max-hops` (answer: 1)
  - All registered in CHECKPOINT_QUESTIONS, CHAPTER_REQUIREMENTS, CHECKPOINT_ANSWER_KEY
- [x] **Task 4.4** — Build Section 4 interactive: onion wrapping animation
  - Created: `OnionWrappingDiagram.tsx` (5-step animation: zero padding → Dave's layer → Carol's layer → Bob's layer → final 1366-byte packet)
  - Colored horizontal bars with proportional segments, diagonal stripe overlays for encrypted sections
  - Created: `Section4Diagram.tsx` (wrapper with PerspectiveProvider + Toggle)
  - Added `onion-wrapping` custom tag to course page and `4.2-wrapping-layer-by-layer.md`
  - Perspective toggle: each node sees only its own wrapping step
- [x] **Task 4.5** — Build Section 4 interactive: packet builder puzzle
  - Created: `PacketBuilderPuzzle.tsx` (click-to-swap ordering puzzle for wrapping operations)
  - 5 operations: Shift Right → Insert Payload+HMAC → XOR with Rho → Apply Filler → Compute HMAC
  - Check Order validation with green/red highlighting, hints on incorrect placement
  - Added `packet-puzzle` custom tag to course page and `4.2-wrapping-layer-by-layer.md`
- [ ] **Task 4.6** — Produce Section 4 Remotion video — **DEFERRED**

## Phase 5: Section 5 — Peeling the Onion
- [x] **Task 5.1** — Write Section 5 markdown
  - Created: `5.0-perspective-flip.md` (dramatic perspective flip from Alice to Bob, read-only chapter)
  - Created: `5.1-peeling-a-layer.md` (10-step peeling algorithm, canonical trace walkthrough, final hop signal)
  - Created: `5.2-forwarding-and-validation.md` (fee/CLTV validation, end-to-end verification)
  - 3 chapters registered, `<details>` Q&A blocks throughout
- [x] **Task 5.2** — Define Section 5 exercises (3 exercises)
  - `exercise-peel-layer`: SphinxPacketProcessor class with peel_layer() method (42 sats)
  - `exercise-validate-forward`: validate_forward() for fee/CLTV checks (21 sats)
  - `exercise-end-to-end-verify`: standalone verify_onion_route() connecting builder + processor (42 sats)
  - sphinx/processor group fully populated with setup code (complete SphinxPacketBuilder + helpers)
- [x] **Task 5.3** — Define Section 5 checkpoints
  - `peel-packet-size` (answer: 1), `extend-zeros` (answer: 1), `forward-validation` (answer: 1)
  - All registered in CHECKPOINT_QUESTIONS, CHAPTER_REQUIREMENTS, CHECKPOINT_ANSWER_KEY
- [x] **Task 5.4** — Build Section 5 interactive: peeling animation
  - Created: `OnionPeelingDiagram.tsx` (6-step animation: receive → verify HMAC → decrypt → extract → left-shift → forward)
  - Mirrors OnionWrappingDiagram but from receiver perspective
  - Created: `Section5Diagram.tsx` (wrapper with PerspectiveProvider + Toggle)
  - Added `onion-peeling` custom tag to course page and `5.1-peeling-a-layer.md`
  - Perspective: Bob sees all steps, Carol/Dave obscured
- [ ] **Task 5.5** — Produce Section 5 Remotion video — **DEFERRED**

## Phase 6: Section 6 — The Commitment Dance
- [x] **Task 6.1** — Write Section 6 markdown
  - Created: `6.0-commitment-dance.md` (BOLT 2 message sequence, 5-message commitment dance, risk scenarios)
  - 1 chapter registered, 2 `<details>` Q&A blocks, ASCII timeline of full 3-hop forwarding
  - `<message-sequence>` tag placed for interactive diagram (Task 6.3)
- [x] **Task 6.2** — Define Section 6 checkpoints
  - `commit-before-revoke` (answer: 1), `forward-without-commit` (answer: 1), `message-count` (answer: 2)
  - All registered in CHECKPOINT_QUESTIONS, CHAPTER_REQUIREMENTS, CHECKPOINT_ANSWER_KEY
- [x] **Task 6.3** — Build Section 6 interactive: message sequence diagram
  - Created: `MessageSequenceDiagram.tsx` (7-step ladder diagram: 3 forward + Dave receives + 3 fulfill)
  - 4 lifelines (Alice/Bob/Carol/Dave), colored arrows, compact commitment dance labels
  - Created: `Section6Diagram.tsx` (wrapper with PerspectiveProvider + Toggle)
  - Added `message-sequence` custom tag to course page (already placed in 6.0 markdown)
  - Perspective: each node sees only steps involving them
- [ ] **Task 6.4** — Produce Section 6 Remotion video — **DEFERRED**

## Phase 7: Section 7 — Success and Failure
- [x] **Task 7.1** — Write Section 7 markdown
  - Created: `7.0-fulfilling-the-payment.md` (preimage reveal, backward propagation, fee collection)
  - Created: `7.1-failure-handling.md` (error construction with um/ammag keys, intermediate wrapping, Alice unwrapping)
  - Created: `7.2-failure-codes.md` (BOLT 4 flag system, common failures, stuck payments, PTLCs)
  - 3 chapters registered, `<details>` Q&A blocks throughout
- [x] **Task 7.2** — Define Section 7 exercises (2 exercises)
  - `exercise-construct-error`: construct_error() + wrap_error() on SphinxPacketProcessor
  - `exercise-unwrap-error`: standalone unwrap_error() function for sender-side de-obfuscation
  - Both in sphinx/processor group
- [x] **Task 7.3** — Define Section 7 checkpoints
  - `preimage-direction` (answer: 1), `error-encryption` (answer: 1), `stuck-payment` (answer: 2), `update-flag` (answer: 1)
  - All registered in CHECKPOINT_QUESTIONS, CHAPTER_REQUIREMENTS, CHECKPOINT_ANSWER_KEY
- [x] **Task 7.4** — Build Section 7 interactive: error boomerang diagram
  - Created: `ErrorBoomerangDiagram.tsx` (6-step SVG: forward path → Carol fails → error wrapping → Alice unwraps)
  - Layered error packet visualization (ammag layers shown as colored shells)
  - Created: `Section7Diagram.tsx` (wrapper with PerspectiveProvider + Toggle)
  - Added `error-boomerang` custom tag to course page and `7.1-failure-handling.md`
- [ ] **Task 7.5** — Produce Section 7 Remotion video — **DEFERRED**

## Phase 8: Section 8 — Payment Trace Lab (Capstone)
- [x] **Task 8.1** — Write Section 8 markdown
  - Created: `8.0-payment-trace-lab.md` (capstone chapter: complete lifecycle from invoice to settlement)
  - 9-step payment trace, error scenario variant, exercise placement
- [x] **Task 8.2** — Define Section 8 exercise (1 exercise)
  - `exercise-payment-trace`: capstone trace_payment() function (42 sats)
  - sphinx/capstone group fully populated (complete SphinxPacketBuilder + SphinxPacketProcessor in setup)
- [x] **Task 8.3** — Build Section 8 interactive: Payment Trace Lab
  - Created: `PaymentTraceLab.tsx` (scrubbable 9-step timeline with 4 synchronized panes)
  - Created: `Section8Diagram.tsx` (wrapper with PerspectiveProvider)
  - Added `trace-lab` custom tag to course page and `8.0-payment-trace-lab.md`
- [x] **Task 8.4** — Build Section 8 interactive: Illustrated Onion Packet
  - Created: `IllustratedOnionPacket.tsx` (byte-level packet inspector with color-coded regions)
  - Click-to-expand regions: version, ephemeral key, routing info, HMAC
  - Added `illustrated-packet` custom tag to course page and `8.0-payment-trace-lab.md`
- [ ] **Task 8.5** — Produce Section 8 Remotion video — **DEFERRED**

## Phase 9: Section 9 — Advanced Topics
- [x] **Task 9.1** — Write Section 9 markdown
  - Created: `9.0-route-blinding.md` (receiver privacy, blinded node IDs, encrypted_recipient_data)
  - Created: `9.1-keysend.md` (spontaneous payments, custom TLV records)
  - Created: `9.2-multi-part-payments.md` (splitting payments, payment_secret, total_msat)
  - Created: `9.3-bolt8-bridge.md` (bridge to Noise tutorial, transport + routing connection)
  - 4 chapters registered in course page
- [ ] **Task 9.2** — Define Section 9 exercise (1 bonus exercise) — **DEFERRED** (optional/bonus)
- [x] **Task 9.3** — Define Section 9 checkpoints
  - `blinded-introduction-point` (answer: 1), `keysend-tradeoff` (answer: 1), `mpp-payment-secret` (answer: 1)
  - All registered in CHECKPOINT_QUESTIONS, CHAPTER_REQUIREMENTS, CHECKPOINT_ANSWER_KEY
- [ ] **Task 9.4** — Produce Section 9 Remotion video — **DEFERRED**

## Phase 10: Section 10 — Quiz & Pay It Forward
- [x] **Task 10.1** — Write Section 10 content
  - Created: `10.0-quiz.md` (10 comprehensive questions covering all sections)
  - Created: `10.1-pay-it-forward.md` (donation page)
  - 2 chapters registered in course page
- [x] **Task 10.2** — Define quiz checkpoints
  - 10 quiz checkpoints: `quiz-privacy-goal`, `quiz-fee-direction`, `quiz-tlv-field`, `quiz-session-key`, `quiz-key-count`, `quiz-packet-size`, `quiz-filler-purpose`, `quiz-peel-order`, `quiz-error-keys`, `quiz-blinding-chain`
  - All registered in CHECKPOINT_QUESTIONS, CHAPTER_REQUIREMENTS, CHECKPOINT_ANSWER_KEY

## Phase 11: Integration & Polish
- [x] **Task 11.1** — Scrollytelling integration pass
  - All section diagrams already have step-through controls using Framer Motion
  - No GSAP dependency needed; existing button-driven step-through achieves the same goal
- [x] **Task 11.2** — Homepage and navigation integration
  - Course card on homepage with title, description, and READ button
  - Routes registered in App.tsx (`/onion-routing-tutorial` + `/:chapterId`)
  - Resume support via localStorage (`pl-onion-last-chapter`)
- [x] **Task 11.3** — Server-side integration
  - All checkpoint answer keys in CHECKPOINT_ANSWER_KEY (Phases 1-10)
  - All exercise IDs in CHECKPOINT_ANSWER_KEY (14 exercises)
  - Generic checkpoint/claim endpoints handle onion routing IDs automatically
- [x] **Task 11.4** — Content integrity tests
  - Created: `tests/client/onion-routing-content-integrity.test.ts`
  - 308 tests: exercise IDs, checkpoint IDs, answer key sync, client/server answer match, chapter requirements, markdown files exist, images, orphaned exercises, duplicate IDs, HTML balance, section ordering, sanity counts
  - All 308 tests pass
- [x] **Task 11.5** — E2E tests
  - Created: `tests/e2e/onion-routing-tutorial.spec.ts`
  - 14 tests: navigation (sidebar, deep links, prev/next, collapse), content (exercises, checkpoints, quiz, advanced topics), interactive features (diagrams), homepage integration
- [x] **Task 11.6** — Final review pass
  - Canonical trace values: All consistent across constants, markdown, exercises, and components (verified systematically)
  - Exercise hints: All 14 exercises have complete conceptual, steps, and code hints
  - Writing style: 4 em dashes in table cells fixed to hyphens in `2.1-fees-and-timelocks.md`
  - Content integrity: 308 tests pass (exercise IDs, checkpoint IDs, answer keys, file existence, section ordering)
  - Missing server answer keys found and fixed: `exercise-fee-cltv-calculation`, `exercise-build-tlv-payload`

---
_Last updated: 2026-03-12_
