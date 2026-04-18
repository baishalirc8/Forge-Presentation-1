import { useState } from "react";
import { useGetEventsQuery } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, MapPin, Search, SlidersHorizontal, ArrowUpDown, CalendarRange, ArrowRight } from "lucide-react";
import type { Event } from "@shared/schema";

const SORT_OPTIONS = ["Soonest First", "Latest First", "A–Z"] as const;
type SortOption = typeof SORT_OPTIONS[number];

export default function Events() {
  const { data: events = [], isLoading } = useGetEventsQuery();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [filterLocation, setFilterLocation] = useState<string>("All");
  const [sortBy, setSortBy] = useState<SortOption>("Soonest First");

  const locations = ["All", ...Array.from(new Set(events.map((e: Event) => e.location).filter(Boolean) as string[]))];

  const filtered = events
    .filter((e: Event) => {
      const matchSearch =
        !search ||
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        (e.description?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (e.location?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchLocation = filterLocation === "All" || e.location === filterLocation;
      return matchSearch && matchLocation;
    })
    .sort((a: Event, b: Event) => {
      if (sortBy === "A–Z") return a.title.localeCompare(b.title);
      if (sortBy === "Latest First") return (b.startDate ?? "").localeCompare(a.startDate ?? "");
      return (a.startDate ?? "").localeCompare(b.startDate ?? "");
    });

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold" data-testid="text-page-title">Events</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Stay informed about upcoming defense and national security events. Connect with industry leaders, discover innovation opportunities, and expand your network at these influential gatherings.
        </p>
      </div>

      <Separator />

      <div className="px-6 py-4 space-y-4">
        {/* Search + Filter + Sort row */}
        <div className="flex gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-events"
            />
          </div>

          {/* Filter */}
          <div className="relative">
            <button
              className={`flex items-center justify-center gap-2 px-4 h-10 rounded-md border text-sm transition-colors min-w-28 ${showFilter ? "border-foreground/40 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"}`}
              onClick={() => { setShowFilter(f => !f); setShowSort(false); }}
              data-testid="button-filter-events"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
              {filterLocation !== "All" && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </button>
            {showFilter && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-popover border border-border rounded-md shadow-lg p-2 min-w-44">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">Location</p>
                {locations.map(loc => (
                  <button
                    key={loc}
                    className={`w-full text-left text-sm px-3 py-1.5 rounded-sm hover:bg-accent transition-colors ${filterLocation === loc ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    onClick={() => { setFilterLocation(loc); setShowFilter(false); }}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              className={`flex items-center justify-center gap-2 px-4 h-10 rounded-md border text-sm transition-colors min-w-28 ${showSort ? "border-foreground/40 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"}`}
              onClick={() => { setShowSort(s => !s); setShowFilter(false); }}
              data-testid="button-sort-events"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort
            </button>
            {showSort && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-popover border border-border rounded-md shadow-lg p-2 min-w-40">
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

        {/* Count */}
        {!isLoading && (
          <p className="text-sm text-muted-foreground">
            Showing {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CalendarRange className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">No events found</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {search ? "Try adjusting your search" : "Events will appear here once added by your administrator"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((event: Event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event: e }: { event: Event }) {
  const dateRange = [e.startDate, e.endDate].filter(Boolean).join(" – ");

  return (
    <div
      className="border border-border/50 rounded-xl bg-card overflow-hidden flex flex-col"
      data-testid={`card-event-${e.id}`}
    >
      {/* Cover image */}
      {e.imageUrl ? (
        <div className="h-52 overflow-hidden bg-muted shrink-0">
          <img
            src={e.imageUrl}
            alt={e.title}
            className="w-full h-full object-cover"
            onError={(ev) => { (ev.target as HTMLImageElement).parentElement!.classList.add("hidden"); }}
          />
        </div>
      ) : (
        <div className="h-52 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shrink-0">
          <CalendarDays className="h-12 w-12 text-muted-foreground/20" />
        </div>
      )}

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-bold text-base leading-snug">{e.title}</h3>
        {e.description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{e.description}</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <Separator className="mb-3" />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            {dateRange && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span>{dateRange}</span>
              </div>
            )}
            {e.location && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{e.location}</span>
              </div>
            )}
          </div>
          {e.link && (
            <a
              href={e.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline shrink-0"
              data-testid={`link-event-learnmore-${e.id}`}
            >
              Learn More
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
