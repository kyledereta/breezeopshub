import jsPDF from "jspdf";
import { format } from "date-fns";
import type { Booking } from "@/hooks/useBookings";

// Color palette
const NAVY: [number, number, number] = [20, 50, 75];
const GOLD: [number, number, number] = [180, 145, 72];
const DARK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const LIGHT_BG: [number, number, number] = [248, 250, 252];
const WHITE: [number, number, number] = [255, 255, 255];
const WARNING: [number, number, number] = [234, 88, 12];
const PRIMARY: [number, number, number] = [22, 101, 52];
const PRIMARY_BG: [number, number, number] = [220, 252, 231];

interface ReportData {
  arrivals: Booking[];
  checkedIn: Booking[];
  inHouse: Booking[];
  departures: Booking[];
  checkedOut: Booking[];
  daytours: Booking[];
  revenueToday: number;
  occupancy: number;
  occupiedUnitIds: Set<string>;
  availableUnits: number;
  totalPax: number;
  pendingBalances: { booking: Booking; amount: number }[];
  totalPendingAmount: number;
  continuedBookings: Booking[];
  activeGroups: { groupId: string; bookings: Booking[] }[];
  extrasCollected: { booking: Booking; extras: { name: string; amount: number }[] }[];
  totalExtrasAmount: number;
  depositDeductions: { booking: Booking; amount: number; reason: string }[];
  takeaways: string[];
}

interface PdfInput {
  todayStr: string;
  report: ReportData;
  unitMap: Map<string, string>;
  totalUnits: number;
}

