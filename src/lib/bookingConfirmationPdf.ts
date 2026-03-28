import jsPDF from "jspdf";

interface ConfirmationData {
  bookingRef: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  unitName: string;
  pax: number;
  paymentMethod: string | null;
  phone: string | null;
  email: string | null;
}

export function generateBookingConfirmationPdf(data: ConfirmationData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header bar
  doc.setFillColor(30, 64, 94); // deep navy
  doc.rect(0, 0, pageWidth, 42, "F");

  // Resort name
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("BREEZE RESORT", pageWidth / 2, 18, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Zambales, Philippines", pageWidth / 2, 26, { align: "center" });

  doc.setFontSize(9);
  doc.text("BOOKING CONFIRMATION", pageWidth / 2, 34, { align: "center" });

  y = 56;

  // Booking ref badge
  doc.setFillColor(236, 243, 249);
  doc.roundedRect(margin, y - 6, contentWidth, 18, 3, 3, "F");
  doc.setTextColor(30, 64, 94);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Booking Reference: ${data.bookingRef}`, pageWidth / 2, y + 4, { align: "center" });

  y += 24;

  // Details table
  const rows: [string, string][] = [
    ["Guest Name", data.guestName],
    ["Check-in Date", data.checkIn],
    ["Check-out Date", data.checkOut],
    ["Unit / Room", data.unitName],
    ["Number of Guests", `${data.pax} PAX`],
  ];

  if (data.paymentMethod) {
    rows.push(["Payment Method", data.paymentMethod]);
  }
  if (data.phone) {
    rows.push(["Contact Number", data.phone]);
  }
  if (data.email) {
    rows.push(["Email", data.email]);
  }

  const rowHeight = 12;
  const labelWidth = 55;

  rows.forEach(([label, value], i) => {
    const rowY = y + i * rowHeight;

    // Alternating row bg
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, rowY - 4, contentWidth, rowHeight, "F");
    }

    // Label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin + 4, rowY + 3);

    // Value
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(value, margin + labelWidth, rowY + 3);
  });

  y += rows.length * rowHeight + 12;

  // Status badge
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(margin, y, contentWidth, 14, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(22, 101, 52);
  doc.text("✓  CONFIRMED", pageWidth / 2, y + 9, { align: "center" });

  y += 26;

  // Footer note
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const note = "Please present this confirmation upon check-in. For questions or changes, contact us through our Facebook page or email.";
  const lines = doc.splitTextToSize(note, contentWidth);
  doc.text(lines, pageWidth / 2, y, { align: "center" });

  // Bottom bar
  doc.setFillColor(30, 64, 94);
  doc.rect(0, doc.internal.pageSize.getHeight() - 12, pageWidth, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text("Breeze Resort Zambales • This is a computer-generated document", pageWidth / 2, doc.internal.pageSize.getHeight() - 4, { align: "center" });

  doc.save(`Booking-${data.bookingRef}.pdf`);
}
