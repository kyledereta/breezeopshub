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

// ── Pool Area positions ──
const POOL_UNITS: Record<string, { x: number; y: number; w: number; h: number }> = {
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
const POOL_KITCHEN = { x: 44, y: 5, w: 12, h: 18 };

// ── Beach Area positions ──
const BEACH_UNITS: Record<string, { x: number; y: number; w: number; h: number }> = {
  "Teepee Kubo 1": { x: 3, y: 4, w: 8, h: 16 },
  "Teepee Kubo 2": { x: 12, y: 4, w: 8, h: 16 },
  "Teepee Kubo 3": { x: 21, y: 4, w: 8, h: 16 },
  "Teepee Kubo 4": { x: 30, y: 4, w: 8, h: 16 },
  "Beach Villa 1": { x: 40, y: 4, w: 7, h: 16 },
  "Beach Villa 2": { x: 48, y: 4, w: 7, h: 16 },
  "Beach Villa 3": { x: 56, y: 4, w: 7, h: 16 },
  "Beach Villa 4": { x: 64, y: 4, w: 7, h: 16 },
  "Beach Villa 5": { x: 72, y: 4, w: 7, h: 16 },
  "Beach Villa 6": { x: 80, y: 4, w: 7, h: 16 },
  "Fan Kubo 1": { x: 3, y: 72, w: 9, h: 16 },
  "Fan Kubo 2": { x: 13, y: 72, w: 9, h: 16 },
  "Fan Kubo 3": { x: 23, y: 72, w: 9, h: 16 },
  "Fan Kubo 4": { x: 33, y: 72, w: 9, h: 16 },
  "Big Kubo": { x: 44, y: 72, w: 12, h: 16 },
  "AC Beach Kubo 1": { x: 58, y: 72, w: 10, h: 16 },
  "AC Beach Kubo 2": { x: 69, y: 72, w: 10, h: 16 },
};
const WALKWAY = { x: 3, y: 38, w: 94, h: 18 };
const OPEN_COTTAGE = { x: 89, y: 4, w: 9, h: 16 };

function poolShortName(name: string) {
  return name.replace("Pool Villa ", "PV").replace("AC Pool Kubo ", "APK");
}
function beachShortName(name: string) {
  return name
    .replace("Teepee Kubo ", "TK")
    .replace("Beach Villa ", "BV")
    .replace("Fan Kubo ", "FK")
    .replace("AC Beach Kubo ", "ABK")
    .replace("Big Kubo", "BK");
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

  const poolMapped = units.filter((u) => POOL_UNITS[u.name]);
  const beachMapped = units.filter((u) => BEACH_UNITS[u.name]);

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

  const renderUnits = (
    mapped: Unit[],
    positions: Record<string, { x: number; y: number; w: number; h: number }>,
    shortNameFn: (n: string) => string
  ) =>
    mapped.map((unit) => {
      const pos = positions[unit.name];
      const info = unitStatusMap[unit.id] || { status: "available" as const };
      return (
        <MapUnitBlock
          key={unit.id}
          name={unit.name}
          shortName={shortNameFn(unit.name)}
          guestName={info.guestName}
          status={info.status}
          style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.w}%`, height: `${pos.h}%` }}
          onClick={() => handleUnitClick(unit)}
        />
      );
    });

  return (
    <AppLayout onNewBooking={() => setModalOpen(true)}>
      <div className="h-[calc(100vh-3rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-sm flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-semibold">Resort Map</h1>
            <p className="text-xs text-muted-foreground">Top View · {format(new Date(), "MMMM d, yyyy")}</p>
          </div>
          <MapLegend />
        </div>

        <div className="flex-1 p-4 overflow-auto space-y-6">
          {/* ── Pool Area ── */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Pool Area</h2>
            <div className="relative w-full max-w-4xl mx-auto" style={{ aspectRatio: "16/10" }}>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-emerald-950/20 dark:to-sky-950/20 border border-border shadow-sm" />

              {/* Swimming Pool */}
              <div
                className="absolute rounded-lg bg-sky-400/40 border-2 border-sky-400/60 flex items-center justify-center backdrop-blur-sm"
                style={{ left: `${POOL.x}%`, top: `${POOL.y}%`, width: `${POOL.w}%`, height: `${POOL.h}%` }}
              >
                <div className="text-sky-700 dark:text-sky-300 text-sm font-medium tracking-widest uppercase opacity-60">Swimming Pool</div>
              </div>

              {/* Kitchen */}
              <div
                className="absolute rounded-lg bg-orange-100 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-700 flex items-center justify-center"
                style={{ left: `${POOL_KITCHEN.x}%`, top: `${POOL_KITCHEN.y}%`, width: `${POOL_KITCHEN.w}%`, height: `${POOL_KITCHEN.h}%` }}
              >
                <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">Kitchen</span>
              </div>

              {renderUnits(poolMapped, POOL_UNITS, poolShortName)}

              <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest" style={{ left: "3%", top: "1%" }}>Pool Villas (Left Wing)</span>
              <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest" style={{ right: "3%", top: "1%", textAlign: "right" }}>Pool Villas (Right Wing)</span>
              <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest" style={{ right: "3%", bottom: "12%", textAlign: "right" }}>AC Pool Kubos</span>
            </div>
          </div>

          {/* ── Beach Area ── */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Beach Area</h2>
            <div className="relative w-full max-w-5xl mx-auto" style={{ aspectRatio: "16/10" }}>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-50 to-sky-50 dark:from-amber-950/20 dark:to-sky-950/20 border border-border shadow-sm" />

              {/* Open Cottage */}
              <div
                className="absolute rounded-lg bg-lime-100 dark:bg-lime-950/30 border border-lime-400 dark:border-lime-700 flex items-center justify-center"
                style={{ left: `${OPEN_COTTAGE.x}%`, top: `${OPEN_COTTAGE.y}%`, width: `${OPEN_COTTAGE.w}%`, height: `${OPEN_COTTAGE.h}%` }}
              >
                <span className="text-[8px] font-medium text-lime-700 dark:text-lime-400 uppercase tracking-wider text-center leading-tight">Open<br />Cottage</span>
              </div>

              {/* Walkway */}
              <div
                className="absolute rounded-lg bg-stone-200/60 dark:bg-stone-700/30 border border-dashed border-stone-400 dark:border-stone-600 flex items-center justify-center"
                style={{ left: `${WALKWAY.x}%`, top: `${WALKWAY.y}%`, width: `${WALKWAY.w}%`, height: `${WALKWAY.h}%` }}
              >
                <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                  <span className="text-xs font-medium tracking-widest uppercase opacity-60">Walkway to Beachfront</span>
                  <span className="text-lg opacity-40">→</span>
                </div>
              </div>

              {/* Beachfront */}
              <div
                className="absolute rounded-r-xl bg-sky-300/30 dark:bg-sky-700/20 border-l-2 border-sky-400/50 flex items-center justify-center"
                style={{ right: "0%", top: "30%", width: "3%", height: "34%" }}
              >
                <span className="text-[8px] text-sky-600 dark:text-sky-400 font-medium uppercase tracking-wider [writing-mode:vertical-rl] rotate-180">Beach</span>
              </div>

              {renderUnits(beachMapped, BEACH_UNITS, beachShortName)}

              <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest" style={{ left: "10%", top: "22%" }}>Teepee Kubos</span>
              <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest" style={{ left: "60%", top: "22%" }}>Beach Villas</span>
              <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest" style={{ left: "3%", bottom: "8%" }}>Fan Kubos</span>
              <span className="absolute text-[9px] text-muted-foreground font-medium uppercase tracking-widest" style={{ left: "58%", bottom: "8%" }}>AC Beach Kubos</span>
            </div>
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