export function generateTodayReportPdf({ todayStr, report, unitMap, totalUnits }: PdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 14;
  const mr = 14;
  const cw = pw - ml - mr;
  let y = 0;

  const checkPage = (needed: number) => {
    if (y + needed > ph - 18) {
      drawFooter(doc, pw, ph);
      doc.addPage();
      y = 14;
    }
  };

  // ─── HEADER ───
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 30, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 30, pw, 1.2, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("BREEZE RESORT", pw / 2, 12, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Daily Operations Report", pw / 2, 19, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(format(new Date(), "EEEE, MMMM d, yyyy"), pw / 2, 26, { align: "center" });

  y = 38;

  // ─── OVERVIEW STATS ───
  const statW = cw / 4;
  const stats = [
    { label: "OCCUPANCY", value: `${report.occupancy}%` },
    { label: "PAX IN-HOUSE", value: String(report.totalPax) },
    { label: "REVENUE", value: `P${report.revenueToday.toLocaleString()}` },
    { label: "PENDING", value: `P${report.totalPendingAmount.toLocaleString()}` },
  ];

  stats.forEach((s, i) => {
    const sx = ml + i * statW;
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(sx + 1, y, statW - 2, 16, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(s.value, sx + statW / 2, y + 7, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    doc.text(s.label, sx + statW / 2, y + 13, { align: "center" });
  });

  y += 22;

  // ─── ARRIVALS ───
  y = drawSection(doc, "ARRIVALS", `${report.checkedIn.length} of ${report.arrivals.length} checked in`, ml, y, cw);
  checkPage(10);
  if (report.arrivals.length === 0) {
    y = drawEmptyRow(doc, "No arrivals today", ml, y, cw);
  } else {
    for (const b of report.arrivals) {
      checkPage(9);
      y = drawBookingRow(doc, b, unitMap, ml, y, cw);
    }
  }

  y += 3;

  // ─── IN-HOUSE ───
  y = drawSection(doc, "IN-HOUSE", `${report.inHouse.length} bookings | ${report.totalPax} pax`, ml, y, cw);
  checkPage(10);
  if (report.inHouse.length === 0) {
    y = drawEmptyRow(doc, "No guests in-house", ml, y, cw);
  } else {
    for (const b of report.inHouse) {
      checkPage(9);
      y = drawBookingRow(doc, b, unitMap, ml, y, cw);
    }
  }

  y += 3;

  // ─── DEPARTURES ───
  y = drawSection(doc, "DEPARTURES", `${report.checkedOut.length} of ${report.departures.length} checked out`, ml, y, cw);
  checkPage(10);
  if (report.departures.length === 0) {
    y = drawEmptyRow(doc, "No departures today", ml, y, cw);
  } else {
    for (const b of report.departures) {
      checkPage(9);
      y = drawBookingRow(doc, b, unitMap, ml, y, cw);
    }
  }

  y += 3;

  // ─── DAY TOURS ───
  if (report.daytours.length > 0) {
    y = drawSection(doc, "DAY TOURS", `${report.daytours.length} bookings`, ml, y, cw);
    for (const b of report.daytours) {
      checkPage(9);
      y = drawBookingRow(doc, b, unitMap, ml, y, cw);
    }
    y += 3;
  }

  // ─── CONTINUED STAYS ───
  if (report.continuedBookings.length > 0) {
    checkPage(16);
    y = drawSection(doc, "CONTINUED STAYS", `${report.continuedBookings.length} movements`, ml, y, cw);
    for (const b of report.continuedBookings) {
      checkPage(9);
      const uName = unitMap.get(b.unit_id ?? "") ?? "—";
      const direction = b.check_in === todayStr ? "Arriving (continued)" : "Departing (continued)";
      y = drawSimpleRow(doc, `${b.guest_name} — ${uName}`, direction, ml, y, cw);
    }
    y += 3;
  }

  // ─── GROUP BOOKINGS ───
  if (report.activeGroups.length > 0) {
    checkPage(20);
    y = drawSection(doc, "GROUP BOOKINGS", `${report.activeGroups.length} groups`, ml, y, cw);
    for (const { bookings: gbs } of report.activeGroups) {
      const primary = gbs.find((b) => b.is_primary) || gbs[0];
      const unitNames = gbs.map((b) => unitMap.get(b.unit_id ?? "") ?? "—").join(", ");
      const totalAmt = gbs.reduce((s, b) => s + b.total_amount, 0);
      checkPage(14);
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(ml, y, cw, 12, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.text(primary.guest_name, ml + 3, y + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(`${gbs.length} units: ${unitNames}`, ml + 3, y + 9.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.text(`P${totalAmt.toLocaleString()}`, ml + cw - 3, y + 7, { align: "right" });
      y += 14;
    }
    y += 3;
  }

  // ─── EXTRAS / ADD-ONS ───
  if (report.extrasCollected.length > 0) {
    checkPage(20);
    y = drawSection(doc, "EXTRAS / ADD-ONS", `P${report.totalExtrasAmount.toLocaleString()} total`, ml, y, cw);
    for (const { booking: b, extras } of report.extrasCollected) {
      const rowH = 6 + extras.length * 4;
      checkPage(rowH + 2);
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(ml, y, cw, rowH, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.text(b.guest_name, ml + 3, y + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(unitMap.get(b.unit_id ?? "") ?? "—", ml + cw - 3, y + 4, { align: "right" });
      let ey = y + 8;
      for (const e of extras) {
        doc.text(e.name, ml + 5, ey);
        doc.text(`P${e.amount.toLocaleString()}`, ml + cw - 5, ey, { align: "right" });
        ey += 4;
      }
      y += rowH + 2;
    }
    y += 3;
  }

  // ─── DEPOSIT DEDUCTIONS ───
  if (report.depositDeductions.length > 0) {
    const totalDeducted = report.depositDeductions.reduce((s, d) => s + d.amount, 0);
    checkPage(20);
    y = drawSection(doc, "DEPOSIT DEDUCTIONS", `P${totalDeducted.toLocaleString()} from ${report.depositDeductions.length} bookings`, ml, y, cw);
    for (const { booking: b, amount, reason } of report.depositDeductions) {
      checkPage(12);
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(ml, y, cw, 10, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.text(b.guest_name, ml + 3, y + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      const uName = unitMap.get(b.unit_id ?? "") ?? "—";
      doc.text(`${uName} | ${reason}`, ml + 3, y + 8.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(220, 38, 38);
      doc.text(`P${amount.toLocaleString()}`, ml + cw - 3, y + 6.5, { align: "right" });
      y += 12;
    }
    y += 3;
  }

  // ─── PENDING BALANCES ───
  if (report.pendingBalances.length > 0) {
    checkPage(20);
    y = drawSection(doc, "PENDING BALANCES", `P${report.totalPendingAmount.toLocaleString()} from ${report.pendingBalances.length} bookings`, ml, y, cw);
    for (const { booking: b, amount } of report.pendingBalances) {
      checkPage(9);
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(ml, y, cw, 8, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.text(b.guest_name, ml + 3, y + 5.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...WARNING);
      doc.text(`P${amount.toLocaleString()}`, ml + cw - 3, y + 5.5, { align: "right" });
      y += 10;
    }
    y += 3;
  }

  // ─── REVENUE & OCCUPANCY SUMMARY ───
  checkPage(40);
  y = drawSection(doc, "REVENUE & OCCUPANCY SUMMARY", "", ml, y, cw);

  const summaryRows: [string, string][] = [
    ["Today's Revenue", `P${report.revenueToday.toLocaleString()}`],
    ["Extras / Add-ons", `P${report.totalExtrasAmount.toLocaleString()}`],
    ["Pending Collections", `P${report.totalPendingAmount.toLocaleString()}`],
    ["Occupancy Rate", `${report.occupancy}%`],
    ["Units Occupied", `${report.occupiedUnitIds.size} / ${totalUnits}`],
    ["Total Pax In-House", String(report.totalPax)],
  ];

  for (let i = 0; i < summaryRows.length; i++) {
    const ry = y + i * 7;
    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT_BG);
      doc.rect(ml, ry, cw, 7, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(summaryRows[i][0], ml + 3, ry + 5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(summaryRows[i][1], ml + cw - 3, ry + 5, { align: "right" });
  }

  y += summaryRows.length * 7 + 4;

  // ─── KEY TAKEAWAYS ───
  if (report.takeaways.length > 0) {
    checkPage(14 + report.takeaways.length * 5);
    doc.setFillColor(...PRIMARY_BG);
    const takeawayH = 8 + report.takeaways.length * 5;
    doc.roundedRect(ml, y, cw, takeawayH, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PRIMARY);
    doc.text("KEY TAKEAWAYS", ml + 4, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...DARK);
    report.takeaways.forEach((t, i) => {
      doc.text(`•  ${t}`, ml + 5, y + 10 + i * 5);
    });

    y += takeawayH + 4;
  }

  // Footer
  drawFooter(doc, pw, ph);

  doc.save(`Daily-Report-${todayStr}.pdf`);
}

// ─── HELPERS ───

function drawFooter(doc: jsPDF, pw: number, ph: number) {
  doc.setFillColor(...NAVY);
  doc.rect(0, ph - 8, pw, 8, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, ph - 8, pw, 0.6, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(6);
  doc.text(
    `Breeze Resort Zambales  •  Generated ${format(new Date(), "MMM d, yyyy h:mm a")}  •  Confidential`,
    pw / 2,
    ph - 2.5,
    { align: "center" }
  );
}

function drawSection(doc: jsPDF, title: string, summary: string, x: number, y: number, w: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text(title, x, y + 3);
  if (summary) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(summary, x + w, y + 3, { align: "right" });
  }
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(x, y + 5, x + w, y + 5);
  return y + 9;
}

function drawBookingRow(doc: jsPDF, b: Booking, unitMap: Map<string, string>, x: number, y: number, w: number): number {
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(x, y, w, 8, 1, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text(b.guest_name, x + 3, y + 5.5);

  const unitName = unitMap.get(b.unit_id ?? "") ?? "—";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  const mid = x + w * 0.5;
  doc.text(`${unitName} | ${b.pax} pax`, mid, y + 5.5);

  doc.setFontSize(6.5);
  const statusText = `${b.payment_status} | ${b.booking_status}`;
  doc.text(statusText, x + w - 3, y + 5.5, { align: "right" });

  return y + 9.5;
}

function drawEmptyRow(doc: jsPDF, text: string, x: number, y: number, _w: number): number {
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(text, x + 3, y + 4);
  return y + 7;
}

function drawSimpleRow(doc: jsPDF, left: string, right: string, x: number, y: number, w: number): number {
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(x, y, w, 8, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text(left, x + 3, y + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(right, x + w - 3, y + 5.5, { align: "right" });
  return y + 9.5;
}
