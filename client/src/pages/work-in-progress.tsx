import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Construction, ArrowLeft, Hammer, HardHat } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/finance": "Finance",
  "/ecosystem": "Ecosystem",
  "/opportunities": "Opportunities",
  "/resources": "Resources",
  "/events": "Events",
  "/inbox": "Inbox",
};

export default function WorkInProgress() {
  const [location, navigate] = useLocation();
  const pageTitle = PAGE_TITLES[location] || "This Section";

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3rem)] px-6" data-testid="page-work-in-progress">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
          <div className="absolute inset-3 rounded-full bg-primary/5 border border-primary/20" />
          <Construction className="h-14 w-14 text-primary relative z-10" />
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-wip-title">
            {pageTitle}
          </h1>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <HardHat className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Under Construction
            </span>
          </div>
        </div>

        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
          We're actively building this section to bring you powerful new features. 
          Check back soon — great things are on the way.
        </p>

        <div className="flex items-center justify-center gap-6 text-muted-foreground/40">
          <Hammer className="h-5 w-5 animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="h-px w-12 bg-border" />
          <Construction className="h-5 w-5 animate-bounce" style={{ animationDelay: "200ms" }} />
          <div className="h-px w-12 bg-border" />
          <HardHat className="h-5 w-5 animate-bounce" style={{ animationDelay: "400ms" }} />
        </div>

        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          onClick={() => navigate("/")}
          data-testid="button-back-home"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>
      </div>
    </div>
  );
}
