import { useMemo } from "react"; // revenue-v2
import { format, parseISO, startOfMonth, addMonths, startOfYear } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { useBookings, type Booking } from "@/hooks/useBookings";
import { useUnits } from "@/hooks/useUnits";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { Banknote, TrendingUp, CalendarCheck, Users, UtensilsCrossed, ShieldMinus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csvExport";

const CHART_COLORS = {
  primary: "hsl(38, 55%, 51%)",
  ocean: "hsl(200, 50%, 36%)",
  coral: "hsl(14, 69%, 50%)",
  pink: "hsl(340, 65%, 55%)",
  muted: "hsl(156, 10%, 55%)",
  green: "hsl(156, 32%, 40%)",
};

const SOURCE_COLORS: Record<string, string> = {
  "Facebook Direct": CHART_COLORS.ocean,
  "Airbnb": CHART_COLORS.pink,
  "Walk-in": CHART_COLORS.coral,
  "Referral": CHART_COLORS.green,
  "Instagram": "#E1306C",
  "TikTok": "#69C9D0",
  "Other": CHART_COLORS.muted,
};

export default function RevenuePage() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: allBookings = [], isLoading: bookingsLoading } = useBookings();
  const { data: units = [], isLoading: unitsLoading } = useUnits();

  // Build 12-month revenue + occupancy data
  const monthlyData = useMemo(() => {
    const now = new Date();
    const yearStart = startOfYear(now);
    const months: { month: string; label: string; revenue: number; bookings: number; occupiedNights: number; totalNights: number }[] = [];

    for (let i = 0; i < 12; i++) {
      const m = addMonths(yearStart, i);
      const mStr = format(m, "yyyy-MM");
      const label = format(m, "MMM");
      const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();

      let revenue = 0;
      let bookingCount = 0;
      let occupiedNights = 0;

      for (const b of allBookings) {
        if (b.booking_status === "Cancelled") continue;
        const ciMonth = b.check_in.substring(0, 7);
        // Attribute revenue to check-in month
        if (ciMonth === mStr) {
          revenue += b.total_amount;
          bookingCount++;
        }
        // Calculate occupied nights in this month
        const ci = parseISO(b.check_in);
        const co = parseISO(b.check_out);
        const mStart = m;
        const mEnd = addMonths(m, 1);
        const overlapStart = ci > mStart ? ci : mStart;
        const overlapEnd = co < mEnd ? co : mEnd;
        if (overlapStart < overlapEnd) {
          occupiedNights += Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      const totalNights = daysInMonth * units.length;
      months.push({ month: mStr, label, revenue, bookings: bookingCount, occupiedNights, totalNights });
    }

    return months;
  }, [allBookings, units]);

  // Source breakdown
  const sourceData = useMemo(() => {
    const counts: Record<string, { count: number; revenue: number }> = {};
    for (const b of allBookings) {
      if (b.booking_status === "Cancelled") continue;
      if (!counts[b.booking_source]) counts[b.booking_source] = { count: 0, revenue: 0 };
      counts[b.booking_source].count++;
      counts[b.booking_source].revenue += b.total_amount;
    }
    return Object.entries(counts)
      .map(([name, { count, revenue }]) => ({ name, count, revenue, color: SOURCE_COLORS[name] || CHART_COLORS.muted }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [allBookings]);

  // Summary stats
  const currentMonth = format(new Date(), "yyyy-MM");
  const currentMonthData = monthlyData.find((m) => m.month === currentMonth);
  const activeBookings = allBookings.filter((b) => b.booking_status !== "Cancelled");
  const totalRevenue = activeBookings.reduce((s, b) => s + b.total_amount, 0);
  const totalDepositDeducted = activeBookings.reduce((s, b) => s + ((b as any).deposit_deducted_amount ?? 0), 0);
  const totalUtensilRevenue = activeBookings.reduce((s, b) => s + ((b as any).utensil_rental_fee ?? 0), 0);
  const currentOccupancy = currentMonthData && currentMonthData.totalNights > 0
    ? Math.round((currentMonthData.occupiedNights / currentMonthData.totalNights) * 100)
    : 0;

  // ADR: Total revenue ÷ occupied room-nights (this month)
  const currentADR = currentMonthData && currentMonthData.occupiedNights > 0
    ? Math.round(currentMonthData.revenue / currentMonthData.occupiedNights)
    : 0;

  // RevPAR: Total revenue ÷ total available room-nights (this month)
  const currentRevPAR = currentMonthData && currentMonthData.totalNights > 0
    ? Math.round(currentMonthData.revenue / currentMonthData.totalNights)
    : 0;

  const isLoading = bookingsLoading || unitsLoading;

  const CustomTooltipContent = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-xs">
        <div className="font-medium text-foreground mb-1">{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span>{p.name}: {
              p.dataKey === "revenue" || p.dataKey === "adr" || p.dataKey === "revpar"
                ? `₱${p.value.toLocaleString()}`
                : p.dataKey === "occupancy"
                  ? `${p.value}%`
                  : p.value
            }</span>
          </div>
        ))}
      </div>
    );
  };

  // Enhanced monthly data with ADR and RevPAR
  const enrichedMonthlyData = useMemo(() => {
    return monthlyData.map((m) => ({
      ...m,
      occupancy: m.totalNights > 0 ? Math.round((m.occupiedNights / m.totalNights) * 100) : 0,
      adr: m.occupiedNights > 0 ? Math.round(m.revenue / m.occupiedNights) : 0,
      revpar: m.totalNights > 0 ? Math.round(m.revenue / m.totalNights) : 0,
    }));
  }, [monthlyData]);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0">
          <h1 className="text-xl sm:text-3xl font-display text-foreground tracking-wide">Revenue Dashboard</h1>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => {
              const headers = ["Month", "Revenue", "Bookings", "Occupancy %", "ADR", "RevPAR"];
              const rows = enrichedMonthlyData.map((m) => [
                m.month, String(m.revenue), String(m.bookings), String(m.occupancy), String(m.adr), String(m.revpar),
              ]);
              downloadCsv("revenue.csv", headers, rows);
            }}
          >
            <Download className="h-3.5 w-3.5 mr-1" /> Export
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <span className="text-muted-foreground text-sm">Loading...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard icon={Banknote} label="This Month" value={`₱${(currentMonthData?.revenue ?? 0).toLocaleString()}`} sub={`${currentMonthData?.bookings ?? 0} bookings`} />
              <StatCard icon={TrendingUp} label="All-Time Revenue" value={`₱${totalRevenue.toLocaleString()}`} sub={`${activeBookings.length} total bookings`} />
              <StatCard icon={CalendarCheck} label="Occupancy Rate" value={`${currentOccupancy}%`} sub={`${currentMonthData?.occupiedNights ?? 0} of ${currentMonthData?.totalNights ?? 0} unit-nights`} />
              <StatCard icon={Banknote} label="ADR" value={`₱${currentADR.toLocaleString()}`} sub="Avg revenue per occupied room" />
              <StatCard icon={TrendingUp} label="RevPAR" value={`₱${currentRevPAR.toLocaleString()}`} sub="Revenue per available room" />
              <StatCard icon={ShieldMinus} label="Deposit Deducted" value={`₱${totalDepositDeducted.toLocaleString()}`} sub="From security deposits" />
              <StatCard icon={UtensilsCrossed} label="Utensil Rental" value={`₱${totalUtensilRevenue.toLocaleString()}`} sub="Total utensil rental fees" />
              <StatCard icon={Users} label="Top Source" value={sourceData[0]?.name ?? "—"} sub={sourceData[0] ? `₱${sourceData[0].revenue.toLocaleString()}` : ""} />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Monthly Revenue */}
              <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">Monthly Revenue (12 Months)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(156, 18%, 24%)" />
                    <XAxis dataKey="label" tick={{ fill: "hsl(156, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(156, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip content={<CustomTooltipContent />} />
                    <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Source Breakdown */}
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">Booking Sources</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      paddingAngle={2}
                    >
                      {sourceData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-popover border border-border rounded-lg p-2 shadow-xl text-xs">
                          <div className="font-medium text-foreground">{d.name}</div>
                          <div className="text-muted-foreground">₱{d.revenue.toLocaleString()} · {d.count} bookings</div>
                        </div>
                      );
                    }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {sourceData.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-muted-foreground">{s.name}</span>
                      </div>
                      <span className="text-foreground font-medium">₱{s.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ADR & RevPAR Trend */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">ADR & RevPAR Trend (12 Months)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={enrichedMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(156, 18%, 24%)" />
                  <XAxis dataKey="label" tick={{ fill: "hsl(156, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(156, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip content={<CustomTooltipContent />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "hsl(156, 10%, 55%)" }} />
                  <Line type="monotone" dataKey="adr" name="ADR" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ fill: CHART_COLORS.primary, r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="revpar" name="RevPAR" stroke={CHART_COLORS.ocean} strokeWidth={2} dot={{ fill: CHART_COLORS.ocean, r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Occupancy Trend */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">Occupancy Trend (12 Months)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={enrichedMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(156, 18%, 24%)" />
                  <XAxis dataKey="label" tick={{ fill: "hsl(156, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(156, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                  <RechartsTooltip content={<CustomTooltipContent />} />
                  <Line type="monotone" dataKey="occupancy" name="Occupancy" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ fill: CHART_COLORS.primary, r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="bookings" name="Bookings" stroke={CHART_COLORS.ocean} strokeWidth={2} dot={{ fill: CHART_COLORS.ocean, r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium truncate">{label}</span>
      </div>
      <div className="text-lg sm:text-xl font-display text-foreground truncate">{value}</div>
      <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{sub}</div>
    </div>
  );
}
