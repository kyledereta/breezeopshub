import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  parseISO,
  isSameDay,
  isWithinInterval,
  isWeekend,
} from "date-fns";
import type { Booking } from "@/hooks/useBookings";
import type { Unit } from "@/hooks/useUnits";
import { groupUnitsByArea } from "@/hooks/useUnits";

// Area colors (soft fills)
const AREA_COLORS: Record<string, string> = {
  "Pool Area": "DBEAFE",      // light blue
  "Beach Area": "FEF3C7",     // light amber
  "Owner's Villa": "E0E7FF",  // light indigo
};

// Alternating unit row tints per area
const UNIT_TINTS: Record<string, [string, string]> = {
  "Pool Area": ["EFF6FF", "DBEAFE"],
  "Beach Area": ["FFFBEB", "FEF3C7"],
  "Owner's Villa": ["EEF2FF", "E0E7FF"],
};

const WEEKEND_COLOR = "F3F4F6"; // gray-100
const HEADER_COLOR = "1F2937";  // gray-800
const HEADER_BG = "F9FAFB";    // gray-50


export async function exportAvailabilityGrid(
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
      if (
        isDaytour
          ? isSameDay(day, checkIn)
          : isWithinInterval(day, { start: checkIn, end: checkOut }) &&
            !isSameDay(day, checkOut)
      ) {
        bookingMap.set(`${b.unit_id}-${format(day, "yyyy-MM-dd")}`, b);
      }
    }
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(format(currentMonth, "MMMM yyyy"));

  // Freeze first column + 2 header rows
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 2 }];

  // Column widths
  ws.getColumn(1).width = 22;
  for (let i = 0; i < days.length; i++) {
    ws.getColumn(i + 2).width = 7;
  }

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "D1D5DB" } },
    bottom: { style: "thin", color: { argb: "D1D5DB" } },
    left: { style: "thin", color: { argb: "D1D5DB" } },
    right: { style: "thin", color: { argb: "D1D5DB" } },
  };

  const headerFont: Partial<ExcelJS.Font> = {
    bold: true,
    size: 9,
    color: { argb: HEADER_COLOR },
  };

  // Row 1: Day names
  const row1 = ws.addRow(["Unit", ...days.map((d) => format(d, "EEE"))]);
  row1.height = 18;
  // Row 2: Day numbers
  const row2 = ws.addRow(["", ...days.map((d) => format(d, "d"))]);
  row2.height = 18;

  // Style header rows
  for (const r of [row1, row2]) {
    r.eachCell((cell, colNumber) => {
      cell.font = headerFont;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = thinBorder;

      if (colNumber === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
      } else {
        const day = days[colNumber - 2];
        if (day && isWeekend(day)) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WEEKEND_COLOR } };
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
        }
      }
    });
  }

  // Data rows
  for (const group of grouped) {
    const areaColor = AREA_COLORS[group.area] || "F3F4F6";
    const tints = UNIT_TINTS[group.area] || ["F9FAFB", "F3F4F6"];

    // Area header row
    const areaRow = ws.addRow([group.area]);
    ws.mergeCells(areaRow.number, 1, areaRow.number, days.length + 1);
    areaRow.height = 22;
    areaRow.getCell(1).font = { bold: true, size: 10, color: { argb: "1E3A5F" } };
    areaRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: areaColor } };
    areaRow.getCell(1).alignment = { vertical: "middle" };
    areaRow.getCell(1).border = thinBorder;

    group.units.forEach((unit, unitIdx) => {
      const rowData: (string | null)[] = [unit.name];
      const processedBookings = new Set<string>();
      const mergesToApply: { startCol: number; endCol: number }[] = [];

      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        const dateStr = format(day, "yyyy-MM-dd");
        const booking = bookingMap.get(`${unit.id}-${dateStr}`);

        if (booking && !processedBookings.has(booking.id)) {
          processedBookings.add(booking.id);
          const bal = Math.max(0, booking.total_amount - booking.deposit_paid);
          const cellText = [
            `${booking.guest_name} - ${booking.pax} pax`,
            unitIdx >= 0 ? unit.name : "",
            `DP: ₱${Number(booking.deposit_paid).toLocaleString()}`,
            `Balance: ₱${Math.max(0, bal).toLocaleString()}`,
          ].join("\n");
          rowData.push(cellText);

          // Calculate span
          const checkOut = parseISO(booking.check_out);
          const isDaytour = booking.is_daytour_booking;
          const visibleEnd = checkOut > monthEnd ? monthEnd : checkOut;
          const span = isDaytour ? 1 : Math.max(1, Math.round((visibleEnd.getTime() - day.getTime()) / 86400000));

          if (span > 1) {
            const startCol = i + 2;
            const endCol = Math.min(i + span + 1, days.length + 1);
            mergesToApply.push({ startCol, endCol });
            for (let j = 1; j < span && i + j < days.length; j++) {
              rowData.push(null);
            }
            i += span - 1;
          }
        } else {
          rowData.push("");
        }
      }

      const dataRow = ws.addRow(rowData);
      dataRow.height = 52;

      // Apply merges
      for (const m of mergesToApply) {
        ws.mergeCells(dataRow.number, m.startCol, dataRow.number, m.endCol);
      }

      // Style each cell
      const tintColor = tints[unitIdx % 2];
      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = thinBorder;
        cell.alignment = { wrapText: true, vertical: "top", horizontal: colNumber === 1 ? "left" : "center" };
        cell.font = { size: 8 };

        if (colNumber === 1) {
          cell.font = { bold: true, size: 9 };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tintColor } };
        } else {
          const val = cell.value;
          if (val && typeof val === "string" && val.includes("\n")) {
            // Find the booking to color by payment status
            const dayIdx = colNumber - 2;
            if (dayIdx >= 0 && dayIdx < days.length) {
              const dateStr = format(days[dayIdx], "yyyy-MM-dd");
              const booking = bookingMap.get(`${unit.id}-${dateStr}`);
              const payColor = booking ? PAYMENT_COLORS[booking.payment_status] : null;
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: payColor || tintColor } };
            }
          } else if (colNumber - 2 >= 0 && colNumber - 2 < days.length && isWeekend(days[colNumber - 2])) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WEEKEND_COLOR } };
          } else {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tintColor } };
          }
        }
      });
    });
  }

  // Export
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `Availability_${format(currentMonth, "yyyy-MM")}.xlsx`);
}
