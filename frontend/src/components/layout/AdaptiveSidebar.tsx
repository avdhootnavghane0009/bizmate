import React from 'react';
import { NavLink } from 'react-router-dom';
import { useBusiness } from '../../context/BusinessContext';
import { 
  LayoutDashboard, Bot, MessageSquareText, Users, 
  Workflow, ShoppingCart, FileText, Plug, Crown, Settings,
  ChevronLeft, ChevronRight, Boxes
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: any;
  badge?: string;
}

export const AdaptiveSidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { business, industry } = useBusiness();
  const { terminology } = industry;

  const navLinks: NavItem[] = [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/ai", label: "AI Copilot", icon: Bot },
    { to: "/app/inbox", label: "Shared Inbox", icon: MessageSquareText },
    { to: "/app/crm", label: `${terminology.customer}s`, icon: Users },
    { to: "/app/automation", label: "n8n Workflows", icon: Workflow },
    { to: "/app/operations", label: "Operations & GST", icon: FileText },
    { to: "/app/integrations", label: "Integrations Hub", icon: Plug },
    { to: "/app/settings", label: "Plans & Settings", icon: Settings },
  ];

  return (
    <aside 
      className={`h-screen border-r border-[#D8CDBC] dark:border-[#2C2C26] bg-[#FFFFFF] dark:bg-[#181915] transition-all duration-200 flex flex-col justify-between shrink-0 select-none ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div>
        {/* Logo & Collapse Header */}
        <div className="h-14 border-b border-[#D8CDBC] dark:border-[#2C2C26] px-4 flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#A0815A] text-[#181915] font-black text-sm flex items-center justify-center shadow-sm">
                B
              </div>
              <span className="font-bold text-sm tracking-tight text-[#181915] dark:text-[#EDE8DE]">
                Bizmate
              </span>
            </div>
          )}
          <button 
            onClick={onToggle}
            className="p-1 rounded-md hover:bg-[#E1D2BB] dark:hover:bg-[#20211D] text-[#57554F] dark:text-[#9E998E] mx-auto"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Item Stream */}
        <nav className="p-2 space-y-1 mt-2">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#A0815A] text-[#FFFFFF] shadow-sm font-semibold'
                      : 'text-[#57554F] dark:text-[#9E998E] hover:bg-[#E1D2BB]/40 dark:hover:bg-[#20211D] hover:text-[#181915] dark:hover:text-[#EDE8DE]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] bg-[#181915] text-[#EDE8DE] px-1.5 py-0.2 rounded font-mono">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Plan Badge */}
      {!isCollapsed && (
        <div className="p-3 m-3 bg-[#E1D2BB]/30 dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-xl flex items-center justify-between">
          <div className="text-left">
            <p className="text-[11px] font-bold text-[#181915] dark:text-[#EDE8DE] capitalize">{business.planId || 'Free'} Plan</p>
            <p className="text-[10px] text-[#A0815A] font-mono">Multi-Tenant Isolated</p>
          </div>
          <Crown className="w-4 h-4 text-[#A0815A]" />
        </div>
      )}
    </aside>
  );
};
