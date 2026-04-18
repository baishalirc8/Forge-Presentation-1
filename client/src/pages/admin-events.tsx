import { useState, useRef, useCallback } from "react";
import { useGetEventsQuery, useCreateEventMutation, useDeleteEventMutation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, CalendarDays, MapPin, ExternalLink, CalendarRange,
  X, ImageIcon, Search, Loader2, Map, LayoutGrid, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Clock, Link2
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Event } from "@shared/schema";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: { city?: string; state?: string; country?: string; town?: string; county?: string };
}

function parseEventDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function buildCalendarGrid(month: Date): Date[][] {
  const year = month.getFullYear();
  const mon = month.getMonth();
  const first = new Date(year, mon, 1);
  const startDow = first.getDay();
  const grid: Date[][] = [];
  let week: Date[] = [];

  for (let i = 0; i < startDow; i++) {
    const prev = new Date(first);
    prev.setDate(prev.getDate() - (startDow - i));
    week.push(prev);
  }
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(new Date(year, mon, d));
    if (week.length === 7) { grid.push(week); week = []; }
  }
  if (week.length > 0) {
    let next = 1;
    while (week.length < 7) week.push(new Date(year, mon + 1, next++));
    grid.push(week);
  }
  while (grid.length < 6) {
    const lastDay = grid[grid.length - 1][6];
    const extra: Date[] = [];
    for (let i = 1; i <= 7; i++) {
      const d2 = new Date(lastDay);
      d2.setDate(d2.getDate() + i);
      extra.push(d2);
    }
    grid.push(extra);
  }
  return grid;
}

const EVENT_COLORS = [
  "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-red-500",
];
function getEventColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xff;
  return EVENT_COLORS[hash % EVENT_COLORS.length];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ─────────────────────────────────────────────────────────────────────────── */

