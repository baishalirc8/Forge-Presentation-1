import { useState } from "react";
import { useSamLookupMutation, useCreatePartnerMutation, useAiRecommendLevelMutation, useCreateAssessmentMutation, useSamSearchMutation, apiRequest } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Search, Shield, ArrowRight, Building2, Loader2, CheckCircle2,
  AlertTriangle, Sparkles, FileCheck, ArrowLeft, Globe, MapPin
} from "lucide-react";
import { VERTICALS, type VerticalScores } from "@shared/schema";

interface SamEntity {
  uei: string;
  cage: string;
  legalBusinessName: string;
  entityType: string;
  samStatus: string;
  registrationDate: string;
  expirationDate: string;
  physicalAddress: { city: string; state: string; country: string };
  naicsCodes: string[];
  knownArtifacts: Array<{ name: string; status: string; regulation: string }>;
  pointOfContact: { firstName: string; lastName: string; title: string };
}

interface SamLookupResult {
  found: boolean;
  entity: SamEntity | null;
  discoveredArtifacts: Array<{ name: string; status: string; regulation: string; vertical?: string; level?: number }>;
}

interface AiRecommendation {
  recommendedLevel: number;
  confidence: number;
  reasoning: string;
}

type Step = "lookup" | "discovery" | "capability" | "review";

