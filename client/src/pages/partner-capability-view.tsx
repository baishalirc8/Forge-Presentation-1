import { useGetPartnerCapabilityQuery, useGetFeedbackQuery, useGetArtifactsQuery } from "@/lib/api";
import { Link, useParams } from "wouter";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Edit, Eye, Check, Info, FileText, ExternalLink, Clock, MessageSquare, ChevronDown, ChevronRight
} from "lucide-react";
import type { PartnerCapability, AssessmentFeedback, Artifact } from "@shared/schema";
import { PARTNER_CAPABILITY_STATUS_LABELS, type PartnerCapabilityStatus } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted/40 text-muted-foreground border-muted-foreground/30",
  submitted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  under_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  feedback_sent: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  partner_responded: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

const VERTICAL_CONFIG: Record<string, { title: string; shortTitle: string; anchor: string; levelDescriptions: Record<number, string> }> = {
  TRL: {
    title: "Technology Readiness",
    shortTitle: "Technology",
    anchor: "Regulatory Anchor: DoDD 1100.4",
    levelDescriptions: { 1: "Basic principles observed", 2: "Technology concept formulated", 3: "Proof-of-concept demonstrated", 4: "Components validated in lab environment", 5: "Components validated in relevant environment", 6: "Prototype demonstrated in relevant environment", 7: "Prototype demonstrated in operational environment", 8: "System qualified through demonstration", 9: "System proven in mission ops." },
  },
  PRL: {
    title: "Policy & Legal",
    shortTitle: "Policy & Legal",
    anchor: "Regulatory Anchor: DoDD 5000.01",
    levelDescriptions: { 1: "Policy constraints identified", 2: "Privacy impact assessed", 3: "LOAC review completed", 4: "Data rights established", 5: "Weapons legal review passed", 6: "PII/PHI compliance certified", 7: "Policy waivers documented", 8: "Legal authority confirmed", 9: "International clearance obtained" },
  },
  CRL: {
    title: "Cyber Security",
    shortTitle: "Cyber Security",
    anchor: "Regulatory Anchor: DoDI 8510.01",
    levelDescriptions: { 1: "Threat Awareness", 2: "RMF Categorization", 3: "Hygiene & MFA", 4: "Enclave Design", 5: "Controls Implemented", 6: "IL5/IL6 Accredited", 7: "Continuous Monitoring", 8: "Cyber Ops", 9: "Zero-Trust" },
  },
  IRL: {
    title: "Partnership & Integration",
    shortTitle: "Partnership",
    anchor: "Regulatory Anchor: DoDI 5000.88",
    levelDescriptions: { 1: "Interface Recognition", 2: "Interface Specs", 3: "Lab Integration", 4: "Subsystem Lab Val", 5: "Relevant Env", 6: "System-of-Systems", 7: "Multi-Service Val", 8: "Joint-Wide Certified", 9: "Continuous Integration" },
  },
  SCRL: {
    title: "Supply Chain",
    shortTitle: "Supply Chain",
    anchor: "Regulatory Anchor: NIST SP 800-161",
    levelDescriptions: { 1: "Ad-hoc Sourcing", 2: "Key Suppliers Listed", 3: "Tier-1 Alternates", 4: "SCRM Plan Formalized", 5: "Dual Sourcing Qualified", 6: "Geopolitical Assessment", 7: "Tier-2 Visibility", 8: "SBOM/Redundancy", 9: "Automated Monitoring" },
  },
  TVRL: {
    title: "Testing & Verification",
    shortTitle: "Testing",
    anchor: "Regulatory Anchor: DoDI 5000.89",
    levelDescriptions: { 1: "Need Acknowledged", 2: "TEMP Created", 3: "Procedures Approved", 4: "Subsystem Validation", 5: "Certification Initiated", 6: "Docs Complete", 7: "OT&E Data Delivered", 8: "Safety Release Granted", 9: "Embedded Regression" },
  },
  MRL: {
    title: "Manufacturing",
    shortTitle: "Manufacturing",
    anchor: "Regulatory Anchor: DoD MRL Deskbook",
    levelDescriptions: { 1: "Feasibility", 2: "Materials/Proc", 3: "Lab-scale Build", 4: "Process Repeatable", 5: "Reproducible (Lab)", 6: "Relevant Build", 7: "Quality (DFARS)", 8: "LRIP Ready", 9: "Full-Rate" },
  },
  HRL: {
    title: "Human Engineering",
    shortTitle: "Human Eng.",
    anchor: "Regulatory Anchor: DoDD 1100.4",
    levelDescriptions: { 1: "Roles Identified", 2: "HF Plan Drafted", 3: "Mock-ups Tested", 4: "Human-in-the-Loop", 5: "Usability/Safety", 6: "Explainability/Training", 7: "Operators Trained", 8: "Doctrine/Trust", 9: "Combat Validation" },
  },
  AIRL: {
    title: "AI",
    shortTitle: "AI",
    anchor: "Regulatory Anchor: DoDD 1100.4",
    levelDescriptions: { 1: "Concept Recognized", 2: "Data Pipeline", 3: "Dataset Curated", 4: "Baseline/Bias", 5: "Ground Truth/XAI", 6: "Robustness", 7: "MLOps/cATO", 8: "Ops Retraining", 9: "Continuous Red-Teaming" },
  },
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

export default function PartnerCapabilityView() {
  const params = useParams<{ id: string }>();
  const capId = params.id;

  const { data: capability, isLoading: capLoading } = useGetPartnerCapabilityQuery(capId!);

  const { data: feedback } = useGetFeedbackQuery(capId!);

  const { data: allArtifacts } = useGetArtifactsQuery();

  const [activeGroup, setActiveGroup] = useState("governance");
  const [activeSubItem, setActiveSubItem] = useState("governance_basic");

  if (capLoading) {
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
        <Link href="/capabilities">
          <Button variant="ghost" size="sm" data-testid="button-back-view">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
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

  const materials = capability.materials as any[] || [];
  const statusLabel = PARTNER_CAPABILITY_STATUS_LABELS[capability.status as PartnerCapabilityStatus] || capability.status;

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/capabilities">
          <Button variant="ghost" size="sm" data-testid="button-back-view">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
      </div>

      <h1 className="text-xl font-bold mb-4" data-testid="text-view-name">{capability.name}</h1>

      <Card className="border-border/40 mb-6" data-testid="card-product-overview">
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
                  <Eye className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-base font-semibold">Product Overview</h2>
                  <Badge className={`text-[10px] border mt-1 ${STATUS_COLORS[capability.status] || ""}`} variant="outline">
                    {statusLabel}
                  </Badge>
                </div>
                <Link href={`/capabilities/${capId}/edit`}>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" data-testid="button-edit-summary">
                    <Edit className="h-3 w-3 mr-1" /> Edit Summary
                  </Button>
                </Link>
              </div>
              {capability.description && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{capability.description}</p>
              )}
              {capability.problemStatement && (
                <p className="text-xs text-muted-foreground/70 mt-2 italic">{capability.problemStatement}</p>
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
                  data-testid={`link-material-${idx}`}
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {feedbackBySection["basic_info"]?.length > 0 && (
        <div className="mb-6">
          <FeedbackTrail items={feedbackBySection["basic_info"]} sectionLabel="Basic Info" />
        </div>
      )}

      <h2 className="text-base font-semibold mb-3" data-testid="text-capabilities-heading">{capability.name} Capabilities</h2>

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
              data-testid={`tab-${group.key}`}
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
                    data-testid={`subtab-${sub.key}`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>

            {activeSubItem === "governance_basic" ? (
              <GovernanceTabContent
                capability={capability}
                verticalSelections={verticalSelections}
                allArtifacts={allArtifacts || []}
                feedbackBySection={feedbackBySection}
              />
            ) : (
              <VerticalTabContent
                verticalKey={activeSubItem}
                selection={verticalSelections[activeSubItem]}
                allArtifacts={allArtifacts || []}
                feedbackItems={feedbackBySection[activeSubItem] || []}
              />
            )}
          </>
        );
      })()}
    </div>
  );
}

