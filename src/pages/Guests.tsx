import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useGuests, type Guest } from "@/hooks/useGuests";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Plus, Users, Eye, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { downloadCsv } from "@/lib/csvExport";
import { GuestModal } from "@/components/GuestModal";
import { GuestProfileSheet } from "@/components/GuestProfileSheet";

const TIER_COLORS: Record<string, string> = {
  "New Guest": "bg-muted text-muted-foreground",
  "Returning": "bg-primary/20 text-primary",
  "Loyal 3+": "bg-accent text-accent-foreground",
  "VIP 5+": "bg-chart-1/20 text-chart-1",
};

type SortKey = "guest_name" | "total_stays" | "parang_dati_tier" | "location" | "guest_segment";
type SortDir = "asc" | "desc";

const TIER_ORDER: Record<string, number> = {
  "New Guest": 0,
  "Returning": 1,
  "Loyal 3+": 2,
  "VIP 5+": 3,
};

export default function GuestsPage() {
  const { data: guests = [], isLoading } = useGuests();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [profileGuest, setProfileGuest] = useState<Guest | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("guest_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const filtered = useMemo(() => {
    let list = guests;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (g) =>
          g.guest_name.toLowerCase().includes(q) ||
          g.phone?.toLowerCase().includes(q) ||
          g.email?.toLowerCase().includes(q) ||
          g.location?.toLowerCase().includes(q)
      );
    }
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "guest_name":
          cmp = a.guest_name.localeCompare(b.guest_name);
          break;
        case "total_stays":
          cmp = a.total_stays - b.total_stays;
          break;
        case "parang_dati_tier":
          cmp = (TIER_ORDER[a.parang_dati_tier] ?? 0) - (TIER_ORDER[b.parang_dati_tier] ?? 0);
          break;
        case "location":
          cmp = (a.location || "").localeCompare(b.location || "");
          break;
        case "guest_segment":
          cmp = (a.guest_segment || "").localeCompare(b.guest_segment || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [guests, search, sortKey, sortDir]);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0">
          <h1 className="text-xl sm:text-3xl font-display text-foreground tracking-wide">Guest Database</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                const headers = ["Name", "Phone", "Email", "Location", "Stays", "Tier", "Segment"];
                const rows = filtered.map((g) => [
                  g.guest_name, g.phone || "", g.email || "", g.location || "",
                  String(g.total_stays), g.parang_dati_tier, g.guest_segment || "",
                ]);
                downloadCsv("guests.csv", headers, rows);
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Export
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => { setEditingGuest(null); setModalOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Guest
            </Button>
          </div>
        </div>

        {/* Search & Stats */}
        <div className="px-4 sm:px-6 py-3 border-b border-border shrink-0 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search guests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{guests.length} guests</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-muted-foreground text-sm">Loading...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead
                    className="text-muted-foreground cursor-pointer select-none"
                    onClick={() => toggleSort("guest_name")}
                  >
                    <span className="flex items-center">Name <SortIcon col="guest_name" /></span>
                  </TableHead>
                  <TableHead className="text-muted-foreground">Phone</TableHead>
                  <TableHead className="text-muted-foreground">Email</TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer select-none"
                    onClick={() => toggleSort("location")}
                  >
                    <span className="flex items-center">Location <SortIcon col="location" /></span>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground text-center cursor-pointer select-none"
                    onClick={() => toggleSort("total_stays")}
                  >
                    <span className="flex items-center justify-center">Stays <SortIcon col="total_stays" /></span>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer select-none"
                    onClick={() => toggleSort("parang_dati_tier")}
                  >
                    <span className="flex items-center">Tier <SortIcon col="parang_dati_tier" /></span>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer select-none"
                    onClick={() => toggleSort("guest_segment")}
                  >
                    <span className="flex items-center">Segment <SortIcon col="guest_segment" /></span>
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      {search ? "No guests match your search" : "No guests yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((guest) => (
                    <TableRow
                      key={guest.id}
                      className="border-border hover:bg-muted/30 cursor-pointer"
                      onClick={() => setProfileGuest(guest)}
                    >
                      <TableCell className="font-medium text-foreground">{guest.guest_name}</TableCell>
                      <TableCell className="text-muted-foreground">{guest.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{guest.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{guest.location || "—"}</TableCell>
                      <TableCell className="text-center text-foreground">{guest.total_stays}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${TIER_COLORS[guest.parang_dati_tier] || ""}`}>
                          {guest.parang_dati_tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{guest.guest_segment || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => { e.stopPropagation(); setProfileGuest(guest); }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => { e.stopPropagation(); setEditingGuest(guest); setModalOpen(true); }}
                          >
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <GuestModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        guest={editingGuest}
      />

      <GuestProfileSheet
        guest={profileGuest}
        open={!!profileGuest}
        onOpenChange={(open) => { if (!open) setProfileGuest(null); }}
      />
    </AppLayout>
  );
}