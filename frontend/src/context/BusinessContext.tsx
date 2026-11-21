import React, { createContext, useContext, useState, useEffect } from 'react';
import { SUPPORTED_INDUSTRIES, IndustryConfig } from '../config/industries';
import { api } from '../api/client';

export interface BusinessProfile {
  id: string;
  name: string;
  industryId: string;
  planId: 'free' | 'starter' | 'growth' | 'pro' | 'enterprise';
  phone: string;
  currency: string;
}

export interface SubscriptionInfo {
  id: string;
  plan_id: string;
  status: 'free' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'suspended';
  payment_provider?: string;
  billing_cycle?: string;
  billing_period_start?: string;
  billing_period_end?: string;
  plan: {
    id: string;
    name: string;
    price: number | null;
    currency: string;
    limits: {
      ai_operations_monthly: number;
      crm_contacts: number;
      staff_accounts: number;
      automation_workflows: number;
      voice_processing: boolean;
      voice_seconds_monthly: number;
      storage_mb: number;
    };
    features: Record<string, boolean>;
    highlights?: string[];
  };
}

export interface EntitlementUsage {
  crm_contacts: { used: number; limit: number; percent: number };
  staff_accounts: { used: number; limit: number; percent: number };
  ai_operations: { used: number; limit: number; remaining: number; percent: number };
  whatsapp: { inbound: number; outbound: number; total: number };
  automation_workflows: { used: number; limit: number; percent: number };
}

interface BusinessContextType {
  business: BusinessProfile;
  industry: IndustryConfig;
  subscription: SubscriptionInfo | null;
  entitlements: EntitlementUsage | null;
  loading: boolean;
  setBusinessProfile: (profile: BusinessProfile) => void;
  switchIndustry: (industryId: string) => Promise<void>;
  updatePlan: (planId: BusinessProfile['planId']) => Promise<{ success: boolean; message?: string }>;
  refreshBusiness: () => Promise<void>;
  logout: () => void;
}

const initialPlaceholder: BusinessProfile = {
  id: '',
  name: 'Loading Business...',
  industryId: 'general',
  planId: 'free',
  phone: '',
  currency: 'INR',
};

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [business, setBusiness] = useState<BusinessProfile>(() => {
    const saved = localStorage.getItem('bizmate_business');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return initialPlaceholder;
  });

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshBusiness = async () => {
    const token = localStorage.getItem('bizmate_auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const [res, subRes, entRes] = await Promise.all([
        api.get<any>('/business/profile').catch(() => null),
        api.get<SubscriptionInfo>('/subscriptions/current').catch(() => null),
        api.get<any>('/subscriptions/entitlements').catch(() => null),
      ]);

      if (res && res.id) {
        const effectivePlan = subRes?.plan_id || res.planId || 'free';
        const profile: BusinessProfile = {
          id: res.id,
          name: res.name || 'My Business',
          industryId: res.industryId || 'general',
          planId: effectivePlan as any,
          phone: res.phone || '',
          currency: res.currency || 'INR',
        };
        setBusiness(profile);
        localStorage.setItem('bizmate_business', JSON.stringify(profile));
      }

      if (subRes) setSubscription(subRes);
      if (entRes && entRes.usage) setEntitlements(entRes.usage);
    } catch (err) {
      console.warn('Could not fetch active business or subscription from backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshBusiness();
  }, []);

  const industry = SUPPORTED_INDUSTRIES[business.industryId] || SUPPORTED_INDUSTRIES.general;

  const setBusinessProfile = (profile: BusinessProfile) => {
    setBusiness(profile);
    localStorage.setItem('bizmate_business', JSON.stringify(profile));
  };

  const switchIndustry = async (industryId: string) => {
    setBusiness((prev) => {
      const updated = { ...prev, industryId };
      localStorage.setItem('bizmate_business', JSON.stringify(updated));
      return updated;
    });

    const token = localStorage.getItem('bizmate_auth_token');
    if (token) {
      try {
        await api.patch('/business/profile', { industry_id: industryId });
      } catch (err) {
        console.warn('Failed persisting industry switch to backend:', err);
      }
    }
  };

  const updatePlan = async (planId: BusinessProfile['planId']) => {
    try {
      // Direct update is rejected by backend without payment.
      // Call subscriptions upgrade endpoint which returns verified payment instruction
      await api.post('/subscriptions/upgrade', { plan_id: planId });
      await refreshBusiness();
      return { success: true };
    } catch (err: any) {
      const detail = err?.detail || 'Verified payment required to activate paid subscription.';
      return { success: false, message: detail };
    }
  };

  const logout = () => {
    localStorage.removeItem('bizmate_auth_token');
    localStorage.removeItem('bizmate_business');
    setBusiness(initialPlaceholder);
    window.location.href = '/login';
  };

  return (
    <BusinessContext.Provider
      value={{
        business,
        industry,
        subscription,
        entitlements,
        loading,
        setBusinessProfile,
        switchIndustry,
        updatePlan,
        refreshBusiness,
        logout,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
};
