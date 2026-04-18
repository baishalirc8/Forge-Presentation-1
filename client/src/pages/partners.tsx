import { useGetPartnersQuery, useGetAdminPartnerCapabilitiesQuery } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Partner, PartnerCapability } from "@shared/schema";
import { Building2, ChevronRight, Search, Package } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/pagination-controls";

interface CapWithPartner extends PartnerCapability {
  partner?: { id: string; name: string; cage: string | null } | null;
}

export default function Partners() {
  const { data: partners, isLoading } = useGetPartnersQuery();

  const { data: allCaps } = useGetAdminPartnerCapabilitiesQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const [search, setSearch] = useState("");

  const capsByPartner = useMemo(() => {
    const map: Record<string, CapWithPartner[]> = {};
    (allCaps || []).forEach(c => {
      if (!map[c.partnerId]) map[c.partnerId] = [];
      map[c.partnerId].push(c);
    });
    return map;
  }, [allCaps]);

  const filtered = useMemo(() => {
    if (!partners) return [];
    if (!search.trim()) return partners;
    const q = search.toLowerCase();
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.uei.toLowerCase().includes(q) ||
        (p.cage && p.cage.toLowerCase().includes(q))
    );
  }, [partners, search]);

  const pagination = usePagination(filtered, 10);

  return (
    <div className="p-3 space-y-3 mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
            Partners
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {partners?.length || 0} organizations in portfolio
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, UEI, or CAGE code..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-partners"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">
              {search ? "No matching partners" : "No partners yet"}
            </p>
            <p className="text-sm mt-1 opacity-60">
              {search ? "Try a different search term" : "Use the Lookup tool to add your first partner"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pagination.paginatedItems.map((partner) => {
            const partnerCaps = capsByPartner[partner.id] || [];
            const totalCaps = partnerCaps.length;
            const verifiedCaps = partnerCaps.filter(c => c.status === "approved").length;
            const pendingCaps = partnerCaps.filter(c => ["submitted", "under_review", "partner_responded"].includes(c.status)).length;
            const feedbackCaps = partnerCaps.filter(c => c.status === "feedback_sent").length;

            return (
              <Link key={partner.id} href={`/partners/${partner.id}`}>
                <Card className="hover-elevate cursor-pointer" data-testid={`card-partner-${partner.id}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted shrink-0">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{partner.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-sm text-muted-foreground font-mono">UEI: {partner.uei}</span>
                        {partner.cage && (
                          <span className="text-sm text-muted-foreground font-mono">CAGE: {partner.cage}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex items-center gap-2 text-xs">
                        {totalCaps === 0 ? (
                          <span className="text-muted-foreground">No capabilities</span>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Package className="h-3 w-3" />
                              <span>{totalCaps} {totalCaps === 1 ? "cap" : "caps"}</span>
                            </div>
                            {verifiedCaps > 0 && (
                              <Badge className="text-[10px] border bg-green-500/20 text-green-400 border-green-500/30" variant="outline">
                                {verifiedCaps} verified
                              </Badge>
                            )}
                            {pendingCaps > 0 && (
                              <Badge className="text-[10px] border bg-blue-500/20 text-blue-400 border-blue-500/30" variant="outline">
                                {pendingCaps} pending
                              </Badge>
                            )}
                            {feedbackCaps > 0 && (
                              <Badge className="text-[10px] border bg-orange-500/20 text-orange-400 border-orange-500/30" variant="outline">
                                {feedbackCaps} feedback
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            onPageChange={pagination.goToPage}
            noun="partners"
          />
        </div>
      )}
    </div>
  );
}