export default function AdminEvents() {
  const { data: events = [], isLoading } = useGetEventsQuery();
  const [createEvent, { isLoading: isCreating }] = useCreateEventMutation();
  const [deleteEvent] = useDeleteEventMutation();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "calendar">("grid");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);

  // Form state
  const emptyForm = { title: "", description: "", imageUrl: "", location: "", link: "" };
  const [form, setForm] = useState(emptyForm);
  const [startDateObj, setStartDateObj] = useState<Date | undefined>(undefined);
  const [endDateObj, setEndDateObj] = useState<Date | undefined>(undefined);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState<NominatimResult[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<NominatimResult | null>(null);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const today = new Date();
  const grid = buildCalendarGrid(currentMonth);

  function openFormForDay(day: Date) {
    resetForm();
    setStartDateObj(day);
    setOpen(true);
  }

  function getEventsForDay(day: Date): Event[] {
    return (events as Event[]).filter(ev => {
      const start = parseEventDate(ev.startDate);
      const end = parseEventDate(ev.endDate);
      if (!start) return false;
      if (isSameDay(start, day)) return true;
      if (end && day > start && day <= end) return true;
      return false;
    });
  }

  function prevMonth() { setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  function nextMonth() { setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }
  function goToday() { setCurrentMonth(new Date()); }

  function handleImageFile(file: File) {
    setImageFile(file);
    setForm(f => ({ ...f, imageUrl: "" }));
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }
  function clearImage() {
    setImageFile(null); setImagePreview(null);
    setForm(f => ({ ...f, imageUrl: "" }));
    if (imageFileRef.current) imageFileRef.current.value = "";
  }

  const searchLocation = useCallback((query: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) { setLocationResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setLocationSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        setLocationResults(await res.json());
      } catch { setLocationResults([]); }
      finally { setLocationSearching(false); }
    }, 400);
  }, []);

  function selectLocation(result: NominatimResult) {
    const addr = result.address;
    const text = addr
      ? [addr.city || addr.town || addr.county, addr.state, addr.country].filter(Boolean).join(", ")
      : result.display_name.split(",").slice(0, 2).join(",").trim();
    setForm(f => ({ ...f, location: text }));
    setSelectedLocation(result);
    setLocationResults([]); setLocationSearch(""); setShowLocationMap(true);
  }

  function resetForm() {
    setForm(emptyForm);
    setStartDateObj(undefined); setEndDateObj(undefined);
    setImageFile(null); setImagePreview(null);
    setLocationSearch(""); setLocationResults([]);
    setSelectedLocation(null); setShowLocationMap(false);
    if (imageFileRef.current) imageFileRef.current.value = "";
  }

  async function handleSubmit() {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    const fd = new FormData();
    fd.append("title", form.title.trim());
    if (form.description) fd.append("description", form.description);
    if (imageFile) fd.append("image", imageFile);
    else if (form.imageUrl) fd.append("imageUrl", form.imageUrl);
    if (startDateObj) fd.append("startDate", formatDate(startDateObj));
    if (endDateObj) fd.append("endDate", formatDate(endDateObj));
    if (form.location) fd.append("location", form.location);
    if (form.link) fd.append("link", form.link);
    try {
      await createEvent(fd).unwrap();
      toast({ title: "Event added" });
      setOpen(false); resetForm();
    } catch { toast({ title: "Failed to add event", variant: "destructive" }); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteEvent(id).unwrap();
      toast({ title: "Event deleted" });
    } catch { toast({ title: "Failed to delete event", variant: "destructive" }); }
    finally { setConfirmDeleteId(null); setSelectedEvent(null); }
  }

  const mapSrc = selectedLocation
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${+selectedLocation.lon - 0.08},${+selectedLocation.lat - 0.05},${+selectedLocation.lon + 0.08},${+selectedLocation.lat + 0.05}&layer=mapnik&marker=${selectedLocation.lat},${selectedLocation.lon}`
    : null;
  const currentPreview = imagePreview || (form.imageUrl || null);
  const monthLabel = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  /* ── JSX ── */
  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold">Events</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage upcoming events visible to all partners</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button onClick={() => setView("grid")} className={`flex items-center gap-1.5 px-3 h-9 text-sm transition-colors ${view === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/50"}`} data-testid="button-view-grid">
              <LayoutGrid className="h-3.5 w-3.5" />Grid
            </button>
            <button onClick={() => setView("calendar")} className={`flex items-center gap-1.5 px-3 h-9 text-sm transition-colors border-l border-border ${view === "calendar" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/50"}`} data-testid="button-view-calendar">
              <CalendarIcon className="h-3.5 w-3.5" />Calendar
            </button>
          </div>
          <Button onClick={() => { resetForm(); setOpen(true); }} data-testid="button-add-event">
            <Plus className="h-4 w-4 mr-1.5" />Add Event
          </Button>
        </div>
      </div>

      <Separator className="shrink-0" />

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : view === "grid" ? (
        <div className="flex-1 overflow-auto p-6">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl">
              <CalendarRange className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">No events yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Add your first event to share it with partners</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {(events as Event[]).map(ev => <EventCard key={ev.id} event={ev} onDelete={() => setConfirmDeleteId(ev.id)} />)}
            </div>
          )}
        </div>
      ) : (
        /* ── Google-Calendar-style month grid ── */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-6 py-3 shrink-0">
            <Button variant="outline" size="sm" onClick={goToday} className="text-xs h-8" data-testid="button-today">Today</Button>
            <div className="flex items-center">
              <button onClick={prevMonth} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors" data-testid="button-prev-month">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={nextMonth} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors" data-testid="button-next-month">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <h2 className="text-base font-semibold" data-testid="text-current-month">{monthLabel}</h2>
          </div>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-border shrink-0 mx-6">
            {DAY_LABELS.map(d => (
              <div key={d} className="py-1.5 text-center text-xs font-medium text-muted-foreground tracking-wide uppercase">{d}</div>
            ))}
          </div>

          {/* Month grid */}
          <div className="flex-1 overflow-auto mx-6 mb-4">
            <div className="grid grid-rows-6 h-full" style={{ minHeight: "480px" }}>
              {grid.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
                  {week.map((day, di) => {
                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                    const isToday = isSameDay(day, today);
                    const dayEvents = getEventsForDay(day);
                    const MAX_VISIBLE = 3;
                    const visible = dayEvents.slice(0, MAX_VISIBLE);
                    const overflow = dayEvents.length - MAX_VISIBLE;

                    return (
                      <div
                        key={di}
                        onClick={() => openFormForDay(day)}
                        className={cn(
                          "border-r border-border last:border-r-0 p-1 min-h-[80px] flex flex-col cursor-pointer group",
                          isCurrentMonth ? "bg-background hover:bg-muted/30" : "bg-muted/20 hover:bg-muted/40",
                          "transition-colors"
                        )}
                        data-testid={`cell-day-${day.toISOString().slice(0, 10)}`}
                      >
                        {/* Date number */}
                        <div className="flex justify-center mb-1">
                          <span className={cn(
                            "h-7 w-7 flex items-center justify-center text-xs font-medium rounded-full leading-none select-none",
                            isToday && "bg-blue-600 text-white font-bold",
                            !isToday && isCurrentMonth && "text-foreground group-hover:bg-muted",
                            !isCurrentMonth && "text-muted-foreground/40",
                          )}>
                            {day.getDate()}
                          </span>
                        </div>

                        {/* Event chips */}
                        <div className="flex flex-col gap-0.5 flex-1">
                          {visible.map(ev => (
                            <button
                              key={ev.id}
                              onClick={e => { e.stopPropagation(); setSelectedEvent(ev); }}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-white text-[11px] font-medium truncate leading-5 hover:opacity-85 transition-opacity ${getEventColor(ev.id)}`}
                              data-testid={`event-chip-${ev.id}`}
                              title={ev.title}
                            >
                              {ev.title}
                            </button>
                          ))}
                          {overflow > 0 && (
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedEvent(dayEvents[MAX_VISIBLE]); }}
                              className="text-left px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                            >
                              +{overflow} more
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Event Detail Popover ── */}
      <Dialog open={!!selectedEvent} onOpenChange={(v) => { if (!v) setSelectedEvent(null); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogDescription className="sr-only">Event details</DialogDescription>
          {selectedEvent && (
            <>
              {selectedEvent.imageUrl && (
                <div className="h-36 overflow-hidden">
                  <img src={selectedEvent.imageUrl} alt={selectedEvent.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <span className={`h-3 w-3 rounded-sm shrink-0 mt-1 ${getEventColor(selectedEvent.id)}`} />
                  <h3 className="font-semibold text-base leading-tight">{selectedEvent.title}</h3>
                </div>
                {selectedEvent.description && <p className="text-sm text-muted-foreground leading-relaxed">{selectedEvent.description}</p>}
                <div className="space-y-2 text-sm">
                  {(selectedEvent.startDate || selectedEvent.endDate) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>{[selectedEvent.startDate, selectedEvent.endDate].filter(Boolean).join(" – ")}</span>
                    </div>
                  )}
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" /><span>{selectedEvent.location}</span>
                    </div>
                  )}
                  {selectedEvent.link && (
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <a href={selectedEvent.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">{selectedEvent.link}</a>
                    </div>
                  )}
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                    onClick={() => { setConfirmDeleteId(selectedEvent.id); setSelectedEvent(null); }}>
                    <Trash2 className="h-3.5 w-3.5" />Delete event
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEvent(null)}>Close</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Event Dialog ── */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
            <DialogDescription>Fill in the details below to create a new event for partners.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input value={form.title} onChange={set("title")} placeholder="e.g. SOF Week 2026" data-testid="input-event-title" />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={set("description")} placeholder="Brief description of the event..." rows={3} data-testid="input-event-description" />
            </div>

            {/* Cover Image */}
            <div className="space-y-2">
              <Label>Cover Image</Label>
              {currentPreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border h-40">
                  <img src={currentPreview} alt="Preview" className="w-full h-full object-cover" onError={() => setImagePreview(null)} />
                  <button onClick={clearImage} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-background/80 text-xs px-2 py-1 rounded border border-border">
                    {imageFile ? imageFile.name : "URL preview"}
                  </div>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
                  onClick={() => imageFileRef.current?.click()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleImageFile(f); }}
                  onDragOver={(e) => e.preventDefault()}
                  data-testid="dropzone-event-image"
                >
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Drop an image here or <span className="text-primary">click to upload</span></p>
                  <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, GIF, WebP supported</p>
                </div>
              )}
              <input ref={imageFileRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} data-testid="input-event-image-file" />
              {!currentPreview && (
                <>
                  <div className="flex items-center gap-2"><Separator className="flex-1" /><span className="text-xs text-muted-foreground">or paste URL</span><Separator className="flex-1" /></div>
                  <Input value={form.imageUrl} onChange={(e) => { setForm(f => ({ ...f, imageUrl: e.target.value })); setImageFile(null); setImagePreview(null); }} placeholder="https://example.com/event-image.jpg" data-testid="input-event-image-url" />
                </>
              )}
            </div>

            {/* Dates — date picker popovers */}
            <div className="grid grid-cols-2 gap-3">
              {/* Start Date */}
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Popover open={startPickerOpen} onOpenChange={setStartPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      data-testid="button-pick-startdate"
                      className={cn(
                        "w-full flex items-center gap-2 px-3 h-10 rounded-md border border-input bg-background text-sm text-left transition-colors hover:bg-accent hover:text-accent-foreground",
                        !startDateObj && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="h-4 w-4 shrink-0 opacity-60" />
                      <span className="flex-1 truncate">
                        {startDateObj ? formatDate(startDateObj) : "Pick a date"}
                      </span>
                      {startDateObj && (
                        <span onClick={(e) => { e.stopPropagation(); setStartDateObj(undefined); }} className="hover:text-foreground opacity-50 hover:opacity-100">
                          <X className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDateObj}
                      onSelect={(d) => { setStartDateObj(d); setStartPickerOpen(false); }}
                      defaultMonth={startDateObj ?? new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Popover open={endPickerOpen} onOpenChange={setEndPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      data-testid="button-pick-enddate"
                      className={cn(
                        "w-full flex items-center gap-2 px-3 h-10 rounded-md border border-input bg-background text-sm text-left transition-colors hover:bg-accent hover:text-accent-foreground",
                        !endDateObj && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="h-4 w-4 shrink-0 opacity-60" />
                      <span className="flex-1 truncate">
                        {endDateObj ? formatDate(endDateObj) : "Pick a date"}
                      </span>
                      {endDateObj && (
                        <span onClick={(e) => { e.stopPropagation(); setEndDateObj(undefined); }} className="hover:text-foreground opacity-50 hover:opacity-100">
                          <X className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDateObj}
                      onSelect={(d) => { setEndDateObj(d); setEndPickerOpen(false); }}
                      defaultMonth={endDateObj ?? startDateObj ?? new Date()}
                      disabled={startDateObj ? { before: startDateObj } : undefined}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Location picker */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Location</Label>
              {form.location && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border/50">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-sm flex-1">{form.location}</span>
                  <button onClick={() => { setForm(f => ({ ...f, location: "" })); setSelectedLocation(null); setShowLocationMap(false); }}>
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              )}
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={locationSearch} onChange={(e) => { setLocationSearch(e.target.value); searchLocation(e.target.value); }} placeholder="Search for a city or venue..." className="pl-9" data-testid="input-location-search" />
                    {locationSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  {selectedLocation && (
                    <Button variant="outline" size="icon" onClick={() => setShowLocationMap(m => !m)} title="Toggle map"><Map className="h-4 w-4" /></Button>
                  )}
                </div>
                {locationResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
                    {locationResults.map(r => {
                      const addr = r.address;
                      const label = addr
                        ? [addr.city || addr.town || addr.county, addr.state, addr.country].filter(Boolean).join(", ")
                        : r.display_name.split(",").slice(0, 3).join(",").trim();
                      return (
                        <button key={r.place_id} className="w-full text-left px-3 py-2.5 hover:bg-accent text-sm flex items-start gap-2 border-b border-border/30 last:border-0 transition-colors" onClick={() => selectLocation(r)}>
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {showLocationMap && mapSrc && (
                <div className="rounded-lg overflow-hidden border border-border h-48">
                  <iframe src={mapSrc} className="w-full h-full" title="Location map" loading="lazy" sandbox="allow-scripts allow-same-origin" />
                </div>
              )}
              {!selectedLocation && (
                <Input value={form.location} onChange={set("location")} placeholder="Or type manually: Tampa, FL" data-testid="input-event-location-manual" />
              )}
            </div>

            {/* Link */}
            <div className="space-y-1.5">
              <Label>Event Link</Label>
              <Input value={form.link} onChange={set("link")} placeholder="https://..." data-testid="input-event-link" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isCreating} data-testid="button-submit-event">
              {isCreating ? "Saving..." : "Add Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(v) => { if (!v) setConfirmDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this event?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)} data-testid="button-confirm-delete-event">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Event Card (Grid view) ───────────────────────────────────────────────── */
function EventCard({ event: ev, onDelete }: { event: Event; onDelete: () => void }) {
  const dateStr = [ev.startDate, ev.endDate].filter(Boolean).join(" – ") || null;
  return (
    <div className="border border-border/40 rounded-xl bg-card overflow-hidden flex flex-col" data-testid={`card-event-admin-${ev.id}`}>
      {ev.imageUrl ? (
        <div className="h-44 overflow-hidden bg-muted shrink-0">
          <img src={ev.imageUrl} alt={ev.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      ) : (
        <div className="h-44 bg-gradient-to-br from-primary/10 to-muted flex items-center justify-center shrink-0">
          <CalendarDays className="h-10 w-10 text-primary/30" />
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-sm shrink-0 mt-0.5 ${getEventColor(ev.id)}`} />
            <h3 className="font-semibold text-sm leading-snug">{ev.title}</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={onDelete} data-testid={`button-delete-event-${ev.id}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {ev.description && <p className="text-xs text-muted-foreground line-clamp-2">{ev.description}</p>}
        <div className="mt-auto space-y-1 pt-1">
          {dateStr && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5 shrink-0" /><span>{dateStr}</span></div>}
          {ev.location && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /><span>{ev.location}</span></div>}
          {ev.link && <a href={ev.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3 w-3" />Event Link</a>}
        </div>
      </div>
    </div>
  );
}
