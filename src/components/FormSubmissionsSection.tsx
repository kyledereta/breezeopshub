import { useState } from "react";
import { format, parseISO } from "date-fns";
import { FileText, Check, X, Users, BedDouble, Calendar, ImageIcon, CreditCard, PawPrint, IdCard } from "lucide-react";
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
  useApproveSubmission,
  useRejectSubmission,
  type FormSubmission,
} from "@/hooks/useFormSubmissions";

interface FormSubmissionsSectionProps {
  unitMap: Map<string, string>;
}

export function FormSubmissionsSection({ unitMap }: FormSubmissionsSectionProps) {
  const { data: submissions = [], isLoading } = useFormSubmissions("Pending");
  const approve = useApproveSubmission();
  const reject = useRejectSubmission();
  const [viewImage, setViewImage] = useState<{ url: string; title: string } | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  if (isLoading || submissions.length === 0) return null;

  const handleApprove = (submission: FormSubmission) => {
    approve.mutate(submission, {
      onSuccess: (booking) =>
        toast.success(`Approved! Booking ${booking.booking_ref} created for ${submission.guest_name}`),
      onError: (err) => toast.error(`Failed to approve: ${err.message}`),
    });
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

  return (
    <>
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
                    onClick={() => setViewImage({ url: s.gov_id_url!, title: "Government ID" })}
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
                  disabled={approve.isPending}
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
