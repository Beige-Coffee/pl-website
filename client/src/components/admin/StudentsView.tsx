import { useState, useMemo } from "react";
import FunnelChart from "./FunnelChart";
import SegmentBadge from "./SegmentBadge";
import { SEGMENT_STYLES } from "./SegmentBadge";
import StudentDetailPanel from "./StudentDetailPanel";
import { type DashboardData, TUTORIAL_CONFIGS, type TutorialKey, sansFont, truncate, relativeTime } from "./admin-data";

interface StudentsViewProps {
  data: DashboardData;
  storedPassword: string;
  onRefresh: () => void;
}

type SubView = "table" | "funnel" | "matrix";
type SortKey = "name" | "progress" | "lastActive" | "sats";
type SortDir = "asc" | "desc";

export default function StudentsView({ data, storedPassword, onRefresh }: StudentsViewProps) {
  const [selectedTutorial, setSelectedTutorial] = useState<TutorialKey>("lightning");
  const [subView, setSubView] = useState<SubView>("table");
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("lastActive");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const config = TUTORIAL_CONFIGS[selectedTutorial];
  const CHECKPOINT_ORDER = config.checkpoints;
  const checkpointIdSet = new Set(CHECKPOINT_ORDER.map(cp => cp.id));

  // Build user checkpoint maps
  const { userCheckpoints, userCheckpointDates } = useMemo(() => {
    const uc: Record<string, Set<string>> = {};
    const ucd: Record<string, Record<string, string>> = {};
    for (const c of data.checkpointCompletions) {
      if (!checkpointIdSet.has(c.checkpointId)) continue;
      if (!uc[c.userId]) { uc[c.userId] = new Set(); ucd[c.userId] = {}; }
      uc[c.userId].add(c.checkpointId);
      ucd[c.userId][c.checkpointId] = c.createdAt;
    }
    return { userCheckpoints: uc, userCheckpointDates: ucd };
  }, [data.checkpointCompletions, selectedTutorial]);

  // User sats map
  const userSats = useMemo(() => {
    const m: Record<string, number> = {};
    for (const w of data.recentWithdrawals) {
      if (w.status === "paid") {
        m[w.userId] = (m[w.userId] || 0) + Math.floor(parseInt(w.amountMsats, 10) / 1000);
      }
    }
    return m;
  }, [data.recentWithdrawals]);

  // All users with enriched data
  const enrichedUsers = useMemo(() => {
    return data.users.map(u => ({
      ...u,
      progress: userCheckpoints[u.id]?.size ?? 0,
      sats: userSats[u.id] ?? 0,
      segment: (data.userSegments || {})[u.id] || "browsing",
    }));
  }, [data.users, userCheckpoints, userSats, data.userSegments]);

  // Filter
  const filteredUsers = useMemo(() => {
    let filtered = enrichedUsers;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(u =>
        (u.email?.toLowerCase().includes(q)) ||
        (u.displayName?.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q)
      );
    }
    if (segmentFilter !== "all") {
      filtered = filtered.filter(u => u.segment === segmentFilter);
    }
    return filtered;
  }, [enrichedUsers, search, segmentFilter]);

  // Sort
  const sortedUsers = useMemo(() => {
    const sorted = [...filteredUsers];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = (a.displayName || a.email || a.id).localeCompare(b.displayName || b.email || b.id); break;
        case "progress": cmp = a.progress - b.progress; break;
        case "sats": cmp = a.sats - b.sats; break;
        case "lastActive": {
          const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
          const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
          cmp = ta - tb;
          break;
        }
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [filteredUsers, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sortIndicator = (key: SortKey) => sortKey === key ? (sortDir === "desc" ? " \u25BC" : " \u25B2") : "";

  // Segment counts for filter buttons
  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: enrichedUsers.length };
    for (const u of enrichedUsers) {
      counts[u.segment] = (counts[u.segment] || 0) + 1;
    }
    return counts;
  }, [enrichedUsers]);

  // Funnel data
  const usersWithAny = Object.keys(userCheckpoints).length;
  const completionCounts = CHECKPOINT_ORDER.map(cp =>
    Object.keys(userCheckpoints).filter(uid => userCheckpoints[uid].has(cp.id)).length
  );
  const farthestDistribution = useMemo(() => {
    const farthest: Record<string, number> = {};
    for (const uid of Object.keys(userCheckpoints)) {
      let f = -1;
      CHECKPOINT_ORDER.forEach((cp, i) => {
        if (userCheckpoints[uid].has(cp.id)) f = i;
      });
      farthest[uid] = f;
    }
    return CHECKPOINT_ORDER.map((_, i) =>
      Object.keys(userCheckpoints).filter(uid => farthest[uid] === i).length
    );
  }, [userCheckpoints, selectedTutorial]);

  const handleUserDeleted = (userId: string) => {
    // Refresh data after deletion
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Tutorial toggle + Search */}
      <div className="flex flex-wrap items-center gap-3">
        {(["lightning", "noise", "visual-lightning"] as const).map(t => (
          <button
            key={t}
            onClick={() => { setSelectedTutorial(t); setSelectedUserId(null); }}
            className={`font-pixel text-[11px] px-4 py-2 border-2 border-border transition-all ${
              selectedTutorial === t
                ? "bg-primary/20 border-[#FFD700] text-foreground font-semibold"
                : "hover:bg-primary/5 text-foreground/60"
            }`}
          >
            {t === "lightning" ? "LIGHTNING" : t === "noise" ? "NOISE" : "VISUAL LN"}
          </button>
        ))}
        <div className="flex-1" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border-2 border-border bg-background px-3 py-2 text-sm w-64"
          style={{ fontFamily: sansFont }}
        />
      </div>

      {/* Segment filter buttons */}
      <div className="flex flex-wrap gap-1.5">
        {["all", "on-track", "new", "struggling", "stalled", "churned", "completed", "browsing"].map(seg => {
          const count = segmentCounts[seg] || 0;
          if (seg !== "all" && count === 0) return null;
          const isActive = segmentFilter === seg;
          const style = seg !== "all" ? SEGMENT_STYLES[seg] : null;
          return (
            <button
              key={seg}
              onClick={() => setSegmentFilter(seg)}
              className={`font-pixel text-[9px] px-3 py-1.5 border transition-all cursor-pointer ${
                isActive
                  ? "border-[#FFD700] bg-primary/20 text-foreground"
                  : "border-border/50 text-foreground/60 hover:bg-primary/5"
              }`}
            >
              {style ? (
                <span className={style.text}>{style.label}</span>
              ) : "ALL"} ({count})
            </button>
          );
        })}
      </div>

      {/* View toggle */}
      <div className="flex gap-1 border-b-2 border-border">
        {(["table", "funnel", "matrix"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSubView(tab)}
            className={`font-pixel text-[10px] px-3 py-2 transition-all cursor-pointer ${
              subView === tab
                ? "bg-primary/20 border-b-2 border-b-[#FFD700] text-foreground font-semibold -mb-[2px]"
                : "hover:bg-primary/5 text-foreground/60"
            }`}
          >
            {tab === "table" ? "TABLE" : tab === "funnel" ? "FUNNEL" : "MATRIX"}
          </button>
        ))}
        <div className="flex-1" />
        <span className="font-pixel text-[9px] text-foreground/40 self-center px-2">{filteredUsers.length} STUDENTS</span>
      </div>

      {/* Table view */}
      {subView === "table" && (
        <div className="border-4 border-border bg-card pixel-shadow overflow-x-auto">
          <table className="w-full text-left text-sm" style={{ fontFamily: sansFont }}>
            <thead>
              <tr>
                <th className="font-pixel text-[10px] p-3 border-b-2 border-border bg-primary/20 cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  NAME{sortIndicator("name")}
                </th>
                <th className="font-pixel text-[10px] p-3 border-b-2 border-border bg-primary/20 cursor-pointer select-none" onClick={() => toggleSort("progress")}>
                  PROGRESS{sortIndicator("progress")}
                </th>
                <th className="font-pixel text-[10px] p-3 border-b-2 border-border bg-primary/20">SEGMENT</th>
                <th className="font-pixel text-[10px] p-3 border-b-2 border-border bg-primary/20 cursor-pointer select-none" onClick={() => toggleSort("lastActive")}>
                  LAST ACTIVE{sortIndicator("lastActive")}
                </th>
                <th className="font-pixel text-[10px] p-3 border-b-2 border-border bg-primary/20 cursor-pointer select-none" onClick={() => toggleSort("sats")}>
                  SATS{sortIndicator("sats")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map(u => {
                const pct = CHECKPOINT_ORDER.length > 0 ? Math.round(u.progress / CHECKPOINT_ORDER.length * 100) : 0;
                return (
                  <tr
                    key={u.id}
                    className="hover:bg-primary/10 cursor-pointer"
                    onClick={() => setSelectedUserId(u.id)}
                  >
                    <td className="p-3 border-b border-border/30">
                      <div className="font-medium">{u.displayName || truncate(u.email, 24) || truncate(u.id, 8)}</div>
                      {u.email && <div className="text-xs text-foreground/40">{u.email}</div>}
                    </td>
                    <td className="p-3 border-b border-border/30">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{u.progress}/{CHECKPOINT_ORDER.length}</span>
                        <div className="w-16 h-2 bg-border/20 overflow-hidden">
                          <div className="h-full bg-[#FFD700]/70" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="p-3 border-b border-border/30">
                      <SegmentBadge segment={u.segment} />
                    </td>
                    <td className="p-3 border-b border-border/30 text-foreground/60">
                      {relativeTime(u.lastActiveAt)}
                    </td>
                    <td className="p-3 border-b border-border/30">
                      {u.sats > 0 ? `${u.sats}` : "-"}
                    </td>
                  </tr>
                );
              })}
              {sortedUsers.length === 0 && (
                <tr><td colSpan={5} className="p-3 border-b border-border/30 text-center text-foreground/40">No students match</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Funnel view */}
      {subView === "funnel" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FunnelChart
            title="COMPLETION FUNNEL"
            items={CHECKPOINT_ORDER.map((cp, i) => ({ label: cp.label, count: completionCounts[i] }))}
            total={usersWithAny}
            color="gold"
          />
          <FunnelChart
            title="WHERE USERS STOPPED"
            items={CHECKPOINT_ORDER.map((cp, i) => ({ label: cp.label, count: farthestDistribution[i] }))}
            total={usersWithAny}
            color="red"
          />
        </div>
      )}

      {/* Matrix view */}
      {subView === "matrix" && (() => {
        const activeUserIds = Object.keys(userCheckpoints).sort((a, b) =>
          userCheckpoints[b].size - userCheckpoints[a].size
        );
        const userMap: Record<string, { name: string }> = {};
        for (const u of data.users) {
          userMap[u.id] = { name: u.displayName || truncate(u.id, 8) };
        }
        return (
          <div className="border-4 border-border bg-card pixel-shadow overflow-x-auto">
            <div className="font-pixel text-[10px] p-3">USER PROGRESS ({activeUserIds.length})</div>
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
                  const completed = userCheckpoints[uid];
                  const total = CHECKPOINT_ORDER.filter(cp => completed.has(cp.id)).length;
                  const allDone = total === CHECKPOINT_ORDER.length;
                  return (
                    <tr
                      key={uid}
                      className={`hover:bg-primary/10 cursor-pointer ${allDone ? "bg-green-500/5" : ""}`}
                      onClick={() => setSelectedUserId(uid)}
                    >
                      <td className="p-2 border-b border-border/30 text-sm">{userMap[uid]?.name || truncate(uid, 8)}</td>
                      {CHECKPOINT_ORDER.map(cp => (
                        <td key={cp.id} className="p-2 border-b border-border/30 text-center">
                          {completed.has(cp.id) ? <span className="text-green-600 font-bold">{"\u2713"}</span> : <span className="text-foreground/20">--</span>}
                        </td>
                      ))}
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
        );
      })()}

      {/* Student detail panel */}
      {selectedUserId && (
        <StudentDetailPanel
          userId={selectedUserId}
          data={data}
          selectedTutorial={selectedTutorial}
          storedPassword={storedPassword}
          onClose={() => setSelectedUserId(null)}
          onRefresh={onRefresh}
          onUserDeleted={handleUserDeleted}
        />
      )}
    </div>
  );
}