function GovernanceTabContent({ capability, verticalSelections, allArtifacts, feedbackBySection }: {
  capability: PartnerCapability;
  verticalSelections: Record<string, any>;
  allArtifacts: Artifact[];
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
            <div>
              <p className="text-xs text-muted-foreground mb-1">Offering Name</p>
              <div className="py-2 px-3 rounded-md border border-border/40 bg-muted/10 text-sm">{capability.name}</div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Offering Type</p>
              <div className="py-2 px-3 rounded-md border border-border/40 bg-muted/10 text-sm">{capability.offeringType}</div>
            </div>
            {capability.description && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <div className="py-2 px-3 rounded-md border border-border/40 bg-muted/10 text-sm whitespace-pre-wrap">{capability.description}</div>
              </div>
            )}
            {capability.problemStatement && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Problem Statement</p>
                <div className="py-2 px-3 rounded-md border border-border/40 bg-muted/10 text-sm whitespace-pre-wrap">{capability.problemStatement}</div>
              </div>
            )}
            {capability.additionalInfo && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Additional Information</p>
                <div className="py-2 px-3 rounded-md border border-border/40 bg-muted/10 text-sm whitespace-pre-wrap">{capability.additionalInfo as string}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {feedbackBySection["basic_info"]?.length > 0 && (
        <FeedbackTrail items={feedbackBySection["basic_info"]} sectionLabel="Basic Info" />
      )}

      {hasTRL && (
        <VerticalTabContent
          verticalKey="TRL"
          selection={trlSelection}
          allArtifacts={allArtifacts}
          feedbackItems={feedbackBySection["TRL"] || []}
        />
      )}
    </div>
  );
}

