import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { DaySummaryDialog } from "@/components/DaySummaryDialog";

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  isToday,
  isSameDay,
  isWithinInterval,
  parseISO,
  differenceInDays,
  isWeekend,
  getDay,
} from "date-fns";
import { Home, Tent, TreePalm, Crown, Fan, PawPrint, Users, Facebook, Instagram, Globe, MapPin, Share2, UtensilsCrossed, TrendingUp, Link2, Ban, ChevronDown, ChevronUp, RefreshCw, ArrowRightLeft, Download } from "lucide-react";
import { exportAvailabilityGrid } from "@/lib/gridExport";
import { useContinuedStayMap, type ContinuedStayInfo } from "@/hooks/useContinuedStay";
import { getPHHolidaysForMonth } from "@/lib/phHolidays";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useUnits, groupUnitsByArea } from "@/hooks/useUnits";
import { useBookings, type Booking } from "@/hooks/useBookings";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { useBlockedDates, useBlockDate, useUnblockDate } from "@/hooks/useBlockedDates";
import { useUpdateBooking } from "@/hooks/useBookingMutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Payment status → cell color mapping
function getBookingColor(_booking: Booking): string {
  return "bg-foreground";
}

function getPaymentDotColor(status: string): string {
  switch (status) {
    case "Fully Paid": return "bg-[hsl(142,71%,45%)]";
    case "Airbnb Paid": return "bg-airbnb-pink";
    case "Partial DP": return "bg-[hsl(48,96%,53%)]";
    case "Unpaid": return "bg-[hsl(0,100%,50%)]";
    case "Refunded": return "bg-muted-foreground";
    default: return "bg-muted-foreground";
  }
}

function getBookingRing(booking: Booking): string {
  switch (booking.payment_status) {
    case "Fully Paid":
      return "ring-1 ring-primary";
    case "Airbnb Paid":
      return "ring-1 ring-airbnb-pink";
    case "Partial DP":
      return "ring-1 ring-warning-orange";
    case "Unpaid":
      return "ring-1 ring-destructive";
    case "Refunded":
      return "ring-1 ring-muted-foreground";
    default:
      return "";
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "Fully Paid":
      return "text-primary";
    case "Airbnb Paid":
      return "text-airbnb-pink";
    case "Partial DP":
      return "text-warning-orange";
    case "Unpaid":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}
// Get icon for unit based on name/type
function getUnitIcon(name: string) {
  if (name.includes("Villa") && name.includes("Owner")) return Crown;
  if (name.includes("Villa")) return Home;
  if (name.includes("Teepee")) return Tent;
  if (name.includes("Kubo")) return TreePalm;
  return Home;
}

// Booking source → icon mapping
// Airbnb SVG icon component
function AirbnbIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 276" fill="currentColor" className={className}>
      <path d="M238.6 196.4c-1.5-3.1-3.1-6.2-4.6-9.2-5.4-10.8-11.5-22.3-17.7-34.6-18.5-36.2-39.2-77.7-42.3-83.1-4.6-8.5-10-16.2-17.7-22.3-8.5-6.9-18.5-10-29.2-10s-20.8 3.1-29.2 10c-7.7 6.2-13.1 13.8-17.7 22.3-3.1 5.4-23.8 46.9-42.3 83.1-6.2 12.3-12.3 23.8-17.7 34.6-1.5 3.1-3.1 6.2-4.6 9.2-3.1 6.9-4.6 13.1-4.6 19.2 0 13.8 6.9 26.9 18.5 35.4 9.2 6.9 20 10 32.3 10 4.6 0 9.2-.8 13.8-1.5 10.8-2.3 20.8-7.7 32.3-16.2 13.8-10.8 28.5-26.9 46.2-50.8 17.7 23.8 32.3 40 46.2 50.8 11.5 8.5 21.5 13.8 32.3 16.2 4.6.8 9.2 1.5 13.8 1.5 12.3 0 23.8-3.8 32.3-10 11.5-8.5 18.5-21.5 18.5-35.4.8-6.2-.8-12.3-4.6-19.2zM128 207.7c-13.1-17.7-23.1-33.1-29.2-45.4-3.1-5.4-5.4-10.8-6.9-15.4-1.5-3.8-2.3-7.7-2.3-10.8 0-10 4.6-19.2 12.3-25.4 6.2-5.4 14.6-8.5 23.1-8.5h6.2c8.5.8 16.2 3.8 23.1 8.5 7.7 6.2 12.3 15.4 12.3 25.4 0 3.1-.8 6.9-2.3 10.8-1.5 4.6-3.8 10-6.9 15.4-6.2 12.3-16.2 27.7-29.2 45.4zm93.8 40c-7.7 5.4-16.9 8.5-26.9 8.5-3.8 0-7.7-.8-11.5-1.5-8.5-2.3-17.7-6.9-27.7-14.6-12.3-9.2-26.2-24.6-43.8-48.5 16.2-21.5 28.5-38.5 36.2-51.5 3.8-6.9 6.9-13.1 8.5-18.5 2.3-5.4 3.1-10.8 3.1-16.2 0-13.8-6.2-26.2-16.9-34.6-9.2-7.7-20-11.5-31.5-12.3h-6.9c-11.5.8-22.3 4.6-31.5 12.3-10.8 8.5-16.9 20.8-16.9 34.6 0 5.4.8 10.8 3.1 16.2 1.5 5.4 4.6 11.5 8.5 18.5 7.7 13.1 20 30 36.2 51.5-17.7 23.8-31.5 39.2-43.8 48.5-10 7.7-19.2 12.3-27.7 14.6-3.8.8-7.7 1.5-11.5 1.5-10 0-19.2-3.1-26.9-8.5-8.5-6.2-13.1-15.4-13.1-25.4 0-4.6 1.5-9.2 3.8-14.6 1.5-3.1 3.1-6.2 4.6-9.2 5.4-10.8 11.5-22.3 17.7-34.6 18.5-36.2 39.2-77.7 42.3-83.1 3.8-7.7 8.5-14.6 15.4-20 6.9-5.4 14.6-7.7 23.1-7.7s16.2 2.3 23.1 7.7c6.9 5.4 11.5 12.3 15.4 20 3.1 5.4 23.8 46.9 42.3 83.1 6.2 12.3 12.3 23.8 17.7 34.6 1.5 3.1 3.1 6.2 4.6 9.2 2.3 5.4 3.8 10 3.8 14.6 0 10-4.6 19.2-13.1 25.4z"/>
    </svg>
  );
}

