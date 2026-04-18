import {
  useGetAdminPartnerCapabilitiesQuery, useGetPartnerCapabilityQuery, useGetFeedbackQuery, useGetArtifactsQuery,
  useUpdatePartnerCapabilityStatusMutation, useSendFeedbackMutation,
  api, apiRequest
} from "@/lib/api";
import { useAppDispatch } from "@/lib/store";
import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Send, CheckCircle, XCircle, Clock, MessageSquare, ChevronRight,
  Check, FileText, ExternalLink, Search, Loader2, Sparkles
} from "lucide-react";
import type { PartnerCapability, AssessmentFeedback, Artifact } from "@shared/schema";

type CapWithPartner = PartnerCapability & { partner: { id: string; name: string; cage: string | null } | null };

const ADMIN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  feedback_sent: "Feedback Sent",
  partner_responded: "Partner Responded",
  approved: "Verified",
  rejected: "Not Verified",
};

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  under_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  feedback_sent: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  partner_responded: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

const VERTICAL_CONFIG: Record<string, { title: string; anchor: string; levelDescriptions: Record<number, string> }> = {
  TRL: {
    title: "Technology Maturity",
    anchor: "Regulatory Anchor: DoDD 1100.4",
    levelDescriptions: { 1: "Basic principles observed", 2: "Technology concept formulated", 3: "Proof-of-concept demonstrated", 4: "Components validated in lab environment", 5: "Components validated in relevant environment", 6: "Prototype demonstrated in relevant environment", 7: "Prototype demonstrated in operational environment", 8: "System qualified through demonstration", 9: "System proven in mission ops." },
  },
  PRL: {
    title: "Policy & Legal",
    anchor: "Regulatory Anchor: DoDD 5000.01",
    levelDescriptions: { 1: "Policy constraints identified", 2: "Privacy impact assessed", 3: "LOAC review completed", 4: "Data rights established", 5: "Weapons legal review passed", 6: "PII/PHI compliance certified", 7: "Policy waivers documented", 8: "Legal authority confirmed", 9: "International clearance obtained" },
  },
  CRL: {
    title: "Cyber Security",
    anchor: "Regulatory Anchor: DoDI 8510.01",
    levelDescriptions: { 1: "Threat Awareness", 2: "RMF Categorization", 3: "Hygiene & MFA", 4: "Enclave Design", 5: "Controls Implemented", 6: "IL5/IL6 Accredited", 7: "Continuous Monitoring", 8: "Cyber Ops", 9: "Zero-Trust" },
  },
  IRL: {
    title: "Partnership & Integration",
    anchor: "Regulatory Anchor: DoDI 5000.88",
    levelDescriptions: { 1: "Interface Recognition", 2: "Interface Specs", 3: "Lab Integration", 4: "Subsystem Lab Val", 5: "Relevant Env", 6: "System-of-Systems", 7: "Multi-Service Val", 8: "Joint-Wide Certified", 9: "Continuous Integration" },
  },
  SCRL: {
    title: "Supply Chain",
    anchor: "Regulatory Anchor: NIST SP 800-161",
    levelDescriptions: { 1: "Ad-hoc Sourcing", 2: "Key Suppliers Listed", 3: "Tier-1 Alternates", 4: "SCRM Plan Formalized", 5: "Dual Sourcing Qualified", 6: "Geopolitical Assessment", 7: "Tier-2 Visibility", 8: "SBOM/Redundancy", 9: "Automated Monitoring" },
  },
  TVRL: {
    title: "Testing & Verification",
    anchor: "Regulatory Anchor: DoDI 5000.89",
    levelDescriptions: { 1: "Need Acknowledged", 2: "TEMP Created", 3: "Procedures Approved", 4: "Subsystem Validation", 5: "Certification Initiated", 6: "Docs Complete", 7: "OT&E Data Delivered", 8: "Safety Release Granted", 9: "Embedded Regression" },
  },
  MRL: {
    title: "Manufacturing",
    anchor: "Regulatory Anchor: DoD MRL Deskbook",
    levelDescriptions: { 1: "Feasibility", 2: "Materials/Proc", 3: "Lab-scale Build", 4: "Process Repeatable", 5: "Reproducible (Lab)", 6: "Relevant Build", 7: "Quality (DFARS)", 8: "LRIP Ready", 9: "Full-Rate" },
  },
  HRL: {
    title: "Human Engineering",
    anchor: "Regulatory Anchor: DoDD 1100.4",
    levelDescriptions: { 1: "Roles Identified", 2: "HF Plan Drafted", 3: "Mock-ups Tested", 4: "Human-in-the-Loop", 5: "Usability/Safety", 6: "Explainability/Training", 7: "Operators Trained", 8: "Doctrine/Trust", 9: "Combat Validation" },
  },
  AIRL: {
    title: "AI",
    anchor: "Regulatory Anchor: DoDD 1100.4",
    levelDescriptions: { 1: "Concept Recognized", 2: "Data Pipeline", 3: "Dataset Curated", 4: "Baseline/Bias", 5: "Ground Truth/XAI", 6: "Robustness", 7: "MLOps/cATO", 8: "Ops Retraining", 9: "Continuous Red-Teaming" },
  },
};