function VerticalTabContent({ verticalKey, selection, allArtifacts, feedbackItems }: {
  verticalKey: string;
  selection: any;
  allArtifacts: Artifact[];
  feedbackItems: AssessmentFeedback[];
}) {
  const config = VERTICAL_CONFIG[verticalKey];
  if (!config || !selection) return null;

  const selectedLevel = selection.level || 0;
  const checkedArtifacts: string[] = selection.checkedArtifacts || [];
  const uploadedDocs: any[] = selection.uploadedDocs || [];

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

  const levelArtifact = artifactsByLevel[selectedLevel]?.[0];
  const levelPolicy = levelArtifact?.policies?.[0] || "";

  const unchecked = allArtifactsForVertical.filter(a => !checkedArtifacts.includes(a.id) && !checkedArtifacts.includes(a.name));
  const checked = allArtifactsForVertical.filter(a => checkedArtifacts.includes(a.id) || checkedArtifacts.includes(a.name));

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0 space-y-6">
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
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">Pending Documents</p>
                <span className="text-xs text-muted-foreground">{unchecked.length} of {unchecked.length + checked.length}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted/40 mb-4 overflow-hidden">
                <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${checked.length / (unchecked.length + checked.length) * 100}%` }} />
              </div>
              <div className="space-y-2">
                {unchecked.map((artifact) => (
                  <div key={artifact.id} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border/30 bg-muted/10" data-testid={`view-artifact-${artifact.id}`}>
                    <div className="h-4 w-4 rounded border border-muted-foreground/25 shrink-0" />
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
                  <div key={artifact.id} className="flex items-center gap-3 py-1.5 border-b border-border/20 last:border-0" data-testid={`view-artifact-checked-${artifact.id}`}>
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
                              data-testid={`doc-score-${idx}`}
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
                  <p className="text-xs text-muted-foreground mb-1">Compliance Remarks</p>
                  <div className="py-2 px-3 rounded-md border border-border/40 bg-muted/10 text-sm whitespace-pre-wrap">
                    {selection.complianceRemarks}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {feedbackItems.length > 0 && (
          <FeedbackTrail items={feedbackItems} sectionLabel={config.title} />
        )}
      </div>

      <PurposeRequirementsSidebar
        verticalKey={verticalKey}
        config={config}
        artifactsByLevel={artifactsByLevel}
      />
    </div>
  );
}

function PurposeRequirementsSidebar({ verticalKey, config, artifactsByLevel }: {
  verticalKey: string;
  config: { title: string; levelDescriptions: Record<number, string> };
  artifactsByLevel: Record<number, Artifact[]>;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayCount = showAll ? 9 : 3;

  return (
    <div className="w-[260px] shrink-0 hidden lg:block">
      <div className="sticky top-4 space-y-4">
        <p className="text-sm font-semibold">Purpose & Requirements</p>
        {Array.from({ length: displayCount }, (_, i) => {
          const level = i + 1;
          const desc = config.levelDescriptions[level] || "";
          const artifact = artifactsByLevel[level]?.[0];
          const policyRaw = artifact?.policies?.[0] || "";
          const policyName = policyRaw.split(":")[0]?.trim() || policyRaw;
          return (
            <Card key={level} className="border-border/40" data-testid={`card-purpose-${verticalKey}-${level}`}>
              <CardContent className="p-4">
                <p className="text-xs font-semibold mb-1">{config.title} - Level {level}</p>
                <p className="text-xs text-muted-foreground mb-2">{desc}</p>
                {policyRaw && (
                  <Button variant="default" size="sm" className="w-full text-xs mt-1" asChild>
                    <a href={`https://www.google.com/search?q=${encodeURIComponent(policyRaw)}`} target="_blank" rel="noopener noreferrer">
                      View {policyName.length > 20 ? policyName.substring(0, 20) + "..." : policyName}
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="text-xs w-full text-muted-foreground"
          onClick={() => setShowAll(!showAll)}
          data-testid={`button-view-all-${verticalKey}`}
        >
          {showAll ? "Show Less" : "View All"}
        </Button>
      </div>
    </div>
  );
}

function FeedbackTrail({ items, sectionLabel }: { items: AssessmentFeedback[]; sectionLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, 2);

  return (
    <Card className="border-border/40">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            {sectionLabel} - Feedback Trail
          </p>
          {items.length > 2 && (
            <button className="text-xs text-primary" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Show Less" : `View All (${items.length})`}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {visibleItems.map(fb => (
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
      </CardContent>
    </Card>
  );
}
