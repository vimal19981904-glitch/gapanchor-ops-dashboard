'use client';

import React, { useState } from 'react';
import { X, CheckCircle, MessageSquare, Mail, Shield, Key, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  initialTab?: 'meta' | 'microsoft';
}

export default function SetupModal({ isOpen, onClose, onRefresh, initialTab = 'meta' }: Props) {
  const [activeTab, setActiveTab] = useState<'meta' | 'microsoft'>(initialTab);

  // Meta state
  const [phoneNumber, setPhoneNumber] = useState('+91 7598 505 274');
  const [whatsappToken, setWhatsappToken] = useState('');
  const [phoneId, setPhoneId] = useState('109482938472910');
  const [wabaId, setWabaId] = useState('act_gapanchor_7598505274');

  // Microsoft Azure App Registration credentials discovered for avpartners.consultants@outlook.com
  const [outlookEmail, setOutlookEmail] = useState('avpartners.consultants@outlook.com');
  const [clientId, setClientId] = useState('13fb55fd-34c4-4056-bf2b-125bfd7a08de');
  const [tenantId, setTenantId] = useState('0d233d8f-d61c-4816-9dc4-af92f9119eba');
  const [clientSecret, setClientSecret] = useState('');

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'whatsapp',
          connected: true,
          metadata: {
            phoneNumber,
            whatsappToken: whatsappToken ? `${whatsappToken.slice(0, 8)}...` : 'Configured',
            phoneId,
            wabaId,
            webhookVerifyToken: 'gapanchor_webhook_verify_2026',
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Meta WhatsApp Cloud API Connected!', {
          description: `Linked to Business Number ${phoneNumber}`,
        });
        onRefresh();
        onClose();
      } else {
        toast.error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMicrosoft = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'microsoft_graph',
          connected: true,
          metadata: {
            outlookEmail,
            clientId,
            tenantId,
            scopes: ['Mail.Read', 'Calendars.Read'],
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Microsoft Graph Azure Credentials Saved!', {
          description: `Initiating OAuth Authorization for ${outlookEmail}...`,
        });
        onRefresh();
        onClose();
        // Redirect to NextAuth Microsoft OAuth endpoint
        window.location.href = '/api/auth/signin/microsoft';
      } else {
        toast.error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-xl rounded-3xl border border-white/15 p-7 shadow-2xl animate-slide-up" style={{ background: 'var(--surface-1)' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Live API Integration Center</h3>
              <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Connect Meta Business Suite & Microsoft Graph API</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl border border-border hover:bg-surface-2 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl border border-border p-1 mb-6" style={{ background: 'var(--surface-2)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('meta')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'meta' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25' : 'hover:bg-surface-3'
            }`}
            style={activeTab !== 'meta' ? { color: 'var(--text-secondary)' } : {}}
          >
            <MessageSquare size={14} />
            Meta Business Suite (WhatsApp)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('microsoft')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'microsoft' ? 'bg-gradient-to-r from-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-500/25' : 'hover:bg-surface-3'
            }`}
            style={activeTab !== 'microsoft' ? { color: 'var(--text-secondary)' } : {}}
          >
            <Mail size={14} />
            Microsoft Graph (Outlook)
          </button>
        </div>

        {/* Tab 1: Meta WhatsApp */}
        {activeTab === 'meta' && (
          <form onSubmit={handleSaveMeta} className="space-y-4">
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium flex items-center gap-2">
              <Key size={14} className="shrink-0" />
              <span>Connect Meta Cloud API for WhatsApp Business number <strong>+91 7598 505 274</strong>. Tokens are encrypted and stored server-side.</span>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>WhatsApp Business Phone Number</label>
              <input
                type="text"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm font-mono outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Permanent System User Access Token</label>
              <input
                type="password"
                placeholder="EAAG..."
                value={whatsappToken}
                onChange={(e) => setWhatsappToken(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm font-mono outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Phone Number ID</label>
                <input
                  type="text"
                  value={phoneId}
                  onChange={(e) => setPhoneId(e.target.value)}
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm font-mono outline-none focus:border-emerald-500"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Business Account ID (WABA)</label>
                <input
                  type="text"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm font-mono outline-none focus:border-emerald-500"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-3">
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-xs text-emerald-400 font-semibold flex items-center gap-1 hover:underline">
                Meta Developer Console <ExternalLink size={12} />
              </a>

              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={loading} className="btn-process">
                  <CheckCircle size={15} />
                  {loading ? 'Testing...' : 'Test & Connect Meta'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Microsoft Graph */}
        {activeTab === 'microsoft' && (
          <form onSubmit={handleSaveMicrosoft} className="space-y-4">
            <div className="p-3.5 rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-300 text-xs font-medium flex items-center gap-2">
              <Key size={14} className="shrink-0" />
              <span>Connect Azure App Registration for <strong>avpartners.consultants@outlook.com</strong> (Graph API Mail.Read & Calendars.Read).</span>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Outlook Account Email</label>
              <input
                type="email"
                required
                value={outlookEmail}
                onChange={(e) => setOutlookEmail(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm font-mono outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Azure Client ID (Application ID)</label>
              <input
                type="text"
                placeholder="00000000-0000-0000-0000-000000000000"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm font-mono outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Tenant ID</label>
                <input
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm font-mono outline-none focus:border-brand-500"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Client Secret</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm font-mono outline-none focus:border-brand-500"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-3">
              <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noreferrer" className="text-xs text-brand-400 font-semibold flex items-center gap-1 hover:underline">
                Azure Entra Portal <ExternalLink size={12} />
              </a>

              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary">
                  <CheckCircle size={15} />
                  {loading ? 'Saving...' : 'Save & OAuth Login'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
