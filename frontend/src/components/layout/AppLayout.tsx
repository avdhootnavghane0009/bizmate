import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdaptiveSidebar } from './AdaptiveSidebar';
import { TopNavigation } from './TopNavigation';
import { ErrorBoundary } from '../common/ErrorBoundary';

export const AppLayout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#EDE8DE] dark:bg-[#181915] text-[#181915] dark:text-[#EDE8DE] overflow-hidden font-sans">
      {/* 1. Adaptive Persistent Sidebar */}
      <AdaptiveSidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
      />

      {/* 2. Main Viewport */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNavigation />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
