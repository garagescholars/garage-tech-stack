
import React, { useState, useEffect, useRef } from 'react';
import { Job, JobStatus, JobMedia, Task, User, SopDoc } from '../types';
import CameraCapture from '../components/CameraCapture';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, functions, storage } from '../src/firebase';
import { ArrowLeft, MapPin, CheckCircle, Loader2, CheckSquare, Square, Trash2, Plus, ShieldAlert, Pencil, Calendar, Upload, Clock } from 'lucide-react';

interface JobDetailProps {
  job: Job;
  users?: User[]; 
  onBack: () => void;
  onUpdateJob: (updatedJob: Job) => void;
  onNotifyAdmin: (message: string, jobId: string) => void;
  userRole?: 'EMPLOYEE' | 'ADMIN';
  currentUserId: string | null;
}

export const JobDetail: React.FC<JobDetailProps> = ({ job, users = [], onBack, onUpdateJob, onNotifyAdmin, userRole = 'EMPLOYEE', currentUserId }) => {
  const [activeStep, setActiveStep] = useState<'details' | 'checkin' | 'checkout' | 'report'>('details');
  const [mediaBuffer, setMediaBuffer] = useState<Partial<JobMedia>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intakeInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [sortOption, setSortOption] = useState<'default' | 'alpha' | 'status'>('default');
  const [sopData, setSopData] = useState<SopDoc | null>(null);
  const [sopLoading, setSopLoading] = useState(false);
  const [sopError, setSopError] = useState<string | null>(null);
  const [intakeUploads, setIntakeUploads] = useState<{ path: string; url: string }[]>([]);

  const getLocalDateTime = (isoString: string) => {
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().slice(0, 16);
  };

  const [editForm, setEditForm] = useState({
      clientName: job.clientName,
      address: job.address,
      date: getLocalDateTime(job.date),
      pay: job.pay,
      description: job.description
  });

  useEffect(() => {
    setEditForm({
        clientName: job.clientName,
        address: job.address,
        date: getLocalDateTime(job.date),
        pay: job.pay,
        description: job.description
    });
    window.scrollTo(0, 0);
  }, [job]);

  useEffect(() => {
    if (!db || !job.sopId) {
      setSopData(null);
      return;
    }
    const sopRef = doc(db, 'sops', job.sopId);
    const unsubscribe = onSnapshot(sopRef, (snapshot) => {
      if (!snapshot.exists()) {
        setSopData(null);
        return;
      }
      const data = snapshot.data() as Omit<SopDoc, 'id'>;
      setSopData({ id: snapshot.id, ...data });
    });
    return () => unsubscribe();
  }, [job.sopId]);

  useEffect(() => {
    const run = async () => {
      if (!storage) return;
      const paths = job.intakeMediaPaths || [];
      const results = await Promise.all(paths.map(async (path) => {
        const url = await getDownloadURL(storageRef(storage, path));
        return { path, url };
      }));
      setIntakeUploads(results);
    };
    run().catch(() => setIntakeUploads([]));
  }, [job.intakeMediaPaths]);

  const generateTimestamp = () => new Date().toISOString();

  const handleMediaCapture = (key: keyof JobMedia, data: string, timestamp?: string) => {
    const timestampKey = key === 'photoFrontOfHouse' ? 'photoTimestamp' : 'videoTimestamp';
    const finalTimestamp = timestamp || generateTimestamp();
    setMediaBuffer(prev => ({ ...prev, [key]: data, [timestampKey]: finalTimestamp }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            handleMediaCapture('photoFrontOfHouse', result, new Date().toISOString());
        };
        reader.readAsDataURL(file);
    }
  };

  const submitCheckIn = () => {
    const saved = job.checkInMedia;
    const photo = mediaBuffer.photoFrontOfHouse || saved?.photoFrontOfHouse;
    const video = mediaBuffer.videoGarage || saved?.videoGarage;
    if (!photo || !video) { alert("Please complete both photo and video requirements."); return; }
    const now = generateTimestamp();
    const checkInMedia: JobMedia = {
      photoFrontOfHouse: photo!,
      videoGarage: video!,
      timestamp: now,
      photoTimestamp: mediaBuffer.photoTimestamp || saved?.photoTimestamp || now,
      videoTimestamp: mediaBuffer.videoTimestamp || saved?.videoTimestamp || now,
    };
    onUpdateJob({ ...job, status: JobStatus.IN_PROGRESS, checkInTime: now, checkInMedia });
    setMediaBuffer({});
    setActiveStep('details');
  };

  const processCheckOut = async () => {
    setShowConfirmation(false);
    const saved = job.checkOutMedia;
    const photo = mediaBuffer.photoFrontOfHouse || saved?.photoFrontOfHouse;
    const video = mediaBuffer.videoGarage || saved?.videoGarage;
    if (!photo || !video) return;
    setIsProcessing(true);
    const now = generateTimestamp();
    const checkOutMedia: JobMedia = {
      photoFrontOfHouse: photo!,
      videoGarage: video!,
      timestamp: now,
      photoTimestamp: mediaBuffer.photoTimestamp || saved?.photoTimestamp || now,
      videoTimestamp: mediaBuffer.videoTimestamp || saved?.videoTimestamp || now,
    };
    
    // Stage 3: Gemini disabled. Stub a placeholder report for admin review.
    const report = job.checkInMedia
      ? "Quality review pending (manual)."
      : "Quality review pending (no check-in media).";
    
    onUpdateJob({ 
      ...job, 
      status: JobStatus.COMPLETED, 
      checkOutTime: now, 
      checkOutMedia, 
      qualityReport: report 
    });
    
    setIsProcessing(false);
    setMediaBuffer({});
    setActiveStep('report');
  };

  const handleQuickTransfer = (newAssigneeId: string) => {
      if (newAssigneeId === "") { onUpdateJob({ ...job, assigneeId: undefined, assigneeName: undefined }); }
      else {
          const employee = users.find(u => u.id === newAssigneeId);
          if (employee) onUpdateJob({ ...job, assigneeId: employee.id, assigneeName: employee.name });
      }
  };

  const submitCancellation = () => {
      if (!cancellationReason.trim()) return;
      onUpdateJob({ ...job, status: JobStatus.CANCELLED, assigneeId: undefined, assigneeName: undefined, cancellationReason: cancellationReason.trim() });
      setShowCancelModal(false);
  };

  const uploadIntakeMedia = async (files: FileList) => {
    if (!storage) return;
    const paths = job.intakeMediaPaths ? [...job.intakeMediaPaths] : [];
    const availableSlots = Math.max(0, 3 - paths.length);
    const selected = Array.from(files).slice(0, availableSlots);
    if (selected.length === 0) return;
    for (const file of selected) {
      const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const path = `schedulingsystem/jobs/${job.id}/intake/${safeName}`;
      const uploadRef = storageRef(storage, path);
      await uploadBytes(uploadRef, file);
      paths.push(path);
    }
    await onUpdateJob({ ...job, intakeMediaPaths: paths });
  };

  const handleGenerateSop = async () => {
    if (!functions) {
      setSopError('Functions not initialized. Check Firebase config.');
      return;
    }
    setSopError(null);
    setSopLoading(true);
    try {
      const callable = httpsCallable(functions, 'generateSopForJob');
      const result = await callable({ jobId: job.id });
      const sopId = (result.data as { sopId?: string })?.sopId || null;
      if (sopId) {
        await onUpdateJob({ ...job, sopId, status: JobStatus.SOP_NEEDS_REVIEW });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate SOP.';
      setSopError(message);
    } finally {
      setSopLoading(false);
    }
  };

  const approveSop = async () => {
    if (!db || !job.sopId) return;
    await setDoc(doc(db, 'sops', job.sopId), { qaStatus: 'APPROVED' }, { merge: true });
    await onUpdateJob({ ...job, status: JobStatus.APPROVED_FOR_POSTING });
  };

  const addTask = () => {
      if (!newTaskText.trim()) return;
      const isApproved = userRole === 'ADMIN';
      const newTask: Task = {
          id: Date.now().toString(),
          text: newTaskText.trim(),
          isCompleted: false,
          status: isApproved ? 'APPROVED' : 'PENDING',
          addedBy: userRole,
          actionTimestamp: new Date().toISOString()
      };
      onUpdateJob({ ...job, checklist: [...job.checklist, newTask] });
      setNewTaskText('');
      if (!isApproved) {
          onNotifyAdmin(`Task Request: "${newTask.text}" added to ${job.clientName}.`, job.id);
          alert("Task request sent for approval.");
      }
  };

  const toggleTask = (taskId: string) => {
    const task = job.checklist.find(t => t.id === taskId);
    if (task?.status === 'PENDING' && userRole === 'EMPLOYEE') return;
    const updatedChecklist = job.checklist.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t);
    onUpdateJob({ ...job, checklist: updatedChecklist });
  };

  const approveTask = (taskId: string) => {
      const updatedChecklist = job.checklist.map(t => t.id === taskId ? { ...t, status: 'APPROVED' as const, actionTimestamp: new Date().toISOString() } : t);
      onUpdateJob({ ...job, checklist: updatedChecklist });
  };

  const deleteTask = (taskId: string) => {
      const updatedChecklist = job.checklist.filter(t => t.id !== taskId);
      onUpdateJob({ ...job, checklist: updatedChecklist });
  };

  const sortedChecklist = [...job.checklist].sort((a,b) => {
      if (sortOption === 'alpha') return a.text.localeCompare(b.text);
      if (sortOption === 'status') return Number(a.isCompleted) - Number(b.isCompleted);
      return 0;
  });

  if (activeStep === 'report' && job.status === JobStatus.COMPLETED) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-center animate-fade-in">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-sm"><CheckCircle className="text-emerald-600 w-10 h-10" /></div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Great Work!</h2>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 w-full max-w-md text-left mb-6">
          {userRole === 'ADMIN' ? (
            <>
              <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">Quality Control Review</h3>
              <p className="text-sm text-slate-600 italic border-l-4 border-blue-500 pl-3 py-1">{job.qualityReport}</p>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-slate-800 mb-2">Checkout Successful</h3>
              <p className="text-sm text-slate-600">You've checked out and documented your work well. Thank you for your hard work today!</p>
            </>
          )}
        </div>
        <button onClick={onBack} className="w-full max-w-xs bg-blue-600 text-white font-semibold py-3.5 rounded-xl shadow">Back to Dashboard</button>
      </div>
    );
  }

  if (activeStep === 'checkin' || activeStep === 'checkout') {
    const isCheckIn = activeStep === 'checkin';
    const currentSavedMedia = isCheckIn ? job.checkInMedia : job.checkOutMedia;
    const hasPhoto = !!mediaBuffer.photoFrontOfHouse || !!currentSavedMedia?.photoFrontOfHouse;
    const hasVideo = !!mediaBuffer.videoGarage || !!currentSavedMedia?.videoGarage;
    const canSubmit = hasPhoto && hasVideo;

    return (
      <div className="min-h-screen bg-white pb-24 relative">
        <div className="bg-white border-b sticky top-0 z-10 p-4 flex items-center">
          <button onClick={() => setActiveStep('details')} className="p-2 hover:bg-slate-100 rounded-full mr-2 text-slate-600"><ArrowLeft size={20} /></button>
          <h2 className="font-bold text-lg text-slate-800">{isCheckIn ? 'Check In' : 'Check Out'}</h2>
        </div>
        <div className="p-4 space-y-6">
          <CameraCapture mode="photo" label="1. Front of House Photo" onCapture={(data, ts) => handleMediaCapture('photoFrontOfHouse', data, ts)} initialData={mediaBuffer.photoFrontOfHouse || currentSavedMedia?.photoFrontOfHouse} />
          <div className="flex justify-end"><button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg"><Upload size={14} className="inline mr-1" /> Upload Gallery</button><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} /></div>
          <CameraCapture mode="video" label="2. Garage Interior Video" onCapture={(data, ts) => handleMediaCapture('videoGarage', data, ts)} initialData={currentSavedMedia?.videoGarage} />
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t pb-8"><button onClick={isCheckIn ? submitCheckIn : () => setShowConfirmation(true)} disabled={!canSubmit} className={`w-full font-bold py-4 rounded-xl shadow-lg ${canSubmit ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>{isCheckIn ? 'Submit Check-In' : 'Complete Job'}</button></div>
        </div>
        {showConfirmation && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl"><h3 className="text-lg font-bold mb-2">Finish Job?</h3><p className="text-slate-600 mb-6">Submit documentation for quality control review?</p><div className="flex gap-3"><button onClick={() => setShowConfirmation(false)} className="flex-1 py-3 font-bold text-slate-600">Cancel</button><button onClick={processCheckOut} disabled={isProcessing} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl">{isProcessing ? <Loader2 className="animate-spin" size={20}/> : 'Confirm'}</button></div></div></div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 animate-in slide-in-from-right">
      <div className="bg-white border-b sticky top-0 z-10 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center"><button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 rounded-full mr-2 text-slate-600"><ArrowLeft size={20} /></button><div><h1 className="font-bold text-lg text-slate-800 leading-tight">Job Details</h1><p className="text-xs text-slate-400 font-medium">#{job.id.slice(-6)}</p></div></div>
        {userRole === 'ADMIN' && (<button onClick={() => setIsEditing(!isEditing)} className={`p-2 rounded-full ${isEditing ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-500'}`}><Pencil size={18} /></button>)}
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {userRole === 'ADMIN' && job.status !== JobStatus.CANCELLED && job.status !== JobStatus.COMPLETED && (
            <div className="bg-slate-800 rounded-xl p-4 shadow-lg text-white">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-200"><ShieldAlert size={14} className="text-blue-400"/> Admin Quick Actions</h3>
                <div className="space-y-3">
                    <div className="bg-slate-700/50 p-2 rounded-lg border border-slate-600">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Assign To</label>
                        <select className="w-full bg-transparent text-sm font-semibold text-white outline-none" value={job.assigneeId || ""} onChange={(e) => handleQuickTransfer(e.target.value)}>
                            <option value="" className="text-slate-800">Unassigned</option>
                            {users.filter(u => u.role === 'EMPLOYEE').map(u => (<option key={u.id} value={u.id} className="text-slate-800">{u.name}</option>))}
                        </select>
                    </div>
                    <div className="flex gap-3"><button onClick={() => setShowCancelModal(true)} className="flex-1 bg-red-500/20 border border-red-500/50 text-red-200 py-2 rounded-lg font-bold text-sm">Cancel Job</button></div>
                </div>
            </div>
        )}

        {userRole === 'ADMIN' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Intake Media</h3>
                <p className="text-xs text-slate-500">Attach 1–3 photos for SOP generation.</p>
              </div>
              <button
                onClick={() => intakeInputRef.current?.click()}
                className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg"
              >
                <Upload size={14} className="inline mr-1" />
                Upload
              </button>
              <input
                ref={intakeInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={(e) => e.target.files && uploadIntakeMedia(e.target.files)}
              />
            </div>
            {intakeUploads.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {intakeUploads.map((item) => (
                  <img key={item.path} src={item.url} alt="Intake" className="h-20 w-full object-cover rounded-lg border" />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex justify-between items-start mb-1"><h2 className={`text-xl font-bold ${job.status === JobStatus.CANCELLED ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{job.clientName}</h2><span className="text-xl font-black text-emerald-600">${job.pay}</span></div>
            <div className="flex items-start text-slate-500 text-sm mb-4"><MapPin size={16} className="mr-1.5 mt-0.5" />{job.address}</div>
            <div className="flex gap-2"><div className="bg-slate-100 rounded-lg px-3 py-2 text-xs font-medium text-slate-600"><Calendar size={14} className="inline mr-1" />{new Date(job.date).toLocaleDateString()}</div><div className="bg-slate-100 rounded-lg px-3 py-2 text-xs font-medium text-slate-600"><Clock size={14} className="inline mr-1" />{new Date(job.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div></div>
        </div>

        {userRole === 'ADMIN' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">SOP Generator</h3>
              <button
                onClick={handleGenerateSop}
                disabled={sopLoading}
                className={`text-xs font-bold px-3 py-2 rounded-lg ${sopLoading ? 'bg-slate-200 text-slate-500' : 'bg-blue-600 text-white'}`}
              >
                {sopLoading ? 'Generating...' : 'Generate SOP (AI)'}
              </button>
            </div>
            {sopError && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-2">
                {sopError}
              </div>
            )}
            {sopData && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>QA Status: {sopData.qaStatus}</span>
                  {sopData.qaStatus !== 'APPROVED' && (
                    <button onClick={approveSop} className="text-xs font-bold text-emerald-600">Approve SOP</button>
                  )}
                </div>
                <div className="space-y-2">
                  {sopData.sections.map((section) => (
                    <div key={section.title} className="border border-slate-100 rounded-lg p-3">
                      <h4 className="font-semibold text-sm text-slate-800 mb-2">{section.title}</h4>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {section.steps.map((step) => (
                          <li key={step.id} className="flex items-start gap-2">
                            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-slate-300" />
                            <span>{step.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {sopData.requiredPhotos.length > 0 && (
                  <div className="text-xs text-slate-600">
                    <div className="font-semibold text-slate-700 mb-1">Required Photos</div>
                    <ul className="list-disc list-inside space-y-1">
                      {sopData.requiredPhotos.map((photo) => (
                        <li key={photo.key}>{photo.label} {photo.required ? '(required)' : ''}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quality Report Section (Admin Only) */}
        {userRole === 'ADMIN' && job.status === JobStatus.COMPLETED && job.qualityReport && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 shadow-sm animate-in fade-in">
                <h3 className="text-blue-800 font-bold text-sm mb-2 flex items-center gap-2">
                    <CheckCircle size={16} /> Quality Control Analysis
                </h3>
                <p className="text-sm text-blue-700 leading-relaxed italic border-l-2 border-blue-300 pl-3">
                    {job.qualityReport}
                </p>
            </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-4 bg-slate-50 border-b flex justify-between items-center"><h3 className="font-bold text-slate-800 flex items-center gap-2"><CheckSquare size={18} className="text-blue-600"/> Checklist</h3></div>
             <div className="divide-y divide-slate-100">
                 {sortedChecklist.map(task => (
                     <div key={task.id} className={`p-4 flex items-start gap-3 ${task.isCompleted ? 'bg-slate-50' : 'bg-white'}`}>
                         <button disabled={job.status === JobStatus.COMPLETED || task.status === 'PENDING'} onClick={() => toggleTask(task.id)} className={`mt-0.5 ${task.status === 'PENDING' ? 'text-orange-300' : task.isCompleted ? 'text-blue-600' : 'text-slate-300'}`}>
                             {task.status === 'PENDING' ? <Clock size={20} /> : task.isCompleted ? <CheckSquare size={20} /> : <Square size={20} />}
                         </button>
                         <div className="flex-1">
                             <p className={`text-sm font-medium ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.text}</p>
                             {task.status === 'PENDING' && (
                                 <div className="flex items-center gap-2 mt-1">
                                     <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">WAITING FOR ADMIN</span>
                                     {userRole === 'ADMIN' && (<button onClick={() => approveTask(task.id)} className="text-[10px] font-bold text-green-600 uppercase">Approve</button>)}
                                 </div>
                             )}
                         </div>
                         {userRole === 'ADMIN' && (<button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>)}
                     </div>
                 ))}
                 {job.status !== JobStatus.COMPLETED && (
                     <div className="p-3 bg-slate-50 flex gap-2">
                         <input type="text" placeholder="Add task..." className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
                         <button onClick={addTask} className="bg-blue-600 text-white rounded-lg px-3"><Plus size={20} /></button>
                     </div>
                 )}
             </div>
        </div>

        {job.status === JobStatus.UPCOMING && job.assigneeId === currentUserId && (<button onClick={() => setActiveStep('checkin')} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg">Start Job (Check In)</button>)}
        {job.status === JobStatus.IN_PROGRESS && job.assigneeId === currentUserId && (<button onClick={() => setActiveStep('checkout')} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg">Complete Job (Check Out)</button>)}
      </div>

      {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-6 max-w-sm w-full"><h3 className="text-lg font-bold mb-4 text-rose-600">Cancel Job?</h3><textarea className="w-full border p-3 text-sm mb-4" rows={3} placeholder="Reason..." value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)} /><div className="flex gap-3"><button onClick={() => setShowCancelModal(false)} className="flex-1 font-bold text-slate-500">Back</button><button onClick={submitCancellation} disabled={!cancellationReason.trim()} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl">Confirm</button></div></div></div>
      )}
    </div>
  );
};
