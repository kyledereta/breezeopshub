import { cn } from "@/lib/utils";
import { getStatusColor, getStatusLabel, type OccupancyStatus } from "@/lib/mapUtils";

const STATUSES: OccupancyStatus[] = ["occupied", "arriving", "departing", "available", "maintenance"];

export function MapLegend() {
  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      {STATUSES.map((s) => (
        <div key={s} className="flex items-center gap-1.5">
          <div className={cn("w-3 h-3 rounded-sm border", getStatusColor(s))} />
          <span className="text-muted-foreground">{getStatusLabel(s)}</span>
        </div>
      ))}
    </div>
  );
}
