import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Edit3, DollarSign, Clock, CheckCircle2, XCircle, Loader2, Circle, ExternalLink, Package } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';

export default function JobDetailDrawer({ item, onClose, onEdit, onMarkSold }) {
  const [jobs, setJobs] = useState([]);
  const { showToast } = useToast();

  // Fetch automation jobs for this inventory item
  useEffect(() => {
    if (!item) return;
    const q = query(
      collection(db, 'automationJobs'),
      where('inventoryId', '==', item.id),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => {
      // Index may not be built yet — fall back to unordered
      console.warn('JobDetailDrawer query error (index may be building):', err.message);
    });
    return () => unsub();
  }, [item]);

  if (!item) return null;

  const handleRetry = async () => {
    try {
      await updateDoc(doc(db, 'inventory', item.id), {
        status: 'Pending',
        lastError: null,
        progress: {},
        lastUpdated: new Date()
      });
      showToast({ type: 'success', message: `Re-queued "${item.title}" for automation` });
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to retry: ' + e.message });
    }
  };

  const progress = item.progress || {};
  const ebay = item.ebay || {};
  const platformValue = item.platform || '';
  const showCL = platformValue.includes('Craigslist') || platformValue.includes('Both') || platformValue.includes('All');
  const showFB = platformValue.includes('FB') || platformValue.includes('Both') || platformValue.includes('All');
  const showEB = platformValue.toLowerCase().includes('ebay') || platformValue.includes('All');

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-lg bg-slate-950 border-l border-slate-800 h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0">
                {item.imageUrls?.[0]
                  ? <img src={item.imageUrls[0]} className="w-full h-full object-cover" alt="" />
                  : <div className="w-full h-full flex items-center justify-center text-slate-600"><Package size={20} /></div>
                }
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{item.title}</h3>
                <p className="text-sm text-teal-400 font-mono">${item.price}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white ml-2"><X size={20} /></button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <StatusBadge status={item.status} />
            {item.clientName && <span className="text-xs text-slate-500">Client: {item.clientName}</span>}
          </div>
        </div>

        {/* Platform Status Cards */}
        <div className="p-5 space-y-3">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Platform Status</h4>
          <div className="grid grid-cols-1 gap-2">
            {showCL && <PlatformCard platform="Craigslist" abbr="CL" color="purple" status={progress.craigslist} />}
            {showFB && <PlatformCard platform="Facebook" abbr="FB" color="blue" status={progress.facebook} />}
            {showEB && (
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">EB</span>
                    <span className="text-sm text-white">eBay</span>
                  </div>
                  <PlatformStatusIcon status={ebay.status || progress.ebay} />
                </div>
                {ebay.listingId && (
                  <div className="mt-2 text-xs text-slate-400 space-y-0.5">
                    <p>Listing: <span className="text-teal-400 font-mono">{ebay.listingId}</span></p>
                    {ebay.offerId && <p>Offer: <span className="text-slate-300 font-mono">{ebay.offerId}</span></p>}
                    {ebay.sku && <p>SKU: <span className="text-slate-300 font-mono">{ebay.sku}</span></p>}
                  </div>
                )}
                {ebay.error && (
                  <p className="mt-1.5 text-xs text-rose-400">{ebay.error.message || JSON.stringify(ebay.error)}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error Detail */}
        {item.lastError && (
          <div className="px-5 pb-4">
            <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
              <p className="text-xs font-bold text-rose-400 mb-1">Last Error</p>
              <p className="text-xs text-rose-300">{item.lastError?.message || item.lastError}</p>
              {item.lastError?.platform && (
                <p className="text-[10px] text-rose-500/60 mt-1">Platform: {item.lastError.platform}</p>
              )}
            </div>
          </div>
        )}

        {/* Automation Job Timeline */}
        <div className="p-5 border-t border-slate-800">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Automation History</h4>
          {jobs.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4">No automation jobs recorded</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job, i) => (
                <div key={job.id} className="flex items-start gap-3 relative">
                  {/* Timeline line */}
                  {i < jobs.length - 1 && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-slate-800" />}
                  <div className="relative z-10 mt-0.5">
                    {job.status === 'succeeded' && <CheckCircle2 size={16} className="text-emerald-400" />}
                    {job.status === 'failed' && <XCircle size={16} className="text-rose-400" />}
                    {job.status === 'running' && <Loader2 size={16} className="text-blue-400 animate-spin" />}
                    {job.status === 'compliance_failed' && <XCircle size={16} className="text-amber-400" />}
                    {job.status === 'dead_letter' && <XCircle size={16} className="text-rose-600" />}
                    {job.status === 'queued' && <Circle size={16} className="text-slate-500" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${
                        job.status === 'succeeded' ? 'text-emerald-400' :
                        job.status === 'running' ? 'text-blue-400' :
                        job.status === 'compliance_failed' ? 'text-amber-400' :
                        job.status === 'failed' || job.status === 'dead_letter' ? 'text-rose-400' :
                        'text-slate-400'
                      }`}>
                        {job.status === 'succeeded' ? 'Succeeded' :
                         job.status === 'failed' ? 'Failed' :
                         job.status === 'running' ? 'Running' :
                         job.status === 'compliance_failed' ? 'Compliance Failed' :
                         job.status === 'dead_letter' ? 'Dead Letter' :
                         'Queued'}
                      </span>
                      <span className="text-[10px] text-slate-600">Attempt {job.attempts || 1}</span>
                    </div>
                    {job.lastError?.message && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{job.lastError.message}</p>
                    )}
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {job.createdAt?.toDate ? timeAgo(job.createdAt.toDate()) : ''}
                      {job.leaseOwner && ` · Worker: ${job.leaseOwner.split('-')[0]}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-slate-800 space-y-2 sticky bottom-0 bg-slate-950">
          <button onClick={handleRetry} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 text-sm font-medium">
            <RefreshCw size={16} /> Retry Automation
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { onEdit(item); onClose(); }} className="flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-sm">
              <Edit3 size={14} /> Edit
            </button>
            <button onClick={() => { onMarkSold(item); onClose(); }} className="flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 text-sm">
              <DollarSign size={14} /> Mark Sold
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Pending: 'bg-slate-500/10 border-slate-500/40 text-slate-300',
    Running: 'bg-blue-500/10 border-blue-500/50 text-blue-400',
    Active: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400',
    Error: 'bg-rose-500/10 border-rose-500/50 text-rose-400',
    'Compliance Error': 'bg-amber-500/10 border-amber-500/50 text-amber-400',
  };
  return (
    <span className={`text-xs px-2 py-1 rounded border font-medium ${styles[status] || styles.Pending}`}>
      {status || 'Pending'}
    </span>
  );
}

function PlatformCard({ platform, abbr, color, status }) {
  const colorMap = {
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  };
  return (
    <div className="p-3 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${colorMap[color]}`}>{abbr}</span>
        <span className="text-sm text-white">{platform}</span>
      </div>
      <PlatformStatusIcon status={status} />
    </div>
  );
}

function PlatformStatusIcon({ status }) {
  if (status === 'success') return <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={14} /> Posted</span>;
  if (status === 'running') return <span className="flex items-center gap-1 text-xs text-blue-400"><Loader2 size={14} className="animate-spin" /> Running</span>;
  if (status === 'queued') return <span className="flex items-center gap-1 text-xs text-slate-400"><Clock size={14} /> Queued</span>;
  if (status === 'error' || status === 'failed') return <span className="flex items-center gap-1 text-xs text-rose-400"><XCircle size={14} /> Error</span>;
  if (status === 'ready_to_publish') return <span className="flex items-center gap-1 text-xs text-amber-400"><Clock size={14} /> Ready</span>;
  if (status === 'published') return <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={14} /> Published</span>;
  return <span className="text-xs text-slate-600">--</span>;
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
