import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { Job, JobStatus } from "../../types";
import { ArrowLeft, UserPlus, Phone, Mail, MapPin, Calendar } from "lucide-react";

const AdminLeads: React.FC = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Job | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [convertingLead, setConvertingLead] = useState<Job | null>(null);
  const [convertFormData, setConvertFormData] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    address: "",
    description: "",
    estimatedHours: 3,
    scholarPayout: 0,
    clientPrice: 0,
    scheduledDate: "",
    accessInstructions: "",
    sellVsKeepPreference: "decide" as "sell" | "keep" | "decide"
  });

  useEffect(() => {
    if (!db) {
      setError("Firestore not initialized.");
      setLoading(false);
      return;
    }

    const leadsQuery = query(
      collection(db, "serviceJobs"),
      where("status", "==", JobStatus.LEAD),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      leadsQuery,
      (snapshot) => {
        const leadsList = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Job, "id">)
        }));
        setLeads(leadsList);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to load leads.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleConvertToJob = (lead: Job) => {
    // Open modal with pre-filled data from lead
    setConvertingLead(lead);
    setConvertFormData({
      clientName: lead.clientName || "",
      clientEmail: lead.clientEmail || "",
      clientPhone: lead.clientPhone || "",
      address: lead.address || lead.zipcode || "",
      description: lead.description || "",
      estimatedHours: 3,
      scholarPayout: 0,
      clientPrice: 0,
      scheduledDate: "",
      accessInstructions: "",
      sellVsKeepPreference: "decide"
    });
  };

  const handleConvertFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConvertFormData(prev => ({
      ...prev,
      [name]: name === "estimatedHours" || name === "scholarPayout" || name === "clientPrice"
        ? parseFloat(value) || 0
        : value
    }));
  };

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !convertingLead) return;

    setError(null);

    // Validation
    if (!convertFormData.clientName.trim() || !convertFormData.address.trim()) {
      setError("Client name and address are required.");
      return;
    }
    if (convertFormData.scholarPayout < 50 || convertFormData.scholarPayout > 1000) {
      setError("Scholar payout must be between $50 and $1000.");
      return;
    }
    if (convertFormData.clientPrice < 100 || convertFormData.clientPrice > 3000) {
      setError("Client price must be between $100 and $3000.");
      return;
    }
    if (!convertFormData.scheduledDate) {
      setError("Scheduled date is required.");
      return;
    }

    setBusyId(convertingLead.id);

    try {
      const scheduledDateTime = new Date(convertFormData.scheduledDate);
      const endDateTime = new Date(scheduledDateTime.getTime() + convertFormData.estimatedHours * 60 * 60 * 1000);

      // Create basic 5-step checklist
      const checklist = [
        { id: "check-in", text: "Check in with photo of property exterior", isCompleted: false, status: "APPROVED" as const },
        { id: "clear-main", text: "Clear and organize main garage area", isCompleted: false, status: "APPROVED" as const },
        { id: "organize-items", text: "Organize items by category and zone", isCompleted: false, status: "APPROVED" as const },
        { id: "clean-floor", text: "Sweep and clean garage floor", isCompleted: false, status: "APPROVED" as const },
        { id: "check-out", text: "Take final photos and check out", isCompleted: false, status: "APPROVED" as const }
      ];

      // Update the existing lead document to convert it to a job
      await updateDoc(doc(db, "serviceJobs", convertingLead.id), {
        clientName: convertFormData.clientName.trim(),
        clientEmail: convertFormData.clientEmail.trim(),
        clientPhone: convertFormData.clientPhone.trim(),
        address: convertFormData.address.trim(),
        description: convertFormData.description.trim(),
        date: scheduledDateTime.toISOString(),
        scheduledEndTime: endDateTime.toISOString(),
        pay: convertFormData.scholarPayout,
        clientPrice: convertFormData.clientPrice,
        status: JobStatus.APPROVED_FOR_POSTING,
        locationLat: 0,
        locationLng: 0,
        checklist,
        accessConstraints: convertFormData.accessInstructions.trim(),
        sellVsKeepPreference: convertFormData.sellVsKeepPreference,
        inventoryExtracted: false,
        updatedAt: serverTimestamp()
      });

      alert("Lead successfully converted to job and posted to scholar board!");
      setConvertingLead(null);

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to convert lead.";
      setError(message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDisqualifyLead = async (leadId: string) => {
    if (!db || !confirm("Are you sure you want to disqualify this lead?")) return;
    setBusyId(leadId);
    try {
      await updateDoc(doc(db, "serviceJobs", leadId), {
        status: JobStatus.CANCELLED,
        cancellationReason: "Lead disqualified"
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disqualify lead.";
      setError(message);
    } finally {
      setBusyId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const serviceTypeLabels: { [key: string]: string } = {
    'get-clean': 'Get Clean',
    'get-organized': 'Get Organized',
    'get-strong': 'Get Strong',
    'resale': 'Resale Concierge'
  };

  const packageLabels: { [key: string]: string } = {
    'undergraduate': 'Undergraduate',
    'graduate': 'Graduate',
    'doctorate': 'Doctorate'
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading leads...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-200 rounded-full"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Leads Management</h1>
              <p className="text-sm text-slate-500">Quote requests from website visitors</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Leads</div>
            <div className="text-2xl font-bold text-blue-600">{leads.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">New Today</div>
            <div className="text-2xl font-bold text-emerald-600">
              {leads.filter(l => {
                const createdAt = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt);
                const today = new Date();
                return createdAt.toDateString() === today.toDateString();
              }).length}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">This Week</div>
            <div className="text-2xl font-bold text-slate-800">
              {leads.filter(l => {
                const createdAt = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt);
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                return createdAt >= weekAgo;
              }).length}
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Lead Info</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Service Details</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Submitted</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      No leads found. New quote requests will appear here.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      {/* Lead Info */}
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-800">{lead.clientName}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin size={12} />
                            {lead.zipcode || lead.address}
                          </div>
                          {lead.garageSize && (
                            <div className="text-xs text-slate-500">Size: {lead.garageSize}</div>
                          )}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-4">
                        <div className="space-y-1 text-sm">
                          {lead.clientEmail && (
                            <div className="flex items-center gap-2 text-slate-600">
                              <Mail size={14} />
                              <a href={`mailto:${lead.clientEmail}`} className="hover:text-blue-600">
                                {lead.clientEmail}
                              </a>
                            </div>
                          )}
                          {lead.clientPhone && (
                            <div className="flex items-center gap-2 text-slate-600">
                              <Phone size={14} />
                              <a href={`tel:${lead.clientPhone}`} className="hover:text-blue-600">
                                {lead.clientPhone}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Service Details */}
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-slate-700">
                            {lead.serviceType ? serviceTypeLabels[lead.serviceType] || lead.serviceType : 'N/A'}
                          </div>
                          <div className="text-xs text-slate-500">
                            Package: {lead.package ? packageLabels[lead.package] || lead.package : 'N/A'}
                          </div>
                          {lead.description && (
                            <div className="text-xs text-slate-500 mt-2 max-w-xs truncate">
                              {lead.description}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Submitted */}
                      <td className="px-4 py-4">
                        <div className="text-sm text-slate-600">
                          {lead.createdAt ? formatDate(lead.createdAt.toDate ? lead.createdAt.toDate().toISOString() : lead.createdAt) : 'N/A'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedLead(lead)}
                            className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleConvertToJob(lead)}
                            disabled={busyId === lead.id}
                            className="text-sm px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {busyId === lead.id ? '...' : 'Convert'}
                          </button>
                          <button
                            onClick={() => handleDisqualifyLead(lead.id)}
                            disabled={busyId === lead.id}
                            className="text-sm px-3 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 disabled:opacity-50"
                          >
                            Disqualify
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Lead Details</h2>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Contact Information</h3>
                <div className="space-y-2 text-slate-800">
                  <div><span className="font-medium text-slate-900">Name:</span> {selectedLead.clientName}</div>
                  <div><span className="font-medium text-slate-900">Email:</span> {selectedLead.clientEmail}</div>
                  <div><span className="font-medium text-slate-900">Phone:</span> {selectedLead.clientPhone}</div>
                  <div><span className="font-medium text-slate-900">ZIP Code:</span> {selectedLead.zipcode}</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Service Details</h3>
                <div className="space-y-2 text-slate-800">
                  <div><span className="font-medium text-slate-900">Service:</span> {selectedLead.serviceType ? serviceTypeLabels[selectedLead.serviceType] || selectedLead.serviceType : 'N/A'}</div>
                  <div><span className="font-medium text-slate-900">Package:</span> {selectedLead.package ? packageLabels[selectedLead.package] || selectedLead.package : 'N/A'}</div>
                  {selectedLead.garageSize && <div><span className="font-medium text-slate-900">Garage Size:</span> {selectedLead.garageSize}</div>}
                </div>
              </div>

              {selectedLead.description && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Project Description</h3>
                  <p className="text-slate-700">{selectedLead.description}</p>
                </div>
              )}

              {selectedLead.intakeMediaPaths && selectedLead.intakeMediaPaths.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Photos ({selectedLead.intakeMediaPaths.length})</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedLead.intakeMediaPaths.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-48 object-cover rounded border" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex gap-3 justify-end">
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleConvertToJob(selectedLead);
                  setSelectedLead(null);
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                Convert to Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Job Modal */}
      {convertingLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Convert Lead to Job</h2>
                  <p className="text-sm text-slate-500 mt-1">Review and complete job details before posting</p>
                </div>
                <button
                  onClick={() => setConvertingLead(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleConvertSubmit} className="p-6 space-y-6">
              {error && (
                <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                  {error}
                </div>
              )}

              {/* Client Information */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-lg border-b pb-2">Client Information</h3>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Client Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="clientName"
                    value={convertFormData.clientName}
                    onChange={handleConvertFormChange}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600">Client Email</label>
                    <input
                      type="email"
                      name="clientEmail"
                      value={convertFormData.clientEmail}
                      onChange={handleConvertFormChange}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Client Phone</label>
                    <input
                      type="tel"
                      name="clientPhone"
                      value={convertFormData.clientPhone}
                      onChange={handleConvertFormChange}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Property Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={convertFormData.address}
                    onChange={handleConvertFormChange}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                    placeholder="123 Main St, Los Angeles, CA 90001"
                    required
                  />
                </div>
              </div>

              {/* Job Details */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-lg border-b pb-2">Job Details</h3>

                <div>
                  <label className="text-sm font-medium text-slate-600">Job Description</label>
                  <textarea
                    name="description"
                    value={convertFormData.description}
                    onChange={handleConvertFormChange}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[100px] text-slate-900"
                    maxLength={500}
                  />
                  <p className="text-xs text-slate-400 mt-1">{convertFormData.description.length}/500 characters</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600">Estimated Hours</label>
                    <input
                      type="number"
                      name="estimatedHours"
                      value={convertFormData.estimatedHours}
                      onChange={handleConvertFormChange}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                      min="1"
                      max="12"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Scholar Payout <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-2 text-slate-500">$</span>
                      <input
                        type="number"
                        name="scholarPayout"
                        value={convertFormData.scholarPayout || ""}
                        onChange={handleConvertFormChange}
                        className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-slate-900"
                        min="50"
                        max="1000"
                        step="10"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">
                      Client Price <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-2 text-slate-500">$</span>
                      <input
                        type="number"
                        name="clientPrice"
                        value={convertFormData.clientPrice || ""}
                        onChange={handleConvertFormChange}
                        className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-slate-900"
                        min="100"
                        max="3000"
                        step="10"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Scheduled Date & Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="scheduledDate"
                    value={convertFormData.scheduledDate}
                    onChange={handleConvertFormChange}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                    required
                  />
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-lg border-b pb-2">Additional Information</h3>

                <div>
                  <label className="text-sm font-medium text-slate-600">Access Instructions</label>
                  <textarea
                    name="accessInstructions"
                    value={convertFormData.accessInstructions}
                    onChange={handleConvertFormChange}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[80px] text-slate-900"
                    placeholder="Gate code: 1234, Key under mat, Client will be home"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-600">Sell vs Keep Preference</label>
                  <select
                    name="sellVsKeepPreference"
                    value={convertFormData.sellVsKeepPreference}
                    onChange={handleConvertFormChange}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                  >
                    <option value="decide">I'll Decide Later</option>
                    <option value="sell">Sell Everything</option>
                    <option value="keep">Keep Everything</option>
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setConvertingLead(null)}
                  className="flex-1 bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === convertingLead.id}
                  className="flex-1 bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busyId === convertingLead.id ? 'Converting...' : 'Post to Scholar Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLeads;
