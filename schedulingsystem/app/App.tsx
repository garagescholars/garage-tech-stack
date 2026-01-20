
import React, { useState, useEffect, useMemo } from 'react';
import { Job, MOCK_JOBS, Notification as AppNotification, JobStatus, User as UserType, MOCK_USERS } from './types';
import JobCard from './components/JobCard';
import { JobDetail } from './views/JobDetail';
import UserProfile from './views/UserProfile';
import PendingApprovals from './views/PendingApprovals';
import { broadcastMilestone, requestSmsPermissions, SmsRecipient } from './services/smsService';
import { 
    Bell, Search, User, X, Check, Calendar as CalendarIcon, List, Timer, 
    ClipboardList, ArrowRight, Users, ChevronLeft, ChevronRight, 
    TrendingUp, DollarSign, Target, Trophy, MessageSquare, 
    PartyPopper, Flame, Rocket, Medal, Star, Send, Plus, 
    MapPin, Clock, Filter, RotateCcw, AlertTriangle, UserCog, 
    CalendarDays, Ban, Smartphone, CheckCircle2, Loader2, SignalHigh,
    ClipboardCheck
} from 'lucide-react';

const CURRENT_USER_ID = 'user-1';

const MOCK_USERS_WITH_LOW_GOAL = MOCK_USERS.map(u => 
  u.id === CURRENT_USER_ID ? { ...u, monthlyGoal: 300 } : u
);

interface SmsLogEntry {
    id: string;
    to: string;
    userName: string;
    message: string;
    timestamp: string;
    status: 'SENDING' | 'DELIVERED';
}

