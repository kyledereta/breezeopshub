import { useEffect, useMemo, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useUnits, groupUnitsByArea } from "@/hooks/useUnits";
import { useCreateBooking, useUpdateBooking } from "@/hooks/useBookingMutations";
import type { Booking } from "@/hooks/useBookings";
import { Constants, type Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, FileImage, PawPrint, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type PaymentStatus = Database["public"]["Enums"]["payment_status"];
type BookingStatus = Database["public"]["Enums"]["booking_status"];
type BookingSource = Database["public"]["Enums"]["booking_source"];
type DepositStatus = Database["public"]["Enums"]["deposit_status"];

const bookingSchema = z.object({
  guest_name: z.string().trim().min(1, "Guest name is required").max(100),
  unit_id: z.string().min(1, "Select a unit"),
  check_in: z.string().min(1, "Check-in date is required"),
  check_out: z.string().min(1, "Check-out date is required"),
  pax: z.coerce.number().min(1).max(50),
  total_amount: z.coerce.number().min(0),
  deposit_paid: z.coerce.number().min(0),
  deposit_deducted_amount: z.coerce.number().min(0),
  utensil_rental_fee: z.coerce.number().min(0),
  extra_pax_fee: z.coerce.number().min(0),
  discount_given: z.coerce.number().min(0),
  discount_type: z.string(),
  discount_reason: z.string().max(200).optional().or(z.literal("")),
  payment_status: z.string(),
  booking_status: z.string(),
  booking_source: z.string(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  utensil_rental: z.boolean(),
  pets: z.boolean(),
  deposit_status: z.string(),
}).refine((data) => data.check_out > data.check_in, {
  message: "Check-out must be after check-in",
  path: ["check_out"],
});

type BookingFormValues = z.infer<typeof bookingSchema>;

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking?: Booking | null;
  defaultUnitId?: string;
  defaultDate?: Date;
}

export function BookingModal({
  open,
  onOpenChange,
  booking,
  defaultUnitId,
  defaultDate,
}: BookingModalProps) {
  const { data: units = [] } = useUnits();
  const groupedUnits = useMemo(() => groupUnitsByArea(units), [units]);
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const queryClient = useQueryClient();
  const isEditing = !!booking;
  const [idFiles, setIdFiles] = useState<File[]>([]);
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [guestSuggestions, setGuestSuggestions] = useState<{ id: string; guest_name: string; phone: string | null; email: string | null; pets: boolean }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load existing ID files when editing
  useEffect(() => {
    if (!open) { setIdFiles([]); setExistingIds([]); return; }
    if (booking) {
      supabase.storage.from("guest-ids").list(booking.id).then(({ data }) => {
        if (data) setExistingIds(data.map((f) => `${booking.id}/${f.name}`));
      });
    }
  }, [open, booking]);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      guest_name: "",
      unit_id: "",
      check_in: "",
      check_out: "",
      pax: 1,
      total_amount: 0,
      deposit_paid: 0,
      deposit_deducted_amount: 0,
      utensil_rental_fee: 0,
      extra_pax_fee: 0,
      discount_given: 0,
      discount_type: "fixed",
      discount_reason: "",
      payment_status: "Unpaid",
      booking_status: "Inquiry",
      booking_source: "Other",
      email: "",
      phone: "",
      notes: "",
      utensil_rental: false,
      pets: false,
      deposit_status: "Pending",
    },
  });

  const watchDepositStatus = form.watch("deposit_status");
  const watchUtensilRental = form.watch("utensil_rental");
  const watchUnitId = form.watch("unit_id");
  const watchCheckIn = form.watch("check_in");
  const watchCheckOut = form.watch("check_out");
  const watchPax = form.watch("pax");
  const watchDiscountType = form.watch("discount_type");
  const watchDiscountGiven = form.watch("discount_given");

  // Get selected unit's max_pax
  const selectedUnit = useMemo(() => units.find((u) => u.id === watchUnitId), [units, watchUnitId]);
  const extraPax = selectedUnit ? Math.max(0, watchPax - selectedUnit.max_pax) : 0;

  // Check for booking conflicts
  useEffect(() => {
    if (!watchUnitId || !watchCheckIn || !watchCheckOut) {
      setConflictWarning(null);
      return;
    }
    const checkConflict = async () => {
      let query = supabase
        .from("bookings")
        .select("id, guest_name, check_in, check_out")
        .eq("unit_id", watchUnitId)
        .not("booking_status", "eq", "Cancelled")
        .lt("check_in", watchCheckOut)
        .gt("check_out", watchCheckIn);

      if (booking) {
        query = query.neq("id", booking.id);
      }

      const { data } = await query;
      if (data && data.length > 0) {
        const names = data.map((b) => b.guest_name).join(", ");
        setConflictWarning(`⚠️ Overlaps with: ${names} (${data[0].check_in} → ${data[0].check_out})`);
      } else {
        setConflictWarning(null);
      }
    };
    checkConflict();
  }, [watchUnitId, watchCheckIn, watchCheckOut, booking]);

  // Auto-set utensil rental fee to ₱500 when toggled on
  useEffect(() => {
    if (watchUtensilRental) {
      const currentFee = form.getValues("utensil_rental_fee");
      if (currentFee === 0) {
        form.setValue("utensil_rental_fee", 500);
      }
    }
  }, [watchUtensilRental, form]);

  // Reset form when modal opens with new data
  useEffect(() => {
    if (!open) return;

    if (booking) {
      form.reset({
        guest_name: booking.guest_name,
        unit_id: booking.unit_id ?? "",
        check_in: booking.check_in,
        check_out: booking.check_out,
        pax: booking.pax,
        total_amount: booking.total_amount,
        deposit_paid: booking.deposit_paid,
        deposit_deducted_amount: (booking as any).deposit_deducted_amount ?? 0,
        utensil_rental_fee: (booking as any).utensil_rental_fee ?? 0,
        payment_status: booking.payment_status,
        booking_status: booking.booking_status,
        booking_source: booking.booking_source,
        email: booking.email ?? "",
        phone: booking.phone ?? "",
        notes: booking.notes ?? "",
        utensil_rental: (booking as any).utensil_rental ?? false,
        pets: (booking as any).pets ?? false,
        deposit_status: (booking as any).deposit_status ?? "Pending",
      });
    } else {
      form.reset({
        guest_name: "",
        unit_id: defaultUnitId ?? "",
        check_in: defaultDate ? format(defaultDate, "yyyy-MM-dd") : "",
        check_out: "",
        pax: 1,
        total_amount: 0,
        deposit_paid: 0,
        deposit_deducted_amount: 0,
        utensil_rental_fee: 0,
        payment_status: "Unpaid",
        booking_status: "Inquiry",
        booking_source: "Other",
        email: "",
        phone: "",
        notes: "",
        utensil_rental: false,
        pets: false,
        deposit_status: "Pending",
      });
    }
  }, [open, booking, defaultUnitId, defaultDate, form]);

  async function onSubmit(values: BookingFormValues) {
    try {
      const payload = {
        guest_name: values.guest_name,
        unit_id: values.unit_id,
        check_in: values.check_in,
        check_out: values.check_out,
        pax: values.pax,
        total_amount: values.total_amount,
        deposit_paid: values.deposit_paid,
        payment_status: values.payment_status as PaymentStatus,
        booking_status: values.booking_status as BookingStatus,
        booking_source: values.booking_source as BookingSource,
        email: values.email || null,
        phone: values.phone || null,
        notes: values.notes || null,
        utensil_rental: values.utensil_rental,
        utensil_rental_fee: values.utensil_rental ? values.utensil_rental_fee : 0,
        pets: values.pets,
        deposit_status: values.deposit_status as DepositStatus,
        deposit_deducted_amount: values.deposit_status === "Deducted" ? values.deposit_deducted_amount : 0,
      };

      // Upload ID files if any
      let uploadedIds: string[] = [];
      if (idFiles.length > 0) {
        for (const file of idFiles) {
          const filePath = `${isEditing ? booking.id : "temp"}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("guest-ids")
            .upload(filePath, file);
          if (uploadError) throw uploadError;
          uploadedIds.push(filePath);
        }
      }

      // Auto-link guest: find existing or create new guest record
      let guestId: string | null = null;
      try {
        // Try to find by name (case-insensitive)
        const { data: existingGuests } = await supabase
          .from("guests")
          .select("id")
          .ilike("guest_name", values.guest_name.trim())
          .limit(1);

        if (existingGuests && existingGuests.length > 0) {
          guestId = existingGuests[0].id;
        } else {
          // Create new guest
          const { data: newGuest } = await supabase
            .from("guests")
            .insert({
              guest_name: values.guest_name.trim(),
              phone: values.phone || null,
              email: values.email || null,
              pets: values.pets,
            })
            .select("id")
            .single();
          if (newGuest) guestId = newGuest.id;
        }
      } catch {
        // Non-critical: continue without linking
      }

      const fullPayload = { ...payload, guest_id: guestId };

      if (isEditing) {
        await updateBooking.mutateAsync({ id: booking.id, ...fullPayload });
        toast.success("Booking updated");
      } else {
        await createBooking.mutateAsync(fullPayload);
        toast.success("Booking created");
      }

      // Update guest total_stays and tier after checkout
      if (guestId && values.booking_status === "Checked Out") {
        try {
          const { count } = await supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("guest_id", guestId)
            .eq("booking_status", "Checked Out");
          
          const stays = count ?? 0;
          const tier = stays >= 5 ? "VIP 5+" : stays >= 3 ? "Loyal 3+" : stays >= 2 ? "Returning" : "New Guest";
          
          await supabase
            .from("guests")
            .update({ total_stays: stays, parang_dati_tier: tier })
            .eq("id", guestId);
        } catch {
          // Non-critical
        }
      }

      queryClient.invalidateQueries({ queryKey: ["guests"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    }
  }

  const isPending = createBooking.isPending || updateBooking.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground">
            {isEditing ? "Edit Booking" : "New Booking"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Guest Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Guest Info
              </h3>
              <FormField
                control={form.control}
                name="guest_name"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="text-xs text-muted-foreground">Guest Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Full name"
                        className="bg-background border-border"
                        autoComplete="off"
                        onChange={async (e) => {
                          field.onChange(e);
                          const q = e.target.value.trim();
                          if (q.length >= 2) {
                            const { data } = await supabase
                              .from("guests")
                              .select("id, guest_name, phone, email, pets")
                              .ilike("guest_name", `%${q}%`)
                              .limit(5);
                            setGuestSuggestions(data || []);
                            setShowSuggestions(true);
                          } else {
                            setShowSuggestions(false);
                          }
                        }}
                        onFocus={() => { if (guestSuggestions.length > 0) setShowSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      />
                    </FormControl>
                    {showSuggestions && guestSuggestions.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-lg max-h-40 overflow-auto">
                        {guestSuggestions.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              form.setValue("guest_name", g.guest_name);
                              if (g.phone) form.setValue("phone", g.phone);
                              if (g.email) form.setValue("email", g.email);
                              form.setValue("pets", g.pets);
                              setShowSuggestions(false);
                            }}
                          >
                            <span className="text-foreground">{g.guest_name}</span>
                            <span className="text-xs text-muted-foreground">{g.phone || g.email || ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="Optional" className="bg-background border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Optional" className="bg-background border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Stay Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Stay Details
              </h3>
              <FormField
                control={form.control}
                name="unit_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Select a unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border">
                        {groupedUnits.map(({ area, units: areaUnits }) => (
                          <div key={area}>
                            <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-primary font-semibold">
                              {area}
                            </div>
                            {areaUnits.map((unit) => (
                              <SelectItem key={unit.id} value={unit.id}>
                                {unit.name} · {unit.max_pax} PAX · ₱{unit.nightly_rate.toLocaleString()}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {conflictWarning && (
                <div className="flex items-center gap-2 rounded-lg border border-warning-orange/50 bg-warning-orange/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-warning-orange shrink-0" />
                  <p className="text-xs text-warning-orange">{conflictWarning}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="check_in"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Check-in</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="bg-background border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="check_out"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Check-out</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="bg-background border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">PAX</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={1} max={50} className="bg-background border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Booking & Payment */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Booking & Payment
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="booking_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border">
                          {Constants.public.Enums.booking_status.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="payment_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Payment</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border">
                          {Constants.public.Enums.payment_status.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="booking_source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border">
                          {Constants.public.Enums.booking_source.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="total_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Total Amount (₱)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={0} step={100} className="bg-background border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deposit_paid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Downpayment (₱)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={0} step={100} className="bg-background border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Extras & Deposits */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Extras & Deposits
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="utensil_rental"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border border-border p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="text-xs text-foreground">Utensil Rental</FormLabel>
                        <p className="text-[10px] text-muted-foreground">₱500/set</p>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pets"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border border-border p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="text-xs text-foreground">With Pets</FormLabel>
                        <p className="text-[10px] text-muted-foreground">
                          <PawPrint className="h-3 w-3 inline" /> Pet included
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deposit_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Security Deposit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Returned">Returned</SelectItem>
                          <SelectItem value="Deducted">Deducted</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {watchDepositStatus === "Deducted" && (
                <FormField
                  control={form.control}
                  name="deposit_deducted_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Amount Deducted from Security Deposit (₱)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={0} step={100} className="bg-background border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {watchUtensilRental && (
                <FormField
                  control={form.control}
                  name="utensil_rental_fee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Utensil Rental Fee (₱)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={0} step={100} className="bg-background border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <Separator className="bg-border" />

            {/* Guest ID Upload */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Guest ID
              </h3>
              {/* Existing files */}
              {existingIds.length > 0 && (
                <div className="space-y-1.5">
                  {existingIds.map((path) => (
                    <div key={path} className="flex items-center justify-between text-xs bg-background border border-border rounded-md px-3 py-2">
                      <div className="flex items-center gap-2 text-muted-foreground truncate">
                        <FileImage className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{path.split("/").pop()}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          await supabase.storage.from("guest-ids").remove([path]);
                          setExistingIds((prev) => prev.filter((p) => p !== path));
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {/* New files */}
              {idFiles.length > 0 && (
                <div className="space-y-1.5">
                  {idFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-background border border-border rounded-md px-3 py-2">
                      <div className="flex items-center gap-2 text-muted-foreground truncate">
                        <FileImage className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={() => setIdFiles((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-3 cursor-pointer hover:border-primary/50 transition-colors text-xs text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>Upload ID photo</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) setIdFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }}
                />
              </label>
            </div>

            <Separator className="bg-border" />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Special requests, reminders..."
                      className="bg-background border-border resize-none h-20"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isPending ? "Saving..." : isEditing ? "Update Booking" : "Create Booking"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
