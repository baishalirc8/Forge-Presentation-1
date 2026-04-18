import {
  useGetPartnerCapabilitiesQuery,
  useGetPartnerCapabilityQuery,
  useGetFeedbackQuery,
  useUpdatePartnerCapabilityStatusMutation,
  useSendFeedbackMutation,
  useDeletePartnerCapabilityMutation,
  useGetDeletedPartnerCapabilitiesQuery,
  useRestorePartnerCapabilityMutation,
} from "@/lib/api";
import { Link } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye, Edit, Send, Clock, MessageSquare, ArrowLeft, ChevronDown, ChevronRight, CheckCircle, Trash2, RotateCcw, Archive } from "lucide-react";
import type { PartnerCapability, AssessmentFeedback } from "@shared/schema";
import { ASSESSMENT_SECTIONS, PARTNER_CAPABILITY_STATUS_LABELS, type PartnerCapabilityStatus } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted/40 text-muted-foreground border-muted-foreground/30",
  submitted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  under_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  feedback_sent: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  partner_responded: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  complete: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function PartnerCapabilities() {
  const { data: capabilities, isLoading } = useGetPartnerCapabilitiesQuery();
  const { data: deletedCapabilities } = useGetDeletedPartnerCapabilitiesQuery();
  const [showDeleted, setShowDeleted] = useState(false);
  const deletedCount = (deletedCapabilities || []).length;

  if (isLoading) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[280px]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold" data-testid="text-company-capabilities">Company Capabilities</h1>
        {deletedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleted(!showDeleted)}
            className="text-xs text-muted-foreground"
            data-testid="button-toggle-deleted"
          >
            <Archive className="h-3.5 w-3.5 mr-1.5" />
            Recently Deleted ({deletedCount})
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {(capabilities || []).map(cap => (
          <CapabilityCard key={cap.id} capability={cap} />
        ))}
        <AddNewCard />
      </div>

      {showDeleted && deletedCount > 0 && (
        <div className="mt-10">
          <Separator className="mb-6" />
          <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Recently Deleted
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {(deletedCapabilities || []).map(cap => (
              <DeletedCapabilityCard key={cap.id} capability={cap} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CapabilityCard({ capability }: { capability: PartnerCapability }) {
  const { toast } = useToast();
  const statusLabel = PARTNER_CAPABILITY_STATUS_LABELS[capability.status as PartnerCapabilityStatus] || capability.status;
  const [deleteApi] = useDeletePartnerCapabilityMutation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteApi(capability.id).unwrap();
      toast({ title: "Capability moved to Recently Deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.data?.message || err.message, variant: "destructive" });
    }
    setConfirmDelete(false);
  };

  return (
    <Card className="border-border/40 overflow-hidden h-full flex flex-col group" data-testid={`card-capability-${capability.id}`}>
      <div className="h-[140px] bg-muted/40 flex items-center justify-center overflow-hidden shrink-0 relative">
        {capability.imagePath ? (
          <img src={`/api/documents/${encodeURIComponent(capability.imagePath)}`} alt={capability.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-muted/60 to-muted/20">
            <Eye className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive/20 hover:text-destructive"
          onClick={(e) => { e.preventDefault(); setConfirmDelete(true); }}
          data-testid={`button-delete-cap-${capability.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <CardContent className="p-4 flex flex-col flex-1">
        {confirmDelete ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
            <p className="text-xs text-muted-foreground">Delete this capability? You can restore it later.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" className="text-xs" onClick={handleDelete} data-testid={`button-confirm-delete-${capability.id}`}>
                Delete
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setConfirmDelete(false)} data-testid={`button-cancel-delete-${capability.id}`}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold truncate" data-testid={`text-cap-name-${capability.id}`}>{capability.name}</p>
              <Badge
                className={`text-[10px] shrink-0 border ${STATUS_COLORS[capability.status] || ""}`}
                variant="outline"
                data-testid={`badge-cap-status-${capability.id}`}
              >
                {statusLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-2 min-h-[2rem]">{capability.description || "\u00A0"}</p>
            <div className="mt-auto pt-3 flex gap-2">
              <Link href={`/capabilities/${capability.id}/view`} className="flex-1">
                <Button size="sm" variant="outline" className="w-full text-xs" data-testid={`button-view-${capability.id}`}>
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
              </Link>
              <Link href={`/capabilities/${capability.id}/edit`} className="flex-1">
                <Button size="sm" className="w-full text-xs" data-testid={`button-edit-${capability.id}`}>
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DeletedCapabilityCard({ capability }: { capability: PartnerCapability }) {
  const { toast } = useToast();
  const [restoreApi] = useRestorePartnerCapabilityMutation();

  const handleRestore = async () => {
    try {
      await restoreApi(capability.id).unwrap();
      toast({ title: "Capability restored" });
    } catch (err: any) {
      toast({ title: "Error", description: err.data?.message || err.message, variant: "destructive" });
    }
  };

  const deletedAt = capability.deletedAt ? new Date(capability.deletedAt).toLocaleDateString() : "";

  return (
    <Card className="border-border/40 overflow-hidden h-full flex flex-col opacity-60 hover:opacity-100 transition-opacity" data-testid={`card-deleted-capability-${capability.id}`}>
      <div className="h-[100px] bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
        <Trash2 className="h-8 w-8 text-muted-foreground/20" />
      </div>
      <CardContent className="p-4 flex flex-col flex-1">
        <p className="text-sm font-semibold truncate" data-testid={`text-deleted-cap-name-${capability.id}`}>{capability.name}</p>
        <p className="text-[10px] text-muted-foreground mt-1">Deleted {deletedAt}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{capability.description || "\u00A0"}</p>
        <div className="mt-auto pt-3">
          <Button size="sm" variant="outline" className="w-full text-xs" onClick={handleRestore} data-testid={`button-restore-${capability.id}`}>
            <RotateCcw className="h-3 w-3 mr-1" />
            Restore
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddNewCard() {
  return (
    <Link href="/capabilities/new">
      <Card className="border-border/40 border-dashed h-full min-h-[280px] flex items-center justify-center cursor-pointer hover:bg-muted/20 transition-colors" data-testid="card-add-capability">
        <CardContent className="flex flex-col items-center gap-3 p-6">
          <div className="h-16 w-16 rounded-full bg-muted/40 flex items-center justify-center">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <Button variant="outline" size="sm" className="text-xs" data-testid="button-add-new-product">
            Add a New Product
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

function PartnerFeedbackView({ capId, onBack }: { capId: string; onBack: () => void }) {
  const { toast } = useToast();

  const { data: capability, isLoading: capLoading } = useGetPartnerCapabilityQuery(capId);

  const { data: feedback, isLoading: fbLoading } = useGetFeedbackQuery(capId);

  const [updateStatus, { isLoading: statusPending }] = useUpdatePartnerCapabilityStatusMutation();

  if (capLoading || fbLoading) {
    return (
      <div className="p-6 max-w-[1000px] mx-auto">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!capability) {
    return (
      <div className="p-6 max-w-[1000px] mx-auto">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <p className="text-sm text-muted-foreground mt-4">Capability not found.</p>
      </div>
    );
  }

  const feedbackBySection: Record<string, AssessmentFeedback[]> = {};
  (feedback || []).forEach(fb => {
    if (!feedbackBySection[fb.section]) feedbackBySection[fb.section] = [];
    feedbackBySection[fb.section].push(fb);
  });

  const hasFeedback = (feedback || []).length > 0;
  const canRespond = capability.status === "feedback_sent";

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-feedback">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-feedback-title">Assessment: {capability.name}</h1>
            <p className="text-xs text-muted-foreground">{capability.offeringType}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`text-[10px] border ${STATUS_COLORS[capability.status] || ""}`} variant="outline">
            {PARTNER_CAPABILITY_STATUS_LABELS[capability.status as PartnerCapabilityStatus] || capability.status}
          </Badge>
          {canRespond && (
            <Button
              size="sm"
              className="text-xs"
              onClick={() => {
                updateStatus({ id: capId, status: "partner_responded" })
                  .unwrap()
                  .then(() => toast({ title: "Status updated" }))
                  .catch((err: any) => toast({ title: "Error", description: err.data || err.message, variant: "destructive" }));
              }}
              disabled={statusPending}
              data-testid="button-resubmit"
            >
              <Send className="h-3 w-3 mr-1" /> Re-Submit for Assessment
            </Button>
          )}
        </div>
      </div>

      {!hasFeedback ? (
        <Card className="border-border/40">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No feedback yet. Your submission is being reviewed.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {ASSESSMENT_SECTIONS.map(section => {
            const sectionFeedback = feedbackBySection[section.key];
            if (!sectionFeedback || sectionFeedback.length === 0) return null;
            return (
              <PartnerSectionFeedback
                key={section.key}
                sectionKey={section.key}
                sectionLabel={section.label}
                capId={capId}
                feedbackItems={sectionFeedback}
                canRespond={canRespond}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PartnerSectionFeedback({ sectionKey, sectionLabel, capId, feedbackItems, canRespond }: {
  sectionKey: string;
  sectionLabel: string;
  capId: string;
  feedbackItems: AssessmentFeedback[];
  canRespond: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const [sendFeedback, { isLoading: feedbackPending }] = useSendFeedbackMutation();

  return (
    <Card className="border-border/40" data-testid={`card-partner-section-${sectionKey}`}>
      <CardHeader className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {sectionLabel}
            <Badge variant="outline" className="text-[10px] ml-2">
              <MessageSquare className="h-3 w-3 mr-1" /> {feedbackItems.length}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="px-4 pb-4 space-y-3">
          {feedbackItems.map(fb => (
            <div
              key={fb.id}
              className={`rounded-md p-3 text-sm ${
                fb.role === "admin"
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-blue-500/10 border border-blue-500/20"
              }`}
              data-testid={`feedback-${fb.id}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">
                  {fb.displayName || fb.username}
                  <Badge variant="outline" className="text-[9px] ml-2">{fb.role === "admin" ? "Admin" : "You"}</Badge>
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {fb.createdAt ? new Date(fb.createdAt).toLocaleString() : ""}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{fb.message}</p>
            </div>
          ))}

          {canRespond && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Your Response</p>
                <Textarea
                  placeholder="Describe what you've done to address the feedback..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="min-h-[80px] text-sm"
                  data-testid={`textarea-response-${sectionKey}`}
                />
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    sendFeedback({ capabilityId: capId, data: { section: sectionKey, message } })
                      .unwrap()
                      .then(() => { setMessage(""); toast({ title: "Response submitted" }); })
                      .catch((err: any) => toast({ title: "Error", description: err.data || err.message, variant: "destructive" }));
                  }}
                  disabled={!message.trim() || feedbackPending}
                  data-testid={`button-submit-response-${sectionKey}`}
                >
                  <Send className="h-3 w-3 mr-1" />
                  {feedbackPending ? "Sending..." : "Submit Response"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
