import { cn } from "@/lib/utils";
import { getStatusColor, getStatusLabel, type OccupancyStatus } from "@/lib/mapUtils";

interface MapUnitBlockProps {
  name: string;
  shortName: string;
  guestName?: string;
  status: OccupancyStatus;
  style: React.CSSProperties;
  onClick: () => void;
}

export function MapUnitBlock({ name, shortName, guestName, status, style, onClick }: MapUnitBlockProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer",
        getStatusColor(status)
      )}
      style={style}
      title={`${name}${guestName ? ` — ${guestName}` : ""}`}
    >
      <span className="text-[10px] font-bold leading-tight text-center px-1">
        {shortName}
      </span>
      {guestName && (
        <span className="text-[8px] leading-tight opacity-90 truncate max-w-full px-1">
          {guestName.split(" ")[0]}
        </span>
      )}
      <span className="text-[7px] uppercase tracking-wider opacity-70">
        {getStatusLabel(status)}
      </span>
    </button>
  );
}
