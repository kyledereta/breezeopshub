import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useGuests, type Guest } from "@/hooks/useGuests";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Plus, Users, Eye } from "lucide-react";
import { GuestModal } from "@/components/GuestModal";
import { GuestProfileSheet } from "@/components/GuestProfileSheet";

const TIER_COLORS: Record<string, string> = {
  "New Guest": "bg-muted text-muted-foreground",
  "Returning": "bg-primary/20 text-primary",
  "Loyal 3+": "bg-accent text-accent-foreground",
  "VIP 5+": "bg-chart-1/20 text-chart-1",
};

export default function GuestsPage() {
  const { data: guests = [], isLoading } = useGuests();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [profileGuest, setProfileGuest] = useState<Guest | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return guests;
    const q = search.toLowerCase();
    return guests.filter(
      (g) =>
        g.guest_name.toLowerCase().includes(q) ||
        g.phone?.toLowerCase().includes(q) ||
        g.email?.toLowerCase().includes(q) ||
        g.location?.toLowerCase().includes(q)
    );
  }, [guests, search]);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0">
          <h1 className="text-xl sm:text-3xl font-display text-foreground tracking-wide">Guest Database</h1>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => { setEditingGuest(null); setModalOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Guest
          </Button>
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
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Phone</TableHead>
                  <TableHead className="text-muted-foreground">Email</TableHead>
                  <TableHead className="text-muted-foreground">Location</TableHead>
                  <TableHead className="text-muted-foreground text-center">Stays</TableHead>
                  <TableHead className="text-muted-foreground">Tier</TableHead>
                  <TableHead className="text-muted-foreground">Segment</TableHead>
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
