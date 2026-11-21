import React, { useEffect, useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { Plus, Tag, Phone, UserX } from 'lucide-react';
import { api } from '../../api/client';

const STAGES = ["New", "Contacted", "Qualified", "Negotiation", "Converted", "Lost"];

interface LeadItem {
  id: string;
  name: string;
  phone: string;
  score: number;
  stage: string;
  value: number;
}

export const CRMPipelinePage: React.FC = () => {
  const { business, industry } = useBusiness();
  const { terminology } = industry;

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newStage, setNewStage] = useState("New");
  const [newValue, setNewValue] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const fetchLeads = () => {
    if (!business.id) return;
    setLoading(true);
    api.get<any[]>('/crm/customers')
      .then((data) => {
        if (Array.isArray(data)) {
          setLeads(data.map((item) => ({
            id: String(item.id),
            name: item.name,
            phone: item.phone,
            score: item.score || 75,
            stage: item.stage || 'New',
            value: Number(item.value) || 0,
          })));
        } else {
          setLeads([]);
        }
      })
      .catch((err) => {
        console.warn("CRM customer fetch error:", err);
        setLeads([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeads();
  }, [business.id]);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.post<any>('/crm/customers', {
        name: newName.trim(),
        phone: newPhone.trim(),
        stage: newStage,
        value: parseFloat(newValue) || 0,
        score: 80,
      });

      if (res && res.id) {
        setLeads((prev) => [
          {
            id: String(res.id),
            name: res.name,
            phone: res.phone,
            score: res.score || 80,
            stage: res.stage || newStage,
            value: parseFloat(res.value) || 0,
          },
          ...prev,
        ]);
      }
      setShowAddModal(false);
      setNewName("");
      setNewPhone("");
      setNewValue("0");
      setQuotaError(null);
    } catch (err: any) {
      console.error("Error creating customer in database:", err);
      setQuotaError(err?.detail || err?.message || 'Quota limit reached or failed creating customer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#181915] dark:text-[#EDE8DE]">
            {terminology.customer} CRM &amp; Pipeline
          </h1>
          <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-0.5">
            Real customer records for {business.name || 'your business'}. Isolated per tenant in PostgreSQL.
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add {terminology.customer}
        </button>
      </div>

      {quotaError && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-[#181915] dark:text-[#EDE8DE] flex items-center justify-between">
          <div className="text-xs">
            <strong className="text-rose-600 dark:text-rose-400 font-bold block">CRM Contact Quota Reached</strong>
            <span className="text-[#57554F] dark:text-[#9E998E]">{quotaError}</span>
          </div>
          <a
            href="/app/settings"
            className="text-xs font-bold text-white bg-[#A0815A] hover:bg-[#8C6F4B] px-3 py-1.5 rounded-lg transition"
          >
            Upgrade Plan
          </a>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] p-6 rounded-2xl max-w-sm w-full space-y-4">
            <h3 className="font-bold text-sm">Add New {terminology.customer}</h3>
            <form onSubmit={handleAddLead} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Full Name *</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  required 
                  className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2 focus:outline-none focus:border-[#A0815A]"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Phone Number *</label>
                <input 
                  type="text" 
                  value={newPhone} 
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  required 
                  className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2 focus:outline-none focus:border-[#A0815A]"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Pipeline Stage</label>
                <select 
                  value={newStage} 
                  onChange={(e) => setNewStage(e.target.value)}
                  className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2 focus:outline-none focus:border-[#A0815A]"
                >
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Expected / Outstanding Value (₹)</label>
                <input 
                  type="number" 
                  value={newValue} 
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2 focus:outline-none focus:border-[#A0815A]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#A0815A] text-white font-bold rounded-lg hover:bg-[#8C6F4B] disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : `Save ${terminology.customer}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-[#A0815A] text-xs">Loading {terminology.customer} records from PostgreSQL...</div>
      ) : leads.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-[#D8CDBC] dark:border-[#2C2C26] rounded-2xl bg-[#FFFFFF] dark:bg-[#20211D] space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#A0815A]/10 text-[#A0815A] flex items-center justify-center mx-auto">
            <UserX className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-[#181915] dark:text-[#EDE8DE]">No {terminology.customer}s Yet</h3>
          <p className="text-xs text-[#57554F] dark:text-[#9E998E] max-w-sm mx-auto">
            This business workspace has no customer records. Click the button below to add your first {terminology.customer.toLowerCase()}.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add First {terminology.customer}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage.toLowerCase() === stage.toLowerCase());
            return (
              <div 
                key={stage} 
                className="bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-xl p-3 min-w-[200px] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#D8CDBC] dark:border-[#2C2C26] pb-2 mb-3">
                    <span className="font-bold text-xs">{stage}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EDE8DE] dark:bg-[#181915] font-mono">
                      {stageLeads.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {stageLeads.map((item) => (
                      <div 
                        key={item.id} 
                        className="p-2.5 rounded-lg bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs truncate">{item.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#A0815A]/20 text-[#A0815A]">
                            {item.score}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#57554F] dark:text-[#9E998E]">
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {item.phone}</span>
                          <span className="font-bold text-emerald-500 font-mono">₹{item.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
