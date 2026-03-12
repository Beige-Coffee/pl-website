import { useState } from "react";
import AdminCollapsibleSection from "./AdminCollapsibleSection";
import StatCard from "./StatCard";
import { type DashboardData, sansFont, tableClass, thClass, tdClass, formatDate, truncate, formatMs } from "./admin-data";

interface SystemViewProps {
  data: DashboardData;
  storedPassword: string;
  onRefresh: () => void;
}

type LaunchLearner = {
  userId: string;
  email: string;
  password: string;
  displayName: string;
  created: boolean;
};

export default function SystemView({ data, storedPassword, onRefresh }: SystemViewProps) {
  const [spamming, setSpamming] = useState<Set<string>>(new Set());
  const [launchPrefix, setLaunchPrefix] = useState("launch");
  const [launchCount, setLaunchCount] = useState("5");
  const [launchBusy, setLaunchBusy] = useState(false);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [provisionedLearners, setProvisionedLearners] = useState<LaunchLearner[]>([]);
  const [resettingNodeMetrics, setResettingNodeMetrics] = useState(false);

  const nodeBalance = data.nodeBalance;
  const sendable = Number(nodeBalance.lightning_sendable_balance || 0);
  const receivable = Number(nodeBalance.lightning_receivable_balance || 0);
  const onchainBalance = Number(nodeBalance.onchain_balance || 0);

  const nodeOk = data.nodeMetrics.provision.failureCount === 0 && data.nodeMetrics.startupFailures === 0;
  const failedWithdrawals = data.recentWithdrawals.filter(w => w.status === "failed").length;

  const markSpam = async (donationId: string) => {
    if (!confirm("Mark this donation as spam?")) return;
    setSpamming(prev => new Set(prev).add(donationId));
    try {
      await fetch("/api/admin/donation-spam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: storedPassword, donation_id: donationId }),
      });
      onRefresh();
    } catch {}
    setSpamming(prev => { const n = new Set(prev); n.delete(donationId); return n; });
  };

  const provisionLaunchLearners = async () => {
    const count = Number.parseInt(launchCount, 10);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      setLaunchMessage("Count must be between 1 and 50.");
      return;
    }
    setLaunchBusy(true);
    setLaunchMessage(null);
    try {
      const res = await fetch("/api/admin/test-learners/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: storedPassword, prefix: launchPrefix, count }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLaunchMessage(body.error || "Failed to provision learners");
        return;
      }
      setProvisionedLearners(body.learners || []);
      setLaunchPrefix(body.prefix || launchPrefix);
      setLaunchMessage(`Provisioned ${body.learners?.length || 0} launch learners.`);
      onRefresh();
    } catch {
      setLaunchMessage("Failed to provision learners");
    } finally {
      setLaunchBusy(false);
    }
  };

  const resetNodeMetrics = async () => {
    setResettingNodeMetrics(true);
    setLaunchMessage(null);
    try {
      const res = await fetch("/api/admin/node-metrics/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: storedPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLaunchMessage(body.error || "Failed to reset node metrics");
        return;
      }
      setLaunchMessage("Node metrics reset.");
      onRefresh();
    } catch {
      setLaunchMessage("Failed to reset node metrics");
    } finally {
      setResettingNodeMetrics(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Node & Balance - always visible */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="SENDABLE" value={`${sendable.toLocaleString()} sats`}
          status={sendable < 5000 ? "red" : sendable < 20000 ? "yellow" : "green"} />
        <StatCard label="RECEIVABLE" value={`${receivable.toLocaleString()} sats`} />
        <StatCard label="ON-CHAIN" value={`${onchainBalance.toLocaleString()} sats`} />
        <StatCard label="ACTIVE NODES" value={data.nodeMetrics.activeNodes}
          status={data.nodeMetrics.activeNodes > data.nodeMetrics.maxConcurrent * 0.8 ? "yellow" : "green"} />
      </div>

      {/* Withdrawals */}
      <AdminCollapsibleSection
        title="WITHDRAWALS"
        summary={`${data.totalSatsPaid.toLocaleString()} sats paid | ${data.pendingCount} pending`}
        defaultOpen={true}
        status={failedWithdrawals > 0 ? "warn" : "ok"}
      >
        <div className="overflow-x-auto">
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
              {data.recentWithdrawals.map(w => {
                const sats = Math.floor(parseInt(w.amountMsats, 10) / 1000);
                const statusColor =
                  w.status === "paid" ? "text-green-600" :
                  w.status === "pending" || w.status === "claimed" ? "text-yellow-600" :
                  w.status === "failed" ? "text-red-500" :
                  "text-foreground/40";
                return (
                  <tr key={w.id} className="hover:bg-primary/5">
                    <td className={tdClass}><span className={`font-pixel text-[10px] ${statusColor}`}>{w.status.toUpperCase()}</span></td>
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
      </AdminCollapsibleSection>

      {/* Feedback */}
      <AdminCollapsibleSection
        title="FEEDBACK"
        summary={`${(data.recentFeedback || []).length} submissions`}
        defaultOpen={(data.recentFeedback || []).length > 0}
      >
        <div className="overflow-x-auto">
          <table className={tableClass} style={{ fontFamily: sansFont }}>
            <thead>
              <tr>
                <th className={thClass}>CATEGORY</th>
                <th className={thClass}>MESSAGE</th>
                <th className={thClass}>CHAPTER</th>
                <th className={thClass}>USER</th>
                <th className={thClass}>DATE</th>
                <th className={thClass}>GITHUB</th>
              </tr>
            </thead>
            <tbody>
              {(data.recentFeedback || []).map(f => {
                const categoryColors: Record<string, string> = {
                  bug: "text-red-500",
                  confusing: "text-yellow-500",
                  suggestion: "text-blue-400",
                  other: "text-foreground/60",
                };
                return (
                  <tr key={f.id} className="hover:bg-primary/5">
                    <td className={tdClass}>
                      <span className={`font-pixel text-[10px] ${categoryColors[f.category] || "text-foreground/60"}`}>
                        {f.category.toUpperCase()}
                      </span>
                    </td>
                    <td className={`${tdClass} max-w-xs`}>
                      <div className="truncate" title={f.message}>{f.message}</div>
                    </td>
                    <td className={tdClass}>
                      {f.chapterTitle ? (
                        <span className="truncate block max-w-[120px]" title={f.chapterTitle}>{f.chapterTitle}</span>
                      ) : "-"}
                    </td>
                    <td className={tdClass}>{f.userId ? truncate(f.userId, 8) : "anon"}</td>
                    <td className={tdClass}>{formatDate(f.createdAt)}</td>
                    <td className={tdClass}>
                      {f.githubIssueUrl ? (
                        <a href={f.githubIssueUrl} target="_blank" rel="noopener noreferrer" className="font-pixel text-[10px] text-blue-400 hover:text-blue-300 underline">VIEW</a>
                      ) : "-"}
                    </td>
                  </tr>
                );
              })}
              {(data.recentFeedback || []).length === 0 && (
                <tr><td colSpan={6} className={`${tdClass} text-center text-foreground/40`}>No feedback yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminCollapsibleSection>

      {/* Donations */}
      <AdminCollapsibleSection
        title="DONATIONS"
        summary={`${(data.recentDonations || []).reduce((s, d) => s + d.amountSats, 0).toLocaleString()} total sats`}
        defaultOpen={false}
      >
        <div className="overflow-x-auto">
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
              {(data.recentDonations || []).map(d => {
                const isSpammed = d.message === "\u26A1\u26A1\u26A1";
                return (
                  <tr key={d.id} className="hover:bg-primary/5">
                    <td className={tdClass}>{d.donorName}</td>
                    <td className={tdClass}>{d.amountSats.toLocaleString()} sats</td>
                    <td className={tdClass}>
                      {!d.message?.trim() ? "-" : isSpammed ? <span title="Spam">{d.message}</span> : d.message}
                    </td>
                    <td className={tdClass}>{formatDate(d.createdAt)}</td>
                    <td className={tdClass}>
                      {isSpammed ? (
                        <span className="font-pixel text-sm text-foreground/30">REMOVED</span>
                      ) : (
                        <button
                          onClick={() => markSpam(d.id)}
                          disabled={spamming.has(d.id)}
                          className="font-pixel text-sm border border-red-500/50 text-red-500 px-3 py-1.5 hover:bg-red-500/10 disabled:opacity-50 cursor-pointer"
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
      </AdminCollapsibleSection>

      {/* Test Learners & Node Ops */}
      <AdminCollapsibleSection
        title="TEST LEARNERS & NODE OPS"
        summary={`${data.nodeMetrics.provision.count} provisions`}
        defaultOpen={false}
        status={nodeOk ? "ok" : "warn"}
      >
        <div className="space-y-4">
          {/* Provision form */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block font-pixel text-[10px] text-foreground/60 mb-1">PREFIX</label>
              <input
                value={launchPrefix}
                onChange={e => setLaunchPrefix(e.target.value)}
                className="border-2 border-border bg-background px-3 py-2 font-mono text-sm"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block font-pixel text-[10px] text-foreground/60 mb-1">COUNT</label>
              <input
                value={launchCount}
                onChange={e => setLaunchCount(e.target.value)}
                className="w-24 border-2 border-border bg-background px-3 py-2 font-mono text-sm"
                inputMode="numeric"
              />
            </div>
            <button
              onClick={provisionLaunchLearners}
              disabled={launchBusy}
              className="font-pixel text-[10px] border-2 border-border bg-primary text-black px-4 py-2 hover:bg-primary/80 disabled:opacity-50 cursor-pointer"
            >
              {launchBusy ? "WORKING..." : "PROVISION + RESET"}
            </button>
            <button
              onClick={resetNodeMetrics}
              disabled={resettingNodeMetrics}
              className="font-pixel text-[10px] border-2 border-border px-4 py-2 hover:bg-primary/10 disabled:opacity-50 cursor-pointer"
            >
              {resettingNodeMetrics ? "RESETTING..." : "RESET NODE METRICS"}
            </button>
          </div>
          {launchMessage && (
            <div className="font-pixel text-[10px] text-foreground/70">{launchMessage}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Node Health */}
            <div className="border-2 border-border p-4">
              <div className="font-pixel text-[10px] mb-2">NODE HEALTH</div>
              <div className="space-y-1 text-sm" style={{ fontFamily: sansFont }}>
                <div className="flex justify-between"><span>Provision attempts</span><span>{data.nodeMetrics.provision.count}</span></div>
                <div className="flex justify-between"><span>Provision failures</span><span>{data.nodeMetrics.provision.failureCount}</span></div>
                <div className="flex justify-between"><span>Provision timeouts</span><span>{data.nodeMetrics.provision.timeoutCount}</span></div>
                <div className="flex justify-between"><span>Provision avg</span><span>{formatMs(data.nodeMetrics.provision.avgMs)}</span></div>
                <div className="flex justify-between"><span>Provision max</span><span>{formatMs(data.nodeMetrics.provision.maxMs)}</span></div>
                <div className="flex justify-between"><span>Startup failures</span><span>{data.nodeMetrics.startupFailures}</span></div>
                <div className="flex justify-between"><span>Idle stops</span><span>{data.nodeMetrics.cleanup.idleStops}</span></div>
                <div className="flex justify-between"><span>Stale dir cleanup</span><span>{data.nodeMetrics.cleanup.staleDirsRemoved}</span></div>
                <div className="flex justify-between"><span>Limiter bypass</span><span>{data.launchControls.nodeLimiterBypassEnabled ? "ENABLED" : "DISABLED"}</span></div>
                <div className="flex justify-between"><span>Bypass count</span><span>{data.nodeMetrics.limiterBypassCount}</span></div>
              </div>
            </div>

            {/* Provisioned Learners */}
            <div className="border-2 border-border p-4">
              <div className="font-pixel text-[10px] mb-2">PROVISIONED LEARNERS</div>
              {provisionedLearners.length === 0 ? (
                <div className="text-sm text-foreground/40" style={{ fontFamily: sansFont }}>
                  Run PROVISION + RESET to create learners.
                </div>
              ) : (
                <div className="space-y-1 text-xs" style={{ fontFamily: sansFont }}>
                  {provisionedLearners.map(l => (
                    <div key={l.userId} className="border border-border/30 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{l.email}</span>
                        <span className="font-pixel text-[9px] text-foreground/50">{l.created ? "CREATED" : "RESET"}</span>
                      </div>
                      <div className="text-foreground/60 break-all">pw: {l.password}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RPC Latency */}
          <div className="overflow-x-auto">
            <div className="font-pixel text-[10px] mb-2">RPC LATENCY</div>
            <table className={tableClass} style={{ fontFamily: sansFont }}>
              <thead>
                <tr>
                  <th className={thClass}>METHOD</th>
                  <th className={thClass}>COUNT</th>
                  <th className={thClass}>AVG</th>
                  <th className={thClass}>MAX</th>
                  <th className={thClass}>FAIL</th>
                  <th className={thClass}>TIMEOUT</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.nodeMetrics.rpc)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([method, metric]) => (
                    <tr key={method} className="hover:bg-primary/5">
                      <td className={tdClass}>{method}</td>
                      <td className={tdClass}>{metric.count}</td>
                      <td className={tdClass}>{formatMs(metric.avgMs)}</td>
                      <td className={tdClass}>{formatMs(metric.maxMs)}</td>
                      <td className={tdClass}>{metric.failureCount}</td>
                      <td className={tdClass}>{metric.timeoutCount}</td>
                    </tr>
                  ))}
                {Object.keys(data.nodeMetrics.rpc).length === 0 && (
                  <tr><td colSpan={6} className={`${tdClass} text-center text-foreground/40`}>No RPC metrics yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AdminCollapsibleSection>
    </div>
  );
}
