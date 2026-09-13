'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  recordId: string;
  recordName: string;
  onDeleteSuccess: (recordId: string) => void;
  buttonStyle?: 'icon' | 'full';
  className?: string;
}

export default function DeleteRecordAction({
  recordId,
  recordName,
  onDeleteSuccess,
  buttonStyle = 'icon',
  className = '',
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setErrorMessage(null);
    setIsOpen(true);
  };

  const handleClose = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!deleting) {
      setIsOpen(false);
      setErrorMessage(null);
    }
  };

  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/enquiries/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiryId: recordId, recordName }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message || `Record "${recordName}" deleted successfully`);
        onDeleteSuccess(recordId);
        setIsOpen(false);
      } else {
        setErrorMessage(data.error || 'Failed to delete record.');
        toast.error(data.error || 'Delete operation failed');
      }
    } catch (err: any) {
      const msg = err.message || 'Network error while deleting record';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Delete Trigger Button */}
      {buttonStyle === 'full' ? (
        <button
          type="button"
          onClick={handleOpen}
          className={`px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${className}`}
          title="Delete Record"
        >
          <Trash2 size={13} />
          <span>Delete</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className={`p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/25 text-rose-400 hover:text-rose-300 transition-all cursor-pointer shadow-sm ${className}`}
          title="Delete Enquiry Record"
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* Delete Confirmation Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-[#0c1222] p-6 shadow-2xl shadow-rose-950/80 animate-slide-up text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    Confirm Record Deletion
                  </h3>
                  <p className="text-xs text-slate-400">
                    Irreversible action • Archival purge enabled
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={deleting}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3 mb-5">
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete the enquiry record for{' '}
                <strong className="text-white font-bold bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  {recordName}
                </strong>
                ?
              </p>

              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle size={13} /> Deletion Impact:
                </p>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1 opacity-90">
                  <li>Removes the lead from your live CRM dashboard tables</li>
                  <li>Archives the record into the purge history table for audit safety</li>
                </ul>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-semibold">
                  ❌ {errorMessage}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={deleting}
                className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:opacity-95 text-white shadow-lg shadow-rose-600/30 disabled:opacity-50 transition-all cursor-pointer"
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Deleting Record...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
