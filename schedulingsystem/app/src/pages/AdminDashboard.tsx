import React, { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { collection, onSnapshot, orderBy, query, updateDoc, doc, where, setDoc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { useNavigate, Link } from "react-router-dom";
import { functions, db, storage } from "../firebase";
import { useAuth } from "../auth/AuthProvider";
import { JobStatus, ServiceJob } from "../../types";
import { DollarSign, Package, UserPlus } from "lucide-react";
import JobToInventoryModal from "../components/JobToInventoryModal";

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
  const [completedJobs, setCompletedJobs] = useState<ServiceJob[]>([]);
  const [completedJobsLoading, setCompletedJobsLoading] = useState(true);
  const [reviewModalJob, setReviewModalJob] = useState<JobForReview | null>(null);
  const [extractInventoryJob, setExtractInventoryJob] = useState<ServiceJob | null>(null);
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

    // Phase X: Updated to use serviceJobs collection
    const jobsQuery = query(collection(db, "serviceJobs"), where("status", "==", JobStatus.REVIEW_PENDING));
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

    // Phase X: Query completed jobs for inventory extraction
    const completedJobsQuery = query(
      collection(db, "serviceJobs"),
      where("status", "==", JobStatus.COMPLETED),
      orderBy("date", "desc")
    );
    const unsubCompletedJobs = onSnapshot(completedJobsQuery, (snap) => {
      const jobs = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ServiceJob, "id">)
      })) as ServiceJob[];
      setCompletedJobs(jobs);
      setCompletedJobsLoading(false);
    }, (err) => {
      console.error("Failed to load completed jobs:", err);
      setCompletedJobsLoading(false);
    });

    return () => {
      unsubRequests();
      unsubNotifs();
      unsubUsers();
      unsubJobs();
      unsubCompletedJobs();
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
      await updateDoc(doc(db, "serviceJobs", job.id), {
        status: JobStatus.COMPLETED,
        approvedAt: new Date().toISOString(),
        firstPayoutProcessed: true,
        secondPayoutDue: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
      });

      // Create payout record for FIRST HALF (50%)
      const firstHalfAmount = job.pay / 2;
      const payoutData = {
        serviceJobId: job.id, // Phase X: Use serviceJobId
        jobId: job.id, // Legacy field
        scholarId: job.assigneeName, // Would normally be scholarId
        scholarName: job.assigneeName || "Unknown",
        amount: firstHalfAmount,
        status: "pending",
        approvedBy: "admin",
        paymentType: "first_half", // Track that this is the first 50%
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "payouts", `${job.id}_first`), payoutData);

      // TODO: Second half payout ($${job.pay / 2}) will be processed automatically 24 hours after approval
      // if no client complaints are filed. Implement Cloud Function to handle this.

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
      await updateDoc(doc(db, "serviceJobs", job.id), {
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
          <div className="flex items-center gap-3">
            <Link
              to="/admin/leads"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
            >
              <UserPlus size={16} />
              Leads
            </Link>
            <Link
              to="/admin/payouts"
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-700"
            >
              <DollarSign size={16} />
              Payouts
            </Link>
            <button
              onClick={() => navigate("/admin/create-job")}
              className="bg-slate-700 text-white font-semibold px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              + Create Job
            </button>
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

        {/* Phase X: Completed Jobs - Inventory Extraction */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Package size={16} className="text-emerald-600" />
              Completed Jobs - Extract Inventory
            </h2>
            <span className="text-xs text-slate-500">
              {completedJobs.filter(j => !j.inventoryExtracted).length} awaiting extraction
            </span>
          </div>
          {completedJobsLoading ? (
            <div className="text-sm text-slate-500">Loading completed jobs...</div>
          ) : completedJobs.length === 0 ? (
            <div className="text-sm text-slate-500">No completed jobs yet.</div>
          ) : (
            <div className="space-y-2">
              {completedJobs.slice(0, 5).map((job) => (
                <div key={job.id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-800">{job.clientName}</div>
                    <div className="text-xs text-slate-500">
                      {job.address} • {new Date(job.date).toLocaleDateString()}
                    </div>
                    {job.inventoryExtracted && (
                      <div className="text-xs text-emerald-600 font-semibold mt-1">
                        ✓ Inventory extracted ({job.extractedItemIds?.length || 0} items)
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setExtractInventoryJob(job)}
                    disabled={job.inventoryExtracted}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 ${
                      job.inventoryExtracted
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    <Package size={14} />
                    {job.inventoryExtracted ? 'Extracted' : 'Extract Inventory'}
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

        {extractInventoryJob && (
          <JobToInventoryModal
            job={extractInventoryJob}
            onClose={() => setExtractInventoryJob(null)}
            onSuccess={() => {
              setExtractInventoryJob(null);
              // Refresh the jobs list
            }}
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
  const [checkOutVideoUrl, setCheckOutVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadMedia = async () => {
      try {
        // Helper to get URL (handles both base64 and Storage paths)
        const getUrl = async (path: string): Promise<string> => {
          if (!path || path === '') return '';
          if (path.startsWith('data:')) return path; // Base64
          if (storage && !path.startsWith('http')) {
            // Firebase Storage path
            return await getDownloadURL(storageRef(storage, path));
          }
          return path; // Already a URL
        };

        // Load check-in photo
        if (job.checkInMedia?.photoFrontOfHouse) {
          const url = await getUrl(job.checkInMedia.photoFrontOfHouse);
          if (url) setCheckInPhotoUrl(url);
        }

        // Load check-out media (if it exists)
        if (job.checkOutMedia) {
          const checkOutPhoto = (job.checkOutMedia as any).photoAfter || job.checkOutMedia.photoFrontOfHouse;
          if (checkOutPhoto) {
            const url = await getUrl(checkOutPhoto);
            if (url) setCheckOutPhotoUrl(url);
          }

          if (job.checkOutMedia.videoGarage) {
            const url = await getUrl(job.checkOutMedia.videoGarage);
            if (url) setCheckOutVideoUrl(url);
          }
        }
      } catch (err) {
        console.error('Failed to load media:', err);
      }
    };

    loadMedia();
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
            <div className="text-sm text-slate-500">
              Total Payout: <span className="font-semibold text-emerald-600">${job.pay}</span>
              <span className="text-xs text-slate-400 ml-2">(${job.pay / 2} now + ${job.pay / 2} after 24h)</span>
            </div>
            {workDuration && (
              <div className="text-sm text-slate-500">Work Duration: <span className="font-semibold text-slate-800">{workDuration} minutes</span></div>
            )}
          </div>

          {/* Payment Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            <strong>Payment Policy:</strong> 50% paid immediately upon approval. Remaining 50% automatically released 24 hours after job completion if no client complaints are filed.
          </div>

          {/* Photos & Video */}
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

          {/* Check-Out Video (Required for QA) */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Check-Out Video (Garage Walkthrough)</h3>
            {checkOutVideoUrl ? (
              <video src={checkOutVideoUrl} controls className="w-full rounded-lg border" style={{ maxHeight: '400px' }} />
            ) : (
              <div className="w-full h-48 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 border-2 border-rose-300">
                <span className="text-rose-600 font-semibold">⚠️ Video not uploaded - Required for QA</span>
              </div>
            )}
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
                Approve & Pay ${job.pay / 2} (50% now)
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
