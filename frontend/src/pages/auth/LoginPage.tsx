import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useBusiness } from '../../context/BusinessContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setBusinessProfile } = useBusiness();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post<{
        access_token: string;
        token_type: string;
        user: any;
        business: any;
      }>('/auth/login', {
        email: email.trim(),
        password,
      });

      if (res?.access_token && res?.business) {
        localStorage.setItem('bizmate_auth_token', res.access_token);
        localStorage.setItem('bizmate_business', JSON.stringify(res.business));
        setBusinessProfile(res.business);
        navigate('/app/dashboard');
      } else {
        setError('Authentication succeeded but business profile was not received.');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen bg-[#EDE8DE] dark:bg-[#181915] flex items-center justify-center p-6 text-[#181915] dark:text-[#EDE8DE]">
      <div className="w-full max-w-sm bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] p-8 rounded-2xl shadow-xl space-y-6">
        <div className="text-center space-y-1">
          <div className="w-10 h-10 rounded-xl bg-[#A0815A] text-white font-black text-lg mx-auto flex items-center justify-center mb-3">
            B
          </div>
          <h2 className="text-xl font-bold tracking-tight">Log in to Bizmate</h2>
          <p className="text-xs text-[#57554F] dark:text-[#9E998E]">Dynamic Multi-Tenant AI Business OS</p>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Business Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. owner@spicybistro.com"
              required
              className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2.5 focus:outline-none focus:border-[#A0815A]"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2.5 focus:outline-none focus:border-[#A0815A]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#A0815A] hover:bg-[#8C6F4B] text-white font-bold rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="pt-2 border-t border-[#D8CDBC] dark:border-[#2C2C26] space-y-2">
          <p className="text-[11px] text-[#57554F] dark:text-[#9E998E] text-center">Quick Demo Account:</p>
          <button
            type="button"
            onClick={() => handleQuickDemo('owner@spicybistro.com', 'password123')}
            className="w-full py-1.5 px-2 bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded text-[11px] font-mono text-[#A0815A] hover:border-[#A0815A]"
          >
            Fill Demo: owner@spicybistro.com
          </button>
        </div>

        <p className="text-center text-xs text-[#57554F] dark:text-[#9E998E]">
          Don't have a business account?{' '}
          <Link to="/onboarding" className="text-[#A0815A] font-semibold hover:underline">
            Register New Business
          </Link>
        </p>
      </div>
    </div>
  );
};
