/**
 * Noise Handshake Orchestrator
 *
 * Coordinates the BOLT 8 Noise XK handshake between the student's
 * Python code (running in Pyodide) and the server's WebSocket endpoint.
 *
 * State machine:
 *   idle -> preflight -> connecting -> act1_send -> act1_wait
 *        -> act2_process -> act3_send -> act3_wait -> transport_ready
 *
 * The orchestrator loads the student's saved solutions for all 12 Noise
 * exercises, verifies they pass their test suites, then runs the functions
 * in sequence to perform a real handshake with the server.
 *
 * Usage (from a React component via useRef):
 *
 *   const orch = new NoiseOrchestrator(getProgress);
 *   const unsub = orch.subscribe((event) => { ... });
 *   await orch.startPreflight();
 *   await orch.startHandshake();
 *   await orch.sendMessage("ping");
 *   orch.destroy();
 */

import {
  runPythonTests,
  runPythonCode,
  execPythonSilent,
  type TestResult,
} from "./pyodide-runner";
import { CODE_EXERCISES } from "../data/code-exercises";
import { NOISE_EXERCISE_GROUPS } from "./noise-exercise-groups";

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrchestratorState =
  | "idle"
  | "preflight"
  | "connecting"
  | "act1_send"
  | "act1_wait"
  | "act2_process"
  | "act3_send"
  | "act3_wait"
  | "transport_ready"
  | "error";

export interface CipherStateSnapshot {
  key: string;   // full 32-byte hex
  ck: string;    // full 32-byte hex (chaining key)
  nonce: number;
}

export interface BurstProgressInfo {
  phase: "send" | "drain";
  sent: number;
  total: number;
  sendNonce: number;
  recvNonce: number;
  sendRotated: boolean;
}

export type OrchestratorEvent =
  | { type: "preflight_progress"; exercise: string; passed: boolean }
  | { type: "state_change"; from: OrchestratorState; to: OrchestratorState }
  | { type: "act_complete"; act: 1 | 2 | 3; bytes: Uint8Array }
  | { type: "message_sent"; plaintext: string; ciphertext: Uint8Array }
  | { type: "message_received"; plaintext: string; ciphertext: Uint8Array }
  | { type: "cipher_state_update"; send: CipherStateSnapshot; recv: CipherStateSnapshot; rotated?: "send" | "recv" }
  | { type: "error"; message: string; exerciseLink?: string };

type ProgressGetter = (key: string) => string | null;

// ─── Exercise metadata ──────────────────────────────────────────────────────

/**
 * The 13 Noise exercises in dependency order. The orchestrator's preflight
 * check verifies each one, and a failure links the student to the relevant
 * chapter in the tutorial.
 */
const EXERCISE_IDS = [
  "exercise-generate-keypair",
  "exercise-ecdh",
  "exercise-hkdf",
  "exercise-init-state",
  "exercise-act1-initiator",
  "exercise-act1-responder",
  "exercise-act2-responder",
  "exercise-act2-initiator",
  "exercise-act3-initiator",
  "exercise-act3-responder",
  "exercise-encrypt",
  "exercise-decrypt",
  "exercise-key-rotation",
] as const;

/** Map exercise IDs to the chapter in the noise tutorial */
const EXERCISE_CHAPTER_MAP: Record<string, string> = {
  "exercise-generate-keypair": "crypto-primitives",
  "exercise-ecdh": "crypto-primitives",
  "exercise-hkdf": "crypto-primitives",
  "exercise-init-state": "handshake-setup",
  "exercise-act1-initiator": "act-1",
  "exercise-act1-responder": "act-1",
  "exercise-act2-responder": "act-2",
  "exercise-act2-initiator": "act-2",
  "exercise-act3-initiator": "act-3",
  "exercise-act3-responder": "act-3",
  "exercise-encrypt": "sending-messages",
  "exercise-decrypt": "receiving-messages",
  "exercise-key-rotation": "key-rotation",
};

