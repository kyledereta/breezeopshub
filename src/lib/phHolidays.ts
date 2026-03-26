// Philippine holidays (regular & special non-working) for 2025–2027
// Format: "MM-DD" for fixed, "YYYY-MM-DD" for movable (Holy Week, Eid, etc.)

interface PHHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  short: string; // abbreviated for grid display
}

const FIXED_HOLIDAYS: { month: number; day: number; name: string; short: string }[] = [
  { month: 1, day: 1, name: "New Year's Day", short: "NY" },
  { month: 2, day: 25, name: "EDSA Revolution Anniversary", short: "EDSA" },
  { month: 4, day: 9, name: "Araw ng Kagitingan", short: "Kagit" },
  { month: 5, day: 1, name: "Labor Day", short: "Labor" },
  { month: 6, day: 12, name: "Independence Day", short: "Indep" },
  { month: 8, day: 21, name: "Ninoy Aquino Day", short: "Ninoy" },
  { month: 8, day: 25, name: "National Heroes Day", short: "Heroes" },
  { month: 11, day: 1, name: "All Saints' Day", short: "Saints" },
  { month: 11, day: 2, name: "All Souls' Day", short: "Souls" },
  { month: 11, day: 30, name: "Bonifacio Day", short: "Bonif" },
  { month: 12, day: 8, name: "Immaculate Conception", short: "Imm" },
  { month: 12, day: 24, name: "Christmas Eve", short: "Xmas Eve" },
  { month: 12, day: 25, name: "Christmas Day", short: "Xmas" },
  { month: 12, day: 30, name: "Rizal Day", short: "Rizal" },
  { month: 12, day: 31, name: "New Year's Eve", short: "NYE" },
];

// Movable holidays by year
const MOVABLE_HOLIDAYS: Record<number, { date: string; name: string; short: string }[]> = {
  2025: [
    { date: "2025-01-29", name: "Chinese New Year", short: "CNY" },
    { date: "2025-04-17", name: "Maundy Thursday", short: "Maundy" },
    { date: "2025-04-18", name: "Good Friday", short: "GoodFri" },
    { date: "2025-04-19", name: "Black Saturday", short: "BlackSat" },
  ],
  2026: [
    { date: "2026-02-17", name: "Chinese New Year", short: "CNY" },
    { date: "2026-04-02", name: "Maundy Thursday", short: "Maundy" },
    { date: "2026-04-03", name: "Good Friday", short: "GoodFri" },
    { date: "2026-04-04", name: "Black Saturday", short: "BlackSat" },
  ],
  2027: [
    { date: "2027-02-06", name: "Chinese New Year", short: "CNY" },
    { date: "2027-03-25", name: "Maundy Thursday", short: "Maundy" },
    { date: "2027-03-26", name: "Good Friday", short: "GoodFri" },
    { date: "2027-03-27", name: "Black Saturday", short: "BlackSat" },
  ],
};

export function getPHHolidaysForMonth(year: number, month: number): Map<string, PHHoliday> {
  const map = new Map<string, PHHoliday>();

  // Fixed holidays
  for (const h of FIXED_HOLIDAYS) {
    if (h.month === month + 1) {
      const dateStr = `${year}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`;
      map.set(dateStr, { date: dateStr, name: h.name, short: h.short });
    }
  }

  // Movable holidays
  const movable = MOVABLE_HOLIDAYS[year] || [];
  for (const h of movable) {
    const d = new Date(h.date);
    if (d.getMonth() === month && d.getFullYear() === year) {
      map.set(h.date, { date: h.date, name: h.name, short: h.short });
    }
  }

  return map;
}

export function isHoliday(dateStr: string, holidayMap: Map<string, PHHoliday>): PHHoliday | undefined {
  return holidayMap.get(dateStr);
}