const App: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [users, setUsers] = useState<UserType[]>(MOCK_USERS_WITH_LOW_GOAL);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showPendingView, setShowPendingView] = useState(false);
  
  const [manualNotifications, setManualNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [userRole, setUserRole] = useState<'EMPLOYEE' | 'ADMIN'>('EMPLOYEE');
  const [activeTab, setActiveTab] = useState<'MY_JOBS' | 'AVAILABLE'>('MY_JOBS');
  
  const [smsBroadcast, setSmsBroadcast] = useState<string | null>(null);
  const [smsHistory, setSmsHistory] = useState<SmsLogEntry[]>([]);
  const [carrierStatus, setCarrierStatus] = useState<'CONNECTED' | 'DISCONNECTED'>('DISCONNECTED');
  
  const [adminViewMode, setAdminViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');
  const [calendarDate, setCalendarDate] = useState(new Date());

  const [filterConfig, setFilterConfig] = useState({ status: 'ALL', assignee: 'ALL', startDate: '', endDate: '' });

  const [adminActionState, setAdminActionState] = useState<{ type: 'TRANSFER' | 'RESCHEDULE' | 'CANCEL'; job: Job; } | null>(null);
  const [actionInputValue, setActionInputValue] = useState('');
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [newJobForm, setNewJobForm] = useState({ clientName: '', address: '', date: '', time: '09:00', pay: '', description: '', assigneeId: '' });

  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);

  // --- Initialize SMS Carrier ---
  useEffect(() => {
      const initSms = async () => {
          await requestSmsPermissions();
          setCarrierStatus('CONNECTED');
      };
      initSms();
  }, []);

  const totalPendingTasks = jobs.reduce((acc, job) => 
    acc + job.checklist.filter(t => t.status === 'PENDING').length, 0
  );

  const currentEarnings = useMemo(() => {
    return jobs
      .filter(j => j.assigneeId === CURRENT_USER_ID && j.status === JobStatus.COMPLETED)
      .reduce((sum, j) => sum + j.pay, 0);
  }, [jobs]);

  const progressPercent = useMemo(() => {
    const user = users.find(u => u.id === CURRENT_USER_ID);
    if (!user || user.monthlyGoal <= 0) return 0;
    return Math.min(100, (currentEarnings / user.monthlyGoal) * 100);
  }, [currentEarnings, users]);

  // --- Milestone Logic ---
  useEffect(() => {
    let updatedUsers = [...users];
    let hasUpdates = false;
    let newCelebrations: AppNotification[] = [];

    const processMilestones = async () => {
        const resultUsers = await Promise.all(updatedUsers.map(async (user) => {
            if (user.role !== 'EMPLOYEE') return user;
            const earnings = jobs
                .filter(j => j.assigneeId === user.id && j.status === JobStatus.COMPLETED)
                .reduce((sum, j) => sum + j.pay, 0);
            const percentage = user.monthlyGoal > 0 ? (earnings / user.monthlyGoal) * 100 : 0;
            let milestoneHit = 0;
            if (percentage >= 100) milestoneHit = 100;
            else if (percentage >= 90) milestoneHit = 90;
            else if (percentage >= 80) milestoneHit = 80;

            if (milestoneHit > 0 && !user.achievedMilestones.includes(milestoneHit)) {
                hasUpdates = true;
                const recipients: SmsRecipient[] = users
                    .filter(u => u.phoneNumber)
                    .map(u => ({ name: u.name, phoneNumber: u.phoneNumber! }));
                setSmsBroadcast(`BROADCASTING: Milestone hit! Texting ${recipients.length} team members...`);
                const smsResults = await broadcastMilestone(user.name, milestoneHit, earnings, recipients);
                const logEntries: SmsLogEntry[] = smsResults.map(res => ({
                    id: `sms-${Date.now()}-${res.phoneNumber}`,
                    to: res.phoneNumber,
                    userName: res.name,
                    message: res.message,
                    timestamp: res.timestamp,
                    status: 'DELIVERED'
                }));
                setSmsHistory(prev => [...logEntries, ...prev].slice(0, 50));
                setSmsBroadcast(`SUCCESS: Texts delivered to ${recipients.map(r => r.name.split(' ')[0]).join(', ')}.`);
                setTimeout(() => setSmsBroadcast(null), 5000);
                newCelebrations.push({
                    id: `cel-${Date.now()}-${user.id}-${milestoneHit}`,
                    jobId: 'celebration',
                    message: smsResults[0]?.message || 'Goal Reached!',
                    type: 'CELEBRATION',
                    isRead: false,
                    timestamp: new Date().toISOString()
                });
                return { ...user, achievedMilestones: [...user.achievedMilestones, milestoneHit] };
            }
            return user;
        }));
        if (hasUpdates) {
            setUsers(resultUsers);
            setManualNotifications(prev => [...newCelebrations, ...prev]);
        }
    };
    processMilestones();
  }, [jobs]);

  const generatedNotifications = useMemo(() => {
      const rawNotifications: AppNotification[] = [];
      const now = Date.now();

      jobs.forEach(job => {
        if (userRole === 'EMPLOYEE' && job.assigneeId !== CURRENT_USER_ID) return;
        if (job.status === JobStatus.UPCOMING) {
          const jobTime = new Date(job.date).getTime();
          const diffDays = (jobTime - now) / (1000 * 60 * 60 * 24);
          if (diffDays <= 3 && diffDays > 1.5) {
              rawNotifications.push({ id: `notif-${job.id}-3d`, jobId: job.id, message: `Upcoming Job: ${job.clientName} in 3d.`, type: '3_DAY', isRead: false, timestamp: new Date().toISOString() });
          }
        }
      });

      // CORE SYSTEM: Generate Admin Notification for Pending Tasks
      if (userRole === 'ADMIN' && totalPendingTasks > 0) {
          rawNotifications.push({ 
              id: 'pending-tasks-alert', 
              jobId: 'admin-action', 
              message: `Action Required: ${totalPendingTasks} pending task request(s) to approve.`, 
              type: 'CHECKLIST_REQUEST', 
              isRead: false, 
              timestamp: new Date().toISOString() 
          });
      }
      return rawNotifications;
  }, [jobs, userRole, totalPendingTasks]);

  const notifications = useMemo(() => {
      const combined = [...manualNotifications, ...generatedNotifications];
      const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
      return unique
        .filter(n => !dismissedIds.includes(n.id))
        .map(n => ({ ...n, isRead: readIds.includes(n.id) }))
        .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [manualNotifications, generatedNotifications, dismissedIds, readIds]);

  const handleJobUpdate = (updatedJob: Job) => setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
  
  const handleManualNotification = (message: string, jobId: string) => {
      const newNotif: AppNotification = { 
          id: `checklist-${Date.now()}`, 
          jobId, 
          message, 
          type: 'CHECKLIST_REQUEST', 
          isRead: false, 
          timestamp: new Date().toISOString() 
      };
      setManualNotifications(prev => [newNotif, ...prev]);
  };

  const handleAdminTaskAction = (type: 'APPROVED' | 'REJECTED', jobName: string, taskText: string, jobId: string) => {
      // 1. Show confirmation toast
      setSmsBroadcast(`ADMIN DECISION: Task "${taskText}" for ${jobName} was ${type}. Sending scholar alert...`);
      setTimeout(() => setSmsBroadcast(null), 4000);

      // 2. Create persistent notification for the scholar
      const responseNotif: AppNotification = {
          id: `response-${Date.now()}`,
          jobId: jobId,
          message: `Task ${type}: "${taskText}" for ${jobName} has been ${type.toLowerCase()} by Admin.`,
          type: 'CHECKLIST_REQUEST', 
          isRead: false,
          timestamp: new Date().toISOString()
      };
      setManualNotifications(prev => [responseNotif, ...prev]);
  };

  const handleMarkAllRead = () => setReadIds(prev => [...new Set([...prev, ...notifications.map(n => n.id)])]);
  
  const handleNotificationClick = (jobId: string, notifId: string) => {
    setReadIds(prev => [...prev, notifId]);
    if (jobId === 'admin-action') {
        setShowPendingView(true);
    } else if (jobId !== 'celebration' && jobId !== 'system') {
        setSelectedJobId(jobId);
    }
    setShowNotifications(false);
  };

  const handleAdminActionClick = (action: 'TRANSFER' | 'RESCHEDULE' | 'CANCEL', job: Job, e: React.MouseEvent) => {
      e.stopPropagation();
      if (action === 'TRANSFER') setActionInputValue(job.assigneeId || '');
      if (action === 'RESCHEDULE') setActionInputValue(new Date(job.date).toISOString().slice(0, 16));
      if (action === 'CANCEL') { setActionInputValue(''); setIsConfirmingAction(false); }
      setAdminActionState({ type: action, job });
  };

  const submitAdminAction = () => {
      if (!adminActionState) return;
      const { type, job } = adminActionState;
      let updatedJob = { ...job };
      if (type === 'TRANSFER') {
          const user = users.find(u => u.id === actionInputValue);
          updatedJob.assigneeId = user?.id; updatedJob.assigneeName = user?.name;
      } else if (type === 'RESCHEDULE') {
          updatedJob.date = new Date(actionInputValue).toISOString();
      } else if (type === 'CANCEL') {
          updatedJob.status = JobStatus.CANCELLED; updatedJob.assigneeId = undefined; updatedJob.assigneeName = undefined; updatedJob.cancellationReason = actionInputValue;
      }
      setJobs(prev => prev.map(j => j.id === job.id ? updatedJob : j));
      setAdminActionState(null);
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (showPendingView && userRole === 'ADMIN') return (<PendingApprovals jobs={jobs} onUpdateJob={handleJobUpdate} onBack={() => setShowPendingView(false)} onTaskAction={handleAdminTaskAction} />);
  if (selectedJob) return (<JobDetail job={selectedJob} users={users} onBack={() => setSelectedJobId(null)} onUpdateJob={handleJobUpdate} onNotifyAdmin={handleManualNotification} userRole={userRole} />);
  if (showProfile) return (<UserProfile onBack={() => setShowProfile(false)} userRole={userRole} setUserRole={setUserRole} users={users} setUsers={setUsers} jobs={jobs} />);

  const masterList = [...jobs].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const myJobs = masterList.filter(j => j.assigneeId === CURRENT_USER_ID);
  const availableJobs = masterList.filter(j => !j.assigneeId && j.status !== JobStatus.CANCELLED);
  const displayedJobs = userRole === 'ADMIN' ? masterList : (activeTab === 'MY_JOBS' ? myJobs : availableJobs);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative">
      {/* Network Alert Toast */}
      {smsBroadcast && (
          <div className="fixed top-20 left-4 right-4 z-50 animate-in slide-in-from-top-4 fade-in">
             <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 border-l-4 border-emerald-500">
                <SignalHigh className="text-emerald-400 mt-0.5" size={20} />
                <div>
                   <h4 className="font-bold text-[10px] text-emerald-400 uppercase tracking-widest mb-1">Carrier Dispatch Log</h4>
                   <p className="text-sm font-medium leading-tight">{smsBroadcast}</p>
                </div>
             </div>
          </div>
      )}

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
          <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm"><span className="text-white font-bold text-lg">S</span></div><h1 className="font-bold text-lg tracking-tight">Scholar Hub</h1></div>
              <div className="flex items-center gap-3">
                  {userRole === 'ADMIN' && (<span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide border border-amber-200">Admin</span>)}
                  <button className="relative p-2" onClick={() => setShowNotifications(!showNotifications)}><Bell size={20} className="text-slate-600" />{unreadCount > 0 && (<span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>)}</button>
                  <button onClick={() => setShowProfile(true)} className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500"><User size={18} /></button>
              </div>
          </div>
          {showNotifications && (
            <div className="absolute top-16 right-0 left-0 bg-white border-b shadow-lg z-30 animate-in slide-in-from-top-2">
                <div className="max-w-md mx-auto">
                    <div className="p-3 bg-slate-50 border-b flex justify-between items-center"><span className="text-xs font-semibold text-slate-500 uppercase">Notifications</span><button onClick={handleMarkAllRead} className="text-xs font-medium text-blue-600">Mark all read</button></div>
                    <div className="max-h-[60vh] overflow-y-auto">{notifications.length === 0 ? (<div className="p-8 text-center text-slate-500 text-sm">No new alerts</div>) : (notifications.map(n => (<div key={n.id} onClick={() => handleNotificationClick(n.jobId, n.id)} className={`p-4 border-b flex gap-3 cursor-pointer ${n.isRead ? 'bg-white opacity-70' : 'bg-blue-50/40'}`}><div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${n.type === 'CELEBRATION' ? 'bg-amber-500' : 'bg-blue-500'}`} /><div className="flex-grow pr-6"><p className="text-sm text-slate-800">{n.type === 'CELEBRATION' && <Trophy size={14} className="inline mr-1 text-amber-600"/>}{n.message}</p></div></div>)))}</div>
                </div>
            </div>
          )}
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {userRole === 'EMPLOYEE' ? (
             <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg">
                <h2 className="text-2xl font-bold mb-4">Hello, {users.find(u => u.id === CURRENT_USER_ID)?.name.split(' ')[0]} 👋</h2>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="flex justify-between items-end mb-2"><span className="text-xs font-bold text-blue-100 uppercase">Goal Tracker</span><span className="text-sm font-bold">${currentEarnings} / 300</span></div>
                    <div className="w-full bg-black/20 rounded-full h-2.5 overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${progressPercent >= 100 ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${progressPercent}%` }}></div></div>
                </div>
             </div>
        ) : (
            <div className="space-y-4">
                {/* Admin Pending Task Alert Card */}
                {totalPendingTasks > 0 && (
                    <button 
                        onClick={() => setShowPendingView(true)}
                        className="w-full bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between text-left shadow-sm animate-pulse active:scale-95 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-500 text-white p-2 rounded-lg">
                                <ClipboardCheck size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-orange-900 text-sm">Action Required</h3>
                                <p className="text-xs text-orange-700">{totalPendingTasks} task request(s) waiting for approval.</p>
                            </div>
                        </div>
                        <ArrowRight size={18} className="text-orange-400" />
                    </button>
                )}

                {/* Admin SMS Center */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Smartphone size={20} className="text-blue-600" /> Real-Time SMS Outbox
                        </h3>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${carrierStatus === 'CONNECTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${carrierStatus === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                            Carrier {carrierStatus}
                        </div>
                    </div>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {smsHistory.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 flex flex-col items-center gap-2">
                                <MessageSquare size={32} className="opacity-20" />
                                <p className="text-xs italic">Waiting for team milestones...</p>
                            </div>
                        ) : (
                            smsHistory.map(log => (
                                <div key={log.id} className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase">To: {log.userName}</span>
                                            <p className="text-xs font-bold text-blue-600 font-mono tracking-tighter">{log.to}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                <CheckCircle2 size={10} /> 200 OK
                                            </div>
                                            <span className="text-[8px] text-slate-400 block mt-1">{new Date(log.timestamp).toLocaleTimeString([], {hour:'numeric', minute:'2-digit', second:'2-digit'})}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-snug mt-2 pt-2 border-t border-slate-100">{log.message}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-slate-800 rounded-2xl p-6 text-white shadow-lg">
                    <h2 className="text-2xl font-bold mb-1">Master Schedule</h2>
                    <div className="mt-4 flex gap-2">
                        <button onClick={() => setAdminViewMode('LIST')} className={`flex-1 py-3 rounded-lg text-sm font-medium ${adminViewMode === 'LIST' ? 'bg-slate-700 text-white shadow-inner' : 'text-slate-400'}`}><List size={16} className="inline mr-2" /> List</button>
                        <button onClick={() => setAdminViewMode('CALENDAR')} className={`flex-1 py-3 rounded-lg text-sm font-medium ${adminViewMode === 'CALENDAR' ? 'bg-slate-700 text-white shadow-inner' : 'text-slate-400'}`}><CalendarIcon size={16} className="inline mr-2" /> Calendar</button>
                    </div>
                </div>
            </div>
        )}

        {userRole === 'EMPLOYEE' && (<div className="flex bg-white rounded-xl p-1 shadow-sm border"><button onClick={() => setActiveTab('MY_JOBS')} className={`flex-1 py-3 text-sm font-medium rounded-lg ${activeTab === 'MY_JOBS' ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}>My Schedule</button><button onClick={() => setActiveTab('AVAILABLE')} className={`flex-1 py-3 text-sm font-medium rounded-lg ${activeTab === 'AVAILABLE' ? 'bg-orange-50 text-orange-700' : 'text-slate-500'}`}>Job Board 🔥</button></div>)}

        <div className="space-y-4">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Search operations..." className="w-full bg-white border rounded-xl py-3.5 pl-10 pr-4 text-sm" /></div>
            {displayedJobs.map(job => (<JobCard key={job.id} job={job} onClick={() => setSelectedJobId(job.id)} isAdmin={userRole === 'ADMIN'} onAdminAction={handleAdminActionClick} />))}
        </div>
      </main>

      {userRole === 'ADMIN' && (<button onClick={() => setShowAddJobModal(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-all"><Plus size={28} /></button>)}
      
      {adminActionState && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <h3 className="text-lg font-bold mb-4">{adminActionState.type} Operation</h3>
                  {adminActionState.type === 'TRANSFER' && (
                      <select className="w-full border rounded-xl p-3 mb-6" value={actionInputValue} onChange={(e) => setActionInputValue(e.target.value)}><option value="">Unassigned</option>{users.map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}</select>
                  )}
                  {adminActionState.type === 'RESCHEDULE' && (<input type="datetime-local" className="w-full border rounded-xl p-3 mb-6" value={actionInputValue} onChange={(e) => setActionInputValue(e.target.value)}/>)}
                  <button onClick={submitAdminAction} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">Confirm Changes</button>
                  <button onClick={() => setAdminActionState(null)} className="w-full mt-2 text-slate-400 text-sm py-2">Back</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
