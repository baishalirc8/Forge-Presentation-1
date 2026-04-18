import {
  LayoutDashboard, Users, Shield, Activity, Settings, LogOut, Building2, ClipboardCheck,
  Home, ChevronDown, Briefcase, DollarSign, Layers, Globe, Lightbulb, FolderOpen, Calendar, Inbox, FileCheck,
  Sun, Moon, Monitor
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const adminNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Partners", url: "/partners", icon: Users },
  { title: "Partner Assessment", url: "/partner-assessment", icon: FileCheck },
  { title: "Activity Log", url: "/activity", icon: Activity },
  { title: "Resources", url: "/resources", icon: FolderOpen },
  { title: "Events", url: "/events", icon: Calendar },
];

const adminSystemItems = [
  { title: "Configuration", url: "/admin", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const isAdmin = user?.role === "admin";
  const { theme, setTheme } = useTheme();
  const [companyOpen, setCompanyOpen] = useState(false);

  const partnerNavItems = [
    { title: "Home", url: "/", icon: Home },
    {
      title: "Company",
      icon: Building2,
      expandable: true,
      children: [
        { title: "Business", url: "/company-info", icon: Briefcase },
        { title: "Finance", url: "/finance", icon: DollarSign },
      ],
    },
    { title: "Capabilities", url: "/capabilities", icon: Layers },
    { title: "Ecosystem", url: "/ecosystem", icon: Globe },
    { title: "Opportunities", url: "/opportunities", icon: Lightbulb },
    { title: "Resources", url: "/resources", icon: FolderOpen },
    { title: "Events", url: "/events", icon: Calendar },
    { title: "Inbox", url: "/inbox", icon: Inbox },
  ];

  const navItems = isAdmin ? adminNavItems : [];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide" data-testid="text-app-name">
              {isAdmin ? "CENCORE" : "IWE"}
            </p>
            {isAdmin && <p className="text-[11px] text-muted-foreground tracking-wider">WRA 2026</p>}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {isAdmin ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild data-active={isActive}>
                          <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">System</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminSystemItems.map((item) => {
                    const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild data-active={isActive}>
                          <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {partnerNavItems.map((item) => {
                  if ('expandable' in item && item.expandable && 'children' in item) {
                    const isParentActive = item.children.some(c => location === c.url || location.startsWith(c.url));
                    return (
                      <div key={item.title}>
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            data-active={isParentActive || companyOpen}
                            onClick={() => setCompanyOpen(!companyOpen)}
                            data-testid={`link-nav-${item.title.toLowerCase()}`}
                          >
                            <item.icon className="h-4 w-4" />
                            <span className="flex-1">{item.title}</span>
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${companyOpen ? "rotate-180" : ""}`} />
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                        {companyOpen && item.children.map(child => {
                          const isActive = location === child.url;
                          return (
                            <SidebarMenuItem key={child.title} className="pl-6">
                              <SidebarMenuButton asChild data-active={isActive}>
                                <Link href={child.url} data-testid={`link-nav-${child.title.toLowerCase()}`}>
                                  <child.icon className="h-3.5 w-3.5" />
                                  <span className="text-sm">{child.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </div>
                    );
                  }
                  const isActive = location === item.url || (item.url !== "/" && item.url !== "#" && !item.url.startsWith("#") && location.startsWith(item.url));
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild data-active={isActive || (item.url === "/" && location === "/")}>
                        <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-3">
        <div className="rounded-md bg-muted/50 p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Signed in as</p>
          <p className="text-sm font-medium truncate" data-testid="text-user-display">{user?.displayName || user?.username}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider" data-testid="text-user-role">{user?.role}</p>
        </div>
        <div className="flex items-center rounded-md bg-muted/50 p-1 gap-0.5" data-testid="theme-toggle">
          <Button
            variant="ghost"
            size="sm"
            className={`flex-1 h-7 text-xs gap-1.5 ${theme === "light" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            onClick={() => setTheme("light")}
            data-testid="button-theme-light"
          >
            <Sun className="h-3.5 w-3.5" />
            Light
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`flex-1 h-7 text-xs gap-1.5 ${theme === "dark" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            onClick={() => setTheme("dark")}
            data-testid="button-theme-dark"
          >
            <Moon className="h-3.5 w-3.5" />
            Dark
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`flex-1 h-7 text-xs gap-1.5 ${theme === "system" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            onClick={() => setTheme("system")}
            data-testid="button-theme-system"
          >
            <Monitor className="h-3.5 w-3.5" />
            Auto
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sm text-muted-foreground hover:text-foreground"
          onClick={() => logout()}
          disabled={isLoggingOut}
          data-testid="button-logout"
        >
          <LogOut className="h-3.5 w-3.5 mr-2" />
          Sign Out
        </Button>
        {isAdmin && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Classification</p>
            <p className="text-sm font-medium">CUI // IL5 Environment</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
