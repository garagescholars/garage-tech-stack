import React, { useState, useEffect } from 'react';
import { X, UploadCloud, Trash2, Archive, DollarSign, Ban } from 'lucide-react';
import { db, storage } from '../firebase'; 
import { collection, addDoc, updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function AddListingModal({ isOpen, onClose, initialData = null }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('Both');
  
  const [imageFiles, setImageFiles] = useState([]); 
  const [previews, setPreviews] = useState([]);     
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // NEW: State to toggle the "Decision Menu"
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  useEffect(() => {
    if (initialData) {
        setTitle(initialData.title || '');
        setPrice(initialData.price || '');
        setClientName(initialData.clientName || '');
        setDescription(initialData.description || '');
        setPlatform(initialData.platform || 'Both');
        
        if (initialData.imageUrls && Array.isArray(initialData.imageUrls)) {
            setPreviews(initialData.imageUrls);
        }
    } else {
        resetForm();
    }
  }, [initialData, isOpen]);

  const resetForm = () => {
    setTitle(''); setPrice(''); setClientName(''); setDescription('');
    setPlatform('Both'); setImageFiles([]); setPreviews([]);
    setStatusMessage('');
    setShowDeleteMenu(false); // Reset menu
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const totalFiles = [...imageFiles, ...newFiles].slice(0, 6);
      setImageFiles(totalFiles);
      setPreviews(totalFiles.map(file => URL.createObjectURL(file)));
    }
  };

  const removeImage = (indexToRemove) => {
      const updatedFiles = imageFiles.filter((_, i) => i !== indexToRemove);
      const updatedPreviews = previews.filter((_, i) => i !== indexToRemove);
      setImageFiles(updatedFiles);
      setPreviews(updatedPreviews);
  };

  // --- PATH A: SOLD (Revenue) ---
  const handleMarkSold = async () => {
        setIsSubmitting(true);
        setStatusMessage('Moving to Sold Archive...');
        
        try {
            const soldData = {
                ...initialData,
                status: 'Sold',
                dateSold: new Date().toLocaleDateString(),
                archivedAt: new Date(),
                soldBy: 'Garage Scholars' 
            };
            // Write to Sold
            await setDoc(doc(db, "sold_inventory", initialData.id), soldData);
            // Delete from Active
            await deleteDoc(doc(db, "inventory", initialData.id));
            onClose(); 
        } catch (error) {
            console.error("Error archiving:", error);
            alert("Failed. Check console.");
        } finally {
            setIsSubmitting(false);
        }
  };

  // --- PATH B: DELETE (Void) ---
  const handlePermanentDelete = async () => {
        if(!window.confirm("CONFIRM: This will delete the data forever. It will NOT count as a sale.")) return;

        setIsSubmitting(true);
        setStatusMessage('Deleting permanently...');
        
        try {
            await deleteDoc(doc(db, "inventory", initialData.id));
            onClose(); 
        } catch (error) {
            console.error("Error deleting:", error);
            alert("Failed. Check console.");
        } finally {
            setIsSubmitting(false);
        }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !price) return alert("Title and Price are required.");
    
    setIsSubmitting(true);
    setStatusMessage('Creating folders & uploading...');

    try {
        let finalImageUrls = initialData?.imageUrls || [];

        const cleanClient = (clientName || 'No Client').replace(/[\/#?]/g, "_").trim();
        const cleanTitle = title.replace(/[\/#?]/g, "_").trim();
        const customDocId = `${cleanClient} - ${cleanTitle}`;

        if (imageFiles.length > 0) {
            const uploadPromises = imageFiles.map(async (file) => {
                const fileName = `${Date.now()}_${file.name}`;
                const storageRef = ref(storage, `${customDocId}/${fileName}`);
                const snapshot = await uploadBytes(storageRef, file);
                return await getDownloadURL(snapshot.ref);
            });
            const newUrls = await Promise.all(uploadPromises);
            finalImageUrls = [...(initialData?.imageUrls || []), ...newUrls];
        }

        setStatusMessage('Saving to database...');

        const formData = {
            title,
            price: price.replace(/[^0-9.]/g, ''), 
            clientName,
            description,
            platform,
            status: 'Pending', 
            imageUrls: finalImageUrls, 
            dateListed: initialData?.dateListed || new Date().toLocaleDateString(),
            lastUpdated: new Date()
        };

        if (initialData) {
            await updateDoc(doc(db, "inventory", initialData.id), formData);
        } else {
            await setDoc(doc(db, "inventory", customDocId), formData);
        }

        onClose();
        resetForm();

    } catch (error) {
        console.error("Error saving:", error);
        alert("Upload failed. Check console.");
    } finally {
        setIsSubmitting(false);
        setStatusMessage('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto relative">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">
            {showDeleteMenu ? 'Remove Item' : (initialData ? 'Edit Listing' : 'Add New Listing')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
        </div>

        {/* --- VIEW 1: THE DECISION MENU (If Delete Clicked) --- */}
        {showDeleteMenu ? (
            <div className="space-y-4 animate-in fade-in zoom-in duration-200">
                <div className="p-4 bg-slate-800 rounded-lg text-center border border-slate-700">
                    <p className="text-white font-medium mb-1">Why are we removing this item?</p>
                    <p className="text-sm text-slate-400">"{title}"</p>
                </div>

                <button onClick={handleMarkSold} className="w-full flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-all group">
                    <div className="flex items-center gap-3">
                        <DollarSign className="w-6 h-6" />
                        <div className="text-left">
                            <p className="font-bold">Sold by Garage Scholars</p>
                            <p className="text-xs text-emerald-500/60">Moves to Sold Archive. Counts as Revenue.</p>
                        </div>
                    </div>
                    <span className="text-lg opacity-0 group-hover:opacity-100 transition-opacity">➔</span>
                </button>

                <button onClick={handlePermanentDelete} className="w-full flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 text-red-400 transition-all group">
                    <div className="flex items-center gap-3">
                        <Ban className="w-6 h-6" />
                        <div className="text-left">
                            <p className="font-bold">Duplicate / Void</p>
                            <p className="text-xs text-red-500/60">Deletes permanently. No Revenue stats.</p>
                        </div>
                    </div>
                    <span className="text-lg opacity-0 group-hover:opacity-100 transition-opacity">➔</span>
                </button>

                <button onClick={() => setShowDeleteMenu(false)} className="w-full text-slate-500 text-sm py-2 hover:text-white">
                    Cancel (Go Back)
                </button>
            </div>
        ) : (
        /* --- VIEW 2: THE NORMAL FORM --- */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-400 mb-1">Item Title</label><input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-teal-500 outline-none" value={title} onChange={(e) => setTitle(e.target.value)}/></div>
          <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-400 mb-1">Price</label><input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-teal-500 outline-none" value={price} onChange={(e) => setPrice(e.target.value)}/></div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">Client Name</label><input type="text" placeholder="(Optional)" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-teal-500 outline-none" value={clientName} onChange={(e) => setClientName(e.target.value)}/></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-400 mb-1">Description</label><textarea required rows="4" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-teal-500 outline-none resize-none" value={description} onChange={(e) => setDescription(e.target.value)}/></div>
          <div><label className="block text-sm font-medium text-slate-400 mb-1">Platform</label><select className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-teal-500 outline-none" value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="Both">Both (Cross-Post)</option><option value="Craigslist">Craigslist Only</option><option value="FB Marketplace">Facebook Only</option></select></div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Photos (Max 6)</label>
            <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-teal-500 transition-colors relative">
              <input type="file" id="file-upload" className="hidden" multiple accept=".jpg,.jpeg,.png,.HEIC,.webp" onChange={handleFileChange}/>
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2 py-4">
                <UploadCloud className="text-slate-500" size={32} />
                <span className="text-sm text-slate-400">Click to upload photos ({imageFiles.length}/6)</span>
              </label>
            </div>
            {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                    {previews.map((src, idx) => (
                        <div key={idx} className="relative group aspect-square bg-slate-800 rounded-md overflow-hidden border border-slate-700">
                            <img src={src} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                            <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
            )}
          </div>

          {initialData && (
            <div className="pt-4 border-t border-slate-800">
               <button 
                 type="button" 
                 onClick={() => setShowDeleteMenu(true)}
                 className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white py-3 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
               >
                 <Trash2 size={18} /> Remove Item...
               </button>
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="w-full bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold py-3 rounded-lg mt-4 transition-colors disabled:opacity-50">
            {isSubmitting ? (statusMessage || 'Processing...') : (initialData ? 'Save Changes' : 'Create & Post')}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}