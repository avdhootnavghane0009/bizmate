import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { BusinessProvider } from './context/BusinessContext';

import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/marketing/HomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { OnboardingWizard } from './pages/onboarding/OnboardingWizard';

import { MainDashboard } from './pages/dashboard/MainDashboard';
import { AIAssistantPage } from './pages/ai/AIAssistantPage';
import { WhatsAppInboxPage } from './pages/inbox/WhatsAppInboxPage';
import { CRMPipelinePage } from './pages/crm/CRMPipelinePage';
import { OperationsPage } from './pages/operations/OperationsPage';
import { AutomationPage } from './pages/automation/AutomationPage';
import { IntegrationsPage } from './pages/integrations/IntegrationsPage';
import { SettingsPage } from './pages/settings/SettingsPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BusinessProvider>
          <BrowserRouter>
            <Routes>
              {/* Marketing & Auth */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/onboarding" element={<OnboardingWizard />} />

              {/* Protected SaaS App Shell */}
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<MainDashboard />} />
                <Route path="ai" element={<AIAssistantPage />} />
                <Route path="inbox" element={<WhatsAppInboxPage />} />
                <Route path="crm" element={<CRMPipelinePage />} />
                <Route path="operations" element={<OperationsPage />} />
                <Route path="automation" element={<AutomationPage />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </BusinessProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
