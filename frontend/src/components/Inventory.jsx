import React, { useState } from 'react';
import { MoreVertical, Edit, Trash2, Facebook, Ghost, Layers, Image as ImageIcon, ShoppingBag } from 'lucide-react';

export default function Inventory({ items, onAddItem, onDeleteItem, onEditItem }) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [hoveredItemId, setHoveredItemId] = useState(null); 

  // --- HELPER: FIND FIRST VALID IMAGE (Skips HEIC) ---
  const getThumbnailUrl = (item) => {
    // 1. Check the new Array format (multiple images)
    if (item.imageUrls && Array.isArray(item.imageUrls) && item.imageUrls.length > 0) {
      // Find the first URL that is NOT a .heic file
      const validImg = item.imageUrls.find(url => !url.toLowerCase().includes('.heic'));
      if (validImg) return validImg;
    }

    // 2. Fallback check for the old single string format
    if (item.imageUrl && typeof item.imageUrl === 'string') {
       if (!item.imageUrl.toLowerCase().includes('.heic')) return item.imageUrl;
    }

    // 3. If everything is HEIC or empty, return null
    return null;
  };

  const PlatformBadge = ({ platform }) => {
    if (platform === 'Craigslist') return (<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20"><Ghost size={12} /> CL</span>);
    if (platform === 'FB Marketplace') return (<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20"><Facebook size={12} /> FB</span>);
    if ((platform || '').toLowerCase().includes('ebay')) return (<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20"><ShoppingBag size={12} /> EB</span>);
    if ((platform || '').includes('All')) return (<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-gradient-to-r from-purple-500/10 to-amber-500/10 text-slate-300 border border-slate-700"><Layers size={12} /> ALL</span>);
    return (<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-slate-300 border border-slate-700"><Layers size={12} /> Both</span>);
  };

  const progressLabel = (state) => {
    if (state === 'success') return 'OK';
    if (state === 'running') return 'RUN';
    if (state === 'queued') return 'Q';
    if (state === 'error') return 'ERR';
    return '--';
  };

  const ebayStatusLabel = (ebayStatus, progress) => {
    if (ebayStatus === 'ready_to_publish') return 'READY';
    if (ebayStatus === 'published') return 'PUB';
    if (ebayStatus === 'failed') return 'FAIL';
    if (ebayStatus === 'running') return 'RUN';
    if (ebayStatus === 'queued') return 'Q';
    return progressLabel(progress);
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-visible"> 
      <div className="p-6 flex justify-between items-center border-b border-slate-800">
        <h2 className="text-xl font-bold text-white">Current Inventory</h2>
        <button onClick={() => onAddItem()} className="bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2">+ New Listing</button>
      </div>

      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950 text-slate-400 text-sm uppercase">
            <tr>
              <th className="p-4 font-medium">Item Name</th>
              <th className="p-4 font-medium">Price</th>
              <th className="p-4 font-medium">Date Listed</th>
              <th className="p-4 font-medium">Client</th>
              <th className="p-4 font-medium">Platform</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {items.map((item) => {
              // Calculate thumbnail once per item
              const thumbUrl = getThumbnailUrl(item);

              return (
                <tr key={item.id} className="hover:bg-slate-800/50 transition-colors group relative">
                  
                  {/* TITLE + IMAGE PREVIEW */}
                  <td className="p-4 text-white font-medium relative" onMouseEnter={() => setHoveredItemId(item.id)} onMouseLeave={() => setHoveredItemId(null)}>
                      <div className="flex items-center gap-3">
                          {/* REAL THUMBNAIL (or Icon Fallback) */}
                          <div className="w-12 h-12 rounded bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                             {thumbUrl ? (
                               <img src={thumbUrl} alt="Thumb" className="w-full h-full object-cover" />
                             ) : (
                               <ImageIcon size={18} className="text-slate-600" />
                             )}
                          </div>
                          
                          <span className={thumbUrl ? 'cursor-help decoration-slate-600 underline-offset-4' : ''}>
                             {item.title}
                          </span>
                      </div>

                      {/* HOVER POPUP (Larger Preview) */}
                      {hoveredItemId === item.id && thumbUrl && (
                          <div className="absolute left-0 top-16 z-50 w-64 p-2 bg-slate-950 border border-slate-700 rounded-lg shadow-2xl pointer-events-none">
                              <div className="aspect-square rounded overflow-hidden bg-slate-900 relative">
                                  <img src={thumbUrl} alt="Preview" className="w-full h-full object-cover"/>
                              </div>
                              {/* Show if it's HEIC mixed in */}
                              {item.imageUrls?.some(u => u.toLowerCase().includes('.heic')) && (
                                <div className="mt-1 text-xs text-yellow-500 text-center bg-yellow-500/10 py-1 rounded">
                                  Includes HEIC files
                                </div>
                              )}
                          </div>
                      )}
                  </td>

                  <td className="p-4 text-teal-400 font-mono">{item.price}</td>
                  <td className="p-4 text-slate-400 text-sm">{item.dateListed || '-'}</td>
                  <td className="p-4 text-slate-300 text-sm">{item.clientName || <span className="text-slate-600 italic">None</span>}</td>
                  <td className="p-4"><PlatformBadge platform={item.platform} /></td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${item.status === 'Active' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : item.status === 'Sold' ? 'bg-slate-700 text-slate-400 border-slate-600' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>{item.status}</span>
                    {(() => {
                      const platformValue = item.platform || '';
                      const progress = item.progress || {};
                      const showCL = platformValue.includes('Craigslist') || platformValue.includes('Both') || platformValue.includes('All');
                      const showFB = platformValue.includes('FB') || platformValue.includes('Both') || platformValue.includes('All');
                      const showEB = platformValue.toLowerCase().includes('ebay') || platformValue.includes('All');
                      const ebayStatus = item.ebay?.status || null;
                      if (!showCL && !showFB && !showEB) return null;
                      return (
                        <div className="mt-1 text-[10px] text-slate-400">
                          {showCL && <span>CL: {progressLabel(progress?.craigslist)}</span>}
                          {showFB && <span className="ml-2">FB: {progressLabel(progress?.facebook)}</span>}
                          {showEB && <span className="ml-2">EB: {ebayStatusLabel(ebayStatus, progress?.ebay)}</span>}
                        </div>
                      );
                    })()}
                  </td>
                  
                  <td className="p-4 text-right">
                    <div className="relative inline-block">
                      <button onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)} className="text-slate-500 hover:text-white p-2 rounded hover:bg-slate-700 transition-colors"><MoreVertical size={18} /></button>
                      {openMenuId === item.id && (
                          <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)}></div>
                          <div className="absolute right-0 top-full mt-2 w-48 bg-slate-950 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                              <button onClick={() => { onEditItem(item); setOpenMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"><Edit size={14} /> Edit Details</button>
                              <button onClick={() => { onDeleteItem(item.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-2 border-t border-slate-800"><Trash2 size={14} /> Delete</button>
                          </div>
                          </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (<tr><td colSpan="7" className="p-12 text-center text-slate-500 border-t border-slate-800"><div className="flex flex-col items-center gap-2"><Ghost size={32} className="opacity-20" /><p>No active listings.</p></div></td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
