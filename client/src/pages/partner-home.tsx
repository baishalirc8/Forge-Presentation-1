import { useGetPartnerQuery, useGetPartnerCapabilitiesQuery } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronRight, Shield, FileText, Building2, Plus, Package,
  AlertTriangle, CheckCircle2, Clock, Send, MessageSquare,
  TrendingUp, BarChart3, Eye, Layers
} from "lucide-react";
import type { Partner, PartnerCapability } from "@shared/schema";
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

export default function PartnerHome() {
  const { user } = useAuth();
  const partnerId = user?.partnerId;

  const { data: partner } = useGetPartnerQuery(partnerId!, { skip: !partnerId });

  const { data: capabilities } = useGetPartnerCapabilitiesQuery();

  const caps = capabilities || [];
  const totalCaps = caps.length;
  const draftCaps = caps.filter(c => c.status === "draft");
  const submittedCaps = caps.filter(c => ["submitted", "under_review"].includes(c.status));
  const feedbackCaps = caps.filter(c => c.status === "feedback_sent");
  const verifiedCaps = caps.filter(c => c.status === "approved");
  const rejectedCaps = caps.filter(c => c.status === "rejected");

  const avgReadiness = (() => {
    const allLevels: number[] = [];
    caps.forEach(c => {
      const vs = (c.verticalSelections as Record<string, { level?: number }>) || {};
      Object.values(vs).forEach(v => {
        if (v.level && v.level > 0) allLevels.push(v.level);
      });
    });
    if (allLevels.length === 0) return 0;
    return Math.round(allLevels.reduce((a, b) => a + b, 0) / allLevels.length);
  })();

  const verticalCoverage = (() => {
    const covered = new Set<string>();
    caps.forEach(c => {
      const vs = (c.verticalSelections as Record<string, { level?: number }>) || {};
      Object.entries(vs).forEach(([k, v]) => {
        if (v.level && v.level > 0) covered.add(k);
      });
    });
    return covered.size;
  })();

  const verticalData = (() => {
    const verticalMax: Record<string, number> = {};
    caps.forEach(c => {
      const vs = (c.verticalSelections as Record<string, { level?: number }>) || {};
      Object.entries(vs).forEach(([k, v]) => {
        if (v.level && v.level > 0) {
          verticalMax[k] = Math.max(verticalMax[k] || 0, v.level);
        }
      });
    });
    return verticalMax;
  })();

  const completionRate = totalCaps > 0 ? Math.round((verifiedCaps.length / totalCaps) * 100) : 0;

  return (
    <div className="p-3 md:p-6 max-w-[1400px] mx-auto">
      <div className="mb-4 md:mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary mb-1" data-testid="text-section-label">
          IWE / Partner Portal
        </p>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
          Welcome back, {partner?.name || user?.displayName || "Partner"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your capability assessment overview and action items
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        <div className="flex-1 space-y-4 md:space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="metrics-grid">
            <MetricCard
              label="Capabilities"
              value={totalCaps}
              sub={totalCaps === 0 ? "Get started" : `${verifiedCaps.length} verified`}
              icon={<Package className="h-4 w-4" />}
              accent="blue"
              testId="stat-total-capabilities"
            />
            <MetricCard
              label="Avg Readiness"
              value={avgReadiness > 0 ? `L${avgReadiness}` : "—"}
              sub={avgReadiness > 0 ? `of 9 levels` : "No data yet"}
              icon={<TrendingUp className="h-4 w-4" />}
              accent="emerald"
              testId="stat-avg-readiness"
            />
            <MetricCard
              label="Verticals Assessed"
              value={verticalCoverage}
              sub={`of 9 total`}
              icon={<Layers className="h-4 w-4" />}
              accent="violet"
              testId="stat-verticals-covered"
            />
            <MetricCard
              label="Feedback Pending"
              value={feedbackCaps.length}
              sub={feedbackCaps.length > 0 ? "Action needed" : "All clear"}
              icon={<MessageSquare className="h-4 w-4" />}
              accent={feedbackCaps.length > 0 ? "amber" : "emerald"}
              testId="stat-feedback-pending"
            />
          </div>

          {feedbackCaps.length > 0 && (
            <Card className="border-orange-500/20" data-testid="card-action-required">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  <h2 className="text-sm font-semibold">Action Required — Feedback Received</h2>
                </div>
                <div className="space-y-2">
                  {feedbackCaps.map(cap => (
                    <Link key={cap.id} href={`/capabilities/${cap.id}/edit`}>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/30 transition-colors cursor-pointer group" data-testid={`action-feedback-${cap.id}`}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500/10 shrink-0">
                          <MessageSquare className="h-3.5 w-3.5 text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cap.name}</p>
                          <p className="text-xs text-muted-foreground">Admin has provided feedback — review and respond</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="card-readiness-chart">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Readiness by Vertical</h2>
                </div>
                <div className="space-y-3">
                  {Object.entries(VERTICAL_SHORT).map(([key, name]) => {
                    const level = verticalData[key] || 0;
                    const pct = level > 0 ? (level / 9) * 100 : 0;
                    return (
                      <div key={key} className="flex items-center gap-3" data-testid={`readiness-bar-${key}`}>
                        <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{name}</span>
                        <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${level >= 7 ? "bg-emerald-500" : level >= 4 ? "bg-primary" : level > 0 ? "bg-amber-500" : ""}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-mono w-6 text-right ${level > 0 ? "font-semibold" : "text-muted-foreground/40"}`}>
                          {level > 0 ? `L${level}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-completion-progress">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Assessment Progress</h2>
                </div>
                <div className="flex items-center justify-center mb-4">
                  <div className="relative h-32 w-32">
                    <svg viewBox="0 0 36 36" className="h-full w-full transform -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" className="text-primary" strokeWidth="3" strokeDasharray={`${completionRate} ${100 - completionRate}`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">{completionRate}%</span>
                      <span className="text-[10px] text-muted-foreground">Verified</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded-lg bg-muted/10 border border-border/30">
                    <p className="text-lg font-bold text-emerald-400">{verifiedCaps.length}</p>
                    <p className="text-[10px] text-muted-foreground">Verified</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/10 border border-border/30">
                    <p className="text-lg font-bold text-blue-400">{submittedCaps.length}</p>
                    <p className="text-[10px] text-muted-foreground">Under Review</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/10 border border-border/30">
                    <p className="text-lg font-bold text-orange-400">{feedbackCaps.length}</p>
                    <p className="text-[10px] text-muted-foreground">Feedback</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/10 border border-border/30">
                    <p className="text-lg font-bold text-muted-foreground">{draftCaps.length}</p>
                    <p className="text-[10px] text-muted-foreground">Draft</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-capabilities-overview">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Capabilities Overview</h2>
                </div>
                <Link href="/capabilities">
                  <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="button-view-all-caps">
                    View All <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>

              {totalCaps === 0 ? (
                <div className="text-center py-10">
                  <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">No capabilities registered yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Start by adding your first product or capability</p>
                  <Link href="/capabilities/new">
                    <Button size="sm" className="mt-4 text-xs" data-testid="button-add-first-cap">
                      <Plus className="h-3 w-3 mr-1" /> Add Capability
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-5 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-3 pb-1">
                    <span className="col-span-2">Capability</span>
                    <span>Status</span>
                    <span>Type</span>
                    <span className="text-right">Verticals</span>
                  </div>
                  {caps.slice(0, 5).map(cap => {
                    const vs = (cap.verticalSelections as Record<string, { level?: number }>) || {};
                    const assessedCount = Object.values(vs).filter(v => v.level && v.level > 0).length;
                    const statusLabel = PARTNER_CAPABILITY_STATUS_LABELS[cap.status as PartnerCapabilityStatus] || cap.status;
                    return (
                      <Link key={cap.id} href={`/capabilities/${cap.id}/view`}>
                        <div className="grid grid-cols-5 gap-2 items-center p-3 rounded-lg border border-border/30 hover:bg-muted/30 transition-colors cursor-pointer" data-testid={`cap-row-${cap.id}`}>
                          <div className="col-span-2 flex items-center gap-2 min-w-0">
                            {cap.imagePath ? (
                              <img src={`/api/documents/${encodeURIComponent(cap.imagePath)}`} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted/60 flex items-center justify-center shrink-0">
                                <Eye className="h-3.5 w-3.5 text-muted-foreground/40" />
                              </div>
                            )}
                            <p className="text-sm font-medium truncate">{cap.name}</p>
                          </div>
                          <div>
                            <Badge className={`text-[9px] border ${STATUS_COLORS[cap.status] || ""}`} variant="outline">
                              {statusLabel}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground capitalize">{cap.offeringType || "capability"}</span>
                          <span className="text-xs text-muted-foreground text-right">{assessedCount}/9</span>
                        </div>
                      </Link>
                    );
                  })}
                  {caps.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{caps.length - 5} more capabilities
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="w-[280px] shrink-0 space-y-4">
          <Card className="border-border/40" data-testid="card-status-breakdown">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Assessment Status</h3>
              <div className="space-y-2.5">
                <StatusRow icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />} label="Draft" count={draftCaps.length} />
                <StatusRow icon={<Send className="h-3.5 w-3.5 text-blue-400" />} label="Submitted" count={submittedCaps.length} />
                <StatusRow icon={<MessageSquare className="h-3.5 w-3.5 text-orange-400" />} label="Feedback Received" count={feedbackCaps.length} />
                <StatusRow icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-400" />} label="Verified" count={verifiedCaps.length} />
                <StatusRow icon={<AlertTriangle className="h-3.5 w-3.5 text-red-400" />} label="Not Verified" count={rejectedCaps.length} />
                <Separator className="my-1" />
                <StatusRow icon={<Package className="h-3.5 w-3.5 text-primary" />} label="Total" count={totalCaps} bold />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40" data-testid="card-quick-actions">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link href="/capabilities/new">
                  <Button size="sm" className="w-full text-xs justify-start gap-2" data-testid="button-quick-add-cap">
                    <Plus className="h-3.5 w-3.5" /> Add New Capability
                  </Button>
                </Link>
                <Link href="/capabilities">
                  <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2" data-testid="button-quick-view-caps">
                    <Eye className="h-3.5 w-3.5" /> View All Capabilities
                  </Button>
                </Link>
                <Link href="/company-info">
                  <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2" data-testid="button-quick-company-info">
                    <Building2 className="h-3.5 w-3.5" /> Company Profile
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {partner && (
            <Card className="border-border/40" data-testid="card-company-snapshot">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Company Info</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entity</span>
                    <span className="font-medium truncate ml-2">{partner.name}</span>
                  </div>
                  {partner.uei && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">UEI</span>
                      <span className="font-mono">{partner.uei}</span>
                    </div>
                  )}
                  {partner.cage && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CAGE</span>
                      <span className="font-mono">{partner.cage}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SAM.gov</span>
                    <Badge variant={partner.samRegistered ? "default" : "secondary"} className="text-[9px]">
                      {partner.samRegistered ? "Verified" : "Not Verified"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, icon, accent, testId }: {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ReactNode;
  accent: "blue" | "violet" | "amber" | "emerald";
  testId: string;
}) {
  const accentMap = {
    blue: "bg-primary/10 text-primary",
    violet: "bg-violet-500/10 text-violet-400",
    amber: "bg-amber-500/10 text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
  };

  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
          <div className={`flex h-6 w-6 items-center justify-center rounded-md ${accentMap[accent]}`}>
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function StatusRow({ icon, label, count, bold }: { icon: React.ReactNode; label: string; count: number; bold?: boolean }) {
  return (
    <div className="flex items-center gap-2" data-testid={`status-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      {icon}
      <span className={`text-xs flex-1 ${bold ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-xs tabular-nums ${bold ? "font-bold" : "font-medium"}`}>{count}</span>
    </div>
  );
}
