import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import tileforceLogo from '@/assets/tileforce-logo.png';
import {
  LayoutDashboard,
  FileText,
  Search,
  TrendingUp,
  Users,
  LogOut,
  Settings,
  History,
  Layers
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Content Generator', href: '/content', icon: FileText },
  { name: 'Bulk Content', href: '/bulk-content', icon: Layers },
  { name: 'SEO Audit', href: '/audit', icon: Search },
  { name: 'Keyword Research', href: '/keywords', icon: TrendingUp },
  { name: 'Concurrenten', href: '/competitors', icon: Users },
  { name: 'Geschiedenis', href: '/history', icon: History },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const initials = user?.email?.slice(0, 2).toUpperCase() || 'U';

  const handleNavClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <aside className="h-full w-full md:fixed md:left-0 md:top-0 md:z-40 md:h-screen md:w-64 bg-sidebar text-sidebar-foreground md:border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-4 border-b border-sidebar-border">
          <img 
            src={tileforceLogo} 
            alt="TileForce AI Agent" 
            className="h-10 w-10 rounded-lg"
          />
          <div>
            <span className="font-bold text-base">TileForce</span>
            <p className="text-xs text-sidebar-foreground/60">AI Agent</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={handleNavClick}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
              <p className="text-xs text-sidebar-foreground/60">Team member</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              asChild
              onClick={handleNavClick}
            >
              <Link to="/settings">
                <Settings className="h-4 w-4 mr-2" />
                Instellingen
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
