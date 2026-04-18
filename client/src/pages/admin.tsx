import {
  useGetCapabilitiesQuery, useCreateCapabilityMutation, useUpdateCapabilityMutation, useDeleteCapabilityMutation,
  useCreateSubCapabilityMutation, useUpdateSubCapabilityMutation, useDeleteSubCapabilityMutation,
  useGetVerticalConfigsQuery, useCreateVerticalConfigMutation,
  useGetArtifactsQuery, useCreateArtifactMutation, useUpdateArtifactMutation, useDeleteArtifactMutation,
  api, apiRequest
} from "@/lib/api";
import { useAppDispatch } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  VERTICALS, VERIFICATION_LABELS, LEVEL_LABELS, CAPABILITY_STATUS_LABELS,
  type Artifact, type VerticalConfig, type VerificationMethod, VERIFICATION_METHODS,
  type Capability, type CapabilityStatus, type SubCapability
} from "@shared/schema";
import { Settings, Plus, Trash2, Shield, FileText, Loader2, ChevronRight, Layers, GitBranch, Pencil, X, Bot, CheckCircle2, Clock, Globe } from "lucide-react";
import { useState, useMemo } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/pagination-controls";
import { AdminGuide } from "@/components/admin-guide";

export default function Admin() {
  const [guideOpen, setGuideOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("verticals");

  return (
    <div className="p-3 space-y-3 mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
          <Settings className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
            Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage verticals and verification requirements
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setGuideOpen(true)}
          data-testid="button-admin-guide"
        >
          <Bot className="h-4 w-4" />
          AI Guide
        </Button>
      </div>

      <Tabs defaultValue="verticals" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="verticals" data-testid="tab-admin-verticals">Verticals</TabsTrigger>
          <TabsTrigger value="artifacts" data-testid="tab-admin-artifacts">Artifacts</TabsTrigger>
        </TabsList>

        <TabsContent value="verticals" className="mt-4">
          <VerticalConfigPanel />
        </TabsContent>
        <TabsContent value="artifacts" className="mt-4">
          <ArtifactPanel />
        </TabsContent>
      </Tabs>

      <AdminGuide open={guideOpen} onClose={() => setGuideOpen(false)} activeTab={activeTab} />
    </div>
  );
}

interface CapabilityWithSubs extends Capability {
  subCapabilities: SubCapability[];
}

