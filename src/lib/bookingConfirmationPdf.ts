import jsPDF from "jspdf";

interface ExtraLine {
  label: string;
  amount: number;
}

interface ConfirmationData {
  bookingRef: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  unitName: string;
  pax: number;
  paymentMethod: string | null;
  phone: string | null;
  email: string | null;
  bookingStatus: string;
  bookingSource: string;
  paymentStatus: string;
  totalAmount: number;
  depositPaid: number;
  discountGiven: number;
  discountType: string;
  discountReason: string | null;
  securityDeposit: number;
  extras: ExtraLine[];
  notes: string | null;
  hasCar: boolean;
  isDaytour: boolean;
  lateCheckout: boolean;
  earlyCheckin: boolean;
}

// Color palette
const NAVY = [20, 50, 75] as const;
const GOLD = [180, 145, 72] as const;
const DARK = [30, 41, 59] as const;
const MUTED = [100, 116, 139] as const;
const LIGHT_BG = [248, 250, 252] as const;
const WHITE = [255, 255, 255] as const;
const GREEN = [22, 101, 52] as const;
const GREEN_BG = [220, 252, 231] as const;
const GOLD_BG = [254, 249, 235] as const;

export function generateBookingConfirmationPdf(data: ConfirmationData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(); // 210
  const ph = doc.internal.pageSize.getHeight(); // 297
  const ml = 18; // left margin
  const mr = 18; // right margin
  const cw = pw - ml - mr; // content width
  let y = 0;

  // ─── HEADER BAR ───
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 38, "F");

  // Gold accent line
  doc.setFillColor(...GOLD);
  doc.rect(0, 38, pw, 1.5, "F");

  // Resort name
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("BREEZE RESORT", pw / 2, 16, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Zambales, Philippines", pw / 2, 23, { align: "center" });

  // Gold divider in header
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(pw / 2 - 30, 27, pw / 2 + 30, 27);

  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text("BOOKING CONFIRMATION", pw / 2, 33, { align: "center" });

  y = 48;

  // ─── BOOKING REFERENCE BADGE ───
  doc.setFillColor(...GOLD_BG);
  doc.roundedRect(ml, y, cw, 16, 2, 2, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(ml, y, cw, 16, 2, 2, "S");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("BOOKING REFERENCE", pw / 2, y + 5.5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text(data.bookingRef, pw / 2, y + 12.5, { align: "center" });

  y += 24;

  // ─── SECTION: GUEST & STAY DETAILS ───
  y = drawSectionHeader(doc, "GUEST & STAY DETAILS", ml, y, cw);

  const detailRows: [string, string][] = [
    ["Guest Name", data.guestName],
    ["Check-in", data.checkIn],
    ["Check-out", data.checkOut],
    ["Duration", `${data.nights} night${data.nights !== 1 ? "s" : ""}`],
    ["Unit / Room", data.unitName],
    ["Guests", `${data.pax} PAX`],
  ];

  if (data.phone) detailRows.push(["Phone", data.phone]);
  if (data.email) detailRows.push(["Email", data.email]);
  if (data.bookingSource && data.bookingSource !== "Other") {
    detailRows.push(["Booking Source", data.bookingSource]);
  }
  if (data.isDaytour) detailRows.push(["Type", "Day Tour"]);
  if (data.earlyCheckin) detailRows.push(["Early Check-in", "Yes"]);
  if (data.lateCheckout) detailRows.push(["Late Check-out", "Approved"]);
  if (data.hasCar) detailRows.push(["Vehicle", "With Car"]);

  y = drawTable(doc, detailRows, ml, y, cw);

  y += 6;

  // ─── SECTION: FINANCIAL SUMMARY ───
  y = drawSectionHeader(doc, "FINANCIAL SUMMARY", ml, y, cw);

  // Rate section
  const finRows: [string, string][] = [];

  finRows.push(["Room Rate", `₱${data.totalAmount.toLocaleString()}`]);

  // Extras
  if (data.extras.length > 0) {
    data.extras.forEach(e => {
      finRows.push([`  ${e.label}`, `₱${e.amount.toLocaleString()}`]);
    });
  }

  // Discount
  if (data.discountGiven > 0) {
    const discLabel = data.discountType === "percentage"
      ? `Discount (${data.discountGiven}%)`
      : `Discount${data.discountReason ? ` — ${data.discountReason}` : ""}`;
    const discAmount = data.discountType === "percentage"
      ? `-${data.discountGiven}%`
      : `-₱${data.discountGiven.toLocaleString()}`;
    finRows.push([discLabel, discAmount]);
  }

  // Security deposit
  if (data.securityDeposit > 0) {
    finRows.push(["Security Deposit", `₱${data.securityDeposit.toLocaleString()}`]);
  }

  y = drawTable(doc, finRows, ml, y, cw);

  // Totals summary box
  y += 2;
  const summaryBoxH = data.depositPaid > 0 ? 24 : 14;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(ml, y, cw, summaryBoxH, 2, 2, "F");

  // Grand total
  const grandTotal = data.totalAmount;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("TOTAL DUE", ml + 4, y + 8);
  doc.text(`₱${grandTotal.toLocaleString()}`, ml + cw - 4, y + 8, { align: "right" });

  if (data.depositPaid > 0) {
    const balance = Math.max(0, grandTotal - data.depositPaid);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Downpayment Received", ml + 4, y + 15);
    doc.text(`₱${data.depositPaid.toLocaleString()}`, ml + cw - 4, y + 15, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...(balance > 0 ? DARK : GREEN));
    doc.text("BALANCE", ml + 4, y + 21);
    doc.text(balance > 0 ? `₱${balance.toLocaleString()}` : "₱0 — Fully Paid", ml + cw - 4, y + 21, { align: "right" });
  }

  y += summaryBoxH + 4;

  // Payment info row
  if (data.paymentMethod || data.paymentStatus) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    if (data.paymentMethod) {
      doc.text(`Payment Method: ${data.paymentMethod}`, ml + 4, y + 3);
    }
    if (data.paymentStatus) {
      doc.text(`Status: ${data.paymentStatus}`, ml + cw - 4, y + 3, { align: "right" });
    }
    y += 8;
  }

  // ─── NOTES ───
  if (data.notes) {
    y += 2;
    y = drawSectionHeader(doc, "NOTES", ml, y, cw);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    const noteLines = doc.splitTextToSize(data.notes, cw - 8);
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(ml, y, cw, noteLines.length * 4.5 + 6, 2, 2, "F");
    doc.text(noteLines, ml + 4, y + 5);
    y += noteLines.length * 4.5 + 8;
  }

  // ─── STATUS BADGE ───
  y += 4;
  doc.setFillColor(...GREEN_BG);
  doc.roundedRect(ml, y, cw, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GREEN);
  const statusText = data.bookingStatus === "Checked In" ? "CHECKED IN"
    : data.bookingStatus === "Checked Out" ? "CHECKED OUT"
    : data.bookingStatus.toUpperCase();
  doc.text(`✓  ${statusText}`, pw / 2, y + 8, { align: "center" });

  y += 20;

  // ─── FOOTER NOTE ───
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const note = "Please present this confirmation upon check-in. For questions or changes, contact us through our Facebook page or email.";
  const footLines = doc.splitTextToSize(note, cw);
  doc.text(footLines, pw / 2, y, { align: "center" });

  // ─── BOTTOM BAR ───
  doc.setFillColor(...NAVY);
  doc.rect(0, ph - 10, pw, 10, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, ph - 10, pw, 0.8, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(7);
  doc.text("Breeze Resort Zambales  •  This is a computer-generated document", pw / 2, ph - 3.5, { align: "center" });

  doc.save(`Booking-${data.bookingRef}.pdf`);
}

// ─── HELPERS ───

function drawSectionHeader(doc: jsPDF, title: string, x: number, y: number, w: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text(title, x, y + 3);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(x, y + 5, x + w, y + 5);
  return y + 9;
}

function drawTable(doc: jsPDF, rows: [string, string][], x: number, y: number, w: number): number {
  const rowH = 8;
  rows.forEach(([label, value], i) => {
    const ry = y + i * rowH;

    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT_BG);
      doc.rect(x, ry, w, rowH, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(label, x + 4, ry + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);

    // Check for discount (negative)
    if (value.startsWith("-")) {
      doc.setTextColor(180, 145, 72); // gold for discounts
    }

    doc.text(value, x + w - 4, ry + 5.5, { align: "right" });
  });
  return y + rows.length * rowH;
}
