import { useGetActivitiesQuery } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Clock, FileText, MessageSquare, CheckCircle2, XCircle,
  Package, Send, Search, Shield
} from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/pagination-controls";
import { useState, useMemo } from "react";

interface ActivityEvent {
  id: string;
  partnerId: string;
  type: string;
  description: string;
  vertical: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
  partnerName: string;
}

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

const TYPE_CONFIG: Record<string, { icon: typeof Package; color: string; label: string }> = {
  capability_submitted: { icon: Send, color: "bg-blue-500/10 text-blue-400", label: "Submitted" },
  capability_verified: { icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-400", label: "Verified" },
  capability_rejected: { icon: XCircle, color: "bg-red-500/10 text-red-400", label: "Not Verified" },
  admin_feedback: { icon: MessageSquare, color: "bg-orange-500/10 text-orange-400", label: "Admin Feedback" },
  partner_response: { icon: MessageSquare, color: "bg-purple-500/10 text-purple-400", label: "Partner Response" },
};

export default function ActivityLog() {
  const { data: activities, isLoading } = useGetActivitiesQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!activities) return [];
    if (!search.trim()) return activities;
    const q = search.toLowerCase();
    return activities.filter(a =>
      a.description.toLowerCase().includes(q) ||
      a.partnerName.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) ||
      (a.vertical && (a.vertical.toLowerCase().includes(q) || VERTICAL_SHORT[a.vertical]?.toLowerCase().includes(q))) ||
      (a.metadata?.capabilityName && String(a.metadata.capabilityName).toLowerCase().includes(q)) ||
      (a.metadata?.displayName && String(a.metadata.displayName).toLowerCase().includes(q))
    );
  }, [activities, search]);

  const pagination = usePagination(filtered, 15);

  return (
    <div className="p-3 space-y-3 mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Activity Log
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Capability assessment history and audit trail
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by partner, capability, vertical, or message..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-activities"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Clock className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">{search ? "No matching activity" : "No activity yet"}</p>
            <p className="text-sm mt-1 opacity-60">
              {search ? "Try a different search term" : "Assessment activity will appear here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pagination.paginatedItems.map((activity) => {
            const config = TYPE_CONFIG[activity.type] || { icon: Package, color: "bg-muted text-muted-foreground", label: activity.type };
            const IconComponent = config.icon;
            const capName = activity.metadata?.capabilityName as string | undefined;
            const displayName = activity.metadata?.displayName as string | undefined;

            return (
              <Card key={activity.id} className="border-border/30" data-testid={`activity-card-${activity.id}`}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-md shrink-0 mt-0.5 ${config.color}`}>
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm">{activity.description}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground font-medium">{activity.partnerName}</span>
                      {capName && (
                        <span className="text-xs text-muted-foreground">
                          {capName}
                        </span>
                      )}
                      {activity.vertical && (
                        <Badge variant="outline" className="text-[9px] border-border/40">
                          {VERTICAL_SHORT[activity.vertical] || activity.vertical}
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-[9px] border-border/40 ${config.color}`}>
                        {config.label}
                      </Badge>
                      {displayName && (
                        <span className="text-[10px] text-muted-foreground italic">
                          by {displayName}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      {activity.createdAt
                        ? new Date(activity.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            onPageChange={pagination.goToPage}
            noun="events"
          />
        </div>
      )}
    </div>
  );
}
