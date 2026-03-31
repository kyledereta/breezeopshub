import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useUnits } from "@/hooks/useUnits";
import { useBookings } from "@/hooks/useBookings";
import { UnitDetailSheet } from "@/components/UnitDetailSheet";
import { BookingDetailSheet } from "@/components/BookingDetailSheet";
import { BookingModal } from "@/components/BookingModal";
import { format } from "date-fns";
import type { Unit } from "@/hooks/useUnits";
import type { Booking } from "@/hooks/useBookings";
import { cn } from "@/lib/utils";

// Layout positions for the resort map (percentage-based)
const UNIT_POSITIONS: Record<string, { x: number; y: number; w: number; h: number }> = {
  // Upper left — Pool Villas 1-3
  "Pool Villa 1": { x: 3, y: 5, w: 12, h: 18 },
  "Pool Villa 2": { x: 17, y: 5, w: 12, h: 18 },
  "Pool Villa 3": { x: 31, y: 5, w: 12, h: 18 },
  // Upper right — Pool Villas 4-6
  "Pool Villa 4": { x: 57, y: 5, w: 12, h: 18 },
  "Pool Villa 5": { x: 71, y: 5, w: 12, h: 18 },
  "Pool Villa 6": { x: 85, y: 5, w: 12, h: 18 },
  // Left — Owner's Villa
  "Owner's Villa": { x: 3, y: 35, w: 16, h: 28 },
  // Lower right — AC Pool Kubos
  "AC Pool Kubo 1": { x: 71, y: 65, w: 12, h: 16 },
  "AC Pool Kubo 2": { x: 85, y: 65, w: 12, h: 16 },
};

// Swimming pool position (center)
const POOL = { x: 25, y: 35, w: 40, h: 28 };
// Common kitchen
const KITCHEN = { x: 44, y: 5, w: 12, h: 18 };

type OccupancyStatus = "occupied" | "arriving" | "departing" | "available" | "maintenance";

function getStatusColor(status: OccupancyStatus) {
  switch (status) {
    case "occupied": return "bg-red-500/80 border-red-600 text-white";
    case "arriving": return "bg-amber-400/80 border-amber-500 text-amber-950";
    case "departing": return "bg-blue-400/80 border-blue-500 text-white";
    case "available": return "bg-emerald-500/80 border-emerald-600 text-white";
    case "maintenance": return "bg-muted border-muted-foreground/30 text-muted-foreground";
  }
}

function getStatusLabel(status: OccupancyStatus) {
  switch (status) {
    case "occupied": return "Occupied";
    case "arriving": return "Arriving";
    case "departing": return "Departing";
    case "available": return "Available";
    case "maintenance": return "Unavailable";
  }
}

