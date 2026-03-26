import { useMemo, useState } from "react";
import { format, parseISO, addDays, isBefore } from "date-fns";
import { useBookings } from "@/hooks/useBookings";
import { useUnits } from "@/hooks/useUnits";
import { Bell, LogIn, AlertTriangle, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  icon: any;
  title: string;
  description: string;
  color: string;
  action?: () => void;
}

export function NotificationBell() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const { data: allBookings = [] } = useBookings();
  const { data: units = [] } = useUnits();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const notifications = useMemo(() => {
    const items: Notification[] = [];

    // Upcoming check-ins (today + tomorrow)
    const todayCheckIns = allBookings.filter(
      (b) => b.check_in === todayStr && b.booking_status === "Confirmed"
    );
    const tomorrowCheckIns = allBookings.filter(
      (b) => b.check_in === tomorrowStr && b.booking_status !== "Cancelled"
    );

    if (todayCheckIns.length > 0) {
      items.push({
        id: "today-checkins",
        icon: LogIn,
        title: `${todayCheckIns.length} check-in${todayCheckIns.length > 1 ? "s" : ""} today`,
        description: todayCheckIns.map((b) => b.guest_name).join(", "),
        color: "text-primary",
        action: () => { navigate("/"); setOpen(false); },
      });
    }

    if (tomorrowCheckIns.length > 0) {
      items.push({
        id: "tomorrow-checkins",
        icon: LogIn,
        title: `${tomorrowCheckIns.length} check-in${tomorrowCheckIns.length > 1 ? "s" : ""} tomorrow`,
        description: tomorrowCheckIns.map((b) => b.guest_name).join(", "),
        color: "text-ocean",
      });
    }

    // Overdue payments (checked in but unpaid/partial)
    const overduePayments = allBookings.filter(
      (b) =>
        b.booking_status === "Checked In" &&
        (b.payment_status === "Unpaid" || b.payment_status === "Partial DP")
    );

    if (overduePayments.length > 0) {
      const totalOwed = overduePayments.reduce((s, b) => s + (b.total_amount - b.deposit_paid), 0);
      items.push({
        id: "overdue-payments",
        icon: AlertTriangle,
        title: `${overduePayments.length} overdue payment${overduePayments.length > 1 ? "s" : ""}`,
        description: `₱${totalOwed.toLocaleString()} outstanding from in-house guests`,
        color: "text-destructive",
        action: () => { navigate("/balances"); setOpen(false); },
      });
    }

    // Low occupancy alert (today)
    const inHouseToday = allBookings.filter(
      (b) => b.booking_status === "Checked In" && b.check_in <= todayStr && b.check_out >= todayStr
    );
    const occupancyRate = units.length > 0 ? Math.round((inHouseToday.length / units.length) * 100) : 0;

    if (occupancyRate < 30 && units.length > 0) {
      items.push({
        id: "low-occupancy",
        icon: TrendingDown,
        title: `Low occupancy: ${occupancyRate}%`,
        description: `Only ${inHouseToday.length} of ${units.length} units occupied today`,
        color: "text-warning-orange",
        action: () => { navigate("/availability"); setOpen(false); },
      });
    }

    // Unpaid bookings arriving soon (next 3 days)
    const threeDaysStr = format(addDays(new Date(), 3), "yyyy-MM-dd");
    const unpaidArrivals = allBookings.filter(
      (b) =>
        b.check_in >= todayStr &&
        b.check_in <= threeDaysStr &&
        b.booking_status !== "Cancelled" &&
        b.payment_status === "Unpaid"
    );

    if (unpaidArrivals.length > 0) {
      items.push({
        id: "unpaid-arrivals",
        icon: AlertTriangle,
        title: `${unpaidArrivals.length} unpaid arrival${unpaidArrivals.length > 1 ? "s" : ""} in 3 days`,
        description: unpaidArrivals.map((b) => b.guest_name).join(", "),
        color: "text-warning-orange",
        action: () => { navigate("/balances"); setOpen(false); },
      });
    }

    return items;
  }, [allBookings, units, todayStr, tomorrowStr, navigate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          {notifications.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center">
              {notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-popover border-border">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Notifications</h3>
        </div>
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            All clear — no alerts right now
          </div>
        ) : (
          <div className="max-h-80 overflow-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors",
                  n.action && "cursor-pointer hover:bg-muted/30"
                )}
                onClick={n.action}
              >
                <n.icon className={cn("h-4 w-4 mt-0.5 shrink-0", n.color)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