// ─── Timeouts ────────────────────────────────────────────────────────────────

const ACT_TIMEOUT_MS = 10_000; // 10s per act

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a hex string to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Convert Uint8Array to hex string */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── NoiseOrchestrator ──────────────────────────────────────────────────────

export class NoiseOrchestrator {
  private state: OrchestratorState = "idle";
  private listeners = new Set<(event: OrchestratorEvent) => void>();
  private ws: WebSocket | null = null;
  private actTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
  private destroyed = false;
  private getProgress: ProgressGetter;

  // Student's static public key (hex), set during handshake
  private _studentPubkey: string | null = null;

  // Message receive handler for transport mode
  private messageHandler:
    | ((plaintext: string, ciphertext: Uint8Array) => void)
    | null = null;

  // Resolve/reject for the act-level WebSocket message promises
  private wsResolve: ((data: Uint8Array) => void) | null = null;
  private wsReject: ((err: Error) => void) | null = null;

  // Cipher state tracking for key rotation detection
  private _lastSendKey: string | null = null;
  private _lastRecvKey: string | null = null;

  // Burst mode: suppresses individual message events & buffers incoming
  private _burstMode = false;
  private _burstIncomingBuffer: Uint8Array[] = [];

  constructor(getProgress: ProgressGetter) {
    this.getProgress = getProgress;
  }

  // ─── Event Emitter ─────────────────────────────────────────────────────

