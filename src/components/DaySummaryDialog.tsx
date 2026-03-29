import { useMemo } from "react";
import { format, parseISO, isSameDay, isWithinInterval } from "date-fns";
import { LogIn, LogOut, Home, Users, BedDouble } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Booking } from "@/hooks/useBookings";
import type { Unit } from "@/hooks/useUnits";

interface DaySummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  bookings: Booking[];
  units: Unit[];
  onBookingClick?: (booking: Booking) => void;
}

function getPaymentBadgeClass(status: string) {
  switch (status) {
    case "Fully Paid": return "bg-primary/20 text-primary border-primary/30";
    case "Airbnb Paid": return "bg-airbnb-pink/20 text-airbnb-pink border-airbnb-pink/30";
    case "Partial DP": return "bg-warning-orange/20 text-warning-orange border-warning-orange/30";
    case "Unpaid": return "bg-destructive/20 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function DaySummaryDialog({
  open,
  onOpenChange,
  date,
  bookings,
  units,
  onBookingClick,
}: DaySummaryDialogProps) {
  const dateStr = format(date, "yyyy-MM-dd");

  const { arrivals, departures, inHouse, occupiedUnits, availableUnits } = useMemo(() => {
    const arrivals: (Booking & { unitName: string })[] = [];
    const departures: (Booking & { unitName: string })[] = [];
    const inHouse: (Booking & { unitName: string })[] = [];
    const occupiedUnitIds = new Set<string>();

    const unitMap = new Map(units.map((u) => [u.id, u.name]));

    for (const b of bookings) {
      if (b.booking_status === "Cancelled" || b.deleted_at) continue;
      const checkIn = parseISO(b.check_in);
      const checkOut = parseISO(b.check_out);
      const unitName = b.unit_id ? unitMap.get(b.unit_id) || "Unassigned" : "Unassigned";
      const enhanced = { ...b, unitName };

      if (isSameDay(checkIn, date)) {
        arrivals.push(enhanced);
      }
      if (isSameDay(checkOut, date)) {
        departures.push(enhanced);
      }
      // In-house: staying on this date (checked in before checkout)
      if (
        isWithinInterval(date, { start: checkIn, end: checkOut }) &&
        !isSameDay(date, checkOut)
      ) {
        inHouse.push(enhanced);
        if (b.unit_id) occupiedUnitIds.add(b.unit_id);
      }
    }

    const availableUnitsArr = units.filter(
      (u) => (u.unit_status || "Available") === "Available" && !occupiedUnitIds.has(u.id)
    );

    return {
      arrivals,
      departures,
      inHouse,
      occupiedUnits: occupiedUnitIds.size,
      availableUnits: availableUnitsArr,
    };
  }, [bookings, units, date]);

  const totalAvailableUnits = units.filter((u) => (u.unit_status || "Available") === "Available").length;
  const occupancyRate = totalAvailableUnits > 0 ? Math.round((occupiedUnits / totalAvailableUnits) * 100) : 0;
  // Only count pax from primary bookings (or non-grouped) to avoid double-counting group bookings
  const totalPax = inHouse
    .filter((b) => !b.booking_group_id || b.is_primary)
    .reduce((sum, b) => sum + b.pax, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {format(date, "EEEE, MMMM d, yyyy")}
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <Home className="h-4 w-4 mx-auto text-primary mb-1" />
            <div className="text-lg font-bold text-foreground">{occupancyRate}%</div>
            <div className="text-[10px] text-muted-foreground">Occupancy</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <BedDouble className="h-4 w-4 mx-auto text-primary mb-1" />
            <div className="text-lg font-bold text-foreground">{occupiedUnits}/{totalAvailableUnits}</div>
            <div className="text-[10px] text-muted-foreground">Units Occupied</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <Users className="h-4 w-4 mx-auto text-primary mb-1" />
            <div className="text-lg font-bold text-foreground">{totalPax}</div>
            <div className="text-[10px] text-muted-foreground">Total Pax</div>
          </div>
        </div>

        {/* Arrivals */}
        <Section
          icon={<LogIn className="h-3.5 w-3.5 text-primary" />}
          title="Arrivals"
          count={arrivals.length}
        >
          {arrivals.map((b) => (
            <BookingRow key={b.id} booking={b} onClick={() => onBookingClick?.(b)} />
          ))}
        </Section>

        {/* In-House */}
        <Section
          icon={<Home className="h-3.5 w-3.5 text-ocean" />}
          title="In-House"
          count={inHouse.length}
        >
          {inHouse.map((b) => (
            <BookingRow key={b.id} booking={b} onClick={() => onBookingClick?.(b)} />
          ))}
        </Section>

        {/* Departures */}
        <Section
          icon={<LogOut className="h-3.5 w-3.5 text-coral" />}
          title="Departures"
          count={departures.length}
        >
          {departures.map((b) => (
            <BookingRow key={b.id} booking={b} onClick={() => onBookingClick?.(b)} />
          ))}
        </Section>

        {/* Available Units */}
        {availableUnits.length > 0 && (
          <Section
            icon={<BedDouble className="h-3.5 w-3.5 text-muted-foreground" />}
            title="Available Units"
            count={availableUnits.length}
          >
            <div className="flex flex-wrap gap-1.5">
              {availableUnits.map((u) => (
                <Badge key={u.id} variant="outline" className="text-[10px] font-normal">
                  {u.name}
                </Badge>
              ))}
            </div>
          </Section>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">
          {count}
        </Badge>
      </div>
      {count === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic pl-5">None</p>
      ) : (
        <div className="space-y-1.5 pl-5">{children}</div>
      )}
    </div>
  );
}

function BookingRow({
  booking,
  onClick,
}: {
  booking: Booking & { unitName: string };
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs",
        onClick && "cursor-pointer hover:border-primary/30 transition-colors"
      )}
    >
      <div className="min-w-0">
        <div className="font-medium text-foreground truncate">{booking.guest_name}</div>
        <div className="text-muted-foreground text-[10px] flex items-center gap-1">
          <BedDouble className="h-2.5 w-2.5" />
          {booking.unitName}
          <span className="mx-0.5">·</span>
          {booking.pax} pax
        </div>
      </div>
      <Badge
        variant="outline"
        className={cn("text-[9px] shrink-0 ml-2", getPaymentBadgeClass(booking.payment_status))}
      >
        {booking.payment_status}
      </Badge>
    </div>
  );
}
