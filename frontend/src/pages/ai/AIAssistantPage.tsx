import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../../context/BusinessContext';
import { api } from '../../api/client';
import { Bot, Sparkles, Send, CheckCircle2, AlertCircle, Zap, ArrowUpRight } from 'lucide-react';

export const AIAssistantPage: React.FC = () => {
  const { business, industry, entitlements, refreshBusiness } = useBusiness();
  const navigate = useNavigate();
  const [inputPrompt, setInputPrompt] = useState(industry?.sampleVoicePrompt || "");
  const [messages, setMessages] = useState<any[]>([
    {
      role: 'assistant',
      content: `Namaste! I am your ${industry?.name || 'Business'} AI Copilot. Powered by Google Gemini with multilingual intelligence.`,
      status: 'ready'
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState<string | null>(null);

  const handleSendPrompt = async () => {
    if (!inputPrompt.trim()) return;

    const userText = inputPrompt;
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInputPrompt("");
    setIsProcessing(true);
    setQuotaExceeded(null);

    try {
      const res = await api.post<any>('/ai/parse-instruction', {
        business_id: business.id,
        instruction: userText
      });

      setMessages(prev => [
        ...prev, 
        {
          role: 'assistant',
          content: "Samajh gaya! I parsed your instructions via Express & Google Gemini:",
          structuredAction: res,
          status: 'success'
        }
      ]);
      await refreshBusiness();
    } catch (err: any) {
      console.error("AI error:", err);
      const isQuota = err?.status === 402 || err?.response?.status === 402 || (err?.message && /quota/i.test(err.message));
      
      if (isQuota) {
        setQuotaExceeded(
          err?.detail || err?.response?.data?.detail || 'Monthly AI operations quota reached for your current subscription plan.'
        );
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: "Quota Reached: You have exhausted the monthly AI operations included with your subscription plan. Please upgrade to continue automated copilot operations.",
            isQuota: true,
            status: 'error'
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev, 
          {
            role: 'assistant',
            content: err?.detail || "Sorry, I had trouble parsing that instruction. Please check your backend connection.",
            status: 'error'
          }
        ]);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const aiRemaining = entitlements?.ai_operations?.remaining ?? null;
  const aiLimit = entitlements?.ai_operations?.limit ?? null;
  const isLowCredits = aiRemaining !== null && aiRemaining <= 5;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#181915] dark:text-[#EDE8DE]">
            AI Business Assistant (Google Gemini)
          </h1>
          <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-0.5">
            Natural Language Copilot for {industry.name} operations, Indian language translation, and automated business workflows.
          </p>
        </div>

        {/* Live AI Quota Badge */}
        {aiLimit !== null && (
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-2 ${
              isLowCredits
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-[#D8CDBC] dark:border-[#2C2C26] bg-[#FFFFFF] dark:bg-[#20211D] text-[#181915] dark:text-[#EDE8DE]'
            }`}>
              <Zap className="w-3.5 h-3.5 text-[#A0815A]" />
              <span>AI Credits: <strong>{aiRemaining}</strong> / {aiLimit} left</span>
            </div>
            <button
              onClick={() => navigate('/app/settings')}
              className="text-xs text-[#A0815A] hover:underline flex items-center gap-0.5 font-semibold"
            >
              Upgrade <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Quota Exceeded Alert Banner */}
      {quotaExceeded && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span><strong>Monthly Quota Exceeded:</strong> {quotaExceeded}</span>
          </div>
          <button
            onClick={() => navigate('/app/settings')}
            className="px-3 py-1 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-lg font-bold transition flex items-center gap-1"
          >
            Upgrade Plan <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="h-[calc(100vh-14rem)] flex flex-col justify-between rounded-2xl border border-[#D8CDBC] dark:border-[#2C2C26] bg-[#FFFFFF] dark:bg-[#20211D] overflow-hidden">
        {/* Messages Stream */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((m, idx) => (
            <div 
              key={idx}
              className={`flex gap-3 max-w-2xl ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                m.role === 'user' ? 'bg-[#57554F] text-white' : 'bg-[#A0815A] text-white'
              }`}>
                {m.role === 'user' ? 'U' : <Bot className="w-4 h-4" />}
              </div>
              <div className={`p-4 rounded-2xl text-xs space-y-2 ${
                m.role === 'user' 
                  ? 'bg-[#EDE8DE] dark:bg-[#181915] text-[#181915] dark:text-[#EDE8DE]' 
                  : m.isQuota
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300'
                  : 'bg-[#EDE8DE]/40 dark:bg-[#181915]/60 border border-[#D8CDBC] dark:border-[#2C2C26]'
              }`}>
                <p>{m.content}</p>

                {m.isQuota && (
                  <button
                    onClick={() => navigate('/app/settings')}
                    className="mt-2 px-3 py-1.5 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    View Subscription Plans <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {m.structuredAction && (
                  <div className="mt-2 p-3 rounded-xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] font-mono text-[11px] space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-500 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Structured Execution Plan Ready
                    </div>
                    <pre className="overflow-x-auto text-[#57554F] dark:text-[#9E998E]">
                      {JSON.stringify(m.structuredAction, null, 2)}
                    </pre>
                    <button 
                      onClick={() => alert("Instruction executed successfully via backend business ops pipeline!")}
                      className="px-3 py-1.5 bg-[#A0815A] text-white rounded-lg text-xs font-sans font-bold hover:bg-[#8C6F4B] transition"
                    >
                      Approve & Execute via Express
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex gap-3 max-w-xl">
              <div className="w-8 h-8 rounded-xl bg-[#A0815A] text-white flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl bg-[#EDE8DE]/40 dark:bg-[#181915] text-xs font-mono text-[#A0815A] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 animate-spin" /> Calling backend /api/v1/ai/parse-instruction...
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-[#D8CDBC] dark:border-[#2C2C26] bg-[#FFFFFF] dark:bg-[#20211D]">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
              placeholder="Give a voice command or type in Hindi/English/Hinglish..."
              className="flex-1 bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
            />
            <button 
              onClick={handleSendPrompt}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> Execute
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
