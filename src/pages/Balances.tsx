import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { useBookings, type Booking } from "@/hooks/useBookings";
import { useUnits } from "@/hooks/useUnits";
import { BookingModal } from "@/components/BookingModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, AlertTriangle, Download } from "lucide-react";
import { downloadCsv } from "@/lib/csvExport";
import { cn } from "@/lib/utils";

function getPaymentBadgeClass(status: string) {
  switch (status) {
    case "Partial DP": return "bg-warning-orange/20 text-warning-orange border-warning-orange/30";
    case "Unpaid": return "bg-destructive/20 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export default function BalancesPage() {
  const { data: allBookings = [], isLoading: bookingsLoading } = useBookings();
  const { data: units = [], isLoading: unitsLoading } = useUnits();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);

  const pendingBookings = useMemo(() => {
    return allBookings
      .filter((b) => {
        if ((b as any).is_primary === false) return false;
        return b.booking_status !== "Cancelled" && (b.payment_status === "Unpaid" || b.payment_status === "Partial DP");
      })
      .sort((a, b) => a.check_in.localeCompare(b.check_in));
  }, [allBookings]);

  const totalOutstanding = pendingBookings.reduce((sum, b) => sum + (b.total_amount - b.deposit_paid), 0);
  const totalUnpaid = pendingBookings.filter((b) => b.payment_status === "Unpaid").length;
  const totalPartial = pendingBookings.filter((b) => b.payment_status === "Partial DP").length;

  const isLoading = bookingsLoading || unitsLoading;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0 gap-1">
          <h1 className="text-xl sm:text-3xl font-display text-foreground tracking-wide">Pending Balances</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                const headers = ["Guest", "Ref", "Unit", "Check-in", "Check-out", "Total", "Deposit", "Balance", "Payment Status"];
                const rows = pendingBookings.map((b) => [
                  b.guest_name, b.booking_ref, unitMap.get(b.unit_id ?? "") ?? "",
                  b.check_in, b.check_out, String(b.total_amount), String(b.deposit_paid),
                  String(b.total_amount - b.deposit_paid), b.payment_status,
                ]);
                downloadCsv("pending-balances.csv", headers, rows);
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Export
            </Button>
            <span className="text-xs sm:text-sm text-muted-foreground">{pendingBookings.length} bookings</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <span className="text-muted-foreground text-sm">Loading...</span>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 px-4 sm:px-6 py-4 border-b border-border shrink-0">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Outstanding</span>
                </div>
                <div className="text-2xl font-display text-foreground">₱{totalOutstanding.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Fully Unpaid</span>
                </div>
                <div className="text-2xl font-display text-foreground">{totalUnpaid}</div>
                <div className="text-xs text-muted-foreground mt-0.5">bookings</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-warning-orange" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Partial Deposits</span>
                </div>
                <div className="text-2xl font-display text-foreground">{totalPartial}</div>
                <div className="text-xs text-muted-foreground mt-0.5">bookings</div>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-card border-b border-border hover:bg-card">
                    <TableHead className="text-xs text-muted-foreground font-medium">Guest</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium">Unit</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium">Stay</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium">Payment</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium text-right">Total</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium text-right">Deposit</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingBookings.map((booking) => {
                    const balance = booking.total_amount - booking.deposit_paid;
                    return (
                      <TableRow
                        key={booking.id}
                        className="cursor-pointer hover:bg-muted/20 border-b border-border"
                        onClick={() => { setSelectedBooking(booking); setModalOpen(true); }}
                      >
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">{booking.guest_name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{booking.booking_ref}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{unitMap.get(booking.unit_id ?? "") ?? "—"}</TableCell>
                        <TableCell className="text-xs text-foreground">
                          {format(parseISO(booking.check_in), "MMM d")} → {format(parseISO(booking.check_out), "MMM d")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getPaymentBadgeClass(booking.payment_status))}>
                            {booking.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-foreground text-right">₱{booking.total_amount.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-muted-foreground text-right">₱{booking.deposit_paid.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-destructive text-right font-semibold">₱{balance.toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                  {pendingBookings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                        🎉 No pending balances — all caught up!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <BookingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        booking={selectedBooking}
      />
    </AppLayout>
  );
}
