import * as XLSX from "xlsx";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  parseISO,
  isSameDay,
  isWithinInterval,
  differenceInDays,
} from "date-fns";
import type { Booking } from "@/hooks/useBookings";
import type { Unit } from "@/hooks/useUnits";
import { groupUnitsByArea } from "@/hooks/useUnits";

export function exportAvailabilityGrid(
  units: Unit[],
  bookings: Booking[],
  currentMonth: Date
) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const grouped = groupUnitsByArea(units);

  // Build booking map: unitId-dateStr → booking
  const bookingMap = new Map<string, Booking>();
  for (const b of bookings) {
    const checkIn = parseISO(b.check_in);
    const checkOut = parseISO(b.check_out);
    const isDaytour = b.is_daytour_booking;
    for (const day of days) {
      if (isDaytour ? isSameDay(day, checkIn) : (isWithinInterval(day, { start: checkIn, end: checkOut }) && !isSameDay(day, checkOut))) {
        bookingMap.set(`${b.unit_id}-${format(day, "yyyy-MM-dd")}`, b);
      }
    }
  }

  // Build rows
  const rows: any[][] = [];

  // Header row 1: empty + day numbers
  const header1 = ["Unit"];
  for (const day of days) header1.push(format(day, "EEE"));
  rows.push(header1);

  const header2 = [""];
  for (const day of days) header2.push(format(day, "d"));
  rows.push(header2);

  // Track merged cells
  const merges: XLSX.Range[] = [];
  const cellStyles: Map<string, { bg?: string; bold?: boolean }> = new Map();

  let rowIdx = 2; // 0-indexed, after 2 header rows

  for (const group of grouped) {
    // Area header row
    const areaRow = [group.area, ...days.map(() => "")];
    rows.push(areaRow);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: days.length } });
    cellStyles.set(`A${rowIdx + 1}`, { bold: true });
    rowIdx++;

    for (const unit of group.units) {
      const row: any[] = [unit.name];
      const processedBookings = new Set<string>();

      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        const dateStr = format(day, "yyyy-MM-dd");
        const booking = bookingMap.get(`${unit.id}-${dateStr}`);

        if (booking && !processedBookings.has(booking.id)) {
          processedBookings.add(booking.id);
          // Build cell text with guest details
          const nights = differenceInDays(parseISO(booking.check_out), parseISO(booking.check_in));
          const parts = [
            booking.guest_name,
            `${booking.pax} pax`,
            `${nights}N`,
            `₱${Number(booking.total_amount).toLocaleString()}`,
            booking.payment_status,
            `DP: ₱${Number(booking.deposit_paid).toLocaleString()}`,
          ];
          if (booking.booking_source) parts.push(booking.booking_source);
          if (booking.phone) parts.push(booking.phone);
          row.push(parts.join(" | "));

          // Calculate span within visible month
          const checkOut = parseISO(booking.check_out);
          const isDaytour = booking.is_daytour_booking;
          const visibleEnd = checkOut > monthEnd ? monthEnd : checkOut;
          const span = isDaytour ? 1 : differenceInDays(visibleEnd, day);

          if (span > 1) {
            merges.push({
              s: { r: rowIdx, c: i + 1 },
              e: { r: rowIdx, c: Math.min(i + span, days.length) },
            });
            // Fill remaining cells of this booking with empty
            for (let j = 1; j < span && i + j < days.length; j++) {
              row.push("");
            }
            i += span - 1;
          }
        } else if (booking && processedBookings.has(booking.id)) {
          row.push("");
        } else {
          row.push("");
        }
      }
      rows.push(row);
      rowIdx++;
    }
  }

  // Create workbook
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = merges;

  // Set column widths
  ws["!cols"] = [
    { wch: 22 },
    ...days.map(() => ({ wch: 6 })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, format(currentMonth, "MMMM yyyy"));
  XLSX.writeFile(wb, `Availability_${format(currentMonth, "yyyy-MM")}.xlsx`);
}
