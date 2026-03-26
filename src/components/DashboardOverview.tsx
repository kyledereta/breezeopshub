import { useMemo } from "react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { useBookings, type Booking } from "@/hooks/useBookings";
import { useUnits } from "@/hooks/useUnits";
import { useGuests } from "@/hooks/useGuests";
import {
  CalendarCheck, LogIn, LogOut, Users, Banknote, AlertCircle, BedDouble, TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface StatCardProps {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
  alert?: boolean;
}

function StatCard({ icon: Icon, label, value, sub, onClick, alert }: StatCardProps) {
  return (
    <div
      className={`rounded-lg border p-4 cursor-pointer hover:bg-muted/30 transition-colors ${alert ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${alert ? "text-destructive" : "text-primary"}`} />
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-2xl font-display text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function DashboardOverview() {
  const { data: allBookings = [] } = useBookings();
  const { data: units = [] } = useUnits();
  const { data: guests = [] } = useGuests();
  const navigate = useNavigate();

  const today = format(new Date(), "yyyy-MM-dd");

  const { checkIns, checkOuts, currentlyStaying, pendingBalances, todayRevenue } = useMemo(() => {
    const ci: Booking[] = [];
    const co: Booking[] = [];
    const staying: Booking[] = [];
    const pending: Booking[] = [];
    let rev = 0;

    for (const b of allBookings) {
      if (b.booking_status === "Cancelled") continue;
      if (b.check_in === today) ci.push(b);
      if (b.check_out === today) co.push(b);
      if (b.check_in <= today && b.check_out > today && (b.booking_status === "Checked In" || b.booking_status === "Confirmed")) {
        staying.push(b);
      }
      if (b.payment_status === "Unpaid" || b.payment_status === "Partial DP") {
        pending.push(b);
      }
      // Revenue for current month
      if (b.check_in.substring(0, 7) === today.substring(0, 7)) {
        rev += b.total_amount;
      }
    }
    return { checkIns: ci, checkOuts: co, currentlyStaying: staying, pendingBalances: pending, todayRevenue: rev };
  }, [allBookings, today]);

  const occupiedUnits = currentlyStaying.length;
  const totalUnits = units.length;
  const occupancyPct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const pendingTotal = pendingBalances.reduce((s, b) => s + (b.total_amount - b.deposit_paid), 0);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={LogIn} label="Check-ins Today" value={String(checkIns.length)} onClick={() => navigate("/today")} />
        <StatCard icon={LogOut} label="Check-outs Today" value={String(checkOuts.length)} onClick={() => navigate("/today")} />
        <StatCard icon={BedDouble} label="Occupancy" value={`${occupancyPct}%`} sub={`${occupiedUnits} of ${totalUnits} units`} onClick={() => navigate("/")} />
        <StatCard icon={Banknote} label="This Month" value={`₱${todayRevenue.toLocaleString()}`} onClick={() => navigate("/revenue")} />
        <StatCard
          icon={AlertCircle}
          label="Pending Balances"
          value={`₱${pendingTotal.toLocaleString()}`}
          sub={`${pendingBalances.length} bookings`}
          onClick={() => navigate("/balances")}
          alert={pendingBalances.length > 0}
        />
        <StatCard icon={Users} label="Total Guests" value={String(guests.length)} onClick={() => navigate("/guests")} />
      </div>

      {/* Today's Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Check-ins */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
            <LogIn className="h-3.5 w-3.5" /> Today's Check-ins ({checkIns.length})
          </h3>
          {checkIns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No check-ins today</p>
          ) : (
            <div className="space-y-2">
              {checkIns.slice(0, 5).map((b) => (
                <BookingRow key={b.id} booking={b} units={units} />
              ))}
            </div>
          )}
        </div>

        {/* Check-outs */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
            <LogOut className="h-3.5 w-3.5" /> Today's Check-outs ({checkOuts.length})
          </h3>
          {checkOuts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No check-outs today</p>
          ) : (
            <div className="space-y-2">
              {checkOuts.slice(0, 5).map((b) => (
                <BookingRow key={b.id} booking={b} units={units} />
              ))}
            </div>
          )}
        </div>
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
  );
}

function BookingRow({ booking: b, units }: { booking: Booking; units: any[] }) {
  const unitName = units.find((u) => u.id === b.unit_id)?.name ?? "—";
  return (
    <div className="flex items-center justify-between text-sm">
      <div>
        <span className="text-foreground font-medium">{b.guest_name}</span>
        <span className="text-muted-foreground ml-2 text-xs">{unitName}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{b.pax} pax</span>
        <Badge variant="outline" className="text-[10px]">{b.booking_status}</Badge>
      </div>
    </div>
  );
}
