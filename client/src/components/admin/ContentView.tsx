import { useState, useMemo } from "react";
import StatCard from "./StatCard";
import FunnelChart from "./FunnelChart";
import { type DashboardData, TUTORIAL_CONFIGS, type TutorialKey, sansFont, formatTime } from "./admin-data";

interface ContentViewProps {
  data: DashboardData;
}

type ContentSubTab = "engagement" | "dropoff" | "traffic";

export default function ContentView({ data }: ContentViewProps) {
  const [selectedTutorial, setSelectedTutorial] = useState<TutorialKey>("lightning");
  const [subTab, setSubTab] = useState<ContentSubTab>("engagement");

  const config = TUTORIAL_CONFIGS[selectedTutorial];
  const CHECKPOINT_ORDER = config.checkpoints;
  const TUTORIAL_PAGES = config.pages;
  const checkpointIdSet = new Set(CHECKPOINT_ORDER.map(cp => cp.id));

  // Page stats map
  const pageStatsMap = useMemo(() => {
    const m: Record<string, { views: number; avgDuration: number }> = {};
    for (const p of data.pageStats) m[p.page] = { views: p.views, avgDuration: p.avgDuration };
    return m;
  }, [data.pageStats]);

  // User checkpoint data for completion rates
  const { userCheckpoints, usersWithAny } = useMemo(() => {
    const uc: Record<string, Set<string>> = {};
    for (const c of data.checkpointCompletions) {
      if (!checkpointIdSet.has(c.checkpointId)) continue;
      if (!uc[c.userId]) uc[c.userId] = new Set();
      uc[c.userId].add(c.checkpointId);
    }
    return { userCheckpoints: uc, usersWithAny: Object.keys(uc).length };
  }, [data.checkpointCompletions, selectedTutorial]);

  // Summary KPIs
  const tutorialPages = data.pageStats.filter(p => p.page.startsWith(config.urlPrefix));
  const totalViews = tutorialPages.reduce((s, p) => s + p.views, 0);
  const avgTimeAll = tutorialPages.length > 0
    ? Math.round(tutorialPages.reduce((s, p) => s + p.avgDuration * p.views, 0) / Math.max(totalViews, 1))
    : 0;

  const completionCounts = CHECKPOINT_ORDER.map(cp =>
    Object.keys(userCheckpoints).filter(uid => userCheckpoints[uid].has(cp.id)).length
  );
  const completedAll = Object.values(userCheckpoints).filter(s => s.size === CHECKPOINT_ORDER.length).length;
  const overallCompletionRate = usersWithAny > 0 ? Math.round(completedAll / usersWithAny * 100) : 0;

  // Hardest checkpoint (lowest completion rate relative to users who started)
  const hardestIdx = completionCounts.length > 0
    ? completionCounts.reduce((min, c, i) => c < completionCounts[min] ? i : min, 0)
    : -1;
  const hardestCheckpoint = hardestIdx >= 0 ? CHECKPOINT_ORDER[hardestIdx] : null;

  // Farthest distribution for drop-off
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

  // Biggest drop-offs (transitions with largest absolute drop)
  const dropoffs = useMemo(() => {
    if (completionCounts.length < 2) return [];
    return completionCounts.slice(1).map((c, i) => ({
      from: CHECKPOINT_ORDER[i].label,
      to: CHECKPOINT_ORDER[i + 1].label,
      drop: completionCounts[i] - c,
      fromCount: completionCounts[i],
      toCount: c,
    })).sort((a, b) => b.drop - a.drop).slice(0, 5);
  }, [completionCounts]);

  // Page viewers for completion rate per page
  const pageViewers = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const e of data.recentEvents) {
      if (!e.userId || !e.page.startsWith(config.urlPrefix)) continue;
      if (!m[e.page]) m[e.page] = new Set();
      m[e.page].add(e.userId);
    }
    return m;
  }, [data.recentEvents, selectedTutorial]);

  // Traffic stats
  const sections = [
    { label: "Lightning Tutorial", prefix: "/lightning-tutorial" },
    { label: "Noise Tutorial", prefix: "/noise-tutorial" },
    { label: "Visual Lightning", prefix: "/visual-lightning" },
    { label: "Other Pages", prefix: "" },
  ];
  const allTotalViews = data.pageStats.reduce((s, p) => s + p.views, 0);
  const sectionStats = sections.map(sec => {
    const pages = sec.prefix
      ? data.pageStats.filter(p => p.page.startsWith(sec.prefix))
      : data.pageStats.filter(p => !p.page.startsWith("/lightning-tutorial") && !p.page.startsWith("/noise-tutorial") && !p.page.startsWith("/visual-lightning"));
    const views = pages.reduce((s, p) => s + p.views, 0);
    const totalDur = pages.reduce((s, p) => s + p.avgDuration * p.views, 0);
    const avgDur = views > 0 ? Math.round(totalDur / views) : 0;
    return { ...sec, views, avgDur };
  });

  // Top pages, longest pages, top referrers
  const topPages = [...data.pageStats].sort((a, b) => b.views - a.views).slice(0, 10);
  const longestPages = [...data.pageStats].filter(p => p.views >= 2).sort((a, b) => b.avgDuration - a.avgDuration).slice(0, 10);
  const refCounts: Record<string, number> = {};
  for (const e of data.recentEvents) {
    const ref = e.referrer || "(direct)";
    refCounts[ref] = (refCounts[ref] || 0) + 1;
  }
  const topReferrers = Object.entries(refCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Tutorial toggle */}
      <div className="flex flex-wrap items-center gap-3">
        {(["lightning", "noise", "visual-lightning"] as const).map(t => (
          <button
            key={t}
            onClick={() => setSelectedTutorial(t)}
            className={`font-pixel text-[11px] px-4 py-2 border-2 border-border transition-all ${
              selectedTutorial === t
                ? "bg-primary/20 border-[#FFD700] text-foreground font-semibold"
                : "hover:bg-primary/5 text-foreground/60"
            }`}
          >
            {t === "lightning" ? "LIGHTNING" : t === "noise" ? "NOISE" : "VISUAL LN"}
          </button>
        ))}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="TOTAL VIEWS" value={totalViews} />
        <StatCard label="AVG TIME/PAGE" value={formatTime(avgTimeAll)} />
        <StatCard label="COMPLETION RATE" value={`${overallCompletionRate}%`} />
        <StatCard label="HARDEST CHECK" value={hardestCheckpoint?.label || "-"} />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b-2 border-border">
        {(["engagement", "dropoff", "traffic"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`font-pixel text-[10px] px-3 py-2 transition-all cursor-pointer ${
              subTab === tab
                ? "bg-primary/20 border-b-2 border-b-[#FFD700] text-foreground font-semibold -mb-[2px]"
                : "hover:bg-primary/5 text-foreground/60"
            }`}
          >
            {tab === "engagement" ? "CHAPTER ENGAGEMENT" : tab === "dropoff" ? "DROP-OFF ANALYSIS" : "TRAFFIC SOURCES"}
          </button>
        ))}
      </div>

      {/* Chapter Engagement */}
      {subTab === "engagement" && (
        <div className="border-4 border-border bg-card pixel-shadow overflow-x-auto">
          <table className="w-full text-left text-sm" style={{ fontFamily: sansFont }}>
            <thead>
              <tr>
                <th className="font-pixel text-[10px] p-3 border-b-2 border-border bg-primary/20">CHAPTER</th>
                <th className="font-pixel text-[10px] p-3 border-b-2 border-border bg-primary/20">VIEWS</th>
                <th className="font-pixel text-[10px] p-3 border-b-2 border-border bg-primary/20">AVG TIME</th>
                <th className="font-pixel text-[10px] p-3 border-b-2 border-border bg-primary/20">COMPLETION</th>
                <th className="font-pixel text-[10px] p-3 border-b-2 border-border bg-primary/20">DROP-OFF</th>
              </tr>
            </thead>
            <tbody>
              {TUTORIAL_PAGES.map(tp => {
                const stats = pageStatsMap[tp.page];
                const viewers = pageViewers[tp.page]?.size ?? 0;
                // Find checkpoints associated with this page (rough match by index)
                const cpIdx = TUTORIAL_PAGES.indexOf(tp);
                const relevantCp = CHECKPOINT_ORDER.find((_, i) =>
                  i === cpIdx || CHECKPOINT_ORDER[i]?.chapter === tp.label
                );
                const cpCount = relevantCp ? completionCounts[CHECKPOINT_ORDER.indexOf(relevantCp)] : null;
                const completionPct = viewers > 0 && cpCount != null ? Math.round(cpCount / viewers * 100) : null;
                const isDropoff = completionPct != null && completionPct < 80 && viewers > 5;

                return (
                  <tr key={tp.page} className="hover:bg-primary/5">
                    <td className="p-3 border-b border-border/30">{tp.label}</td>
                    <td className="p-3 border-b border-border/30">{stats?.views ?? 0}</td>
                    <td className="p-3 border-b border-border/30">{stats ? formatTime(stats.avgDuration) : "-"}</td>
                    <td className="p-3 border-b border-border/30">
                      {completionPct != null ? `${completionPct}%` : "-"}
                    </td>
                    <td className="p-3 border-b border-border/30">
                      {isDropoff && <span className="text-red-500 font-pixel text-[9px]">DROP-OFF</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drop-off Analysis */}
      {subTab === "dropoff" && (
        <div className="space-y-4">
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

          {/* Biggest drop-offs table */}
          {dropoffs.length > 0 && (
            <div className="border-4 border-border bg-card p-4 pixel-shadow">
              <div className="font-pixel text-[10px] mb-2">BIGGEST DROP-OFFS</div>
              <table className="w-full text-left text-sm" style={{ fontFamily: sansFont }}>
                <thead>
                  <tr>
                    <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">FROM</th>
                    <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">TO</th>
                    <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">LOST</th>
                    <th className="font-pixel text-[10px] p-2 border-b-2 border-border bg-primary/20">RATE</th>
                  </tr>
                </thead>
                <tbody>
                  {dropoffs.map((d, i) => (
                    <tr key={i} className="hover:bg-primary/5">
                      <td className="p-2 border-b border-border/30">{d.from} ({d.fromCount})</td>
                      <td className="p-2 border-b border-border/30">{d.to} ({d.toCount})</td>
                      <td className="p-2 border-b border-border/30 text-red-500 font-semibold">-{d.drop}</td>
                      <td className="p-2 border-b border-border/30">{d.fromCount > 0 ? `${Math.round(d.drop / d.fromCount * 100)}%` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Traffic Sources */}
      {subTab === "traffic" && (
        <div className="space-y-4">
          {/* Traffic by section */}
          <div className="border-4 border-border bg-card p-4 pixel-shadow">
            <div className="font-pixel text-[10px] mb-2">TRAFFIC BY SECTION</div>
            <div className="space-y-1.5" style={{ fontFamily: sansFont }}>
              {sectionStats.map(sec => {
                const pct = allTotalViews > 0 ? Math.round(sec.views / allTotalViews * 100) : 0;
                return (
                  <div key={sec.label} className="flex items-center gap-2">
                    <div className="w-36 text-xs text-foreground/60 shrink-0">{sec.label}</div>
                    <div className="flex-1 h-5 bg-border/20 relative overflow-hidden border border-border/30">
                      <div className="h-full bg-[#FFD700]/60" style={{ width: `${pct}%` }} />
                      <div className="absolute inset-0 flex items-center px-2 text-[11px] font-semibold">{sec.views} views ({pct}%)</div>
                    </div>
                    <div className="w-20 text-xs text-foreground/40 text-right shrink-0">avg {formatTime(sec.avgDur)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border-4 border-border bg-card p-4 pixel-shadow">
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
            <div className="border-4 border-border bg-card p-4 pixel-shadow">
              <div className="font-pixel text-[10px] mb-2">LONGEST AVG TIME</div>
              <div className="space-y-1" style={{ fontFamily: sansFont }}>
                {longestPages.map((p, i) => (
                  <div key={p.page} className="flex items-center gap-2 text-xs">
                    <span className="text-foreground/30 w-4 shrink-0">{i + 1}.</span>
                    <span className="flex-1 truncate">{p.page}</span>
                    <span className="text-foreground/60 shrink-0">{formatTime(p.avgDuration)}</span>
                  </div>
                ))}
                {longestPages.length === 0 && <div className="text-xs text-foreground/40">Not enough data</div>}
              </div>
            </div>
            <div className="border-4 border-border bg-card p-4 pixel-shadow">
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
      )}
    </div>
  );
}
