import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import SegmentBadge from "./SegmentBadge";
import { type DashboardData, TUTORIAL_CONFIGS, type TutorialKey, sansFont, formatDate, truncate, formatTime } from "./admin-data";

interface StudentDetailPanelProps {
  userId: string;
  data: DashboardData;
  selectedTutorial: TutorialKey;
  storedPassword: string;
  onClose: () => void;
  onRefresh: () => void;
  onUserDeleted: (userId: string) => void;
}

export default function StudentDetailPanel({
  userId, data, selectedTutorial, storedPassword, onClose, onRefresh, onUserDeleted,
}: StudentDetailPanelProps) {
  const [confirmAction, setConfirmAction] = useState<"delete" | "reset" | null>(null);
  const [resetBanner, setResetBanner] = useState<string | null>(null);

  const config = TUTORIAL_CONFIGS[selectedTutorial];
  const CHECKPOINT_ORDER = config.checkpoints;
  const TUTORIAL_PAGES = config.pages;

  const user = data.users.find(u => u.id === userId);
  const segment = (data.userSegments || {})[userId];

  // Build checkpoint data for this user
  const checkpointIdSet = new Set(CHECKPOINT_ORDER.map(cp => cp.id));
  const userCompletedSet = new Set<string>();
  const userCheckpointDates: Record<string, string> = {};
  for (const c of data.checkpointCompletions) {
    if (c.userId === userId && checkpointIdSet.has(c.checkpointId)) {
      userCompletedSet.add(c.checkpointId);
      userCheckpointDates[c.checkpointId] = c.createdAt;
    }
  }
  const completedCount = CHECKPOINT_ORDER.filter(cp => userCompletedSet.has(cp.id)).length;

  // Build page time data
  const userPageData: Record<string, { visits: number; totalDuration: number }> = {};
  for (const e of data.recentEvents) {
    if (e.userId !== userId) continue;
    if (!e.page.startsWith(config.urlPrefix)) continue;
    if (!userPageData[e.page]) userPageData[e.page] = { visits: 0, totalDuration: 0 };
    userPageData[e.page].visits++;
    if (e.duration != null) userPageData[e.page].totalDuration += e.duration;
  }

  // Withdrawals for this user
  const userWithdrawals = data.recentWithdrawals.filter(w => w.userId === userId);

  // Sats earned
  const satsEarned = userWithdrawals
    .filter(w => w.status === "paid")
    .reduce((sum, w) => sum + Math.floor(parseInt(w.amountMsats, 10) / 1000), 0);

  const resetCheckpoint = async (checkpointId?: string) => {
    try {
      const res = await fetch("/api/admin/reset-checkpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: storedPassword, userId, checkpointId }),
      });
      if (res.ok) {
        if (!checkpointId) setResetBanner("/lightning-tutorial?fresh=1");
        onRefresh();
      }
    } catch {}
    setConfirmAction(null);
  };

  const deleteUser = async () => {
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: storedPassword, userId }),
      });
      if (res.ok) {
        onUserDeleted(userId);
        onClose();
      }
    } catch {}
    setConfirmAction(null);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-card border-l-4 border-border z-40 overflow-y-auto pixel-shadow">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b-2 border-border p-4 z-10">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onClose} className="font-pixel text-[10px] text-foreground/50 hover:text-foreground cursor-pointer">&lt; BACK</button>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmAction("reset")}
              className="font-pixel text-[9px] px-2 py-1 bg-yellow-500/10 text-yellow-700 border border-yellow-500/30 hover:bg-yellow-500/20 cursor-pointer"
            >
              RESET
            </button>
            <button
              onClick={() => setConfirmAction("delete")}
              className="font-pixel text-[9px] px-2 py-1 bg-red-500/10 text-red-600 border border-red-500/30 hover:bg-red-500/20 cursor-pointer"
            >
              DELETE
            </button>
          </div>
        </div>
        <div className="font-pixel text-sm">{user?.displayName || truncate(userId, 12)}</div>
        {user?.email && <div className="text-xs text-foreground/40" style={{ fontFamily: sansFont }}>{user.email}</div>}
        <div className="text-xs text-foreground/30 font-mono mt-0.5">{userId}</div>
        <div className="flex items-center gap-2 mt-2">
          {segment && <SegmentBadge segment={segment} />}
          <span className="text-xs text-foreground/40" style={{ fontFamily: sansFont }}>
            {completedCount}/{CHECKPOINT_ORDER.length} checkpoints
          </span>
          {satsEarned > 0 && (
            <span className="text-xs text-foreground/40" style={{ fontFamily: sansFont }}>
              {satsEarned} sats
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {resetBanner && (
          <div className="p-2 bg-green-500/10 border border-green-500/30 text-sm" style={{ fontFamily: sansFont }}>
            <span className="text-green-600 font-semibold">Reset complete.</span>{" "}
            Open tutorial with fresh cache:{" "}
            <a href={resetBanner} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">{resetBanner}</a>
          </div>
        )}

        {/* Checkpoint timeline */}
        <div>
          <div className="font-pixel text-[10px] mb-2">CHECKPOINTS</div>
          <div className="space-y-1.5" style={{ fontFamily: sansFont }}>
            {CHECKPOINT_ORDER.map(cp => {
              const done = userCompletedSet.has(cp.id);
              const date = userCheckpointDates[cp.id];
              return (
                <div key={cp.id} className={`flex items-center gap-3 p-2 border border-border/20 ${done ? "bg-green-500/5" : "bg-border/5"}`}>
                  <span className={`text-base font-bold ${done ? "text-green-600" : "text-foreground/20"}`}>
                    {done ? "\u2713" : "\u2014"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{cp.chapter}</div>
                    <div className="text-[11px] text-foreground/40">{cp.id}</div>
                  </div>
                  {done && date && (
                    <div className="text-xs text-foreground/40 text-right shrink-0">
                      {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  )}
                  {done && (
                    <button
                      onClick={() => resetCheckpoint(cp.id)}
                      className="text-[10px] px-1.5 py-0.5 text-red-500/60 hover:text-red-600 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors cursor-pointer shrink-0"
                      title={`Reset ${cp.id}`}
                    >
                      \u2715
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Time on pages */}
        <div>
          <div className="font-pixel text-[10px] mb-2">TIME ON PAGES</div>
          {Object.keys(userPageData).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" style={{ fontFamily: sansFont }}>
                <thead>
                  <tr>
                    <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">PAGE</th>
                    <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">VISITS</th>
                    <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {TUTORIAL_PAGES.map(tp => {
                    const pd = userPageData[tp.page];
                    if (!pd) return null;
                    return (
                      <tr key={tp.page} className="hover:bg-primary/5">
                        <td className="p-2 border-b border-border/30 text-sm">{tp.label}</td>
                        <td className="p-2 border-b border-border/30 text-sm">{pd.visits}</td>
                        <td className="p-2 border-b border-border/30 text-sm">{formatTime(pd.totalDuration)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-foreground/40" style={{ fontFamily: sansFont }}>No page data</div>
          )}
        </div>

        {/* Withdrawals */}
        {userWithdrawals.length > 0 && (
          <div>
            <div className="font-pixel text-[10px] mb-2">WITHDRAWALS ({userWithdrawals.length})</div>
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
                  {userWithdrawals.map(w => {
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
      </div>

      {/* Confirm dialogs */}
      {confirmAction === "delete" && (
        <ConfirmDialog
          title="DELETE USER"
          message={`Permanently delete ${user?.email || userId}? This removes all their data (checkpoints, withdrawals, progress, feedback) and cannot be undone.`}
          confirmLabel="DELETE"
          confirmColor="red"
          onConfirm={deleteUser}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "reset" && (
        <ConfirmDialog
          title="RESET PROGRESS"
          message={`Reset ALL checkpoints and progress for ${user?.email || userId}? This cannot be undone.`}
          confirmLabel="RESET ALL"
          confirmColor="red"
          onConfirm={() => resetCheckpoint()}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