function CapabilitiesPanel() {
  const { data: capabilities, isLoading } = useGetCapabilitiesQuery();
  const [expandedCap, setExpandedCap] = useState<string | null>(null);
  const [addCapOpen, setAddCapOpen] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState<string | null>(null);
  const [editCapId, setEditCapId] = useState<string | null>(null);
  const [editCapName, setEditCapName] = useState("");
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState("");
  const [editSubDesc, setEditSubDesc] = useState("");
  const { toast } = useToast();
  const dispatch = useAppDispatch();

  const [createCapApi] = useCreateCapabilityMutation();
  const [updateCapApi] = useUpdateCapabilityMutation();
  const [deleteCapApi] = useDeleteCapabilityMutation();
  const [createSubApi] = useCreateSubCapabilityMutation();
  const [updateSubApi] = useUpdateSubCapabilityMutation();
  const [deleteSubApi] = useDeleteSubCapabilityMutation();

  const createCapMutation = { mutate: async (data: { name: string; sortOrder: number }) => {
    try { await createCapApi(data).unwrap(); setAddCapOpen(false); toast({ title: "Capability created" }); } catch {}
  }, isPending: false };
  const updateCapMutation = { mutate: async ({ id, name }: { id: string; name: string }) => {
    try { await updateCapApi({ id, data: { name } }).unwrap(); setEditCapId(null); toast({ title: "Capability updated" }); } catch {}
  }, isPending: false };
  const deleteCapMutation = { mutate: async (id: string) => {
    try { await deleteCapApi(id).unwrap(); toast({ title: "Capability deleted" }); } catch {}
  }, isPending: false };
  const createSubMutation = { mutate: async (data: { capabilityId: string; name: string; description: string; sortOrder: number }) => {
    try { await createSubApi({ capId: data.capabilityId, data: { name: data.name, description: data.description || null, sortOrder: data.sortOrder } }).unwrap(); setAddSubOpen(null); toast({ title: "Sub-capability created" }); } catch {}
  }, isPending: false };
  const updateSubMutation = { mutate: async ({ id, capabilityId, name, description }: { id: string; capabilityId: string; name: string; description: string }) => {
    try { await updateSubApi({ capId: capabilityId, subId: id, data: { name, description: description || null } }).unwrap(); setEditSubId(null); toast({ title: "Sub-capability updated" }); } catch {}
  }, isPending: false };
  const deleteSubMutation = { mutate: async ({ id, capabilityId }: { id: string; capabilityId: string }) => {
    try { await deleteSubApi({ capId: capabilityId, subId: id }).unwrap(); toast({ title: "Sub-capability deleted" }); } catch {}
  }, isPending: false };
  const changeStatusMutation = { mutate: async ({ id, status }: { id: string; status: string }) => {
    try {
      await apiRequest("PATCH", `/api/capabilities/${id}/status`, { status });
      dispatch(api.util.invalidateTags(["Capabilities"]));
      toast({ title: `Capability ${status}` });
    } catch {}
  }, isPending: false };

  const [capSubTab, setCapSubTab] = useState<"published" | "pending">("published");
  const totalSubs = (capabilities || []).reduce((sum, c) => sum + c.subCapabilities.length, 0);
  const pendingCaps = (capabilities || []).filter(c => c.status === "pending" || c.status === "approved");
  const publishedCaps = (capabilities || []).filter(c => c.status === "published");
  const activeCaps = capSubTab === "pending" ? pendingCaps : publishedCaps;
  const capPagination = usePagination(activeCaps, 10);

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground" data-testid="text-capabilities-summary">
            {(capabilities || []).length} capabilities with {totalSubs} sub-capabilities
          </p>
        </div>
        <Dialog open={addCapOpen} onOpenChange={setAddCapOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-capability">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Capability
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Capability</DialogTitle>
              <DialogDescription>Add a new warfighter readiness capability</DialogDescription>
            </DialogHeader>
            <AddCapabilityForm
              onSubmit={(name) => createCapMutation.mutate({ name, sortOrder: (capabilities || []).length })}
              isPending={createCapMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-muted/40 w-fit mb-3">
        <button
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${capSubTab === "published" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => { setCapSubTab("published"); capPagination.goToPage(1); }}
          data-testid="tab-capabilities-published"
        >
          Published
          <span className="ml-1.5 text-xs opacity-60">{publishedCaps.length}</span>
        </button>
        <button
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${capSubTab === "pending" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => { setCapSubTab("pending"); capPagination.goToPage(1); }}
          data-testid="tab-capabilities-pending"
        >
          Pending Review
          {pendingCaps.length > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
              {pendingCaps.length}
            </span>
          )}
        </button>
      </div>

      {activeCaps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Layers className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">{capSubTab === "pending" ? "No capabilities pending review" : "No published capabilities yet"}</p>
          </CardContent>
        </Card>
      ) : (
        capPagination.paginatedItems.map((cap) => {
          const isExpanded = expandedCap === cap.id;
          const isEditing = editCapId === cap.id;

          return (
            <Card key={cap.id} data-testid={`card-capability-${cap.id}`}>
              <CardContent className="p-0">
                <div className="p-4 flex items-center gap-4">
                  <button
                    className="flex-1 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors rounded-lg -m-2 p-2"
                    onClick={() => setExpandedCap(isExpanded ? null : cap.id)}
                    data-testid={`button-expand-capability-${cap.id}`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 shrink-0">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editCapName}
                            onChange={(e) => setEditCapName(e.target.value)}
                            className="h-7 text-sm"
                            data-testid="input-edit-capability-name"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editCapName.trim()) {
                                updateCapMutation.mutate({ id: cap.id, name: editCapName.trim() });
                              }
                              if (e.key === "Escape") setEditCapId(null);
                            }}
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                            if (editCapName.trim()) updateCapMutation.mutate({ id: cap.id, name: editCapName.trim() });
                          }} data-testid="button-save-capability-name">
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditCapId(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm font-medium" data-testid={`text-capability-name-${cap.id}`}>{cap.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <CapabilityStatusBadge status={cap.status as CapabilityStatus} />
                      <Badge variant="secondary" className="text-[10px]">
                        {cap.subCapabilities.length} sub-capabilities
                      </Badge>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {cap.status === "pending" && (
                      <>
                        <Button variant="ghost" size="sm" className="h-7 text-sm gap-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10" onClick={(e) => {
                          e.stopPropagation();
                          changeStatusMutation.mutate({ id: cap.id, status: "approved" });
                        }} data-testid={`button-approve-capability-${cap.id}`}>
                          <CheckCircle2 className="h-3 w-3" />
                          Approve
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-sm gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={(e) => {
                          e.stopPropagation();
                          deleteCapMutation.mutate(cap.id);
                        }} data-testid={`button-reject-capability-${cap.id}`}>
                          <Trash2 className="h-3 w-3" />
                          Reject
                        </Button>
                      </>
                    )}
                    {cap.status === "approved" && (
                      <Button variant="ghost" size="sm" className="h-7 text-sm gap-1 text-primary hover:text-primary/80 hover:bg-primary/10" onClick={(e) => {
                        e.stopPropagation();
                        changeStatusMutation.mutate({ id: cap.id, status: "published" });
                      }} data-testid={`button-publish-capability-${cap.id}`}>
                        <Globe className="h-3 w-3" />
                        Publish
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
                      e.stopPropagation();
                      setEditCapId(cap.id);
                      setEditCapName(cap.name);
                    }} data-testid={`button-edit-capability-${cap.id}`}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
                      e.stopPropagation();
                      deleteCapMutation.mutate(cap.id);
                    }} data-testid={`button-delete-capability-${cap.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2 border-t border-border/50">
                    <div className="pt-3 flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Sub-capabilities</p>
                      <Dialog open={addSubOpen === cap.id} onOpenChange={(open) => setAddSubOpen(open ? cap.id : null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 text-sm" data-testid={`button-add-sub-${cap.id}`}>
                            <Plus className="h-3 w-3 mr-1" />
                            Add Sub-capability
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>New Sub-capability</DialogTitle>
                            <DialogDescription>Add a sub-capability to {cap.name}</DialogDescription>
                          </DialogHeader>
                          <AddSubCapabilityForm
                            onSubmit={(name, description) => createSubMutation.mutate({
                              capabilityId: cap.id,
                              name,
                              description,
                              sortOrder: cap.subCapabilities.length,
                            })}
                            isPending={createSubMutation.isPending}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>

                    {cap.subCapabilities.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <p className="text-sm">No sub-capabilities defined</p>
                      </div>
                    ) : (
                      cap.subCapabilities.map((sub) => {
                        const isSubEditing = editSubId === sub.id;

                        return (
                          <div key={sub.id} className="rounded-md border border-border/30 overflow-hidden" data-testid={`card-sub-capability-${sub.id}`}>
                            <div className="px-3 py-2.5 flex items-center gap-3">
                              <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                {isSubEditing ? (
                                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                    <Input
                                      value={editSubName}
                                      onChange={(e) => setEditSubName(e.target.value)}
                                      className="h-7 text-sm"
                                      placeholder="Sub-capability name"
                                      data-testid="input-edit-sub-name"
                                    />
                                    <Textarea
                                      value={editSubDesc}
                                      onChange={(e) => setEditSubDesc(e.target.value)}
                                      className="text-sm min-h-[60px]"
                                      placeholder="Description"
                                      data-testid="input-edit-sub-desc"
                                    />
                                    <div className="flex gap-2">
                                      <Button size="sm" className="h-7 text-sm" onClick={() => {
                                        if (editSubName.trim()) {
                                          updateSubMutation.mutate({
                                            id: sub.id,
                                            capabilityId: cap.id,
                                            name: editSubName.trim(),
                                            description: editSubDesc.trim(),
                                          });
                                        }
                                      }} data-testid="button-save-sub">
                                        {updateSubMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 text-sm" onClick={() => setEditSubId(null)}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-sm font-medium" data-testid={`text-sub-name-${sub.id}`}>{sub.name}</p>
                                    {sub.description && (
                                      <p className="text-[11px] text-muted-foreground mt-0.5" data-testid={`text-sub-desc-${sub.id}`}>{sub.description}</p>
                                    )}
                                  </>
                                )}
                              </div>
                              {!isSubEditing && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                    setEditSubId(sub.id);
                                    setEditSubName(sub.name);
                                    setEditSubDesc(sub.description || "");
                                  }} data-testid={`button-edit-sub-${sub.id}`}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSubMutation.mutate({ id: sub.id, capabilityId: cap.id })}
                                    data-testid={`button-delete-sub-${sub.id}`}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <PaginationControls
        currentPage={capPagination.currentPage}
        totalPages={capPagination.totalPages}
        totalItems={capPagination.totalItems}
        startIndex={capPagination.startIndex}
        endIndex={capPagination.endIndex}
        onPageChange={capPagination.goToPage}
        noun="capabilities"
      />
    </div>
  );
}

function AddCapabilityForm({ onSubmit, isPending }: { onSubmit: (name: string) => void; isPending: boolean }) {
  const [name, setName] = useState("");
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm uppercase tracking-wider text-muted-foreground">Capability Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Operational Support Capability"
          data-testid="input-new-capability-name"
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSubmit(name.trim()); }}
        />
      </div>
      <Button className="w-full" disabled={!name.trim() || isPending} onClick={() => onSubmit(name.trim())} data-testid="button-submit-capability">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Create Capability
      </Button>
    </div>
  );
}

function AddSubCapabilityForm({ onSubmit, isPending }: { onSubmit: (name: string, description: string) => void; isPending: boolean }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm uppercase tracking-wider text-muted-foreground">Sub-capability Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Mission Support Services"
          data-testid="input-new-sub-name"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm uppercase tracking-wider text-muted-foreground">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this sub-capability..."
          className="min-h-[80px]"
          data-testid="input-new-sub-desc"
        />
      </div>
      <Button
        className="w-full"
        disabled={!name.trim() || isPending}
        onClick={() => onSubmit(name.trim(), description.trim())}
        data-testid="button-submit-sub-capability"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Create Sub-capability
      </Button>
    </div>
  );
}

function VerticalConfigPanel() {
  const { data: configs, isLoading } = useGetVerticalConfigsQuery();
  const { toast } = useToast();
  const [createVertConfigApi] = useCreateVerticalConfigMutation();

  const updateMutation = { mutate: async (config: { verticalKey: string; label: string; description: string | null; enabled: boolean; maxLevel: number }) => {
    try { await createVertConfigApi(config).unwrap(); toast({ title: "Configuration saved" }); } catch {}
  }, isPending: false };

  const configMap = new Map((configs || []).map(c => [c.verticalKey, c]));
  const vertPagination = usePagination(VERTICALS, 10);

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 mb-4">
        <p className="text-sm text-muted-foreground">{VERTICALS.length} readiness verticals configured</p>
      </div>
      {vertPagination.paginatedItems.map((v) => {
        const config = configMap.get(v.key);
        const isEnabled = config?.enabled ?? true;
        return (
          <Card key={v.key} data-testid={`config-vertical-${v.key}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted shrink-0">
                <span className="text-[10px] font-mono font-bold text-muted-foreground">{v.key}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{config?.label || v.name}</p>
                <p className="text-sm text-muted-foreground">{config?.description || v.description}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Level</p>
                  <p className="text-sm font-mono">{config?.maxLevel || 9}</p>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => {
                    updateMutation.mutate({
                      verticalKey: v.key,
                      label: config?.label || v.name,
                      description: config?.description || v.description,
                      enabled: checked,
                      maxLevel: config?.maxLevel || 9,
                    });
                  }}
                  data-testid={`switch-vertical-${v.key}`}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}

      <PaginationControls
        currentPage={vertPagination.currentPage}
        totalPages={vertPagination.totalPages}
        totalItems={vertPagination.totalItems}
        startIndex={vertPagination.startIndex}
        endIndex={vertPagination.endIndex}
        onPageChange={vertPagination.goToPage}
        noun="verticals"
      />
    </div>
  );
}

