import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Package, Plus, LogOut, LayoutGrid, Settings as SettingsIcon, MessageSquare, Menu, X, DollarSign, TrendingUp, Archive, Bell } from 'lucide-react';

// COMPONENTS
import AddListingModal from './components/AddListingModal';
import Login from './components/Login';
import MessagesView from './components/MessagesView';

// --- SECURITY CONFIG ---
const ALLOWED_EMAILS = [
  "tylerzsodia@gmail.com", 
  "zach.harmon25@gmail.com",
  "garagescholars@gmail.com" 
];

function App() {
  // Auth State
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // App Data State
  const [inventory, setInventory] = useState([]);
  const [soldInventory, setSoldInventory] = useState([]); 
  const [conversations, setConversations] = useState([]); // <--- NEW: Track messages for dashboard
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // 1. CHANGE DEFAULT TAB TO DASHBOARD
  const [activeTab, setActiveTab] = useState('dashboard'); 
  
  // Mobile State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // LISTEN TO AUTH CHANGES
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (ALLOWED_EMAILS.includes(currentUser.email)) {
            setUser(currentUser);
            setIsAuthorized(true);
        } else {
            alert("ACCESS DENIED: You are not on the Garage Scholars whitelist.");
            signOut(auth);
            setUser(null);
            setIsAuthorized(false);
        }
      } else {
        setUser(null);
        setIsAuthorized(false);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // FETCH ACTIVE INVENTORY
  useEffect(() => {
    if (!user || !isAuthorized) return;
    const q = query(collection(db, "inventory"), orderBy("dateListed", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInventory(items);
    });
    return () => unsubscribe();
  }, [user, isAuthorized]);

  // FETCH SOLD INVENTORY
  useEffect(() => {
    if (!user || !isAuthorized) return;
    const q = query(collection(db, "sold_inventory"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSoldInventory(items);
    });
    return () => unsubscribe();
  }, [user, isAuthorized]);

  // FETCH CONVERSATIONS (For Dashboard Stats)
  useEffect(() => {
    if (!user || !isAuthorized) return;
    const q = query(collection(db, "conversations"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setConversations(convos);
    });
    return () => unsubscribe();
  }, [user, isAuthorized]);


  // --- CALCULATE DASHBOARD STATS ---
  const activeValue = inventory.reduce((sum, item) => {
    const price = parseFloat(item.price || 0);
    return sum + (isNaN(price) ? 0 : price);
  }, 0);

  const grossRevenue = soldInventory.reduce((sum, item) => {
    const price = parseFloat(item.price || 0);
    return sum + (isNaN(price) ? 0 : price);
  }, 0);

  const totalItemsSold = soldInventory.length;
  // Only count if isUnread is TRUE
const unreadCount = conversations.filter(c => c.isUnread === true).length;

  // --- RENDER LOGIC ---
  if (loadingAuth) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading Security...</div>;
  if (!user || !isAuthorized) return <Login />;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* --- MOBILE HEADER --- */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-40">
        <h1 className="text-lg font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
            Garage Scholars
        </h1>
        <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-300">
            <Menu size={24} />
        </button>
      </div>

      {/* --- SIDEBAR --- */}
      <div className={`
        fixed inset-0 z-50 bg-slate-950/95 transition-transform duration-300 md:relative md:translate-x-0 md:bg-slate-950/50 md:w-64 md:border-r md:border-slate-800 md:flex md:flex-col
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent hidden md:block">
                Garage Scholars
            </h1>
            <h1 className="text-2xl font-bold text-white md:hidden">Menu</h1>
            <p className="text-xs text-slate-500 mt-1 hidden md:block">Internal Hub</p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400">
            <X size={28} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 md:mt-0">
          <SidebarItem icon={<LayoutGrid size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} />
          <SidebarItem icon={<Package size={20} />} label="Inventory" active={activeTab === 'inventory'} onClick={() => { setActiveTab('inventory'); setIsMobileMenuOpen(false); }} />
          <SidebarItem icon={<MessageSquare size={20} />} label="Messages" active={activeTab === 'messages'} onClick={() => { setActiveTab('messages'); setIsMobileMenuOpen(false); }} />
          <SidebarItem icon={<SettingsIcon size={20} />} label="Settings" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} />
        </nav>

        <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 mb-4 px-2">
                <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="User" />
                <div className="text-sm overflow-hidden">
                    <p className="text-white font-medium truncate">{user.displayName}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
            </div>
            <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors w-full px-2 py-2 rounded hover:bg-slate-800">
                <LogOut size={18} />
                <span>Logout</span>
            </button>
        </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative pt-16 md:pt-0">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {/* VIEW: DASHBOARD */}
          {activeTab === 'dashboard' && (
             <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
                
                {/* METRIC CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Active Listings */}
                    <DashboardCard title="Active Listings" value={inventory.length} icon={<Package className="text-blue-400" />} />
                    
                    {/* Card 2: Portfolio Value */}
                    <DashboardCard title="Portfolio Value" value={`$${activeValue.toLocaleString()}`} icon={<TrendingUp className="text-purple-400" />} />

                    {/* Card 3: Unread Messages (New) */}
                    <DashboardCard title="Unread Messages" value={unreadCount} icon={<Bell className="text-yellow-400" />} />

                    {/* Card 4: Gross Revenue */}
                    <DashboardCard title="Gross Revenue" value={`$${grossRevenue.toLocaleString()}`} icon={<DollarSign className="text-emerald-400" />} highlight={true}/>
                </div>

                {/* RECENT SALES LIST */}
                <div className="mt-8">
                    <h3 className="text-lg font-bold text-slate-400 mb-4">Recent Sales</h3>
                    {soldInventory.length === 0 ? (
                        <div className="p-8 text-center border border-slate-800 rounded-xl border-dashed text-slate-600">
                            No sales yet. Go sell something!
                        </div>
                    ) : (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                            {soldInventory.slice(0, 5).map((item) => (
                                <div key={item.id} className="flex justify-between items-center p-4 border-b border-slate-800 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-800 rounded overflow-hidden">
                                            {item.imageUrls?.[0] && <img src={item.imageUrls[0]} className="w-full h-full object-cover" alt="" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{item.title}</p>
                                            <p className="text-xs text-slate-500">{item.dateSold || 'Unknown Date'}</p>
                                        </div>
                                    </div>
                                    <span className="font-mono text-emerald-400">+${item.price}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
             </div>
          )}

          {/* VIEW: MESSAGES */}
          {activeTab === 'messages' && (
              <MessagesView />
          )}

          {/* VIEW: INVENTORY */}
          {activeTab === 'inventory' && (
            <>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Inventory</h2>
                    <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-teal-500/20 text-sm md:text-base">
                    <Plus size={20} />
                    <span className="hidden md:inline">New Listing</span>
                    <span className="md:hidden">New</span>
                    </button>
                </div>

                {/* SCROLLABLE TABLE CONTAINER */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <div className="min-w-[800px]"> 
                            <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <div className="col-span-4">Item Name</div>
                                <div className="col-span-2">Price</div>
                                <div className="col-span-2">Date Listed</div>
                                <div className="col-span-2">Client</div>
                                <div className="col-span-1">Platform</div>
                                <div className="col-span-1 text-right">Status</div>
                            </div>

                            <div className="divide-y divide-slate-800">
                            {inventory.map((item) => (
                                <div key={item.id} onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-800/50 transition-colors cursor-pointer group">
                                <div className="col-span-4 flex items-center gap-3">
                                    <div className="w-12 h-12 rounded bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-700">
                                    {item.imageUrls && item.imageUrls.length > 0 ? (
                                        <img src={item.imageUrls.find(u => !u.toLowerCase().includes('.heic')) || item.imageUrls[0]} alt={item.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600"><Package size={20} /></div>
                                    )}
                                    </div>
                                    <span className="font-medium text-white group-hover:text-teal-400 transition-colors truncate">{item.title}</span>
                                </div>
                                <div className="col-span-2 font-mono text-teal-400">${item.price}</div>
                                <div className="col-span-2 text-slate-400 text-sm">{item.dateListed}</div>
                                <div className="col-span-2 text-slate-400 text-sm">{item.clientName || '-'}</div>
                                <div className="col-span-1">
                                    <span className={`text-xs px-2 py-1 rounded border ${item.platform.includes('Both') ? 'bg-purple-500/10 border-purple-500/50 text-purple-400' : 'bg-blue-500/10 border-blue-500/50 text-blue-400'}`}>
                                    {item.platform === 'Both' ? 'Both' : (item.platform.includes('FB') ? 'FB' : 'CL')}
                                    </span>
                                </div>
                                <div className="col-span-1 text-right">
                                    <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/50 text-emerald-400">Active</span>
                                </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    </div>
                </div>
            </>
          )}

        </div>
      </div>

      <AddListingModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialData={editingItem}
      />

    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function DashboardCard({ title, value, icon, highlight }) {
    return (
        <div className={`border p-6 rounded-xl shadow-lg flex items-center gap-4 ${highlight ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-900 border-slate-800'}`}>
            <div className={`p-3 rounded-full border ${highlight ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-slate-950 border-slate-800'}`}>
                {icon}
            </div>
            <div>
                <p className={`text-xs uppercase font-bold tracking-wider ${highlight ? 'text-emerald-400' : 'text-slate-500'}`}>{title}</p>
                <p className={`text-2xl font-bold ${highlight ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
            </div>
        </div>
    );
}

export default App;