  subscribe(listener: (event: OrchestratorEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: OrchestratorEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // Swallow listener errors
      }
    });
  }

  // ─── State Machine ─────────────────────────────────────────────────────

  private transition(to: OrchestratorState): void {
    const from = this.state;
    this.state = to;
    this.emit({ type: "state_change", from, to });
  }

  private transitionToError(message: string, exerciseLink?: string): void {
    this.transition("error");
    this.emit({ type: "error", message, exerciseLink });
    this.cleanupWebSocket();
  }

  get currentState(): OrchestratorState {
    return this.state;
  }

  /** The student's static public key (hex), available after handshake starts */
  get studentPubkey(): string | null {
    return this._studentPubkey;
  }

  // ─── Pre-flight Check ─────────────────────────────────────────────────

  /**
   * Load and verify all 12 student exercise solutions.
   *
   * For each exercise:
   *   1. Load the student's saved code from progress
   *   2. Assemble the full code (setup + cross-group deps + prior exercises + student code)
   *   3. Run the exercise's test suite
   *   4. If all tests pass, the function is now defined in the Pyodide environment
   *
   * Returns true if all exercises pass.
   */
  async startPreflight(): Promise<boolean> {
    if (this.destroyed) return false;
    this.transition("preflight");

    try {
      // Load all student solutions first, checking for missing ones
      const solutions = new Map<string, string>();
      for (const id of EXERCISE_IDS) {
        const code = this.getProgress(`exercise-${id}`);
        if (!code) {
          const chapter = EXERCISE_CHAPTER_MAP[id];
          const exerciseDef = CODE_EXERCISES[id];
          const title = exerciseDef?.title ?? id;
          this.emit({
            type: "preflight_progress",
            exercise: id,
            passed: false,
          });
          this.transitionToError(
            `Missing solution for "${title}". Complete this exercise first.`,
            `/noise-tutorial/${chapter}`
          );
          return false;
        }
        solutions.set(id, code);
      }

      // Build the Pyodide environment by loading exercises in group order.
      // Each group's setup code and preamble imports are loaded first,
      // then each exercise in order.
      //
      // For test verification, we assemble the full code context that each
      // exercise needs: setup + preamble + cross-group deps + prior exercises
      // in the group + the student's code. This is necessary because some
      // exercises (e.g., CipherState methods) are indented method bodies that
      // need the class header from the preamble to be syntactically valid.
      for (const groupId of [
        "crypto/primitives",
        "noise/handshake",
        "noise/transport",
      ]) {
        const group = NOISE_EXERCISE_GROUPS[groupId];
        if (!group) continue;

        // Build the group's base context: setup + cross-group deps + preamble
        const groupContext: string[] = [];
        if (group.setupCode) groupContext.push(group.setupCode);

        // Cross-group dependencies (student's solutions from prior groups)
        for (const depId of group.crossGroupDependencies) {
          const depCode = solutions.get(depId);
          if (depCode) groupContext.push(depCode);
        }

        if (group.preamble) groupContext.push(group.preamble);

        // Track prior exercise solutions within this group
        const priorInGroup: string[] = [];

        // Verify each exercise in this group
        for (const exerciseId of group.exerciseIds) {
          const studentCode = solutions.get(exerciseId)!;
          const exerciseDef = CODE_EXERCISES[exerciseId];
          if (!exerciseDef) continue;

          // Assemble the full code: group context + prior exercises + student code
          const assembledCode = [
            ...groupContext,
            ...priorInGroup,
            studentCode,
          ]
            .filter(Boolean)
            .join("\n\n");

          // Run the assembled code against the exercise's test suite
          let results: TestResult[];
          try {
            results = await runPythonTests(
              assembledCode,
              exerciseDef.testCode
            );
          } catch (err) {
            const chapter = EXERCISE_CHAPTER_MAP[exerciseId];
            this.emit({
              type: "preflight_progress",
              exercise: exerciseId,
              passed: false,
            });
            this.transitionToError(
              `"${exerciseDef.title}" failed to run: ${err instanceof Error ? err.message : String(err)}`,
              `/noise-tutorial/${chapter}`
            );
            return false;
          }

          const allPassed = results.every((r) => r.passed);
          this.emit({
            type: "preflight_progress",
            exercise: exerciseId,
            passed: allPassed,
          });

          if (!allPassed) {
            const failedTest = results.find((r) => !r.passed);
            const chapter = EXERCISE_CHAPTER_MAP[exerciseId];
            this.transitionToError(
              `"${exerciseDef.title}" test failed: ${failedTest?.message ?? "unknown"}`,
              `/noise-tutorial/${chapter}`
            );
            return false;
          }

          // Add this exercise's solution to prior solutions for subsequent exercises
          priorInGroup.push(studentCode);
        }

        // After verifying all exercises in the group, define everything in
        // the persistent Pyodide environment for use during the handshake
        const fullGroupCode = [
          ...groupContext,
          ...priorInGroup,
        ]
          .filter(Boolean)
          .join("\n\n");

        await execPythonSilent(fullGroupCode);
      }

      return true;
    } catch (err) {
      this.transitionToError(
        `Pre-flight check failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return false;
    }
  }

  // ─── Handshake Orchestration ───────────────────────────────────────────

  /**
   * Perform the full 3-act Noise XK handshake with the server.
   *
   * Prerequisite: startPreflight() must have returned true.
   * After completion, the orchestrator is in transport_ready state.
   */
  async startHandshake(): Promise<void> {
    if (this.destroyed) return;

    try {
      // ── Step 1: Fetch server's static public key ──────────────────
      const pubkeyRes = await fetch("/api/noise/pubkey");
      if (!pubkeyRes.ok) {
        this.transitionToError("Failed to fetch server public key");
        return;
      }
      const { pubkey: serverPubkeyHex } = await pubkeyRes.json();
      const serverPubkey = hexToBytes(serverPubkeyHex);

      // ── Step 2: Generate initiator's keypairs via student code ─────
      // Generate static keypair (identity)
      const staticKeypairResult = await this.runPythonAndParse<{
        priv: Uint8Array;
        pub: Uint8Array;
      }>(
        `
import json
_s_priv, _s_pub = generate_keypair()
print(json.dumps({"priv": _s_priv.hex(), "pub": _s_pub.hex()}))
`,
        (raw: string) => {
          const parsed = JSON.parse(raw);
          return {
            priv: hexToBytes(parsed.priv),
            pub: hexToBytes(parsed.pub),
          };
        }
      );

      // Generate ephemeral keypair
      const ephemeralKeypairResult = await this.runPythonAndParse<{
        priv: Uint8Array;
        pub: Uint8Array;
      }>(
        `
import json
_e_priv, _e_pub = generate_keypair()
print(json.dumps({"priv": _e_priv.hex(), "pub": _e_pub.hex()}))
`,
        (raw: string) => {
          const parsed = JSON.parse(raw);
          return {
            priv: hexToBytes(parsed.priv),
            pub: hexToBytes(parsed.pub),
          };
        }
      );

      const s_priv = staticKeypairResult.priv;
      const s_pub = staticKeypairResult.pub;
      const e_priv = ephemeralKeypairResult.priv;
      const e_pub = ephemeralKeypairResult.pub;

      // Store the student's static public key for certificate display
      this._studentPubkey = bytesToHex(s_pub);

      // Store keys as hex in Pyodide for later use
      await execPythonSilent(`
_orch_s_priv = bytes.fromhex("${bytesToHex(s_priv)}")
_orch_s_pub = bytes.fromhex("${bytesToHex(s_pub)}")
_orch_e_priv = bytes.fromhex("${bytesToHex(e_priv)}")
_orch_e_pub = bytes.fromhex("${bytesToHex(e_pub)}")
_orch_rs_pub = bytes.fromhex("${bytesToHex(serverPubkey)}")
`);

      // ── Step 3: Initialize handshake state ────────────────────────
      // The state (h, ck) is stored in the Pyodide environment for
      // subsequent handshake steps.
      await execPythonSilent(`
_orch_h, _orch_ck = initialize_symmetric_state(_orch_rs_pub)
`);

      // ── Step 4: Connect WebSocket ─────────────────────────────────
      this.transition("connecting");

      const wsProtocol =
        window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/noise-handshake`;

      await this.connectWebSocket(wsUrl);

      // ── Step 5: Act 1 ─────────────────────────────────────────────
      this.transition("act1_send");

      const act1MessageHex = await this.runPythonAndParse<string>(
        `
_act1_msg, _orch_h, _orch_ck = act_one_initiator(_orch_h, _orch_ck, _orch_e_priv, _orch_e_pub, _orch_rs_pub)
print(_act1_msg.hex())
`,
        (raw: string) => raw.trim()
      );

      const act1Message = hexToBytes(act1MessageHex);

      // Send Act 1 and wait for Act 2
      this.transition("act1_wait");
      this.ws!.send(act1Message);
      this.emit({ type: "act_complete", act: 1, bytes: act1Message });

      const act2Message = await this.waitForWsMessage(1);

      // ── Step 6: Process Act 2 ─────────────────────────────────────
      this.transition("act2_process");

      // Save ck before Act 2 so we can re-derive temp_k2
      // (act_two_initiator returns updated ck but not temp_k2)
      await execPythonSilent(
        `_orch_ck_before_act2 = _orch_ck`
      );

      // Store Act 2 message in Pyodide
      await execPythonSilent(
        `_orch_act2_msg = bytes.fromhex("${bytesToHex(act2Message)}")`
      );

      // Process Act 2: state (h, ck, re_pub) stored in Pyodide environment
      await execPythonSilent(`
_orch_re_pub, _orch_h, _orch_ck = act_two_initiator(_orch_h, _orch_ck_before_act2, _orch_e_priv, _orch_act2_msg)
`);

      this.emit({
        type: "act_complete",
        act: 2,
        bytes: act2Message,
      });

      // Re-derive temp_k2 for Act 3:
      // ss = ecdh(e_priv, re_pub), then _, temp_k2 = hkdf_two_keys(ck_before_act2, ss)
      // But we also need to account for the fact that hkdf_two_keys returns (new_ck, temp_k)
      // and act_two_initiator internally computes: ck, temp_k = hkdf_two_keys(ck, ss)
      // The returned ck IS the first output. So we can reconstruct temp_k2 from:
      //   ss = ecdh(e_priv, re_pub)
      //   _, temp_k2 = hkdf_two_keys(ck_before_act2, ss)
      await execPythonSilent(`
_orch_ss_ee = ecdh(_orch_e_priv, _orch_re_pub)
_, _orch_temp_k2 = hkdf_two_keys(_orch_ck_before_act2, _orch_ss_ee)
`);

      // ── Step 7: Act 3 ─────────────────────────────────────────────
      this.transition("act3_send");

      const act3Result = await this.runPythonAndParse<{
        message: string;
        send_key: string;
        recv_key: string;
      }>(
        `
import json
_act3_msg, _orch_send_key, _orch_recv_key = act_three_initiator(
    _orch_h, _orch_ck, _orch_temp_k2, _orch_s_priv, _orch_s_pub, _orch_re_pub
)
print(json.dumps({
    "message": _act3_msg.hex(),
    "send_key": _orch_send_key.hex(),
    "recv_key": _orch_recv_key.hex()
}))
`,
        (raw: string) => JSON.parse(raw)
      );

      const act3Message = hexToBytes(act3Result.message);

      // Send Act 3 and wait for server's first transport message
      this.transition("act3_wait");
      this.ws!.send(act3Message);
      this.emit({ type: "act_complete", act: 3, bytes: act3Message });

      // Start listening for server's transport response BEFORE the async
      // Python work below — the server may respond while CipherState
      // initializes, and we'd drop the message if wsResolve isn't set.
      const firstTransportPromise = this.waitForWsMessage(3);

      // Initialize CipherState instances in Pyodide for transport mode.
      //
      // The student's act_three_initiator returns (send_key, recv_key) per
      // BOLT 8 convention:
      //   send_key = first HKDF output  (encrypts initiator -> responder)
      //   recv_key = second HKDF output (encrypts responder -> initiator)
      //
      // The server (noise-responder.ts) assigns:
      //   recvCipher = CipherState(first output)   -- decrypts initiator -> responder
      //   sendCipher = CipherState(second output)   -- encrypts responder -> initiator
      //
      // Both sides use the same key for each direction. No swap needed:
      //   - Initiator sends with send_key (first), server receives with first
      //   - Server sends with second, initiator receives with recv_key (second)
      //
      // CipherState also needs the chaining key for key rotation. This is the
      // ck after Act 3's MixKey(se), which we re-derive here since
      // act_three_initiator doesn't return the updated ck.

      await execPythonSilent(`
_orch_se_ss = ecdh(_orch_s_priv, _orch_re_pub)
_orch_ck_transport, _ = hkdf_two_keys(_orch_ck, _orch_se_ss)
_orch_send_cs = CipherState(
    bytes.fromhex("${act3Result.send_key}"),
    _orch_ck_transport
)
_orch_recv_cs = CipherState(
    bytes.fromhex("${act3Result.recv_key}"),
    _orch_ck_transport
)
`);

      // Wait for the server's first transport message (congrats)
      const firstTransportMsg = await firstTransportPromise;

      // Decrypt the server's message using the student's decrypt function
      const decryptedFirst = await this.decryptTransportMessage(
        firstTransportMsg
      );

      this.emit({
        type: "message_received",
        plaintext: decryptedFirst,
        ciphertext: firstTransportMsg,
      });

      // Set up the transport message handler
      this.setupTransportHandler();

      this.transition("transport_ready");

      // Emit initial cipher state so the UI has values from the start
      try {
        const csState = await this.queryCipherState();
        this._lastSendKey = csState.send.key;
        this._lastRecvKey = csState.recv.key;
        this.emitCipherStateUpdate(csState);
      } catch { /* ignore */ }
    } catch (err) {
      if (!this.destroyed) {
        this.transitionToError(
          `Handshake failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  // ─── Transport Mode ────────────────────────────────────────────────────

  /**
   * Query the current cipher state of both send and receive CipherState
   * instances in the student's Pyodide environment.
   */
  async queryCipherState(): Promise<{ send: CipherStateSnapshot; recv: CipherStateSnapshot }> {
    const result = await this.runPythonAndParse<{ send: CipherStateSnapshot; recv: CipherStateSnapshot }>(
      `
import json as _json_cs
print(_json_cs.dumps({
  "send": {"key": _orch_send_cs.key.hex(), "ck": _orch_send_cs.chaining_key.hex(), "nonce": int(_orch_send_cs.nonce)},
  "recv": {"key": _orch_recv_cs.key.hex(), "ck": _orch_recv_cs.chaining_key.hex(), "nonce": int(_orch_recv_cs.nonce)}
}))
`,
      (raw: string) => JSON.parse(raw)
    );
    return result;
  }

  /**
   * Emit a cipher_state_update event, detecting key rotation.
   */
  private emitCipherStateUpdate(state: { send: CipherStateSnapshot; recv: CipherStateSnapshot }): void {
    let rotated: "send" | "recv" | undefined;

    if (this._lastSendKey && state.send.key !== this._lastSendKey) {
      rotated = "send";
    } else if (this._lastRecvKey && state.recv.key !== this._lastRecvKey) {
      rotated = "recv";
    }

    this._lastSendKey = state.send.key;
    this._lastRecvKey = state.recv.key;

    this.emit({ type: "cipher_state_update", send: state.send, recv: state.recv, rotated });
  }

  /**
   * Send an encrypted message to the server.
   * Only valid in transport_ready state.
   */
  async sendMessage(plaintext: string): Promise<void> {
    if (this.state !== "transport_ready") {
      throw new Error(
        `Cannot send message in state "${this.state}"`
      );
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    // Encrypt using student's CipherState.encrypt_message
    const plaintextHex = bytesToHex(
      new TextEncoder().encode(plaintext)
    );

    const encryptResult = await this.runPythonAndParse<string>(
      `
_pt_bytes = bytes.fromhex("${plaintextHex}")
_ct = _orch_send_cs.encrypt_message(_pt_bytes)
print(_ct.hex())
`,
      (raw: string) => raw.trim()
    );

    const ciphertext = hexToBytes(encryptResult);
    this.ws.send(ciphertext);

    if (!this._burstMode) {
      this.emit({
        type: "message_sent",
        plaintext,
        ciphertext,
      });

      // Emit cipher state update after each send
      try {
        const csState = await this.queryCipherState();
        this.emitCipherStateUpdate(csState);
      } catch { /* ignore */ }
    }
  }

  /**
   * Send N encrypted messages rapidly to demonstrate key rotation.
   *
   * Each message uses 2 nonces. At nonce 1000 (500 messages), the student's
   * _maybe_rotate() fires and derives new keys. This method batches progress
   * callbacks to keep the UI responsive.
   *
   * During burst, individual message_sent/received events are suppressed.
   * Incoming server responses are buffered and drained after all sends.
   */
  async sendBurst(
    count: number,
    onProgress: (info: BurstProgressInfo) => void
  ): Promise<void> {
    if (this.state !== "transport_ready") {
      throw new Error("Not in transport mode");
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    this._burstMode = true;
    this._burstIncomingBuffer = [];

    // Snapshot initial state
    let state = await this.queryCipherState();
    let prevSendKey = state.send.key;
    this._lastSendKey = state.send.key;

    const plaintextHex = bytesToHex(new TextEncoder().encode("ping"));
    const PROGRESS_INTERVAL = 10; // report every N messages

    try {
      for (let i = 0; i < count; i++) {
        // Encrypt and send (no waiting for response)
        const ctHex = await this.runPythonAndParse<string>(
          `_pt_bytes = bytes.fromhex("${plaintextHex}")\n_ct = _orch_send_cs.encrypt_message(_pt_bytes)\nprint(_ct.hex())`,
          (raw) => raw.trim()
        );
        this.ws!.send(hexToBytes(ctHex));

        // Report progress at intervals and at the end
        if ((i + 1) % PROGRESS_INTERVAL === 0 || i === count - 1) {
          state = await this.queryCipherState();
          const rotated = state.send.key !== prevSendKey;
          if (rotated) prevSendKey = state.send.key;

          onProgress({
            phase: "send",
            sent: i + 1,
            total: count,
            sendNonce: state.send.nonce,
            recvNonce: state.recv.nonce,
            sendRotated: rotated,
          });

          this.emitCipherStateUpdate(state);
        }
      }

      // Drain phase: decrypt buffered server responses to keep recv CipherState in sync
      this._burstMode = false;
      const buffer = [...this._burstIncomingBuffer];
      this._burstIncomingBuffer = [];

      if (buffer.length > 0) {
        onProgress({
          phase: "drain",
          sent: count,
          total: count,
          sendNonce: state.send.nonce,
          recvNonce: state.recv.nonce,
          sendRotated: false,
        });

        for (const ct of buffer) {
          try {
            await this.decryptTransportMessage(ct);
          } catch { /* ignore */ }
        }
      }

      // Final state update — detect recv rotation from draining pong responses
      state = await this.queryCipherState();
      this.emitCipherStateUpdate(state);
    } finally {
      this._burstMode = false;
      this._burstIncomingBuffer = [];
    }
  }

  /**
   * Register a callback for incoming transport messages.
   * The callback receives the decrypted plaintext and the raw ciphertext.
   */
  onMessage(
    callback: (plaintext: string, ciphertext: Uint8Array) => void
  ): void {
    this.messageHandler = callback;
  }

  /**
   * Clean up all resources: close WebSocket, clear timeouts.
   */
  destroy(): void {
    this.destroyed = true;
    this.cleanupWebSocket();
    this.actTimeouts.forEach((timer) => {
      clearTimeout(timer);
    });
    this.actTimeouts.clear();
    this.listeners.clear();
  }

  // ─── Private: WebSocket Management ─────────────────────────────────────

  private connectWebSocket(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.binaryType = "arraybuffer";

        const connectTimeout = setTimeout(() => {
          reject(new Error("WebSocket connection timed out"));
          this.ws?.close();
        }, ACT_TIMEOUT_MS);

        this.ws.onopen = () => {
          clearTimeout(connectTimeout);
          resolve();
        };

        this.ws.onerror = (_event) => {
          clearTimeout(connectTimeout);
          reject(
            new Error("WebSocket connection failed")
          );
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectTimeout);
          if (this.state !== "transport_ready" && this.state !== "error") {
            // Unexpected close during handshake
            const reason = event.reason || `code ${event.code}`;
            this.transitionToError(
              `Server closed connection: ${reason}`
            );
          }
          // Reject any pending WebSocket message wait
          if (this.wsReject) {
            this.wsReject(
              new Error(
                `WebSocket closed: ${event.reason || `code ${event.code}`}`
              )
            );
            this.wsResolve = null;
            this.wsReject = null;
          }
        };

        this.ws.onmessage = (event) => {
          const data =
            event.data instanceof ArrayBuffer
              ? new Uint8Array(event.data)
              : new Uint8Array(0);

          // If we're waiting for a handshake message, resolve the promise
          if (this.wsResolve) {
            const resolve = this.wsResolve;
            this.wsResolve = null;
            this.wsReject = null;
            resolve(data);
          }
        };
      } catch (err) {
        reject(
          new Error(
            `Failed to create WebSocket: ${err instanceof Error ? err.message : String(err)}`
          )
        );
      }
    });
  }

  /**
   * Wait for a single binary WebSocket message with a timeout.
   * @param act - The act number (for timeout error messages)
   */
  private waitForWsMessage(act: number): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.wsResolve = null;
        this.wsReject = null;
        reject(
          new Error(`Act ${act}: timed out waiting for server response`)
        );
      }, ACT_TIMEOUT_MS);

      this.actTimeouts.set(act, timer);

      this.wsResolve = (data: Uint8Array) => {
        clearTimeout(timer);
        this.actTimeouts.delete(act);
        resolve(data);
      };

      this.wsReject = (err: Error) => {
        clearTimeout(timer);
        this.actTimeouts.delete(act);
        reject(err);
      };
    });
  }

  private setupTransportHandler(): void {
    if (!this.ws) return;

    this.ws.onmessage = async (event) => {
      if (this.state !== "transport_ready") return;

      const ciphertext =
        event.data instanceof ArrayBuffer
          ? new Uint8Array(event.data)
          : new Uint8Array(0);

      // During burst: buffer incoming messages to avoid Pyodide reentrancy
      if (this._burstMode) {
        this._burstIncomingBuffer.push(ciphertext);
        return;
      }

      try {
        const plaintext = await this.decryptTransportMessage(ciphertext);

        this.emit({
          type: "message_received",
          plaintext,
          ciphertext,
        });

        // Emit cipher state update after each receive
        try {
          const csState = await this.queryCipherState();
          this.emitCipherStateUpdate(csState);
        } catch { /* ignore */ }

        if (this.messageHandler) {
          this.messageHandler(plaintext, ciphertext);
        }
      } catch (err) {
        this.transitionToError(
          `Failed to decrypt message: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    };

    this.ws.onclose = (event) => {
      if (this.state === "transport_ready") {
        const reason = event.reason || `code ${event.code}`;
        this.transitionToError(`Connection closed: ${reason}`);
      }
    };
  }

  private cleanupWebSocket(): void {
    if (this.ws) {
      try {
        if (
          this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING
        ) {
          this.ws.close();
        }
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }

  // ─── Private: Pyodide Helpers ──────────────────────────────────────────

  /**
   * Run Python code that prints a result to stdout, then parse it.
   *
   * Uses "run" mode (captures stdout) and extracts the last non-empty
   * line as the return value. The Python code should end with a
   * `print(...)` call that outputs the result (typically JSON).
   */
  private async runPythonAndParse<T>(
    code: string,
    parser: (raw: string) => T
  ): Promise<T> {
    const result = await runPythonCode(code);

    if (result.error) {
      throw new Error(`Python error: ${result.error}`);
    }

    // The output is the last expression evaluated, printed to stdout
    const output = result.output.trim();
    if (!output) {
      throw new Error("Python code produced no output");
    }

    // Take the last non-empty line (the JSON result)
    const lines = output.split("\n").filter((l) => l.trim());
    const lastLine = lines[lines.length - 1];

    return parser(lastLine);
  }

  /**
   * Decrypt a transport message using the student's CipherState.decrypt_message.
   *
   * The server uses its own CipherState for framing:
   *   encrypted_length(18) + encrypted_body(len+16)
   *
   * We pass the raw bytes to the student's decrypt_message, which handles
   * the two-nonce framing.
   */
  private async decryptTransportMessage(
    ciphertext: Uint8Array
  ): Promise<string> {
    const ctHex = bytesToHex(ciphertext);

    const result = await this.runPythonAndParse<string>(
      `
_ct = bytes.fromhex("${ctHex}")
_pt = _orch_recv_cs.decrypt_message(_ct)
print(_pt.decode("utf-8"))
`,
      (raw: string) => raw.trim()
    );

    return result;
  }
}
