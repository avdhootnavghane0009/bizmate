import React, { useEffect, useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { api } from '../../api/client';
import { 
  Users, ShoppingBag, IndianRupee, Clock, Zap, ArrowUpRight, 
  Sparkles, CheckCircle2, AlertTriangle, PlusCircle, ArrowRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Link } from 'react-router-dom';

export const MainDashboard: React.FC = () => {
  const { business, industry, loading: businessLoading } = useBusiness();
  const { terminology } = industry;
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = () => {
    if (!business.id) return;
    setLoading(true);
    api.get<any>('/dashboard/metrics')
      .then((res) => {
        setData(res);
        setBackendOnline(true);
        setError(null);
      })
      .catch((err) => {
        console.warn("Backend metrics fetch error:", err);
        setBackendOnline(false);
        setError(err.message || "Failed connecting to backend.");
        // Genuinely empty fallback - zero fabricated statistics
        setData({
          kpis: {
            total_leads: 0,
            qualified_leads: 0,
            total_orders: 0,
            revenue_this_month: 0,
            pending_payments: 0,
            ai_handled_rate: 0,
            hours_saved: 0,
            has_conversations: false,
          },
          chartData: [
            { day: "Mon", revenue: 0 },
            { day: "Tue", revenue: 0 },
            { day: "Wed", revenue: 0 },
            { day: "Thu", revenue: 0 },
            { day: "Fri", revenue: 0 },
            { day: "Sat", revenue: 0 },
            { day: "Sun", revenue: 0 }
          ],
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMetrics();
  }, [business.id, business.industryId]);

  if (businessLoading || (loading && !data)) {
    return <div className="p-8 text-[#A0815A]">Connecting to BizMate database &amp; loading tenant context...</div>;
  }

  const kpis = data?.kpis || {
    total_leads: 0,
    qualified_leads: 0,
    total_orders: 0,
    revenue_this_month: 0,
    pending_payments: 0,
    ai_handled_rate: 0,
    hours_saved: 0,
    has_conversations: false,
  };

  const chartData = data?.chartData || [];
  const hasTransactions = chartData.some((d: any) => d.revenue > 0) || kpis.revenue_this_month > 0;
  const isCompletelyEmpty = kpis.total_leads === 0 && kpis.total_orders === 0 && kpis.revenue_this_month === 0;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#181915] dark:text-[#EDE8DE]">
            {business.name || 'My Business'}
          </h1>
          <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-0.5">
            Industry mode: <strong className="text-[#A0815A]">{industry.name}</strong> • Real Database Tenant
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
            backendOnline 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            {backendOnline ? "Live Database Connected" : "Connecting..."}
          </span>
          <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#E1D2BB] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] text-[#A0815A] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {kpis.hours_saved} hrs Saved
          </span>
        </div>
      </div>

      {/* Helpful Empty State for Brand New Businesses */}
      {isCompletelyEmpty && backendOnline && (
        <div className="p-4 rounded-xl bg-[#A0815A]/10 border border-[#A0815A]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#181915] dark:text-[#EDE8DE]">
              Welcome to your new {industry.name} workspace!
            </h3>
            <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-0.5">
              This tenant currently has 0 recorded transactions. Add your first {terminology.customer.toLowerCase()} or record an operation to see real-time performance analytics.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/app/crm"
              className="px-3 py-1.5 bg-[#A0815A] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-[#8C6F4B] transition"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add {terminology.customer}
            </Link>
            <Link
              to="/app/operations"
              className="px-3 py-1.5 bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] text-[#181915] dark:text-[#EDE8DE] rounded-lg text-xs font-semibold hover:border-[#A0815A] transition"
            >
              Record Order
            </Link>
          </div>
        </div>
      )}

      {/* 5 Dynamic KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26]">
          <span className="text-xs text-[#57554F] dark:text-[#9E998E]">Total {terminology.customer}s</span>
          <p className="text-2xl font-bold text-[#181915] dark:text-[#EDE8DE] mt-1">{kpis.total_leads}</p>
          <span className="text-[11px] text-[#A0815A] flex items-center gap-0.5 mt-1 font-mono">
            <ArrowUpRight className="w-3 h-3" /> {kpis.qualified_leads} Qualified
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26]">
          <span className="text-xs text-[#57554F] dark:text-[#9E998E]">{terminology.orderOrBooking}s</span>
          <p className="text-2xl font-bold text-[#181915] dark:text-[#EDE8DE] mt-1">{kpis.total_orders}</p>
          <span className="text-[11px] text-[#57554F] dark:text-[#9E998E] mt-1 block">Live Recorded</span>
        </div>

        <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26]">
          <span className="text-xs text-[#57554F] dark:text-[#9E998E]">Monthly Revenue</span>
          <p className="text-2xl font-bold text-emerald-500 mt-1">₹{Number(kpis.revenue_this_month).toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-[#57554F] dark:text-[#9E998E] mt-1 block">Pending: ₹{Number(kpis.pending_payments).toLocaleString('en-IN')}</span>
        </div>

        <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26]">
          <span className="text-xs text-[#57554F] dark:text-[#9E998E]">AI Autopilot Rate</span>
          <p className="text-2xl font-bold text-[#A0815A] mt-1">
            {kpis.has_conversations ? `${kpis.ai_handled_rate}%` : '0%'}
          </p>
          <span className="text-[11px] text-[#57554F] dark:text-[#9E998E] mt-1 flex items-center gap-1 font-mono">
            {kpis.has_conversations ? <><Sparkles className="w-3 h-3 text-emerald-500" /> Active</> : 'Not enough data yet'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26]">
          <span className="text-xs text-[#57554F] dark:text-[#9E998E]">Live Industry Mode</span>
          <p className="text-xl font-bold text-[#181915] dark:text-[#EDE8DE] mt-1 truncate">{industry.name}</p>
          <span className="text-[11px] text-[#57554F] dark:text-[#9E998E] mt-1 block font-mono">
            {industry.terminology.catalogItem}: {industry.terminology.unit}
          </span>
        </div>
      </div>

      {/* Chart & AI Activity Feed */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Revenue Performance Chart */}
        <div className="md:col-span-2 p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#181915] dark:text-[#EDE8DE]">Revenue Velocity (Last 7 Days)</h2>
              <p className="text-xs text-[#57554F] dark:text-[#9E998E]">Database-aggregated transaction totals in INR</p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#E1D2BB] dark:bg-[#302D27] text-[#A0815A]">
              Live DB
            </span>
          </div>

          {!hasTransactions ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#D8CDBC] dark:border-[#2C2C26] rounded-xl">
              <p className="text-xs font-semibold text-[#57554F] dark:text-[#9E998E]">
                No transaction records found for this period.
              </p>
              <p className="text-[11px] text-[#57554F] dark:text-[#9E998E] mt-1 max-w-sm">
                Your daily revenue chart will automatically populate as completed orders and paid invoices are recorded in the Operations module.
              </p>
              <Link
                to="/app/operations"
                className="mt-3 text-xs text-[#A0815A] font-semibold hover:underline flex items-center gap-1"
              >
                Create your first transaction <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A0815A" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#A0815A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8CDBC" opacity={0.3} />
                  <XAxis dataKey="day" stroke="#9E998E" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9E998E" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#20211D', borderColor: '#2C2C26', borderRadius: '8px', fontSize: '11px', color: '#EDE8DE' }}
                    formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#A0815A" strokeWidth={2} fillOpacity={1} fill="url(#revenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Live Multi-Industry Quick Actions */}
        <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#181915] dark:text-[#EDE8DE]">{industry.name} Workflows</h2>
            <Sparkles className="w-4 h-4 text-[#A0815A]" />
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] space-y-1">
              <span className="font-semibold text-[#A0815A] block">Configured Terminology</span>
              <p className="text-[11px] text-[#57554F] dark:text-[#9E998E]">
                Customers: <strong>{terminology.customer}</strong><br />
                Bookings/Orders: <strong>{terminology.orderOrBooking}</strong><br />
                Item Catalog: <strong>{terminology.catalogItem}</strong>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] space-y-1">
              <span className="font-semibold text-[#A0815A] block">Sample Voice/Text Prompt</span>
              <p className="text-[11px] italic text-[#57554F] dark:text-[#9E998E]">
                "{industry.sampleVoicePrompt}"
              </p>
              <Link
                to="/app/ai"
                className="mt-2 text-[11px] text-[#A0815A] font-semibold flex items-center gap-1 hover:underline pt-1"
              >
                Test in AI Copilot <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="pt-2">
              <Link
                to="/app/operations"
                className="w-full py-2 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Record New {terminology.orderOrBooking}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
