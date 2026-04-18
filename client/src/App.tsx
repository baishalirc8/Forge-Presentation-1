import { Switch, Route, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIChatPanel, ChatFab } from "@/components/ai-chat-panel";
import Dashboard from "@/pages/dashboard";
import Partners from "@/pages/partners";
import PartnerDetail from "@/pages/partner-detail";
import ReportCard from "@/pages/report-card";
import Lookup from "@/pages/lookup";
import ActivityLog from "@/pages/activity-log";
import Admin from "@/pages/admin";
import Login from "@/pages/login";
import PartnerOnboarding from "@/pages/partner-onboarding";
import AssessmentDetail from "@/pages/assessment-detail";
import Assessments from "@/pages/assessments";
import NotFound from "@/pages/not-found";
import PartnerWizard from "@/pages/partner-wizard";
import PartnerHome from "@/pages/partner-home";
import PartnerCapabilities from "@/pages/partner-capabilities";
import PartnerCapabilityWizard from "@/pages/partner-capability-wizard";
import PartnerAssessment from "@/pages/partner-assessment";
import PartnerCapabilityView from "@/pages/partner-capability-view";
import WorkInProgress from "@/pages/work-in-progress";
import Resources from "@/pages/resources";
import Events from "@/pages/events";
import AdminResources from "@/pages/admin-resources";
import AdminEvents from "@/pages/admin-events";

function AdminRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/partners" component={Partners} />
      <Route path="/partners/:id/assessments/:assessmentId" component={AssessmentDetail} />
      <Route path="/partners/:id" component={PartnerDetail} />
      <Route path="/partners/:id/report" component={ReportCard} />
      <Route path="/lookup" component={Lookup} />
      <Route path="/activity" component={ActivityLog} />
      <Route path="/partner-assessment" component={PartnerAssessment} />
      <Route path="/admin" component={Admin} />
      <Route path="/resources" component={AdminResources} />
      <Route path="/events" component={AdminEvents} />
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

function PartnerRouter({ partnerId }: { partnerId: string | null }) {
  if (!partnerId) {
    return (
      <Switch>
        <Route path="/company-info" component={PartnerOnboarding} />
        <Route>
          <Redirect to="/company-info" />
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={PartnerHome} />
      <Route path="/company-info" component={PartnerOnboarding} />
      <Route path="/capabilities" component={PartnerCapabilities} />
      <Route path="/capabilities/new" component={PartnerCapabilityWizard} />
      <Route path="/capabilities/:id/view" component={PartnerCapabilityView} />
      <Route path="/capabilities/:id/edit" component={PartnerCapabilityWizard} />
      <Route path="/assessments" component={Assessments} />
      <Route path="/partners/:id/assessments/:assessmentId" component={AssessmentDetail} />
      <Route path="/partners/:id" component={PartnerDetail} />
      <Route path="/finance" component={WorkInProgress} />
      <Route path="/ecosystem" component={WorkInProgress} />
      <Route path="/opportunities" component={WorkInProgress} />
      <Route path="/resources" component={Resources} />
      <Route path="/events" component={Events} />
      <Route path="/inbox" component={WorkInProgress} />
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

const ADMIN_PRESET_QUESTIONS = [
  "What do the dashboard metrics mean?",
  "How does the partner assessment workflow work?",
  "Explain the 9 readiness verticals and their policies",
  "What should I look for when reviewing a capability?",
  "How do maturity levels L1-L9 work?",
  "What is the difference between Verified and Not Verified?",
];

const PARTNER_PRESET_QUESTIONS = [
  "How do I fill out a new capability?",
  "What documents do I need for each vertical?",
  "Explain the TRL (Technology Readiness) section",
  "What does each maturity level (L1-L9) mean?",
  "Why did I receive feedback on my submission?",
  "How can I improve my readiness scores?",
];

function AuthenticatedApp() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [chatOpen, setChatOpen] = useState(false);

  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 relative">
          <header className="flex items-center gap-2 p-2 border-b h-12 shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => window.open(isAdmin ? '/manual/admin-manual.html' : '/manual/partner-manual.html', '_blank')}
              data-testid="button-user-manual"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">User Manual</span>
            </Button>
          </header>
          <main className="flex-1 overflow-y-auto">
            {isAdmin ? <AdminRouter /> : <PartnerRouter partnerId={user!.partnerId || null} />}
          </main>

          {!chatOpen && <ChatFab onClick={() => setChatOpen(true)} />}

          {isAdmin ? (
            <AIChatPanel
              title="CENCORE Admin Assistant"
              subtitle="AI-powered help for dashboards, assessments & policies"
              welcomeHeading="Admin Assistant"
              welcomeDescription="I can help you understand dashboards, review partner assessments, explain policies and regulations, and guide you through the configurator."
              placeholder="Ask about dashboards, policies, assessments..."
              presetQuestions={ADMIN_PRESET_QUESTIONS}
              endpoint="/api/admin/chatbot"
              open={chatOpen}
              onClose={() => setChatOpen(false)}
            />
          ) : (
            <AIChatPanel
              title="IWE Partner Assistant"
              subtitle="AI-powered help for capabilities & assessments"
              welcomeHeading="Partner Assistant"
              welcomeDescription="I can help you fill out capabilities, explain each section and vertical, describe required artifacts and policies, and understand your dashboard."
              placeholder="Ask about capabilities, verticals, artifacts..."
              presetQuestions={PARTNER_PRESET_QUESTIONS}
              endpoint="/api/partner/chatbot"
              open={chatOpen}
              onClose={() => setChatOpen(false)}
            />
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (user.role === "partner" && !user.partnerId) {
    return <PartnerWizard />;
  }

  return <AuthenticatedApp />;
}

function Root() {
  return (
    <TooltipProvider>
      <App />
      <Toaster />
    </TooltipProvider>
  );
}

export default Root;
