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
import { Home, Tent, TreePalm, Crown, Fan, PawPrint, Users, Facebook, Instagram, Globe, MapPin, Share2, UtensilsCrossed, TrendingUp } from "lucide-react";
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
function getSourceIcon(source: string) {
  switch (source) {
    case "Facebook Direct": return Facebook;
    case "Instagram": return Instagram;
    case "Airbnb": return Globe;
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
}

export function AvailabilityGrid({ onCellClick, onBookingClick }: AvailabilityGridProps) {
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
    return days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      let occupied = 0;
      for (const unit of units) {
        if (bookingMap.has(`${unit.id}-${dateStr}`)) occupied++;
      }
      return { date: day, occupied, available: units.length - occupied };
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
                    colSpan={days.length + 1}
                    className="bg-secondary/50 px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-primary font-semibold border-b border-border"
                  >
                    {area}
                  </td>
                </tr>

                {/* Unit rows */}
                {areaUnits.map((unit) => (
                  <tr key={unit.id} className="hover:bg-muted/20 transition-colors">
                    <td className="sticky left-0 z-10 bg-card/80 backdrop-blur border-b border-r border-border px-3 py-2 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
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
                                  className={cn(
                                    "cursor-pointer relative overflow-hidden rounded-full",
                                    getBookingColor(booking)
                                  )}
                                  onClick={() => onBookingClick?.(booking)}
                                >
                                  <BookingCell booking={booking} />
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
                                className={cn(
                                  "cursor-pointer relative overflow-hidden rounded-full",
                                  getBookingColor(booking)
                                )}
                                onClick={() => onBookingClick?.(booking)}
                              >
                                <BookingCell booking={booking} />
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
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 px-4 sm:px-6 py-2 sm:py-3 border-t border-border text-[10px] font-sans text-muted-foreground shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-3 rounded-full bg-foreground" /> Booked
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
  const SourceIcon = getSourceIcon(booking.booking_source);
  return (
    <div className="px-1.5 py-1.5 min-h-[32px] flex items-center gap-1.5 truncate">
      <SourceIcon className="h-3 w-3 shrink-0 text-background/80" />
      <span className="text-[10px] text-background font-medium truncate">{booking.guest_name}</span>
      <span className="text-[10px] text-background/70">{booking.pax}</span>
      {booking.pets && <PawPrint className="h-2.5 w-2.5 text-background/70 shrink-0" />}
      {booking.utensil_rental && <UtensilsCrossed className="h-2.5 w-2.5 text-background/70 shrink-0" />}
      {booking.key_deposit && <span className="text-[8px] text-background/70">🔑</span>}
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
            const SourceIcon = getSourceIcon(booking.booking_source);
            return <SourceIcon className={cn("h-3.5 w-3.5 shrink-0", getSourceColor(booking.booking_source))} />;
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