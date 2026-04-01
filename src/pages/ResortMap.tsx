import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useUnits } from "@/hooks/useUnits";
import { useBookings } from "@/hooks/useBookings";
import { UnitDetailSheet } from "@/components/UnitDetailSheet";
import { BookingDetailSheet } from "@/components/BookingDetailSheet";
import { BookingModal } from "@/components/BookingModal";
import { MapLegend } from "@/components/MapLegend";
import { MapUnitBlock } from "@/components/MapUnitBlock";
import { computeUnitStatusMap } from "@/lib/mapUtils";
import { format } from "date-fns";
import type { Unit } from "@/hooks/useUnits";
import type { Booking } from "@/hooks/useBookings";

const UNIT_POSITIONS: Record<string, { x: number; y: number; w: number; h: number }> = {
  "Pool Villa 1": { x: 3, y: 5, w: 12, h: 18 },
  "Pool Villa 2": { x: 17, y: 5, w: 12, h: 18 },
  "Pool Villa 3": { x: 31, y: 5, w: 12, h: 18 },
  "Pool Villa 4": { x: 57, y: 5, w: 12, h: 18 },
  "Pool Villa 5": { x: 71, y: 5, w: 12, h: 18 },
  "Pool Villa 6": { x: 85, y: 5, w: 12, h: 18 },
  "Owner's Villa": { x: 3, y: 35, w: 16, h: 28 },
  "AC Pool Kubo 1": { x: 71, y: 65, w: 12, h: 16 },
  "AC Pool Kubo 2": { x: 85, y: 65, w: 12, h: 16 },
};

const POOL = { x: 25, y: 35, w: 40, h: 28 };
const KITCHEN = { x: 44, y: 5, w: 12, h: 18 };

function getShortName(name: string): string {
  return name.replace("Pool Villa ", "PV").replace("AC Pool Kubo ", "APK");
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
  const unitStatusMap = useMemo(
    () => computeUnitStatusMap(units, bookings, todayStr),
    [units, bookings, todayStr]
  );

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
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-sm flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-semibold">Pool Area Map</h1>
            <p className="text-xs text-muted-foreground">Pool Area — Top View · {format(new Date(), "MMMM d, yyyy")}</p>
          </div>
          <MapLegend />
        </div>

        <div className="flex-1 p-4 overflow-auto">
          <div className="relative w-full max-w-4xl mx-auto" style={{ aspectRatio: "16/10" }}>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-emerald-950/20 dark:to-sky-950/20 border border-border shadow-sm" />

            {/* Swimming Pool */}
            <div
              className="absolute rounded-lg bg-sky-400/40 border-2 border-sky-400/60 flex items-center justify-center backdrop-blur-sm"
              style={{ left: `${POOL.x}%`, top: `${POOL.y}%`, width: `${POOL.w}%`, height: `${POOL.h}%` }}
            >
              <div className="text-sky-700 dark:text-sky-300 text-sm font-medium tracking-widest uppercase opacity-60">
                Swimming Pool
              </div>
            </div>

            {/* Kitchen */}
            <div
              className="absolute rounded-lg bg-orange-100 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-700 flex items-center justify-center"
              style={{ left: `${KITCHEN.x}%`, top: `${KITCHEN.y}%`, width: `${KITCHEN.w}%`, height: `${KITCHEN.h}%` }}
            >
              <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">Kitchen</span>
            </div>

            {/* Unit blocks */}
            {mappedUnits.map((unit) => {
              const pos = UNIT_POSITIONS[unit.name];
              const info = unitStatusMap[unit.id] || { status: "available" as const };
              return (
                <MapUnitBlock
                  key={unit.id}
                  name={unit.name}
                  shortName={getShortName(unit.name)}
                  guestName={info.guestName}
                  status={info.status}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.w}%`, height: `${pos.h}%` }}
                  onClick={() => handleUnitClick(unit)}
                />
              );
            })}

            {/* Labels */}
            <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest" style={{ left: "3%", top: "1%" }}>
              Pool Villas (Left Wing)
            </span>
            <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest" style={{ right: "3%", top: "1%", textAlign: "right" }}>
              Pool Villas (Right Wing)
            </span>
            <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest" style={{ right: "3%", bottom: "12%", textAlign: "right" }}>
              AC Pool Kubos
            </span>
          </div>
        </div>
      </div>

      <UnitDetailSheet open={unitSheetOpen} onOpenChange={setUnitSheetOpen} unit={selectedUnit} />
      <BookingDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        booking={selectedBooking}
        onEdit={(b) => { setSheetOpen(false); setSelectedBooking(b); setModalOpen(true); }}
      />
      <BookingModal open={modalOpen} onOpenChange={setModalOpen} booking={selectedBooking} />
    </AppLayout>
  );
};

export default ResortMap;
