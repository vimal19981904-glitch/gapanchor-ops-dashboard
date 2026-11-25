'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield, Key, Users, UserPlus, Check, X, Lock, Unlock,
  RefreshCw, Eye, EyeOff, Search, Clock,
  ArrowLeft, UserCheck, Trash2,
  Calendar, DollarSign, MessageSquare, Briefcase, BarChart3, GraduationCap,
  SlidersHorizontal, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { SYSTEM_MODULES, MASTER_ADMIN_EMAIL } from '@/lib/auth/rbac-constants';
import { NavDrawerButton } from '@/components/NavigationContext';

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  assignedCourse: string | null;
  allowedUIs: string[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    assignedEnquiries: number;
  };
}

interface AuditLogItem {
  id: string;
  actorEmail: string;
  actorName: string;
  action: string;
  targetEmail: string | null;
  details: any;
  ipAddress: string | null;
  createdAt: string;
}

const COURSES = [
  'Manhattan WMS',
  'Blue Yonder',
  'Kinaxis',
  'SAP S/4HANA',
  'General Supply Chain',
];

export default function CredentialsManagementPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [searchQuery, setSearchQuery] = useState('');

  // Slide-over / Modal editing state
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [draftName, setDraftName] = useState<string>('');
  const [draftEmail, setDraftEmail] = useState<string>('');
  const [draftRole, setDraftRole] = useState<string>('employee');
  const [draftAllowedUIs, setDraftAllowedUIs] = useState<string[]>([]);
  const [draftCourse, setDraftCourse] = useState<string>('Manhattan WMS');
  const [draftIsActive, setDraftIsActive] = useState<boolean>(true);
  const [draftPassword, setDraftPassword] = useState<string>('');
  const [showDraftPassword, setShowDraftPassword] = useState<boolean>(false);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Add Employee Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    assignedCourse: 'Manhattan WMS',
    role: 'employee',
  });
  const [addingUser, setAddingUser] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);

  // Fetch users and audit log
  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, auditRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/audit'),
      ]);

      const usersJson = await usersRes.json();
      const auditJson = await auditRes.json();

      if (usersJson.success) {
        setUsers(usersJson.users || []);
      } else {
        toast.error(usersJson.error || 'Failed to load user accounts.');
      }

      if (auditJson.success) {
        setAuditLogs(auditJson.logs || []);
      }
    } catch (err: any) {
      toast.error('Network error loading credentials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.assignedCourse && u.assignedCourse.toLowerCase().includes(q))
    );
  });

  // Open Manage view for a user
  const handleOpenEdit = (user: UserAccount) => {
    setEditingUser(user);
    setDraftName(user.name);
    setDraftEmail(user.email);
    setDraftRole(user.role);
    setDraftAllowedUIs(
      user.email.toLowerCase() === MASTER_ADMIN_EMAIL
        ? ['*']
        : Array.isArray(user.allowedUIs)
        ? [...user.allowedUIs]
        : ['enquiries']
    );
    setDraftCourse(user.assignedCourse || 'Manhattan WMS');
    setDraftIsActive(user.isActive);
    setDraftPassword('');
    setShowDraftPassword(false);
  };

  // Close editing view
  const handleCloseEdit = () => {
    setEditingUser(null);
    setDraftPassword('');
    setShowDraftPassword(false);
  };

  // Toggle module permission in draft (fully unlocks/locks each module individually)
  const handleToggleDraftPermission = (moduleId: string) => {
    if (!editingUser) return;
    if (editingUser.email.toLowerCase() === MASTER_ADMIN_EMAIL) {
      toast.info('Master Admin has unrestricted access to all modules.');
      return;
    }

    setDraftAllowedUIs((prev) => {
      if (prev.includes(moduleId)) {
        return prev.filter((m) => m !== moduleId);
      } else {
        return [...prev, moduleId];
      }
    });
  };

  const handleGrantAllModules = () => {
    if (editingUser?.email.toLowerCase() === MASTER_ADMIN_EMAIL) return;
    setDraftAllowedUIs(SYSTEM_MODULES.map((m) => m.id));
  };

  const handleLockAllModules = () => {
    if (editingUser?.email.toLowerCase() === MASTER_ADMIN_EMAIL) return;
    setDraftAllowedUIs([]);
  };

  // Explicitly Save confirmed changes
  const handleSaveConfirmedChanges = async () => {
    if (!editingUser) return;

    if (!draftName.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }

    if (!draftEmail.trim() || !draftEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    try {
      setSavingEdit(true);

      const payload: any = {
        id: editingUser.id,
        name: draftName.trim(),
        email: draftEmail.trim(),
        role: draftRole,
        allowedUIs: draftAllowedUIs,
        assignedCourse: draftCourse,
        isActive: draftIsActive,
      };

      if (draftPassword.trim()) {
        if (draftPassword.trim().length < 4) {
          toast.error('Password must be at least 4 characters.');
          setSavingEdit(false);
          return;
        }
        payload.password = draftPassword.trim();
      }

      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Saved changes for ${draftName.trim()}`);
        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? { ...u, ...json.user } : u))
        );
        handleCloseEdit();
      } else {
        toast.error(json.error || 'Failed to save changes.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving user changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete employee account
  const handleDeleteUser = async (user: UserAccount) => {
    if (user.email.toLowerCase() === MASTER_ADMIN_EMAIL) {
      toast.error('Master Admin cannot be deleted.');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete the account for ${user.name} (${user.email})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users?id=${user.id}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Account for ${user.name} deleted.`);
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        if (editingUser?.id === user.id) {
          handleCloseEdit();
        }
      } else {
        toast.error(json.error || 'Failed to delete account.');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Add new employee
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.name || !newUserData.email || !newUserData.password) {
      toast.error('Please fill in all required fields.');
      return;
    }

    try {
      setAddingUser(true);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Account created for ${json.user.name}`);
        setUsers((prev) => [...prev, json.user]);
        setShowAddModal(false);
        setNewUserData({
          name: '',
          email: '',
          password: '',
          assignedCourse: 'Manhattan WMS',
          role: 'employee',
        });
      } else {
        toast.error(json.error || 'Failed to create user account.');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAddingUser(false);
    }
  };

  const getModuleIcon = (id: string) => {
    switch (id) {
      case 'enquiries': return <MessageSquare className="w-3.5 h-3.5" />;
      case 'calendar': return <Calendar className="w-3.5 h-3.5" />;
      case 'training': return <GraduationCap className="w-3.5 h-3.5" />;
      case 'finance': return <DollarSign className="w-3.5 h-3.5" />;
      case 'ops': return <BarChart3 className="w-3.5 h-3.5" />;
      case 'job-support': return <Briefcase className="w-3.5 h-3.5" />;
      default: return <Shield className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-brand-500/30">
      {/* Top Header - Restrained, clean layout */}
      <header className="sticky top-0 z-40 bg-[#090c13]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/enquiries"
              className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition text-slate-400 hover:text-white"
              title="Return to Enquiries"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">Credentials & Access Control</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/[0.06] text-slate-300 border border-white/[0.1]">
                  Master Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Manage employee accounts, UI permissions, passwords & audit log</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/15 text-white text-xs font-semibold transition cursor-pointer shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5 text-slate-300" />
              <span>Add Employee</span>
            </button>
            <NavDrawerButton />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Compact KPI Row - Minimal & Subdued */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-slate-900/60 border border-white/[0.08] p-3.5">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Total Accounts</span>
              <Users className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-white">{users.length}</div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">1 Master Admin • {users.filter(u => u.role === 'employee').length} Employees</div>
          </div>

          <div className="rounded-xl bg-slate-900/60 border border-white/[0.08] p-3.5">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Active Status</span>
              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400">
              {users.filter(u => u.isActive).length}
            </div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">
              {users.filter(u => !u.isActive).length} deactivated
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/60 border border-white/[0.08] p-3.5">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Assigned Enquiries</span>
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-white">
              {users.reduce((acc, u) => acc + (u._count?.assignedEnquiries || 0), 0)}
            </div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">Distributed across team</div>
          </div>

          <div className="rounded-xl bg-slate-900/60 border border-white/[0.08] p-3.5">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Audit Events</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-white">{auditLogs.length}</div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">Security actions recorded</div>
          </div>
        </div>

        {/* Tab Selection & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Employees & Access</span>
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Audit Trail ({auditLogs.length})</span>
            </button>
          </div>

          <div className="relative min-w-[240px] sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="search_filter_query_no_autofill"
              id="search_filter_query_no_autofill"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              placeholder="Search by name, email, or course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
            />
          </div>
        </div>

        {/* Tab 1: Clean, Compact Employee List / Table */}
        {activeTab === 'users' && (
          <div className="rounded-xl border border-white/[0.08] bg-slate-950/70 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                <span>Loading team directory...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No accounts match your search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-white/[0.08] text-[11px] font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Assigned Course</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Assigned Leads</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {filteredUsers.map((user) => {
                      const isMaster = user.email.toLowerCase() === MASTER_ADMIN_EMAIL;
                      const enquiryCount = user._count?.assignedEnquiries || 0;

                      return (
                        <tr
                          key={user.id}
                          onClick={() => handleOpenEdit(user)}
                          className={`group hover:bg-white/[0.03] transition-colors cursor-pointer ${
                            !user.isActive ? 'opacity-60 bg-red-950/10' : ''
                          }`}
                        >
                          {/* Name & Email */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                  isMaster
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    : 'bg-white/10 text-slate-200 border border-white/10'
                                }`}
                              >
                                {user.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-white truncate flex items-center gap-1.5">
                                  <span>{user.name}</span>
                                  {isMaster && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                      Root
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-medium capitalize ${
                                isMaster
                                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                  : 'bg-white/[0.06] text-slate-300 border border-white/[0.08]'
                              }`}
                            >
                              {isMaster ? 'Master Admin' : user.role}
                            </span>
                          </td>

                          {/* Course / Platform */}
                          <td className="py-3 px-3 text-slate-300">
                            {isMaster ? (
                              <span className="text-slate-400">All Platforms</span>
                            ) : (
                              <span className="truncate max-w-[180px] inline-block font-medium">
                                {user.assignedCourse || 'General'}
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  user.isActive ? 'bg-emerald-400' : 'bg-red-400'
                                }`}
                              />
                              <span
                                className={`text-[11px] font-medium ${
                                  user.isActive ? 'text-slate-300' : 'text-red-400'
                                }`}
                              >
                                {user.isActive ? 'Active' : 'Deactivated'}
                              </span>
                            </div>
                          </td>

                          {/* Assigned Enquiry Count */}
                          <td className="py-3 px-3 text-right font-medium text-slate-200">
                            {enquiryCount.toLocaleString()}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleOpenEdit(user)}
                                className="px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                              >
                                <SlidersHorizontal className="w-3 h-3 text-slate-400" />
                                <span>Manage</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Audit Trail Table */}
        {activeTab === 'audit' && (
          <div className="rounded-xl border border-white/[0.08] bg-slate-950/70 overflow-hidden">
            {auditLogs.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No administrative activity logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-white/[0.08] text-[11px] font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-3">Action</th>
                      <th className="py-3 px-3">Actor</th>
                      <th className="py-3 px-3">Target</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition">
                        <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap text-[11px] font-mono">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-medium">
                          {log.actorEmail}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {log.targetEmail || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 font-mono text-[10.5px] max-w-xs truncate">
                          {log.details ? JSON.stringify(log.details) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Slide-Over Management Panel */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 overflow-hidden animate-fade-only cursor-pointer"
          onClick={handleCloseEdit}
        >
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity" />

          {/* Panel Sliding from Right */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10 pointer-events-none">
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-[92vw] sm:w-[520px] md:w-[480px] bg-slate-950/98 backdrop-blur-2xl border-l border-white/20 shadow-[-25px_0_80px_rgba(0,0,0,0.9)] text-slate-100 flex flex-col relative z-10 animate-drawer-slide-in cursor-default pointer-events-auto"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/15 bg-slate-950 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white tracking-tight">
                      Manage Employee Profile & Access
                    </h2>
                    {editingUser.email.toLowerCase() === MASTER_ADMIN_EMAIL && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Master Admin
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">{editingUser.email}</p>
                </div>
                <button
                  onClick={handleCloseEdit}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar text-xs">
                {/* Master Admin Notice */}
                {editingUser.email.toLowerCase() === MASTER_ADMIN_EMAIL && (
                  <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px] leading-relaxed">
                    The Master Admin account is immutable with unrestricted privileges across all system modules. It cannot be deactivated, demoted, or deleted.
                  </div>
                )}

                {/* Section 1: Employee Details (Editable Name & Email) */}
                <div className="space-y-3 p-3.5 rounded-xl border border-white/10 bg-slate-900/40">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Employee Information
                  </label>

                  <div className="space-y-1.5">
                    <span className="text-[10.5px] font-medium text-slate-300">Full Name</span>
                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="e.g. Employee A"
                      className="w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10.5px] font-medium text-slate-300">Email Address</span>
                    <input
                      type="email"
                      value={draftEmail}
                      disabled={editingUser.email.toLowerCase() === MASTER_ADMIN_EMAIL}
                      onChange={(e) => setDraftEmail(e.target.value)}
                      placeholder="employee@gapanchor.com"
                      className={`w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30 ${
                        editingUser.email.toLowerCase() === MASTER_ADMIN_EMAIL ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    />
                    {editingUser.email.toLowerCase() === MASTER_ADMIN_EMAIL && (
                      <p className="text-[10px] text-amber-400/80">
                        Root Master Admin email address is protected against modification.
                      </p>
                    )}
                  </div>
                </div>

                {/* Section 2: Assigned Role & Access Level */}
                {editingUser.email.toLowerCase() !== MASTER_ADMIN_EMAIL && (
                  <div className="space-y-2 p-3.5 rounded-xl border border-white/10 bg-slate-900/40">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Assigned Role
                      </label>
                      <span className="text-[10.5px] text-slate-400 capitalize font-medium">
                        Current: <strong className="text-white">{draftRole}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setDraftRole('employee')}
                        className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                          draftRole === 'employee'
                            ? 'bg-white/10 border-white/30 text-white shadow-sm'
                            : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="font-semibold text-xs flex items-center justify-between">
                          <span>Employee</span>
                          {draftRole === 'employee' && <Check size={12} className="text-emerald-400" />}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Assigned leads only & customizable modular locks
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDraftRole('administrator');
                          handleGrantAllModules();
                        }}
                        className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                          draftRole === 'administrator'
                            ? 'bg-white/10 border-white/30 text-white shadow-sm'
                            : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="font-semibold text-xs flex items-center justify-between">
                          <span>Super Admin</span>
                          {draftRole === 'administrator' && <Check size={12} className="text-emerald-400" />}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Full administrative access across all operational modules
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Section 3: Modular Functionality Locks */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Module Functionality Locks
                      </label>
                      <p className="text-[10.5px] text-slate-400">
                        Individually lock or unlock each operational tool for this account.
                      </p>
                    </div>

                    {editingUser.email.toLowerCase() !== MASTER_ADMIN_EMAIL && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={handleGrantAllModules}
                          className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 transition cursor-pointer"
                        >
                          Unlock All
                        </button>
                        <button
                          type="button"
                          onClick={handleLockAllModules}
                          className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 transition cursor-pointer"
                        >
                          Lock All
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="divide-y divide-white/[0.06] rounded-xl border border-white/10 bg-slate-900/60 overflow-hidden">
                    {SYSTEM_MODULES.map((mod) => {
                      const isMaster = editingUser.email.toLowerCase() === MASTER_ADMIN_EMAIL;
                      const isAllowed = isMaster ? true : draftAllowedUIs.includes(mod.id);

                      return (
                        <div
                          key={mod.id}
                          className="p-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="text-slate-400 shrink-0">
                              {getModuleIcon(mod.id)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-200 truncate flex items-center gap-2">
                                <span>{mod.label}</span>
                                {isAllowed ? (
                                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                                    <Unlock size={10} />
                                    <span>Unlocked</span>
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-medium bg-slate-800 text-slate-400 border border-white/10 flex items-center gap-1">
                                    <Lock size={10} />
                                    <span>Locked</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[10.5px] text-slate-500 font-mono">
                                {mod.path}
                              </div>
                            </div>
                          </div>

                          {/* Individual Toggle Switch - fully enabled for all modules */}
                          <button
                            type="button"
                            disabled={isMaster}
                            onClick={() => handleToggleDraftPermission(mod.id)}
                            className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer disabled:cursor-not-allowed shrink-0 ${
                              isAllowed ? 'bg-emerald-500/80' : 'bg-slate-700'
                            }`}
                            title={isAllowed ? `Lock ${mod.label}` : `Unlock ${mod.label}`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform ${
                                isAllowed ? 'left-[19px]' : 'left-[3px]'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section 4: Assigned Platform / Course */}
                {editingUser.email.toLowerCase() !== MASTER_ADMIN_EMAIL && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Assigned Platform / Specialization
                    </label>
                    <select
                      value={draftCourse}
                      onChange={(e) => setDraftCourse(e.target.value)}
                      className="w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                    >
                      {COURSES.map((course) => (
                        <option key={course} value={course} className="bg-slate-900 text-white">
                          {course}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10.5px] text-slate-400">
                      Determines course specialization and automated lead tagging.
                    </p>
                  </div>
                )}

                {/* Section 5: Account Status */}
                {editingUser.email.toLowerCase() !== MASTER_ADMIN_EMAIL && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Account Status
                    </label>
                    <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-slate-900/60">
                      <div>
                        <div className="font-semibold text-slate-200">
                          {draftIsActive ? 'Account Active' : 'Account Deactivated'}
                        </div>
                        <div className="text-[10.5px] text-slate-400">
                          {draftIsActive
                            ? 'Employee can sign in and view permitted tools and assigned enquiries.'
                            : 'Sign in blocked; access credentials revoked.'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDraftIsActive(!draftIsActive)}
                        className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                          draftIsActive ? 'bg-emerald-500/80' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform ${
                            draftIsActive ? 'left-[19px]' : 'left-[3px]'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* Section 6: Password Reset with anti-autofill decoy */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Reset Password
                  </label>
                  {/* Browser autofill decoy trap */}
                  <div style={{ display: 'none' }} aria-hidden="true">
                    <input type="text" name="chrome_decoy_un" tabIndex={-1} autoComplete="username" />
                    <input type="password" name="chrome_decoy_pw" tabIndex={-1} autoComplete="current-password" />
                  </div>
                  <div className="relative">
                    <input
                      type={showDraftPassword ? 'text' : 'password'}
                      name="admin_override_password_field"
                      id="admin_override_password_field"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                      value={draftPassword}
                      onChange={(e) => setDraftPassword(e.target.value)}
                      placeholder="Enter new password (optional)"
                      className="w-full bg-slate-900 border border-white/15 rounded-lg pl-3 pr-10 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDraftPassword(!showDraftPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showDraftPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[10.5px] text-slate-400">
                    Leave blank to keep existing password unchanged.
                  </p>
                </div>

                {/* Section 7: Danger Zone (Delete Account) */}
                {editingUser.email.toLowerCase() !== MASTER_ADMIN_EMAIL && (
                  <div className="pt-2 border-t border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(editingUser)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Delete Employee Account</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-white/15 bg-slate-950 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={handleSaveConfirmedChanges}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-only"
          onClick={() => setShowAddModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-950 border border-white/20 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Create Employee Account</h3>
                <p className="text-[11px] text-slate-400">Add a new team member with controlled access</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Employee D"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="employee.d@gapanchor.com"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Temporary Password
                </label>
                <div className="relative">
                  <input
                    type={showAddPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 4 characters"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    className="w-full bg-slate-900 border border-white/15 rounded-lg pl-3 pr-10 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showAddPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Specialization Platform
                </label>
                <select
                  value={newUserData.assignedCourse}
                  onChange={(e) => setNewUserData({ ...newUserData, assignedCourse: e.target.value })}
                  className="w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                >
                  {COURSES.map((course) => (
                    <option key={course} value={course} className="bg-slate-900 text-white">
                      {course}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingUser}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/20 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {addingUser ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3 h-3" />
                      <span>Create Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
