import { useMemo, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useBookings, type Booking } from "@/hooks/useBookings";
import { useUpdateBooking } from "@/hooks/useBookingMutations";
import { useUnits } from "@/hooks/useUnits";
import { useGuests } from "@/hooks/useGuests";
import {
  LogIn, LogOut, Home, Users, BedDouble, Banknote, GripVertical, Clock,
  AlertCircle, LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
}

function GuestCard({ booking, unitName, draggable }: GuestCardProps) {
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("bookingId", booking.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
    >
      {draggable && (
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground truncate">{booking.guest_name}</span>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", getPaymentBadgeClass(booking.payment_status))}>
            {booking.payment_status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 shrink-0">
            <BedDouble className="h-3 w-3" />
            {unitName}
          </span>
          <span className="shrink-0">{booking.pax} PAX</span>
          <span className="shrink-0">₱{booking.total_amount.toLocaleString()}</span>
          <span className="text-[10px] shrink-0">
            {format(parseISO(booking.check_in), "MMM d")} → {format(parseISO(booking.check_out), "MMM d")}
          </span>
        </div>
      </div>
      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", getStatusBadgeClass(booking.booking_status))}>
        {booking.booking_status}
      </Badge>
    </div>
  );
}

type DropZone = "arrivals" | "inhouse" | "departures";

export default function TodayPage() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const thisMonth = todayStr.substring(0, 7);
  const { data: allBookings = [], isLoading: bookingsLoading } = useBookings();
  const { data: units = [], isLoading: unitsLoading } = useUnits();
  const { data: guests = [] } = useGuests();
  const updateBooking = useUpdateBooking();
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState<DropZone | null>(null);

  const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);

  const { checkIns, checkOuts, inHouse, pendingBalances, monthRevenue } = useMemo(() => {
    const checkIns: Booking[] = [];
    const checkOuts: Booking[] = [];
    const inHouse: Booking[] = [];
    const pendingBalances: Booking[] = [];
    let monthRevenue = 0;

    for (const b of allBookings) {
      if (b.booking_status === "Cancelled") continue;
      const ci = b.check_in;
      const co = b.check_out;

      // Arrivals: check_in is today AND not yet checked in
      if (ci === todayStr && b.booking_status !== "Checked In" && b.booking_status !== "Checked Out") {
        checkIns.push(b);
      }
      // Departures: check_out is today AND checked out
      if (co === todayStr && b.booking_status === "Checked Out") {
        checkOuts.push(b);
      }
      // In-House: currently checked in
      if (b.booking_status === "Checked In" && ci <= todayStr && co >= todayStr) {
        inHouse.push(b);
      }
      // Pending balances
      if (b.payment_status === "Unpaid" || b.payment_status === "Partial DP") {
        pendingBalances.push(b);
      }
      // Month revenue
      if (ci.substring(0, 7) === thisMonth) {
        monthRevenue += b.total_amount;
      }
    }

    return { checkIns, checkOuts, inHouse, pendingBalances, monthRevenue };
  }, [allBookings, todayStr, thisMonth]);

  const handleDrop = useCallback(
    (zone: DropZone, e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      const bookingId = e.dataTransfer.getData("bookingId");
      if (!bookingId) return;

      let newStatus: string | null = null;
      if (zone === "inhouse") newStatus = "Checked In";
      else if (zone === "departures") newStatus = "Checked Out";
      else if (zone === "arrivals") newStatus = "Confirmed";

      if (!newStatus) return;

      const booking = allBookings.find((b) => b.id === bookingId);
      if (!booking || booking.booking_status === newStatus) return;

      updateBooking.mutate(
        { id: bookingId, booking_status: newStatus as any },
        {
          onSuccess: () => toast.success(`${booking.guest_name} → ${newStatus}`),
          onError: (err) => toast.error(`Failed to update: ${err.message}`),
        }
      );
    },
    [allBookings, updateBooking]
  );

  const handleDragOver = useCallback((zone: DropZone, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(zone);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(null), []);

  const totalPaxInHouse = inHouse.reduce((sum, b) => sum + b.pax, 0);
  const occupancyRate = units.length > 0 ? Math.round((inHouse.length / units.length) * 100) : 0;
  const pendingTotal = pendingBalances.reduce((s, b) => s + (b.total_amount - b.deposit_paid), 0);

  const isLoading = bookingsLoading || unitsLoading;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0 gap-1">
          <div>
            <h1 className="text-xl sm:text-3xl font-display text-foreground tracking-wide">Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Check-in: 1:00 PM · Check-out: 11:00 AM</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <span className="text-muted-foreground text-sm">Loading...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <StatCard icon={Home} label="Occupancy" value={`${occupancyRate}%`} sub={`${inHouse.length} of ${units.length} units`} />
              <StatCard icon={Users} label="In-House" value={totalPaxInHouse.toString()} sub={`${inHouse.length} bookings`} />
              <StatCard icon={LogIn} label="Arrivals" value={checkIns.length.toString()} sub={`${checkIns.reduce((s, b) => s + b.pax, 0)} guests`} />
              <StatCard
                icon={AlertCircle}
                label="Pending"
                value={`₱${pendingTotal.toLocaleString()}`}
                sub={`${pendingBalances.length} bookings`}
                alert={pendingBalances.length > 0}
                onClick={() => navigate("/balances")}
              />
              <StatCard icon={Users} label="Total Guests" value={String(guests.length)} onClick={() => navigate("/guests")} />
            </div>

            {/* Drag hint */}
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <GripVertical className="h-3 w-3" />
              Drag guests between columns to update status
            </p>

            {/* Drag-drop Sections */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
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
                  checkIns.map((b) => <GuestCard key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} draggable />)
                )}
              </Section>

              <Section
                icon={Home} title="In-House" count={inHouse.length} color="text-ocean"
                isDropTarget={dragOver === "inhouse"}
                onDrop={(e) => handleDrop("inhouse", e)}
                onDragOver={(e) => handleDragOver("inhouse", e)}
                onDragLeave={handleDragLeave}
              >
                {inHouse.length === 0 ? (
                  <EmptyState text="No guests in-house" />
                ) : (
                  inHouse.map((b) => <GuestCard key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} draggable />)
                )}
              </Section>

              <Section
                icon={LogOut} title="Departures" count={checkOuts.length} color="text-coral"
                isDropTarget={dragOver === "departures"}
                onDrop={(e) => handleDrop("departures", e)}
                onDragOver={(e) => handleDragOver("departures", e)}
                onDragLeave={handleDragLeave}
              >
                {checkOuts.length === 0 ? (
                  <EmptyState text="No departures today" />
                ) : (
                  checkOuts.map((b) => <GuestCard key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} draggable />)
                )}
              </Section>
            </div>

            {/* Pending Balances Preview */}
            {pendingBalances.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive mb-3 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" /> Pending Balances ({pendingBalances.length})
                </h3>
                <div className="space-y-2">
                  {pendingBalances.slice(0, 5).map((b) => (
                    <div key={b.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-foreground font-medium">{b.guest_name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{b.booking_ref}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-destructive font-medium">₱{(b.total_amount - b.deposit_paid).toLocaleString()}</span>
                        <Badge variant="outline" className="ml-2 text-[10px]">{b.payment_status}</Badge>
                      </div>
                    </div>
                  ))}
                  {pendingBalances.length > 5 && (
                    <button className="text-xs text-primary hover:underline" onClick={() => navigate("/balances")}>
                      View all {pendingBalances.length} →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
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
        "rounded-lg border p-4 transition-colors",
        alert ? "border-destructive/50 bg-destructive/5" : "border-border bg-card",
        onClick && "cursor-pointer hover:bg-muted/30"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-4 w-4", alert ? "text-destructive" : "text-primary")} />
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-2xl font-display text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

interface SectionProps {
  icon: any; title: string; count: number; color: string; children: React.ReactNode;
  isDropTarget?: boolean; onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void; onDragLeave?: () => void;
}

function Section({ icon: Icon, title, count, color, children, isDropTarget, onDrop, onDragOver, onDragLeave }: SectionProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card overflow-hidden transition-colors",
        isDropTarget ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border"
      )}
      onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", color)} />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">{count}</span>
      </div>
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto min-h-[80px]">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-8 text-sm text-muted-foreground">{text}</div>;
}
