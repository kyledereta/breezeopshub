import { useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Check, X, Users, BedDouble, Calendar, ImageIcon, CreditCard, PawPrint, IdCard, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  useFormSubmissions,
  useRejectSubmission,
  type FormSubmission,
} from "@/hooks/useFormSubmissions";
import { generateBookingConfirmationPdf } from "@/lib/bookingConfirmationPdf";
import { BookingModal, type SubmissionPrefill } from "@/components/BookingModal";

interface FormSubmissionsSectionProps {
  unitMap: Map<string, string>;
}

interface ApprovedBooking {
  bookingRef: string;
  submission: FormSubmission;
}

export function FormSubmissionsSection({ unitMap }: FormSubmissionsSectionProps) {
  const { data: submissions = [], isLoading } = useFormSubmissions("Pending");
  const reject = useRejectSubmission();
  const [viewImage, setViewImage] = useState<{ url: string; title: string } | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvedBooking, setApprovedBooking] = useState<ApprovedBooking | null>(null);
  // New: open booking modal pre-filled from submission
  const [prefillSubmission, setPrefillSubmission] = useState<SubmissionPrefill | null>(null);

  // Resolve a stored path or URL into a viewable signed URL
  const openImage = useCallback(async (rawUrl: string, title: string) => {
    // If it's already a full URL (legacy data), show directly
    if (rawUrl.startsWith("http")) {
      setViewImage({ url: rawUrl, title });
      return;
    }
    // Otherwise it's a storage path – determine bucket from context
    const bucket = title.toLowerCase().includes("id") ? "guest-ids" : "payment-screenshots";
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(rawUrl, 300);
    if (error || !data?.signedUrl) {
      toast.error("Failed to load image");
      return;
    }
    setViewImage({ url: data.signedUrl, title });
  }, []);
  const [activeSubmission, setActiveSubmission] = useState<FormSubmission | null>(null);

  if (isLoading || (submissions.length === 0 && !approvedBooking)) return null;

  const handleApprove = (submission: FormSubmission) => {
    setActiveSubmission(submission);
    setPrefillSubmission({
      guest_name: submission.guest_name,
      facebook_name: submission.facebook_name,
      phone: submission.phone,
      email: submission.email,
      check_in: submission.check_in,
      check_out: submission.check_out,
      unit_id: submission.unit_id,
      pax: submission.pax,
      has_pet: submission.has_pet,
      payment_method: submission.payment_method,
      promo_code: submission.promo_code,
      birthday_month: submission.birthday_month,
      submissionId: submission.id,
    });
  };

  const handleBookingCreated = (booking: { id: string; booking_ref: string }) => {
    if (activeSubmission) {
      setApprovedBooking({ bookingRef: booking.booking_ref, submission: activeSubmission });
    }
    setPrefillSubmission(null);
    setActiveSubmission(null);
  };

  const handleReject = () => {
    if (!rejectingId) return;
    reject.mutate(
      { id: rejectingId, reason: rejectReason || undefined },
      {
        onSuccess: () => {
          toast.success("Submission rejected");
          setRejectingId(null);
          setRejectReason("");
        },
        onError: (err) => toast.error(`Failed to reject: ${err.message}`),
      }
    );
  };

  const handleDownloadConfirmation = () => {
    if (!approvedBooking) return;
    const s = approvedBooking.submission;
    const checkInDate = parseISO(s.check_in);
    const checkOutDate = parseISO(s.check_out);
    generateBookingConfirmationPdf({
      bookingRef: approvedBooking.bookingRef,
      guestName: s.facebook_name ? `${s.guest_name} (${s.facebook_name})` : s.guest_name,
      checkIn: format(checkInDate, "MMMM d, yyyy"),
      checkOut: format(checkOutDate, "MMMM d, yyyy"),
      nights: Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86400000)),
      unitName: s.unit_id ? (unitMap.get(s.unit_id) ?? "TBA") : "TBA",
      pax: s.pax,
      paymentMethod: s.payment_method,
      phone: s.phone,
      email: s.email,
      bookingStatus: "Confirmed",
      bookingSource: "Other",
      paymentStatus: "Unpaid",
      totalAmount: 0,
      depositPaid: 0,
      discountGiven: 0,
      discountType: "fixed",
      discountReason: null,
      securityDeposit: 0,
      extras: [],
      notes: null,
      hasCar: false,
      isDaytour: false,
      lateCheckout: false,
      earlyCheckin: false,
    });
  };

  return (
    <>
      {submissions.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/20">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Form Submissions</span>
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                {submissions.length} pending
              </span>
            </div>
          </div>

          <div className="p-2 space-y-1.5 max-h-[400px] overflow-y-auto">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-3 rounded-lg bg-background border border-border p-3 transition-colors hover:border-primary/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{s.guest_name}</span>
                    {s.facebook_name && (
                      <span className="text-[10px] text-muted-foreground">({s.facebook_name})</span>
                    )}
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-warning-orange/20 text-warning-orange border-warning-orange/30"
                    >
                      Pending Review
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(s.check_in), "MMM d")} → {format(parseISO(s.check_out), "MMM d")}
                    </span>
                    {s.unit_id && (
                      <span className="flex items-center gap-1">
                        <BedDouble className="h-3 w-3" />
                        {unitMap.get(s.unit_id) ?? "Unknown"}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {s.pax} PAX
                    </span>
                    {s.payment_method && (
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {s.payment_method}
                      </span>
                    )}
                    {s.has_pet && (
                      <span className="flex items-center gap-1">
                        <PawPrint className="h-3 w-3" />
                        Pet
                      </span>
                    )}
                    {s.promo_code && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {s.promo_code}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span>Submitted {format(parseISO(s.created_at), "MMM d, h:mm a")}</span>
                    {s.phone && <span>• {s.phone}</span>}
                    {s.email && <span>• {s.email}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {s.gov_id_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openImage(s.gov_id_url!, "Government ID")}
                      title="View government ID"
                    >
                      <IdCard className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                  {s.payment_screenshot_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setViewImage({ url: s.payment_screenshot_url!, title: "Payment Receipt" })}
                      title="View payment receipt"
                    >
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary hover:bg-primary/10 hover:text-primary"
                    onClick={() => handleApprove(s)}
                    title="Approve & create booking"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setRejectingId(s.id)}
                    disabled={reject.isPending}
                    title="Reject submission"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Booking Modal pre-filled from submission */}
      <BookingModal
        open={!!prefillSubmission}
        onOpenChange={(open) => {
          if (!open) {
            setPrefillSubmission(null);
            setActiveSubmission(null);
          }
        }}
        prefillSubmission={prefillSubmission}
        onCreated={handleBookingCreated}
      />

      {/* Approved confirmation dialog */}
      <Dialog open={!!approvedBooking} onOpenChange={() => setApprovedBooking(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              Booking Created
            </DialogTitle>
          </DialogHeader>
          {approvedBooking && (
            <div className="space-y-3">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Booking Reference</p>
                <p className="text-lg font-bold text-primary tracking-wider">{approvedBooking.bookingRef}</p>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><span className="font-medium text-foreground">{approvedBooking.submission.guest_name}</span></p>
                <p>{format(parseISO(approvedBooking.submission.check_in), "MMM d")} → {format(parseISO(approvedBooking.submission.check_out), "MMM d, yyyy")}</p>
                {approvedBooking.submission.unit_id && (
                  <p>{unitMap.get(approvedBooking.submission.unit_id) ?? "Unknown Unit"} • {approvedBooking.submission.pax} PAX</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setApprovedBooking(null)}>
              Close
            </Button>
            <Button onClick={handleDownloadConfirmation} className="gap-1.5">
              <Download className="h-4 w-4" />
              Download Confirmation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image viewer */}
      <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewImage?.title}</DialogTitle>
          </DialogHeader>
          {viewImage && (
            <img
              src={viewImage.url}
              alt={viewImage.title}
              className="w-full rounded-md border border-border"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectingId} onOpenChange={() => { setRejectingId(null); setRejectReason(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejectingId(null); setRejectReason(""); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={reject.isPending}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
