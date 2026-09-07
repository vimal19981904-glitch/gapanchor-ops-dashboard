'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Welcome back, ${data.user.name}!`);
        router.push('/enquiries');
      } else {
        toast.error(data.error || 'Login failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (empEmail: string) => {
    setEmail(empEmail);
    setPassword('employee123#password');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      <div className="w-full max-w-md glass-card p-8 rounded-3xl border border-white/10 shadow-2xl animate-fade-in backdrop-blur-xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-brand-500/20 border border-brand-500/40 text-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Lock size={28} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Team Member Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            GapAnchor Operations & Lead Intelligence Hub
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Employee Email</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="employee.a@gapanchor.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-500 focus:bg-white/10 transition-all"
              />
              <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-500 focus:bg-white/10 transition-all"
              />
              <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 text-white shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50 mt-6"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        {/* Quick Demo Accounts */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block mb-3">
            Quick Select Employee Accounts:
          </span>
          <div className="space-y-2">
            {[
              { name: 'Employee A (Manhattan WMS)', email: 'employee.a@gapanchor.com' },
              { name: 'Employee B (Blue Yonder & Kinaxis)', email: 'employee.b@gapanchor.com' },
              { name: 'Employee C (SAP S/4HANA)', email: 'employee.c@gapanchor.com' },
              { name: 'Arul Xavier (Master Admin)', email: 'admin@gapanchor.com' },
            ].map((acc, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setDemoAccount(acc.email)}
                className="w-full text-left p-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-xs transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-200">{acc.name}</div>
                  <div className="text-[10px] text-slate-400">{acc.email}</div>
                </div>
                <CheckCircle2 size={14} className="text-brand-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
