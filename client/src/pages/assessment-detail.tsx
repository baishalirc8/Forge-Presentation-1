import {
  useGetAssessmentQuery, useGetPartnerQuery, useUpdateAssessmentMutation, useGetAssessmentReportCardQuery,
  useGetArtifactsQuery, useGetPartnerArtifactsQuery, useGetPartnerDocumentsQuery,
  api, apiRequest
} from "@/lib/api";
import { useAppDispatch } from "@/lib/store";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { MaturityBadge } from "@/components/maturity-badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { VERTICALS, LEVEL_LABELS, type VerticalScores, type Assessment, type Partner, type Capability, type SubCapability, type Artifact, type PartnerArtifact, type PartnerDocument } from "@shared/schema";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Shield, Target, Loader2, Zap,
  Upload, FileText, FileCheck, XCircle, Clock, ChevronDown, ChevronRight,
  ExternalLink, Eye, X, Send, TrendingUp, Package, BarChart3, Bot, Sparkles
} from "lucide-react";
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/pagination-controls";
import { GapAdvisor } from "@/components/gap-advisor";

interface EnrichedAssessment extends Assessment {
  capability: Capability | null;
  subCapability: SubCapability | null;
}

interface ReportCardItem {
  artifact: Artifact;
  partnerArtifact: PartnerArtifact | null;
  status: string;
  documents: PartnerDocument[];
}

interface LevelEntry {
  level: number;
  status: "compliant" | "partial" | "non_compliant" | "no_artifacts";
  summary: { total: number; verified: number; draft: number; missing: number };
  items: ReportCardItem[];
}

interface VerticalEntry {
  key: string;
  name: string;
  description: string;
  priority: number;
  status: "compliant" | "partial" | "non_compliant" | "no_artifacts";
  summary: { total: number; verified: number; draft: number; missing: number };
  levels: LevelEntry[];
}

interface ReportCardData {
  assessmentId: string;
  targetLevel: number;
  summary: { totalRequired: number; verified: number; draft: number; missing: number };
  verticals: VerticalEntry[];
}

