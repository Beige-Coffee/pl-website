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
    `font-pixel text-base px-6 py-3 border-2 transition-all cursor-pointer ${
      activeTab === tab
        ? "border-border bg-primary text-black pixel-shadow"
        : "border-border/50 bg-card hover:bg-primary/20"
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

      <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button className={tabClass("overview")} onClick={() => setActiveTab("overview")}>OVERVIEW</button>
          <button className={tabClass("users")} onClick={() => setActiveTab("users")}>USERS ({data.userCount})</button>
          <button className={tabClass("withdrawals")} onClick={() => setActiveTab("withdrawals")}>WITHDRAWALS</button>
          <button className={tabClass("checkpoints")} onClick={() => setActiveTab("checkpoints")}>CHECKPOINTS</button>
          <button className={tabClass("analytics")} onClick={() => setActiveTab("analytics")}>ANALYTICS</button>
          <button className={tabClass("donations")} onClick={() => setActiveTab("donations")}>DONATIONS ({(data.recentDonations || []).length})</button>
        </div>

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
        {activeTab === "checkpoints" && (
          <div className={`${cardClass} overflow-x-auto`}>
            <table className={tableClass} style={{ fontFamily: sansFont }}>
              <thead>
                <tr>
                  <th className={thClass}>USER</th>
                  <th className={thClass}>CHECKPOINT</th>
                  <th className={thClass}>COMPLETED</th>
                </tr>
              </thead>
              <tbody>
                {data.checkpointCompletions.map((c) => (
                  <tr key={c.id} className="hover:bg-primary/5">
                    <td className={tdClass}>{truncate(c.userId, 8)}</td>
                    <td className={tdClass}>{c.checkpointId}</td>
                    <td className={tdClass}>{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
                {data.checkpointCompletions.length === 0 && (
                  <tr><td colSpan={3} className={`${tdClass} text-center text-foreground/40`}>No completions</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

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
  );
}
