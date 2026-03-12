const SEGMENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  completed: { bg: "bg-yellow-500/20", text: "text-yellow-700", label: "COMPLETED" },
  "on-track": { bg: "bg-green-500/20", text: "text-green-700", label: "ON TRACK" },
  struggling: { bg: "bg-yellow-600/20", text: "text-yellow-700", label: "STRUGGLING" },
  stalled: { bg: "bg-orange-500/20", text: "text-orange-700", label: "STALLED" },
  churned: { bg: "bg-red-500/20", text: "text-red-700", label: "CHURNED" },
  browsing: { bg: "bg-gray-500/20", text: "text-gray-600", label: "BROWSING" },
  new: { bg: "bg-blue-500/20", text: "text-blue-700", label: "NEW" },
};

interface SegmentBadgeProps {
  segment: string;
}

export default function SegmentBadge({ segment }: SegmentBadgeProps) {
  const style = SEGMENT_STYLES[segment] || SEGMENT_STYLES.browsing;
  return (
    <span className={`font-pixel text-[9px] px-2 py-0.5 ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

export { SEGMENT_STYLES };
