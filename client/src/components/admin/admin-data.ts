export const sansFont = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const cardClass = "border-4 border-border bg-card p-4 pixel-shadow";
export const tableClass = "w-full text-left text-sm";
export const thClass = "font-pixel text-base p-3 border-b-2 border-border bg-primary/20";
export const tdClass = "p-3 border-b border-border/30 text-base";

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}

export function truncate(str: string | null, len: number): string {
  if (!str) return "-";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

export function formatMs(ms: number): string {
  if (!ms) return "0 ms";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export interface DashboardData {
  nodeBalance: Record<string, unknown>;
  nodeMetrics: {
    activeNodes: number;
    maxConcurrent: number;
    idleTimeoutMs: number;
    limiterBypassCount: number;
    startupFailures: number;
    cleanup: {
      idleStops: number;
      staleDirsRemoved: number;
    };
    provision: {
      count: number;
      successCount: number;
      failureCount: number;
      timeoutCount: number;
      totalMs: number;
      maxMs: number;
      lastMs: number;
      avgMs: number;
    };
    rpc: Record<string, {
      count: number;
      successCount: number;
      failureCount: number;
      timeoutCount: number;
      totalMs: number;
      maxMs: number;
      lastMs: number;
      avgMs: number;
    }>;
  };
  launchControls: {
    nodeLimiterBypassEnabled: boolean;
  };
  totalSatsPaid: number;
  pendingCount: number;
  recentWithdrawals: Array<{
    id: string;
    k1: string;
    userId: string;
    amountMsats: string;
    status: string;
    bolt11Invoice: string | null;
    checkpointId: string | null;
    errorReason: string | null;
    createdAt: string;
    claimedAt: string | null;
    paidAt: string | null;
  }>;
  users: Array<{
    id: string;
    pubkey: string | null;
    email: string | null;
    displayName: string | null;
    rewardClaimed: boolean;
    createdAt: string;
    lastActiveAt: string | null;
  }>;
  userCount: number;
  checkpointCompletions: Array<{
    id: string;
    userId: string;
    checkpointId: string;
    createdAt: string;
  }>;
  totalViews: number;
  pageStats: Array<{
    page: string;
    views: number;
    avgDuration: number;
  }>;
  recentEvents: Array<{
    id: number;
    userId: string | null;
    sessionId: string | null;
    page: string;
    referrer: string | null;
    duration: number | null;
    createdAt: string;
  }>;
  recentDonations: Array<{
    id: string;
    paymentIndex: string;
    amountSats: number;
    donorName: string;
    message: string | null;
    createdAt: string;
  }>;
  recentFeedback: Array<{
    id: string;
    userId: string | null;
    category: string;
    message: string;
    pageUrl: string;
    chapterTitle: string | null;
    exerciseId: string | null;
    githubIssueUrl: string | null;
    createdAt: string;
  }>;
  userSegments: Record<string, string>;
}

export const TUTORIAL_CONFIGS = {
  noise: {
    checkpoints: [
      { id: "crypto-review", label: "Crypto Review", chapter: "Cryptographic Primitives" },
      { id: "exercise-generate-keypair", label: "Keypair", chapter: "Cryptographic Primitives" },
      { id: "exercise-ecdh", label: "ECDH", chapter: "Cryptographic Primitives" },
      { id: "exercise-hkdf", label: "HKDF", chapter: "Cryptographic Primitives" },
      { id: "setup-wrong-key", label: "Setup Quiz", chapter: "Handshake Setup" },
      { id: "exercise-init-state", label: "Init State", chapter: "Handshake Setup" },
      { id: "exercise-act1-initiator", label: "Act 1 Init", chapter: "Act 1" },
      { id: "exercise-act1-responder", label: "Act 1 Resp", chapter: "Act 1" },
      { id: "act2-both-ephemeral", label: "Act 2 Quiz", chapter: "Act 2" },
      { id: "exercise-act2-responder", label: "Act 2 Resp", chapter: "Act 2" },
      { id: "exercise-act2-initiator", label: "Act 2 Init", chapter: "Act 2" },
      { id: "act3-nonce-one", label: "Act 3 Quiz", chapter: "Act 3" },
      { id: "exercise-act3-initiator", label: "Act 3 Init", chapter: "Act 3" },
      { id: "message-length-limit", label: "Msg Quiz", chapter: "Sending Messages" },
      { id: "exercise-encrypt", label: "Encrypt", chapter: "Sending Messages" },
      { id: "exercise-decrypt", label: "Decrypt", chapter: "Receiving Messages" },
      { id: "exercise-key-rotation", label: "Key Rotation", chapter: "Key Rotation" },
      { id: "noise-lab-complete", label: "Lab Complete", chapter: "Live Connection Lab" },
    ],
    pages: [
      { page: "/noise-tutorial", label: "Intro" },
      { page: "/noise-tutorial/crypto-primitives", label: "Crypto Primitives" },
      { page: "/noise-tutorial/noise-framework", label: "Noise Framework" },
      { page: "/noise-tutorial/handshake-setup", label: "Handshake Setup" },
      { page: "/noise-tutorial/act-1", label: "Act 1" },
      { page: "/noise-tutorial/act-2", label: "Act 2" },
      { page: "/noise-tutorial/act-3", label: "Act 3" },
      { page: "/noise-tutorial/sending-messages", label: "Sending Msgs" },
      { page: "/noise-tutorial/receiving-messages", label: "Receiving Msgs" },
      { page: "/noise-tutorial/key-rotation", label: "Key Rotation" },
      { page: "/noise-tutorial/crypto-review", label: "Crypto Review" },
      { page: "/noise-tutorial/quiz", label: "Quiz" },
      { page: "/noise-tutorial/live-connection", label: "Live Connection Lab" },
    ],
    urlPrefix: "/noise-tutorial",
  },
  lightning: {
    checkpoints: [
      { id: "course-tools-match", label: "Tools Match", chapter: "Bitcoin CLI" },
      { id: "channel-fairness", label: "Fairness", chapter: "Protocols & Fairness" },
      { id: "bip32-derivation", label: "BIP32 Quiz", chapter: "BIP32 Key Derivation" },
      { id: "ln-exercise-channel-key-manager", label: "Channel Keys", chapter: "Channel Keys" },
      { id: "payment-channels-scaling", label: "Scaling Quiz", chapter: "Off-Chain Scaling" },
      { id: "funding-multisig", label: "Multisig Quiz", chapter: "Funding Script" },
      { id: "pubkey-sorting", label: "Sorting Quiz", chapter: "Funding Script" },
      { id: "ln-exercise-funding-script", label: "Fund Script", chapter: "Funding Script" },
      { id: "ln-exercise-funding-tx", label: "Fund Tx", chapter: "Funding Transaction" },
      { id: "gen-funding", label: "Gen Funding", chapter: "Funding Transaction" },
      { id: "asymmetric-commits", label: "Asymmetric", chapter: "Revocable Transactions" },
      { id: "ln-exercise-sign-input", label: "Sign Input", chapter: "Transaction Signing" },
      { id: "revocation-purpose", label: "Revocation Quiz", chapter: "Revocation Keys" },
      { id: "revocation-key-construction", label: "Rev Construct", chapter: "Revocation Keys" },
      { id: "revocation-secret-exchange", label: "Rev Exchange", chapter: "Revocation Keys" },
      { id: "ln-exercise-revocation-pubkey", label: "Rev Pubkey", chapter: "Revocation Keys" },
      { id: "ln-exercise-revocation-privkey", label: "Rev Privkey", chapter: "Revocation Keys" },
      { id: "commitment-secret-algorithm", label: "Secrets Quiz", chapter: "Commitment Secrets" },
      { id: "ln-exercise-commitment-secret", label: "Commit Secret", chapter: "Commitment Secrets" },
      { id: "ln-exercise-per-commitment-point", label: "Commit Point", chapter: "Commitment Secrets" },
      { id: "ln-exercise-derive-pubkey", label: "Derive Pub", chapter: "Key Derivation" },
      { id: "ln-exercise-derive-privkey", label: "Derive Priv", chapter: "Key Derivation" },
      { id: "ln-exercise-get-commitment-keys", label: "Commit Keys", chapter: "Key Derivation" },
      { id: "static-remotekey", label: "Static Remote", chapter: "Commitment Scripts" },
      { id: "ln-exercise-to-remote-script", label: "To Remote", chapter: "Commitment Scripts" },
      { id: "ln-exercise-to-local-script", label: "To Local", chapter: "Commitment Scripts" },
      { id: "obscured-commitment", label: "Obscured Quiz", chapter: "Obscured Commitment" },
      { id: "ln-exercise-obscure-factor", label: "Obscure Factor", chapter: "Obscured Commitment" },
      { id: "ln-exercise-obscured-commitment", label: "Obscured Num", chapter: "Obscured Commitment" },
      { id: "fee-deduction", label: "Fee Quiz", chapter: "Commitment Assembly" },
      { id: "ln-exercise-commitment-outputs", label: "Commit Outputs", chapter: "Commitment Assembly" },
      { id: "ln-exercise-sort-outputs", label: "Sort Outputs", chapter: "Commitment Assembly" },
      { id: "ln-exercise-commitment-tx", label: "Commit Tx", chapter: "Commitment Assembly" },
      { id: "ln-exercise-finalize-commitment", label: "Finalize", chapter: "Commitment Finalization" },
      { id: "gen-commitment", label: "Gen Commit", chapter: "Inspect Commitment" },
      { id: "htlc-preimage-purpose", label: "Preimage Flow", chapter: "Introduction to HTLCs" },
      { id: "offered-vs-received", label: "Offer v Recv", chapter: "Offered HTLCs" },
      { id: "ln-exercise-offered-htlc-script", label: "Offered Script", chapter: "Offered HTLCs" },
      { id: "ln-exercise-htlc-timeout-tx", label: "Timeout Tx", chapter: "Offered HTLCs" },
      { id: "ln-exercise-finalize-htlc-timeout", label: "Timeout Final", chapter: "Offered HTLCs" },
      { id: "gen-htlc-commitment", label: "Gen HTLC Commit", chapter: "HTLC Commitment" },
      { id: "gen-htlc-timeout", label: "Gen HTLC Timeout", chapter: "HTLC Timeout" },
      { id: "htlc-timeout-vs-success", label: "Timeout v Succ", chapter: "Received HTLCs" },
      { id: "ln-exercise-received-htlc-script", label: "Received Script", chapter: "Received HTLCs" },
      { id: "ln-exercise-htlc-success-tx", label: "Success Tx", chapter: "Received HTLCs" },
      { id: "ln-exercise-finalize-htlc-success", label: "Success Final", chapter: "Received HTLCs" },
      { id: "ln-exercise-htlc-outputs", label: "HTLC Outputs", chapter: "HTLC Fees & Dust" },
      { id: "ln-exercise-commitment-tx-htlc", label: "HTLC Commit Tx", chapter: "HTLC Fees & Dust" },
      { id: "htlc-dust", label: "Dust Quiz", chapter: "HTLC Fees & Dust" },
    ],
    pages: [
      { page: "/lightning-tutorial", label: "Intro" },
      { page: "/lightning-tutorial/bitcoin-cli", label: "Bitcoin CLI" },
      { page: "/lightning-tutorial/protocols-fairness", label: "Protocols" },
      { page: "/lightning-tutorial/keys-manager", label: "Keys Manager" },
      { page: "/lightning-tutorial/bip32-derivation", label: "BIP32" },
      { page: "/lightning-tutorial/channel-keys", label: "Channel Keys" },
      { page: "/lightning-tutorial/payment-channels-overview", label: "Off-Chain" },
      { page: "/lightning-tutorial/funding-script", label: "Fund Script" },
      { page: "/lightning-tutorial/funding-transaction", label: "Fund Tx" },
      { page: "/lightning-tutorial/refund-transactions", label: "Refund" },
      { page: "/lightning-tutorial/revocable-transactions", label: "Revocable Tx" },
      { page: "/lightning-tutorial/signing", label: "Signing" },
      { page: "/lightning-tutorial/open-channel", label: "Open Channel" },
      { page: "/lightning-tutorial/revocation-keys", label: "Rev Keys" },
      { page: "/lightning-tutorial/commitment-secrets", label: "Commit Secrets" },
      { page: "/lightning-tutorial/key-derivation", label: "Key Derivation" },
      { page: "/lightning-tutorial/commitment-scripts", label: "Commit Scripts" },
      { page: "/lightning-tutorial/obscured-commitment", label: "Obscured" },
      { page: "/lightning-tutorial/commitment-assembly", label: "Assembly" },
      { page: "/lightning-tutorial/commitment-finalization", label: "Finalization" },
      { page: "/lightning-tutorial/get-commitment-tx", label: "Inspect Commit" },
      { page: "/lightning-tutorial/routing-payments", label: "Routing" },
      { page: "/lightning-tutorial/htlc-introduction", label: "HTLC Intro" },
      { page: "/lightning-tutorial/simple-htlc", label: "Simple HTLC" },
      { page: "/lightning-tutorial/htlcs-on-lightning", label: "HTLCs on LN" },
      { page: "/lightning-tutorial/channel-state-updates", label: "State Updates" },
      { page: "/lightning-tutorial/offered-htlcs", label: "Offered HTLCs" },
      { page: "/lightning-tutorial/get-htlc-commitment", label: "HTLC Commit" },
      { page: "/lightning-tutorial/get-htlc-timeout", label: "HTLC Timeout" },
      { page: "/lightning-tutorial/received-htlcs", label: "Received HTLCs" },
      { page: "/lightning-tutorial/htlc-fees-dust", label: "HTLC Outputs" },
      { page: "/lightning-tutorial/closing-channels", label: "Closing" },
      { page: "/lightning-tutorial/quiz", label: "Quiz" },
      { page: "/lightning-tutorial/pay-it-forward", label: "Pay Forward" },
    ],
    urlPrefix: "/lightning-tutorial",
  },
  "visual-lightning": {
    checkpoints: [] as Array<{ id: string; label: string; chapter: string }>,
    pages: [
      { page: "/visual-lightning", label: "TX Refresher" },
      { page: "/visual-lightning/1", label: "Scaling Problem" },
      { page: "/visual-lightning/2", label: "First Attempt" },
      { page: "/visual-lightning/3", label: "Opening Channel" },
      { page: "/visual-lightning/4", label: "Cheating Problem" },
      { page: "/visual-lightning/5", label: "Commitment Txs" },
      { page: "/visual-lightning/6", label: "Revocation Keys" },
      { page: "/visual-lightning/7", label: "Updating State" },
      { page: "/visual-lightning/8", label: "Lightning Network" },
      { page: "/visual-lightning/9", label: "HTLCs" },
      { page: "/visual-lightning/10", label: "HTLCs & Updates" },
      { page: "/visual-lightning/11", label: "Settling HTLCs" },
      { page: "/visual-lightning/12", label: "Closing Channels" },
    ],
    urlPrefix: "/visual-lightning",
  },
};

export type TutorialKey = keyof typeof TUTORIAL_CONFIGS;
