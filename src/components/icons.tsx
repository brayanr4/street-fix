import {
  CircleHelp,
  Construction,
  Droplets,
  Footprints,
  Lightbulb,
  SprayCan,
  TrafficCone,
  Trash2,
  TreeDeciduous,
  type LucideIcon,
} from "lucide-react";
import type { IssueType } from "@/lib/types";

const ISSUE_ICONS: Record<IssueType, LucideIcon> = {
  pothole: Construction,
  streetlight: Lightbulb,
  footpath: Footprints,
  graffiti: SprayCan,
  dumping: Trash2,
  tree: TreeDeciduous,
  drainage: Droplets,
  signage: TrafficCone,
  other: CircleHelp,
};

export function IssueIcon({ type, className = "h-6 w-6" }: { type: IssueType; className?: string }) {
  const Icon = ISSUE_ICONS[type];
  return <Icon className={className} aria-hidden strokeWidth={2} />;
}

// Street Fix mark: a map pin standing on a road with a centre line.
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#18202b" />
      <rect x="0" y="22" width="32" height="6" fill="#2c3644" />
      <path d="M3 25h4M11 25h4M19 25h4M27 25h3" stroke="#ffcc00" strokeWidth="1.5" />
      <path d="M16 23s-6-6.2-6-10.5a6 6 0 1 1 12 0C22 16.8 16 23 16 23Z" fill="#ffcc00" />
      <circle cx="16" cy="12.5" r="2.3" fill="#18202b" />
    </svg>
  );
}