function getSourceIcon(source: string) {
  switch (source) {
    case "Facebook Direct": return Facebook;
    case "Instagram": return Instagram;
    case "Airbnb": return null; // handled separately
    case "Walk-in": return MapPin;
    case "Referral": return Share2;
    case "TikTok": return Globe;
    default: return Globe;
  }
}

function getSourceColor(source: string) {
  switch (source) {
    case "Facebook Direct": return "text-ocean";
    case "Instagram": return "text-airbnb-pink";
    case "Airbnb": return "text-airbnb-pink";
    case "Walk-in": return "text-coral";
    case "Referral": return "text-primary";
    default: return "text-muted-foreground";
  }
}

interface AvailabilityGridProps {
  onCellClick?: (unitId: string, date: Date) => void;
  onBookingClick?: (booking: Booking) => void;
  onUnitClick?: (unit: import("@/hooks/useUnits").Unit) => void;
}

export function AvailabilityGrid({ onCellClick, onBookingClick, onUnitClick }: AvailabilityGridProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");

  const { data: units = [], isLoading: unitsLoading } = useUnits();
  const { data: bookings = [], isLoading: bookingsLoading } = useBookings(startStr, endStr);
  useRealtimeBookings();
  const continuedStayMap = useContinuedStayMap(bookings);
  const unitNameMap = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);
  const { data: blockedDates = [] } = useBlockedDates(startStr, endStr);
  const blockDate = useBlockDate();
  const unblockDate = useUnblockDate();
  const updateBooking = useUpdateBooking();
  const todayRef = useRef<HTMLTableCellElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [blockPopover, setBlockPopover] = useState<{ unitId: string; date: Date } | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [legendOpen, setLegendOpen] = useState(true);
  const [summaryDate, setSummaryDate] = useState<Date | null>(null);

  // Booking relocation drag state
  const [relocDrag, setRelocDrag] = useState<{
    booking: Booking;
    fromUnitId: string;
    toUnitId: string | null;
  } | null>(null);
  const [relocConfirm, setRelocConfirm] = useState<{
    booking: Booking;
    fromUnitName: string;
    toUnitId: string;
    toUnitName: string;
  } | null>(null);

  // Drag-to-select state for blocking
  const [dragState, setDragState] = useState<{
    unitId: string;
    startDate: string;
    endDate: string;
    active: boolean;
  } | null>(null);
  const [showBlockRangePopover, setShowBlockRangePopover] = useState(false);
  const [blockRangeReason, setBlockRangeReason] = useState("");

  const scrollToToday = useCallback(() => {
    setTimeout(() => {
      todayRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, 50);
  }, []);

  useEffect(() => {
    const now = new Date();
    if (
      currentMonth.getMonth() === now.getMonth() &&
      currentMonth.getFullYear() === now.getFullYear()
    ) {
      scrollToToday();
    }
  }, [currentMonth, scrollToToday]);

  const groupedUnits = useMemo(() => groupUnitsByArea(units), [units]);

  // Resort capacity summary for legend
  const resortSummary = useMemo(() => {
    const areas: { area: string; count: number; pax: number }[] = [];
    let totalUnits = 0;
    let totalPax = 0;
    for (const group of groupedUnits) {
      const count = group.units.length;
      const pax = group.units.reduce((sum, u) => sum + u.max_pax, 0);
      areas.push({ area: group.area, count, pax });
      totalUnits += count;
      totalPax += pax;
    }
    return { areas, totalUnits, totalPax };
  }, [groupedUnits]);

  // PH Holidays for current month
  const holidayMap = useMemo(
    () => getPHHolidaysForMonth(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  );

  // Helper: is this a peak/markup day (weekend or holiday)
  const isMarkupDay = useCallback(
    (day: Date) => {
      const dayOfWeek = getDay(day);
      // Friday, Saturday, Sunday or holiday
      return dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0 || holidayMap.has(format(day, "yyyy-MM-dd"));
    },
    [holidayMap]
  );

  // Build lookup: unitId+dateStr → booking
  const bookingMap = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const booking of bookings) {
      const checkIn = parseISO(booking.check_in);
      const checkOut = parseISO(booking.check_out);
      const isDaytour = !!(booking as any).is_daytour_booking;
      for (const day of days) {
        if (isDaytour ? isSameDay(day, checkIn) : (isWithinInterval(day, { start: checkIn, end: checkOut }) && !isSameDay(day, checkOut))) {
          const key = `${booking.unit_id}-${format(day, "yyyy-MM-dd")}`;
          map.set(key, booking);
        }
      }
    }
    return map;
  }, [bookings, days]);

  // Blocked dates lookup: "unitId-dateStr" → reason
  const blockedMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const bd of blockedDates) {
      map.set(`${bd.unit_id}-${bd.blocked_date}`, bd.reason || "Blocked");
    }
    return map;
  }, [blockedDates]);


  const flatUnitOrder = useMemo(() => {
    const result: string[] = [];
    for (const { units: areaUnits } of groupedUnits) {
      for (const u of areaUnits) result.push(u.id);
    }
    return result;
  }, [groupedUnits]);

  // Check if this unit's booking connects to the NEXT unit row (same group_id)
  const hasGroupConnectorBelow = useCallback((unitId: string, dateStr: string) => {
    const booking = bookingMap.get(`${unitId}-${dateStr}`);
    if (!booking) return false;
    const gid = (booking as any).booking_group_id;
    if (!gid) return false;
    const unitIndex = flatUnitOrder.indexOf(unitId);
    if (unitIndex < 0 || unitIndex >= flatUnitOrder.length - 1) return false;
    const nextUnitId = flatUnitOrder[unitIndex + 1];
    const nextBooking = bookingMap.get(`${nextUnitId}-${dateStr}`);
    if (!nextBooking) return false;
    return (nextBooking as any).booking_group_id === gid;
  }, [bookingMap, flatUnitOrder]);

  // Check if this unit's booking connects to the PREVIOUS unit row (same group_id)
  const hasGroupConnectorAbove = useCallback((unitId: string, dateStr: string) => {
    const booking = bookingMap.get(`${unitId}-${dateStr}`);
    if (!booking) return false;
    const gid = (booking as any).booking_group_id;
    if (!gid) return false;
    const unitIndex = flatUnitOrder.indexOf(unitId);
    if (unitIndex <= 0) return false;
    const prevUnitId = flatUnitOrder[unitIndex - 1];
    const prevBooking = bookingMap.get(`${prevUnitId}-${dateStr}`);
    if (!prevBooking) return false;
    return (prevBooking as any).booking_group_id === gid;
  }, [bookingMap, flatUnitOrder]);

  // Compute daily occupancy
  const dailyOccupancy = useMemo(() => {
    const availableUnits = units.filter((u) => (u.unit_status || "Available") === "Available");
    return days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      let occupied = 0;
      for (const unit of availableUnits) {
        if (bookingMap.has(`${unit.id}-${dateStr}`)) occupied++;
      }
      return { date: day, occupied, available: availableUnits.length - occupied };
    });
  }, [days, units, bookingMap]);

  const isLoading = unitsLoading || bookingsLoading;

  // Check if booking starts on this day for this unit
  const isBookingStart = (booking: Booking, day: Date) => {
    return isSameDay(parseISO(booking.check_in), day);
  };

  // Get booking span (number of days visible in current month)
  const getBookingSpan = (booking: Booking, day: Date) => {
    const checkOut = parseISO(booking.check_out);
    const isDaytour = !!(booking as any).is_daytour_booking;
    if (isDaytour) return 1;
    const end = checkOut > monthEnd ? monthEnd : checkOut;
    return differenceInDays(end, day);
  };

  // Drag-to-select helpers
  const isInDragRange = (unitId: string, dateStr: string) => {
    if (!dragState || dragState.unitId !== unitId) return false;
    const start = dragState.startDate <= dragState.endDate ? dragState.startDate : dragState.endDate;
    const end = dragState.startDate <= dragState.endDate ? dragState.endDate : dragState.startDate;
    return dateStr >= start && dateStr <= end;
  };

  const handleDragStart = (unitId: string, dateStr: string) => {
    setDragState({ unitId, startDate: dateStr, endDate: dateStr, active: true });
  };

  const handleDragEnter = (unitId: string, dateStr: string) => {
    if (dragState?.active && dragState.unitId === unitId) {
      setDragState((prev) => prev ? { ...prev, endDate: dateStr } : null);
    }
  };

  const handleDragEnd = () => {
    if (dragState?.active) {
      // If it's a single-cell click (no actual drag), let onClick handle it
      if (dragState.startDate === dragState.endDate) {
        setDragState(null);
        return;
      }
      setDragState((prev) => prev ? { ...prev, active: false } : null);
      setShowBlockRangePopover(true);
      setBlockRangeReason("");
    }
  };

  const confirmBlockRange = () => {
    if (!dragState) return;
    const start = dragState.startDate <= dragState.endDate ? dragState.startDate : dragState.endDate;
    const end = dragState.startDate <= dragState.endDate ? dragState.endDate : dragState.startDate;
    const dates = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
    let completed = 0;
    for (const d of dates) {
      const ds = format(d, "yyyy-MM-dd");
      blockDate.mutate(
        { unit_id: dragState.unitId, blocked_date: ds, reason: blockRangeReason || undefined },
        {
          onSuccess: () => {
            completed++;
            if (completed === dates.length) toast.success(`${dates.length} day(s) blocked`);
          },
        }
      );
    }
    setShowBlockRangePopover(false);
    setDragState(null);
  };

  const cancelBlockRange = () => {
    setShowBlockRangePopover(false);
    setDragState(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground font-sans text-sm">Loading availability...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0 gap-2">
        <select
          value={currentMonth.getMonth().toString()}
          onChange={(e) => {
            setCurrentMonth(new Date(currentMonth.getFullYear(), parseInt(e.target.value), 1));
          }}
          className="bg-transparent text-xl sm:text-3xl font-bold text-foreground focus:outline-none cursor-pointer appearance-none pr-2"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i}>
              {format(new Date(2024, i, 1), "MMMM")}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 sm:gap-3">
          <select
            value={currentMonth.getFullYear().toString()}
            onChange={(e) => {
              setCurrentMonth(new Date(parseInt(e.target.value), currentMonth.getMonth(), 1));
            }}
            className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Array.from({ length: 5 }, (_, i) => {
              const year = new Date().getFullYear() - 1 + i;
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { exportAvailabilityGrid(units, bookings, currentMonth); }}
            className="text-xs border-border text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setCurrentMonth(new Date()); scrollToToday(); }}
            className="text-xs border-border text-muted-foreground hover:text-foreground"
          >
            Today
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div
        className="flex-1 overflow-auto"
        onMouseUp={handleDragEnd}
        onMouseLeave={() => { if (dragState?.active) handleDragEnd(); }}
      >
        <table className="w-full border-collapse text-xs font-sans select-none">
          <thead className="sticky top-0 z-20">
            {/* Holidays row */}
            <tr className="bg-background">
              <th className="sticky left-0 z-30 bg-background border-b border-r border-border px-3 py-1 text-left text-[9px] text-muted-foreground font-medium min-w-[160px] w-[160px] uppercase tracking-wider">
                Holidays
              </th>
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const holiday = holidayMap.get(dateStr);
                const weekend = isWeekend(day);
                return (
                  <th
                    key={day.toISOString() + "-hol"}
                    className={cn(
                      "border-b border-r border-border px-0 py-1 text-center min-w-[36px] w-[36px]",
                      weekend && "bg-muted/30",
                      isToday(day) && "bg-primary/20"
                    )}
                  >
                    {holiday && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[8px] text-coral font-semibold cursor-default leading-none">
                            🇵🇭
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {holiday.name}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </th>
                );
              })}
            </tr>

            {/* Day numbers row */}
            <tr className="bg-background">
              <th className="sticky left-0 z-30 bg-background border-b border-r border-border px-2 py-1 text-left text-muted-foreground font-medium min-w-[160px] w-[160px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-[8px] leading-tight text-muted-foreground/70 cursor-help">
                      <span className="font-semibold text-foreground/60">{resortSummary.totalUnits} units</span>
                      <span className="mx-0.5">·</span>
                      <span className="font-semibold text-foreground/60">{resortSummary.totalPax} max pax</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" className="text-xs p-3 w-52">
                    <p className="font-semibold text-[11px] mb-1.5">Resort Capacity</p>
                    {resortSummary.areas.map((a) => (
                      <div key={a.area} className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">{a.area}</span>
                        <span className="font-medium">{a.count}u · {a.pax}p</span>
                      </div>
                    ))}
                  </TooltipContent>
                </Tooltip>
              </th>
              {days.map((day) => {
                const weekend = isWeekend(day);
                const markup = isMarkupDay(day);
                return (
                  <th
                    key={day.toISOString()}
                    className={cn(
                      "border-b border-r border-border px-0 py-1.5 text-center min-w-[36px] w-[36px] font-medium cursor-pointer hover:bg-primary/10 transition-colors",
                      weekend && "bg-muted/30",
                      isToday(day) ? "bg-primary/20 text-primary" : "text-muted-foreground"
                    )}
                    ref={isToday(day) ? todayRef : undefined}
                    onClick={() => setSummaryDate(day)}
                  >
                    <div className="text-[10px] leading-none mb-0.5">
                      {format(day, "EEE").charAt(0)}
                    </div>
                    <div className="flex items-center justify-center gap-px">
                      {format(day, "d")}
                      {markup && (
                        <TrendingUp className="h-2 w-2 text-primary/70 shrink-0" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>

            {/* Summary: Occupied */}
            <tr className="bg-card/50">
              <td className="sticky left-0 z-30 bg-card/50 border-b border-r border-border px-3 py-1.5 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">
                Occupied
              </td>
              {dailyOccupancy.map(({ date, occupied }) => (
                <td
                  key={date.toISOString()}
                  className={cn(
                    "border-b border-r border-border text-center py-1",
                    isWeekend(date) && "bg-muted/20",
                    isToday(date) && "bg-primary/10"
                  )}
                >
                  <div className="flex flex-col items-center">
                    <div className="w-5 bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(occupied / units.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-0.5">{occupied}</span>
                  </div>
                </td>
              ))}
            </tr>

            {/* Summary: Available */}
            <tr className="bg-card/50">
              <td className="sticky left-0 z-30 bg-card/50 border-b border-r border-border px-3 py-1.5 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">
                Available
              </td>
              {dailyOccupancy.map(({ date, available }) => (
                <td
                  key={date.toISOString()}
                  className={cn(
                    "border-b border-r border-border text-center py-1",
                    isWeekend(date) && "bg-muted/20",
                    isToday(date) && "bg-primary/10"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      available > 10 ? "text-gold-light" : available > 5 ? "text-primary" : "text-coral"
                    )}
                  >
                    {available}
                  </span>
                </td>
              ))}
            </tr>
          </thead>

          <tbody>
            {groupedUnits.map(({ area, units: areaUnits }) => (
              <>
                {/* Area header */}
                <tr key={area}>
                  <td
                    className="sticky left-0 z-10 bg-secondary border-b border-r border-border px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-primary font-semibold shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                  >
                    {area}
                  </td>
                  {days.map((day) => (
                    <td
                      key={day.toISOString()}
                      className={cn(
                        "bg-secondary/50 border-b border-r border-border",
                        isWeekend(day) && "bg-secondary/70"
                      )}
                    />
                  ))}
                </tr>

                {/* Unit rows */}
                {areaUnits.map((unit) => {
                  const unitStatus = unit.unit_status || "Available";
                  const isUnavailable = unitStatus !== "Available";
                  return (
                  <tr
                    key={unit.id}
                    className={cn(
                      "hover:bg-muted/20 transition-colors h-[30px]",
                      isUnavailable && "opacity-50",
                      relocDrag && relocDrag.fromUnitId !== unit.id && "bg-primary/5"
                    )}
                    onDragOver={(e) => {
                      if (relocDrag && relocDrag.fromUnitId !== unit.id) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (relocDrag && relocDrag.fromUnitId !== unit.id) {
                        setRelocConfirm({
                          booking: relocDrag.booking,
                          fromUnitName: unitNameMap.get(relocDrag.fromUnitId) || "Unknown",
                          toUnitId: unit.id,
                          toUnitName: unit.name,
                        });
                        setRelocDrag(null);
                      }
                    }}
                  >
                    <td
                      className="sticky left-0 z-10 bg-card border-b border-r border-border px-3 py-1 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => onUnitClick?.(unit)}
                    >
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const IconComp = getUnitIcon(unit.name);
                          return <IconComp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
                        })()}
                        <span className="font-medium text-foreground text-xs truncate">
                          {unit.name}
                        </span>
                        {unit.has_ac && (
                          <span className="text-[8px] bg-ocean/20 text-ocean px-1 py-0.5 rounded font-medium">
                            AC
                          </span>
                        )}
                        {!unit.has_ac && (
                          <span className="text-[8px] bg-muted text-muted-foreground px-1 py-0.5 rounded font-medium">
                            Fan
                          </span>
                        )}
                        {isUnavailable && (
                          <span className="text-[8px] bg-destructive/20 text-destructive px-1 py-0.5 rounded font-medium">
                            {unitStatus}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground ml-5">
                        <span>{unit.max_pax} pax</span>
                        <span className="text-border">·</span>
                        <span className="text-primary/80 font-medium">₱{unit.nightly_rate.toLocaleString()}/night</span>
                      </div>
                    </td>
                    {days.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const key = `${unit.id}-${dateStr}`;
                      const booking = bookingMap.get(key);
                      const connectorBelow = booking ? hasGroupConnectorBelow(unit.id, dateStr) : false;
                      const connectorAbove = booking ? hasGroupConnectorAbove(unit.id, dateStr) : false;

                      if (booking) {
                        const isStart = isBookingStart(booking, day);

                        // If this isn't the start of the booking, render an empty cell
                        // (the start cell spans across)
                        if (!isStart) {
                          // Check if previous day was also this booking (if so, skip — covered by colspan)
                          const prevDay = new Date(day);
                          prevDay.setDate(prevDay.getDate() - 1);
                          const prevKey = `${unit.id}-${format(prevDay, "yyyy-MM-dd")}`;
                          const prevBooking = bookingMap.get(prevKey);
                          if (prevBooking && prevBooking.id === booking.id && !isSameDay(day, monthStart)) {
                            return null; // Covered by colspan
                          }

                          // Booking continues from previous month — show partial
                          const span = getBookingSpan(booking, day);
                          return (
                            <Tooltip key={key}>
                              <TooltipTrigger asChild>
                                <td
                                  colSpan={Math.min(span, days.length - days.indexOf(day))}
                                  className={cn(
                                    "cursor-pointer relative py-[4px] border-b border-r border-border",
                                    relocDrag?.booking.id === booking.id && "opacity-50"
                                  )}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = "move";
                                    e.dataTransfer.setData("text/plain", booking.id);
                                    setRelocDrag({ booking, fromUnitId: unit.id, toUnitId: null });
                                  }}
                                  onDragEnd={() => setRelocDrag(null)}
                                  onClick={() => onBookingClick?.(booking)}
                                >
                                  {connectorAbove && (
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-[4px] bg-primary rounded-full" />
                                  )}
                                  <div className={cn("rounded-full overflow-hidden", getBookingColor(booking))}>
                                    <BookingCell booking={booking} continuedStayInfo={continuedStayMap.get(booking.id)} unitNameMap={unitNameMap} />
                                  </div>
                                  {connectorBelow && (
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-[4px] bg-primary rounded-full" />
                                  )}
                                </td>
                              </TooltipTrigger>
                              <BookingTooltip booking={booking} continuedStayInfo={continuedStayMap.get(booking.id)} unitNameMap={unitNameMap} />
                            </Tooltip>
                          );
                        }

                        // Start of booking
                        const span = getBookingSpan(booking, day);
                        return (
                          <Tooltip key={key}>
                            <TooltipTrigger asChild>
                              <td
                                colSpan={Math.min(span, days.length - days.indexOf(day))}
                                className={cn(
                                  "cursor-grab relative py-[4px] border-b border-r border-border",
                                  relocDrag?.booking.id === booking.id && "opacity-50"
                                )}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.effectAllowed = "move";
                                  e.dataTransfer.setData("text/plain", booking.id);
                                  setRelocDrag({ booking, fromUnitId: unit.id, toUnitId: null });
                                }}
                                onDragEnd={() => setRelocDrag(null)}
                                onClick={() => onBookingClick?.(booking)}
                              >
                                {connectorAbove && (
                                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-[4px] bg-primary rounded-full" />
                                )}
                                <div className={cn("rounded-full overflow-hidden", getBookingColor(booking))}>
                                  <BookingCell booking={booking} continuedStayInfo={continuedStayMap.get(booking.id)} unitNameMap={unitNameMap} />
                                </div>
                                {connectorBelow && (
                                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-[4px] bg-primary rounded-full" />
                                )}
                              </td>
                            </TooltipTrigger>
                            <BookingTooltip booking={booking} continuedStayInfo={continuedStayMap.get(booking.id)} unitNameMap={unitNameMap} />
                          </Tooltip>
                        );
                      }

                      // Blocked date cell
                      const blockedReason = blockedMap.get(key);
                      if (blockedReason) {
                        return (
                          <Tooltip key={key}>
                            <TooltipTrigger asChild>
                              <td
                                className={cn(
                                  "border-b border-r border-border cursor-pointer transition-colors",
                                  "bg-destructive/10 hover:bg-destructive/20"
                                )}
                                onClick={() => {
                                  unblockDate.mutate({ unit_id: unit.id, blocked_date: dateStr }, {
                                    onSuccess: () => toast.success("Day unblocked"),
                                  });
                                }}
                              >
                                <div className="flex flex-col items-center justify-center h-full">
                                  <Ban className="h-3 w-3 text-destructive/60" />
                                  {blockedReason && blockedReason !== "Blocked" && (
                                    <span className="text-[6px] text-destructive/50 leading-none mt-0.5 truncate max-w-[32px]">
                                      {blockedReason}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              <p className="font-medium text-destructive">Blocked</p>
                              <p className="text-muted-foreground">{blockedReason}</p>
                              <p className="text-[9px] text-muted-foreground mt-1">Click to unblock</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      // Empty / available cell — supports drag-to-select
                      const inDrag = isInDragRange(unit.id, dateStr);
                      const isBlockPopoverOpen = blockPopover?.unitId === unit.id && isSameDay(blockPopover.date, day);
                      
                      // If we have a completed drag selection and this is the last cell in range, show popover
                      const isDragEnd = dragState && !dragState.active && showBlockRangePopover && dragState.unitId === unit.id;
                      const dragEndDate = dragState ? (dragState.startDate <= dragState.endDate ? dragState.endDate : dragState.startDate) : "";
                      const showDragPopover = isDragEnd && dateStr === dragEndDate;

                      return (
                        <Popover
                          key={key}
                          open={isBlockPopoverOpen || !!showDragPopover}
                          onOpenChange={(open) => {
                            if (!open) {
                              setBlockPopover(null);
                              if (showDragPopover) cancelBlockRange();
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <td
                              className={cn(
                                "border-b border-r border-border cursor-pointer transition-colors",
                                isToday(day) && "bg-primary/5",
                                isWeekend(day) && "bg-muted/15",
                                inDrag ? "bg-destructive/20" : "hover:bg-primary/10"
                              )}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleDragStart(unit.id, dateStr);
                              }}
                              onMouseEnter={() => handleDragEnter(unit.id, dateStr)}
                              onClick={() => {
                                if (!dragState) {
                                  setBlockPopover({ unitId: unit.id, date: day });
                                  setBlockReason("");
                                }
                              }}
                            />
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2 space-y-2" side="bottom" align="start">
                            {showDragPopover ? (
                              // Range block popover
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-foreground">
                                  Block {(() => {
                                    const s = dragState!.startDate <= dragState!.endDate ? dragState!.startDate : dragState!.endDate;
                                    const e = dragState!.startDate <= dragState!.endDate ? dragState!.endDate : dragState!.startDate;
                                    const count = differenceInDays(parseISO(e), parseISO(s)) + 1;
                                    return `${count} day(s)`;
                                  })()}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(parseISO(dragState!.startDate <= dragState!.endDate ? dragState!.startDate : dragState!.endDate), "MMM d")} → {format(parseISO(dragState!.startDate <= dragState!.endDate ? dragState!.endDate : dragState!.startDate), "MMM d")}
                                </p>
                                <Input
                                  placeholder="Reason (optional)"
                                  value={blockRangeReason}
                                  onChange={(e) => setBlockRangeReason(e.target.value)}
                                  className="h-7 text-xs"
                                  autoFocus
                                />
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="flex-1 text-xs"
                                    onClick={confirmBlockRange}
                                  >
                                    <Ban className="h-3 w-3 mr-1" /> Block
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs"
                                    onClick={cancelBlockRange}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              // Single cell popover
                              <>
                                <Button
                                  size="sm"
                                  className="w-full text-xs"
                                  onClick={() => {
                                    setBlockPopover(null);
                                    onCellClick?.(unit.id, day);
                                  }}
                                >
                                  New Booking
                                </Button>
                                <div className="space-y-1.5">
                                  <Input
                                    placeholder="Reason (optional)"
                                    value={blockReason}
                                    onChange={(e) => setBlockReason(e.target.value)}
                                    className="h-7 text-xs"
                                  />
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="w-full text-xs"
                                    onClick={() => {
                                      blockDate.mutate(
                                        { unit_id: unit.id, blocked_date: dateStr, reason: blockReason || undefined },
                                        { onSuccess: () => toast.success("Day blocked") }
                                      );
                                      setBlockPopover(null);
                                    }}
                                  >
                                    <Ban className="h-3 w-3 mr-1" /> Block Day
                                  </Button>
                                </div>
                              </>
                            )}
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                  </tr>
                  );
                })}
              </>
            ))}

            {/* Daytour Guests Section */}
            {(() => {
              const daytourBookings = bookings.filter(
                (b) =>
                  (b as any).is_daytour_booking &&
                  b.booking_status !== "Cancelled"
              );
              if (daytourBookings.length === 0) return null;
              return (
                <>
                  <tr>
                    <td
                      className="sticky left-0 z-10 bg-secondary border-b border-r border-border px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-ocean font-semibold shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                    >
                      🏖️ Day Tour Guests
                    </td>
                    {days.map((day) => (
                      <td
                        key={day.toISOString() + "-dt-header"}
                        className={cn(
                          "bg-secondary/50 border-b border-r border-border",
                          isWeekend(day) && "bg-secondary/70"
                        )}
                      />
                    ))}
                  </tr>
                  {daytourBookings.map((booking) => {
                    const checkIn = parseISO(booking.check_in);
                    return (
                      <tr key={booking.id + "-dt"} className="hover:bg-muted/20 transition-colors h-[30px]">
                        <td className="sticky left-0 z-10 bg-card border-b border-r border-border px-3 py-1 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-ocean shrink-0" />
                            <span className="font-medium text-foreground text-xs truncate">{booking.guest_name}</span>
                            <span className="text-[8px] bg-ocean/20 text-ocean px-1 py-0.5 rounded font-medium">DT</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground ml-5">
                            <span>{booking.pax} pax</span>
                            <span className="text-border">·</span>
                            <span className={getStatusBadge(booking.payment_status)}>{booking.payment_status}</span>
                            <span className="text-border">·</span>
                            <span className="text-primary/80 font-medium">₱{booking.total_amount.toLocaleString()}</span>
                          </div>
                        </td>
                        {days.map((day) => {
                          const dateStr = format(day, "yyyy-MM-dd");
                          const isBookingDay = isSameDay(day, checkIn);
                          return (
                            <td
                              key={dateStr + "-dt-" + booking.id}
                              className={cn(
                                "border-b border-r border-border text-center py-[4px]",
                                isWeekend(day) && "bg-muted/10",
                                isToday(day) && "bg-primary/5"
                              )}
                            >
                              {isBookingDay && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="mx-0.5 rounded-full bg-ocean cursor-pointer"
                                      onClick={() => onBookingClick?.(booking)}
                                    >
                                      <div className="relative px-2 flex items-center gap-1 truncate h-[22px]">
                                        <span className={cn("h-2 w-2 rounded-full shrink-0", getPaymentDotColor(booking.payment_status))} />
                                        <span className="text-[9px] text-white font-medium truncate leading-none">{booking.pax} PAX</span>
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <BookingTooltip booking={booking} continuedStayInfo={continuedStayMap.get(booking.id)} unitNameMap={unitNameMap} />
                                </Tooltip>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* Legend - Collapsible */}
      <div className="border-t border-border shrink-0">
        <button
          onClick={() => setLegendOpen((prev) => !prev)}
          className="flex items-center justify-between w-full px-4 sm:px-6 py-1.5 text-[10px] text-muted-foreground hover:bg-muted/20 transition-colors"
        >
          <span className="font-medium uppercase tracking-wider">Legend</span>
          {legendOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>
        {legendOpen && (
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 px-4 sm:px-6 pb-2 sm:pb-3 text-[10px] font-sans text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[hsl(142,71%,45%)]" /> Fully Paid
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-airbnb-pink" /> Airbnb Paid
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[hsl(48,96%,53%)]" /> Partial DP
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[hsl(0,100%,50%)]" /> Unpaid
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Refunded
            </span>
            <span className="flex items-center gap-1.5 border-l border-border pl-3">
              <TrendingUp className="h-3 w-3 text-primary/70" /> Peak / Markup
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[10px]">🇵🇭</span> Holiday
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-muted/30" /> Weekend
            </span>
            <span className="flex items-center gap-1.5">
              <Ban className="h-3 w-3 text-destructive/60" /> Blocked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-ocean text-[8px] text-white font-bold rounded px-1 leading-tight">DT</span> Day Tour
            </span>
          </div>
        )}
      </div>

      {summaryDate && (
        <DaySummaryDialog
          open={!!summaryDate}
          onOpenChange={(open) => { if (!open) setSummaryDate(null); }}
          date={summaryDate}
          bookings={bookings}
          units={units}
          onBookingClick={(b) => { setSummaryDate(null); onBookingClick?.(b); }}
        />
      )}

      {/* Relocation confirmation dialog */}
      <AlertDialog open={!!relocConfirm} onOpenChange={(open) => { if (!open) setRelocConfirm(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Confirm Unit Relocation
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Move <span className="font-semibold text-foreground">{relocConfirm?.booking.guest_name}</span>'s booking?
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="bg-muted px-2 py-1 rounded text-foreground font-medium">{relocConfirm?.fromUnitName}</span>
                <span className="text-muted-foreground">→</span>
                <span className="bg-primary/20 px-2 py-1 rounded text-primary font-medium">{relocConfirm?.toUnitName}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(relocConfirm?.booking.check_in || "2024-01-01"), "MMM d")} — {format(parseISO(relocConfirm?.booking.check_out || "2024-01-01"), "MMM d, yyyy")} · {relocConfirm?.booking.pax} PAX
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!relocConfirm) return;
                updateBooking.mutate(
                  { id: relocConfirm.booking.id, unit_id: relocConfirm.toUnitId },
                  {
                    onSuccess: () => {
                      toast.success(`Moved ${relocConfirm.booking.guest_name} to ${relocConfirm.toUnitName}`);
                      setRelocConfirm(null);
                    },
                    onError: () => {
                      toast.error("Failed to relocate booking");
                      setRelocConfirm(null);
                    },
                  }
                );
              }}
            >
              Confirm Relocation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BookingCell({ booking, continuedStayInfo, unitNameMap }: { booking: Booking; continuedStayInfo?: ContinuedStayInfo; unitNameMap?: Map<string, string> }) {
  const isGrouped = !!(booking as any).booking_group_id;
  const hasDaytour = (booking as any).daytour_fee > 0 || (booking as any).daytour || (booking as any).is_daytour_booking;
  const isContinuedStay = !!continuedStayInfo;
  return (
    <div className="relative px-2 flex items-center gap-1 truncate h-[22px]">
      <span className={cn("h-2 w-2 rounded-full shrink-0", getPaymentDotColor(booking.payment_status))} />
      {isGrouped && <Link2 className="h-2 w-2 text-background/70 shrink-0" />}
      {isContinuedStay && <RefreshCw className="h-2 w-2 text-background/70 shrink-0" />}
      <span className="text-[9px] text-background font-medium truncate leading-none">{booking.guest_name}</span>
      <span className="text-[9px] text-background/60 shrink-0 leading-none">{booking.pax}</span>
      {booking.pets && <PawPrint className="h-2 w-2 text-background/60 shrink-0" />}
      {booking.utensil_rental && <UtensilsCrossed className="h-2 w-2 text-background/60 shrink-0" />}
      {hasDaytour && (
        <span className="absolute -top-1.5 -right-0.5 bg-ocean text-[6px] text-white font-bold rounded px-0.5 leading-tight">
          DT
        </span>
      )}
      {isContinuedStay && continuedStayInfo?.toUnitId && unitNameMap && (
        <span className="absolute -bottom-2 right-0 bg-ocean/90 text-[5px] text-white font-bold rounded px-0.5 leading-tight whitespace-nowrap">
          → {unitNameMap.get(continuedStayInfo.toUnitId) || ""}
        </span>
      )}
      {isContinuedStay && continuedStayInfo?.fromUnitId && !continuedStayInfo?.toUnitId && unitNameMap && (
        <span className="absolute -bottom-2 right-0 bg-ocean/90 text-[5px] text-white font-bold rounded px-0.5 leading-tight whitespace-nowrap">
          ← {unitNameMap.get(continuedStayInfo.fromUnitId) || ""}
        </span>
      )}
    </div>
  );
}

function BookingTooltip({ booking, continuedStayInfo, unitNameMap }: { booking: Booking; continuedStayInfo?: ContinuedStayInfo; unitNameMap?: Map<string, string> }) {
  const fromName = continuedStayInfo?.fromUnitId && unitNameMap ? unitNameMap.get(continuedStayInfo.fromUnitId) : null;
  const toName = continuedStayInfo?.toUnitId && unitNameMap ? unitNameMap.get(continuedStayInfo.toUnitId) : null;
  return (
    <TooltipContent
      side="bottom"
      className="bg-popover border border-border shadow-xl p-3 max-w-[240px]"
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {(() => {
            if (booking.booking_source === "Airbnb") {
              return <AirbnbIcon className={cn("h-3.5 w-3.5 shrink-0", getSourceColor(booking.booking_source))} />;
            }
            const SourceIcon = getSourceIcon(booking.booking_source);
            return SourceIcon ? <SourceIcon className={cn("h-3.5 w-3.5 shrink-0", getSourceColor(booking.booking_source))} /> : null;
          })()}
          <span className="font-medium text-sm text-foreground">{booking.guest_name}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {format(parseISO(booking.check_in), "MMM d")} → {format(parseISO(booking.check_out), "MMM d, yyyy")}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3 text-muted-foreground" />
            {booking.pax} PAX
          </span>
          {(booking as any).pets && (
            <span className="flex items-center gap-1 text-warning-orange">
              <PawPrint className="h-3 w-3" /> Pet
            </span>
          )}
          <span className={getStatusBadge(booking.payment_status)}>
            {booking.payment_status}
          </span>
        </div>
        <div className="text-xs text-foreground font-medium">
          ₱{booking.total_amount.toLocaleString()}
        </div>
        {booking.deposit_paid > 0 && (
          <div className="text-[10px] text-primary font-medium">
            DP: ₱{booking.deposit_paid.toLocaleString()}
          </div>
        )}
        {continuedStayInfo && (
          <div className="space-y-0.5">
            {fromName && (
              <div className="flex items-center gap-1 text-[9px] text-ocean font-medium">
                <RefreshCw className="h-2.5 w-2.5" /> Continued from {fromName}
              </div>
            )}
            {toName && (
              <div className="flex items-center gap-1 text-[9px] text-ocean font-medium">
                <RefreshCw className="h-2.5 w-2.5" /> Continues to {toName}
              </div>
            )}
            {!fromName && !toName && (
              <div className="flex items-center gap-1 text-[9px] text-ocean font-medium">
                <RefreshCw className="h-2.5 w-2.5" /> Continued Stay
              </div>
            )}
          </div>
        )}
        {(booking as any).booking_group_id && (
          <div className="flex items-center gap-1 text-[9px] text-primary font-medium">
            <Link2 className="h-2.5 w-2.5" /> Combined Booking
          </div>
        )}
        {booking.deposit_paid > 0 && (
          <div className="text-[10px] text-muted-foreground">
            Deposit: ₱{booking.deposit_paid.toLocaleString()}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {(booking as any).utensil_rental && (
            <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">Utensils</span>
          )}
          {(booking as any).deposit_status && (booking as any).deposit_status !== "Pending" && (
            <span className={cn(
              "text-[9px] px-1.5 py-0.5 rounded font-medium",
              (booking as any).deposit_status === "Returned" ? "bg-ocean/20 text-ocean" : "bg-destructive/20 text-destructive"
            )}>
              Deposit {(booking as any).deposit_status}
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground italic">
          via {booking.booking_source}
        </div>
      </div>
    </TooltipContent>
  );
}
