import StatCard from "./StatCard";
import FunnelChart from "./FunnelChart";
import { type DashboardData, TUTORIAL_CONFIGS } from "./admin-data";

interface OverviewViewProps {
  data: DashboardData;
  onNavigate: (view: string) => void;
}

export default function OverviewView({ data, onNavigate }: OverviewViewProps) {
  const nodeBalance = data.nodeBalance;
  const sendable = Number(nodeBalance.lightning_sendable_balance || 0);

  // Compute KPIs
  const now = Date.now();
  const DAY = 86_400_000;

  // Active students (7d) - users with checkpoint completions in last 7 days
  const recentCheckpointUsers = new Set(
    data.checkpointCompletions
      .filter(c => now - new Date(c.createdAt).getTime() < 7 * DAY)
      .map(c => c.userId)
  );
  const activeStudents7d = recentCheckpointUsers.size;

  // Per-course completion funnel (counts only that course's checkpoints).
  const buildFunnel = (checkpoints: { id: string }[]) => {
    const ids = new Set(checkpoints.map(cp => cp.id));
    const uc: Record<string, Set<string>> = {};
    for (const c of data.checkpointCompletions) {
      if (!ids.has(c.checkpointId)) continue;
      if (!uc[c.userId]) uc[c.userId] = new Set();
      uc[c.userId].add(c.checkpointId);
    }
    const n = checkpoints.length;
    const completedAll = Object.values(uc).filter(s => s.size === n).length;
    const milestones = [
      { label: "Signed Up", count: data.userCount },
      { label: "First Check", count: Object.keys(uc).length },
      { label: "25%", count: Object.values(uc).filter(s => s.size >= Math.ceil(n * 0.25)).length },
      { label: "50%", count: Object.values(uc).filter(s => s.size >= Math.ceil(n * 0.50)).length },
      { label: "75%", count: Object.values(uc).filter(s => s.size >= Math.ceil(n * 0.75)).length },
      { label: "Completed", count: completedAll },
    ];
    return { usersWithAny: Object.keys(uc).length, completedAll, milestones };
  };
  const lnFunnel = buildFunnel(TUTORIAL_CONFIGS.lightning.checkpoints);
  const onionFunnel = buildFunnel(TUTORIAL_CONFIGS.onion.checkpoints);
  // "Course completions" counts finishers of either coding course (onion-aware).
  const completedAll = lnFunnel.completedAll + onionFunnel.completedAll;
  const completionRate = lnFunnel.usersWithAny > 0 ? Math.round(lnFunnel.completedAll / lnFunnel.usersWithAny * 100) : 0;

  // New signups (7d)
  const newSignups7d = data.users.filter(u => u.createdAt && now - new Date(u.createdAt).getTime() < 7 * DAY).length;

  // Alerts
  const alerts: { label: string; view: string; level: "warn" | "error" | "info" }[] = [];

  const segments = data.userSegments || {};
  const stalledCount = Object.values(segments).filter(s => s === "stalled").length;
  if (stalledCount > 0) alerts.push({ label: `${stalledCount} stalled student${stalledCount > 1 ? "s" : ""}`, view: "students", level: "warn" });

  const pendingPayout = data.pendingCount;
  if (sendable < pendingPayout * 50 * 2 && sendable > 0) alerts.push({ label: "Low sendable balance", view: "system", level: "error" });

  const unresolvedFeedback = (data.recentFeedback || []).filter(f => !f.githubIssueUrl).length;
  if (unresolvedFeedback > 0) alerts.push({ label: `${unresolvedFeedback} unresolved feedback`, view: "system", level: "info" });

  const failedWithdrawals24h = data.recentWithdrawals.filter(w =>
    w.status === "failed" && now - new Date(w.createdAt).getTime() < DAY
  ).length;
  if (failedWithdrawals24h > 0) alerts.push({ label: `${failedWithdrawals24h} failed withdrawal${failedWithdrawals24h > 1 ? "s" : ""} (24h)`, view: "system", level: "error" });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="ACTIVE STUDENTS (7D)" value={activeStudents7d} />
        <StatCard label="COURSE COMPLETIONS" value={completedAll} />
        <StatCard label="COMPLETION RATE" value={`${completionRate}%`} />
        <StatCard label="SENDABLE BALANCE" value={`${sendable.toLocaleString()} sats`}
          status={sendable < 5000 ? "red" : sendable < 20000 ? "yellow" : "green"} />
        <StatCard label="TOTAL SATS PAID" value={`${data.totalSatsPaid.toLocaleString()} sats`} />
        <StatCard label="NEW SIGNUPS (7D)" value={newSignups7d} />
      </div>

      {/* Mini Course Funnels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FunnelChart
          title="COURSE FUNNEL (LIGHTNING)"
          items={lnFunnel.milestones}
          total={data.userCount}
          color="gold"
        />
        <FunnelChart
          title="COURSE FUNNEL (ONION ROUTING)"
          items={onionFunnel.milestones}
          total={data.userCount}
          color="gold"
        />
      </div>

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <div className="border-4 border-border bg-card p-4 pixel-shadow">
          <div className="font-pixel text-[10px] mb-3">ALERTS</div>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <button
                key={i}
                onClick={() => onNavigate(alert.view)}
                className="flex items-center gap-2 w-full text-left p-2 hover:bg-primary/5 transition-colors cursor-pointer"
                style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  alert.level === "error" ? "bg-red-500" : alert.level === "warn" ? "bg-yellow-500" : "bg-blue-500"
                }`} />
                <span className="text-sm">{alert.label}</span>
                <span className="text-xs text-foreground/30 ml-auto">View &rarr;</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
