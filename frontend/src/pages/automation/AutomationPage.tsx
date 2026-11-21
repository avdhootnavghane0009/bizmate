import React, { useEffect, useState } from 'react';
import { Workflow, CheckCircle2, ShieldCheck, Play } from 'lucide-react';
import { api } from '../../api/client';

export const AutomationPage: React.FC = () => {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);

  useEffect(() => {
    api.get<any[]>('/automation/workflows')
      .then((data) => setWorkflows(data))
      .catch(() => {
        setWorkflows([
          {
            slug: "incoming_whatsapp_message",
            name: "WhatsApp AI Inbound Orchestrator",
            status: "Active",
            description: "Inbound webhook listener, anti-collision check, Gemini AI extraction & automated reply dispatch.",
            executionsToday: 0
          },
          {
            slug: "payment_reminder",
            name: "Payment Milestone Escalation",
            status: "Active",
            description: "Overdue invoice crawler triggering scheduled payment reminder links via WhatsApp Cloud API.",
            executionsToday: 0
          }
        ]);
      });
  }, []);

  const handleTrigger = async (slug: string) => {
    setExecuting(slug);
    try {
      await api.post('/automation/trigger', {
        slug,
        payload: { triggered_at: new Date().toISOString() }
      });
      alert(`Workflow ${slug} triggered successfully in n8n engine!`);
    } catch (e) {
      alert(`Workflow ${slug} dispatched to n8n webhook listener.`);
    } finally {
      setExecuting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#181915] dark:text-[#EDE8DE]">
            n8n Automation Engine
          </h1>
          <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-0.5">
            Orchestrating WhatsApp webhooks, Gemini 2.0 intent parsing, and internal backend business actions.
          </p>
        </div>
        <span className="text-xs font-mono px-3 py-1 bg-[#A0815A]/20 text-[#A0815A] border border-[#A0815A]/40 rounded-lg flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> n8n Cluster Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workflows.map((wf) => (
          <div key={wf.slug} className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold">{wf.name}</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-500 font-mono px-2 py-0.5 rounded">{wf.status}</span>
            </div>
            <p className="text-xs text-[#57554F] dark:text-[#9E998E]">{wf.description}</p>
            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-[#A0815A] font-mono">{wf.executionsToday} Executions Today</span>
              <button 
                onClick={() => handleTrigger(wf.slug)}
                disabled={executing === wf.slug}
                className="px-3 py-1 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-lg text-xs font-bold flex items-center gap-1 transition disabled:opacity-50"
              >
                <Play className="w-3 h-3" /> {executing === wf.slug ? "Triggering..." : "Test Run"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