function ArtifactPanel() {
  const { data: allArtifacts, isLoading } = useGetArtifactsQuery();
  const [selectedVertical, setSelectedVertical] = useState<string>("BRL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArtifact, setEditingArtifact] = useState<Artifact | null>(null);
  const { toast } = useToast();

  const filtered = (allArtifacts || []).filter(a => a.vertical === selectedVertical);
  const artPagination = usePagination(filtered, 10);

  const [createArtApi] = useCreateArtifactMutation();
  const [updateArtApi] = useUpdateArtifactMutation();
  const [deleteArtApi] = useDeleteArtifactMutation();

  const createMutation = { mutate: async (data: any) => {
    try { await createArtApi(data).unwrap(); setDialogOpen(false); toast({ title: "Artifact created" }); } catch {}
  }, isPending: false };
  const updateMutation = { mutate: async ({ id, data }: { id: string; data: any }) => {
    try { await updateArtApi({ id, data }).unwrap(); setEditingArtifact(null); toast({ title: "Artifact updated" }); } catch {}
  }, isPending: false };
  const deleteMutation = { mutate: async (id: string) => {
    try { await deleteArtApi(id).unwrap(); toast({ title: "Artifact removed" }); } catch {}
  }, isPending: false };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Select value={selectedVertical} onValueChange={setSelectedVertical}>
            <SelectTrigger className="w-48" data-testid="select-artifact-vertical">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERTICALS.map(v => (
                <SelectItem key={v.key} value={v.key}>{v.key} - {v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} artifacts</span>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-artifact">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Artifact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Artifact</DialogTitle>
              <DialogDescription>Define a new verification artifact for {selectedVertical}</DialogDescription>
            </DialogHeader>
            <ArtifactForm
              vertical={selectedVertical}
              onSubmit={(data) => createMutation.mutate(data)}
              isPending={createMutation.isPending}
              submitLabel="Create Artifact"
            />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!editingArtifact} onOpenChange={(open) => { if (!open) setEditingArtifact(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Artifact</DialogTitle>
            <DialogDescription>Update the artifact details</DialogDescription>
          </DialogHeader>
          {editingArtifact && (
            <ArtifactForm
              vertical={editingArtifact.vertical}
              initialData={editingArtifact}
              onSubmit={(data) => updateMutation.mutate({ id: editingArtifact.id, data })}
              isPending={updateMutation.isPending}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No artifacts defined for {selectedVertical}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {artPagination.paginatedItems.map((artifact) => {
            const artPolicies = (artifact.policies as string[]) || [];
            const artLinks = (artifact.policyLinks as string[]) || [];
            return (
              <Card key={artifact.id} data-testid={`card-artifact-${artifact.id}`}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0 mt-0.5">
                    <span className="text-sm font-mono font-bold text-muted-foreground">L{artifact.level}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{artifact.name}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {VERIFICATION_LABELS[artifact.verificationMethod as VerificationMethod] || artifact.verificationMethod}
                      </Badge>
                    </div>
                    {artifact.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{artifact.description}</p>
                    )}
                    {artPolicies.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {artPolicies.map((policy, i) => (
                          <div key={i} className="flex items-center gap-2" data-testid={`policy-row-${artifact.id}-${i}`}>
                            <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                              {policy}
                            </Badge>
                            {artLinks[i] && (
                              <a href={artLinks[i]} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline truncate">
                                {artLinks[i]}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingArtifact(artifact)}
                      data-testid={`button-edit-artifact-${artifact.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(artifact.id)}
                      data-testid={`button-delete-artifact-${artifact.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <PaginationControls
            currentPage={artPagination.currentPage}
            totalPages={artPagination.totalPages}
            totalItems={artPagination.totalItems}
            startIndex={artPagination.startIndex}
            endIndex={artPagination.endIndex}
            onPageChange={artPagination.goToPage}
            noun="artifacts"
          />
        </div>
      )}
    </div>
  );
}

interface PolicyEntry {
  name: string;
  link: string;
}

function ArtifactForm({ vertical, initialData, onSubmit, isPending, submitLabel }: {
  vertical: string;
  initialData?: Artifact;
  onSubmit: (data: any) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [level, setLevel] = useState((initialData?.level || 1).toString());
  const [method, setMethod] = useState<string>(initialData?.verificationMethod || "manual_upload");

  const initPolicies = (): PolicyEntry[] => {
    const p = (initialData?.policies as string[]) || [];
    const l = (initialData?.policyLinks as string[]) || [];
    if (p.length === 0) return [{ name: "", link: "" }];
    return p.map((name, i) => ({ name, link: l[i] || "" }));
  };
  const [policyEntries, setPolicyEntries] = useState<PolicyEntry[]>(initPolicies);

  const addPolicyEntry = () => setPolicyEntries(prev => [...prev, { name: "", link: "" }]);
  const removePolicyEntry = (i: number) => setPolicyEntries(prev => prev.filter((_, idx) => idx !== i));
  const updatePolicyEntry = (i: number, field: keyof PolicyEntry, val: string) =>
    setPolicyEntries(prev => prev.map((entry, idx) => idx === i ? { ...entry, [field]: val } : entry));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-sm uppercase tracking-wider text-muted-foreground">Artifact Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., EIN Registration" className="h-10" data-testid="input-artifact-name" />
      </div>
      <div className="space-y-2">
        <Label className="text-sm uppercase tracking-wider text-muted-foreground">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Provide a detailed description of this artifact, its purpose, and any relevant context..."
          className="min-h-[120px] text-sm resize-y"
          data-testid="input-artifact-desc"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm uppercase tracking-wider text-muted-foreground">Level</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="h-10" data-testid="select-artifact-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1,2,3,4,5,6,7,8,9].map(l => <SelectItem key={l} value={l.toString()}>Level {l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm uppercase tracking-wider text-muted-foreground">Verification Method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="h-10" data-testid="select-artifact-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERIFICATION_METHODS.map(m => <SelectItem key={m} value={m}>{VERIFICATION_LABELS[m]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm uppercase tracking-wider text-muted-foreground">Policies, Authorities & Laws</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addPolicyEntry} className="h-7 text-sm" data-testid="button-add-policy">
            <Plus className="h-3 w-3 mr-1" /> Add Policy
          </Button>
        </div>
        <div className="space-y-3">
          {policyEntries.map((entry, i) => (
            <div key={i} className="rounded-md border border-border/50 p-3 space-y-2 bg-muted/20" data-testid={`policy-entry-${i}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Policy {i + 1}</span>
                {policyEntries.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removePolicyEntry(i)} className="h-6 w-6 p-0">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Input
                value={entry.name}
                onChange={(e) => updatePolicyEntry(i, "name", e.target.value)}
                placeholder="e.g., FAR 52.204-7, DFARS 252.204-7012, ITAR"
                className="h-9 text-sm"
                data-testid={`input-policy-name-${i}`}
              />
              <Input
                value={entry.link}
                onChange={(e) => updatePolicyEntry(i, "link", e.target.value)}
                placeholder="https://www.acquisition.gov/far/..."
                className="h-9 text-sm"
                data-testid={`input-policy-link-${i}`}
              />
            </div>
          ))}
        </div>
      </div>

      <Button
        className="w-full h-11 mt-2"
        disabled={!name.trim() || isPending}
        onClick={() => onSubmit({
          vertical,
          level: parseInt(level),
          name: name.trim(),
          description: description.trim() || null,
          policies: policyEntries.filter(e => e.name.trim()).map(e => e.name.trim()),
          policyLinks: policyEntries.filter(e => e.name.trim()).map(e => e.link.trim()),
          verificationMethod: method,
          required: true,
        })}
        data-testid="button-submit-artifact"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {submitLabel}
      </Button>
    </div>
  );
}

function CapabilityStatusBadge({ status }: { status: CapabilityStatus }) {
  const config: Record<CapabilityStatus, { className: string; icon: typeof Clock }> = {
    pending: { className: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Clock },
    approved: { className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
    published: { className: "bg-primary/10 text-primary border-primary/20", icon: Globe },
  };
  const { className, icon: Icon } = config[status] || config.published;
  return (
    <Badge className={`${className} text-[10px] gap-1`} data-testid={`badge-capability-status-${status}`}>
      <Icon className="h-2.5 w-2.5" />
      {CAPABILITY_STATUS_LABELS[status]}
    </Badge>
  );
}

