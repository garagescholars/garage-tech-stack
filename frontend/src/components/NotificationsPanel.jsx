import React from 'react';
import { X, AlertTriangle, XCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function NotificationsPanel({ notifications, onClose, onRetryItem, onEditItem }) {
  const markRead = async (id) => {
    try {
      await updateDoc(doc(db, 'adminNotifications', id), { read: true });
    } catch (e) {
      console.error('Failed to mark read:', e);
    }
  };

  const markAllRead = async () => {
    try {
      await Promise.all(notifications.map(n => updateDoc(doc(db, 'adminNotifications', n.id), { read: true })));
    } catch (e) {
      console.error('Failed to mark all read:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md bg-slate-950 border-l border-slate-800 h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-950 z-10">
          <h3 className="text-lg font-bold text-white">Notifications</h3>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button onClick={markAllRead} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800">
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="mx-auto mb-3 text-emerald-500/30" size={40} />
              <p className="text-slate-500">All clear — no notifications</p>
            </div>
          ) : (
            notifications.map(notif => (
              <div key={notif.id} className="p-4 hover:bg-slate-900/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-full ${notif.type === 'dead_letter_job' ? 'bg-rose-500/10' : 'bg-amber-500/10'}`}>
                    {notif.type === 'dead_letter_job'
                      ? <XCircle size={16} className="text-rose-400" />
                      : <AlertTriangle size={16} className="text-amber-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      {notif.type === 'dead_letter_job' ? 'Automation Failed' : 'Compliance Error'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{notif.message}</p>
                    {notif.errors && notif.errors.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {notif.errors.slice(0, 3).map((err, i) => (
                          <p key={i} className="text-xs text-rose-400/80">• {err}</p>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {notif.inventoryId && (
                        <button
                          onClick={() => { onRetryItem(notif.inventoryId); markRead(notif.id); }}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 border border-teal-500/20"
                        >
                          <RefreshCw size={12} /> Retry
                        </button>
                      )}
                      <button
                        onClick={() => markRead(notif.id)}
                        className="text-xs text-slate-500 hover:text-white px-2 py-1 rounded hover:bg-slate-800"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-600 whitespace-nowrap">
                    {notif.createdAt?.toDate ? timeAgo(notif.createdAt.toDate()) : ''}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
