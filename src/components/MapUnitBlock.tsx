import { cn } from "@/lib/utils";
import { getStatusColor, getStatusLabel, type OccupancyStatus } from "@/lib/mapUtils";

interface MapUnitBlockProps {
  name: string;
  shortName: string;
  guestName?: string;
  status: OccupancyStatus;
  style: React.CSSProperties;
  onClick: () => void;
  bookingId?: string;
  unitId?: string;
  onDrop?: (bookingId: string, targetUnitId: string) => void;
}

export function MapUnitBlock({ name, shortName, guestName, status, style, onClick, bookingId, unitId, onDrop }: MapUnitBlockProps) {
  const isDraggable = !!bookingId && (status === "occupied" || status === "arriving" || status === "departing");
  const isDropTarget = status === "available";

  const handleDragStart = (e: React.DragEvent) => {
    if (!bookingId) return;
    e.dataTransfer.setData("bookingId", bookingId);
    e.dataTransfer.setData("sourceUnitName", name);
    e.dataTransfer.setData("guestName", guestName || "");
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isDropTarget || !onDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDropTarget || !onDrop || !unitId) return;
    const draggedBookingId = e.dataTransfer.getData("bookingId");
    if (draggedBookingId) {
      onDrop(draggedBookingId, unitId);
    }
  };

  return (
    <button
      onClick={onClick}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "absolute rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer",
        getStatusColor(status),
        isDraggable && "cursor-grab active:cursor-grabbing",
        isDropTarget && "drop-target"
      )}
      style={style}
      title={`${name}${guestName ? ` — ${guestName}` : ""}${isDraggable ? " (drag to move)" : ""}`}
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
