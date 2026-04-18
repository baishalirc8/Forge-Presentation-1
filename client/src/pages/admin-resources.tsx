import { useState, useRef } from "react";
import { useGetResourcesQuery, useCreateResourceMutation, useDeleteResourceMutation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, FileText, Upload, ExternalLink, BookOpen, Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import type { Resource } from "@shared/schema";
import { RESOURCE_CATEGORIES } from "@shared/schema";

const ALL_TAB = "All Resources";
const SORT_OPTIONS = ["Newest First", "Oldest First", "A–Z", "Z–A"] as const;
type SortOption = typeof SORT_OPTIONS[number];

export default function AdminResources() {
  const { data: resources = [], isLoading } = useGetResourcesQuery();
  const [createResource, { isLoading: isCreating }] = useCreateResourceMutation();
  const [deleteResource] = useDeleteResourceMutation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_TAB);
  const [sortBy, setSortBy] = useState<SortOption>("Newest First");
  const [showSort, setShowSort] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Reference Materials",
    fileType: "PDF",
    externalUrl: "",
    file: null as File | null,
  });

  const categoryColor: Record<string, string> = {
    "Compliance & Standards": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "Getting Government-Ready": "bg-green-500/10 text-green-400 border-green-500/20",
    "Best Practices": "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "Reference Materials": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  const categories = [ALL_TAB, ...RESOURCE_CATEGORIES];

  function resetForm() {
    setForm({ title: "", description: "", category: "Reference Materials", fileType: "PDF", externalUrl: "", file: null });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const fd = new FormData();
    fd.append("title", form.title.trim());
    if (form.description) fd.append("description", form.description);
    fd.append("category", form.category);
    fd.append("fileType", form.fileType);
    if (form.externalUrl) fd.append("externalUrl", form.externalUrl);
    if (form.file) fd.append("file", form.file);
    try {
      await createResource(fd).unwrap();
      toast({ title: "Resource uploaded" });
      setOpen(false);
      resetForm();
    } catch {
      toast({ title: "Failed to upload resource", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteResource(id).unwrap();
      toast({ title: "Resource deleted" });
    } catch {
      toast({ title: "Failed to delete resource", variant: "destructive" });
    } finally {
      setConfirmDeleteId(null);
    }
  }

  const filtered = resources
    .filter((r: Resource) => {
      const matchSearch =
        !search ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        (r.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchCat = activeCategory === ALL_TAB || r.category === activeCategory;
      return matchSearch && matchCat;
    })
    .sort((a: Resource, b: Resource) => {
      if (sortBy === "A–Z") return a.title.localeCompare(b.title);
      if (sortBy === "Z–A") return b.title.localeCompare(a.title);
      if (sortBy === "Oldest First") return new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime();
      return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
    });

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">Resources</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              A curated library of trusted materials to help your organization navigate government and defense requirements, standards, and best practices.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="shrink-0" data-testid="button-upload-resource">
            <Plus className="h-4 w-4 mr-1.5" />
            Upload Resource
          </Button>
        </div>
      </div>

      <Separator />

      <div className="px-6 py-4 space-y-4">
        {/* Search + Filter + Sort */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-resources"
            />
          </div>

          {/* Filter */}
          <div className="relative">
            <Button
              variant="outline"
              className="gap-2 min-w-24"
              onClick={() => { setShowFilter(f => !f); setShowSort(false); }}
              data-testid="button-filter-resources"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
              {activeCategory !== ALL_TAB && <span className="h-1.5 w-1.5 rounded-full bg-primary ml-0.5" />}
            </Button>
            {showFilter && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-popover border border-border rounded-md shadow-md p-2 min-w-44">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">Category</p>
                {categories.map(cat => (
                  <button
                    key={cat}
                    className={`w-full text-left text-sm px-3 py-1.5 rounded-sm hover:bg-accent transition-colors ${activeCategory === cat ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    onClick={() => { setActiveCategory(cat); setShowFilter(false); }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <Button
              variant="outline"
              className="gap-2 min-w-24"
              onClick={() => { setShowSort(s => !s); setShowFilter(false); }}
              data-testid="button-sort-resources"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort
            </Button>
            {showSort && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-popover border border-border rounded-md shadow-md p-2 min-w-36">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    className={`w-full text-left text-sm px-3 py-1.5 rounded-sm hover:bg-accent transition-colors ${sortBy === opt ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    onClick={() => { setSortBy(opt); setShowSort(false); }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-foreground text-background"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
              }`}
              data-testid={`button-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results count */}
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} resource{filtered.length !== 1 ? "s" : ""}
            {activeCategory !== ALL_TAB && ` in "${activeCategory}"`}
          </p>
        )}

        {/* Cards grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">
              {resources.length === 0 ? "No resources yet" : "No results found"}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {resources.length === 0
                ? "Upload your first resource to make it available to partners"
                : "Try adjusting your search or category filter"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r: Resource) => (
              <div key={r.id} className="border border-border/40 rounded-lg bg-card flex flex-col overflow-hidden" data-testid={`card-resource-admin-${r.id}`}>
                <div className="p-4 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-primary/10 text-primary border-primary/20">{r.fileType || "PDF"}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDeleteId(r.id)}
                        data-testid={`button-delete-resource-${r.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="text-sm font-medium leading-snug line-clamp-2">{r.title}</h3>
                  {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                  {(r.filePath || r.externalUrl) && (
                    <a
                      href={r.filePath ?? r.externalUrl ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View file
                    </a>
                  )}
                </div>
                <div className="px-4 py-2.5 border-t border-border/30">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${categoryColor[r.category] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {r.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Resource</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="res-title">Title <span className="text-destructive">*</span></Label>
              <Input id="res-title" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. DoD Cybersecurity Policy 2026" data-testid="input-resource-title" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-description">Description</Label>
              <Textarea id="res-description" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief summary of this resource..." rows={3} data-testid="input-resource-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger data-testid="select-resource-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCE_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>File Type</Label>
                <Select value={form.fileType} onValueChange={(v) => setForm(f => ({ ...f, fileType: v }))}>
                  <SelectTrigger data-testid="select-resource-filetype">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["PDF", "DOC", "XLSX", "PPT", "Link"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Upload File</Label>
              <div
                className="border border-dashed border-border rounded-md p-4 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{form.file ? form.file.name : "Click to select a file"}</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xlsx,.ppt,.pptx"
                onChange={(e) => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
                data-testid="input-resource-file"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-url">Or External URL</Label>
              <Input id="res-url" value={form.externalUrl} onChange={(e) => setForm(f => ({ ...f, externalUrl: e.target.value }))} placeholder="https://..." data-testid="input-resource-url" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isCreating} data-testid="button-submit-resource">
              {isCreating ? "Uploading..." : "Upload Resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(v) => { if (!v) setConfirmDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Resource</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this resource? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)} data-testid="button-confirm-delete-resource">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
