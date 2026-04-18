import { useState } from "react";
import { useGetResourcesQuery } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Search, BookOpen } from "lucide-react";
import type { Resource } from "@shared/schema";
import { RESOURCE_CATEGORIES } from "@shared/schema";

const ALL_TAB = "All Resources";

export default function Resources() {
  const { data: resources = [], isLoading } = useGetResourcesQuery();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_TAB);

  const categories = [ALL_TAB, ...RESOURCE_CATEGORIES];

  const filtered = resources.filter((r: Resource) => {
    const matchSearch =
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchCat = activeCategory === ALL_TAB || r.category === activeCategory;
    return matchSearch && matchCat;
  });

  const categoryColor: Record<string, string> = {
    "Compliance & Standards": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "Getting Government-Ready": "bg-green-500/10 text-green-400 border-green-500/20",
    "Best Practices": "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "Reference Materials": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Resources</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A curated library of trusted materials to help your organization navigate government and defense requirements, standards, and best practices.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-resources"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(cat)}
            className="text-xs h-8"
            data-testid={`button-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {cat}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">No resources found</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {search ? "Try adjusting your search" : "Resources will appear here once uploaded by your administrator"}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{filtered.length} resource{filtered.length !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r: Resource) => (
              <ResourceCard key={r.id} resource={r} categoryColor={categoryColor} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ResourceCard({ resource: r, categoryColor }: { resource: Resource; categoryColor: Record<string, string> }) {
  const href = r.filePath ? r.filePath : r.externalUrl;
  const content = (
    <div
      className="group border border-border/40 rounded-lg bg-card hover:border-border transition-colors overflow-hidden flex flex-col h-full cursor-pointer"
      data-testid={`card-resource-${r.id}`}
    >
      <div className="p-4 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted shrink-0">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-primary/10 text-primary border-primary/20">
            {r.fileType || "PDF"}
          </span>
        </div>
        <div>
          <h3 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">{r.title}</h3>
          {r.description && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{r.description}</p>
          )}
        </div>
      </div>
      <div className="px-4 py-3 border-t border-border/30 flex items-center justify-between">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${categoryColor[r.category] ?? "bg-muted text-muted-foreground border-border"}`}>
          {r.category}
        </span>
        {href && <ExternalLink className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />}
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
        {content}
      </a>
    );
  }
  return <div className="h-full">{content}</div>;
}
