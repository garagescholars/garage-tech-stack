import React, { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { collection, onSnapshot, orderBy, query, updateDoc, doc, where, setDoc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { useNavigate, Link } from "react-router-dom";
import { functions, db, storage } from "../firebase";
import { useAuth } from "../auth/AuthProvider";
import { JobStatus } from "../../types";
import { DollarSign } from "lucide-react";

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

type JobForReview = {
  id: string;
  clientName: string;
  pay: number;
  assigneeName?: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInMedia?: { photoFrontOfHouse: string };
  checkOutMedia?: { photoFrontOfHouse: string; videoGarage: string };
  checklist: { id: string; text: string; isCompleted: boolean }[];
  status: string;
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [scholars, setScholars] = useState<UserRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [scholarsLoading, setScholarsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [scholarsError, setScholarsError] = useState<string | null>(null);
  const [jobsForReview, setJobsForReview] = useState<JobForReview[]>([]);
  const [jobsReviewLoading, setJobsReviewLoading] = useState(true);
  const [jobsReviewError, setJobsReviewError] = useState<string | null>(null);
  const [reviewModalJob, setReviewModalJob] = useState<JobForReview | null>(null);
  const { setViewAsUid, loading, authError } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-600">
        {authError}
      </div>
    );
  }

  useEffect(() => {
    if (!db) {
      setRequestsError("Firestore not initialized.");
      setNotificationsError("Firestore not initialized.");
      setScholarsError("Firestore not initialized.");
      setRequestsLoading(false);
      setNotificationsLoading(false);
      setScholarsLoading(false);
      return;
    }
    const reqQuery = query(collection(db, "signupRequests"), orderBy("createdAt", "desc"));
    const unsubRequests = onSnapshot(reqQuery, (snap) => {
      const rows = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<SignupRequest, "id">)
      }));
      setRequests(rows);
      setRequestsError(null);
      setRequestsLoading(false);
    }, (err) => {
      setRequestsError(err.message || "Failed to load signup requests.");
      setRequestsLoading(false);
    });

    const notifQuery = query(collection(db, "adminNotifications"), orderBy("createdAt", "desc"));
    const unsubNotifs = onSnapshot(notifQuery, (snap) => {
      const rows = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<AdminNotification, "id">)
      }));
      setNotifications(rows);
      setNotificationsError(null);
      setNotificationsLoading(false);
    }, (err) => {
      setNotificationsError(err.message || "Failed to load notifications.");
      setNotificationsLoading(false);
    });

    const usersQuery = query(collection(db, "users"));
    const unsubUsers = onSnapshot(usersQuery, (snap) => {
      const rows = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<UserRow, "id">)
      })).filter((user) => user.role === "scholar" && user.status === "active");
      setScholars(rows);
      setScholarsError(null);
      setScholarsLoading(false);
    }, (err) => {
      setScholarsError(err.message || "Failed to load scholar list.");
      setScholarsLoading(false);
    });

    const jobsQuery = query(collection(db, "jobs"), where("status", "==", JobStatus.REVIEW_PENDING));
    const unsubJobs = onSnapshot(jobsQuery, (snap) => {
      const rows = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<JobForReview, "id">)
      }));
      setJobsForReview(rows);
      setJobsReviewError(null);
      setJobsReviewLoading(false);
    }, (err) => {
      setJobsReviewError(err.message || "Failed to load jobs for review.");
      setJobsReviewLoading(false);
    });

    return () => {
      unsubRequests();
      unsubNotifs();
      unsubUsers();
      unsubJobs();
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

  const handleApproveAndPay = async (job: JobForReview) => {
    if (!db) {
      setError("Firestore not initialized.");
      return;
    }
    setError(null);
    setBusyId(job.id);
    try {
      // Update job status to COMPLETED
      await updateDoc(doc(db, "jobs", job.id), {
        status: JobStatus.COMPLETED,
        approvedAt: new Date().toISOString()
      });

      // Create payout record
      const payoutData = {
        jobId: job.id,
        scholarId: job.assigneeName, // Would normally be scholarId
        amount: job.pay,
        status: "pending",
        approvedBy: "admin",
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "payouts", job.id), payoutData);
      setReviewModalJob(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Approval failed.";
      setError(message);
    } finally {
      setBusyId(null);
    }
  };

  const handleRequestChanges = async (job: JobForReview, adminNotes: string) => {
    if (!db) {
      setError("Firestore not initialized.");
      return;
    }
    setError(null);
    setBusyId(job.id);
    try {
      // Update job status to CHANGES_REQUESTED with admin notes
      await updateDoc(doc(db, "jobs", job.id), {
        status: "CHANGES_REQUESTED",
        adminNotes,
        changesRequestedAt: new Date().toISOString()
      });
      setReviewModalJob(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed.";
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
            <p className="text-sm text-slate-500">Manage scholars, jobs, and account requests.</p>
          </div>
          <Link
            to="/admin/payouts"
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-700"
          >
            <DollarSign size={16} />
            Payouts
          </Link>
          <button
            onClick={() => navigate("/admin/create-job")}
            className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Create Job
          </button>
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
          {scholarsLoading ? (
            <div className="text-sm text-slate-500">Loading scholars...</div>
          ) : scholarsError ? (
            <div className="text-sm text-rose-600">{scholarsError}</div>
          ) : scholars.length === 0 ? (
            <div className="text-sm text-slate-500">No active scholars.</div>
          ) : (
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
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-bold text-slate-800 text-sm mb-3">Jobs Pending Review</h2>
          {jobsReviewLoading ? (
            <div className="text-sm text-slate-500">Loading jobs...</div>
          ) : jobsReviewError ? (
            <div className="text-sm text-rose-600">{jobsReviewError}</div>
          ) : jobsForReview.length === 0 ? (
            <div className="text-sm text-slate-500">No jobs awaiting review.</div>
          ) : (
            <div className="space-y-3">
              {jobsForReview.map((job) => (
                <div key={job.id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{job.clientName}</div>
                    <div className="text-xs text-slate-500">Scholar: {job.assigneeName || "Unknown"} • ${job.pay}</div>
                  </div>
                  <button
                    onClick={() => setReviewModalJob(job)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-bold text-slate-800 text-sm mb-3">Pending Signup Requests</h2>
          {requestsLoading ? (
            <div className="text-sm text-slate-500">Loading requests...</div>
          ) : requestsError ? (
            <div className="text-sm text-rose-600">{requestsError}</div>
          ) : requests.filter(r => r.status === "pending").length === 0 ? (
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
          {notificationsLoading ? (
            <div className="text-sm text-slate-500">Loading notifications...</div>
          ) : notificationsError ? (
            <div className="text-sm text-rose-600">{notificationsError}</div>
          ) : notifications.length === 0 ? (
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

        {reviewModalJob && (
          <ReviewModal
            job={reviewModalJob}
            onClose={() => setReviewModalJob(null)}
            onApprove={() => handleApproveAndPay(reviewModalJob)}
            onRequestChanges={(notes) => handleRequestChanges(reviewModalJob, notes)}
            busy={busyId === reviewModalJob.id}
          />
        )}
      </div>
    </div>
  );
};

const ReviewModal: React.FC<{
  job: JobForReview;
  onClose: () => void;
  onApprove: () => void;
  onRequestChanges: (notes: string) => void;
  busy: boolean;
}> = ({ job, onClose, onApprove, onRequestChanges, busy }) => {
  const [adminNotes, setAdminNotes] = useState("");
  const [showChangesForm, setShowChangesForm] = useState(false);
  const [checkInPhotoUrl, setCheckInPhotoUrl] = useState<string | null>(null);
  const [checkOutPhotoUrl, setCheckOutPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadPhotos = async () => {
      if (!storage) return;
      if (job.checkInMedia?.photoFrontOfHouse) {
        const url = await getDownloadURL(storageRef(storage, job.checkInMedia.photoFrontOfHouse));
        setCheckInPhotoUrl(url);
      }
      if (job.checkOutMedia?.photoFrontOfHouse) {
        const url = await getDownloadURL(storageRef(storage, job.checkOutMedia.photoFrontOfHouse));
        setCheckOutPhotoUrl(url);
      }
    };
    loadPhotos().catch(console.error);
  }, [job]);

  const workDuration = job.checkInTime && job.checkOutTime
    ? Math.round((new Date(job.checkOutTime).getTime() - new Date(job.checkInTime).getTime()) / (1000 * 60))
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800">Review Job: {job.clientName}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="space-y-4">
          {/* Job Info */}
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-sm text-slate-500">Scholar: <span className="font-semibold text-slate-800">{job.assigneeName}</span></div>
            <div className="text-sm text-slate-500">Payout: <span className="font-semibold text-emerald-600">${job.pay}</span></div>
            {workDuration && (
              <div className="text-sm text-slate-500">Work Duration: <span className="font-semibold text-slate-800">{workDuration} minutes</span></div>
            )}
          </div>

          {/* Photos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Check-In Photo</h3>
              {checkInPhotoUrl ? (
                <img src={checkInPhotoUrl} alt="Check-in" className="w-full h-48 object-cover rounded-lg border" />
              ) : (
                <div className="w-full h-48 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">Loading...</div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Check-Out Photo</h3>
              {checkOutPhotoUrl ? (
                <img src={checkOutPhotoUrl} alt="Check-out" className="w-full h-48 object-cover rounded-lg border" />
              ) : (
                <div className="w-full h-48 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">Loading...</div>
              )}
            </div>
          </div>

          {/* Checklist */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Checklist</h3>
            <div className="space-y-2">
              {job.checklist.map((task) => (
                <div key={task.id} className="flex items-center gap-2 text-sm">
                  <span className={task.isCompleted ? "text-emerald-600" : "text-slate-300"}>
                    {task.isCompleted ? "✓" : "○"}
                  </span>
                  <span className={task.isCompleted ? "text-slate-700" : "text-slate-400"}>{task.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          {!showChangesForm ? (
            <div className="flex gap-3 pt-4">
              <button
                onClick={onApprove}
                disabled={busy}
                className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve & Pay ${job.pay}
              </button>
              <button
                onClick={() => setShowChangesForm(true)}
                disabled={busy}
                className="flex-1 bg-amber-500 text-white font-bold py-3 rounded-xl hover:bg-amber-600 disabled:opacity-50"
              >
                Request Changes
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-4">
              <textarea
                placeholder="Describe what needs to be changed..."
                className="w-full border border-slate-200 rounded-lg p-3 text-sm"
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowChangesForm(false)}
                  className="flex-1 bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onRequestChanges(adminNotes)}
                  disabled={!adminNotes.trim() || busy}
                  className="flex-1 bg-amber-500 text-white font-bold py-3 rounded-xl hover:bg-amber-600 disabled:opacity-50"
                >
                  Submit Changes Request
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
