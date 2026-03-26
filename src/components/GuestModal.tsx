import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCreateGuest, useUpdateGuest } from "@/hooks/useGuestMutations";
import type { Guest } from "@/hooks/useGuests";
import { Constants } from "@/integrations/supabase/types";
import { toast } from "sonner";

const guestSchema = z.object({
  guest_name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  guest_segment: z.string().optional().or(z.literal("")),
  birthday_month: z.coerce.number().min(0).max(12).optional(),
  pets: z.boolean(),
  marketing_consent: z.boolean(),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type GuestFormValues = z.infer<typeof guestSchema>;

const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface GuestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guest: Guest | null;
}

export function GuestModal({ open, onOpenChange, guest }: GuestModalProps) {
  const isEditing = !!guest;
  const createGuest = useCreateGuest();
  const updateGuest = useUpdateGuest();

  const form = useForm<GuestFormValues>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      guest_name: "",
      phone: "",
      email: "",
      location: "",
      guest_segment: "",
      birthday_month: 0,
      pets: false,
      marketing_consent: false,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (guest) {
      form.reset({
        guest_name: guest.guest_name,
        phone: guest.phone ?? "",
        email: guest.email ?? "",
        location: guest.location ?? "",
        guest_segment: guest.guest_segment ?? "",
        birthday_month: guest.birthday_month ?? 0,
        pets: guest.pets,
        marketing_consent: guest.marketing_consent,
        notes: guest.notes ?? "",
      });
    } else {
      form.reset({
        guest_name: "",
        phone: "",
        email: "",
        location: "",
        guest_segment: "",
        birthday_month: 0,
        pets: false,
        marketing_consent: false,
        notes: "",
      });
    }
  }, [open, guest, form]);

  async function onSubmit(values: GuestFormValues) {
    try {
      const payload = {
        guest_name: values.guest_name,
        phone: values.phone || null,
        email: values.email || null,
        location: values.location || null,
        guest_segment: (values.guest_segment || null) as any,
        birthday_month: values.birthday_month || null,
        pets: values.pets,
        marketing_consent: values.marketing_consent,
        notes: values.notes || null,
      };

      if (isEditing) {
        await updateGuest.mutateAsync({ id: guest.id, ...payload });
        toast.success("Guest updated");
      } else {
        await createGuest.mutateAsync(payload);
        toast.success("Guest added");
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    }
  }

  const isPending = createGuest.isPending || updateGuest.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground">
            {isEditing ? "Edit Guest" : "Add Guest"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="guest_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground text-xs">Name *</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-background border-border" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground text-xs">Phone</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-background border-border" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground text-xs">Email</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-background border-border" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground text-xs">Location</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-background border-border" />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="guest_segment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground text-xs">Segment</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Constants.public.Enums.guest_segment.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthday_month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground text-xs">Birthday Month</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value || 0)}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">—</SelectItem>
                        {MONTHS.slice(1).map((m, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-6">
              <FormField
                control={form.control}
                name="pets"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="text-muted-foreground text-xs">Has Pets</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="marketing_consent"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="text-muted-foreground text-xs">Marketing Consent</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground text-xs">Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} className="bg-background border-border resize-none" />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {isPending ? "Saving..." : isEditing ? "Update Guest" : "Add Guest"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
