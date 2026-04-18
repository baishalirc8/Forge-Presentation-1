import { useGetPartnerQuery, useGetAdminPartnerCapabilitiesQuery, useGetPartnerCapabilitiesQuery, useGetFeedbackQuery, useGetArtifactsQuery } from "@/lib/api";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import type { Partner, PartnerCapability } from "@shared/schema";
import { PARTNER_CAPABILITY_STATUS_LABELS, type PartnerCapabilityStatus } from "@shared/schema";
import { ArrowLeft, Building2, CheckCircle2, ChevronRight, ExternalLink, FileText } from "lucide-react";
import { useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  under_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  feedback_sent: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  partner_responded: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

const ADMIN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  feedback_sent: "Feedback Sent",
  partner_responded: "Partner Responded",
  approved: "Verified",
  rejected: "Not Verified",
};

export default function PartnerDetail() {
  const params = useParams<{ id: string }>();
  const partnerId = params.id;
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedCap, setSelectedCap] = useState<string | null>(null);

  const { data: partner, isLoading } = useGetPartnerQuery(partnerId!, { skip: !partnerId });

  const { data: adminCaps, isLoading: adminCapsLoading } = useGetAdminPartnerCapabilitiesQuery(undefined, { skip: !partnerId || !isAdmin });
  const { data: partnerCaps, isLoading: partnerCapsLoading } = useGetPartnerCapabilitiesQuery(undefined, { skip: !partnerId || isAdmin });
  const capabilities = isAdmin ? adminCaps : partnerCaps;
  const capsLoading = isAdmin ? adminCapsLoading : partnerCapsLoading;

  if (selectedCap) {
    return <AdminCapabilityView capId={selectedCap} onBack={() => setSelectedCap(null)} partnerId={partnerId} />;
  }

  if (isLoading) {
    return (
      <div className="p-3 space-y-3 mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground">
        <Building2 className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Partner not found</p>
        <Link href="/partners">
          <Button variant="outline" size="sm" className="mt-3">Back to Partners</Button>
        </Link>
      </div>
    );
  }

  const filteredCaps = isAdmin
    ? (capabilities || [])
    : (capabilities || []).filter(c => c.partnerId === partnerId);

  return (
    <div className="p-3 space-y-4 mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/partners">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate" data-testid="text-partner-name">
            {partner.name}
          </h1>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            <span className="text-sm text-muted-foreground font-mono">UEI: {partner.uei}</span>
            {partner.cage && <span className="text-sm text-muted-foreground font-mono">CAGE: {partner.cage}</span>}
            {partner.samRegistered && (
              <span className="text-sm text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                SAM.gov Verified
              </span>
            )}
          </div>
        </div>
      </div>

      <Card className="border-border/40">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-4" data-testid="text-capabilities-title">
            Submitted Capabilities ({filteredCaps.length})
          </h2>
          {capsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : filteredCaps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No capabilities submitted</p>
              <p className="text-sm mt-1 opacity-60">This partner has not submitted any capabilities yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCaps.map(cap => {
                const statusLabel = ADMIN_STATUS_LABELS[cap.status] || cap.status;
                return (
                  <div
                    key={cap.id}
                    className="flex items-center gap-4 p-3 rounded-md border border-border/30 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedCap(cap.id)}
                    data-testid={`card-capability-${cap.id}`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/40 shrink-0 overflow-hidden">
                      {cap.imagePath ? (
                        <img
                          src={`/api/documents/${encodeURIComponent(cap.imagePath)}`}
                          alt={cap.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-cap-name-${cap.id}`}>{cap.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {cap.offeringType} &middot; Updated {cap.updatedAt ? new Date(cap.updatedAt).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className={`text-[10px] border ${STATUS_COLORS[cap.status] || ""}`} variant="outline">
                        {statusLabel}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdminCapabilityView({ capId, onBack, partnerId }: { capId: string; onBack: () => void; partnerId: string }) {
  const { data: capability, isLoading: capLoading } = useGetPartnerCapabilityQuery(capId);

  const { data: feedback } = useGetFeedbackQuery(capId);

  const { data: allArtifacts } = useGetArtifactsQuery();

  const [activeGroup, setActiveGroup] = useState("governance");
  const [activeSubItem, setActiveSubItem] = useState("governance_basic");

  if (capLoading) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-[200px] mb-6" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (!capability) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-cap">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <p className="text-sm text-muted-foreground mt-4">Capability not found.</p>
      </div>
    );
  }

  const verticalSelections = capability.verticalSelections as Record<string, any> || {};
  const feedbackBySection: Record<string, any[]> = {};
  (feedback || []).forEach((fb: any) => {
    if (!feedbackBySection[fb.section]) feedbackBySection[fb.section] = [];
    feedbackBySection[fb.section].push(fb);
  });
  const materials = capability.materials as any[] || [];
  const statusLabel = ADMIN_STATUS_LABELS[capability.status] || capability.status;

  const TAB_GROUPS = [
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

  const VERTICAL_CONFIG: Record<string, { title: string; anchor: string; levelDescriptions: Record<number, string> }> = {
    TRL: { title: "Technology Maturity", anchor: "Regulatory Anchor: DoDD 1100.4", levelDescriptions: { 1: "Basic principles observed", 2: "Technology concept formulated", 3: "Proof-of-concept demonstrated", 4: "Components validated in lab environment", 5: "Components validated in relevant environment", 6: "Prototype demonstrated in relevant environment", 7: "Prototype demonstrated in operational environment", 8: "System qualified through demonstration", 9: "System proven in mission ops." } },
    PRL: { title: "Policy & Legal", anchor: "Regulatory Anchor: DoDD 5000.01", levelDescriptions: { 1: "Policy constraints identified", 2: "Privacy impact assessed", 3: "LOAC review completed", 4: "Data rights established", 5: "Weapons legal review passed", 6: "PII/PHI compliance certified", 7: "Policy waivers documented", 8: "Legal authority confirmed", 9: "International clearance obtained" } },
    CRL: { title: "Cyber Security", anchor: "Regulatory Anchor: DoDI 8510.01", levelDescriptions: { 1: "Threat Awareness", 2: "RMF Categorization", 3: "Hygiene & MFA", 4: "Enclave Design", 5: "Controls Implemented", 6: "IL5/IL6 Accredited", 7: "Continuous Monitoring", 8: "Cyber Ops", 9: "Zero-Trust" } },
    IRL: { title: "Partnership & Integration", anchor: "Regulatory Anchor: DoDI 5000.88", levelDescriptions: { 1: "Interface Recognition", 2: "Interface Specs", 3: "Lab Integration", 4: "Subsystem Lab Val", 5: "Relevant Env", 6: "System-of-Systems", 7: "Multi-Service Val", 8: "Joint-Wide Certified", 9: "Continuous Integration" } },
    SCRL: { title: "Supply Chain", anchor: "Regulatory Anchor: NIST SP 800-161", levelDescriptions: { 1: "Ad-hoc Sourcing", 2: "Key Suppliers Listed", 3: "Tier-1 Alternates", 4: "SCRM Plan Formalized", 5: "Dual Sourcing Qualified", 6: "Geopolitical Assessment", 7: "Tier-2 Visibility", 8: "SBOM/Redundancy", 9: "Automated Monitoring" } },
    TVRL: { title: "Testing & Verification", anchor: "Regulatory Anchor: DoDI 5000.89", levelDescriptions: { 1: "Need Acknowledged", 2: "TEMP Created", 3: "Procedures Approved", 4: "Subsystem Validation", 5: "Certification Initiated", 6: "Docs Complete", 7: "OT&E Data Delivered", 8: "Safety Release Granted", 9: "Embedded Regression" } },
    MRL: { title: "Manufacturing", anchor: "Regulatory Anchor: DoD MRL Deskbook", levelDescriptions: { 1: "Feasibility", 2: "Materials/Proc", 3: "Lab-scale Build", 4: "Process Repeatable", 5: "Reproducible (Lab)", 6: "Relevant Build", 7: "Quality (DFARS)", 8: "LRIP Ready", 9: "Full-Rate" } },
    HRL: { title: "Human Engineering", anchor: "Regulatory Anchor: DoDD 1100.4", levelDescriptions: { 1: "Roles Identified", 2: "HF Plan Drafted", 3: "Mock-ups Tested", 4: "Human-in-the-Loop", 5: "Usability/Safety", 6: "Explainability/Training", 7: "Operators Trained", 8: "Doctrine/Trust", 9: "Combat Validation" } },
    AIRL: { title: "AI", anchor: "Regulatory Anchor: DoDD 1100.4", levelDescriptions: { 1: "Concept Recognized", 2: "Data Pipeline", 3: "Dataset Curated", 4: "Baseline/Bias", 5: "Ground Truth/XAI", 6: "Robustness", 7: "MLOps/cATO", 8: "Ops Retraining", 9: "Continuous Red-Teaming" } },
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-cap">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <h1 className="text-xl font-bold mb-4" data-testid="text-cap-title">{capability.name}</h1>

      <Card className="border-border/40 mb-6">
        <CardContent className="p-5">
          <div className="flex gap-6">
            <div className="w-[180px] h-[120px] rounded-lg overflow-hidden bg-muted/40 shrink-0">
              {capability.imagePath ? (
                <img src={`/api/documents/${encodeURIComponent(capability.imagePath)}`} alt={capability.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-muted/60 to-muted/20">
                  <FileText className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold">Product Overview</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`text-[10px] border ${STATUS_COLORS[capability.status] || ""}`} variant="outline">{statusLabel}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{capability.offeringType}</p>
              {capability.description && <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">{capability.description}</p>}
              {capability.problemStatement && <p className="text-xs text-muted-foreground/70 mt-1 italic">{capability.problemStatement}</p>}
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
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-base font-semibold mb-3">{capability.name} Capabilities</h2>

      <div className="flex gap-1 mb-4 border-b border-border/40 pb-0">
        {TAB_GROUPS.map(group => {
          const isActive = activeGroup === group.key;
          return (
            <button
              key={group.key}
              className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"}`}
              onClick={() => { setActiveGroup(group.key); setActiveSubItem(group.subItems[0].key); }}
              data-testid={`admin-view-tab-${group.key}`}
            >
              {group.label}
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />}
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
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${isActive ? "bg-primary/20 border-primary/40 text-foreground font-medium" : "bg-muted/10 border-border/40 text-muted-foreground hover:bg-muted/20"}`}
                    onClick={() => setActiveSubItem(sub.key)}
                    data-testid={`admin-view-subtab-${sub.key}`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>

            {activeSubItem === "governance_basic" ? (
              <ReadOnlyGovernance capability={capability} verticalSelections={verticalSelections} allArtifacts={allArtifacts || []} feedbackBySection={feedbackBySection} />
            ) : (
              <ReadOnlyVertical verticalKey={activeSubItem} selection={verticalSelections[activeSubItem]} allArtifacts={allArtifacts || []} config={VERTICAL_CONFIG[activeSubItem]} feedbackItems={feedbackBySection[activeSubItem] || []} />
            )}
          </>
        );
      })()}
    </div>
  );
}

function ReadOnlyGovernance({ capability, verticalSelections, allArtifacts, feedbackBySection }: {
  capability: PartnerCapability;
  verticalSelections: Record<string, any>;
  allArtifacts: any[];
  feedbackBySection: Record<string, any[]>;
}) {
  const trlSelection = verticalSelections["TRL"];
  const hasTRL = trlSelection && trlSelection.level;

  const VERTICAL_CONFIG_TRL = {
    title: "Technology Maturity", anchor: "Regulatory Anchor: DoDD 1100.4",
    levelDescriptions: { 1: "Basic principles observed", 2: "Technology concept formulated", 3: "Proof-of-concept demonstrated", 4: "Components validated in lab environment", 5: "Components validated in relevant environment", 6: "Prototype demonstrated in relevant environment", 7: "Prototype demonstrated in operational environment", 8: "System qualified through demonstration", 9: "System proven in mission ops." } as Record<number, string>,
  };

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

      {feedbackBySection["basic_info"]?.length > 0 && (
        <ReadOnlyFeedbackTrail items={feedbackBySection["basic_info"]} sectionLabel="Basic Info" />
      )}

      {hasTRL && (
        <ReadOnlyVertical verticalKey="TRL" selection={trlSelection} allArtifacts={allArtifacts} config={VERTICAL_CONFIG_TRL} feedbackItems={feedbackBySection["TRL"] || []} />
      )}
    </div>
  );
}

function ReadOnlyVertical({ verticalKey, selection, allArtifacts, config, feedbackItems }: {
  verticalKey: string;
  selection: any;
  allArtifacts: any[];
  config: { title: string; anchor: string; levelDescriptions: Record<number, string> } | undefined;
  feedbackItems: any[];
}) {
  if (!config || !selection) return (
    <div className="text-center py-8 text-muted-foreground">
      <p className="text-sm">No data submitted for this section.</p>
    </div>
  );

  const selectedLevel = selection.level || 0;
  const checkedArtifacts: string[] = selection.checkedArtifacts || [];
  const uploadedDocs: any[] = selection.uploadedDocs || [];

  const verticalArtifactsFromDB = allArtifacts.filter((a: any) => a.vertical === verticalKey);
  const artifactsByLevel: Record<number, any[]> = {};
  verticalArtifactsFromDB.forEach((a: any) => {
    if (!artifactsByLevel[a.level]) artifactsByLevel[a.level] = [];
    artifactsByLevel[a.level].push(a);
  });

  const allArtifactsForVertical: any[] = [];
  for (let l = 1; l <= 9; l++) {
    if (artifactsByLevel[l]) allArtifactsForVertical.push(...artifactsByLevel[l]);
  }

  const checkedCount = checkedArtifacts.length;
  const totalCount = allArtifactsForVertical.length;
  const unchecked = allArtifactsForVertical.filter((a: any) => !checkedArtifacts.includes(a.id) && !checkedArtifacts.includes(a.name));
  const checked = allArtifactsForVertical.filter((a: any) => checkedArtifacts.includes(a.id) || checkedArtifacts.includes(a.name));

  return (
    <div className="space-y-6">
      <Card className="border-border/40">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold">{config.title} Summary</h3>
              <p className="text-xs text-muted-foreground">{config.anchor}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
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
              {unchecked.map((artifact: any) => (
                <div key={artifact.id} className="flex items-center gap-3 py-1.5 border-b border-border/20 last:border-0">
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
              {checked.map((artifact: any) => (
                <div key={artifact.id} className="flex items-center gap-3 py-1.5 border-b border-border/20 last:border-0">
                  <div className="h-5 w-5 rounded-full bg-primary border-2 border-primary flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
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
            <p className="text-sm font-medium mb-3">Supporting Documents</p>
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
                            <span className="text-[9px] text-muted-foreground whitespace-nowrap">
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

      {feedbackItems.length > 0 && (
        <ReadOnlyFeedbackTrail items={feedbackItems} sectionLabel={config.title} />
      )}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="py-2 px-3 rounded-md border border-border/40 bg-muted/10 text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function ReadOnlyFeedbackTrail({ items, sectionLabel }: { items: any[]; sectionLabel: string }) {
  return (
    <Card className="border-border/40">
      <CardContent className="p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{sectionLabel} - Feedback Trail</p>
        <div className="space-y-2">
          {items.map((fb: any) => (
            <div
              key={fb.id}
              className={`rounded-md p-3 text-sm ${fb.role === "admin" ? "bg-primary/10 border border-primary/20" : "bg-blue-500/10 border border-blue-500/20"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">
                  {fb.displayName || fb.username}
                  <Badge variant="outline" className="text-[9px] ml-2">{fb.role}</Badge>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {fb.createdAt ? new Date(fb.createdAt).toLocaleString() : ""}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{fb.message}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