export default function AssessmentDetail() {
  const params = useParams<{ id: string; assessmentId: string }>();
  const partnerId = params.id;
  const assessmentId = params.assessmentId;
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [advisorOpen, setAdvisorOpen] = useState(false);

  const dispatch = useAppDispatch();
  const { data: assessment, isLoading } = useGetAssessmentQuery(assessmentId!);

  const { data: partner } = useGetPartnerQuery(partnerId!, { skip: !partnerId });

  const [updateAssessmentApi] = useUpdateAssessmentMutation();

  const submitMutation = { mutate: async (newStatus: string) => {
    try {
      await updateAssessmentApi({ id: assessmentId!, data: { status: newStatus } }).unwrap();
      const messages: Record<string, { title: string; description: string }> = {
        pending_review: { title: "Assessment submitted for review", description: "Admin will review your compliance status." },
        approved: { title: "Assessment marked as Compliant", description: "This assessment meets compliance requirements." },
        rejected: { title: "Assessment marked as Non-Compliant", description: "The partner should review and address gaps." },
      };
      const msg = messages[newStatus] || { title: "Assessment updated", description: "" };
      toast(msg);
    } catch (error: any) {
      const raw = error?.data || error?.message || "";
      let serverMsg = raw;
      try {
        const jsonPart = raw.substring(raw.indexOf("{"));
        serverMsg = JSON.parse(jsonPart).message || raw;
      } catch {}
      if (serverMsg.includes("Cannot transition") && serverMsg.includes("pending_review")) {
        toast({ title: "Already submitted", description: "This assessment is already under review." });
        dispatch(api.util.invalidateTags(["Assessment"]));
      } else if (serverMsg.includes("Cannot transition") && serverMsg.includes("approved")) {
        toast({ title: "Already approved", description: "This assessment has already been marked as compliant." });
        dispatch(api.util.invalidateTags(["Assessment"]));
      } else {
        toast({ title: "Failed to submit", description: serverMsg || "Please try again.", variant: "destructive" });
      }
    }
  }, isPending: false };

  if (isLoading) {
    return (
      <div className="p-3 space-y-3 mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-[400px] lg:col-span-1" />
          <Skeleton className="h-[400px] lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground">
        <Target className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Assessment not found</p>
        <Link href={`/partners/${partnerId}`}>
          <Button variant="outline" size="sm" className="mt-3">Back to Organization</Button>
        </Link>
      </div>
    );
  }

  const scores = (assessment.scores as VerticalScores) || {};
  const targetLevel = assessment.targetLevel;
  const gaps = VERTICALS.filter((v) => (scores[v.key] || 0) < targetLevel);
  const minLevel = Math.min(...VERTICALS.map((v) => scores[v.key] || 0));
  const avgLevel = VERTICALS.length > 0
    ? Math.round(VERTICALS.reduce((sum, v) => sum + (scores[v.key] || 0), 0) / VERTICALS.length * 10) / 10
    : 0;

  return (
    <div className="p-3 space-y-3 mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={`/partners/${partnerId}`}>
          <Button variant="ghost" size="icon" data-testid="button-back-to-org">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight truncate" data-testid="text-assessment-title">
              {(assessment as any).productName || assessment.capability?.name || "Assessment"}
            </h1>
            <Badge variant="outline" className={`text-sm ${
              assessment.status === "approved" ? "border-emerald-500/30 text-emerald-400" :
              assessment.status === "rejected" ? "border-red-500/30 text-red-400" :
              assessment.status === "pending_review" ? "border-amber-500/30 text-amber-400" : ""
            }`} data-testid="badge-assessment-status">
              {assessment.status === "pending_review" ? "Under Review" :
               assessment.status === "approved" ? "Compliant" :
               assessment.status === "rejected" ? "Non-Compliant" :
               assessment.status}
            </Badge>
            <MaturityBadge level={Math.round(avgLevel)} size="lg" />
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            {assessment.subCapability && (
              <span className="text-sm text-muted-foreground" data-testid="text-sub-capability">
                {assessment.subCapability.name}
              </span>
            )}
            <span className="text-sm text-muted-foreground font-mono">
              Target: L{targetLevel} ({LEVEL_LABELS[targetLevel] || ""})
            </span>
            {assessment.samDataPopulated && (
              <span className="text-sm text-emerald-400 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                SAM Data Populated
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {assessment.status === "pending_review" && (
            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-sm gap-1">
              <Clock className="h-3 w-3" />
              Under Review
            </Badge>
          )}
          {assessment.status === "approved" && (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-sm gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Compliant
            </Badge>
          )}
          {assessment.status === "rejected" && (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-sm gap-1">
              <XCircle className="h-3 w-3" />
              Non-Compliant
            </Badge>
          )}
          {!isAdmin && (assessment.status === "pending" || assessment.status === "in_progress") && (
            <Button
              size="sm"
              onClick={() => submitMutation.mutate("pending_review")}
              disabled={submitMutation.isPending}
              className="gap-1.5"
              data-testid="button-submit-review"
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Submit for Review
            </Button>
          )}
          {!isAdmin && partner && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAdvisorOpen(true)}
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              data-testid="button-open-advisor"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Advisor
            </Button>
          )}
        </div>
      </div>

      {assessment.status === "pending_review" && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400">Assessment Under Review</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isAdmin
                  ? "This assessment has been submitted by the partner for compliance review. Review the report card below and mark as compliant or non-compliant."
                  : "Your assessment has been submitted to the admin for compliance review. You will be notified once a decision is made."}
              </p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => submitMutation.mutate("rejected")}
                  disabled={submitMutation.isPending}
                  data-testid="button-reject-assessment"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Non-Compliant
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => submitMutation.mutate("approved")}
                  disabled={submitMutation.isPending}
                  data-testid="button-approve-assessment"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Compliant
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {assessment.status === "approved" && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-400">Assessment Compliant</p>
              <p className="text-sm text-muted-foreground mt-0.5">This assessment has been reviewed and approved by the administrator. Your organization meets the compliance requirements.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {assessment.status === "rejected" && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">Assessment Non-Compliant</p>
              <p className="text-sm text-muted-foreground mt-0.5">This assessment has been reviewed and marked as non-compliant. Please review the report card and upload missing documents, then resubmit.</p>
            </div>
            {!isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => submitMutation.mutate("pending_review")}
                disabled={submitMutation.isPending}
                className="gap-1.5 shrink-0"
                data-testid="button-resubmit-review"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Resubmit
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {(assessment.description || assessment.certifications) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            {assessment.description && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Description</p>
                <p className="text-sm" data-testid="text-assessment-desc">{assessment.description}</p>
              </div>
            )}
            {assessment.certifications && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Certifications</p>
                <p className="text-sm" data-testid="text-assessment-certs">{assessment.certifications}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Assessment Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3" data-testid="text-assessment-summary">
            {assessment.capability?.name || "This assessment"} is currently at floor level{" "}
            <span className="font-mono font-semibold text-foreground">L{minLevel}</span>
            {" "}with an average of{" "}
            <span className="font-mono font-semibold text-foreground">{avgLevel}</span>
            {" "}across all verticals.
            {minLevel < targetLevel && (
              <> Requires advancement in {gaps.length} vertical{gaps.length !== 1 ? "s" : ""} to reach target L{targetLevel} ({LEVEL_LABELS[targetLevel] || ""}).</>
            )}
            {minLevel >= targetLevel && (
              <> All verticals meet or exceed the target level.</>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {VERTICALS.map((v) => {
              const level = scores[v.key] || 0;
              const atTarget = level >= targetLevel;
              return (
                <div
                  key={v.key}
                  className={`rounded-md px-3 py-2 text-center border ${
                    atTarget
                      ? "bg-emerald-500/8 border-emerald-500/20"
                      : level >= targetLevel - 2
                        ? "bg-amber-500/8 border-amber-500/20"
                        : "bg-red-500/8 border-red-500/20"
                  }`}
                  data-testid={`summary-vertical-${v.key}`}
                >
                  <p className="text-[10px] font-mono font-semibold text-muted-foreground">{v.key}</p>
                  <p className={`text-sm font-mono font-bold ${
                    atTarget ? "text-emerald-400" : level >= targetLevel - 2 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {level}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <GapAnalysisSection assessmentId={assessmentId!} partnerId={partnerId!} targetLevel={targetLevel} scores={scores} />

      <ReportCardSection assessmentId={assessmentId!} partnerId={partnerId!} targetLevel={targetLevel} isAdmin={isAdmin} />

      {partner && (
        <GapAdvisor partner={partner} open={advisorOpen} onClose={() => setAdvisorOpen(false)} />
      )}
    </div>
  );
}

function GapAnalysisSection({ assessmentId, partnerId, targetLevel, scores }: {
  assessmentId: string;
  partnerId: string;
  targetLevel: number;
  scores: VerticalScores;
}) {
  const [expandedVertical, setExpandedVertical] = useState<string | null>(null);
  const emptyGapVerticals: any[] = [];

  const [hasAnalyzingDocs, setHasAnalyzingDocs] = useState(false);

  const { data: reportCard, isLoading } = useGetAssessmentReportCardQuery(assessmentId, {
    pollingInterval: hasAnalyzingDocs ? 3000 : 0,
  });

  useEffect(() => {
    if (!reportCard) return;
    const analyzing = reportCard.verticals.some(v =>
      v.levels.some(l =>
        l.items.some(i =>
          i.documents.some(d => (d.complianceDetails as any)?.status === "analyzing")
        )
      )
    );
    setHasAnalyzingDocs(analyzing);
  }, [reportCard]);

  const gapData = useMemo(() => {
    if (!reportCard) return null;

    const samVerified: { vertical: string; verticalName: string; artifact: Artifact; partnerArtifact: PartnerArtifact | null }[] = [];
    const userUploaded: { vertical: string; verticalName: string; artifact: Artifact; documents: PartnerDocument[]; partnerArtifact: PartnerArtifact | null }[] = [];
    const stillNeeded: { vertical: string; verticalName: string; artifact: Artifact; level: number }[] = [];

    for (const vert of reportCard.verticals) {
      for (const lvl of vert.levels) {
        if (lvl.level > targetLevel) continue;
        for (const item of lvl.items) {
          if (item.status === "verified" && item.partnerArtifact?.verifiedBy?.includes("SAM")) {
            samVerified.push({ vertical: vert.key, verticalName: vert.name, artifact: item.artifact, partnerArtifact: item.partnerArtifact });
          } else if ((item.status === "draft" || item.status === "submitted" || item.status === "verified") && item.documents.length > 0) {
            userUploaded.push({ vertical: vert.key, verticalName: vert.name, artifact: item.artifact, documents: item.documents, partnerArtifact: item.partnerArtifact });
          } else if (item.status === "missing" || item.status === "draft") {
            stillNeeded.push({ vertical: vert.key, verticalName: vert.name, artifact: item.artifact, level: lvl.level });
          }
        }
      }
    }

    const verticalGaps = VERTICALS.map(v => {
      const currentLevel = scores[v.key] || 0;
      const gap = targetLevel - currentLevel;
      const neededForVertical = stillNeeded.filter(n => n.vertical === v.key);
      const samForVertical = samVerified.filter(s => s.vertical === v.key);
      const uploadedForVertical = userUploaded.filter(u => u.vertical === v.key);
      return {
        key: v.key,
        name: v.name,
        currentLevel,
        targetLevel,
        gap: Math.max(0, gap),
        atTarget: currentLevel >= targetLevel,
        neededCount: neededForVertical.length,
        samCount: samForVertical.length,
        uploadedCount: uploadedForVertical.length,
        needed: neededForVertical,
        sam: samForVertical,
        uploaded: uploadedForVertical,
      };
    });

    return { samVerified, userUploaded, stillNeeded, verticalGaps };
  }, [reportCard, targetLevel, scores]);

  const gapPagination = usePagination(gapData?.verticalGaps || emptyGapVerticals, 6);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!gapData) return null;

  const totalArtifactsToTarget = gapData.samVerified.length + gapData.userUploaded.length + gapData.stillNeeded.length;
  const coveredCount = gapData.samVerified.length + gapData.userUploaded.length;
  const coveragePct = totalArtifactsToTarget > 0 ? Math.round((coveredCount / totalArtifactsToTarget) * 100) : 0;

  return (
    <Card data-testid="card-gap-analysis">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <TrendingUp className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold" data-testid="text-gap-analysis-title">Gap Analysis</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Artifacts required to achieve <span className="font-mono font-semibold text-foreground">Level {targetLevel}</span> — {LEVEL_LABELS[targetLevel] || ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MaturityBadge level={targetLevel} size="lg" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-center">
            <p className="text-2xl font-mono font-bold" data-testid="text-gap-total">{totalArtifactsToTarget}</p>
            <p className="text-sm text-muted-foreground">Total Required</p>
          </div>
          <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 p-3 text-center">
            <p className="text-2xl font-mono font-bold text-emerald-400" data-testid="text-gap-sam">{gapData.samVerified.length}</p>
            <p className="text-sm text-muted-foreground">SAM Verified</p>
          </div>
          <div className="rounded-lg bg-primary/8 border border-primary/20 p-3 text-center">
            <p className="text-2xl font-mono font-bold text-primary" data-testid="text-gap-uploaded">{gapData.userUploaded.length}</p>
            <p className="text-sm text-muted-foreground">User Uploaded</p>
          </div>
          <div className="rounded-lg bg-red-500/8 border border-red-500/20 p-3 text-center">
            <p className="text-2xl font-mono font-bold text-red-400" data-testid="text-gap-needed">{gapData.stillNeeded.length}</p>
            <p className="text-sm text-muted-foreground">Still Needed</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Coverage to Target Level {targetLevel}</span>
            <span className="font-mono font-bold">{coveragePct}%</span>
          </div>
          <Progress value={coveragePct} className="h-2" />
        </div>

        <div className="space-y-2">
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-semibold">Per-Vertical Breakdown</p>
          <div className="space-y-1.5">
            {gapPagination.paginatedItems.map((vg) => {
              const isExpanded = expandedVertical === vg.key;
              const hasDetails = vg.neededCount > 0 || vg.samCount > 0 || vg.uploadedCount > 0;
              return (
                <div key={vg.key} className="rounded-lg border border-border/40 overflow-hidden" data-testid={`gap-vertical-${vg.key}`}>
                  <button
                    onClick={() => hasDetails && setExpandedVertical(isExpanded ? null : vg.key)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${hasDetails ? "hover:bg-muted/30 cursor-pointer" : "opacity-50 cursor-default"}`}
                  >
                    {hasDetails && (
                      <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`} />
                    )}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-sm font-semibold">{vg.name}</span>
                      <Badge variant="outline" className="text-sm font-mono">{vg.key}</Badge>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm text-muted-foreground">
                        L{vg.currentLevel} → L{vg.targetLevel}
                      </span>
                      {vg.atTarget ? (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-sm gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          At Target
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-sm gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {vg.neededCount} needed
                        </Badge>
                      )}
                      {vg.samCount > 0 && (
                        <span className="text-sm text-emerald-400 flex items-center gap-1">
                          <Zap className="h-3 w-3" /> {vg.samCount}
                        </span>
                      )}
                      {vg.uploadedCount > 0 && (
                        <span className="text-sm text-primary flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {vg.uploadedCount}
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && hasDetails && (
                    <div className="border-t border-border/20 px-4 py-3 space-y-4">
                      {vg.sam.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                            <Zap className="h-4 w-4" />
                            SAM.gov Verified ({vg.sam.length})
                          </p>
                          <div className="space-y-1">
                            {vg.sam.map((s) => (
                              <div key={s.artifact.id} className="flex items-center gap-2 rounded-md bg-emerald-500/5 border border-emerald-500/15 px-3 py-2" data-testid={`gap-sam-${s.artifact.id}`}>
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{s.artifact.name}</p>
                                  <p className="text-sm text-muted-foreground">L{s.artifact.level} — {s.artifact.regulation || s.artifact.verificationMethod?.replace(/_/g, " ")}</p>
                                </div>
                                <Badge variant="outline" className="text-sm border-emerald-500/30 text-emerald-400 shrink-0">Verified</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {vg.uploaded.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
                            <FileText className="h-4 w-4" />
                            User Uploaded Documents ({vg.uploaded.length})
                          </p>
                          <div className="space-y-1">
                            {vg.uploaded.map((u) => (
                              <div key={u.artifact.id} className="rounded-md bg-primary/5 border border-primary/15 px-3 py-2" data-testid={`gap-uploaded-${u.artifact.id}`}>
                                <div className="flex items-center gap-2">
                                  <FileCheck className="h-4 w-4 text-primary shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{u.artifact.name}</p>
                                    <p className="text-sm text-muted-foreground">L{u.artifact.level} — {u.documents.length} document{u.documents.length !== 1 ? "s" : ""}</p>
                                  </div>
                                  <Badge variant="outline" className={`text-sm shrink-0 ${u.partnerArtifact?.status === "verified" ? "border-emerald-500/30 text-emerald-400" : "border-primary/30 text-primary"}`}>
                                    {u.partnerArtifact?.status === "verified" ? "Verified" : "Uploaded"}
                                  </Badge>
                                </div>
                                <div className="ml-6 mt-1.5 space-y-1">
                                  {u.documents.map((doc) => {
                                    const cs = doc.complianceScore;
                                    const hasCS = cs !== null && cs !== undefined;
                                    const docDetails = doc.complianceDetails as any;
                                    const docAnalyzing = docDetails?.status === "analyzing";
                                    return (
                                      <div key={doc.id} className={`flex items-center gap-2 text-sm text-muted-foreground ${docAnalyzing ? "animate-pulse" : ""}`} data-testid={`gap-doc-${doc.id}`}>
                                        <FileText className={`h-3 w-3 shrink-0 ${docAnalyzing ? "text-blue-400" : ""}`} />
                                        <span className="truncate">{doc.fileName}</span>
                                        <span className="text-sm shrink-0">({(doc.fileSize / 1024).toFixed(0)} KB)</span>
                                        {docAnalyzing && !hasCS && (
                                          <Badge variant="outline" className="text-[10px] shrink-0 bg-blue-500/10 border-blue-500/30 text-blue-400" data-testid={`gap-analyzing-${doc.id}`}>
                                            <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                                            Analyzing...
                                          </Badge>
                                        )}
                                        {hasCS && (
                                          <Badge
                                            variant="outline"
                                            className={`text-[10px] shrink-0 font-mono ${
                                              cs >= 80
                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                                : cs >= 60
                                                ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                                                : "bg-red-500/10 border-red-500/30 text-red-400"
                                            }`}
                                            data-testid={`gap-compliance-${doc.id}`}
                                          >
                                            {cs >= 80 ? <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> : cs >= 60 ? <AlertTriangle className="h-2.5 w-2.5 mr-1" /> : <XCircle className="h-2.5 w-2.5 mr-1" />}
                                            {cs}%
                                          </Badge>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {vg.needed.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
                            <XCircle className="h-4 w-4" />
                            Still Needed to Reach L{targetLevel} ({vg.needed.length})
                          </p>
                          <div className="space-y-1">
                            {vg.needed.map((n) => (
                              <div key={n.artifact.id} className="flex items-center gap-2 rounded-md bg-red-500/5 border border-red-500/15 px-3 py-2" data-testid={`gap-needed-${n.artifact.id}`}>
                                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{n.artifact.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    L{n.level} — {n.artifact.verificationMethod?.replace(/_/g, " ")}
                                    {n.artifact.regulation && ` — ${n.artifact.regulation}`}
                                  </p>
                                </div>
                                <Badge variant="destructive" className="text-sm shrink-0">Missing</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <PaginationControls
            currentPage={gapPagination.currentPage}
            totalPages={gapPagination.totalPages}
            totalItems={gapPagination.totalItems}
            startIndex={gapPagination.startIndex}
            endIndex={gapPagination.endIndex}
            onPageChange={gapPagination.goToPage}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const s = size === "md" ? "h-5 w-5" : "h-4 w-4";
  switch (status) {
    case "compliant":
    case "verified":
      return <CheckCircle2 className={`${s} text-emerald-400`} />;
    case "partial":
    case "draft":
    case "submitted":
      return <AlertTriangle className={`${s} text-amber-400`} />;
    case "no_artifacts":
      return <Clock className={`${s} text-muted-foreground/50`} />;
    case "non_compliant":
    case "missing":
    default:
      return <XCircle className={`${s} text-red-400`} />;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "compliant": return "Compliant";
    case "partial": return "Partial";
    case "non_compliant": return "Non-Compliant";
    case "no_artifacts": return "No Artifacts";
    case "verified": return "Verified";
    case "draft": return "Uploaded";
    case "submitted": return "Submitted";
    case "missing": return "Missing";
    default: return status;
  }
}

function statusBadgeVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  switch (status) {
    case "compliant":
    case "verified":
      return "default";
    case "non_compliant":
    case "missing":
      return "destructive";
    case "no_artifacts":
      return "outline";
    default:
      return "secondary";
  }
}

function ReportCardSection({ assessmentId, partnerId, targetLevel, isAdmin }: {
  assessmentId: string;
  partnerId: string;
  targetLevel: number;
  isAdmin: boolean;
}) {
  const [selectedLevel, setSelectedLevel] = useState<{ vertical: VerticalEntry; level: LevelEntry } | null>(null);
  const [expandedVerticals, setExpandedVerticals] = useState<Set<string>>(new Set());

  const toggleVertical = (key: string) => {
    setExpandedVerticals(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const { data: reportCard, isLoading } = useGetAssessmentReportCardQuery(assessmentId);

  const summary = reportCard?.summary || { totalRequired: 0, verified: 0, draft: 0, missing: 0 };
  const verticals = reportCard?.verticals || [];

  const rcPagination = usePagination(verticals, 6);

  const completionPct = summary.totalRequired > 0
    ? Math.round((summary.verified / summary.totalRequired) * 100)
    : 0;

  return (
    <>
      <Card data-testid="card-report-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold" data-testid="text-report-card-title">Report Card</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {verticals.length} verticals × 9 levels — target L{targetLevel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-5 text-sm">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-muted-foreground">Compliant</span>
                  <span className="font-mono font-bold text-emerald-400">{summary.verified}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-muted-foreground">Partial</span>
                  <span className="font-mono font-bold text-amber-400">{summary.draft}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-muted-foreground">Missing</span>
                  <span className="font-mono font-bold text-red-400">{summary.missing}</span>
                </span>
              </div>
              <div className="text-right">
                <p className="text-2xl font-mono font-bold" data-testid="text-completion-pct">{completionPct}%</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Complete</p>
              </div>
            </div>
          </div>
          <Progress value={completionPct} className="h-2 mt-4" />
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {isLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : verticals.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No artifacts configured</p>
              <p className="text-sm mt-1 opacity-60">Configure artifacts in the admin panel to see compliance status</p>
            </div>
          ) : (
            <>
            {rcPagination.paginatedItems.map((vertical) => {
              const isExpanded = expandedVerticals.has(vertical.key);
              return (
                <div key={vertical.key} className="rounded-xl border border-border/40 overflow-hidden" data-testid={`vertical-card-${vertical.key}`}>
                  <button
                    onClick={() => toggleVertical(vertical.key)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer text-left"
                    data-testid={`vertical-toggle-${vertical.key}`}
                  >
                    <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`} />
                    <StatusIcon status={vertical.status} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{vertical.name}</span>
                        <Badge variant="outline" className="text-[9px] font-mono">{vertical.key}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{vertical.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex items-center gap-2 text-[11px]">
                        <span className="text-emerald-400 font-mono font-bold">{vertical.summary.verified}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="font-mono font-bold">{vertical.summary.total}</span>
                      </div>
                      <Badge variant={statusBadgeVariant(vertical.status)} className="text-[10px]">
                        {statusLabel(vertical.status)}
                      </Badge>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-border/20">
                      {vertical.levels.map((level) => {
                        const hasItems = level.items.length > 0;
                        const allLevelDocs = level.items.flatMap(i => i.documents);
                        const scoredDocs = allLevelDocs.filter(d => d.complianceScore != null);
                        const avgScore = scoredDocs.length > 0 ? Math.round(scoredDocs.reduce((sum, d) => sum + (d.complianceScore || 0), 0) / scoredDocs.length) : null;
                        const levelAnalyzing = allLevelDocs.some(d => (d.complianceDetails as any)?.status === "analyzing");
                        return (
                          <button
                            key={level.level}
                            onClick={() => hasItems && setSelectedLevel({ vertical, level })}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                              hasItems ? "hover:bg-muted/30 cursor-pointer" : "opacity-40 cursor-default"
                            }`}
                            data-testid={`level-row-${vertical.key}-${level.level}`}
                          >
                            <StatusIcon status={level.status} />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-sm font-mono font-semibold w-7 shrink-0">L{level.level}</span>
                              <span className="text-sm text-muted-foreground">{LEVEL_LABELS[level.level] || ""}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {hasItems ? (
                                <>
                                  {levelAnalyzing && avgScore === null && (
                                    <Badge variant="outline" className="text-[10px] font-mono bg-blue-500/10 border-blue-500/30 text-blue-400" data-testid={`analyzing-${vertical.key}-${level.level}`}>
                                      <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                                      Analyzing
                                    </Badge>
                                  )}
                                  {avgScore !== null && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] font-mono ${
                                        avgScore >= 80
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                          : avgScore >= 60
                                          ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                                          : "bg-red-500/10 border-red-500/30 text-red-400"
                                      }`}
                                      data-testid={`compliance-avg-${vertical.key}-${level.level}`}
                                    >
                                      {avgScore}%
                                    </Badge>
                                  )}
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    {level.summary.verified > 0 && (
                                      <span className="flex items-center gap-0.5 text-emerald-400">
                                        <CheckCircle2 className="h-3 w-3" />
                                        {level.summary.verified}
                                      </span>
                                    )}
                                    {level.summary.draft > 0 && (
                                      <span className="flex items-center gap-0.5 text-amber-400">
                                        <AlertTriangle className="h-3 w-3" />
                                        {level.summary.draft}
                                      </span>
                                    )}
                                    {level.summary.missing > 0 && (
                                      <span className="flex items-center gap-0.5 text-red-400">
                                        <XCircle className="h-3 w-3" />
                                        {level.summary.missing}
                                      </span>
                                    )}
                                  </div>
                                  <Badge variant={statusBadgeVariant(level.status)} className="text-[10px]">
                                    {statusLabel(level.status)}
                                  </Badge>
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                </>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">No artifacts configured</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <PaginationControls
              currentPage={rcPagination.currentPage}
              totalPages={rcPagination.totalPages}
              totalItems={rcPagination.totalItems}
              startIndex={rcPagination.startIndex}
              endIndex={rcPagination.endIndex}
              onPageChange={rcPagination.goToPage}
            />
            </>
          )}
        </CardContent>
      </Card>

      {selectedLevel && (
        <LevelDetailDialog
          vertical={selectedLevel.vertical}
          level={selectedLevel.level}
          partnerId={partnerId}
          assessmentId={assessmentId}
          open={!!selectedLevel}
          onClose={() => setSelectedLevel(null)}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}

function LevelDetailDialog({ vertical, level, partnerId, assessmentId, open, onClose, isAdmin }: {
  vertical: VerticalEntry;
  level: LevelEntry;
  partnerId: string;
  assessmentId: string;
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingArtifactId, setUploadingArtifactId] = useState<string | null>(null);

  const [analyzingDocIds, setAnalyzingDocIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (analyzingDocIds.size === 0) return;
    const dispatch2 = dispatch;
    const interval = setInterval(() => {
      dispatch2(api.util.invalidateTags(["Assessment"]));
    }, 3000);
    return () => clearInterval(interval);
  }, [analyzingDocIds.size, assessmentId]);

  useEffect(() => {
    if (analyzingDocIds.size === 0) return;
    const allDocs = level.items.flatMap(i => i.documents);
    const stillAnalyzing = new Set<string>();
    for (const docId of analyzingDocIds) {
      const doc = allDocs.find(d => d.id === docId);
      if (doc) {
        const details = doc.complianceDetails as any;
        if (details?.status === "analyzing" || (!doc.complianceScore && !details?.error)) {
          stillAnalyzing.add(docId);
        }
      }
    }
    if (stillAnalyzing.size < analyzingDocIds.size) {
      setAnalyzingDocIds(stillAnalyzing);
      if (stillAnalyzing.size === 0) {
        toast({ title: "Analysis complete", description: "Document compliance analysis has finished." });
      }
    }
  }, [level.items, analyzingDocIds]);

  const handleUpload = async (item: ReportCardItem, file: File) => {
    setUploadingArtifactId(item.artifact.id);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (item.partnerArtifact) {
        formData.append("partnerArtifactId", item.partnerArtifact.id);
      }
      formData.append("artifactId", item.artifact.id);

      const res = await fetch(`/api/partners/${partnerId}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }

      const result = await res.json();
      dispatch(api.util.invalidateTags(["Assessment"]));

      if (result.analysisTriggered) {
        setAnalyzingDocIds(prev => new Set([...prev, result.id]));
        toast({
          title: "Document uploaded — analyzing",
          description: `${file.name} uploaded. Compliance analysis is running...`,
        });
      } else {
        toast({ title: "Document uploaded", description: `${file.name} has been uploaded successfully.` });
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingArtifactId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="px-6 pt-6 pb-4 border-b border-border/30 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <StatusIcon status={level.status} size="md" />
                {vertical.name}
                <Badge variant="outline" className="text-sm font-mono ml-1">{vertical.key}</Badge>
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Level {level.level} — {LEVEL_LABELS[level.level] || ""}
              </DialogDescription>
            </div>
            <Badge variant={statusBadgeVariant(level.status)} className="text-sm shrink-0 mt-1">
              {statusLabel(level.status)}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 p-2.5 text-center">
              <p className="text-lg font-mono font-bold text-emerald-400">{level.summary.verified}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Verified</p>
            </div>
            <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 p-2.5 text-center">
              <p className="text-lg font-mono font-bold text-amber-400">{level.summary.draft}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</p>
            </div>
            <div className="rounded-lg bg-red-500/8 border border-red-500/20 p-2.5 text-center">
              <p className="text-lg font-mono font-bold text-red-400">{level.summary.missing}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Missing</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Required Documents ({level.items.length})
          </p>

          <div className={`grid gap-3 ${level.items.length > 1 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
          {level.items.map((item) => (
            <div
              key={item.artifact.id}
              className={`rounded-lg border p-4 space-y-3 ${
                item.status === "verified"
                  ? "border-emerald-500/25 bg-emerald-500/3"
                  : item.status === "missing"
                    ? "border-red-500/20 bg-red-500/3"
                    : "border-amber-500/20 bg-amber-500/3"
              }`}
              data-testid={`dialog-artifact-${item.artifact.id}`}
            >
              <div className="flex items-start gap-3">
                <StatusIcon status={item.status} size="md" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{item.artifact.name}</p>
                    <Badge variant={statusBadgeVariant(item.status)} className="text-[10px]">
                      {statusLabel(item.status)}
                    </Badge>
                    {item.artifact.required && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">Required</Badge>
                    )}
                  </div>
                  {item.artifact.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.artifact.description}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5 text-sm bg-background/50 rounded-lg p-3">
                {item.artifact.regulation && (
                  <div>
                    <span className="text-muted-foreground">Regulation:</span>{" "}
                    <span className="font-medium">{item.artifact.regulation}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Method:</span>{" "}
                  <span className="font-medium capitalize">{item.artifact.verificationMethod?.replace(/_/g, " ")}</span>
                </div>
                {item.partnerArtifact?.verifiedBy && (
                  <div>
                    <span className="text-muted-foreground">Verified by:</span>{" "}
                    <span className="font-medium">{item.partnerArtifact.verifiedBy}</span>
                  </div>
                )}
                {item.partnerArtifact?.notes && (
                  <div className="col-span-2 md:col-span-4">
                    <span className="text-muted-foreground">Notes:</span>{" "}
                    <span className="font-medium">{item.partnerArtifact.notes}</span>
                  </div>
                )}
              </div>

              {item.artifact.policies && item.artifact.policies.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Related Policies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.artifact.policies.map((policy, idx) => (
                      <span key={idx}>
                        {item.artifact.policyLinks && item.artifact.policyLinks[idx] ? (
                          <a
                            href={item.artifact.policyLinks[idx]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline bg-primary/5 rounded-md px-2 py-1"
                          >
                            {policy}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{policy}</Badge>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {item.documents.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Uploaded Documents</p>
                  <div className="space-y-1.5">
                    {item.documents.map((doc) => {
                      const score = doc.complianceScore;
                      const details = doc.complianceDetails as any;
                      const isAnalyzing = details?.status === "analyzing" || analyzingDocIds.has(doc.id);
                      const hasScore = score !== null && score !== undefined;
                      const scoreColor = hasScore
                        ? score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400"
                        : "";
                      const scoreBg = hasScore
                        ? score >= 80 ? "bg-emerald-500/10 border-emerald-500/30" : score >= 60 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-red-500/10 border-red-500/30"
                        : "";
                      const scoreLabel = hasScore
                        ? score >= 80 ? "Compliant" : score >= 60 ? "Partial" : "Non-Compliant"
                        : "";

                      return (
                        <div key={doc.id} className="space-y-2" data-testid={`dialog-doc-${doc.id}`}>
                          <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                            isAnalyzing
                              ? "bg-blue-500/5 border border-blue-500/30 animate-pulse"
                              : "bg-background/60 border border-border/30"
                          }`}>
                            <FileText className={`h-4 w-4 shrink-0 ${isAnalyzing ? "text-blue-400" : "text-primary"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.fileName}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {(doc.fileSize / 1024).toFixed(0)} KB
                                {doc.uploadedAt && ` — ${new Date(doc.uploadedAt).toLocaleDateString()}`}
                              </p>
                            </div>
                            {hasScore && (
                              <Badge variant="outline" className={`text-[10px] shrink-0 ${scoreBg} ${scoreColor}`} data-testid={`compliance-score-${doc.id}`}>
                                {score >= 80 ? <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> : score >= 60 ? <AlertTriangle className="h-2.5 w-2.5 mr-1" /> : <XCircle className="h-2.5 w-2.5 mr-1" />}
                                {score}% — {scoreLabel}
                              </Badge>
                            )}
                            {isAnalyzing && !hasScore && (
                              <Badge variant="outline" className="text-[10px] shrink-0 bg-blue-500/10 border-blue-500/30 text-blue-400" data-testid={`compliance-analyzing-${doc.id}`}>
                                <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                                Analyzing...
                              </Badge>
                            )}
                            {!hasScore && !isAnalyzing && details?.error && (
                              <Badge variant="outline" className="text-[10px] shrink-0 bg-red-500/10 border-red-500/30 text-red-400" data-testid={`compliance-error-${doc.id}`}>
                                <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                                Analysis Failed
                              </Badge>
                            )}
                            <a href={`/api/documents/${doc.filePath}`} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm" className="h-7 text-sm gap-1.5" data-testid={`button-view-doc-${doc.id}`}>
                                <Eye className="h-3 w-3" />
                                View
                              </Button>
                            </a>
                          </div>

                          {isAdmin && hasScore && Array.isArray(details?.policyResults) && details.policyResults.length > 0 && (
                            <div className={`rounded-lg border px-3 py-2.5 space-y-2 ${scoreBg}`} data-testid={`compliance-breakdown-${doc.id}`}>
                              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Policy Compliance Breakdown</p>
                              {details.summary && (
                                <p className="text-xs text-muted-foreground italic">{details.summary}</p>
                              )}
                              <div className="space-y-1.5">
                                {(details.policyResults as any[]).map((pr: any, idx: number) => {
                                  const prColor = pr.status === "compliant" ? "text-emerald-400" : pr.status === "partial" ? "text-yellow-400" : "text-red-400";
                                  const prIcon = pr.status === "compliant" ? <CheckCircle2 className="h-3 w-3" /> : pr.status === "partial" ? <AlertTriangle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />;
                                  return (
                                    <div key={idx} className="flex items-start gap-2 text-xs" data-testid={`policy-result-${doc.id}-${idx}`}>
                                      <span className={`mt-0.5 shrink-0 ${prColor}`}>{prIcon}</span>
                                      <div className="flex-1 min-w-0">
                                        <span className="font-medium">{pr.policy}</span>
                                        {pr.score !== undefined && <span className={`ml-1.5 ${prColor}`}>({pr.score}%)</span>}
                                        {pr.reason && <p className="text-muted-foreground mt-0.5">{pr.reason}</p>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(item.status === "verified" && item.partnerArtifact?.verifiedBy?.includes("SAM")) && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">SAM.gov Source Document</p>
                  <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3 space-y-2" data-testid={`sam-doc-${item.artifact.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 shrink-0">
                        <Zap className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-400">{item.artifact.name}</p>
                        <p className="text-[10px] text-muted-foreground">Auto-verified via SAM.gov Federal Registry</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 shrink-0">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                        Verified
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-[11px] pl-10">
                      <div>
                        <span className="text-muted-foreground">Source:</span>{" "}
                        <span className="font-medium text-emerald-400/80">SAM.gov</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Verified by:</span>{" "}
                        <span className="font-medium">{item.partnerArtifact?.verifiedBy}</span>
                      </div>
                      {item.partnerArtifact?.documentRef && (
                        <div>
                          <span className="text-muted-foreground">Document Ref:</span>{" "}
                          <span className="font-mono font-medium">{item.partnerArtifact.documentRef}</span>
                        </div>
                      )}
                      {item.partnerArtifact?.verifiedAt && (
                        <div>
                          <span className="text-muted-foreground">Verified on:</span>{" "}
                          <span className="font-medium">{new Date(item.partnerArtifact.verifiedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      {item.artifact.regulation && (
                        <div className="col-span-2 md:col-span-3">
                          <span className="text-muted-foreground">Regulation:</span>{" "}
                          <span className="font-medium">{item.artifact.regulation}</span>
                        </div>
                      )}
                      {item.partnerArtifact?.notes && (
                        <div className="col-span-2 md:col-span-3">
                          <span className="text-muted-foreground">Notes:</span>{" "}
                          <span className="font-medium">{item.partnerArtifact.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {item.status !== "verified" && (
                <div className="pt-1">
                  <input
                    type="file"
                    className="hidden"
                    ref={fileRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(item, file);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    data-testid={`file-input-${item.artifact.id}`}
                  />
                  <Button
                    variant={item.status === "missing" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingArtifactId === item.artifact.id}
                    data-testid={`button-upload-${item.artifact.id}`}
                  >
                    {uploadingArtifactId === item.artifact.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {item.status === "missing" ? "Upload Document" : "Upload Another"}
                  </Button>
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
