import { useState, useMemo } from "react";
import {
  useGetPartnerQuery,
  useGetPartnerAssessmentsQuery,
  useGetCapabilitiesQuery,
  useCreateAssessmentMutation,
} from "@/lib/api";
import { apiRequest } from "@/lib/api";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { MaturityBadge } from "@/components/maturity-badge";
import { VERTICALS, LEVEL_LABELS, type Partner, type Assessment, type VerticalScores, type Capability, type SubCapability } from "@shared/schema";
import {
  Shield, Target, Plus, ChevronRight, Zap, Loader2, Search,
  ClipboardCheck, AlertTriangle, CheckCircle2
} from "lucide-react";

interface CapabilityWithSubs extends Capability {
  subCapabilities: SubCapability[];
}

interface EnrichedAssessment extends Assessment {
  capability?: Capability | null;
  subCapability?: SubCapability | null;
}

export default function Assessments() {
  const { user } = useAuth();
  const partnerId = user?.partnerId;
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "in_progress" | "completed">("all");

  const { data: partner } = useGetPartnerQuery(partnerId!, { skip: !partnerId });

  const { data: assessments, isLoading } = useGetPartnerAssessmentsQuery(partnerId!, { skip: !partnerId });

  const filtered = useMemo(() => {
    if (!assessments) return [];
    if (filter === "all") return assessments;
    return assessments.filter(a => a.status === filter);
  }, [assessments, filter]);

  const inProgress = (assessments || []).filter(a => a.status === "in_progress").length;
  const completed = (assessments || []).filter(a => a.status === "completed").length;

  if (!partnerId || !partner) {
    return (
      <div className="p-6 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-3 mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3" data-testid="text-assessments-title">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Assessments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage capability assessments for {partner.name}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-start-assessment">
          <Plus className="h-4 w-4 mr-2" />
          Start Assessment
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setFilter("all")} data-testid="stat-total">
          <CardContent className="p-4">
            <p className="text-sm uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="text-2xl font-mono font-bold mt-1">{(assessments || []).length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setFilter("in_progress")} data-testid="stat-in-progress">
          <CardContent className="p-4">
            <p className="text-sm uppercase tracking-wider text-muted-foreground">In Progress</p>
            <p className="text-2xl font-mono font-bold mt-1 text-amber-400">{inProgress}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setFilter("completed")} data-testid="stat-completed">
          <CardContent className="p-4">
            <p className="text-sm uppercase tracking-wider text-muted-foreground">Completed</p>
            <p className="text-2xl font-mono font-bold mt-1 text-emerald-400">{completed}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Target className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">
                {filter === "all" ? "No assessments yet" : `No ${filter.replace("_", " ")} assessments`}
              </p>
              <p className="text-sm mt-1 opacity-60">Start an assessment to evaluate your readiness</p>
              {filter === "all" && (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setDialogOpen(true)} data-testid="button-start-first-assessment">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Start Assessment
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((assessment) => {
            const aScores = assessment.scores as VerticalScores;
            const scored = VERTICALS.filter(v => (aScores[v.key] || 0) > 0).length;
            const atTarget = VERTICALS.filter(v => (aScores[v.key] || 0) >= assessment.targetLevel).length;
            const avgLevel = VERTICALS.length > 0
              ? Math.round(VERTICALS.reduce((sum, v) => sum + (aScores[v.key] || 0), 0) / VERTICALS.length * 10) / 10
              : 0;

            return (
              <Link key={assessment.id} href={`/partners/${partnerId}/assessments/${assessment.id}`}>
                <Card className="hover:bg-muted/20 transition-colors cursor-pointer" data-testid={`card-assessment-${assessment.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">
                            {(assessment as any).productName || assessment.capability?.name || "Assessment"}
                          </p>
                          <Badge variant={assessment.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                            {assessment.status === "in_progress" ? "In Progress" : assessment.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          {assessment.capability && <span>{assessment.capability.name}</span>}
                          {assessment.subCapability && (
                            <>
                              <span className="opacity-40">›</span>
                              <span>{assessment.subCapability.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Level</p>
                          <p className="text-sm font-mono font-semibold">{avgLevel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</p>
                          <p className="text-sm font-mono font-semibold">L{assessment.targetLevel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Scored</p>
                          <p className="text-sm font-mono font-semibold">{scored}/{VERTICALS.length}</p>
                        </div>
                        {assessment.samDataPopulated && (
                          <Zap className="h-4 w-4 text-emerald-400" title="SAM.gov data populated" />
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <StartAssessmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        partner={partner}
      />
    </div>
  );
}

function StartAssessmentDialog({ open, onOpenChange, partner }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner: Partner;
}) {
  const { toast } = useToast();
  const [selectedCapId, setSelectedCapId] = useState("");
  const [selectedSubId, setSelectedSubId] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [targetLevel, setTargetLevel] = useState(String(partner.targetLevel || 5));
  const [showPropose, setShowPropose] = useState(false);
  const [proposeName, setProposeName] = useState("");

  const { data: capabilities } = useGetCapabilitiesQuery();

  const [createAssessment, { isLoading: createPending }] = useCreateAssessmentMutation();

  const selectedCap = useMemo(() =>
    (capabilities || []).find(c => c.id === selectedCapId),
    [capabilities, selectedCapId]
  );

  const [proposePending, setProposePending] = useState(false);
  const handlePropose = async () => {
    setProposePending(true);
    try {
      await apiRequest("POST", "/api/capabilities/propose", { name: proposeName.trim() });
      setShowPropose(false);
      setProposeName("");
      toast({ title: "Capability proposed", description: "Your proposal has been submitted for admin review." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProposePending(false);
    }
  };

  const handleCreate = async () => {
    try {
      await createAssessment({
        partnerId: partner.id,
        data: {
          capabilityId: selectedCapId,
          subCapabilityId: selectedSubId || null,
          productName: productName.trim() || null,
          description: description.trim() || null,
          targetLevel: Number(targetLevel),
          initialScores: {},
          samSearchResults: {},
          discoveredDocuments: [],
        },
      }).unwrap();
      onOpenChange(false);
      resetDialog();
      toast({ title: "Assessment created", description: "Your new assessment is ready." });
    } catch (err: any) {
      toast({ title: "Error", description: err.data || err.message, variant: "destructive" });
    }
  };

  const resetDialog = () => {
    setSelectedCapId("");
    setSelectedSubId("");
    setProductName("");
    setDescription("");
    setTargetLevel(String(partner.targetLevel || 5));
  };

  const canSubmit = !!selectedCapId && !!productName.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetDialog(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            Start New Assessment
          </DialogTitle>
          <DialogDescription className="text-sm">
            Fill in the details below to begin a capability assessment for {partner.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Capability *</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-primary"
                onClick={() => setShowPropose(!showPropose)}
                data-testid="button-toggle-propose"
              >
                <Plus className="h-3 w-3" />
                Propose New
              </Button>
            </div>
            {showPropose ? (
              <div className="flex gap-2">
                <Input
                  value={proposeName}
                  onChange={(e) => setProposeName(e.target.value)}
                  placeholder="e.g., Quantum Computing Readiness"
                  className="h-11 text-sm flex-1"
                  data-testid="input-propose-capability"
                />
                <Button
                  className="h-11"
                  disabled={!proposeName.trim() || proposePending}
                  onClick={handlePropose}
                  data-testid="button-submit-propose"
                >
                  {proposePending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                </Button>
                <Button variant="outline" className="h-11" onClick={() => { setShowPropose(false); setProposeName(""); }} data-testid="button-cancel-propose">
                  Cancel
                </Button>
              </div>
            ) : (
              <Select value={selectedCapId} onValueChange={(v) => { setSelectedCapId(v); setSelectedSubId(""); }}>
                <SelectTrigger className="h-11 text-sm" data-testid="select-assessment-capability">
                  <SelectValue placeholder="Select a capability to assess..." />
                </SelectTrigger>
                <SelectContent>
                  {(capabilities || []).map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-sm py-2">
                      {c.name}
                      {(c as any).status !== "published" && (
                        <span className="ml-2 text-[10px] text-amber-400">(Pending Approval)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedCap && selectedCap.subCapabilities.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Sub-Capability</Label>
              <Select value={selectedSubId} onValueChange={setSelectedSubId}>
                <SelectTrigger className="h-11 text-sm" data-testid="select-assessment-sub-capability">
                  <SelectValue placeholder="Select a sub-capability (optional)..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedCap.subCapabilities.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-sm py-2">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSubId && selectedCap.subCapabilities.find(s => s.id === selectedSubId)?.description && (
                <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                  {selectedCap.subCapabilities.find(s => s.id === selectedSubId)?.description}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-medium">Product / System Name *</Label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g., Tactical Communications Module, Cyber Defense Suite..."
              className="h-11 text-sm"
              data-testid="input-product-name"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the product's capabilities, technology maturity, intended use case, and operational context..."
              className="min-h-[120px] text-sm"
              data-testid="input-product-desc"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Target Compliance Level *</Label>
            <p className="text-sm text-muted-foreground">
              Choose the readiness level this partner wants to achieve for this assessment.
            </p>
            <Select value={targetLevel} onValueChange={setTargetLevel}>
              <SelectTrigger className="h-11 text-sm" data-testid="select-target-level">
                <SelectValue placeholder="Select target level..." />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => (
                  <SelectItem key={lvl} value={String(lvl)} className="text-sm py-2">
                    Level {lvl} — {LEVEL_LABELS[lvl]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
              <Target className="h-5 w-5 text-primary shrink-0" />
              <div className="text-sm">
                <span className="font-medium">L{targetLevel} — {LEVEL_LABELS[Number(targetLevel)]}</span>
                <p className="text-muted-foreground mt-0.5">
                  All artifacts across 17 verticals up to Level {targetLevel} will be required for compliance.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border/50">
            <Button
              size="lg"
              disabled={!canSubmit || createPending}
              onClick={handleCreate}
              className="px-8"
              data-testid="button-start-assessment-submit"
            >
              {createPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
              Start Assessment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