export default function Lookup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [uei, setUei] = useState("");
  const [cage, setCage] = useState("");
  const [step, setStep] = useState<Step>("lookup");
  const [samResult, setSamResult] = useState<SamLookupResult | null>(null);
  const [name, setName] = useState("");
  const [targetLevel, setTargetLevel] = useState("5");
  const [capabilityDesc, setCapabilityDesc] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState<AiRecommendation | null>(null);

  const [samLookup, { isLoading: samLookupPending }] = useSamLookupMutation();
  const [aiRecommendLevel, { isLoading: aiRecommendPending }] = useAiRecommendLevelMutation();
  const [createPartnerApi, { isLoading: createPartnerPending }] = useCreatePartnerMutation();

  const handleSamLookup = async () => {
    try {
      const result = await samLookup({ cage: cage.trim() || undefined, uei: uei.trim() || undefined }).unwrap();
      setSamResult(result as SamLookupResult);
      if ((result as SamLookupResult).found && (result as SamLookupResult).entity) {
        setName((result as SamLookupResult).entity!.legalBusinessName);
      }
      setStep("discovery");
    } catch (err: any) {
      toast({ title: "Lookup failed", description: err.data || err.message, variant: "destructive" });
    }
  };

  const handleAiRecommend = async () => {
    try {
      const entity = samResult?.entity;
      const result = await aiRecommendLevel({
        samStatus: entity?.samStatus || "Inactive",
        knownArtifactCount: samResult?.discoveredArtifacts?.length || 0,
        entityType: "partner",
        hasExportControl: false,
        hasCMMC: samResult?.discoveredArtifacts?.some(a => a.vertical === "CRL" || a.name.includes("SPRS")) || false,
        hasCPARS: samResult?.discoveredArtifacts?.some(a => a.vertical === "FRL") || false,
        capabilityDescription: capabilityDesc,
      }).unwrap();
      setAiRecommendation(result as AiRecommendation);
      setTargetLevel((result as AiRecommendation).recommendedLevel.toString());
      setStep("review");
    } catch (err: any) {
      toast({ title: "AI analysis failed", description: err.data || err.message, variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    try {
      const initialScores: VerticalScores = {};
      const discoveredCount = samResult?.discoveredArtifacts?.length || 0;
      const baseMin = samResult?.found ? Math.min(3, Math.floor(discoveredCount / 2) + 1) : 1;

      VERTICALS.forEach((v) => {
        initialScores[v.key] = baseMin + Math.floor(Math.random() * 3);
      });

      const overallLevel = Math.min(...Object.values(initialScores));

      const data = await createPartnerApi({
        name,
        uei: uei || samResult?.entity?.uei || `AUTO-${Date.now().toString(36).toUpperCase()}`,
        cage: cage || samResult?.entity?.cage || null,
        entityType: "partner",
        status: "active",
        overallLevel,
        scores: initialScores,
        targetLevel: parseInt(targetLevel),
        samRegistered: samResult?.found || false,
      }).unwrap();

      await apiRequest("POST", "/api/activities", {
        partnerId: (data as any).id,
        type: "registration",
        description: `${name} registered via ${samResult?.found ? "SAM.gov API discovery" : "manual entry"} (${cage ? `CAGE: ${cage}` : `UEI: ${uei}`})`,
        vertical: null,
        metadata: { source: samResult?.found ? "sam_api" : "manual", discoveredArtifacts: samResult?.discoveredArtifacts?.length || 0 },
      }).catch(() => {});

      if (samResult?.found) {
        await apiRequest("POST", `/api/partners/${(data as any).id}/auto-discover`, {}).catch(() => {});
      }

      await apiRequest("POST", "/api/activities", {
        partnerId: (data as any).id,
        type: "assessment",
        description: `Baseline assessment initiated across 17 WRA verticals — target L${targetLevel}`,
        vertical: null,
        metadata: { verticals: 17, targetLevel: parseInt(targetLevel) },
      }).catch(() => {});

      toast({ title: "Partner registered", description: `${name} added to portfolio. ${samResult?.found ? "SAM.gov artifacts auto-discovered." : ""}` });
      navigate(`/partners/${(data as any).id}`);
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.data || err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-3 mx-auto">
      <div className="mb-3">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Partner Onboarding
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Register and assess a partner using automated API discovery
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {(["lookup", "discovery", "capability", "review"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-mono shrink-0 ${
              step === s ? "bg-primary text-primary-foreground" : i < (["lookup", "discovery", "capability", "review"] as Step[]).indexOf(step) ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"
            }`}>
              {i < (["lookup", "discovery", "capability", "review"] as Step[]).indexOf(step) ? "✓" : i + 1}
            </div>
            <span className={`text-[10px] uppercase tracking-wider hidden sm:inline ${step === s ? "text-foreground" : "text-muted-foreground"}`}>
              {s === "lookup" ? "Identify" : s === "discovery" ? "Discover" : s === "capability" ? "Assess" : "Register"}
            </span>
            {i < 3 && <div className="flex-1 h-px bg-border" />}
          </div>
        ))}
      </div>

      {step === "lookup" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                <Search className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Entity Identification</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Enter a CAGE Code or UEI to query the SAM.gov emulator
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cage" className="text-sm uppercase tracking-wider text-muted-foreground">
                CAGE Code (Primary)
              </Label>
              <Input
                id="cage"
                placeholder="e.g., 3A2B7"
                value={cage}
                onChange={(e) => setCage(e.target.value.toUpperCase())}
                className="font-mono"
                data-testid="input-cage"
              />
              <p className="text-[10px] text-muted-foreground">Primary identifier for SAM.gov artifact discovery</p>
            </div>
            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-2">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uei" className="text-sm uppercase tracking-wider text-muted-foreground">
                Unique Entity Identifier (UEI)
              </Label>
              <Input
                id="uei"
                placeholder="e.g., HJ5LK7DGBZ15"
                value={uei}
                onChange={(e) => setUei(e.target.value.toUpperCase())}
                className="font-mono"
                data-testid="input-uei"
              />
            </div>
            <Button
              className="w-full"
              disabled={(!uei.trim() && !cage.trim()) || samLookupPending}
              onClick={handleSamLookup}
              data-testid="button-lookup"
            >
              {samLookupPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Globe className="h-4 w-4 mr-2" />
              )}
              Query SAM.gov
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "discovery" && (
        <div className="space-y-4">
          {samResult?.found && samResult.entity ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">Entity Found</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">SAM.gov returned a match</p>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                      {samResult.entity.samStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md bg-muted/30 p-4 space-y-2">
                    <p className="text-sm font-semibold" data-testid="text-discovered-name">{samResult.entity.legalBusinessName}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">CAGE: </span>
                        <span className="font-mono">{samResult.entity.cage}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">UEI: </span>
                        <span className="font-mono">{samResult.entity.uei}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span>{samResult.entity.physicalAddress.city}, {samResult.entity.physicalAddress.state}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">SAM Status: </span>
                        <span className="capitalize">{samResult.entity.samStatus}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] text-muted-foreground">NAICS:</span>
                      {samResult.entity.naicsCodes.map(code => (
                        <Badge key={code} variant="secondary" className="text-[10px] font-mono">{code}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                      <FileCheck className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">Discovered Artifacts</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {samResult.discoveredArtifacts.length} artifact(s) retrieved via API
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {samResult.discoveredArtifacts.map((artifact, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/20" data-testid={`discovered-artifact-${i}`}>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{artifact.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{artifact.regulation}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          <Globe className="h-2.5 w-2.5 mr-1" />
                          API
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    These artifacts will be auto-verified upon registration. Manual upload only required for documents not retrievable via API.
                  </p>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">New Entity</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      No match found in SAM.gov — manual registration required
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm uppercase tracking-wider text-muted-foreground">Organization Name</Label>
                  <Input
                    placeholder="e.g., Northstar Defense Systems"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="input-name"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep("lookup")} data-testid="button-back-lookup">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={!samResult?.found && !name.trim()}
              onClick={() => setStep("capability")}
              data-testid="button-next-capability"
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === "capability" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Capability Assessment</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Describe capabilities for AI-guided level recommendation
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm uppercase tracking-wider text-muted-foreground">
                  Capability Description
                </Label>
                <Textarea
                  placeholder="Describe the partner's primary capabilities, existing certifications, and relevant experience in defense/government contracting. Include details about technology maturity, manufacturing capacity, cyber posture, and any existing CMMC or RMF certifications..."
                  value={capabilityDesc}
                  onChange={(e) => setCapabilityDesc(e.target.value)}
                  className="min-h-[120px] text-sm"
                  data-testid="input-capability-desc"
                />
                <p className="text-[10px] text-muted-foreground">
                  This data feeds the AI assessment engine to recommend an appropriate certification level.
                  Detailed descriptions yield higher-confidence recommendations.
                </p>
              </div>

            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep("discovery")} data-testid="button-back-discovery">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={aiRecommendPending}
              onClick={handleAiRecommend}
              data-testid="button-get-recommendation"
            >
              {aiRecommendPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Get AI Recommendation
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          {aiRecommendation && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">AI Assessment</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Level recommendation based on profile analysis
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-mono font-bold text-primary">L{aiRecommendation.recommendedLevel}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {Math.round(aiRecommendation.confidence * 100)}% confidence
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md bg-muted/30 p-3">
                  <p className="text-sm leading-relaxed" data-testid="text-ai-reasoning">{aiRecommendation.reasoning}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Registration Review</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Confirm details and finalize registration
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Organization</span>
                  <span className="text-sm font-medium">{name || samResult?.entity?.legalBusinessName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">CAGE / UEI</span>
                  <span className="text-sm font-mono">{cage || samResult?.entity?.cage || "—"} / {uei || samResult?.entity?.uei || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">SAM.gov Status</span>
                  <Badge className={samResult?.found ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-amber-500/15 text-amber-400 border-amber-500/20"}>
                    {samResult?.found ? "Verified" : "Not Found"}
                  </Badge>
                </div>
                {samResult?.discoveredArtifacts && samResult.discoveredArtifacts.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Auto-Discovered Artifacts</span>
                    <span className="text-sm font-mono text-emerald-400">{samResult.discoveredArtifacts.length}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm uppercase tracking-wider text-muted-foreground">
                  Target Level {aiRecommendation ? "(AI Recommended)" : ""}
                </Label>
                <Select value={targetLevel} onValueChange={setTargetLevel}>
                  <SelectTrigger data-testid="select-target-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
                      <SelectItem key={l} value={l.toString()}>
                        Level {l}{aiRecommendation?.recommendedLevel === l ? " (Recommended)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Applying for Level {targetLevel} will require validation of all prerequisites for Levels 1 through {parseInt(targetLevel) - 1}.
                </p>
              </div>

              {!samResult?.found && (
                <div className="space-y-2">
                  <Label className="text-sm uppercase tracking-wider text-muted-foreground">Organization Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name-review" />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep("capability")} data-testid="button-back-capability">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={!(name || samResult?.entity?.legalBusinessName) || createPartnerPending}
              onClick={handleCreate}
              data-testid="button-register"
            >
              {createPartnerPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Register Partner
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
