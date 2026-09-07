'use client';

import React, { useState, useEffect } from 'react';
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
        toast.success(`✅ Lead assigned to ${chosenEmployee?.name}`, {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md glass-modal overflow-hidden rounded-2xl border border-brand-500/30 p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-tertiary hover:text-primary transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
            <UserCheck size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-primary">Assign Lead to Team Member</h3>
            <p className="text-xs text-tertiary">Route lead to specific employee portal</p>
          </div>
        </div>

        {/* Details preview */}
        <div className="p-3 mb-4 rounded-xl border border-border bg-surface-2 text-xs">
          <div className="font-semibold text-primary">{participantName || 'Enquiry Lead'}</div>
          <div className="text-brand-400 font-medium mt-0.5">{topic}</div>
        </div>

        {/* Employee Selection */}
        <div className="space-y-3 mb-6">
          <label className="text-xs font-semibold text-secondary block">Select Assigned Employee</label>
          {loading ? (
            <div className="py-6 text-center text-xs text-tertiary">Loading employees...</div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {employees.map((emp) => {
                const isSelected = selectedEmployeeId === emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployeeId(emp.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500/10 text-primary shadow-sm'
                        : 'border-border bg-surface-0 hover:border-border-secondary text-secondary'
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
                      <div className="text-[10px] text-tertiary mt-0.5">{emp.email} • {emp.assignedCourse || 'General'}</div>
                    </div>
                    {isSelected && <Check size={16} className="text-brand-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-tertiary hover:text-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={assigning || !selectedEmployeeId}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white transition-all disabled:opacity-50"
          >
            <UserCheck size={14} />
            {assigning ? 'Assigning...' : 'Assign Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
