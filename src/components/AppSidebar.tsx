import { Calendar, ClipboardList, Wallet, BarChart3, Users, Settings, LayoutDashboard, Home, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import breezeLogo from "@/assets/breeze-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Availability", url: "/availability", icon: Calendar },
  { title: "Bookings", url: "/bookings", icon: ClipboardList },
  { title: "Pending Balances", url: "/balances", icon: Wallet },
  { title: "Revenue", url: "/revenue", icon: BarChart3 },
  { title: "Guests", url: "/guests", icon: Users },
  { title: "Units", url: "/units", icon: Home },
  { title: "Resort Map", url: "/map", icon: Map },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Branding */}
        <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border">
          <img src={breezeLogo} alt="Breeze Resort" className="h-10 w-10 shrink-0" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-lg tracking-wide text-primary">
                Breeze Resort
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Liwliwa · Zambales
              </span>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* Sign out */}
        <div className="mt-auto border-t border-sidebar-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Sign Out" onClick={() => signOut()}>
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Sign Out</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
