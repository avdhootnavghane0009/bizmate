import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SUPPORTED_INDUSTRIES } from '../../config/industries';
import { useBusiness } from '../../context/BusinessContext';
import { ArrowRight, CheckCircle2, Building, Mail, Lock, Phone, User } from 'lucide-react';
import { api } from '../../api/client';

export const OnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const { setBusinessProfile } = useBusiness();
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('restaurants');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFinish = async () => {
    if (!businessName || !email || !password) {
      setError('Please fill in business name, email, and password.');
      setStep(1);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post<{
        business_id: string;
        access_token: string;
        user: any;
        business: any;
      }>('/onboarding/register', {
        business_name: businessName.trim(),
        industry_id: selectedIndustry,
        phone_number: phone.trim(),
        email: email.trim(),
        password,
        owner_name: ownerName.trim() || 'Store Owner',
      });

      if (res?.access_token && res?.business) {
        localStorage.setItem('bizmate_auth_token', res.access_token);
        localStorage.setItem('bizmate_business', JSON.stringify(res.business));
        setBusinessProfile(res.business);
        navigate('/app/dashboard');
      } else {
        setError('Registration completed but session could not be established.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed registering business. Please verify your details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE8DE] dark:bg-[#181915] text-[#181915] dark:text-[#EDE8DE] flex flex-col justify-between p-6 md:p-12">
      <div className="max-w-3xl mx-auto w-full space-y-8">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-[#57554F] dark:text-[#9E998E]">
            <span>Step {step} of 3</span>
            <span>{step === 1 ? 'Business Credentials' : step === 2 ? 'Select Industry' : 'Review & Launch'}</span>
          </div>
          <div className="h-1 bg-[#D8CDBC] dark:bg-[#2C2C26] rounded-full overflow-hidden">
            <div className="h-full bg-[#A0815A] transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }}></div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
            {error}
          </div>
        )}

        {/* Step 1: Business & Owner Details */}
        {step === 1 && (
          <div className="bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] p-8 rounded-2xl space-y-5">
            <div>
              <h2 className="text-xl font-bold">Register Your Business</h2>
              <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-1">
                Create your independent tenant account. Each business has isolated data and custom workflows.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Business / Brand Name *</label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3 top-3 text-[#57554F] dark:text-[#9E998E]" />
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Bella Pasta Restaurant, Glow Spa & Salon"
                    required
                    className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2.5 pl-9 text-sm focus:outline-none focus:border-[#A0815A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold block mb-1">Your Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-[#57554F] dark:text-[#9E998E]" />
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2.5 pl-9 text-sm focus:outline-none focus:border-[#A0815A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-[#57554F] dark:text-[#9E998E]" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2.5 pl-9 text-sm focus:outline-none focus:border-[#A0815A]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold block mb-1">Business Email *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-[#57554F] dark:text-[#9E998E]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@mybusiness.com"
                      required
                      className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2.5 pl-9 text-sm focus:outline-none focus:border-[#A0815A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-[#57554F] dark:text-[#9E998E]" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2.5 pl-9 text-sm focus:outline-none focus:border-[#A0815A]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!businessName.trim() || !email.trim() || !password.trim()) {
                  setError('Please fill in business name, email, and password.');
                  return;
                }
                setError(null);
                setStep(2);
              }}
              className="px-6 py-2.5 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-lg text-xs font-bold flex items-center gap-2 transition"
            >
              Next: Choose Industry <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: 10 Industries Grid */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">Select Your Industry</h2>
              <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-1">
                Configures industry-specific AI rules, terminology, KPIs, and operational workflows.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
              {Object.values(SUPPORTED_INDUSTRIES).map((ind) => (
                <div
                  key={ind.id}
                  onClick={() => setSelectedIndustry(ind.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    selectedIndustry === ind.id
                      ? 'border-[#A0815A] bg-[#A0815A]/10 ring-1 ring-[#A0815A]'
                      : 'border-[#D8CDBC] dark:border-[#2C2C26] bg-[#FFFFFF] dark:bg-[#20211D] hover:border-[#A0815A]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{ind.name}</span>
                    {selectedIndustry === ind.id && <CheckCircle2 className="w-4 h-4 text-[#A0815A]" />}
                  </div>
                  <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-1">{ind.tagline}</p>
                  <div className="mt-2 text-[10px] font-mono text-[#A0815A]">
                    Customer: {ind.terminology.customer} • Orders/Bookings: {ind.terminology.orderOrBooking}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg text-xs font-bold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-2.5 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-lg text-xs font-bold flex items-center gap-2 transition"
              >
                Next: Review & Launch <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Finish */}
        {step === 3 && (
          <div className="bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] p-8 rounded-2xl space-y-6">
            <div>
              <h2 className="text-xl font-bold">Ready to Launch BizMate</h2>
              <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-1">
                Your new business environment will be created in PostgreSQL with full tenant isolation.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#57554F] dark:text-[#9E998E]">Business Name:</span>
                <span className="font-bold">{businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#57554F] dark:text-[#9E998E]">Industry Mode:</span>
                <span className="font-bold text-[#A0815A]">{SUPPORTED_INDUSTRIES[selectedIndustry]?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#57554F] dark:text-[#9E998E]">Admin Email:</span>
                <span className="font-bold">{email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#57554F] dark:text-[#9E998E]">Terminology:</span>
                <span>
                  {SUPPORTED_INDUSTRIES[selectedIndustry]?.terminology.customer}s &amp;{' '}
                  {SUPPORTED_INDUSTRIES[selectedIndustry]?.terminology.orderOrBooking}s
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg text-xs font-bold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="px-8 py-2.5 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? 'Creating Business Environment...' : 'Launch Business Dashboard'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-[#57554F] dark:text-[#9E998E]">
        © 2026 BizMate AI Business OS • Strict Multi-Tenant Architecture
      </div>
    </div>
  );
};
