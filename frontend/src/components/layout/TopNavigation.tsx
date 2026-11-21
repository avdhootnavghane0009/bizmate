import React from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { useTheme } from '../../context/ThemeContext';
import { Search, Sun, Moon, Bell, LogOut } from 'lucide-react';

export const TopNavigation: React.FC = () => {
  const { business, industry, logout } = useBusiness();
  const { theme, toggleTheme } = useTheme();

  const initial = (business.name || 'B').charAt(0).toUpperCase();

  return (
    <header className="h-14 border-b border-[#D8CDBC] dark:border-[#2C2C26] bg-[#FFFFFF] dark:bg-[#181915] px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E1D2BB] dark:bg-[#302D27] text-[#A0815A] font-mono uppercase tracking-wider">
          {industry.name}
        </span>
        <span className="text-xs font-semibold text-[#181915] dark:text-[#EDE8DE]">
          {business.name || 'My Business'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Quick Search */}
        <div className="relative hidden md:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#57554F] dark:text-[#9E998E]" />
          <input 
            type="text" 
            placeholder="Search commands (Cmd + K)..." 
            className="w-56 bg-[#EDE8DE] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#181915] dark:text-[#EDE8DE] placeholder-[#57554F] dark:placeholder-[#9E998E] focus:outline-none focus:border-[#A0815A]"
          />
        </div>

        {/* Theme Switcher */}
        <button 
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-[#E1D2BB] dark:hover:bg-[#20211D] text-[#57554F] dark:text-[#9E998E] transition"
          title="Toggle Light / Dark theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-[#A0815A]" /> : <Moon className="w-4 h-4 text-[#A0815A]" />}
        </button>

        {/* User Badge */}
        <div className="w-7 h-7 rounded-full bg-[#A0815A] text-[#181915] font-bold text-xs flex items-center justify-center">
          {initial}
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          title="Log out from BizMate"
          className="p-2 rounded-lg hover:bg-red-500/10 text-[#57554F] dark:text-[#9E998E] hover:text-red-500 transition flex items-center gap-1 text-xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-[11px]">Logout</span>
        </button>
      </div>
    </header>
  );
};