const SECTION_LABELS: Record<string, string> = {
  basic_info: "Basic Info",
  TRL: "Technology Readiness",
  PRL: "Policy & Legal",
  CRL: "Cyber Security",
  IRL: "Partnership & Integration",
  SCRL: "Supply Chain",
  TVRL: "Testing & Verification",
  MRL: "Manufacturing",
  HRL: "Human Engineering",
  AIRL: "AI",
};

const TAB_GROUPS: { key: string; label: string; subItems: { key: string; label: string }[] }[] = [
  {
    key: "governance", label: "Governance",
    subItems: [
      { key: "governance_basic", label: "Basic Info & TRL" },
      { key: "PRL", label: "Policy & Legal" },
      { key: "CRL", label: "Cyber Security" },
      { key: "IRL", label: "Partnership & Integration" },
    ],
  },
  {
    key: "operational", label: "Operational",
    subItems: [
      { key: "SCRL", label: "Supply Chain" },
      { key: "TVRL", label: "Testing & Verification" },
      { key: "MRL", label: "Manufacturing" },
      { key: "HRL", label: "Human Engineering" },
      { key: "AIRL", label: "AI" },
    ],
  },
];

export default function PartnerAssessment() {
  const [selectedCap, setSelectedCap] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: capabilities, isLoading } = useGetAdminPartnerCapabilitiesQuery(undefined, { refetchOnMountOrArgChange: true });

  const filtered = useMemo(() => {
    if (!capabilities) return [];
    if (!search.trim()) return capabilities;
    const q = search.toLowerCase();
    return capabilities.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.partner?.name || "").toLowerCase().includes(q) ||
      (c.partner?.cage || "").toLowerCase().includes(q) ||
      (c.offeringType || "").toLowerCase().includes(q) ||
      (ADMIN_STATUS_LABELS[c.status] || "").toLowerCase().includes(q)
    );
  }, [capabilities, search]);

  if (selectedCap) {
    return <AssessmentReview capId={selectedCap} onBack={() => setSelectedCap(null)} />;
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const grouped = {
    pending: filtered.filter(c => ["submitted", "partner_responded"].includes(c.status)),
    inProgress: filtered.filter(c => ["under_review", "feedback_sent"].includes(c.status)),
    completed: filtered.filter(c => ["approved", "rejected"].includes(c.status)),
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <h1 className="text-xl font-semibold mb-4" data-testid="text-partner-assessment-title">Partner Assessment</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by capability name, partner, CAGE code, or status..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-assessments"
        />
      </div>

      <div className="space-y-8">
        <AssessmentGroup title="Awaiting Review" items={grouped.pending} onSelect={setSelectedCap} emptyText="No submissions awaiting review" />
        <AssessmentGroup title="In Progress" items={grouped.inProgress} onSelect={setSelectedCap} emptyText="No assessments in progress" />
        <AssessmentGroup title="Completed" items={grouped.completed} onSelect={setSelectedCap} emptyText="No completed assessments" />
      </div>
    </div>
  );
}

