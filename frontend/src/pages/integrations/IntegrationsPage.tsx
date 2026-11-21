import React, { useEffect, useState } from 'react';
import { 
  Plug, CheckCircle2, AlertCircle, Copy, Check, ExternalLink, 
  Cpu, MessageSquare, Database, Workflow, ReceiptIndianRupee 
} from 'lucide-react';
import { api } from '../../api/client';

interface IntegrationCard {
  id: string;
  name: string;
  category: string;
  icon: any;
  status: 'connected' | 'active' | 'pending' | 'disconnected';
  badge: string;
  description: string;
  details?: Record<string, string>;
  docUrl?: string;
}

export const IntegrationsPage: React.FC = () => {
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<IntegrationCard | null>(null);

  useEffect(() => {
    api.get<any>('/integrations/status')
      .then((data) => {
        setStatusData(data);
      })
      .catch((err) => {
        console.warn('Could not fetch integrations status:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const integrationsList: IntegrationCard[] = [
    {
      id: 'gemini',
      name: 'Google Gemini AI Studio',
      category: 'AI Copilot Engine',
      icon: Cpu,
      status: 'active',
      badge: statusData?.gemini?.model || 'gemini-3.5-flash-lite',
      description: 'Multilingual NLP, natural Hinglish entity extraction, operations parsing, and audio voice-note processing.',
      details: {
        'Active Model': statusData?.gemini?.model || 'gemini-3.5-flash-lite',
        'Provider': 'Google AI Studio',
        'Capabilities': 'Multilingual, Intent Extraction, GST parsing',
        'Cost': '100% Free Developer Tier (Google)',
      },
      docUrl: 'https://aistudio.google.com/',
    },
    {
      id: 'whatsapp',
      name: 'Meta WhatsApp Cloud API',
      category: 'Messaging Channel',
      icon: MessageSquare,
      status: statusData?.whatsapp?.connected ? 'connected' : 'active',
      badge: statusData?.whatsapp?.connected ? 'Connected' : 'Free Sandbox Mode',
      description: 'Direct Cloud API v21.0 integration for real-time customer messaging, automated replies, and human takeover.',
      details: {
        'API Version': 'v21.0',
        'Callback URL': `${window.location.origin}/api/v1/webhooks/whatsapp`,
        'Verify Token': 'bizmate_webhook_verify_token_secure',
        'Free Quota': '1,000 service conversations/month free from Meta',
      },
      docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    },
    {
      id: 'database',
      name: 'PostgreSQL Relational DB',
      category: 'Multi-Tenant Data Store',
      icon: Database,
      status: 'connected',
      badge: 'Connected (bizmate)',
      description: 'ACID-compliant relational database with foreign key cascades, JSONB fields, and strict tenant isolation.',
      details: {
        'Database': 'bizmate',
        'Host': 'localhost:5432',
        'Driver': 'pg (node-postgres v8)',
        'Isolation': 'Tenant Row Scoped (businesses.id)',
      },
    },
    {
      id: 'n8n',
      name: 'n8n Automation Engine',
      category: 'Workflow Orchestrator',
      icon: Workflow,
      status: 'active',
      badge: 'Local Cluster Active',
      description: 'Low-code workflow orchestrator for async webhook events, payment escalation triggers, and manager alerts.',
      details: {
        'Webhook URL': 'http://localhost:5678/webhook',
        'Status': 'Listening for dispatched events',
        'Mode': 'Self-Hosted (Free)',
      },
      docUrl: 'https://n8n.io',
    },
    {
      id: 'gst',
      name: 'Indian GST Tax Engine',
      category: 'Billing & Compliance',
      icon: ReceiptIndianRupee,
      status: 'active',
      badge: '18% GST Configured',
      description: 'Automatic tax breakdown into 9% CGST + 9% SGST with subtotal derivation and unique invoice number generation.',
      details: {
        'CGST Rate': '9.0%',
        'SGST Rate': '9.0%',
        'Total GST': '18.0%',
        'Invoicing': 'Real-Time Transaction Ledger',
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#181915] dark:text-[#EDE8DE]">
          Integrations Hub
        </h1>
        <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-0.5">
          Real-time status and connection credentials for all external business APIs and infrastructure services.
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-[#A0815A] text-xs">Checking live service connections...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {integrationsList.map((item) => {
            const Icon = item.icon;
            const isConnected = item.status === 'connected' || item.status === 'active';
            return (
              <div 
                key={item.id} 
                className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] flex flex-col justify-between space-y-4 hover:border-[#A0815A]/60 transition"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="w-9 h-9 rounded-xl bg-[#A0815A]/10 text-[#A0815A] flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      isConnected 
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                      {item.badge}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-[#A0815A] block">
                      {item.category}
                    </span>
                    <h3 className="font-bold text-sm text-[#181915] dark:text-[#EDE8DE] mt-0.5">
                      {item.name}
                    </h3>
                    <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#D8CDBC] dark:border-[#2C2C26] flex gap-2">
                  <button 
                    onClick={() => setActiveModal(item)}
                    className="flex-1 py-1.5 bg-[#EDE8DE] dark:bg-[#181915] hover:bg-[#E1D2BB] dark:hover:bg-[#2C2C26] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg text-xs font-semibold text-[#181915] dark:text-[#EDE8DE] transition"
                  >
                    View Config
                  </button>
                  {item.docUrl && (
                    <a
                      href={item.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-[#EDE8DE] dark:bg-[#181915] hover:bg-[#E1D2BB] dark:hover:bg-[#2C2C26] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg text-[#57554F] dark:text-[#9E998E] transition"
                      title="Documentation"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Configuration Modal */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] p-6 rounded-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CDBC] dark:border-[#2C2C26] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#181915] dark:text-[#EDE8DE]">{activeModal.name}</h3>
                <span className="text-[10px] text-[#A0815A] font-mono">{activeModal.category}</span>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-xs text-[#57554F] dark:text-[#9E998E] hover:text-[#181915]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#57554F] dark:text-[#9E998E]">
              {activeModal.description}
            </p>

            {activeModal.details && (
              <div className="space-y-2 text-xs bg-[#EDE8DE] dark:bg-[#181915] p-3.5 rounded-xl border border-[#D8CDBC] dark:border-[#2C2C26]">
                {Object.entries(activeModal.details).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center text-[11px] gap-2">
                    <span className="text-[#57554F] dark:text-[#9E998E] shrink-0 font-medium">{key}:</span>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono text-[#181915] dark:text-[#EDE8DE] truncate">{value}</span>
                      {value.length > 8 && (
                        <button
                          onClick={() => handleCopy(value, key)}
                          className="p-1 hover:bg-[#D8CDBC] dark:hover:bg-[#2C2C26] rounded text-[#A0815A] shrink-0"
                          title="Copy to clipboard"
                        >
                          {copiedKey === key ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 bg-[#A0815A] text-white text-xs font-bold rounded-lg hover:bg-[#8C6F4B]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
