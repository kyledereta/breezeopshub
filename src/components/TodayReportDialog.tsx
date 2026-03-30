import { useMemo } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LogIn, LogOut, Home, Users, BedDouble, DollarSign,
  Sun, AlertTriangle, CircleDollarSign, ArrowRightLeft,
  Layers, Download, Package, ShieldAlert,
} from "lucide-react";
import type { Booking } from "@/hooks/useBookings";
import type { Unit } from "@/hooks/useUnits";
import { getUnpaidExtrasTotal, hasUnpaidExtras } from "@/lib/unpaidExtras";
import { buildContinuedStaySet } from "@/hooks/useContinuedStay";
import { generateTodayReportPdf } from "@/lib/todayReportPdf";

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

    // Grouped bookings
    const groupMap = new Map<string, Booking[]>();

    // Extras collected
    const extrasCollected: { booking: Booking; extras: { name: string; amount: number }[] }[] = [];

    // Security deposit deductions
    const depositDeductions: { booking: Booking; amount: number; reason: string }[] = [];

    for (const b of bookings) {
      if (b.booking_status === "Cancelled" || b.deleted_at) continue;
      const isSecondary = b.booking_group_id && !b.is_primary;

      // Track groups
      if (b.booking_group_id) {
        if (!groupMap.has(b.booking_group_id)) groupMap.set(b.booking_group_id, []);
        groupMap.get(b.booking_group_id)!.push(b);
      }

      // Occupancy tracking
      if (
        b.booking_status === "Checked In" &&
        b.check_in <= todayStr &&
        b.check_out >= todayStr &&
        b.unit_id
      ) {
        occupiedUnitIds.add(b.unit_id);
      }

      if (isSecondary) continue;

      // Arrivals
      if (b.check_in === todayStr && b.booking_status !== "Checked Out") {
        arrivals.push(b);
        if (b.booking_status === "Checked In") checkedIn.push(b);
      }

      // In-house
      if (b.booking_status === "Checked In" && b.check_in <= todayStr && b.check_out >= todayStr) {
        inHouse.push(b);
      }

      // Departures
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

      // Pending balances — only for today's bookings (in-house, arriving, or departing today)
      const isTodayRelevant = (b.check_in <= todayStr && b.check_out >= todayStr) || b.check_in === todayStr || b.check_out === todayStr;
      if (isTodayRelevant && (b.payment_status === "Unpaid" || b.payment_status === "Partial DP" || hasUnpaidExtras(b))) {
        const balance = b.total_amount - b.deposit_paid;
        const extras = getUnpaidExtrasTotal(b);
        const amt = balance <= 0 && extras > 0 ? extras : Math.max(balance, 0);
        if (amt > 0) pendingBalances.push({ booking: b, amount: amt });
      }

      // Security deposit deductions
      if (isTodayRelevant && b.deposit_status === "Deducted" && b.deposit_deducted_amount > 0) {
        depositDeductions.push({
          booking: b,
          amount: b.deposit_deducted_amount,
          reason: b.deposit_deducted_reason || "No reason specified",
        });
      }

      // Extras on in-house / today's bookings
      const extrasList: { name: string; amount: number }[] = [];
      if (b.utensil_rental && b.utensil_rental_fee > 0) extrasList.push({ name: "Utensil Rental", amount: b.utensil_rental_fee });
      if (b.karaoke && b.karaoke_fee > 0) extrasList.push({ name: "Karaoke", amount: b.karaoke_fee });
      if (b.kitchen_use && b.kitchen_use_fee > 0) extrasList.push({ name: "Kitchen Use", amount: b.kitchen_use_fee });
      if (b.water_jug && b.water_jug_fee > 0) extrasList.push({ name: `Water Jug (×${b.water_jug_qty})`, amount: b.water_jug_fee });
      if (b.towel_rent && b.towel_rent_fee > 0) extrasList.push({ name: `Towel Rent (×${b.towel_rent_qty})`, amount: b.towel_rent_fee });
      if (b.bonfire && b.bonfire_fee > 0) extrasList.push({ name: "Bonfire", amount: b.bonfire_fee });
      if (b.early_checkin && b.early_checkin_fee > 0) extrasList.push({ name: "Early Check-in", amount: b.early_checkin_fee });
      if (b.pets && b.pet_fee > 0) extrasList.push({ name: "Pet Fee", amount: b.pet_fee });
      if (b.other_extras_fee > 0) extrasList.push({ name: b.other_extras_note || "Other", amount: b.other_extras_fee });
      if (extrasList.length > 0 && (b.check_in <= todayStr && b.check_out >= todayStr)) {
        extrasCollected.push({ booking: b, extras: extrasList });
      }
    }

    // Continued stays
    const continuedIds = buildContinuedStaySet(bookings);
    const continuedBookings = bookings.filter(
      (b) => continuedIds.has(b.id) && !b.deleted_at && b.booking_status !== "Cancelled" &&
        (b.check_in === todayStr || b.check_out === todayStr)
    );

    // Active groups (any booking in-house or arriving today)
    const activeGroups: { groupId: string; bookings: Booking[] }[] = [];
    for (const [gid, gbs] of groupMap) {
      const isActive = gbs.some(
        (b) => b.check_in <= todayStr && b.check_out >= todayStr && b.booking_status !== "Checked Out"
      );
      if (isActive) activeGroups.push({ groupId: gid, bookings: gbs });
    }

    const availableUnits = units.filter((u) => (u.unit_status || "Available") === "Available").length;
    const occupancy = availableUnits > 0 ? Math.round((occupiedUnitIds.size / availableUnits) * 100) : 0;
    const totalPax = inHouse.reduce((s, b) => s + b.pax, 0);
    const totalPendingAmount = pendingBalances.reduce((s, p) => s + p.amount, 0);
    const totalExtrasAmount = extrasCollected.reduce((s, e) => s + e.extras.reduce((a, x) => a + x.amount, 0), 0);

    // Key takeaways
    const takeaways: string[] = [];
    if (arrivals.length > 0) takeaways.push(`${arrivals.length} arrival${arrivals.length > 1 ? "s" : ""} expected today`);
    if (departures.length > 0) takeaways.push(`${departures.length} departure${departures.length > 1 ? "s" : ""} today`);
    if (occupancy >= 90) takeaways.push(`High occupancy at ${occupancy}%`);
    else if (occupancy <= 30 && availableUnits > 0) takeaways.push(`Low occupancy at ${occupancy}% — consider promos`);
    if (pendingBalances.length > 0) takeaways.push(`₱${totalPendingAmount.toLocaleString()} in pending balances from ${pendingBalances.length} booking${pendingBalances.length > 1 ? "s" : ""}`);
    if (continuedBookings.length > 0) takeaways.push(`${continuedBookings.length} continued stay movement${continuedBookings.length > 1 ? "s" : ""}`);
    if (activeGroups.length > 0) takeaways.push(`${activeGroups.length} active group booking${activeGroups.length > 1 ? "s" : ""}`);
    const unpaidArrivals = arrivals.filter((b) => b.payment_status === "Unpaid").length;
    if (unpaidArrivals > 0) takeaways.push(`⚠ ${unpaidArrivals} unpaid arrival${unpaidArrivals > 1 ? "s" : ""} — collect payment on check-in`);
    if (depositDeductions.length > 0) {
      const totalDeducted = depositDeductions.reduce((s, d) => s + d.amount, 0);
      takeaways.push(`₱${totalDeducted.toLocaleString()} in security deposit deductions from ${depositDeductions.length} booking${depositDeductions.length > 1 ? "s" : ""}`);
    }

    return {
      arrivals, checkedIn, inHouse, departures, checkedOut, daytours,
      revenueToday, occupancy, occupiedUnitIds, availableUnits, totalPax,
      pendingBalances, totalPendingAmount,
      continuedBookings, activeGroups,
      extrasCollected, totalExtrasAmount,
      depositDeductions,
      takeaways,
    };
  }, [bookings, units, todayStr]);

  const handleDownloadPdf = () => {
    generateTodayReportPdf({
      todayStr,
      report,
      unitMap,
      totalUnits: units.filter((u) => (u.unit_status || "Available") === "Available").length,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-lg">
              Today's Report — {format(new Date(), "MMMM d, yyyy")}
            </DialogTitle>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownloadPdf}>
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>
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

        {/* Continued Stays */}
        {report.continuedBookings.length > 0 && (
          <ReportSection
            icon={<ArrowRightLeft className="h-3.5 w-3.5 text-ocean" />}
            title="Continued Stays"
            summary={`${report.continuedBookings.length} movements`}
          >
            {report.continuedBookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{b.guest_name}</div>
                  <div className="text-muted-foreground text-[10px] flex items-center gap-1">
                    <BedDouble className="h-2.5 w-2.5" />
                    {unitMap.get(b.unit_id ?? "") ?? "—"}
                    <span className="mx-0.5">·</span>
                    {b.check_in === todayStr ? "Arriving (continued)" : "Departing (continued)"}
                  </div>
                </div>
              </div>
            ))}
          </ReportSection>
        )}

        {/* Grouped Bookings */}
        {report.activeGroups.length > 0 && (
          <ReportSection
            icon={<Layers className="h-3.5 w-3.5 text-primary" />}
            title="Group Bookings"
            summary={`${report.activeGroups.length} group${report.activeGroups.length > 1 ? "s" : ""}`}
          >
            {report.activeGroups.map(({ groupId, bookings: gbs }) => {
              const primary = gbs.find((b) => b.is_primary) || gbs[0];
              const totalAmt = gbs.reduce((s, b) => s + b.total_amount, 0);
              const totalDep = gbs.reduce((s, b) => s + b.deposit_paid, 0);
              return (
                <div key={groupId} className="rounded-md border border-border bg-background px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{primary.guest_name}</span>
                    <span className="text-muted-foreground text-[10px]">{gbs.length} units</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {gbs.map((b) => (
                      <Badge key={b.id} variant="outline" className="text-[9px] font-normal">
                        {unitMap.get(b.unit_id ?? "") ?? "—"}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                    <span>Total: ₱{totalAmt.toLocaleString()}</span>
                    <span>Deposits: ₱{totalDep.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </ReportSection>
        )}

        {/* Extras Collected */}
        {report.extrasCollected.length > 0 && (
          <ReportSection
            icon={<Package className="h-3.5 w-3.5 text-primary" />}
            title="Extras / Add-ons"
            summary={`₱${report.totalExtrasAmount.toLocaleString()} from ${report.extrasCollected.length} booking${report.extrasCollected.length > 1 ? "s" : ""}`}
          >
            {report.extrasCollected.map(({ booking: b, extras }) => (
              <div
                key={b.id}
                className="rounded-md border border-border bg-background px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-foreground truncate">{b.guest_name}</span>
                  <span className="text-[10px] text-muted-foreground">{unitMap.get(b.unit_id ?? "") ?? "—"}</span>
                </div>
                <div className="space-y-0.5">
                  {extras.map((e, i) => (
                    <div key={i} className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{e.name}</span>
                      <span>₱{e.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </ReportSection>
        )}

        {/* Security Deposit Deductions */}
        {report.depositDeductions.length > 0 && (
          <ReportSection
            icon={<ShieldAlert className="h-3.5 w-3.5 text-destructive" />}
            title="Deposit Deductions"
            summary={`₱${report.depositDeductions.reduce((s, d) => s + d.amount, 0).toLocaleString()} from ${report.depositDeductions.length} booking${report.depositDeductions.length > 1 ? "s" : ""}`}
          >
            {report.depositDeductions.map(({ booking: b, amount, reason }) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{b.guest_name}</div>
                  <div className="text-muted-foreground text-[10px]">
                    {unitMap.get(b.unit_id ?? "") ?? "—"} · {reason}
                  </div>
                </div>
                <span className="font-semibold text-destructive shrink-0 ml-2">₱{amount.toLocaleString()}</span>
              </div>
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

        {/* Revenue & Occupancy Summary */}
        <div className="mt-4 rounded-lg border border-border bg-card p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Revenue & Occupancy Summary
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <span className="text-muted-foreground">Today's Revenue</span>
            <span className="text-right font-semibold text-foreground">₱{report.revenueToday.toLocaleString()}</span>
            <span className="text-muted-foreground">Extras / Add-ons</span>
            <span className="text-right font-semibold text-foreground">₱{report.totalExtrasAmount.toLocaleString()}</span>
            <span className="text-muted-foreground">Pending Collections</span>
            <span className="text-right font-semibold text-warning-orange">₱{report.totalPendingAmount.toLocaleString()}</span>
            <span className="text-muted-foreground">Occupancy Rate</span>
            <span className="text-right font-semibold text-foreground">{report.occupancy}%</span>
            <span className="text-muted-foreground">Units Occupied</span>
            <span className="text-right font-semibold text-foreground">{report.occupiedUnitIds.size} / {report.availableUnits}</span>
            <span className="text-muted-foreground">Total Pax In-House</span>
            <span className="text-right font-semibold text-foreground">{report.totalPax}</span>
          </div>
        </div>

        {/* Key Takeaways */}
        {report.takeaways.length > 0 && (
          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
              Key Takeaways
            </div>
            <ul className="space-y-1">
              {report.takeaways.map((t, i) => (
                <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
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
