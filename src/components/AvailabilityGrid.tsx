import { useState, useMemo, useRef, useCallback } from "react";
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
import { Home, Tent, TreePalm, Crown, Fan, PawPrint, Users, Facebook, Instagram, Globe, MapPin, Share2, UtensilsCrossed, TrendingUp, Link2 } from "lucide-react";
import { getPHHolidaysForMonth } from "@/lib/phHolidays";
import { Button } from "@/components/ui/button";
import { useUnits, groupUnitsByArea } from "@/hooks/useUnits";
import { useBookings, type Booking } from "@/hooks/useBookings";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  const todayRef = useRef<HTMLTableCellElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToToday = useCallback(() => {
    setTimeout(() => {
      todayRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, 50);
  }, []);

  const groupedUnits = useMemo(() => groupUnitsByArea(units), [units]);

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
      for (const day of days) {
        if (isWithinInterval(day, { start: checkIn, end: checkOut }) && !isSameDay(day, checkOut)) {
          const key = `${booking.unit_id}-${format(day, "yyyy-MM-dd")}`;
          map.set(key, booking);
        }
      }
    }
    return map;
  }, [bookings, days]);

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
    const end = checkOut > monthEnd ? monthEnd : checkOut;
    return differenceInDays(end, day);
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
            onClick={() => { setCurrentMonth(new Date()); scrollToToday(); }}
            className="text-xs border-border text-muted-foreground hover:text-foreground"
          >
            Today
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs font-sans">
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
              <th className="sticky left-0 z-30 bg-background border-b border-r border-border px-3 py-2 text-left text-muted-foreground font-medium min-w-[160px] w-[160px]">
              </th>
              {days.map((day) => {
                const weekend = isWeekend(day);
                const markup = isMarkupDay(day);
                return (
                  <th
                    key={day.toISOString()}
                    className={cn(
                      "border-b border-r border-border px-0 py-1.5 text-center min-w-[36px] w-[36px] font-medium",
                      weekend && "bg-muted/30",
                      isToday(day) ? "bg-primary/20 text-primary" : "text-muted-foreground"
                    )}
                    ref={isToday(day) ? todayRef : undefined}
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
                  <tr key={unit.id} className={cn("hover:bg-muted/20 transition-colors h-[30px]", isUnavailable && "opacity-50")}>
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
                                  className="cursor-pointer relative py-[4px] border-b border-r border-border"
                                  onClick={() => onBookingClick?.(booking)}
                                >
                                  <div className={cn("rounded-full overflow-hidden", getBookingColor(booking))}>
                                    <BookingCell booking={booking} />
                                  </div>
                                </td>
                              </TooltipTrigger>
                              <BookingTooltip booking={booking} />
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
                                className="cursor-pointer relative py-[4px] border-b border-r border-border"
                                onClick={() => onBookingClick?.(booking)}
                              >
                                <div className={cn("rounded-full overflow-hidden", getBookingColor(booking))}>
                                  <BookingCell booking={booking} />
                                </div>
                              </td>
                            </TooltipTrigger>
                            <BookingTooltip booking={booking} />
                          </Tooltip>
                        );
                      }

                      // Empty / available cell
                      return (
                        <td
                          key={key}
                          className={cn(
                            "border-b border-r border-border cursor-pointer hover:bg-primary/10 transition-colors",
                            isToday(day) && "bg-primary/5",
                            isWeekend(day) && "bg-muted/15"
                          )}
                          onClick={() => onCellClick?.(unit.id, day)}
                        />
                      );
                    })}
                  </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 px-4 sm:px-6 py-2 sm:py-3 border-t border-border text-[10px] font-sans text-muted-foreground shrink-0">
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
      </div>
    </div>
  );
}

function BookingCell({ booking }: { booking: Booking }) {
  const isGrouped = !!(booking as any).booking_group_id;
  return (
    <div className="px-2 flex items-center gap-1 truncate h-[22px]">
      <span className={cn("h-2 w-2 rounded-full shrink-0", getPaymentDotColor(booking.payment_status))} />
      {isGrouped && <Link2 className="h-2 w-2 text-background/70 shrink-0" />}
      <span className="text-[9px] text-background font-medium truncate leading-none">{booking.guest_name}</span>
      <span className="text-[9px] text-background/60 shrink-0 leading-none">{booking.pax}</span>
      {booking.pets && <PawPrint className="h-2 w-2 text-background/60 shrink-0" />}
      {booking.utensil_rental && <UtensilsCrossed className="h-2 w-2 text-background/60 shrink-0" />}
    </div>
  );
}

function BookingTooltip({ booking }: { booking: Booking }) {
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