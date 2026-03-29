import { useMemo, useState, useCallback } from "react";
import { getUnpaidExtras, getUnpaidExtrasTotal, hasUnpaidExtras } from "@/lib/unpaidExtras";
import { format, parseISO, addDays, eachDayOfInterval, isWithinInterval, isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useBookings, type Booking } from "@/hooks/useBookings";
import { useUpdateBooking } from "@/hooks/useBookingMutations";
import { useUnits, groupUnitsByArea } from "@/hooks/useUnits";
import { useGuests } from "@/hooks/useGuests";
import {
  LogIn, LogOut, Home, Users, BedDouble, GripVertical, Clock,
  AlertCircle, X, Pencil, Tent, TreePalm, Crown, Fan, Snowflake, CalendarDays,
  DollarSign, AlertTriangle, ArrowRight, Link2, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BookingModal } from "@/components/BookingModal";
import { FormSubmissionsSection } from "@/components/FormSubmissionsSection";

function getPaymentBadgeClass(status: string) {
  switch (status) {
    case "Fully Paid": return "bg-primary/20 text-primary border-primary/30";
    case "Airbnb Paid": return "bg-airbnb-pink/20 text-airbnb-pink border-airbnb-pink/30";
    case "Partial DP": return "bg-warning-orange/20 text-warning-orange border-warning-orange/30";
    case "Unpaid": return "bg-destructive/20 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "Confirmed": return "bg-primary/20 text-primary border-primary/30";
    case "Checked In": return "bg-ocean/20 text-ocean border-ocean/30";
    case "Checked Out": return "bg-coral/20 text-coral border-coral/30";
    case "Inquiry": return "bg-warning-orange/20 text-warning-orange border-warning-orange/30";
    case "Hold": return "bg-muted text-muted-foreground border-border";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

interface GuestCardProps {
  booking: Booking;
  unitName: string;
  draggable?: boolean;
  onEdit?: () => void;
  noLateCheckout?: boolean;
  groupBookingId?: string | null;
  groupUnitNames?: string[];
}

function GuestCard({ booking, unitName, draggable, onEdit, noLateCheckout, groupBookingId, groupUnitNames }: GuestCardProps) {
  const [wasDragged, setWasDragged] = useState(false);
  const isGrouped = !!groupBookingId;
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        setWasDragged(true);
        e.dataTransfer.setData("bookingId", booking.id);
        if (groupBookingId) {
          e.dataTransfer.setData("groupId", groupBookingId);
        }
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => setTimeout(() => setWasDragged(false), 100)}
      onClick={() => {
        if (!wasDragged && onEdit) onEdit();
      }}
      className={cn(
        "flex items-center gap-2 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors p-3 group",
        noLateCheckout && "border-warning-orange/40",
        isGrouped && "border-l-2 border-l-primary",
        draggable ? "cursor-grab active:cursor-grabbing" : onEdit ? "cursor-pointer" : ""
      )}
    >
      {draggable && (
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-foreground truncate">{booking.guest_name}</span>
          {isGrouped && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-primary/10 text-primary border-primary/30">
              <Link2 className="h-2.5 w-2.5 mr-1" />
              Group
            </Badge>
          )}
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", getPaymentBadgeClass(booking.payment_status))}>
            {booking.payment_status}
          </Badge>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", getStatusBadgeClass(booking.booking_status))}>
            {booking.booking_status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1 shrink-0">
            <BedDouble className="h-3 w-3" />
            {groupUnitNames && groupUnitNames.length > 1 ? groupUnitNames.join(" + ") : unitName}
          </span>
          <span className="shrink-0">{booking.pax} PAX</span>
          <span className="shrink-0">₱{booking.total_amount.toLocaleString()}</span>
          <span className="shrink-0">
            {format(parseISO(booking.check_in), "MMM d")} → {format(parseISO(booking.check_out), "MMM d")}
          </span>
        </div>
        {noLateCheckout && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-warning-orange font-medium">
            <Clock className="h-3 w-3" />
            No late check-out — next guest arriving tomorrow
          </div>
        )}
      </div>
      {onEdit && (
        <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </div>
  );
}

type DropZone = "arrivals" | "inhouse" | "departures";

export default function TodayPage() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: allBookings = [], isLoading: bookingsLoading } = useBookings();
  const { data: units = [], isLoading: unitsLoading } = useUnits();
  const { data: guests = [] } = useGuests();
  const updateBooking = useUpdateBooking();
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState<DropZone | null>(null);
  const [manualDepartureIds, setManualDepartureIds] = useState<string[]>([]);
  const [clearedDepartureIds, setClearedDepartureIds] = useState<string[]>([]);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

   const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);

  // Build group unit names map: groupId → [unit names]
  const groupUnitNamesMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const b of allBookings) {
      const gid = (b as any).booking_group_id;
      if (!gid) continue;
      if (!m.has(gid)) m.set(gid, []);
      const name = unitMap.get(b.unit_id ?? "") ?? "Unknown";
      const arr = m.get(gid)!;
      if (!arr.includes(name)) arr.push(name);
    }
    return m;
  }, [allBookings, unitMap]);

  const { checkIns, baseCheckOuts, dueDepartures, inHouse, pendingBalances, todayRevenue, upcomingArrivals, overbookings, noLateCheckoutUnitIds } = useMemo(() => {
    const checkIns: Booking[] = [];
    const baseCheckOuts: Booking[] = [];
    const dueDepartures: Booking[] = [];
    const inHouse: Booking[] = [];
    const pendingBalances: Booking[] = [];
    const upcomingArrivals: Booking[] = [];
    let todayRevenue = 0;

    const today = new Date();
    const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
    const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");
    const day2Str = format(addDays(today, 2), "yyyy-MM-dd");
    const day3Str = format(addDays(today, 3), "yyyy-MM-dd");

    for (const b of allBookings) {
      if (b.booking_status === "Cancelled") continue;
      // For grouped bookings, only show the primary in dashboard sections
      if ((b as any).booking_group_id && (b as any).is_primary === false) continue;
      const ci = b.check_in;
      const co = b.check_out;

      if (ci === todayStr && b.booking_status !== "Checked In" && b.booking_status !== "Checked Out") {
        checkIns.push(b);
      }
      if (co === todayStr && b.booking_status === "Checked Out") {
        baseCheckOuts.push(b);
      }
      // Guests due to depart today but still checked in
      if (co === todayStr && b.booking_status === "Checked In") {
        dueDepartures.push(b);
      }
      if (b.booking_status === "Checked In" && ci <= todayStr && co >= todayStr) {
        inHouse.push(b);
      }
      if (b.payment_status === "Unpaid" || b.payment_status === "Partial DP" || hasUnpaidExtras(b)) {
        pendingBalances.push(b);
      }
      // Today's revenue: bookings checked in today (revenue attributed to check-in month)
      if (ci === todayStr && (b.booking_status === "Checked In" || b.booking_status === "Checked Out" || b.booking_status === "Confirmed")) {
        todayRevenue += b.total_amount;
      }
      // Upcoming arrivals: next 3 days
      if ((ci === tomorrowStr || ci === day2Str || ci === day3Str) && b.booking_status !== "Checked In" && b.booking_status !== "Checked Out") {
        upcomingArrivals.push(b);
      }
    }

    // Detect units that have a booking arriving tomorrow (no late checkout allowed)
    const noLateCheckoutUnitIds = new Set<string>();
    for (const b of allBookings) {
      if (b.booking_status === "Cancelled" || !b.unit_id) continue;
      if (b.check_in === tomorrowStr) {
        noLateCheckoutUnitIds.add(b.unit_id);
      }
    }

    // Overbooking detection: find units with 2+ overlapping active bookings
    const overbookings: { unitId: string; bookings: Booking[] }[] = [];
    const activeBookings = allBookings.filter(b => b.booking_status !== "Cancelled" && b.booking_status !== "Checked Out" && b.unit_id);
    const unitBookingsMap = new Map<string, Booking[]>();
    for (const b of activeBookings) {
      const arr = unitBookingsMap.get(b.unit_id!) || [];
      arr.push(b);
      unitBookingsMap.set(b.unit_id!, arr);
    }
    for (const [unitId, bookings] of unitBookingsMap) {
      if (bookings.length < 2) continue;
      const conflicts: Booking[] = [];
      for (let i = 0; i < bookings.length; i++) {
        for (let j = i + 1; j < bookings.length; j++) {
          const a = bookings[i], bk = bookings[j];
          // Overlap: a.check_in < b.check_out AND b.check_in < a.check_out
          if (a.check_in < bk.check_out && bk.check_in < a.check_out) {
            if (!conflicts.includes(a)) conflicts.push(a);
            if (!conflicts.includes(bk)) conflicts.push(bk);
          }
        }
      }
      if (conflicts.length > 0) overbookings.push({ unitId, bookings: conflicts });
    }

    return { checkIns, baseCheckOuts, dueDepartures, inHouse, pendingBalances, todayRevenue, upcomingArrivals, overbookings, noLateCheckoutUnitIds };
  }, [allBookings, todayStr]);

  const visibleDepartures = useMemo(() => {
    const byId = new Map<string, Booking>();

    // Include already checked-out guests
    for (const booking of baseCheckOuts) {
      if (!clearedDepartureIds.includes(booking.id)) {
        byId.set(booking.id, booking);
      }
    }

    for (const bookingId of manualDepartureIds) {
      const booking = allBookings.find((item) => item.id === bookingId);
      if (booking && !clearedDepartureIds.includes(booking.id)) {
        byId.set(booking.id, booking);
      }
    }

    return Array.from(byId.values());
  }, [allBookings, baseCheckOuts, dueDepartures, manualDepartureIds, clearedDepartureIds]);

  const handleDrop = useCallback(
    (zone: DropZone, e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      const bookingId = e.dataTransfer.getData("bookingId");
      const groupId = e.dataTransfer.getData("groupId");
      if (!bookingId) return;

      let newStatus: string | null = null;
      if (zone === "inhouse") newStatus = "Checked In";
      else if (zone === "departures") newStatus = "Checked Out";
      else if (zone === "arrivals") newStatus = "Confirmed";

      if (!newStatus) return;

      // Collect all booking IDs to update (group or single)
      const idsToUpdate: string[] = [];
      if (groupId) {
        const groupBookings = allBookings.filter((b) => (b as any).booking_group_id === groupId);
        for (const gb of groupBookings) {
          if (gb.booking_status !== newStatus) idsToUpdate.push(gb.id);
        }
      } else {
        const booking = allBookings.find((b) => b.id === bookingId);
        if (!booking || booking.booking_status === newStatus) return;
        idsToUpdate.push(bookingId);
      }

      if (idsToUpdate.length === 0) return;

      const booking = allBookings.find((b) => b.id === bookingId)!;

      if (zone === "departures") {
        for (const id of idsToUpdate) {
          setManualDepartureIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
          setClearedDepartureIds((prev) => prev.filter((cid) => cid !== id));
        }
      } else {
        setManualDepartureIds((prev) => prev.filter((id) => !idsToUpdate.includes(id)));
      }

      // Update all bookings in the group
      for (const id of idsToUpdate) {
        updateBooking.mutate(
          { id, booking_status: newStatus as any },
          {
            onSuccess: id === bookingId
              ? () => toast.success(`${booking.guest_name}${idsToUpdate.length > 1 ? ` (${idsToUpdate.length} units)` : ""} → ${newStatus}`)
              : undefined,
            onError: id === bookingId
              ? (err) => toast.error(`Failed to update: ${err.message}`)
              : undefined,
          }
        );
      }
    },
    [allBookings, updateBooking]
  );

  const handleClearDepartures = useCallback(() => {
    setClearedDepartureIds((prev) => Array.from(new Set([...prev, ...visibleDepartures.map((b) => b.id)])));
    setManualDepartureIds([]);
  }, [visibleDepartures]);

  const handleDragOver = useCallback((zone: DropZone, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(zone);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(null), []);

  const totalPaxInHouse = inHouse.reduce((sum, b) => sum + b.pax, 0);
  const occupancyRate = units.length > 0 ? Math.round((inHouse.length / units.length) * 100) : 0;
  const pendingTotal = pendingBalances.reduce((s, b) => {
    const balance = b.total_amount - b.deposit_paid;
    const unpaidExtrasAmt = getUnpaidExtrasTotal(b);
    // If fully paid but has unpaid extras, show only the extras amount
    if (balance <= 0 && unpaidExtrasAmt > 0) return s + unpaidExtrasAmt;
    return s + Math.max(balance, 0);
  }, 0);
  const isLoading = bookingsLoading || unitsLoading;

  const groupedUnits = useMemo(() => groupUnitsByArea(units), [units]);

  // Compute available units for today and each day this week
  const weekDays = useMemo(() => {
    const today = new Date();
    return eachDayOfInterval({ start: today, end: addDays(today, 6) });
  }, []);

  const unitAvailability = useMemo(() => {
    // For each unit, check which days it's available
    return units.map((unit) => {
      const unitStatus = unit.unit_status || "Available";
      const isUnitUnavailable = unitStatus !== "Available";
      const dayStatus = weekDays.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        if (isUnitUnavailable) {
          return { date: day, dateStr: dayStr, available: false };
        }
        const isOccupied = allBookings.some((b) => {
          if (b.booking_status === "Cancelled") return false;
          if (b.unit_id !== unit.id) return false;
          const ci = parseISO(b.check_in);
          const co = parseISO(b.check_out);
          return isWithinInterval(day, { start: ci, end: co }) && !isSameDay(day, co);
        });
        return { date: day, dateStr: dayStr, available: !isOccupied };
      });
      const availableToday = dayStatus[0]?.available ?? true;
      const availableDaysCount = dayStatus.filter((d) => d.available).length;
      return { unit, dayStatus, availableToday, availableDaysCount };
    });
  }, [units, allBookings, weekDays]);

  const availableTodayCount = unitAvailability.filter((u) => u.availableToday).length;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0 gap-1">
          <div>
            <h1 className="text-xl sm:text-3xl font-display text-foreground tracking-wide">Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Check-in 1 PM · Check-out 11 AM</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <span className="text-muted-foreground text-sm">Loading...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Home} label="Occupancy" value={`${occupancyRate}%`} sub={`${inHouse.length} / ${units.length} units`} />
              <StatCard icon={Users} label="In-House" value={`${totalPaxInHouse} pax`} sub={`${inHouse.length} bookings`} />
              <StatCard
                icon={AlertCircle}
                label="Pending"
                value={`₱${pendingTotal.toLocaleString()}`}
                sub={`${pendingBalances.length} bookings`}
                alert={pendingBalances.length > 0}
                onClick={() => navigate("/balances")}
              />
              <StatCard icon={Users} label="Guests" value={String(checkIns.length + inHouse.length + visibleDepartures.length)} sub="Today's bookings" onClick={() => navigate("/guests")} />
            </div>

            {/* Form Submissions */}
            <FormSubmissionsSection unitMap={unitMap} />

            {/* Overbooking Warnings */}
            {overbookings.length > 0 && (
              <div className="rounded-lg border border-warning-orange/50 bg-warning-orange/5 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-warning-orange mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" /> Overbooking Alert ({overbookings.length} {overbookings.length === 1 ? "unit" : "units"})
                </h3>
                <div className="space-y-2">
                  {overbookings.map(({ unitId, bookings: conflicts }) => (
                    <div key={unitId} className="text-sm">
                      <span className="font-medium text-foreground">{unitMap.get(unitId) ?? "Unknown Unit"}</span>
                      <span className="text-muted-foreground ml-1 text-xs">— {conflicts.length} overlapping bookings:</span>
                      <div className="ml-4 mt-1 space-y-0.5">
                        {conflicts.map((b) => (
                          <div key={b.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="text-foreground font-medium">{b.guest_name}</span>
                            <span>{format(parseISO(b.check_in), "MMM d")} → {format(parseISO(b.check_out), "MMM d")}</span>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getStatusBadgeClass(b.booking_status))}>{b.booking_status}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <GripVertical className="h-3 w-3" />
              Drag guests between columns to update status
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Section
                icon={LogIn} title="Arrivals" count={checkIns.length} color="text-primary"
                isDropTarget={dragOver === "arrivals"}
                onDrop={(e) => handleDrop("arrivals", e)}
                onDragOver={(e) => handleDragOver("arrivals", e)}
                onDragLeave={handleDragLeave}
              >
                {checkIns.length === 0 ? (
                  <EmptyState text="No arrivals today" />
                ) : (
                  checkIns.map((b) => <GuestCard key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} draggable onEdit={() => setEditingBooking(b)} groupBookingId={(b as any).booking_group_id} groupUnitNames={(b as any).booking_group_id ? groupUnitNamesMap.get((b as any).booking_group_id) : undefined} />)
                )}
              </Section>

              <Section
                icon={Home} title="In-House" count={inHouse.length} color="text-ocean"
                extraBadge={dueDepartures.length > 0 ? { label: `${dueDepartures.length} due out`, color: "bg-coral/20 text-coral" } : undefined}
                isDropTarget={dragOver === "inhouse"}
                onDrop={(e) => handleDrop("inhouse", e)}
                onDragOver={(e) => handleDragOver("inhouse", e)}
                onDragLeave={handleDragLeave}
              >
                {inHouse.length === 0 ? (
                  <EmptyState text="No guests in-house" />
                ) : (
                  inHouse.map((b) => <GuestCard key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} draggable onEdit={() => setEditingBooking(b)} noLateCheckout={!!b.unit_id && noLateCheckoutUnitIds.has(b.unit_id)} groupBookingId={(b as any).booking_group_id} groupUnitNames={(b as any).booking_group_id ? groupUnitNamesMap.get((b as any).booking_group_id) : undefined} />)
                )}
              </Section>

              <Section
                icon={LogOut} title="Departures" count={visibleDepartures.length} color="text-coral"
                isDropTarget={dragOver === "departures"}
                onDrop={(e) => handleDrop("departures", e)}
                onDragOver={(e) => handleDragOver("departures", e)}
                onDragLeave={handleDragLeave}
                onClear={visibleDepartures.length > 0 ? handleClearDepartures : undefined}
              >
                {visibleDepartures.length === 0 ? (
                  <EmptyState text="No departures yet" />
                ) : (
                  visibleDepartures.map((b) => <GuestCard key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} onEdit={() => setEditingBooking(b)} noLateCheckout={!!b.unit_id && noLateCheckoutUnitIds.has(b.unit_id)} groupBookingId={(b as any).booking_group_id} groupUnitNames={(b as any).booking_group_id ? groupUnitNamesMap.get((b as any).booking_group_id) : undefined} />)
                )}
              </Section>
            </div>

            {/* Upcoming Arrivals - Next 3 Days */}
            {upcomingArrivals.length > 0 && (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Upcoming Arrivals</span>
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      Next 3 days
                    </span>
                  </div>
                </div>
                <div className="p-2 space-y-1.5">
                  {upcomingArrivals.map((b) => (
                    <GuestCard key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} onEdit={() => setEditingBooking(b)} groupBookingId={(b as any).booking_group_id} groupUnitNames={(b as any).booking_group_id ? groupUnitNamesMap.get((b as any).booking_group_id) : undefined} />
                  ))}
                </div>
              </div>
            )}

            {pendingBalances.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive mb-3 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" /> Pending Balances ({pendingBalances.length})
                </h3>
                <div className="space-y-2">
                  {pendingBalances.slice(0, 5).map((b) => {
                    const balance = b.total_amount - b.deposit_paid;
                    const unpaidExtrasList = getUnpaidExtras(b);
                    const unpaidExtrasAmt = unpaidExtrasList.reduce((s, e) => s + e.amount, 0);
                    const displayAmount = balance > 0 ? balance : unpaidExtrasAmt;
                    return (
                      <div key={b.id} className="space-y-0.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="min-w-0">
                            <span className="text-foreground font-medium">{b.guest_name}</span>
                            <span className="text-muted-foreground ml-2 text-xs">{b.booking_ref}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-destructive font-medium">₱{displayAmount.toLocaleString()}</span>
                            <Badge variant="outline" className="ml-2 text-[10px]">{b.payment_status}</Badge>
                          </div>
                        </div>
                        {unpaidExtrasList.length > 0 && (
                          <div className="text-[10px] text-warning-orange pl-2">
                            Unpaid: {unpaidExtrasList.map(e => e.name).join(", ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {pendingBalances.length > 5 && (
                    <button className="text-xs text-primary hover:underline" onClick={() => navigate("/balances")}>
                      View all {pendingBalances.length} →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Available Units - Today & Week */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Unit Availability</span>
                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                    {availableTodayCount} free today
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigate("/availability")}
                >
                  Full grid →
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium min-w-[140px] sticky left-0 z-10 bg-muted/30">Unit</th>
                      {weekDays.map((day) => (
                        <th key={day.toISOString()} className="text-center px-2 py-2 text-muted-foreground font-medium min-w-[52px]">
                          <div className="text-[10px] leading-none">{format(day, "EEE")}</div>
                          <div className="mt-0.5">{format(day, "d")}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedUnits.map(({ area, units: areaUnits }) => (
                      <>
                        <tr key={area}>
                          <td
                            colSpan={weekDays.length + 1}
                            className="bg-secondary/50 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-primary font-semibold border-t border-border sticky left-0"
                          >
                            {area}
                          </td>
                        </tr>
                        {areaUnits.map((unit) => {
                          const ua = unitAvailability.find((u) => u.unit.id === unit.id);
                          return (
                            <tr key={unit.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                              <td className="px-3 py-1.5 sticky left-0 z-10 bg-card">
                                <div className="flex items-center gap-1.5">
                                  {(() => {
                                    const Icon = unit.name.includes("Villa") && unit.name.includes("Owner") ? Crown
                                      : unit.name.includes("Villa") ? Home
                                      : unit.name.includes("Teepee") ? Tent
                                      : unit.name.includes("Kubo") ? TreePalm
                                      : Home;
                                    return <Icon className="h-3 w-3 text-muted-foreground shrink-0" />;
                                  })()}
                                  <span className="font-medium text-foreground truncate">{unit.name}</span>
                                  {unit.has_ac ? (
                                    <Snowflake className="h-2.5 w-2.5 text-ocean shrink-0" />
                                  ) : (
                                    <Fan className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                  <span>{unit.max_pax} pax</span>
                                  <span>₱{unit.nightly_rate.toLocaleString()}/night</span>
                                </div>
                              </td>
                              {ua?.dayStatus.map((ds) => (
                                <td key={ds.dateStr} className="text-center px-1 py-1.5">
                                  {ds.available ? (
                                    <span className="inline-block w-6 h-6 rounded-md bg-primary/20 text-primary text-[10px] font-bold leading-6">
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="inline-block w-6 h-6 rounded-md bg-destructive/15 text-destructive/60 text-[10px] font-bold leading-6">
                                      ✕
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <BookingModal
          open={!!editingBooking}
          onOpenChange={(open) => { if (!open) setEditingBooking(null); }}
          booking={editingBooking}
        />
      </div>
    </AppLayout>
  );
}

function StatCard({ icon: Icon, label, value, sub, alert, onClick }: {
  icon: any; label: string; value: string; sub?: string; alert?: boolean; onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        alert ? "border-destructive/50 bg-destructive/5" : "border-border bg-card",
        onClick && "cursor-pointer hover:bg-muted/30"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("h-3.5 w-3.5", alert ? "text-destructive" : "text-primary")} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-xl font-display text-foreground">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

interface SectionProps {
  icon: any; title: string; count: number; color: string; children: React.ReactNode;
  isDropTarget?: boolean; onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void; onDragLeave?: () => void;
  onClear?: () => void;
  extraBadge?: { label: string; color: string };
}

function Section({ icon: Icon, title, count, color, children, isDropTarget, onDrop, onDragOver, onDragLeave, onClear, extraBadge }: SectionProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card overflow-hidden transition-colors",
        isDropTarget ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border"
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", color)} />
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">{count}</span>
          {extraBadge && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", extraBadge.color)}>{extraBadge.label}</span>
          )}
        </div>
        {onClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
            onClick={onClear}
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>
      <div className="p-2 space-y-1.5 max-h-[400px] overflow-y-auto min-h-[60px]">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-6 text-xs text-muted-foreground">{text}</div>;
}
