import React, { useEffect, useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import {
  Crown,
  Check,
  Building,
  CheckCircle2,
  AlertCircle,
  Zap,
  Receipt,
  CreditCard,
  ExternalLink,
  Loader2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../api/client';
import { SUPPORTED_INDUSTRIES } from '../../config/industries';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

interface BillingInvoice {
  id: string;
  invoice_number: string;
  plan_id: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: string;
  billing_period_start: string;
  billing_period_end: string;
  created_at: string;
}

interface BillingPayment {
  id: string;
  amount: number;
  currency: string;
  payment_provider: string;
  provider_payment_id: string;
  provider_order_id: string;
  status: string;
  created_at: string;
}

export const SettingsPage: React.FC = () => {
  const { business, industry, subscription, entitlements, switchIndustry, refreshBusiness } = useBusiness();
  const [plans, setPlans] = useState<any[]>([]);
  const [switching, setSwitching] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [upgradeNotice, setUpgradeNotice] = useState<{ planName: string; message: string; type?: 'error' | 'success' } | null>(null);
  const [billingHistory, setBillingHistory] = useState<{ invoices: BillingInvoice[]; payments: BillingPayment[] }>({
    invoices: [],
    payments: [],
  });
  const [testModalOrder, setTestModalOrder] = useState<any | null>(null);

  const fetchBillingHistory = () => {
    api.get<{ invoices: BillingInvoice[]; payments: BillingPayment[] }>('/subscriptions/billing-history')
      .then((data) => setBillingHistory(data))
      .catch(() => {});
  };

  useEffect(() => {
    api.get<any[]>('/subscriptions/plans')
      .then((data) => setPlans(data))
      .catch(() => {
        // Safe fallback matching centralized configuration
        setPlans([
          {
            id: 'free',
            name: 'Free Tier',
            price: 0,
            badge: 'Free',
            description: 'Essential business tools for micro-enterprises and initial setup.',
            highlights: ['50 AI operations / mo', '100 CRM Contacts', '1 Staff Account', '1 Active Workflow'],
          },
          {
            id: 'starter',
            name: 'Starter',
            price: 599,
            badge: 'Starter',
            description: 'Designed for single-location retail shops, salons, and boutique cafes.',
            highlights: ['500 AI operations / mo', '1,000 CRM Contacts', '2 Staff Accounts', '3 Active Workflows', 'Voice Notes (5 mins)'],
          },
          {
            id: 'growth',
            name: 'Growth',
            price: 1499,
            badge: 'Popular',
            description: 'For growing businesses requiring AI autopilot and multilingual operations.',
            highlights: ['2,500 AI operations / mo', '10,000 CRM Contacts', '5 Staff Accounts', '10 Workflows', 'Full Voice Notes (30 mins)', 'Advanced Analytics'],
          },
          {
            id: 'pro',
            name: 'Pro Scale',
            price: 3499,
            badge: 'Scale',
            description: 'For high-volume operations, restaurant chains, and large teams.',
            highlights: ['10,000 AI operations / mo', '50,000 CRM Contacts', '15 Staff Accounts', 'Up to 50 Workflows', 'Priority Support'],
          },
          {
            id: 'enterprise',
            name: 'Enterprise',
            price: null,
            badge: 'Custom',
            description: 'Custom quotas, dedicated infrastructure, and SLA for franchises.',
            highlights: ['Custom AI Quotas', '100,000+ Contacts', '50+ Staff Accounts', 'Dedicated Account Manager'],
          },
        ]);
      });

    fetchBillingHistory();
  }, []);

  const handleIndustryChange = async (indId: string) => {
    if (indId === business.industryId) return;
    setSwitching(true);
    try {
      await switchIndustry(indId);
    } finally {
      setSwitching(false);
    }
  };

  const handlePlanClick = async (plan: any) => {
    if (business.planId === plan.id) return;

    if (plan.id === 'enterprise') {
      setUpgradeNotice({
        planName: 'Enterprise',
        message: 'Enterprise plans include custom AI models and dedicated SLAs. Please contact sales@bizmate.in.',
        type: 'error',
      });
      return;
    }

    if (plan.id === 'free') {
      setUpgradeNotice({
        planName: 'Free Tier',
        message: 'To downgrade or cancel your active subscription, please use the Cancel Subscription option.',
        type: 'error',
      });
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      // 1. Create order on backend
      const orderData = await api.post<any>('/payments/create-order', {
        plan_id: plan.id,
        billing_cycle: 'monthly',
      });

      // 2. If Razorpay SDK is available on window, open standard Razorpay checkout modal
      if (typeof window !== 'undefined' && window.Razorpay) {
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'BizMate SaaS',
          description: `Upgrade to ${plan.name} Tier`,
          order_id: orderData.order_id,
          handler: async (response: any) => {
            try {
              await api.post('/payments/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_id: plan.id,
                billing_cycle: 'monthly',
              });
              await refreshBusiness();
              fetchBillingHistory();
              setUpgradeNotice({
                planName: plan.name,
                message: `Congratulations! Your subscription has been successfully upgraded to ${plan.name}.`,
                type: 'success',
              });
            } catch (err: any) {
              setUpgradeNotice({
                planName: plan.name,
                message: err.response?.data?.error || 'Payment signature verification failed.',
                type: 'error',
              });
            }
          },
          prefill: {
            name: business.name,
            contact: business.phone,
          },
          theme: {
            color: '#A0815A',
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Fallback / Sandbox mode dialog
        setTestModalOrder({
          ...orderData,
          targetPlan: plan,
        });
      }
    } catch (err: any) {
      setUpgradeNotice({
        planName: plan.name,
        message: err.response?.data?.error || 'Failed initiating payment order. Please try again.',
        type: 'error',
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleTestSimulatePayment = async () => {
    if (!testModalOrder) return;
    setCheckoutLoading(testModalOrder.targetPlan.id);
    try {
      await api.post('/payments/verify', {
        razorpay_order_id: testModalOrder.order_id,
        razorpay_payment_id: `pay_test_${Date.now()}`,
        razorpay_signature: 'MOCK_SIGNATURE_OK',
        plan_id: testModalOrder.targetPlan.id,
        billing_cycle: 'monthly',
      });
      await refreshBusiness();
      fetchBillingHistory();
      setUpgradeNotice({
        planName: testModalOrder.targetPlan.name,
        message: `Payment simulated successfully! Business upgraded to ${testModalOrder.targetPlan.name}.`,
        type: 'success',
      });
      setTestModalOrder(null);
    } catch (err: any) {
      setUpgradeNotice({
        planName: testModalOrder.targetPlan.name,
        message: err.response?.data?.error || 'Simulated verification failed.',
        type: 'error',
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#181915] dark:text-[#EDE8DE]">
          Plans, Entitlements &amp; Business Settings
        </h1>
        <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-0.5">
          Manage tenant industry modes, subscription tiers, and operational rules for <strong>{business.name}</strong>.
        </p>
      </div>

      {/* Upgrade Notice Banner */}
      {upgradeNotice && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between ${
            upgradeNotice.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
              : 'border-amber-500/30 bg-amber-500/10 text-[#181915] dark:text-[#EDE8DE]'
          }`}
        >
          <div className="flex items-start gap-3">
            {upgradeNotice.type === 'success' ? (
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-bold">
                {upgradeNotice.type === 'success' ? 'Subscription Updated' : `Notice for ${upgradeNotice.planName}`}
              </p>
              <p className="text-xs mt-1 opacity-90">{upgradeNotice.message}</p>
            </div>
          </div>
          <button
            onClick={() => setUpgradeNotice(null)}
            className="text-xs font-bold px-2 py-1 opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Test / Sandbox Payment Simulation Modal */}
      {testModalOrder && (
        <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#20211D] border-2 border-[#A0815A] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-[#A0815A] uppercase tracking-wide">
              Test Mode Checkout Gateway
            </span>
            <button
              onClick={() => setTestModalOrder(null)}
              className="text-xs text-[#57554F] hover:text-[#181915] dark:hover:text-white"
            >
              Cancel
            </button>
          </div>
          <p className="text-sm font-bold text-[#181915] dark:text-[#EDE8DE]">
            Authorize Order: {testModalOrder.order_id} (₹{(testModalOrder.amount / 100).toLocaleString()})
          </p>
          <p className="text-xs text-[#57554F] dark:text-[#9E998E]">
            Razorpay test credentials or mock mode active. Click below to verify cryptographic HMAC on the backend and activate <strong>{testModalOrder.targetPlan.name}</strong>.
          </p>
          <div className="pt-2 flex gap-3">
            <button
              onClick={handleTestSimulatePayment}
              disabled={checkoutLoading !== null}
              className="px-4 py-2 bg-[#A0815A] text-white text-xs font-bold rounded-lg hover:bg-[#8C6F4B] transition flex items-center gap-2"
            >
              {checkoutLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
              Complete Verified Payment
            </button>
            <button
              onClick={() => setTestModalOrder(null)}
              className="px-4 py-2 bg-[#EDE8DE] dark:bg-[#181915] text-xs font-bold rounded-lg text-[#57554F] dark:text-[#9E998E]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Live Quota & Usage Overview */}
      {entitlements && (
        <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] space-y-4">
          <div className="flex items-center justify-between border-b border-[#D8CDBC] dark:border-[#2C2C26] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#181915] dark:text-[#EDE8DE] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#A0815A]" /> Live Entitlements &amp; Resource Metering
              </h2>
              <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-0.5">
                Current billing cycle usage strictly governed by your <strong>{subscription?.plan?.name || business.planId.toUpperCase()}</strong> plan.
              </p>
            </div>
            <span className="text-xs font-mono px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg capitalize">
              Status: {subscription?.status || 'Active'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
            {/* AI Operations Meter */}
            <div className="p-3.5 rounded-xl border border-[#D8CDBC] dark:border-[#2C2C26] bg-[#EDE8DE]/30 dark:bg-[#181915]">
              <span className="text-[11px] text-[#57554F] dark:text-[#9E998E] font-medium flex items-center justify-between">
                <span>AI Operations</span>
                <span className="font-bold text-[#181915] dark:text-[#EDE8DE]">
                  {entitlements.ai_operations.used} / {entitlements.ai_operations.limit}
                </span>
              </span>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[#A0815A] h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, entitlements.ai_operations.percent)}%` }}
                />
              </div>
              <span className="text-[10px] text-[#57554F] dark:text-[#9E998E] mt-1.5 block">
                {entitlements.ai_operations.remaining} operations remaining this cycle
              </span>
            </div>

            {/* CRM Contacts Meter */}
            <div className="p-3.5 rounded-xl border border-[#D8CDBC] dark:border-[#2C2C26] bg-[#EDE8DE]/30 dark:bg-[#181915]">
              <span className="text-[11px] text-[#57554F] dark:text-[#9E998E] font-medium flex items-center justify-between">
                <span>CRM Contacts</span>
                <span className="font-bold text-[#181915] dark:text-[#EDE8DE]">
                  {entitlements.crm_contacts.used} / {entitlements.crm_contacts.limit}
                </span>
              </span>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, entitlements.crm_contacts.percent)}%` }}
                />
              </div>
              <span className="text-[10px] text-[#57554F] dark:text-[#9E998E] mt-1.5 block">
                {entitlements.crm_contacts.limit - entitlements.crm_contacts.used} contact slots free
              </span>
            </div>

            {/* Staff Accounts Meter */}
            <div className="p-3.5 rounded-xl border border-[#D8CDBC] dark:border-[#2C2C26] bg-[#EDE8DE]/30 dark:bg-[#181915]">
              <span className="text-[11px] text-[#57554F] dark:text-[#9E998E] font-medium flex items-center justify-between">
                <span>Staff Seats</span>
                <span className="font-bold text-[#181915] dark:text-[#EDE8DE]">
                  {entitlements.staff_accounts.used} / {entitlements.staff_accounts.limit}
                </span>
              </span>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, entitlements.staff_accounts.percent)}%` }}
                />
              </div>
              <span className="text-[10px] text-[#57554F] dark:text-[#9E998E] mt-1.5 block">Authorized user seats</span>
            </div>

            {/* WhatsApp Messages Handled */}
            <div className="p-3.5 rounded-xl border border-[#D8CDBC] dark:border-[#2C2C26] bg-[#EDE8DE]/30 dark:bg-[#181915]">
              <span className="text-[11px] text-[#57554F] dark:text-[#9E998E] font-medium flex items-center justify-between">
                <span>WhatsApp Messages</span>
                <span className="font-bold text-[#181915] dark:text-[#EDE8DE]">{entitlements.whatsapp.total}</span>
              </span>
              <div className="mt-2 text-[10px] text-[#57554F] dark:text-[#9E998E] flex justify-between">
                <span>
                  Inbound: <strong>{entitlements.whatsapp.inbound}</strong>
                </span>
                <span>
                  Outbound: <strong>{entitlements.whatsapp.outbound}</strong>
                </span>
              </div>
              <span className="text-[10px] text-[#A0815A] mt-1.5 block">BYOC Mode (Billed by Meta)</span>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Industry Switcher */}
      <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#181915] dark:text-[#EDE8DE] flex items-center gap-2">
              <Building className="w-4 h-4 text-[#A0815A]" /> Active Industry Configuration
            </h2>
            <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-0.5">
              Switching your industry persists directly to PostgreSQL and dynamically updates CRM terminology, metrics, and workflows.
            </p>
          </div>
          <span className="text-xs font-mono px-3 py-1 bg-[#A0815A]/10 text-[#A0815A] border border-[#A0815A]/30 rounded-lg">
            Active: {industry.name}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          {Object.values(SUPPORTED_INDUSTRIES).map((ind) => {
            const isSelected = business.industryId === ind.id;
            return (
              <div
                key={ind.id}
                onClick={() => handleIndustryChange(ind.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${
                  isSelected
                    ? 'border-[#A0815A] bg-[#A0815A]/10 ring-1 ring-[#A0815A]'
                    : 'border-[#D8CDBC] dark:border-[#2C2C26] bg-[#EDE8DE]/40 dark:bg-[#181915] hover:border-[#A0815A]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{ind.name}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#A0815A]" />}
                </div>
                <div className="mt-2 text-[10px] text-[#57554F] dark:text-[#9E998E]">
                  Customer: <strong className="text-[#A0815A]">{ind.terminology.customer}</strong>
                  <br />
                  Order: <strong className="text-[#A0815A]">{ind.terminology.orderOrBooking}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Centralized Subscription Plans Catalog */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#181915] dark:text-[#EDE8DE] flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#A0815A]" /> Available Subscription Tiers
            </h2>
            <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-0.5">
              Verified backend pricing with instant Razorpay checkout activation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {plans.map((p) => {
            const isCurrent = business.planId === p.id;
            const priceDisplay = p.price === null ? 'Custom' : p.price === 0 ? '₹0' : `₹${p.price}`;
            const billingInterval = p.price === null ? 'Contact Sales' : '/month';
            const isLoadingThis = checkoutLoading === p.id;

            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  isCurrent
                    ? 'border-[#A0815A] bg-[#A0815A]/10 ring-1 ring-[#A0815A]'
                    : 'border-[#D8CDBC] dark:border-[#2C2C26] bg-[#FFFFFF] dark:bg-[#20211D]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{p.name}</span>
                    {p.badge && (
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-[#A0815A]/20 text-[#A0815A] rounded-full">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-black text-[#A0815A]">{priceDisplay}</span>
                    <span className="text-[10px] text-[#57554F] dark:text-[#9E998E] ml-1">{billingInterval}</span>
                  </div>
                  <p className="text-[11px] text-[#57554F] dark:text-[#9E998E] mt-2 line-clamp-2">{p.description}</p>

                  {/* Highlights list */}
                  <div className="mt-4 space-y-1.5 border-t border-[#D8CDBC]/50 dark:border-[#2C2C26] pt-3">
                    {(p.highlights || []).map((h: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[10px] text-[#181915] dark:text-[#EDE8DE]">
                        <Check className="w-3 h-3 text-[#A0815A] shrink-0" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handlePlanClick(p)}
                  disabled={isLoadingThis || isCurrent}
                  className={`w-full mt-5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    isCurrent
                      ? 'bg-slate-700 text-white cursor-default'
                      : 'bg-[#A0815A] text-white hover:bg-[#8C6F4B]'
                  }`}
                >
                  {isLoadingThis ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isCurrent ? (
                    'Active Plan'
                  ) : p.price === null ? (
                    'Contact Sales'
                  ) : (
                    'Upgrade Plan'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing & Invoice History */}
      <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] space-y-4">
        <div className="flex items-center justify-between border-b border-[#D8CDBC] dark:border-[#2C2C26] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#181915] dark:text-[#EDE8DE] flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#A0815A]" /> Billing &amp; Payment History
            </h2>
            <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-0.5">
              Verified SaaS invoices and Razorpay transaction records for this tenant.
            </p>
          </div>
        </div>

        {billingHistory.invoices.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#57554F] dark:text-[#9E998E]">
            No paid invoices on record yet. Upgrade to Starter, Growth, or Pro to generate official tax receipts.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#D8CDBC] dark:border-[#2C2C26] text-[#57554F] dark:text-[#9E998E]">
                  <th className="py-2.5 px-3 font-semibold">Invoice #</th>
                  <th className="py-2.5 px-3 font-semibold">Plan</th>
                  <th className="py-2.5 px-3 font-semibold">Amount</th>
                  <th className="py-2.5 px-3 font-semibold">Date</th>
                  <th className="py-2.5 px-3 font-semibold">Billing Period</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CDBC]/40 dark:divide-[#2C2C26]">
                {billingHistory.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#EDE8DE]/30 dark:hover:bg-[#181915]/50 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#A0815A]">{inv.invoice_number}</td>
                    <td className="py-2.5 px-3 capitalize font-medium">{inv.plan_id}</td>
                    <td className="py-2.5 px-3 font-bold">₹{inv.total_amount?.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-[#57554F] dark:text-[#9E998E]">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-[#57554F] dark:text-[#9E998E]">
                      {inv.billing_period_start ? new Date(inv.billing_period_start).toLocaleDateString() : 'N/A'} -{' '}
                      {inv.billing_period_end ? new Date(inv.billing_period_end).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase">
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
