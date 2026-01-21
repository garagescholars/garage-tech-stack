import React, { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { collection, onSnapshot, orderBy, query, updateDoc, doc } from "firebase/firestore";
import { functions, db } from "../firebase";
import { useAuth } from "../auth/AuthProvider";

type SignupRequest = {
  id: string;
  email: string;
  name: string;
  roleRequested: string;
  status: "pending" | "approved" | "declined";
  createdAt?: { seconds?: number };
};

type AdminNotification = {
  id: string;
  message: string;
  unread: boolean;
  createdAt?: { seconds?: number };
};

type UserRow = {
  id: string;
  name: string;
  role: "admin" | "scholar";
  status: string;
};

const AdminDashboard: React.FC = () => {
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [scholars, setScholars] = useState<UserRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setViewAsUid } = useAuth();

  useEffect(() => {
    if (!db) return;
    const reqQuery = query(collection(db, "signupRequests"), orderBy("createdAt", "desc"));
    const unsubRequests = onSnapshot(reqQuery, (snap) => {
      const rows = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<SignupRequest, "id">)
      }));
      setRequests(rows);
    });

    const notifQuery = query(collection(db, "adminNotifications"), orderBy("createdAt", "desc"));
    const unsubNotifs = onSnapshot(notifQuery, (snap) => {
      const rows = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<AdminNotification, "id">)
      }));
      setNotifications(rows);
    });

    const usersQuery = query(collection(db, "users"));
    const unsubUsers = onSnapshot(usersQuery, (snap) => {
      const rows = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<UserRow, "id">)
      })).filter((user) => user.role === "scholar" && user.status === "active");
      setScholars(rows);
    });

    return () => {
      unsubRequests();
      unsubNotifs();
      unsubUsers();
    };
  }, []);

  const markNotificationRead = async (id: string) => {
    if (!db) return;
    await updateDoc(doc(db, "adminNotifications", id), { unread: false });
  };

  const handleDecision = async (requestId: string, action: "approve" | "decline") => {
    if (!functions) {
      setError("Functions not initialized.");
      return;
    }
    setError(null);
    setBusyId(requestId);
    try {
      const callable = httpsCallable(functions, action === "approve" ? "approveSignup" : "declineSignup");
      await callable({ requestId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed.";
      setError(message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
            <p className="text-sm text-slate-500">Approve new account requests.</p>
          </div>
        </header>

        {error && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-sm">View As Scholar</h2>
            <button onClick={() => setViewAsUid(null)} className="text-xs text-slate-500">Clear</button>
          </div>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            onChange={(e) => setViewAsUid(e.target.value || null)}
            defaultValue=""
          >
            <option value="">Select scholar...</option>
            {scholars.map((scholar) => (
              <option key={scholar.id} value={scholar.id}>{scholar.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-bold text-slate-800 text-sm mb-3">Pending Signup Requests</h2>
          {requests.filter(r => r.status === "pending").length === 0 ? (
            <div className="text-sm text-slate-500">No pending requests.</div>
          ) : (
            <div className="space-y-3">
              {requests.filter(r => r.status === "pending").map((request) => (
                <div key={request.id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{request.name}</div>
                    <div className="text-xs text-slate-500">{request.email}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecision(request.id, "approve")}
                      disabled={busyId === request.id}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecision(request.id, "decline")}
                      disabled={busyId === request.id}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-600 text-white"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-bold text-slate-800 text-sm mb-3">Admin Notifications</h2>
          {notifications.length === 0 ? (
            <div className="text-sm text-slate-500">No notifications.</div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`border rounded-lg p-3 text-sm ${notif.unread ? "border-blue-200 bg-blue-50" : "border-slate-100"}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{notif.message}</span>
                    {notif.unread && (
                      <button onClick={() => markNotificationRead(notif.id)} className="text-xs text-blue-600 font-semibold">
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
