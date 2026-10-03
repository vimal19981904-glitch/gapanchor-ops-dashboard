'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserCheck, X, Check, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedCourse: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  enquiryId: string | null;
  participantName?: string;
  topic?: string;
  currentAssignedId?: string | null;
  onSuccess: () => void;
}

export default function AssignLeadModal({
  isOpen,
  onClose,
  enquiryId,
  participantName,
  topic,
  currentAssignedId,
  onSuccess,
}: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      if (currentAssignedId) setSelectedEmployeeId(currentAssignedId);
    }
  }, [isOpen, currentAssignedId]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees || []);
        if (!currentAssignedId && data.employees?.length > 0) {
          // Auto select employee based on topic matching if available
          const match = data.employees.find((emp: Employee) =>
            emp.assignedCourse && topic && topic.toLowerCase().includes(emp.assignedCourse.toLowerCase())
          );
          if (match) {
            setSelectedEmployeeId(match.id);
          } else {
            setSelectedEmployeeId(data.employees[0].id);
          }
        }
      }
    } catch (err: any) {
      toast.error('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!enquiryId || !selectedEmployeeId) return;
    setAssigning(true);
    const chosenEmployee = employees.find(e => e.id === selectedEmployeeId);

    try {
      const res = await fetch('/api/comms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          enquiryId,
          assignedToId: selectedEmployeeId,
          assignedToName: chosenEmployee?.name || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Lead assigned to ${chosenEmployee?.name}`, {
          description: `Updated in database & synced for employee portal`,
        });
        onSuccess();
        onClose();
      } else {
        toast.error(data.error || 'Failed to assign lead');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 w-screen h-screen z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in my-auto overflow-y-auto"
      onClick={onClose}
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-indigo-500/40 bg-[#0b1329] p-5 sm:p-6 shadow-2xl shadow-indigo-950/80 animate-slide-up text-white my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-800/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pr-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
            <UserCheck size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-white truncate">Assign Lead to Team Member</h3>
            <p className="text-[11px] text-slate-400 truncate">Route lead to specific employee portal</p>
          </div>
        </div>

        {/* Details preview */}
        <div className="p-3 mb-4 rounded-xl border border-slate-800 bg-slate-900/90 text-xs">
          <div className="font-bold text-slate-100">{participantName || 'Enquiry Lead'}</div>
          <div className="text-cyan-400 font-semibold mt-0.5">{topic}</div>
        </div>

        {/* Employee Selection */}
        <div className="space-y-3 mb-5">
          <label className="text-xs font-bold text-slate-300 block">Select Assigned Employee</label>
          {loading ? (
            <div className="py-6 text-center text-xs text-slate-400">Loading employees...</div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {employees.map((emp) => {
                const isSelected = selectedEmployeeId === emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployeeId(emp.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/20 text-white shadow-sm ring-1 ring-indigo-400/40'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        {emp.name}
                        {emp.role === 'admin' && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{emp.email} • {emp.assignedCourse || 'General'}</div>
                    </div>
                    {isSelected && <Check size={16} className="text-cyan-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={assigning || !selectedEmployeeId}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
          >
            <UserCheck size={14} />
            {assigning ? 'Assigning...' : 'Assign Lead'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
