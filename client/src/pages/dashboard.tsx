import { useGetStatsQuery, useGetPartnersQuery, useGetAdminPartnerCapabilitiesQuery } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { type Partner, type PartnerCapability, PARTNER_CAPABILITY_STATUS_LABELS, type PartnerCapabilityStatus } from "@shared/schema";
import {
  Users, Activity, ShieldCheck, Clock, Building2, ChevronRight,
  CheckCircle2, XCircle, Shield, ArrowLeft, TrendingUp, BarChart3,
  FileCheck, AlertCircle, Package, MessageSquare, Eye, Layers, Send
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";

interface CapWithPartner extends PartnerCapability {
  partnerName?: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted/40 text-muted-foreground border-muted-foreground/30",
  submitted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  under_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  feedback_sent: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  partner_responded: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

const VERTICAL_SHORT: Record<string, string> = {
  TRL: "Technology",
  PRL: "Policy & Legal",
  CRL: "Cyber Security",
  IRL: "Integration",
  SCRL: "Supply Chain",
  TVRL: "Test & Verification",
  MRL: "Manufacturing",
  HRL: "Human Engineering",
  AIRL: "AI Readiness",
};

export default function Dashboard() {
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useGetStatsQuery();

  const { data: partners, isLoading: partnersLoading } = useGetPartnersQuery();

  const { data: allCapabilities, isLoading: capsLoading } = useGetAdminPartnerCapabilitiesQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const caps = allCapabilities || [];
  const draftCaps = caps.filter(c => c.status === "draft");
  const submittedCaps = caps.filter(c => ["submitted", "under_review"].includes(c.status));
  const feedbackCaps = caps.filter(c => c.status === "feedback_sent");
  const respondedCaps = caps.filter(c => c.status === "partner_responded");
  const verifiedCaps = caps.filter(c => c.status === "approved");
  const rejectedCaps = caps.filter(c => c.status === "rejected");

  const needsAction = [...submittedCaps, ...respondedCaps];

  const verificationRate = useMemo(() => {
    const reviewed = verifiedCaps.length + rejectedCaps.length;
    if (reviewed === 0) return 0;
    return Math.round((verifiedCaps.length / reviewed) * 100);
  }, [verifiedCaps, rejectedCaps]);

  const verticalCoverage = useMemo(() => {
    const coverage: Record<string, { assessed: number; total: number; avgLevel: number }> = {};
    Object.keys(VERTICAL_SHORT).forEach(k => {
      coverage[k] = { assessed: 0, total: 0, avgLevel: 0 };
    });
    caps.forEach(c => {
      const vs = (c.verticalSelections as Record<string, { level?: number }>) || {};
      Object.keys(VERTICAL_SHORT).forEach(k => {
        coverage[k].total++;
        if (vs[k]?.level && vs[k].level! > 0) {
          coverage[k].assessed++;
          coverage[k].avgLevel += vs[k].level!;
        }
      });
    });
    Object.keys(coverage).forEach(k => {
      if (coverage[k].assessed > 0) {
        coverage[k].avgLevel = Math.round(coverage[k].avgLevel / coverage[k].assessed);
      }
    });
    return coverage;
  }, [caps]);

  const filteredCaps = selectedStatus
    ? selectedStatus === "needs_action"
      ? needsAction
      : selectedStatus === "submitted"
      ? submittedCaps
      : selectedStatus === "all"
      ? caps
      : caps.filter(c => c.status === selectedStatus)
    : null;

  if (filteredCaps) {
    const statusTitle = selectedStatus === "needs_action"
      ? "Needs Review"
      : selectedStatus === "all"
      ? "All Capabilities"
      : selectedStatus === "submitted"
      ? "Submitted / Under Review"
      : PARTNER_CAPABILITY_STATUS_LABELS[selectedStatus as PartnerCapabilityStatus] || selectedStatus;
    return (
      <div className="p-4 md:p-6 space-y-4 mx-auto max-w-[1400px]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedStatus(null)} data-testid="button-drilldown-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold tracking-tight" data-testid="text-drilldown-title">{statusTitle} — {filteredCaps.length} Capabilities</h1>
        </div>
        <div className="space-y-2">
          {filteredCaps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No capabilities in this status</p>
              </CardContent>
            </Card>
          ) : (
            filteredCaps.map(cap => (
              <CapabilityRow key={cap.id} cap={cap} />
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 mx-auto max-w-[1400px]">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary mb-1" data-testid="text-section-label">
            CENCORE / WRA 2026
          </p>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Partner capability assessments and readiness overview
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          System Operational
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <MetricCard
          label="Total Partners"
          value={stats?.totalPartners ?? 0}
          icon={<Users className="h-4 w-4" />}
          loading={statsLoading}
          testId="stat-total-partners"
          accent="blue"
        />
        <MetricCard
          label="Total Capabilities"
          value={caps.length}
          icon={<Package className="h-4 w-4" />}
          loading={capsLoading}
          testId="stat-total-capabilities"
          accent="violet"
          onClick={() => setSelectedStatus("all")}
        />
        <MetricCard
          label="Needs Review"
          value={needsAction.length}
          icon={<AlertCircle className="h-4 w-4" />}
          loading={capsLoading}
          testId="stat-needs-review"
          accent="amber"
          onClick={() => setSelectedStatus("needs_action")}
        />
        <MetricCard
          label="Verified"
          value={verifiedCaps.length}
          icon={<CheckCircle2 className="h-4 w-4" />}
          loading={capsLoading}
          testId="stat-verified"
          accent="emerald"
          onClick={() => setSelectedStatus("approved")}
        />
        <MetricCard
          label="SAM.gov Verified"
          value={stats?.samRegistered ?? 0}
          icon={<ShieldCheck className="h-4 w-4" />}
          loading={statsLoading}
          testId="stat-sam-verified"
          accent="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        <div className="lg:col-span-1 space-y-3 md:space-y-4">
          <Card className="overflow-hidden">
            <div className="p-4 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Assessment Pipeline</p>
              </div>
              <div className="space-y-3">
                <PipelineRow label="Draft" count={draftCaps.length} color="bg-muted-foreground/50" total={caps.length} onClick={() => setSelectedStatus("draft")} />
                <PipelineRow label="Submitted" count={submittedCaps.length} color="bg-blue-500" total={caps.length} onClick={() => setSelectedStatus("submitted")} />
                <PipelineRow label="Feedback Sent" count={feedbackCaps.length} color="bg-orange-500" total={caps.length} onClick={() => setSelectedStatus("feedback_sent")} />
                <PipelineRow label="Partner Responded" count={respondedCaps.length} color="bg-purple-500" total={caps.length} onClick={() => setSelectedStatus("partner_responded")} />
                <PipelineRow label="Verified" count={verifiedCaps.length} color="bg-emerald-500" total={caps.length} onClick={() => setSelectedStatus("approved")} />
                <PipelineRow label="Not Verified" count={rejectedCaps.length} color="bg-red-500" total={caps.length} onClick={() => setSelectedStatus("rejected")} />
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Verification Rate</p>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold tabular-nums tracking-tight" data-testid="text-verification-rate">{verificationRate}</span>
                <span className="text-lg text-muted-foreground mb-1">%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${verificationRate}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {verifiedCaps.length} of {verifiedCaps.length + rejectedCaps.length} reviewed capabilities verified
              </p>
            </div>
          </Card>
        </div>

        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-4 pb-2 flex items-center justify-between border-b border-border/40">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <p className="text-sm font-semibold">Needs Review</p>
            </div>
            <Badge variant="secondary" className="text-[10px] font-mono">{needsAction.length}</Badge>
          </div>
          <div className="p-3">
            {capsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : needsAction.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">All clear</p>
                <p className="text-xs mt-1 opacity-60">No capabilities awaiting review</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {needsAction.slice(0, 6).map(cap => {
                  const statusLabel = PARTNER_CAPABILITY_STATUS_LABELS[cap.status as PartnerCapabilityStatus] || cap.status;
                  const vs = (cap.verticalSelections as Record<string, { level?: number }>) || {};
                  const assessedCount = Object.values(vs).filter(v => v.level && v.level > 0).length;
                  return (
                    <div
                      key={cap.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/30 transition-colors group"
                      data-testid={`review-cap-${cap.id}`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 shrink-0">
                        <Package className="h-3.5 w-3.5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{cap.name}</p>
                          <Badge className={`text-[9px] border ${STATUS_COLORS[cap.status] || ""}`} variant="outline">{statusLabel}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {cap.partnerName || "—"} · {assessedCount} verticals assessed · {cap.offeringType || "capability"}
                        </p>
                      </div>
                      <Link href="/partner-assessment">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 opacity-80 group-hover:opacity-100" data-testid={`button-review-cap-${cap.id}`}>
                          <Eye className="h-3 w-3" /> Review
                        </Button>
                      </Link>
                    </div>
                  );
                })}
                {needsAction.length > 6 && (
                  <p className="text-xs text-center text-muted-foreground py-1 cursor-pointer hover:text-foreground" onClick={() => setSelectedStatus("needs_action")}>
                    +{needsAction.length - 6} more — View All
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <Card className="overflow-hidden" data-testid="card-vertical-coverage">
          <div className="p-4 pb-2 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Vertical Coverage Across All Capabilities</p>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-2.5">
              {Object.entries(VERTICAL_SHORT).map(([key, name]) => {
                const vc = verticalCoverage[key];
                const pct = vc && vc.total > 0 ? (vc.assessed / vc.total) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-3" data-testid={`coverage-${key}`}>
                    <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{name}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-16 text-right">
                      {vc?.assessed || 0}/{vc?.total || 0}
                    </span>
                    <span className="text-xs font-mono w-8 text-right">
                      {vc?.avgLevel ? `L${vc.avgLevel}` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden" data-testid="card-partner-portfolio">
          <div className="p-4 pb-2 flex items-center justify-between border-b border-border/40">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Partner Portfolio</p>
            </div>
            <Link href="/partners">
              <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="button-view-all-partners">
                View All <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="p-2">
            {partnersLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : partners && partners.length > 0 ? (
              <div className="divide-y divide-border/30">
                {partners.slice(0, 6).map(partner => {
                  const partnerCaps = caps.filter(c => c.partnerId === partner.id);
                  const verifiedCount = partnerCaps.filter(c => c.status === "approved").length;
                  return (
                    <Link key={partner.id} href={`/partners/${partner.id}`}>
                      <div
                        className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                        data-testid={`row-partner-${partner.id}`}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60 shrink-0">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{partner.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {partnerCaps.length} capabilities
                            </span>
                            {verifiedCount > 0 && (
                              <span className="text-xs text-emerald-400">{verifiedCount} verified</span>
                            )}
                            {partner.samRegistered && (
                              <span className="text-xs text-emerald-400 flex items-center gap-0.5">
                                <ShieldCheck className="h-3 w-3" /> SAM
                              </span>
                            )}
                          </div>
                        </div>
                        {partnerCaps.length > 0 && (
                          <Badge variant="outline" className="text-[10px] border-border/40">
                            {partnerCaps.length} cap{partnerCaps.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No partners registered</p>
                <p className="text-xs mt-1 opacity-60">Partners will appear here after onboarding</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  loading,
  testId,
  onClick,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  loading: boolean;
  testId: string;
  onClick?: () => void;
  accent: "blue" | "violet" | "amber" | "emerald";
}) {
  const accentMap = {
    blue: "bg-primary/10 text-primary",
    violet: "bg-violet-500/10 text-violet-400",
    amber: "bg-amber-500/10 text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
  };

  return (
    <Card
      className={`overflow-hidden ${onClick ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
      data-testid={testId}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
          <div className={`flex h-7 w-7 items-center justify-center rounded-md ${accentMap[accent]}`}>
            {icon}
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <p className="text-3xl font-bold tabular-nums tracking-tight">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function PipelineRow({ label, count, color, total, onClick }: { label: string; count: number; color: string; total: number; onClick?: () => void }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div
      className={`flex items-center gap-3 ${onClick ? "cursor-pointer hover:bg-muted/20 rounded px-1 -mx-1 py-0.5" : ""}`}
      data-testid={`pipeline-${label.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={onClick}
    >
      <div className={`h-2 w-2 rounded-full ${color} shrink-0`} />
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className="text-sm font-semibold tabular-nums w-6 text-right">{count}</span>
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CapabilityRow({ cap }: { cap: CapWithPartner }) {
  const statusLabel = PARTNER_CAPABILITY_STATUS_LABELS[cap.status as PartnerCapabilityStatus] || cap.status;
  const vs = (cap.verticalSelections as Record<string, { level?: number }>) || {};
  const assessedCount = Object.values(vs).filter(v => v.level && v.level > 0).length;

  return (
    <Card className="hover:bg-muted/30 transition-colors" data-testid={`drilldown-cap-${cap.id}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 shrink-0">
          <Package className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{cap.name}</p>
            <Badge className={`text-[9px] border ${STATUS_COLORS[cap.status] || ""}`} variant="outline">{statusLabel}</Badge>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-muted-foreground">{cap.partnerName || "—"}</span>
            <span className="text-xs text-muted-foreground">{assessedCount} verticals</span>
            <span className="text-xs text-muted-foreground capitalize">{cap.offeringType || "capability"}</span>
          </div>
        </div>
        <Link href="/partner-assessment">
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            <Eye className="h-3 w-3" /> Review
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