function AssessmentGroup({ title, items, onSelect, emptyText }: {
  title: string;
  items: CapWithPartner[];
  onSelect: (id: string) => void;
  emptyText: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3" data-testid={`text-group-${title.toLowerCase().replace(/\s/g, "-")}`}>{title} ({items.length})</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground/60 italic">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {items.map(cap => (
            <Card key={cap.id} className="border-border/40 cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => onSelect(cap.id)} data-testid={`card-assessment-${cap.id}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold" data-testid={`text-assessment-name-${cap.id}`}>{cap.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cap.partner?.name || "Unknown Partner"} {cap.partner?.cage ? `(CAGE: ${cap.partner.cage})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cap.offeringType} &middot; Updated {cap.updatedAt ? new Date(cap.updatedAt).toLocaleDateString() : "N/A"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`text-[10px] border ${STATUS_COLORS[cap.status] || ""}`} variant="outline" data-testid={`badge-status-${cap.id}`}>
                    {ADMIN_STATUS_LABELS[cap.status] || cap.status}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AssessmentReview({ capId, onBack }: { capId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [activeGroup, setActiveGroup] = useState("governance");
  const [activeSubItem, setActiveSubItem] = useState("governance_basic");
  const analyzePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ scored: number; total: number; currentDoc?: string } | null>(null);

  useEffect(() => {
    return () => {
      if (analyzePollingRef.current) clearInterval(analyzePollingRef.current);
    };
  }, []);

  const dispatch = useAppDispatch();
  const { data: capability, isLoading: capLoading } = useGetPartnerCapabilityQuery(capId, { refetchOnMountOrArgChange: true });

  const { data: feedback, isLoading: fbLoading } = useGetFeedbackQuery(capId, { refetchOnMountOrArgChange: true });

  const { data: allArtifacts } = useGetArtifactsQuery();

  const [updateStatusApi] = useUpdatePartnerCapabilityStatusMutation();

  const statusMutation = { mutate: async (status: string) => {
    try {
      await updateStatusApi({ id: capId, status }).unwrap();
      toast({ title: "Status updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.data || err.message, variant: "destructive" });
    }
  }, isPending: false };

  const [analyzePending, setAnalyzePending] = useState(false);
  const analyzeMutation = { mutate: async () => {
    setAnalyzePending(true);
    try {
      await apiRequest("POST", `/api/partner-capabilities/${capId}/analyze`, {});
      const sels = (capability as any)?.verticalSelections || {};
      const allDocsList = Object.values(sels).flatMap((s: any) => s.uploadedDocs || []);
      const totalDocs = allDocsList.length;
      setAnalyzeProgress({ scored: 0, total: totalDocs, currentDoc: allDocsList[0]?.fileName || "" });

      if (analyzePollingRef.current) clearInterval(analyzePollingRef.current);
      let polls = 0;
      const maxPolls = 60;
      analyzePollingRef.current = setInterval(async () => {
        polls++;
        try {
          const res = await fetch(`/api/partner-capabilities/${capId}?_t=${Date.now()}`, { credentials: "include", cache: "no-store" });
          if (!res.ok) return;
          const updated = await res.json();
          const allDocs = Object.values(updated.verticalSelections || {}).flatMap((s: any) => s.uploadedDocs || []);
          const scored = allDocs.filter((d: any) => d.complianceScore !== undefined && d.complianceScore !== null).length;
          const nextUnscored = allDocs.find((d: any) => d.complianceScore === undefined || d.complianceScore === null);
          setAnalyzeProgress({ scored, total: allDocs.length, currentDoc: nextUnscored?.fileName || "" });
          if (scored >= allDocs.length) {
            if (analyzePollingRef.current) clearInterval(analyzePollingRef.current);
            analyzePollingRef.current = null;
            setAnalyzeProgress(null);
            dispatch(api.util.invalidateTags(["PartnerCapabilities", "PartnerCapability"]));
            toast({ title: "AI Assessment Complete", description: `All ${scored} document(s) scored.` });
          }
        } catch {}
        if (polls >= maxPolls) {
          if (analyzePollingRef.current) clearInterval(analyzePollingRef.current);
          analyzePollingRef.current = null;
          setAnalyzeProgress(null);
          dispatch(api.util.invalidateTags(["PartnerCapabilities", "PartnerCapability"]));
        }
      }, 3000);
    } catch (err: any) {
      setAnalyzeProgress(null);
      toast({ title: "Analysis failed", description: err.data || err.message, variant: "destructive" });
    } finally {
      setAnalyzePending(false);
    }
  }, isPending: analyzePending };

  if (capLoading || fbLoading) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-[200px] mb-6" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!capability) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <p className="text-sm text-muted-foreground mt-4">Capability not found.</p>
      </div>
    );
  }

  const verticalSelections = capability.verticalSelections as Record<string, any> || {};
  const feedbackBySection: Record<string, AssessmentFeedback[]> = {};
  (feedback || []).forEach(fb => {
    if (!feedbackBySection[fb.section]) feedbackBySection[fb.section] = [];
    feedbackBySection[fb.section].push(fb);
  });

  const allDocs = Object.values(verticalSelections).flatMap((sel: any) => sel.uploadedDocs || []);
  const hasAnyDocs = allDocs.length > 0;
  const hasAnyScored = allDocs.some((d: any) => d.complianceScore !== undefined && d.complianceScore !== null);

  const materials = capability.materials as any[] || [];
  const statusLabel = ADMIN_STATUS_LABELS[capability.status] || capability.status;

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-assessment">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <h1 className="text-xl font-bold mb-4" data-testid="text-review-title">{capability.name}</h1>

      <Card className="border-border/40 mb-6">
        <CardContent className="p-5">
          <div className="flex gap-6">
            <div className="w-[180px] h-[120px] rounded-lg overflow-hidden bg-muted/40 shrink-0">
              {capability.imagePath ? (
                <img
                  src={`/api/documents/${encodeURIComponent(capability.imagePath)}`}
                  alt={capability.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-muted/60 to-muted/20">
                  <FileText className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-base font-semibold">Product Overview</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-[10px] border ${STATUS_COLORS[capability.status] || ""}`} variant="outline">
                      {statusLabel}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {capability.partner?.name || "Unknown"} {capability.partner?.cage ? `(CAGE: ${capability.partner.cage})` : ""}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{capability.offeringType}</p>
              {capability.description && (
                <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">{capability.description}</p>
              )}
              {capability.problemStatement && (
                <p className="text-xs text-muted-foreground/70 mt-1 italic">{capability.problemStatement}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {materials.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Uploaded Materials</p>
          <div className="flex flex-wrap gap-2">
            {materials.map((doc: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/20 border border-border/30">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs truncate max-w-[200px]">{doc.fileName}</span>
                <a
                  href={`/api/documents/${encodeURIComponent(doc.filePath)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-base font-semibold mb-3" data-testid="text-assessment-sections">{capability.name} Capabilities</h2>

      <div className="flex gap-1 mb-4 border-b border-border/40 pb-0">
        {TAB_GROUPS.map(group => {
          const isActive = activeGroup === group.key;
          return (
            <button
              key={group.key}
              className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80"
              }`}
              onClick={() => {
                setActiveGroup(group.key);
                setActiveSubItem(group.subItems[0].key);
              }}
              data-testid={`admin-tab-${group.key}`}
            >
              {group.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {(() => {
        const currentGroup = TAB_GROUPS.find(g => g.key === activeGroup);
        if (!currentGroup) return null;

        return (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              {currentGroup.subItems.map(sub => {
                const isActive = activeSubItem === sub.key;
                return (
                  <button
                    key={sub.key}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                      isActive
                        ? "bg-primary/20 border-primary/40 text-foreground font-medium"
                        : "bg-muted/10 border-border/40 text-muted-foreground hover:bg-muted/20"
                    }`}
                    onClick={() => setActiveSubItem(sub.key)}
                    data-testid={`admin-subtab-${sub.key}`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>

            {activeSubItem === "governance_basic" ? (
              <AdminGovernanceContent
                capability={capability}
                verticalSelections={verticalSelections}
                allArtifacts={allArtifacts || []}
                capId={capId}
                feedbackBySection={feedbackBySection}
              />
            ) : (
              <VerticalReadOnly
                verticalKey={activeSubItem}
                selection={verticalSelections[activeSubItem]}
                allArtifacts={allArtifacts || []}
                capId={capId}
                feedbackItems={feedbackBySection[activeSubItem] || []}
              />
            )}
          </>
        );
      })()}

      {["submitted", "under_review", "partner_responded"].includes(capability.status) && (
        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-end gap-3 p-4 rounded-lg border border-border/40 bg-muted/5">
          {hasAnyDocs && (
            <div className="flex items-center gap-3 mr-auto">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending || analyzeProgress !== null}
                data-testid="button-analyze-docs"
              >
                {(analyzeMutation.isPending || analyzeProgress !== null) ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                {(analyzeMutation.isPending || analyzeProgress !== null) ? "Assessing..." : "AI Assess Documents"}
              </Button>
              {analyzeProgress && (
                <div className="flex items-center gap-3" data-testid="analyze-progress-bar">
                  <Progress
                    value={analyzeProgress.total > 0 ? (analyzeProgress.scored / analyzeProgress.total) * 100 : 0}
                    className="h-2 w-32"
                  />
                  <span className="text-[11px] font-mono text-primary whitespace-nowrap">
                    {analyzeProgress.scored}/{analyzeProgress.total}
                  </span>
                  {analyzeProgress.currentDoc && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                      {analyzeProgress.currentDoc}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => statusMutation.mutate("feedback_sent")}
            disabled={statusMutation.isPending}
            data-testid="button-send-feedback"
          >
            <Send className="h-3 w-3 mr-1" /> Send Feedback
          </Button>
          <Button
            size="sm"
            className="text-xs bg-green-600 hover:bg-green-700"
            onClick={() => statusMutation.mutate("approved")}
            disabled={statusMutation.isPending}
            data-testid="button-approve"
          >
            <CheckCircle className="h-3 w-3 mr-1" /> Verified
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="text-xs"
            onClick={() => statusMutation.mutate("rejected")}
            disabled={statusMutation.isPending}
            data-testid="button-reject"
          >
            <XCircle className="h-3 w-3 mr-1" /> Not Verified
          </Button>
          </div>
        </div>
      )}
    </div>
  );
}


function AdminGovernanceContent({ capability, verticalSelections, allArtifacts, capId, feedbackBySection }: {
  capability: CapWithPartner;
  verticalSelections: Record<string, any>;
  allArtifacts: Artifact[];
  capId: string;
  feedbackBySection: Record<string, AssessmentFeedback[]>;
}) {
  const trlSelection = verticalSelections["TRL"];
  const hasTRL = trlSelection && trlSelection.level;

  return (
    <div className="space-y-8">
      <Card className="border-border/40">
        <CardContent className="p-5">
          <h3 className="text-base font-semibold mb-3">Basic Information</h3>
          <div className="space-y-3">
            <ReadOnlyField label="Offering Name" value={capability.name} />
            <ReadOnlyField label="Offering Type" value={capability.offeringType} />
            {capability.description && <ReadOnlyField label="Description" value={capability.description} />}
            {capability.problemStatement && <ReadOnlyField label="Problem Statement" value={capability.problemStatement} />}
            {capability.additionalInfo && <ReadOnlyField label="Additional Information" value={capability.additionalInfo as string} />}
          </div>
        </CardContent>
      </Card>

      <FeedbackSection sectionKey="basic_info" capId={capId} feedbackItems={feedbackBySection["basic_info"] || []} />

      {hasTRL && (
        <VerticalReadOnly
          verticalKey="TRL"
          selection={trlSelection}
          allArtifacts={allArtifacts}
          capId={capId}
          feedbackItems={feedbackBySection["TRL"] || []}
        />
      )}
    </div>
  );
}

function VerticalReadOnly({ verticalKey, selection, allArtifacts, capId, feedbackItems }: {
  verticalKey: string;
  selection: any;
  allArtifacts: Artifact[];
  capId: string;
  feedbackItems: AssessmentFeedback[];
}) {
  const { toast } = useToast();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const config = VERTICAL_CONFIG[verticalKey];
  const [sectionProgress, setSectionProgress] = useState<{ scored: number; total: number; currentDoc?: string } | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  if (!config || !selection) return null;

  const selectedLevel = selection.level || 0;
  const checkedArtifacts: string[] = selection.checkedArtifacts || [];
  const uploadedDocs: any[] = selection.uploadedDocs || [];

  const dispatch = useAppDispatch();
  const [sectionAnalyzePending, setSectionAnalyzePending] = useState(false);
  const sectionAnalyzeMutation = { mutate: async () => {
    setSectionAnalyzePending(true);
    try {
      await apiRequest("POST", `/api/partner-capabilities/${capId}/analyze`, { vertical: verticalKey });
      const sectionDocs = uploadedDocs.length;
      const firstDoc = uploadedDocs[0]?.fileName || "";
      setSectionProgress({ scored: 0, total: sectionDocs, currentDoc: firstDoc });

      if (pollingRef.current) clearInterval(pollingRef.current);
      let polls = 0;
      const maxPolls = 30;
      pollingRef.current = setInterval(async () => {
        polls++;
        try {
          const res = await fetch(`/api/partner-capabilities/${capId}?_t=${Date.now()}`, { credentials: "include", cache: "no-store" });
          if (!res.ok) return;
          const updated = await res.json();
          const docs = updated.verticalSelections?.[verticalKey]?.uploadedDocs || [];
          const scored = docs.filter((d: any) => d.complianceScore !== undefined && d.complianceScore !== null).length;
          const nextUnscored = docs.find((d: any) => d.complianceScore === undefined || d.complianceScore === null);
          setSectionProgress({ scored, total: docs.length, currentDoc: nextUnscored?.fileName || "" });
          if (scored >= docs.length) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            setSectionProgress(null);
            dispatch(api.util.invalidateTags(["PartnerCapabilities", "PartnerCapability"]));
            toast({ title: "AI Assessment Complete", description: `${scored} document(s) scored for ${config?.title || verticalKey}.` });
          }
        } catch {}
        if (polls >= maxPolls) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setSectionProgress(null);
          dispatch(api.util.invalidateTags(["PartnerCapabilities", "PartnerCapability"]));
        }
      }, 3000);
    } catch (err: any) {
      setSectionProgress(null);
      toast({ title: "Analysis failed", description: err.data || err.message, variant: "destructive" });
    } finally {
      setSectionAnalyzePending(false);
    }
  }, isPending: sectionAnalyzePending };

  const verticalArtifactsFromDB = allArtifacts.filter(a => a.vertical === verticalKey);
  const artifactsByLevel: Record<number, Artifact[]> = {};
  verticalArtifactsFromDB.forEach(a => {
    if (!artifactsByLevel[a.level]) artifactsByLevel[a.level] = [];
    artifactsByLevel[a.level].push(a);
  });

  const allArtifactsForVertical: Artifact[] = [];
  for (let l = 1; l <= 9; l++) {
    if (artifactsByLevel[l]) allArtifactsForVertical.push(...artifactsByLevel[l]);
  }

  const checkedCount = checkedArtifacts.length;
  const totalCount = allArtifactsForVertical.length;
  const unchecked = allArtifactsForVertical.filter(a => !checkedArtifacts.includes(a.id) && !checkedArtifacts.includes(a.name));
  const checked = allArtifactsForVertical.filter(a => checkedArtifacts.includes(a.id) || checkedArtifacts.includes(a.name));

  return (
    <div className="space-y-6">
      <Card className="border-border/40" data-testid={`card-summary-${verticalKey}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold">{config.title} Summary</h3>
              <p className="text-xs text-muted-foreground">{config.anchor}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-2">
            <div className="text-center p-3 rounded-lg bg-muted/10 border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Artifacts Verified</p>
              <p className="text-lg font-bold">{checkedCount} of {totalCount}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/10 border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Documents on File</p>
              <p className="text-lg font-bold">{uploadedDocs.length} Document{uploadedDocs.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/10 border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Maturity Level</p>
              <p className="text-lg font-bold">Level {selectedLevel}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {unchecked.length > 0 && (
        <Card className="border-border/40">
          <CardContent className="p-5">
            <p className="text-sm font-medium mb-3">Pending Documents to be Completed</p>
            <div className="space-y-3">
              {unchecked.map(artifact => (
                <div key={artifact.id} className="flex items-center gap-3 py-1.5 border-b border-border/20 last:border-0" data-testid={`admin-artifact-${artifact.id}`}>
                  <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                  <span className="text-sm flex-1">{artifact.name}</span>
                  {artifact.policyLinks?.[0] && (
                    <a href={artifact.policyLinks[0]} target="_blank" rel="noopener noreferrer" className="text-primary/60 hover:text-primary shrink-0" title={artifact.policies?.[0] || "View Policy"}>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {checked.length > 0 && (
        <Card className="border-border/40">
          <CardContent className="p-5">
            <p className="text-sm font-medium mb-3">Completed Items</p>
            <div className="space-y-3">
              {checked.map(artifact => (
                <div key={artifact.id} className="flex items-center gap-3 py-1.5 border-b border-border/20 last:border-0" data-testid={`admin-artifact-checked-${artifact.id}`}>
                  <div className="h-5 w-5 rounded-full bg-primary border-2 border-primary flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                  <span className="text-sm flex-1">{artifact.name}</span>
                  {artifact.policyLinks?.[0] && (
                    <a href={artifact.policyLinks[0]} target="_blank" rel="noopener noreferrer" className="text-primary/60 hover:text-primary shrink-0" title={artifact.policies?.[0] || "View Policy"}>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {uploadedDocs.length > 0 && (
        <Card className="border-border/40">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Supporting Documents</p>
              <Button
                size="sm"
                variant="outline"
                className="text-[11px] h-7 px-2.5"
                onClick={() => sectionAnalyzeMutation.mutate()}
                disabled={sectionAnalyzeMutation.isPending || sectionProgress !== null}
                data-testid={`button-analyze-docs-${verticalKey}`}
              >
                {(sectionAnalyzeMutation.isPending || sectionProgress !== null) ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                {(sectionAnalyzeMutation.isPending || sectionProgress !== null) ? "Assessing..." : "AI Score"}
              </Button>
            </div>
            {sectionProgress && (
              <div className="mb-3 p-2.5 rounded-md border border-border/30 bg-muted/10" data-testid={`section-progress-${verticalKey}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span>Scoring documents...</span>
                  </div>
                  <span className="text-[11px] font-mono text-primary">
                    {sectionProgress.total > 0 ? Math.round((sectionProgress.scored / sectionProgress.total) * 100) : 0}%
                  </span>
                </div>
                <Progress
                  value={sectionProgress.total > 0 ? (sectionProgress.scored / sectionProgress.total) * 100 : 0}
                  className="h-1.5"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-muted-foreground">
                    {sectionProgress.scored}/{sectionProgress.total} scored
                  </p>
                  {sectionProgress.currentDoc && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                      {sectionProgress.currentDoc}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2">
              {uploadedDocs.map((doc: any, idx: number) => {
                const cs = doc.complianceScore;
                const hasScore = cs !== undefined && cs !== null;
                const details = doc.complianceDetails;
                return (
                  <div key={idx} className="rounded-md bg-muted/20 border border-border/30">
                    <div className="flex items-center gap-2 p-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{doc.fileName}</span>
                      <span className="text-[10px] text-muted-foreground">{doc.option}</span>
                      {hasScore && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono shrink-0 ${
                              cs >= 80 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : cs >= 60 ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                              : "bg-red-500/10 border-red-500/30 text-red-400"
                            }`}
                            data-testid={`doc-score-${verticalKey}-${idx}`}
                          >
                            {cs}/100
                          </Badge>
                          {doc.scoredAt && (
                            <span className="text-[9px] text-muted-foreground whitespace-nowrap" data-testid={`doc-scored-at-${verticalKey}-${idx}`}>
                              {new Date(doc.scoredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                              {new Date(doc.scoredAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      )}
                      {!hasScore && details?.error && (
                        <Badge variant="outline" className="text-[10px] shrink-0 bg-orange-500/10 border-orange-500/30 text-orange-400">
                          Failed
                        </Badge>
                      )}
                      <a
                        href={`/api/documents/${encodeURIComponent(doc.filePath)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                        data-testid={`link-doc-${verticalKey}-${idx}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    {!hasScore && details?.error && (
                      <div className="px-3 pb-2 text-[11px] text-orange-400">{details.error}</div>
                    )}
                    {hasScore && details?.policyResults && Array.isArray(details.policyResults) && (
                      <div className="px-3 pb-2.5 space-y-1.5">
                        <p className="text-[10px] text-muted-foreground font-medium">Policy Breakdown:</p>
                        {details.policyResults.map((pr: any, pIdx: number) => (
                          <div key={pIdx} className="text-[11px] space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${
                                pr.status === "compliant" ? "bg-emerald-400" : pr.status === "partial" ? "bg-yellow-400" : "bg-red-400"
                              }`} />
                              <span className="font-medium">{pr.policy}</span>
                              <span className={`font-mono shrink-0 ml-auto ${
                                pr.score >= 80 ? "text-emerald-400" : pr.score >= 60 ? "text-yellow-400" : "text-red-400"
                              }`}>{pr.score}/100</span>
                            </div>
                            {pr.reason && (
                              <p className="text-muted-foreground ml-[18px] leading-relaxed">{pr.reason}</p>
                            )}
                          </div>
                        ))}
                        {details.summary && (
                          <p className="text-[10px] text-muted-foreground italic mt-1">{details.summary}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selection.compliance && (
        <Card className="border-border/40">
          <CardContent className="p-5">
            <p className="text-sm font-semibold mb-2">Self-Declaration</p>
            <div className="py-2 px-3 rounded-md border border-border/40 bg-muted/10 text-sm">
              {selection.compliance === "compliant" ? "Compliant" : selection.compliance === "partial" ? "Partially Compliant" : selection.compliance}
            </div>
            {selection.complianceRemarks && (
              <div className="mt-3">
                <ReadOnlyField label="Compliance Remarks" value={selection.complianceRemarks} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <FeedbackSection sectionKey={verticalKey} capId={capId} feedbackItems={feedbackItems} />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="py-2 px-3 rounded-md border border-border/40 bg-muted/10 text-sm whitespace-pre-wrap">
        {value}
      </div>
    </div>
  );
}

function FeedbackSection({ sectionKey, capId, feedbackItems }: {
  sectionKey: string;
  capId: string;
  feedbackItems: AssessmentFeedback[];
}) {
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const [sendFeedbackApi, { isLoading: feedbackPending }] = useSendFeedbackMutation();
  const feedbackMutation = { mutate: async () => {
    try {
      await sendFeedbackApi({ capabilityId: capId, data: { section: sectionKey, message } }).unwrap();
      setMessage("");
      toast({ title: "Feedback submitted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.data || err.message, variant: "destructive" });
    }
  }, isPending: feedbackPending };

  return (
    <div className="space-y-4">
      {feedbackItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audit Trail</p>
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
                  <Badge variant="outline" className="text-[9px] ml-2">{fb.role}</Badge>
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {fb.createdAt ? new Date(fb.createdAt).toLocaleString() : ""}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{fb.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Textarea
          placeholder={`Add suggestion for ${SECTION_LABELS[sectionKey] || sectionKey}...`}
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="min-h-[80px] text-sm"
          data-testid={`textarea-feedback-${sectionKey}`}
        />
        <Button
          size="sm"
          className="text-xs"
          onClick={() => feedbackMutation.mutate()}
          disabled={!message.trim() || feedbackMutation.isPending}
          data-testid={`button-submit-feedback-${sectionKey}`}
        >
          <Send className="h-3 w-3 mr-1" />
          {feedbackMutation.isPending ? "Sending..." : "Add Suggestion"}
        </Button>
      </div>
    </div>
  );
}
