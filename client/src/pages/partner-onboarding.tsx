import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useGetPartnerQuery, useSamLookupMutation, useCreatePartnerMutation, useLinkPartnerMutation, useSamSearchMutation, api, apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, Search, Loader2, CheckCircle2,
  Globe, MapPin, AlertTriangle, Save, Lock,
  FileText, ChevronDown, ChevronRight, Shield
} from "lucide-react";
import { VERTICALS, LEVEL_LABELS, type VerticalScores, type Partner } from "@shared/schema";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/pagination-controls";

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
  knownArtifacts: Array<{ name: string; status: string; regulation: string; vertical?: string; level?: number }>;
  pointOfContact: { firstName: string; lastName: string; title: string };
}

interface SamDocByLevel {
  name: string;
  source: string;
  status: string;
  regulation: string;
  vertical: string;
  type: "sam" | "artifact";
}

interface SamSearchResult {
  samFound: boolean;
  samEntity: any;
  discoveredDocuments: Array<SamDocByLevel & { level: number }>;
  documentsByLevel: Record<number, SamDocByLevel[]>;
  initialScores: Record<string, number>;
  totalDiscovered: number;
  fetchedAt?: string;
}

export default function PartnerOnboarding() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lookupType, setLookupType] = useState<"cage" | "uei">("cage");
  const [lookupValue, setLookupValue] = useState("");
  const [samEntity, setSamEntity] = useState<SamEntity | null>(null);
  const [samFound, setSamFound] = useState<boolean | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualUei, setManualUei] = useState("");
  const [manualCage, setManualCage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const partnerId = user?.partnerId;

  const dispatch = useAppDispatch();
  const { data: existingPartner } = useGetPartnerQuery(partnerId!, { skip: !partnerId });

  const hasExistingCageOrUei = !!(existingPartner?.cage || existingPartner?.uei);

  const [samLookupApi, { isLoading: lookupPending }] = useSamLookupMutation();
  const [createPartnerApi, { isLoading: savePending }] = useCreatePartnerMutation();
  const [linkPartnerApi] = useLinkPartnerMutation();
  const [samSearchApi, { isLoading: refreshSamPending }] = useSamSearchMutation();

  const handleLookup = async () => {
    try {
      const payload = lookupType === "cage" ? { cage: lookupValue } : { uei: lookupValue };
      const data = await samLookupApi(payload).unwrap();
      if ((data as any).found && (data as any).entity) {
        setSamEntity((data as any).entity);
        setSamFound(true);
      } else {
        setSamEntity(null);
        setSamFound(false);
      }
    } catch {
      setSamFound(false);
      toast({ title: "Lookup failed", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    try {
      const pName = samEntity?.legalBusinessName || manualName;
      const pUei = samEntity?.uei || manualUei;
      if (!pName.trim()) throw new Error("Organization name is required");

      const scores: VerticalScores = {};
      VERTICALS.forEach(v => { scores[v.key] = 1; });

      const partner = await createPartnerApi({
        name: pName,
        uei: pUei,
        cage: samEntity?.cage || manualCage || lookupValue || null,
        entityType: "partner",
        status: "active",
        overallLevel: 1,
        scores,
        targetLevel: 5,
        samRegistered: !!samEntity,
      }).unwrap();

      await linkPartnerApi({ partnerId: (partner as any).id }).unwrap();

      if (samEntity) {
        await apiRequest("POST", `/api/partners/${(partner as any).id}/auto-discover`, {});
      }

      dispatch(api.util.invalidateTags(["User"]));
      toast({ title: "Company saved", description: "Welcome to Cencore!" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.data || err.message, variant: "destructive" });
    }
  };

  const handleSaveClick = () => {
    const cageVal = samEntity?.cage || manualCage;
    const ueiVal = samEntity?.uei || manualUei;
    if (cageVal || ueiVal) {
      setConfirmOpen(true);
    } else {
      handleSave();
    }
  };

  const handleConfirmSave = () => {
    setConfirmOpen(false);
    handleSave();
  };

  const canSave = !!(samEntity?.legalBusinessName || manualName.trim());

  const [samSearchData, setSamSearchData] = useState<SamSearchResult | null>(() => {
    if (existingPartner?.samData && typeof existingPartner.samData === "object") {
      const saved = existingPartner.samData as any;
      if (saved.samFound && saved.documentsByLevel) return saved as SamSearchResult;
    }
    return null;
  });
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (existingPartner?.samData && typeof existingPartner.samData === "object" && !samSearchData) {
      const saved = existingPartner.samData as any;
      if (saved.samFound && saved.documentsByLevel) {
        setSamSearchData(saved as SamSearchResult);
      }
    }
  }, [existingPartner]);

  const toggleLevel = (level: number) => {
    setExpandedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const handleRefreshSam = async () => {
    if (!partnerId) return;
    try {
      const data = await samSearchApi(partnerId).unwrap() as SamSearchResult;
      setSamSearchData(data);
      if (data.documentsByLevel) {
        setExpandedLevels(new Set(Object.keys(data.documentsByLevel).map(Number)));
      }
      if (data.samFound) {
        toast({ title: "SAM.gov refreshed", description: `Entity verified — ${data.totalDiscovered || 0} documents discovered across ${Object.keys(data.documentsByLevel || {}).length} levels.` });
      } else {
        toast({ title: "SAM.gov lookup complete", description: "Entity not found in SAM.gov.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "SAM.gov refresh failed", description: err.data || err.message, variant: "destructive" });
    }
  };

  if (existingPartner) {
    return (
      <div className="p-3 mx-auto space-y-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-3" data-testid="text-onboarding-title">
            <Building2 className="h-6 w-6 text-primary" />
            Company Info
          </h1>
          <p className="text-sm text-muted-foreground">
            Your organization details are shown below.
          </p>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider">Company Details</h2>
              </div>

              <div className="space-y-2">
                <Label className="text-sm uppercase tracking-wider text-muted-foreground">Organization Name</Label>
                <Input value={existingPartner.name} disabled className="bg-muted/30" data-testid="input-company-name-readonly" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    CAGE Code
                    {existingPartner.cage && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </Label>
                  <Input value={existingPartner.cage || "—"} disabled className="bg-muted/30 font-mono" data-testid="input-company-cage-readonly" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    UEI
                    {existingPartner.uei && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </Label>
                  <Input value={existingPartner.uei || "—"} disabled className="bg-muted/30 font-mono" data-testid="input-company-uei-readonly" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 rounded-md p-3">
                <div>
                  <p className="text-muted-foreground">SAM.gov Status</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {existingPartner.samRegistered ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Verified</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 text-amber-400" />
                        <span className="text-amber-400 font-medium">Not Registered</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Overall Level</p>
                  <p className="font-mono font-semibold mt-0.5">L{existingPartner.overallLevel}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
              <div className="text-sm text-muted-foreground">
                {samSearchData?.fetchedAt && (
                  <span>Last fetched: {new Date(samSearchData.fetchedAt as string).toLocaleString()}</span>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleRefreshSam}
                disabled={refreshSamPending || (!existingPartner.cage && !existingPartner.uei)}
                data-testid="button-refresh-sam"
              >
                {refreshSamPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                {samSearchData ? "Refresh SAM.gov Documents" : "Fetch SAM.gov Documents"}
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    );
  }

  return (
    <div className="p-3 mx-auto space-y-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold flex items-center gap-3" data-testid="text-onboarding-title">
          <Building2 className="h-6 w-6 text-primary" />
          Company Info
        </h1>
        <p className="text-sm text-muted-foreground">
          Set up your organization details to get started with Cencore.
        </p>
      </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider">SAM.gov Lookup</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Search by your CAGE code or UEI to auto-discover your organization from SAM.gov.
              </p>
              <div className="flex items-end gap-3">
                <div className="space-y-2 w-32">
                  <Label className="text-sm uppercase tracking-wider text-muted-foreground">Search By</Label>
                  <Select value={lookupType} onValueChange={(v) => setLookupType(v as "cage" | "uei")}>
                    <SelectTrigger data-testid="select-lookup-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cage">CAGE Code</SelectItem>
                      <SelectItem value="uei">UEI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex-1">
                  <Label className="text-sm uppercase tracking-wider text-muted-foreground">{lookupType === "cage" ? "CAGE Code" : "UEI"}</Label>
                  <Input
                    value={lookupValue}
                    onChange={(e) => setLookupValue(e.target.value)}
                    placeholder={lookupType === "cage" ? "e.g., 3A2B7" : "e.g., HJ5LK7DGBZ15"}
                    data-testid="input-lookup-value"
                  />
                </div>
                <Button
                  onClick={handleLookup}
                  disabled={!lookupValue.trim() || lookupPending}
                  data-testid="button-lookup"
                >
                  {lookupPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                  Search
                </Button>
              </div>

              {samFound === true && samEntity && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3" data-testid="sam-entity-found">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-400">Organization Found</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Legal Name</p>
                      <p className="font-medium">{samEntity.legalBusinessName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium">
                        <MapPin className="h-3 w-3 inline mr-1" />
                        {samEntity.physicalAddress.city}, {samEntity.physicalAddress.state}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">SAM Status</p>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                        <Globe className="h-2.5 w-2.5 mr-1" />{samEntity.samStatus}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">CAGE Code</p>
                      <p className="font-mono text-sm">{samEntity.cage}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">UEI</p>
                      <p className="font-mono text-sm">{samEntity.uei}</p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {samEntity.knownArtifacts.length} artifacts discoverable from SAM.gov
                  </div>
                </div>
              )}

              {samFound === false && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-3" data-testid="sam-entity-not-found">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">Not Found in SAM.gov</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Enter your company details manually below.</p>
                </div>
              )}
            </div>

            {(samFound === false || samFound === null) && (
              <div className="space-y-4 border-t border-white/[0.06] pt-6">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider">Company Details</h2>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm uppercase tracking-wider text-muted-foreground">Organization Name *</Label>
                  <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Legal business name" data-testid="input-manual-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm uppercase tracking-wider text-muted-foreground">UEI</Label>
                    <Input value={manualUei} onChange={(e) => setManualUei(e.target.value)} placeholder="Unique Entity ID" data-testid="input-manual-uei" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm uppercase tracking-wider text-muted-foreground">CAGE Code</Label>
                    <Input value={manualCage} onChange={(e) => setManualCage(e.target.value)} placeholder="e.g., 3A2B7" data-testid="input-manual-cage" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-white/[0.06]">
              <Button
                onClick={handleSaveClick}
                disabled={!canSave || savePending}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-save-company"
              >
                {savePending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Company Information</AlertDialogTitle>
              <AlertDialogDescription>
                Once saved, your CAGE Code and UEI cannot be changed. Please make sure the information is correct before proceeding.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-confirm">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmSave} data-testid="button-confirm-save">
                Confirm & Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

function SamDocumentLevelList({ documentsByLevel, expandedLevels, toggleLevel }: {
  documentsByLevel: Record<number, SamDocByLevel[]>;
  expandedLevels: Set<number>;
  toggleLevel: (level: number) => void;
}) {
  const sortedEntries = Object.entries(documentsByLevel)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([levelStr, docs]) => ({ level: Number(levelStr), docs }));

  const pagination = usePagination(sortedEntries, 4);

  return (
    <div className="space-y-2">
      {pagination.paginatedItems.map(({ level, docs }) => {
        const isExpanded = expandedLevels.has(level);
        const activeCount = docs.filter(d => d.status === "active" || d.status === "verified").length;
        const pendingCount = docs.filter(d => d.status === "pending").length;

        return (
          <div key={level} className="border border-white/[0.06] rounded-lg overflow-hidden" data-testid={`level-group-${level}`}>
            <button
              onClick={() => toggleLevel(level)}
              className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
              data-testid={`button-toggle-level-${level}`}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm font-semibold font-mono">Level {level}</span>
                <span className="text-sm text-muted-foreground">— {LEVEL_LABELS[level] || ""}</span>
                <span className="text-sm text-muted-foreground">
                  ({docs.length} document{docs.length !== 1 ? "s" : ""})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {activeCount > 0 && (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-sm">
                    {activeCount} active
                  </Badge>
                )}
                {pendingCount > 0 && (
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-sm">
                    {pendingCount} pending
                  </Badge>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-white/[0.06]">
                {docs.map((doc, i) => {
                  const verticalInfo = VERTICALS.find(v => v.key === doc.vertical);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm border-b border-white/[0.04] last:border-b-0 hover:bg-muted/20"
                      data-testid={`doc-row-${level}-${i}`}
                    >
                      <div className="flex-shrink-0">
                        {doc.status === "active" || doc.status === "verified" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : doc.status === "pending" ? (
                          <Shield className="h-3.5 w-3.5 text-amber-400" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.name}</p>
                        <p className="text-muted-foreground mt-0.5">{doc.regulation}</p>
                      </div>
                      <Badge variant="outline" className="text-sm font-mono flex-shrink-0">
                        {verticalInfo?.label || doc.vertical}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-sm flex-shrink-0 ${
                          doc.status === "active" || doc.status === "verified"
                            ? "border-emerald-500/30 text-emerald-400"
                            : doc.status === "pending"
                            ? "border-amber-500/30 text-amber-400"
                            : "border-red-500/30 text-red-400"
                        }`}
                      >
                        {doc.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground flex-shrink-0">{doc.source}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <PaginationControls
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        onPageChange={pagination.goToPage}
        noun="levels"
      />
    </div>
  );
}
