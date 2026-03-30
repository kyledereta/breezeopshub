import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LogIn, LogOut, Home, Users, BedDouble, DollarSign,
  Sun, SprayCan, AlertTriangle, CircleDollarSign,
} from "lucide-react";
import type { Booking } from "@/hooks/useBookings";
import type { Unit } from "@/hooks/useUnits";
import { getUnpaidExtrasTotal, hasUnpaidExtras } from "@/lib/unpaidExtras";

interface TodayReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookings: Booking[];
  units: Unit[];
  todayStr: string;
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

export function TodayReportDialog({
  open,
  onOpenChange,
  bookings,
  units,
  todayStr,
}: TodayReportDialogProps) {
  const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);

  const report = useMemo(() => {
    const arrivals: Booking[] = [];
    const checkedIn: Booking[] = [];
    const inHouse: Booking[] = [];
    const departures: Booking[] = [];
    const checkedOut: Booking[] = [];
    const daytours: Booking[] = [];
    let revenueToday = 0;
    const occupiedUnitIds = new Set<string>();
    const pendingBalances: { booking: Booking; amount: number }[] = [];

    for (const b of bookings) {
      if (b.booking_status === "Cancelled" || b.deleted_at) continue;
      const isSecondary = b.booking_group_id && !b.is_primary;

      // Occupancy tracking (all bookings)
      if (
        b.booking_status === "Checked In" &&
        b.check_in <= todayStr &&
        b.check_out >= todayStr &&
        b.unit_id
      ) {
        occupiedUnitIds.add(b.unit_id);
      }

      if (isSecondary) continue;

      // Arrivals (check-in today, any status except checked out)
      if (b.check_in === todayStr && b.booking_status !== "Checked Out") {
        arrivals.push(b);
        if (b.booking_status === "Checked In") checkedIn.push(b);
      }

      // In-house
      if (b.booking_status === "Checked In" && b.check_in <= todayStr && b.check_out >= todayStr) {
        inHouse.push(b);
      }

      // Departures (check-out today)
      if (b.check_out === todayStr) {
        departures.push(b);
        if (b.booking_status === "Checked Out") checkedOut.push(b);
      }

      // Daytours
      if (b.is_daytour_booking && b.check_in === todayStr) {
        daytours.push(b);
      }

      // Revenue from today's arrivals
      if (
        b.check_in === todayStr &&
        (b.booking_status === "Checked In" || b.booking_status === "Confirmed")
      ) {
        revenueToday += b.total_amount;
      }

      // Pending balances
      if (b.payment_status === "Unpaid" || b.payment_status === "Partial DP" || hasUnpaidExtras(b)) {
        const balance = b.total_amount - b.deposit_paid;
        const extras = getUnpaidExtrasTotal(b);
        const amt = balance <= 0 && extras > 0 ? extras : Math.max(balance, 0);
        if (amt > 0) pendingBalances.push({ booking: b, amount: amt });
      }
    }

    const availableUnits = units.filter((u) => (u.unit_status || "Available") === "Available").length;
    const occupancy = availableUnits > 0 ? Math.round((occupiedUnitIds.size / availableUnits) * 100) : 0;
    const totalPax = inHouse.reduce((s, b) => s + b.pax, 0);
    const totalPendingAmount = pendingBalances.reduce((s, p) => s + p.amount, 0);

    return {
      arrivals,
      checkedIn,
      inHouse,
      departures,
      checkedOut,
      daytours,
      revenueToday,
      occupancy,
      occupiedUnitIds,
      availableUnits,
      totalPax,
      pendingBalances,
      totalPendingAmount,
    };
  }, [bookings, units, todayStr]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Today's Report — {format(new Date(), "MMMM d, yyyy")}
          </DialogTitle>
        </DialogHeader>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
          <MiniStat icon={Home} label="Occupancy" value={`${report.occupancy}%`} />
          <MiniStat icon={Users} label="Pax In-House" value={String(report.totalPax)} />
          <MiniStat icon={DollarSign} label="Revenue" value={`₱${report.revenueToday.toLocaleString()}`} />
          <MiniStat icon={CircleDollarSign} label="Pending" value={`₱${report.totalPendingAmount.toLocaleString()}`} alert={report.totalPendingAmount > 0} />
        </div>

        {/* Arrivals */}
        <ReportSection
          icon={<LogIn className="h-3.5 w-3.5 text-primary" />}
          title="Arrivals"
          summary={`${report.checkedIn.length} of ${report.arrivals.length} checked in`}
        >
          {report.arrivals.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">No arrivals today</p>
          ) : (
            report.arrivals.map((b) => (
              <ReportRow key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} />
            ))
          )}
        </ReportSection>

        {/* In-House */}
        <ReportSection
          icon={<Home className="h-3.5 w-3.5 text-ocean" />}
          title="In-House"
          summary={`${report.inHouse.length} bookings · ${report.totalPax} pax`}
        >
          {report.inHouse.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">No guests in-house</p>
          ) : (
            report.inHouse.map((b) => (
              <ReportRow key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} />
            ))
          )}
        </ReportSection>

        {/* Departures */}
        <ReportSection
          icon={<LogOut className="h-3.5 w-3.5 text-coral" />}
          title="Departures"
          summary={`${report.checkedOut.length} of ${report.departures.length} checked out`}
        >
          {report.departures.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">No departures today</p>
          ) : (
            report.departures.map((b) => (
              <ReportRow key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} />
            ))
          )}
        </ReportSection>

        {/* Daytours */}
        {report.daytours.length > 0 && (
          <ReportSection
            icon={<Sun className="h-3.5 w-3.5 text-warning-orange" />}
            title="Day Tours"
            summary={`${report.daytours.length} bookings · ${report.daytours.reduce((s, b) => s + b.pax, 0)} pax`}
          >
            {report.daytours.map((b) => (
              <ReportRow key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "Day Tour"} />
            ))}
          </ReportSection>
        )}

        {/* Pending Balances */}
        {report.pendingBalances.length > 0 && (
          <ReportSection
            icon={<AlertTriangle className="h-3.5 w-3.5 text-warning-orange" />}
            title="Pending Balances"
            summary={`${report.pendingBalances.length} bookings · ₱${report.totalPendingAmount.toLocaleString()}`}
          >
            {report.pendingBalances.map(({ booking: b, amount }) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{b.guest_name}</div>
                  <div className="text-muted-foreground text-[10px]">
                    {unitMap.get(b.unit_id ?? "") ?? "—"} · {format(parseISO(b.check_in), "MMM d")}–{format(parseISO(b.check_out), "MMM d")}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="font-semibold text-warning-orange">₱{amount.toLocaleString()}</span>
                  <Badge variant="outline" className={cn("text-[9px]", getPaymentBadgeClass(b.payment_status))}>
                    {b.payment_status}
                  </Badge>
                </div>
              </div>
            ))}
          </ReportSection>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-2.5 text-center",
      alert ? "border-warning-orange/40" : "border-border"
    )}>
      <Icon className={cn("h-3.5 w-3.5 mx-auto mb-1", alert ? "text-warning-orange" : "text-primary")} />
      <div className="text-sm font-bold text-foreground">{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function ReportSection({
  icon,
  title,
  summary,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{summary}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ReportRow({ booking, unitName }: { booking: Booking; unitName: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs">
      <div className="min-w-0">
        <div className="font-medium text-foreground truncate">{booking.guest_name}</div>
        <div className="text-muted-foreground text-[10px] flex items-center gap-1">
          <BedDouble className="h-2.5 w-2.5" />
          {unitName}
          <span className="mx-0.5">·</span>
          {booking.pax} pax
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <Badge variant="outline" className={cn("text-[9px]", getPaymentBadgeClass(booking.payment_status))}>
          {booking.payment_status}
        </Badge>
        <Badge variant="outline" className="text-[9px]">
          {booking.booking_status}
        </Badge>
      </div>
    </div>
  );
}
