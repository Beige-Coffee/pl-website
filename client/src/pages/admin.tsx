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
          const CHECKPOINT_ORDER = [
            { id: "crypto-review", label: "Crypto Review", chapter: "Cryptographic Primitives" },
            { id: "setup-wrong-key", label: "Setup", chapter: "Handshake Setup" },
            { id: "act2-both-ephemeral", label: "Act 2", chapter: "Act 2: Ephemeral Key Exchange" },
            { id: "act3-nonce-one", label: "Act 3", chapter: "Act 3: Identity Reveal" },
            { id: "message-length-limit", label: "Messaging", chapter: "Sending Encrypted Messages" },
          ];

          const TUTORIAL_PAGES = [
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
          ];

          // Build user maps
          const userCheckpoints: Record<string, Set<string>> = {};
          const userCheckpointDates: Record<string, Record<string, string>> = {};
          for (const c of data.checkpointCompletions) {
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

                    {/* Page Time Stats */}
                    <div className={cardClass}>
                      <div className="font-pixel text-[10px] mb-2">TIME SPENT PER PAGE</div>
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
                        <div className="font-pixel text-[9px] text-foreground/60 mb-1">ALL 5</div>
                        <div className="font-pixel text-base">{usersCompletedAll}</div>
                        <div className="text-[11px] text-foreground/40" style={{ fontFamily: sansFont }}>{usersWithAny > 0 ? `${Math.round(usersCompletedAll / usersWithAny * 100)}%` : "-"} of starters</div>
                      </div>
                      <div className={cardClass}>
                        <div className="font-pixel text-[9px] text-foreground/60 mb-1">COMPLETIONS</div>
                        <div className="font-pixel text-base">{data.checkpointCompletions.length}</div>
                      </div>
                    </div>

                    {/* Funnel + Where stopped side by side */}
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

                    {/* User matrix */}
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
                                          <span className="text-foreground/20">—</span>
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
          );
        })()}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            {/* Page stats */}
            <div className={`${cardClass} overflow-x-auto`}>
              <div className="font-pixel text-xs mb-3">PAGE VIEWS</div>
              <table className={tableClass} style={{ fontFamily: sansFont }}>
                <thead>
                  <tr>
                    <th className={thClass}>PAGE</th>
                    <th className={thClass}>VIEWS</th>
                    <th className={thClass}>AVG DURATION</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pageStats.map((p) => (
                    <tr key={p.page} className="hover:bg-primary/5">
                      <td className={tdClass}>{p.page}</td>
                      <td className={tdClass}>{p.views}</td>
                      <td className={tdClass}>{p.avgDuration}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Recent events */}
            <div className={`${cardClass} overflow-x-auto`}>
              <div className="font-pixel text-xs mb-3">RECENT EVENTS</div>
              <table className={tableClass} style={{ fontFamily: sansFont }}>
                <thead>
                  <tr>
                    <th className={thClass}>PAGE</th>
                    <th className={thClass}>USER</th>
                    <th className={thClass}>DURATION</th>
                    <th className={thClass}>REFERRER</th>
                    <th className={thClass}>TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentEvents.map((e) => (
                    <tr key={e.id} className="hover:bg-primary/5">
                      <td className={tdClass}>{e.page}</td>
                      <td className={tdClass}>{truncate(e.userId, 8)}</td>
                      <td className={tdClass}>{e.duration != null ? `${e.duration}s` : "-"}</td>
                      <td className={tdClass}>{truncate(e.referrer, 20)}</td>
                      <td className={tdClass}>{formatDate(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
