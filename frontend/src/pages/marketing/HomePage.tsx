import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, MessageSquare, Workflow, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

export const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#EDE8DE] dark:bg-[#181915] text-[#181915] dark:text-[#EDE8DE] font-sans selection:bg-[#A0815A] selection:text-white">
      {/* Top Marketing Bar */}
      <nav className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#A0815A] text-white font-black text-base flex items-center justify-center">B</div>
          <span className="font-bold text-lg tracking-tight">Bizmate</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-xs font-medium text-[#57554F] dark:text-[#9E998E]">
          <a href="#features" className="hover:text-[#A0815A]">Features</a>
          <a href="#industries" className="hover:text-[#A0815A]">Industries</a>
          <a href="#pricing" className="hover:text-[#A0815A]">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-xs font-semibold px-4 py-2 hover:text-[#A0815A]">Log In</Link>
          <Link to="/onboarding" className="text-xs font-semibold px-4 py-2 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-lg transition shadow-sm">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto text-center px-6 pt-16 pb-20 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#A0815A]/40 bg-[#A0815A]/10 text-[#A0815A] text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Multi-Industry AI Business Operating System</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-[#181915] dark:text-[#EDE8DE] leading-tight">
          Your Business. Smarter. Automated.
        </h1>
        <p className="text-sm md:text-base text-[#57554F] dark:text-[#9E998E] max-w-2xl mx-auto leading-relaxed">
          Manage customers, automate conversations and run your everyday business operations with intelligent AI agents.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <Link to="/onboarding" className="px-6 py-3 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md">
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/app/dashboard" className="px-6 py-3 bg-[#E1D2BB] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] text-[#181915] dark:text-[#EDE8DE] rounded-xl text-xs font-bold hover:border-[#A0815A] transition">
            Explore Platform
          </Link>
        </div>

        {/* Interactive Dashboard Preview Card */}
        <div className="mt-12 p-3 bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-2xl shadow-xl text-left">
          <div className="bg-[#EDE8DE] dark:bg-[#181915] p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CDBC] dark:border-[#2C2C26] pb-3">
              <span className="text-xs font-bold text-[#A0815A]">Hinglish Voice Extraction Demo</span>
              <span className="text-[10px] font-mono text-[#57554F] dark:text-[#9E998E]">WhatsApp Cloud API v21.0</span>
            </div>
            <p className="text-xs font-mono text-[#A0815A] bg-[#FFFFFF] dark:bg-[#20211D] p-3 rounded-lg border border-[#D8CDBC] dark:border-[#2C2C26]">
              "Kal 20 kg potatoes order karna, paneer ka stock check karna aur Rahul ka pending payment reminder bhejna."
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
              <div className="p-3 bg-[#FFFFFF] dark:bg-[#20211D] rounded-lg border border-[#D8CDBC] dark:border-[#2C2C26]">
                <span className="text-[#57554F] dark:text-[#9E998E]">Action 1</span>
                <p className="font-bold text-[#181915] dark:text-[#EDE8DE] mt-1">Order 20kg Potatoes</p>
                <span className="text-[10px] text-[#A0815A]">Staged for Approval</span>
              </div>
              <div className="p-3 bg-[#FFFFFF] dark:bg-[#20211D] rounded-lg border border-[#D8CDBC] dark:border-[#2C2C26]">
                <span className="text-[#57554F] dark:text-[#9E998E]">Action 2</span>
                <p className="font-bold text-[#181915] dark:text-[#EDE8DE] mt-1">Check Paneer Stock</p>
                <span className="text-[10px] text-amber-500">2.5kg (Low Stock)</span>
              </div>
              <div className="p-3 bg-[#FFFFFF] dark:bg-[#20211D] rounded-lg border border-[#D8CDBC] dark:border-[#2C2C26]">
                <span className="text-[#57554F] dark:text-[#9E998E]">Action 3</span>
                <p className="font-bold text-[#181915] dark:text-[#EDE8DE] mt-1">Payment Reminder</p>
                <span className="text-[10px] text-emerald-500">Rahul (₹4,500)</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
