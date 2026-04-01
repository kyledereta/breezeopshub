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

// Beach Area layout positions (percentage-based on a 16:10 canvas)
// Upper row: Kitchen > Common CR > Teepee 1-4 > Beach Villa 1-6
// Middle: Walkway to beachfront
// Lower row: Fan Kubo 1-4 > Big Kubo > AC Beach Kubo 1-2

const UNIT_POSITIONS: Record<string, { x: number; y: number; w: number; h: number }> = {
  // Upper row — Teepee Kubos (after Kitchen & CR)
  // Upper row — Teepee Kubos
  "Teepee Kubo 1": { x: 3, y: 4, w: 8, h: 16 },
  "Teepee Kubo 2": { x: 12, y: 4, w: 8, h: 16 },
  "Teepee Kubo 3": { x: 21, y: 4, w: 8, h: 16 },
  "Teepee Kubo 4": { x: 30, y: 4, w: 8, h: 16 },
  // Upper row — Beach Villas
  "Beach Villa 1": { x: 40, y: 4, w: 7, h: 16 },
  "Beach Villa 2": { x: 48, y: 4, w: 7, h: 16 },
  "Beach Villa 3": { x: 56, y: 4, w: 7, h: 16 },
  "Beach Villa 4": { x: 64, y: 4, w: 7, h: 16 },
  "Beach Villa 5": { x: 72, y: 4, w: 7, h: 16 },
  "Beach Villa 6": { x: 80, y: 4, w: 7, h: 16 },
  // Lower row — Fan Kubos
  "Fan Kubo 1": { x: 3, y: 72, w: 9, h: 16 },
  "Fan Kubo 2": { x: 13, y: 72, w: 9, h: 16 },
  "Fan Kubo 3": { x: 23, y: 72, w: 9, h: 16 },
  "Fan Kubo 4": { x: 33, y: 72, w: 9, h: 16 },
  // Lower row — Big Kubo
  "Big Kubo":    { x: 44, y: 72, w: 12, h: 16 },
  // Lower row — AC Beach Kubos
  "AC Beach Kubo 1": { x: 58, y: 72, w: 10, h: 16 },
  "AC Beach Kubo 2": { x: 69, y: 72, w: 10, h: 16 },
};

// Fixed structures
const WALKWAY = { x: 3, y: 38, w: 94, h: 18 };
const OPEN_COTTAGE = { x: 89, y: 4, w: 9, h: 16 };

function getShortName(name: string): string {
  return name
    .replace("Teepee Kubo ", "TK")
    .replace("Beach Villa ", "BV")
    .replace("Fan Kubo ", "FK")
    .replace("AC Beach Kubo ", "ABK")
    .replace("Big Kubo", "BK");
}

const BeachMap = () => {
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
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-sm flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-semibold">Beach Area Map</h1>
            <p className="text-xs text-muted-foreground">
              Beach Area — Top View · {format(new Date(), "MMMM d, yyyy")}
            </p>
          </div>
          <MapLegend />
        </div>

        {/* Map Canvas */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="relative w-full max-w-5xl mx-auto" style={{ aspectRatio: "16/10" }}>
            {/* Background */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-50 to-sky-50 dark:from-amber-950/20 dark:to-sky-950/20 border border-border shadow-sm" />

            {/* Kitchen */}
            <div
              className="absolute rounded-lg bg-orange-100 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-700 flex items-center justify-center"
              style={{ left: `${KITCHEN.x}%`, top: `${KITCHEN.y}%`, width: `${KITCHEN.w}%`, height: `${KITCHEN.h}%` }}
            >
              <span className="text-[9px] font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                Kitchen
              </span>
            </div>

            {/* Common CR */}
            <div
              className="absolute rounded-lg bg-slate-100 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-600 flex items-center justify-center"
              style={{ left: `${COMMON_CR.x}%`, top: `${COMMON_CR.y}%`, width: `${COMMON_CR.w}%`, height: `${COMMON_CR.h}%` }}
            >
              <span className="text-[9px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Common CR
              </span>
            </div>

            {/* Walkway */}
            <div
              className="absolute rounded-lg bg-stone-200/60 dark:bg-stone-700/30 border border-dashed border-stone-400 dark:border-stone-600 flex items-center justify-center"
              style={{ left: `${WALKWAY.x}%`, top: `${WALKWAY.y}%`, width: `${WALKWAY.w}%`, height: `${WALKWAY.h}%` }}
            >
              <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                <span className="text-xs font-medium tracking-widest uppercase opacity-60">
                  Walkway to Beachfront
                </span>
                <span className="text-lg opacity-40">→</span>
              </div>
            </div>

            {/* Beachfront indicator */}
            <div
              className="absolute rounded-r-xl bg-sky-300/30 dark:bg-sky-700/20 border-l-2 border-sky-400/50 flex items-center justify-center"
              style={{ right: "0%", top: "30%", width: "3%", height: "34%" }}
            >
              <span className="text-[8px] text-sky-600 dark:text-sky-400 font-medium uppercase tracking-wider [writing-mode:vertical-rl] rotate-180">
                Beach
              </span>
            </div>

            {/* Open Cottage */}
            <div
              className="absolute rounded-lg bg-lime-100 dark:bg-lime-950/30 border border-lime-400 dark:border-lime-700 flex items-center justify-center"
              style={{ left: `${OPEN_COTTAGE.x}%`, top: `${OPEN_COTTAGE.y}%`, width: `${OPEN_COTTAGE.w}%`, height: `${OPEN_COTTAGE.h}%` }}
            >
              <span className="text-[9px] font-medium text-lime-700 dark:text-lime-400 uppercase tracking-wider text-center leading-tight">
                Open<br />Cottage
              </span>
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
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    width: `${pos.w}%`,
                    height: `${pos.h}%`,
                  }}
                  onClick={() => handleUnitClick(unit)}
                />
              );
            })}

            {/* Section labels */}
            <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest"
              style={{ left: "22%", top: "22%" }}>
              Teepee Kubos
            </span>
            <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest"
              style={{ left: "70%", top: "22%" }}>
              Beach Villas
            </span>
            <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest"
              style={{ left: "3%", bottom: "8%" }}>
              Fan Kubos
            </span>
            <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest"
              style={{ left: "58%", bottom: "8%" }}>
              AC Beach Kubos
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

export default BeachMap;
