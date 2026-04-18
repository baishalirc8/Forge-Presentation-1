import { useGetPartnerQuery, useGetArtifactsQuery, useGetPartnerArtifactsQuery, useGetPartnerDocumentsQuery, useDeleteDocumentMutation, apiRequest, api } from "@/lib/api";
import { useAppDispatch } from "@/lib/store";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MaturityBadge } from "@/components/maturity-badge";
import { RadarChart } from "@/components/radar-chart";
import { useToast } from "@/hooks/use-toast";
import {
  VERTICALS, LEVEL_LABELS, VERIFICATION_LABELS,
  type Partner, type Artifact, type PartnerArtifact, type PartnerDocument, type VerticalScores, type VerificationMethod
} from "@shared/schema";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, CircleDot, FileX,
  Upload, Eye, Building2, ShieldCheck, Loader2, Globe, User,
  FileText, Check, X, Minus, ChevronRight, Download, Trash2, Paperclip, File
} from "lucide-react";
import { useState, useMemo, useRef, useCallback } from "react";

export default function ReportCard() {
  const params = useParams<{ id: string }>();
  const partnerId = params.id;
  const { toast } = useToast();

  const dispatch = useAppDispatch();
  const { data: partner, isLoading } = useGetPartnerQuery(partnerId!);
  const { data: allArtifacts } = useGetArtifactsQuery();
  const { data: partnerArts } = useGetPartnerArtifactsQuery(partnerId!);

  const [drillVertical, setDrillVertical] = useState<string | null>(null);
  const [drillLevel, setDrillLevel] = useState<number | null>(null);
  const [viewerArtifact, setViewerArtifact] = useState<{ artifact: Artifact; pa: PartnerArtifact } | null>(null);
  const [uploadingArtifactId, setUploadingArtifactId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<{ partnerArtifactId: string; artifactId: string } | null>(null);

  const { data: partnerDocs } = useGetPartnerDocumentsQuery(partnerId!);

  const artifactMap = useMemo(() => {
    const map = new Map<string, PartnerArtifact>();
    (partnerArts || []).forEach(pa => map.set(pa.artifactId, pa));
    return map;
  }, [partnerArts]);

  const [deleteDocApi] = useDeleteDocumentMutation();

  const handleScanApprove = async (partnerArtifactId: string) => {
    try {
      await apiRequest("PATCH", `/api/partner-artifacts/${partnerArtifactId}`, {
        status: "pending",
        notes: "Scan initiated - awaiting approval",
      });
      dispatch(api.util.invalidateTags(["Artifacts"]));
      toast({ title: "Scan initiated", description: "Document submitted for verification" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetRef.current) return;

    const { partnerArtifactId, artifactId } = uploadTargetRef.current;
    setUploadingArtifactId(partnerArtifactId);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("partnerArtifactId", partnerArtifactId);
    formData.append("artifactId", artifactId);

    try {
      const res = await fetch(`/api/partners/${partnerId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      dispatch(api.util.invalidateTags(["Documents", "Artifacts"]));
      toast({ title: "Document uploaded", description: file.name });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingArtifactId(null);
      uploadTargetRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [partnerId, toast]);

  const handleDeleteDoc = async (docId: string) => {
    try {
      await deleteDocApi(docId).unwrap();
      toast({ title: "Document removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleApprove = async (partnerArtifactId: string) => {
    try {
      await apiRequest("PATCH", `/api/partner-artifacts/${partnerArtifactId}`, {
        status: "verified",
        verifiedAt: new Date().toISOString(),
        verifiedBy: "Admin Review",
        documentRef: `DOC-${Date.now().toString(36).toUpperCase()}`,
      });
      dispatch(api.util.invalidateTags(["Artifacts"]));
      toast({ title: "Artifact verified" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const [autoDiscoverPending, setAutoDiscoverPending] = useState(false);
  const handleAutoDiscover = async () => {
    setAutoDiscoverPending(true);
    try {
      const res = await apiRequest("POST", `/api/partners/${partnerId}/auto-discover`, {});
      const data = await res.json();
      dispatch(api.util.invalidateTags(["Artifacts", "Activities"]));
      if (data.discovered > 0) {
        toast({ title: "Artifacts discovered", description: `${data.discovered} artifact(s) auto-verified via SAM.gov API` });
      } else {
        toast({ title: "No new artifacts", description: "All discoverable artifacts already verified" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAutoDiscoverPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-3 space-y-3 mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground">
        <Building2 className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Partner not found</p>
      </div>
    );
  }

  const scores = partner.scores as VerticalScores;
  const minLevel = Math.min(...VERTICALS.map((v) => scores[v.key] || 0));

  const drillArtifacts = drillVertical
    ? (allArtifacts || []).filter(a => a.vertical === drillVertical && (drillLevel === null || a.level === drillLevel))
    : [];

  const totalArtifacts = (allArtifacts || []).length;
  const verifiedCount = (partnerArts || []).filter(pa => pa.status === "verified").length;
  const pendingCount = (partnerArts || []).filter(pa => pa.status === "pending" || pa.status === "draft").length;
  const apiVerifiedCount = (partnerArts || []).filter(pa => pa.verifiedBy?.includes("API") || pa.verifiedBy?.includes("Auto")).length;
  const manualVerifiedCount = verifiedCount - apiVerifiedCount;

  return (
    <div className="p-3 space-y-3 mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.txt,.csv"
        onChange={handleFileUpload}
        data-testid="input-file-upload"
      />
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={`/partners/${partnerId}`}>
          <Button variant="ghost" size="icon" data-testid="button-back-to-partner">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight truncate" data-testid="text-report-card-title">
              Report Card
            </h1>
            <MaturityBadge level={partner.overallLevel} size="lg" />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{partner.name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {partner.samRegistered && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoDiscover}
              disabled={autoDiscoverPending}
              data-testid="button-auto-discover"
            >
              {autoDiscoverPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Globe className="h-3.5 w-3.5 mr-1.5" />}
              Re-scan SAM.gov
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Verified" value={verifiedCount} total={totalArtifacts} color="emerald" testId="stat-verified" />
        <MiniStat label="Pending" value={pendingCount} total={totalArtifacts} color="amber" testId="stat-pending" />
        <MiniStat label="API Auto" value={apiVerifiedCount} total={verifiedCount || 1} color="blue" testId="stat-api" icon={<Globe className="h-3 w-3" />} />
        <MiniStat label="Manual" value={manualVerifiedCount} total={verifiedCount || 1} color="purple" testId="stat-manual" icon={<User className="h-3 w-3" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Readiness Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <RadarChart scores={scores} targetLevel={partner.targetLevel} size={240} />
            <div className="grid grid-cols-2 gap-3 w-full mt-3 pt-3 border-t border-border/50">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Floor</p>
                <p className="text-lg font-mono font-semibold">L{minLevel}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</p>
                <p className="text-lg font-mono font-semibold">L{partner.targetLevel}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium">Compliance Matrix</CardTitle>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Click any cell to drill down
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-compliance-matrix">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-muted-foreground font-normal w-20">Vertical</th>
                    {[1,2,3,4,5,6,7,8,9].map(l => (
                      <th key={l} className="text-center p-1.5 text-muted-foreground font-normal w-12">
                        <span className="font-mono">L{l}</span>
                      </th>
                    ))}
                    <th className="text-center p-1.5 text-muted-foreground font-normal w-14">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {VERTICALS.map(v => {
                    const score = scores[v.key] || 0;
                    const vertArtifacts = (allArtifacts || []).filter(a => a.vertical === v.key);
                    const isHighPriority = v.priority === 1 || v.priority === 2;
                    const vertPAs = vertArtifacts.map(a => artifactMap.get(a.id)).filter(Boolean);
                    const vertVerified = vertPAs.filter(pa => pa?.status === "verified").length;
                    const vertTotal = vertArtifacts.length;

                    return (
                      <tr key={v.key} data-testid={`compliance-row-${v.key}`}>
                        <td className={`p-2 ${isHighPriority ? "font-bold" : ""}`}>
                          <span className="font-mono text-[10px]">{v.key}</span>
                        </td>
                        {[1,2,3,4,5,6,7,8,9].map(level => {
                          const hasArtifact = vertArtifacts.some(a => a.level === level);
                          const levelArtifacts = vertArtifacts.filter(a => a.level === level);
                          const levelPAStatuses = levelArtifacts.map(a => artifactMap.get(a.id)?.status || "missing");

                          let cellStatus: "verified" | "pending" | "draft" | "missing" | "inherited" | "na";
                          if (!hasArtifact && level <= score) {
                            cellStatus = "inherited";
                          } else if (!hasArtifact) {
                            cellStatus = "na";
                          } else if (levelPAStatuses.length > 0 && levelPAStatuses.every(s => s === "verified")) {
                            cellStatus = "verified";
                          } else if (levelPAStatuses.some(s => s === "pending" || s === "draft")) {
                            cellStatus = levelPAStatuses.includes("pending") ? "pending" : "draft";
                          } else if (level < score) {
                            cellStatus = "inherited";
                          } else {
                            cellStatus = "missing";
                          }

                          const isTarget = level === partner.targetLevel;

                          return (
                            <td key={level} className="p-0.5">
                              <button
                                className={`w-full h-7 rounded-sm flex items-center justify-center transition-colors cursor-pointer border ${
                                  isTarget ? "ring-1 ring-amber-400/40 " : ""
                                }${
                                  cellStatus === "verified" ? "bg-emerald-500/15 border-emerald-500/20" :
                                  cellStatus === "inherited" ? "bg-emerald-500/8 border-emerald-500/10" :
                                  cellStatus === "pending" ? "bg-amber-500/15 border-amber-500/20" :
                                  cellStatus === "draft" ? "bg-primary/10 border-primary/20" :
                                  cellStatus === "na" ? "bg-muted/20 border-border/30" :
                                  "bg-red-500/8 border-red-500/15"
                                }`}
                                onClick={() => {
                                  if (hasArtifact) {
                                    setDrillVertical(v.key);
                                    setDrillLevel(level);
                                  }
                                }}
                                data-testid={`cell-${v.key}-${level}`}
                              >
                                {cellStatus === "verified" && <Check className="h-3 w-3 text-emerald-400" />}
                                {cellStatus === "inherited" && <Check className="h-3 w-3 text-emerald-400/50" />}
                                {cellStatus === "pending" && <CircleDot className="h-3 w-3 text-amber-400" />}
                                {cellStatus === "draft" && <Eye className="h-3 w-3 text-primary" />}
                                {cellStatus === "missing" && <X className="h-3 w-3 text-red-400/60" />}
                                {cellStatus === "na" && <Minus className="h-2.5 w-2.5 text-muted-foreground/30" />}
                              </button>
                            </td>
                          );
                        })}
                        <td className="p-1 text-center">
                          {vertTotal > 0 ? (
                            <span className={`text-[10px] font-mono ${vertVerified === vertTotal ? "text-emerald-400" : "text-muted-foreground"}`}>
                              {vertVerified}/{vertTotal}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30 flex-wrap">
              <LegendItem color="bg-emerald-500/15 border-emerald-500/20" label="Verified" icon={<Check className="h-2 w-2 text-emerald-400" />} />
              <LegendItem color="bg-amber-500/15 border-amber-500/20" label="Pending" icon={<CircleDot className="h-2 w-2 text-amber-400" />} />
              <LegendItem color="bg-primary/10 border-primary/20" label="Draft" />
              <LegendItem color="bg-red-500/8 border-red-500/15" label="Missing" icon={<X className="h-2 w-2 text-red-400" />} />
              <LegendItem color="bg-emerald-500/8 border-emerald-500/10" label="Inherited" />
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm ring-1 ring-amber-400/40 bg-muted/10" />
                <span className="text-[10px] text-muted-foreground">Target Level</span>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Globe className="h-3 w-3 text-primary" />
                  <span className="text-[10px] text-muted-foreground">API-Fetched</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3 text-purple-400" />
                  <span className="text-[10px] text-muted-foreground">Manual Upload</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={drillVertical !== null} onOpenChange={(open) => { if (!open) { setDrillVertical(null); setDrillLevel(null); } }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-sm">{drillVertical}</span>
              {drillLevel && <span className="text-muted-foreground">Level {drillLevel}</span>}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {drillVertical && VERTICALS.find(v => v.key === drillVertical)?.name} — artifact requirements and verification status
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {drillArtifacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No artifacts defined for this level</p>
            ) : (
              drillArtifacts.map(artifact => {
                const pa = artifactMap.get(artifact.id);
                const status = pa?.status || "missing";
                const isApiSource = pa?.verifiedBy?.includes("API") || pa?.verifiedBy?.includes("Auto");
                return (
                  <div key={artifact.id} className="p-3 rounded-md bg-muted/30 space-y-2" data-testid={`drill-artifact-${artifact.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-sm shrink-0 mt-0.5 ${
                          status === "verified" ? "bg-emerald-500/20" : status === "pending" ? "bg-amber-500/20" : "bg-muted"
                        }`}>
                          {status === "verified" ? <Check className="h-3 w-3 text-emerald-400" /> :
                           status === "pending" ? <CircleDot className="h-2.5 w-2.5 text-amber-400" /> :
                           <X className="h-3 w-3 text-muted-foreground/40" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{artifact.name}</p>
                          {artifact.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">{artifact.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {status === "verified" && isApiSource && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] gap-0.5">
                            <Globe className="h-2.5 w-2.5" />API
                          </Badge>
                        )}
                        {status === "verified" && !isApiSource && pa?.verifiedBy && (
                          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[9px] gap-0.5">
                            <User className="h-2.5 w-2.5" />Manual
                          </Badge>
                        )}
                        <StatusBadge status={status} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap pl-7">
                      {artifact.regulation && (
                        <span className="text-[10px] font-mono text-muted-foreground">{artifact.regulation}</span>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {VERIFICATION_LABELS[artifact.verificationMethod as VerificationMethod] || artifact.verificationMethod}
                      </Badge>
                      <span className={`text-[10px] font-mono ${
                        (artifact.automationScore || 0) >= 0.7 ? "text-emerald-400" : (artifact.automationScore || 0) >= 0.4 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {Math.round((artifact.automationScore || 0) * 100)}% auto
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-7 flex-wrap">
                      {pa && status === "verified" && pa.documentRef && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-sm"
                          onClick={() => setViewerArtifact({ artifact, pa })}
                          data-testid={`button-view-${artifact.id}`}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Document
                        </Button>
                      )}
                      {pa && (status === "missing" || status === "draft") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-sm"
                          onClick={() => {
                            uploadTargetRef.current = { partnerArtifactId: pa.id, artifactId: artifact.id };
                            fileInputRef.current?.click();
                          }}
                          disabled={uploadingArtifactId === pa.id}
                          data-testid={`button-upload-${artifact.id}`}
                        >
                          {uploadingArtifactId === pa.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Paperclip className="h-3 w-3 mr-1" />
                          )}
                          Upload Document
                        </Button>
                      )}
                      {pa && status === "missing" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-sm"
                          onClick={() => handleScanApprove(pa.id)}
                          disabled={false}
                          data-testid={`button-scan-${artifact.id}`}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Scan & Submit
                        </Button>
                      )}
                      {pa && (status === "pending" || status === "draft") && (
                        <Button
                          size="sm"
                          className="h-7 text-sm"
                          onClick={() => handleApprove(pa.id)}
                          disabled={false}
                          data-testid={`button-approve-${artifact.id}`}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                      )}
                    </div>
                    {pa && (() => {
                      const docs = (partnerDocs || []).filter(d => d.partnerArtifactId === pa.id);
                      if (docs.length === 0) return null;
                      return (
                        <div className="pl-7 space-y-1.5 mt-1" data-testid={`docs-list-${artifact.id}`}>
                          {docs.map(doc => (
                            <div key={doc.id} className="flex items-center gap-2 p-1.5 rounded bg-muted/20 group" data-testid={`doc-item-${doc.id}`}>
                              <File className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-sm text-muted-foreground truncate flex-1">{doc.fileName}</span>
                              <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">
                                {doc.fileSize < 1024 ? `${doc.fileSize}B` : doc.fileSize < 1048576 ? `${Math.round(doc.fileSize / 1024)}KB` : `${(doc.fileSize / 1048576).toFixed(1)}MB`}
                              </span>
                              <a
                                href={`/api/documents/${doc.filePath}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                data-testid={`button-download-${doc.id}`}
                              >
                                <Download className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </a>
                              <button
                                onClick={() => handleDeleteDoc(doc.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                data-testid={`button-delete-doc-${doc.id}`}
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" />
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewerArtifact !== null} onOpenChange={(open) => { if (!open) setViewerArtifact(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Document Viewer
            </DialogTitle>
            <DialogDescription>In-app preview — no download required</DialogDescription>
          </DialogHeader>
          {viewerArtifact && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Artifact</span>
                  <span className="text-sm font-medium">{viewerArtifact.artifact.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Regulation</span>
                  <span className="text-sm font-mono">{viewerArtifact.artifact.regulation || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Document Ref</span>
                  <span className="text-sm font-mono">{viewerArtifact.pa.documentRef}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Verified By</span>
                  <div className="flex items-center gap-1.5">
                    {viewerArtifact.pa.verifiedBy?.includes("API") || viewerArtifact.pa.verifiedBy?.includes("Auto") ? (
                      <Globe className="h-3 w-3 text-primary" />
                    ) : (
                      <User className="h-3 w-3 text-purple-400" />
                    )}
                    <span className="text-sm">{viewerArtifact.pa.verifiedBy || "Unknown"}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Verified At</span>
                  <span className="text-sm">
                    {viewerArtifact.pa.verifiedAt ? new Date(viewerArtifact.pa.verifiedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                  </span>
                </div>
              </div>
              <div className="rounded-md border border-border/50 p-4 min-h-[200px]">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/30">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Document Content Preview</span>
                  <Badge variant="secondary" className="text-[9px] ml-auto">Read-Only</Badge>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  <p className="font-medium text-foreground">{viewerArtifact.artifact.name}</p>
                  <p>Regulatory Reference: {viewerArtifact.artifact.regulation || "N/A"}</p>
                  <p>Verification Method: {VERIFICATION_LABELS[viewerArtifact.artifact.verificationMethod as VerificationMethod]}</p>
                  <div className="border-t border-border/20 pt-2 mt-2">
                    <p>{viewerArtifact.artifact.description}</p>
                    <p className="mt-2">
                      This artifact has been {viewerArtifact.pa.verifiedBy?.includes("API") ? "automatically retrieved and verified via the SAM.gov API" : "manually submitted and approved through administrative review"}.
                    </p>
                    <p className="mt-1">
                      Document reference: {viewerArtifact.pa.documentRef}
                    </p>
                  </div>
                  {viewerArtifact.pa.notes && (
                    <div className="border-t border-border/20 pt-2 mt-2">
                      <p className="font-medium text-foreground">Notes</p>
                      <p>{viewerArtifact.pa.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({ label, value, total, color, testId, icon }: {
  label: string; value: number; total: number; color: string; testId: string; icon?: React.ReactNode;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const colorClasses: Record<string, string> = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    blue: "text-primary",
    purple: "text-purple-400",
  };
  return (
    <Card data-testid={testId}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            {icon}{label}
          </span>
          <span className={`text-[10px] font-mono ${colorClasses[color] || "text-muted-foreground"}`}>{pct}%</span>
        </div>
        <p className={`text-lg font-mono font-semibold ${colorClasses[color] || ""}`}>{value}</p>
        <div className="h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              color === "emerald" ? "bg-emerald-400" : color === "amber" ? "bg-amber-400" : color === "blue" ? "bg-primary" : "bg-purple-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function LegendItem({ color, label, icon }: { color: string; label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "verified") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[9px]">Verified</Badge>;
  if (status === "pending") return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[9px]">Pending</Badge>;
  if (status === "draft") return <Badge className="bg-primary/15 text-primary border-primary/20 text-[9px]">Draft</Badge>;
  return <Badge className="bg-red-500/10 text-red-400 border-red-500/15 text-[9px]">Missing</Badge>;
}