const ResortMap = () => {
  const { data: units = [] } = useUnits();
  const { data: bookings = [] } = useBookings();
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [unitSheetOpen, setUnitSheetOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Compute occupancy status for each unit today
  const unitStatusMap = useMemo(() => {
    const map: Record<string, { status: OccupancyStatus; booking?: Booking; guestName?: string }> = {};
    const activeBookings = bookings.filter(
      (b) => !b.deleted_at && !["Cancelled", "Rescheduled"].includes(b.booking_status)
    );

    for (const unit of units) {
      if (unit.unit_status !== "Available") {
        map[unit.id] = { status: "maintenance" };
        continue;
      }

      const unitBookings = activeBookings.filter((b) => b.unit_id === unit.id);
      const checkedIn = unitBookings.find(
        (b) => b.booking_status === "Checked In" && b.check_in <= todayStr && b.check_out >= todayStr
      );
      if (checkedIn) {
        map[unit.id] = { status: "occupied", booking: checkedIn, guestName: checkedIn.guest_name };
        continue;
      }

      const arriving = unitBookings.find(
        (b) => b.check_in === todayStr && ["Confirmed", "Inquiry"].includes(b.booking_status)
      );
      if (arriving) {
        map[unit.id] = { status: "arriving", booking: arriving, guestName: arriving.guest_name };
        continue;
      }

      const departing = unitBookings.find(
        (b) => b.check_out === todayStr && b.booking_status === "Checked In"
      );
      if (departing) {
        map[unit.id] = { status: "departing", booking: departing, guestName: departing.guest_name };
        continue;
      }

      // Check confirmed future stays that span today
      const confirmed = unitBookings.find(
        (b) => b.check_in <= todayStr && b.check_out > todayStr && b.booking_status === "Confirmed"
      );
      if (confirmed) {
        map[unit.id] = { status: "occupied", booking: confirmed, guestName: confirmed.guest_name };
        continue;
      }

      map[unit.id] = { status: "available" };
    }
    return map;
  }, [units, bookings, todayStr]);

  // Only show units that have positions defined (Pool Area + Owner's Villa)
  const mappedUnits = units.filter((u) => UNIT_POSITIONS[u.name]);

  const handleUnitClick = (unit: Unit) => {
    const info = unitStatusMap[unit.id];
    if (info?.booking) {
      setSelectedBooking(info.booking);
      setSheetOpen(true);
    } else {
      setSelectedUnit(unit);
      setUnitSheetOpen(true);
    }
  };

  return (
    <AppLayout onNewBooking={() => setModalOpen(true)}>
      <div className="h-[calc(100vh-3rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-sm">
          <div>
            <h1 className="text-lg font-semibold">Resort Map</h1>
            <p className="text-xs text-muted-foreground">Pool Area — Top View · {format(new Date(), "MMMM d, yyyy")}</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {(["occupied", "arriving", "departing", "available", "maintenance"] as OccupancyStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={cn("w-3 h-3 rounded-sm border", getStatusColor(s))} />
                <span className="text-muted-foreground">{getStatusLabel(s)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Map Canvas */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="relative w-full max-w-4xl mx-auto" style={{ aspectRatio: "16/10" }}>
            {/* Background */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-emerald-950/20 dark:to-sky-950/20 border border-border shadow-sm" />

            {/* Swimming Pool */}
            <div
              className="absolute rounded-lg bg-sky-400/40 border-2 border-sky-400/60 flex items-center justify-center backdrop-blur-sm"
              style={{
                left: `${POOL.x}%`,
                top: `${POOL.y}%`,
                width: `${POOL.w}%`,
                height: `${POOL.h}%`,
              }}
            >
              <div className="text-sky-700 dark:text-sky-300 text-sm font-medium tracking-widest uppercase opacity-60">
                Swimming Pool
              </div>
            </div>

            {/* Common Kitchen */}
            <div
              className="absolute rounded-lg bg-orange-100 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-700 flex items-center justify-center"
              style={{
                left: `${KITCHEN.x}%`,
                top: `${KITCHEN.y}%`,
                width: `${KITCHEN.w}%`,
                height: `${KITCHEN.h}%`,
              }}
            >
              <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                Kitchen
              </span>
            </div>

            {/* Unit blocks */}
            {mappedUnits.map((unit) => {
              const pos = UNIT_POSITIONS[unit.name];
              const info = unitStatusMap[unit.id] || { status: "available" as OccupancyStatus };
              return (
                <button
                  key={unit.id}
                  onClick={() => handleUnitClick(unit)}
                  className={cn(
                    "absolute rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer",
                    getStatusColor(info.status)
                  )}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    width: `${pos.w}%`,
                    height: `${pos.h}%`,
                  }}
                  title={`${unit.name}${info.guestName ? ` — ${info.guestName}` : ""}`}
                >
                  <span className="text-[10px] font-bold leading-tight text-center px-1">
                    {unit.name.replace("Pool Villa ", "PV").replace("AC Pool Kubo ", "APK")}
                  </span>
                  {info.guestName && (
                    <span className="text-[8px] leading-tight opacity-90 truncate max-w-full px-1">
                      {info.guestName.split(" ")[0]}
                    </span>
                  )}
                  <span className="text-[7px] uppercase tracking-wider opacity-70">
                    {getStatusLabel(info.status)}
                  </span>
                </button>
              );
            })}

            {/* Labels */}
            <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest"
              style={{ left: "3%", top: "1%" }}>
              Pool Villas (Left Wing)
            </span>
            <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest"
              style={{ right: "3%", top: "1%", textAlign: "right" }}>
              Pool Villas (Right Wing)
            </span>
            <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest"
              style={{ right: "3%", bottom: "12%", textAlign: "right" }}>
              AC Pool Kubos
            </span>
          </div>
        </div>
      </div>

      <UnitDetailSheet
        open={unitSheetOpen}
        onOpenChange={setUnitSheetOpen}
        unit={selectedUnit}
      />

      <BookingDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        booking={selectedBooking}
        onEdit={(b) => {
          setSheetOpen(false);
          setSelectedBooking(b);
          setModalOpen(true);
        }}
      />

      <BookingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        booking={selectedBooking}
      />
    </AppLayout>
  );
};

export default ResortMap;
