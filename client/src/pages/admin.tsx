import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";

interface DashboardData {
  nodeBalance: Record<string, unknown>;
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
}

type Tab = "overview" | "users" | "withdrawals" | "checkpoints" | "analytics" | "donations";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}

function truncate(str: string | null, len: number): string {
  if (!str) return "-";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

const ADMIN_SESSION_KEY = "pl_admin_session";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function getSavedSession(): string | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const { password, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
    return password;
  } catch {
    return null;
  }
}

function saveSession(pw: string) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ password: pw, expiresAt: Date.now() + SESSION_TTL_MS }));
}

function clearSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [storedPassword, setStoredPassword] = useState("");
  const [ipAllowed, setIpAllowed] = useState<boolean | null>(null);
  const [spamming, setSpamming] = useState<Set<string>>(new Set());
  const [revealedMessages, setRevealedMessages] = useState<Set<string>>(new Set());
  const [selectedCheckpointUser, setSelectedCheckpointUser] = useState<string | null>(null);
  const [selectedTutorial, setSelectedTutorial] = useState<"noise" | "lightning">("noise");
  const [checkpointSubTab, setCheckpointSubTab] = useState<"funnel" | "pages" | "matrix">("funnel");

  const fetchDashboard = useCallback(async (pw: string) => {
    if (!pw) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/dashboard?password=${encodeURIComponent(pw)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to load dashboard");
        setAuthed(false);
        clearSession();
        return;
      }
      const json = await res.json();
      setData(json);
      setAuthed(true);
      setStoredPassword(pw);
      saveSession(pw);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/check-ip")
      .then((r) => {
        if (!r.ok) return { allowed: false };
        return r.json();
      })
      .then((d) => {
        setIpAllowed(!!d.allowed);
        if (d.allowed) {
          const savedPw = getSavedSession();
          if (savedPw) fetchDashboard(savedPw);
        }
      })
      .catch(() => setIpAllowed(false));
  }, [fetchDashboard]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDashboard(password);
  };

  const refresh = () => {
    fetchDashboard(storedPassword);
  };

  const markSpam = async (donationId: string) => {
    if (!confirm("Mark this donation as spam? The message will be replaced with ⚡⚡⚡ and the name set to Anon.")) return;
    setSpamming((prev) => new Set(prev).add(donationId));
    try {
      const res = await fetch("/api/admin/donation-spam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: storedPassword, donation_id: donationId }),
      });
      if (res.ok) {
        // Update local data
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            recentDonations: prev.recentDonations.map((d) =>
              d.id === donationId ? { ...d, message: "⚡⚡⚡", donorName: "Anon" } : d
            ),
          };
        });
      }
    } catch {}
    setSpamming((prev) => {
      const next = new Set(prev);
      next.delete(donationId);
      return next;
    });
  };

  const toggleReveal = (donationId: string) => {
    setRevealedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(donationId)) next.delete(donationId);
      else next.add(donationId);
      return next;
    });
  };

  if (ipAllowed === null) {
    return null;
  }

  if (!ipAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-pixel text-sm text-foreground/40">404 - PAGE NOT FOUND</div>
      </div>
    );
  }

  // Styles
  const cardClass = "border-4 border-border bg-card p-4 pixel-shadow";
  const tableClass = "w-full text-left text-sm";
  const thClass = "font-pixel text-base p-3 border-b-2 border-border bg-primary/20";
  const sansFont = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const tdClass = "p-3 border-b border-border/30 text-base";
  const tabClass = (tab: Tab) =>
    `block w-full text-left font-pixel text-[11px] px-3 py-2.5 border-b border-border/20 transition-all cursor-pointer ${
      activeTab === tab
        ? "bg-primary/20 border-l-2 border-l-[#FFD700] text-foreground font-semibold"
        : "hover:bg-primary/5 text-foreground/60"
    }`;

  if (!authed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
        <div className={`${cardClass} max-w-md w-full`}>
          <h1 className="font-pixel text-lg mb-6 text-center">ADMIN LOGIN</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full border-2 border-border p-3 bg-background font-mono text-sm focus:outline-none focus:border-primary"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full font-pixel text-sm border-2 border-border bg-primary text-black px-4 py-3 pixel-shadow hover:bg-primary/80 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              {loading ? "LOADING..." : "LOGIN"}
            </button>
            {error && <div className="font-pixel text-xs text-red-500 text-center">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const nodeBalance = data.nodeBalance;
  const sendable = Number(nodeBalance.lightning_sendable_balance || 0);
  const receivable = Number(nodeBalance.lightning_receivable_balance || 0);
  const onchainBalance = Number(nodeBalance.onchain_balance || 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="w-full border-b-4 border-border bg-card p-2 flex justify-between items-center pixel-shadow">
        <Link href="/">
          <span className="font-pixel text-sm hover:text-primary transition-colors cursor-pointer">
            &lt; BACK
          </span>
        </Link>
        <span className="font-pixel text-sm">ADMIN DASHBOARD</span>
        <button
          onClick={refresh}
          className="font-pixel text-[10px] border-2 border-border px-3 py-1 bg-primary text-black hover:bg-primary/80"
        >
          REFRESH
        </button>
      </div>

      <div className="flex-1 flex w-full">
        {/* Left sidebar nav */}
        <nav className="w-36 shrink-0 border-r-2 border-border bg-card">
          <button className={tabClass("overview")} onClick={() => setActiveTab("overview")}>OVERVIEW</button>
          <button className={tabClass("users")} onClick={() => setActiveTab("users")}>USERS ({data.userCount})</button>
          <button className={tabClass("withdrawals")} onClick={() => setActiveTab("withdrawals")}>WITHDRAWALS</button>
          <button className={tabClass("checkpoints")} onClick={() => setActiveTab("checkpoints")}>CHECKPOINTS</button>
          <button className={tabClass("analytics")} onClick={() => setActiveTab("analytics")}>ANALYTICS</button>
          <button className={tabClass("donations")} onClick={() => setActiveTab("donations")}>DONATIONS ({(data.recentDonations || []).length})</button>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0 p-4 md:p-6 max-w-7xl">
        {error && <div className="font-pixel text-xs text-red-500 mb-4">{error}</div>}

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={cardClass}>
                <div className="font-pixel text-[10px] text-foreground/60 mb-2">SENDABLE</div>
                <div className="font-pixel text-lg">{sendable.toLocaleString()} sats</div>
              </div>
              <div className={cardClass}>
                <div className="font-pixel text-[10px] text-foreground/60 mb-2">RECEIVABLE</div>
                <div className="font-pixel text-lg">{receivable.toLocaleString()} sats</div>
              </div>
              <div className={cardClass}>
                <div className="font-pixel text-[10px] text-foreground/60 mb-2">ON-CHAIN</div>
                <div className="font-pixel text-lg">{onchainBalance.toLocaleString()} sats</div>
              </div>
              <div className={cardClass}>
                <div className="font-pixel text-[10px] text-foreground/60 mb-2">TOTAL PAID</div>
                <div className="font-pixel text-lg">{data.totalSatsPaid.toLocaleString()} sats</div>
              </div>
              <div className={cardClass}>
                <div className="font-pixel text-[10px] text-foreground/60 mb-2">PENDING</div>
                <div className="font-pixel text-lg">{data.pendingCount}</div>
              </div>
              <div className={cardClass}>
                <div className="font-pixel text-[10px] text-foreground/60 mb-2">USERS</div>
                <div className="font-pixel text-lg">{data.userCount}</div>
              </div>
              <div className={cardClass}>
                <div className="font-pixel text-[10px] text-foreground/60 mb-2">PAGE VIEWS</div>
                <div className="font-pixel text-lg">{data.totalViews.toLocaleString()}</div>
              </div>
              <div className={cardClass}>
                <div className="font-pixel text-[10px] text-foreground/60 mb-2">CHECKPOINTS</div>
                <div className="font-pixel text-lg">{data.checkpointCompletions.length}</div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className={`${cardClass} overflow-x-auto`}>
            <table className={tableClass} style={{ fontFamily: sansFont }}>
              <thead>
                <tr>
                  <th className={thClass}>ID</th>
                  <th className={thClass}>EMAIL</th>
                  <th className={thClass}>PUBKEY</th>
                  <th className={thClass}>NAME</th>
                  <th className={thClass}>QUIZ REWARD</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="hover:bg-primary/5">
                    <td className={tdClass}>{truncate(u.id, 8)}</td>
                    <td className={tdClass}>{u.email || "-"}</td>
                    <td className={tdClass}>{truncate(u.pubkey, 12)}</td>
                    <td className={tdClass}>{u.displayName || "-"}</td>
                    <td className={tdClass}>
                      <span className={`font-pixel text-[10px] ${u.rewardClaimed ? "text-green-600" : "text-foreground/40"}`}>
                        {u.rewardClaimed ? "CLAIMED" : "NO"}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.users.length === 0 && (
                  <tr><td colSpan={5} className={`${tdClass} text-center text-foreground/40`}>No users</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Withdrawals Tab */}
        {activeTab === "withdrawals" && (
          <div className={`${cardClass} overflow-x-auto`}>
            <table className={tableClass} style={{ fontFamily: sansFont }}>
              <thead>
                <tr>
                  <th className={thClass}>STATUS</th>
                  <th className={thClass}>AMOUNT</th>
                  <th className={thClass}>USER</th>
                  <th className={thClass}>TYPE</th>
                  <th className={thClass}>CREATED</th>
                  <th className={thClass}>PAID</th>
                  <th className={thClass}>ERROR</th>
                </tr>
              </thead>
              <tbody>
                {data.recentWithdrawals.map((w) => {
                  const sats = Math.floor(parseInt(w.amountMsats, 10) / 1000);
                  const statusColor =
                    w.status === "paid" ? "text-green-600" :
                    w.status === "pending" || w.status === "claimed" ? "text-yellow-600" :
                    w.status === "failed" ? "text-red-500" :
                    "text-foreground/40";
                  return (
                    <tr key={w.id} className="hover:bg-primary/5">
                      <td className={tdClass}>
                        <span className={`font-pixel text-[10px] ${statusColor}`}>{w.status.toUpperCase()}</span>
                      </td>
                      <td className={tdClass}>{sats} sats</td>
                      <td className={tdClass}>{truncate(w.userId, 8)}</td>
                      <td className={tdClass}>{w.checkpointId || "quiz"}</td>
                      <td className={tdClass}>{formatDate(w.createdAt)}</td>
                      <td className={tdClass}>{formatDate(w.paidAt)}</td>
                      <td className={tdClass}>{w.errorReason || "-"}</td>
                    </tr>
                  );
                })}
                {data.recentWithdrawals.length === 0 && (
                  <tr><td colSpan={7} className={`${tdClass} text-center text-foreground/40`}>No withdrawals</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Checkpoints Tab */}
        {activeTab === "checkpoints" && (() => {
          const TUTORIAL_CONFIGS = {
            noise: {
              checkpoints: [
                { id: "crypto-review", label: "Crypto Review", chapter: "Cryptographic Primitives" },
                { id: "setup-wrong-key", label: "Setup", chapter: "Handshake Setup" },
                { id: "act2-both-ephemeral", label: "Act 2", chapter: "Act 2: Ephemeral Key Exchange" },
                { id: "act3-nonce-one", label: "Act 3", chapter: "Act 3: Identity Reveal" },
                { id: "message-length-limit", label: "Messaging", chapter: "Sending Encrypted Messages" },
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
                { page: "/noise-tutorial/quiz", label: "Quiz" },
              ],
              urlPrefix: "/noise-tutorial",
            },
            lightning: {
              checkpoints: [
                { id: "channel-fairness", label: "Fairness", chapter: "Protocols & Fairness" },
                { id: "ln-exercise-keys-manager", label: "Keys Manager", chapter: "Key Management" },
                { id: "bip32-derivation", label: "BIP32 Quiz", chapter: "BIP32 Key Derivation" },
                { id: "ln-exercise-derive-key", label: "Derive Key", chapter: "BIP32 Key Derivation" },
                { id: "ln-exercise-channel-keys", label: "Channel Keys", chapter: "Channel Keys" },
                { id: "payment-channels-scaling", label: "Scaling Quiz", chapter: "Off-Chain Scaling" },
                { id: "funding-multisig", label: "Multisig Quiz", chapter: "Funding Script" },
                { id: "pubkey-sorting", label: "Sorting Quiz", chapter: "Funding Script" },
                { id: "ln-exercise-funding-script", label: "Fund Script", chapter: "Funding Script" },
                { id: "ln-exercise-funding-tx", label: "Fund Tx", chapter: "Funding Transaction" },
                { id: "asymmetric-commits", label: "Asymmetric", chapter: "Revocable Transactions" },
                { id: "ln-exercise-sign-input", label: "Sign Input", chapter: "Transaction Signing" },
                { id: "revocation-purpose", label: "Revocation Quiz", chapter: "Revocation Keys" },
                { id: "ln-exercise-revocation-pubkey", label: "Rev Pubkey", chapter: "Revocation Keys" },
                { id: "ln-exercise-revocation-privkey", label: "Rev Privkey", chapter: "Revocation Keys" },
                { id: "commitment-secret-algorithm", label: "Secrets Quiz", chapter: "Commitment Secrets" },
                { id: "ln-exercise-commitment-secret", label: "Commit Secret", chapter: "Commitment Secrets" },
                { id: "ln-exercise-per-commitment-point", label: "Commit Point", chapter: "Commitment Secrets" },
                { id: "ln-exercise-derive-pubkey", label: "Derive Pub", chapter: "Key Derivation" },
                { id: "ln-exercise-derive-privkey", label: "Derive Priv", chapter: "Key Derivation" },
                { id: "ln-exercise-to-remote-script", label: "To Remote", chapter: "Commitment Scripts" },
                { id: "ln-exercise-to-local-script", label: "To Local", chapter: "Commitment Scripts" },
                { id: "ln-exercise-obscure-factor", label: "Obscure Factor", chapter: "Obscured Commitment" },
                { id: "ln-exercise-obscured-commitment", label: "Obscured Num", chapter: "Obscured Commitment" },
                { id: "ln-exercise-commitment-outputs", label: "Commit Outputs", chapter: "Commitment Assembly" },
                { id: "ln-exercise-sort-outputs", label: "Sort Outputs", chapter: "Commitment Assembly" },
                { id: "ln-exercise-commitment-tx", label: "Commit Tx", chapter: "Commitment Assembly" },
                { id: "ln-exercise-finalize-commitment", label: "Finalize", chapter: "Commitment Finalization" },
                { id: "offered-vs-received", label: "HTLC Types", chapter: "Introduction to HTLCs" },
                { id: "ln-exercise-offered-htlc-script", label: "Offered Script", chapter: "Offered HTLCs" },
                { id: "ln-exercise-htlc-timeout-tx", label: "Timeout Tx", chapter: "Offered HTLCs" },
                { id: "ln-exercise-finalize-htlc-timeout", label: "Timeout Final", chapter: "Offered HTLCs" },
                { id: "htlc-timeout-vs-success", label: "Timeout v Succ", chapter: "Received HTLCs" },
                { id: "ln-exercise-received-htlc-script", label: "Received Script", chapter: "Received HTLCs" },
                { id: "ln-exercise-htlc-success-tx", label: "Success Tx", chapter: "Received HTLCs" },
                { id: "ln-exercise-finalize-htlc-success", label: "Success Final", chapter: "Received HTLCs" },
                { id: "htlc-dust", label: "Dust Quiz", chapter: "HTLC Fees & Dust" },
                { id: "p2wsh-wrapping", label: "P2WSH Quiz", chapter: "HTLC Fees & Dust" },
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
                { page: "/lightning-tutorial/htlc-fees-dust", label: "Fees & Dust" },
                { page: "/lightning-tutorial/closing-channels", label: "Closing" },
                { page: "/lightning-tutorial/quiz", label: "Quiz" },
                { page: "/lightning-tutorial/pay-it-forward", label: "Pay Forward" },
              ],
              urlPrefix: "/lightning-tutorial",
            },
          };
          const config = TUTORIAL_CONFIGS[selectedTutorial];
          const CHECKPOINT_ORDER = config.checkpoints;
          const TUTORIAL_PAGES = config.pages;
          const checkpointIdSet = new Set(CHECKPOINT_ORDER.map(cp => cp.id));

          // Build user maps
          const userCheckpoints: Record<string, Set<string>> = {};
          const userCheckpointDates: Record<string, Record<string, string>> = {};
          const filteredCompletions = data.checkpointCompletions.filter(c => checkpointIdSet.has(c.checkpointId));
          for (const c of filteredCompletions) {
            if (!userCheckpoints[c.userId]) {
              userCheckpoints[c.userId] = new Set();
              userCheckpointDates[c.userId] = {};
            }
            userCheckpoints[c.userId].add(c.checkpointId);
            userCheckpointDates[c.userId][c.checkpointId] = c.createdAt;
          }

          const userMap: Record<string, { name: string; email: string | null }> = {};
          for (const u of data.users) {
            userMap[u.id] = { name: u.displayName || truncate(u.id, 8), email: u.email };
          }

          const activeUserIds = Object.keys(userCheckpoints).sort((a, b) =>
            userCheckpoints[b].size - userCheckpoints[a].size
          );

          const pageStatsMap: Record<string, { views: number; avgDuration: number; totalDuration: number }> = {};
          for (const p of data.pageStats) {
            pageStatsMap[p.page] = { views: p.views, avgDuration: p.avgDuration, totalDuration: Math.round(p.avgDuration * p.views) };
          }

          // Build per-user page stats from recentEvents
          const userPageEvents: Record<string, Record<string, { visits: number; totalDuration: number }>> = {};
          for (const e of data.recentEvents) {
            if (!e.userId) continue;
            if (!e.page.startsWith(config.urlPrefix)) continue;
            if (!userPageEvents[e.userId]) userPageEvents[e.userId] = {};
            if (!userPageEvents[e.userId][e.page]) userPageEvents[e.userId][e.page] = { visits: 0, totalDuration: 0 };
            userPageEvents[e.userId][e.page].visits++;
            if (e.duration != null) userPageEvents[e.userId][e.page].totalDuration += e.duration;
          }

          const formatTime = (seconds: number) => {
            if (seconds < 60) return `${seconds}s`;
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            if (m < 60) return `${m}m ${s}s`;
            const h = Math.floor(m / 60);
            return `${h}h ${m % 60}m`;
          };

          // Metrics
          const totalUsers = data.userCount;
          const usersWithAny = activeUserIds.length;
          const completionCounts = CHECKPOINT_ORDER.map(cp =>
            Object.keys(userCheckpoints).filter(uid => userCheckpoints[uid].has(cp.id)).length
          );
          const usersCompletedAll = activeUserIds.filter(uid =>
            CHECKPOINT_ORDER.every(cp => userCheckpoints[uid].has(cp.id))
          ).length;

          const farthestCheckpoint: Record<string, number> = {};
          for (const uid of activeUserIds) {
            let farthest = -1;
            CHECKPOINT_ORDER.forEach((cp, i) => {
              if (userCheckpoints[uid].has(cp.id)) farthest = i;
            });
            farthestCheckpoint[uid] = farthest;
          }
          const farthestDistribution = CHECKPOINT_ORDER.map((_, i) =>
            activeUserIds.filter(uid => farthestCheckpoint[uid] === i).length
          );

          const sel = selectedCheckpointUser;
          const selInfo = sel ? userMap[sel] : null;
          const selCompleted = sel ? userCheckpoints[sel] : null;
          const selDates = sel ? userCheckpointDates[sel] : null;
          const selTotal = sel && selCompleted ? CHECKPOINT_ORDER.filter(cp => selCompleted.has(cp.id)).length : 0;
          const selPageData = sel ? userPageEvents[sel] : null;

          // Withdrawals for selected user
          const selWithdrawals = sel ? data.recentWithdrawals.filter(w => w.userId === sel) : [];

          const sidebarBtnClass = (uid: string | null) =>
            `block w-full text-left px-3 py-2 text-sm border-b border-border/20 transition-colors cursor-pointer truncate ${
              selectedCheckpointUser === uid
                ? "bg-primary/20 border-l-2 border-l-[#FFD700] font-semibold"
                : "hover:bg-primary/5"
            }`;

          return (
            <div className="space-y-4">
              {/* Tutorial toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedTutorial("noise"); setSelectedCheckpointUser(null); }}
                  className={`font-pixel text-[11px] px-4 py-2 border-2 border-border transition-all ${
                    selectedTutorial === "noise"
                      ? "bg-primary/20 border-[#FFD700] text-foreground font-semibold"
                      : "hover:bg-primary/5 text-foreground/60"
                  }`}
                >
                  NOISE
                </button>
                <button
                  onClick={() => { setSelectedTutorial("lightning"); setSelectedCheckpointUser(null); }}
                  className={`font-pixel text-[11px] px-4 py-2 border-2 border-border transition-all ${
                    selectedTutorial === "lightning"
                      ? "bg-primary/20 border-[#FFD700] text-foreground font-semibold"
                      : "hover:bg-primary/5 text-foreground/60"
                  }`}
                >
                  LIGHTNING
                </button>
              </div>
            <div className="flex gap-4" style={{ minHeight: 500 }}>
              {/* Left sidebar */}
              <div className="w-48 shrink-0 border-2 border-border bg-card overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
                <button
                  onClick={() => setSelectedCheckpointUser(null)}
                  className={sidebarBtnClass(null)}
                  style={{ fontFamily: sansFont }}
                >
                  <span className="font-pixel text-[10px]">ALL USERS</span>
                </button>
                <div className="px-3 py-1 font-pixel text-[9px] text-foreground/40 bg-border/10 border-b border-border/20">
                  {activeUserIds.length} WITH CHECKPOINTS
                </div>
                {activeUserIds.map(uid => {
                  const info = userMap[uid];
                  const count = userCheckpoints[uid].size;
                  const allDone = count === CHECKPOINT_ORDER.length;
                  return (
                    <button
                      key={uid}
                      onClick={() => setSelectedCheckpointUser(uid)}
                      className={sidebarBtnClass(uid)}
                      style={{ fontFamily: sansFont }}
                    >
                      <div className="flex items-center gap-1.5">
                        {allDone && <span className="text-green-600 text-xs">✓</span>}
                        <span className="truncate">{info?.name || truncate(uid, 8)}</span>
                      </div>
                      <div className="text-[11px] text-foreground/40">{count}/{CHECKPOINT_ORDER.length} checkpoints</div>
                    </button>
                  );
                })}
              </div>

              {/* Right content */}
              <div className="flex-1 min-w-0 space-y-4">
                {!sel ? (
                  <>
                    {/* ALL USERS VIEW */}

                    {/* Metrics row */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className={cardClass}>
                        <div className="font-pixel text-[9px] text-foreground/60 mb-1">TOTAL USERS</div>
                        <div className="font-pixel text-base">{totalUsers}</div>
                      </div>
                      <div className={cardClass}>
                        <div className="font-pixel text-[9px] text-foreground/60 mb-1">STARTED</div>
                        <div className="font-pixel text-base">{usersWithAny}</div>
                        <div className="text-[11px] text-foreground/40" style={{ fontFamily: sansFont }}>{totalUsers > 0 ? `${Math.round(usersWithAny / totalUsers * 100)}%` : "-"}</div>
                      </div>
                      <div className={cardClass}>
                        <div className="font-pixel text-[9px] text-foreground/60 mb-1">ALL {CHECKPOINT_ORDER.length}</div>
                        <div className="font-pixel text-base">{usersCompletedAll}</div>
                        <div className="text-[11px] text-foreground/40" style={{ fontFamily: sansFont }}>{usersWithAny > 0 ? `${Math.round(usersCompletedAll / usersWithAny * 100)}%` : "-"} of starters</div>
                      </div>
                      <div className={cardClass}>
                        <div className="font-pixel text-[9px] text-foreground/60 mb-1">COMPLETIONS</div>
                        <div className="font-pixel text-base">{filteredCompletions.length}</div>
                      </div>
                    </div>

                    {/* Sub-tabs */}
                    <div className="flex gap-1 border-b-2 border-border">
                      {(["funnel", "pages", "matrix"] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setCheckpointSubTab(tab)}
                          className={`font-pixel text-[10px] px-3 py-2 transition-all ${
                            checkpointSubTab === tab
                              ? "bg-primary/20 border-b-2 border-b-[#FFD700] text-foreground font-semibold -mb-[2px]"
                              : "hover:bg-primary/5 text-foreground/60"
                          }`}
                        >
                          {tab === "funnel" ? "FUNNEL" : tab === "pages" ? "PAGE TIMES" : "USER MATRIX"}
                        </button>
                      ))}
                    </div>

                    {/* Funnel sub-tab */}
                    {checkpointSubTab === "funnel" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className={cardClass}>
                          <div className="font-pixel text-[10px] mb-2">COMPLETION FUNNEL</div>
                          <div className="space-y-1.5" style={{ fontFamily: sansFont }}>
                            {CHECKPOINT_ORDER.map((cp, i) => {
                              const count = completionCounts[i];
                              const pct = usersWithAny > 0 ? Math.round(count / usersWithAny * 100) : 0;
                              return (
                                <div key={cp.id} className="flex items-center gap-2">
                                  <div className="w-20 text-xs text-foreground/60 shrink-0">{cp.label}</div>
                                  <div className="flex-1 h-5 bg-border/20 relative overflow-hidden border border-border/30">
                                    <div className="h-full bg-[#FFD700]/60" style={{ width: `${pct}%` }} />
                                    <div className="absolute inset-0 flex items-center px-2 text-[11px] font-semibold">{count} ({pct}%)</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className={cardClass}>
                          <div className="font-pixel text-[10px] mb-2">WHERE USERS STOPPED</div>
                          <div className="space-y-1.5" style={{ fontFamily: sansFont }}>
                            {CHECKPOINT_ORDER.map((cp, i) => {
                              const count = farthestDistribution[i];
                              const pct = usersWithAny > 0 ? Math.round(count / usersWithAny * 100) : 0;
                              return (
                                <div key={cp.id} className="flex items-center gap-2">
                                  <div className="w-20 text-xs text-foreground/60 shrink-0">{cp.label}</div>
                                  <div className="flex-1 h-5 bg-border/20 relative overflow-hidden border border-border/30">
                                    <div className="h-full bg-red-400/50" style={{ width: `${Math.max(pct, 3)}%` }} />
                                    <div className="absolute inset-0 flex items-center px-2 text-[11px] font-semibold">{count} ({pct}%)</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Page Times sub-tab */}
                    {checkpointSubTab === "pages" && (
                      <div className={cardClass}>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs" style={{ fontFamily: sansFont }}>
                            <thead>
                              <tr>
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">PAGE</th>
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">VIEWS</th>
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">AVG TIME</th>
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">TOTAL TIME</th>
                              </tr>
                            </thead>
                            <tbody>
                              {TUTORIAL_PAGES.map(tp => {
                                const stats = pageStatsMap[tp.page];
                                return (
                                  <tr key={tp.page} className="hover:bg-primary/5">
                                    <td className="p-2 border-b border-border/30 text-sm">{tp.label}</td>
                                    <td className="p-2 border-b border-border/30 text-sm">{stats?.views ?? 0}</td>
                                    <td className="p-2 border-b border-border/30 text-sm">{stats ? formatTime(stats.avgDuration) : "-"}</td>
                                    <td className="p-2 border-b border-border/30 text-sm">{stats ? formatTime(stats.totalDuration) : "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* User Matrix sub-tab */}
                    {checkpointSubTab === "matrix" && (
                      <div className={cardClass}>
                        <div className="font-pixel text-[10px] mb-2">USER PROGRESS ({activeUserIds.length})</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs" style={{ fontFamily: sansFont }}>
                            <thead>
                              <tr>
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">USER</th>
                                {CHECKPOINT_ORDER.map(cp => (
                                  <th key={cp.id} className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20 text-center" title={cp.chapter}>{cp.label}</th>
                                ))}
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20 text-center">TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeUserIds.map(uid => {
                                const info = userMap[uid];
                                const completed = userCheckpoints[uid];
                                const total = CHECKPOINT_ORDER.filter(cp => completed.has(cp.id)).length;
                                const allDone = total === CHECKPOINT_ORDER.length;
                                return (
                                  <tr
                                    key={uid}
                                    className={`hover:bg-primary/10 cursor-pointer ${allDone ? "bg-green-500/5" : ""}`}
                                    onClick={() => setSelectedCheckpointUser(uid)}
                                  >
                                    <td className="p-2 border-b border-border/30 text-sm">
                                      {info?.name || truncate(uid, 8)}
                                    </td>
                                    {CHECKPOINT_ORDER.map(cp => {
                                      const done = completed.has(cp.id);
                                      return (
                                        <td key={cp.id} className="p-2 border-b border-border/30 text-center">
                                          {done ? (
                                            <span className="text-green-600 font-bold">✓</span>
                                          ) : (
                                            <span className="text-foreground/20">--</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className={`p-2 border-b border-border/30 text-center font-semibold ${allDone ? "text-green-600" : ""}`}>
                                      {total}/{CHECKPOINT_ORDER.length}
                                    </td>
                                  </tr>
                                );
                              })}
                              {activeUserIds.length === 0 && (
                                <tr><td colSpan={CHECKPOINT_ORDER.length + 2} className="p-2 border-b border-border/30 text-center text-foreground/40">No completions yet</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* SINGLE USER VIEW */}
                    <div className={cardClass}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-pixel text-sm">{selInfo?.name || truncate(sel, 12)}</div>
                          {selInfo?.email && <div className="text-xs text-foreground/40" style={{ fontFamily: sansFont }}>{selInfo.email}</div>}
                          <div className="text-xs text-foreground/30 font-mono mt-0.5">{sel}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-pixel text-lg ${selTotal === CHECKPOINT_ORDER.length ? "text-green-600" : ""}`}>
                            {selTotal}/{CHECKPOINT_ORDER.length}
                          </div>
                          <div className="font-pixel text-[9px] text-foreground/40">CHECKPOINTS</div>
                        </div>
                      </div>

                      {/* Checkpoint list */}
                      <div className="space-y-1.5" style={{ fontFamily: sansFont }}>
                        {CHECKPOINT_ORDER.map(cp => {
                          const done = selCompleted?.has(cp.id);
                          const date = selDates?.[cp.id];
                          return (
                            <div key={cp.id} className={`flex items-center gap-3 p-2 border border-border/20 ${done ? "bg-green-500/5" : "bg-border/5"}`}>
                              <span className={`text-base font-bold ${done ? "text-green-600" : "text-foreground/20"}`}>
                                {done ? "✓" : "—"}
                              </span>
                              <div className="flex-1">
                                <div className="text-sm font-medium">{cp.chapter}</div>
                                <div className="text-[11px] text-foreground/40">{cp.id}</div>
                              </div>
                              {done && date && (
                                <div className="text-xs text-foreground/40 text-right">
                                  {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  <br/>
                                  {new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* User page time */}
                    <div className={cardClass}>
                      <div className="font-pixel text-[10px] mb-2">TIME ON PAGES</div>
                      {selPageData ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs" style={{ fontFamily: sansFont }}>
                            <thead>
                              <tr>
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">PAGE</th>
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">VISITS</th>
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">TOTAL TIME</th>
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">AVG TIME</th>
                              </tr>
                            </thead>
                            <tbody>
                              {TUTORIAL_PAGES.map(tp => {
                                const pd = selPageData[tp.page];
                                if (!pd) return (
                                  <tr key={tp.page} className="text-foreground/30">
                                    <td className="p-2 border-b border-border/30 text-sm">{tp.label}</td>
                                    <td className="p-2 border-b border-border/30 text-sm">—</td>
                                    <td className="p-2 border-b border-border/30 text-sm">—</td>
                                    <td className="p-2 border-b border-border/30 text-sm">—</td>
                                  </tr>
                                );
                                const avg = pd.visits > 0 ? Math.round(pd.totalDuration / pd.visits) : 0;
                                return (
                                  <tr key={tp.page} className="hover:bg-primary/5">
                                    <td className="p-2 border-b border-border/30 text-sm">{tp.label}</td>
                                    <td className="p-2 border-b border-border/30 text-sm">{pd.visits}</td>
                                    <td className="p-2 border-b border-border/30 text-sm">{formatTime(pd.totalDuration)}</td>
                                    <td className="p-2 border-b border-border/30 text-sm">{formatTime(avg)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-sm text-foreground/40" style={{ fontFamily: sansFont }}>No page visit data for this user</div>
                      )}
                    </div>

                    {/* User withdrawals */}
                    {selWithdrawals.length > 0 && (
                      <div className={cardClass}>
                        <div className="font-pixel text-[10px] mb-2">WITHDRAWALS ({selWithdrawals.length})</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs" style={{ fontFamily: sansFont }}>
                            <thead>
                              <tr>
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">STATUS</th>
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">AMOUNT</th>
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">TYPE</th>
                                <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">DATE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selWithdrawals.map(w => {
                                const sats = Math.floor(parseInt(w.amountMsats, 10) / 1000);
                                const statusColor = w.status === "paid" ? "text-green-600" : w.status === "pending" || w.status === "claimed" ? "text-yellow-600" : w.status === "failed" ? "text-red-500" : "text-foreground/40";
                                return (
                                  <tr key={w.id} className="hover:bg-primary/5">
                                    <td className="p-2 border-b border-border/30"><span className={`font-pixel text-[10px] ${statusColor}`}>{w.status.toUpperCase()}</span></td>
                                    <td className="p-2 border-b border-border/30 text-sm">{sats} sats</td>
                                    <td className="p-2 border-b border-border/30 text-sm">{w.checkpointId || "quiz"}</td>
                                    <td className="p-2 border-b border-border/30 text-sm">{formatDate(w.paidAt || w.createdAt)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            </div>
          );
        })()}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (() => {
          const fmtTime = (s: number) => {
            if (s < 60) return `${s}s`;
            const m = Math.floor(s / 60);
            if (m < 60) return `${m}m ${s % 60}s`;
            return `${Math.floor(m / 60)}h ${m % 60}m`;
          };

          const totalViews = data.pageStats.reduce((s, p) => s + p.views, 0);
          const uniqueUsers = new Set(data.recentEvents.filter(e => e.userId).map(e => e.userId)).size;
          const uniqueSessions = new Set(data.recentEvents.filter(e => e.sessionId).map(e => e.sessionId)).size;
          const durEvents = data.recentEvents.filter(e => e.duration != null && e.duration > 0);
          const avgDuration = durEvents.length > 0 ? Math.round(durEvents.reduce((s, e) => s + (e.duration || 0), 0) / durEvents.length) : 0;

          // Group by section
          const sections: { label: string; prefix: string }[] = [
            { label: "Lightning Tutorial", prefix: "/lightning-tutorial" },
            { label: "Noise Tutorial", prefix: "/noise-tutorial" },
            { label: "Other Pages", prefix: "" },
          ];
          const sectionStats = sections.map(sec => {
            const pages = sec.prefix
              ? data.pageStats.filter(p => p.page.startsWith(sec.prefix))
              : data.pageStats.filter(p => !p.page.startsWith("/lightning-tutorial") && !p.page.startsWith("/noise-tutorial"));
            const views = pages.reduce((s, p) => s + p.views, 0);
            const totalDur = pages.reduce((s, p) => s + p.avgDuration * p.views, 0);
            const avgDur = views > 0 ? Math.round(totalDur / views) : 0;
            return { ...sec, views, avgDur, pageCount: pages.length };
          });

          // Top referrers
          const refCounts: Record<string, number> = {};
          for (const e of data.recentEvents) {
            const ref = e.referrer || "(direct)";
            refCounts[ref] = (refCounts[ref] || 0) + 1;
          }
          const topReferrers = Object.entries(refCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

          // Top pages
          const topPages = [...data.pageStats]
            .sort((a, b) => b.views - a.views)
            .slice(0, 10);

          // Longest avg time pages
          const longestPages = [...data.pageStats]
            .filter(p => p.views >= 2)
            .sort((a, b) => b.avgDuration - a.avgDuration)
            .slice(0, 10);

          return (
            <div className="space-y-4">
              {/* Summary metrics */}
              <div className="grid grid-cols-4 gap-3">
                <div className={cardClass}>
                  <div className="font-pixel text-[9px] text-foreground/60 mb-1">TOTAL VIEWS</div>
                  <div className="font-pixel text-base">{totalViews.toLocaleString()}</div>
                </div>
                <div className={cardClass}>
                  <div className="font-pixel text-[9px] text-foreground/60 mb-1">UNIQUE USERS</div>
                  <div className="font-pixel text-base">{uniqueUsers}</div>
                </div>
                <div className={cardClass}>
                  <div className="font-pixel text-[9px] text-foreground/60 mb-1">SESSIONS</div>
                  <div className="font-pixel text-base">{uniqueSessions}</div>
                </div>
                <div className={cardClass}>
                  <div className="font-pixel text-[9px] text-foreground/60 mb-1">AVG TIME/PAGE</div>
                  <div className="font-pixel text-base">{fmtTime(avgDuration)}</div>
                </div>
              </div>

              {/* Traffic by section */}
              <div className={cardClass}>
                <div className="font-pixel text-[10px] mb-2">TRAFFIC BY SECTION</div>
                <div className="space-y-1.5" style={{ fontFamily: sansFont }}>
                  {sectionStats.map(sec => {
                    const pct = totalViews > 0 ? Math.round(sec.views / totalViews * 100) : 0;
                    return (
                      <div key={sec.label} className="flex items-center gap-2">
                        <div className="w-36 text-xs text-foreground/60 shrink-0">{sec.label}</div>
                        <div className="flex-1 h-5 bg-border/20 relative overflow-hidden border border-border/30">
                          <div className="h-full bg-[#FFD700]/60" style={{ width: `${pct}%` }} />
                          <div className="absolute inset-0 flex items-center px-2 text-[11px] font-semibold">{sec.views} views ({pct}%)</div>
                        </div>
                        <div className="w-20 text-xs text-foreground/40 text-right shrink-0">avg {fmtTime(sec.avgDur)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Top pages */}
                <div className={cardClass}>
                  <div className="font-pixel text-[10px] mb-2">TOP PAGES</div>
                  <div className="space-y-1" style={{ fontFamily: sansFont }}>
                    {topPages.map((p, i) => (
                      <div key={p.page} className="flex items-center gap-2 text-xs">
                        <span className="text-foreground/30 w-4 shrink-0">{i + 1}.</span>
                        <span className="flex-1 truncate">{p.page}</span>
                        <span className="text-foreground/60 shrink-0">{p.views}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Longest pages */}
                <div className={cardClass}>
                  <div className="font-pixel text-[10px] mb-2">LONGEST AVG TIME</div>
                  <div className="space-y-1" style={{ fontFamily: sansFont }}>
                    {longestPages.map((p, i) => (
                      <div key={p.page} className="flex items-center gap-2 text-xs">
                        <span className="text-foreground/30 w-4 shrink-0">{i + 1}.</span>
                        <span className="flex-1 truncate">{p.page}</span>
                        <span className="text-foreground/60 shrink-0">{fmtTime(p.avgDuration)}</span>
                      </div>
                    ))}
                    {longestPages.length === 0 && <div className="text-xs text-foreground/40">Not enough data</div>}
                  </div>
                </div>

                {/* Top referrers */}
                <div className={cardClass}>
                  <div className="font-pixel text-[10px] mb-2">TOP REFERRERS</div>
                  <div className="space-y-1" style={{ fontFamily: sansFont }}>
                    {topReferrers.map(([ref, count], i) => (
                      <div key={ref} className="flex items-center gap-2 text-xs">
                        <span className="text-foreground/30 w-4 shrink-0">{i + 1}.</span>
                        <span className="flex-1 truncate">{ref}</span>
                        <span className="text-foreground/60 shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Donations Tab */}
        {activeTab === "donations" && (
          <div className={`${cardClass} overflow-x-auto`}>
            <div className="font-pixel text-xs mb-3">
              DONATIONS &mdash; {(data.recentDonations || []).reduce((s, d) => s + d.amountSats, 0).toLocaleString()} TOTAL SATS
            </div>
            <table className={tableClass} style={{ fontFamily: sansFont }}>
              <thead>
                <tr>
                  <th className={thClass}>NAME</th>
                  <th className={thClass}>AMOUNT</th>
                  <th className={thClass}>MESSAGE</th>
                  <th className={thClass}>DATE</th>
                  <th className={thClass}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {(data.recentDonations || []).map((d) => {
                  const isSpammed = d.message === "\u26A1\u26A1\u26A1";
                  const isRevealed = revealedMessages.has(d.id);
                  const hasMessage = d.message && d.message.trim().length > 0;
                  return (
                    <tr key={d.id} className="hover:bg-primary/5">
                      <td className={tdClass}>{d.donorName}</td>
                      <td className={tdClass}>{d.amountSats.toLocaleString()} sats</td>
                      <td className={tdClass}>
                        {!hasMessage ? (
                          <span className="text-foreground/30">-</span>
                        ) : isSpammed ? (
                          <span title="Marked as spam">{d.message}</span>
                        ) : (
                          <span>{d.message}</span>
                        )}
                      </td>
                      <td className={tdClass}>{formatDate(d.createdAt)}</td>
                      <td className={tdClass}>
                        {isSpammed ? (
                          <span className="font-pixel text-sm text-foreground/30">REMOVED</span>
                        ) : (
                          <button
                            onClick={() => markSpam(d.id)}
                            disabled={spamming.has(d.id)}
                            className="font-pixel text-sm border border-red-500/50 text-red-500 px-3 py-1.5 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {spamming.has(d.id) ? "..." : "SPAM"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(data.recentDonations || []).length === 0 && (
                  <tr><td colSpan={5} className={`${tdClass} text-center text-foreground/40`}>No donations yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
