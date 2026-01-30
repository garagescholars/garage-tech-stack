
export enum JobStatus {
  UPCOMING = 'UPCOMING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REVIEW_PENDING = 'REVIEW_PENDING',
  CANCELLED = 'CANCELLED',
  INTAKE_SUBMITTED = 'INTAKE_SUBMITTED',
  SOP_NEEDS_REVIEW = 'SOP_NEEDS_REVIEW',
  APPROVED_FOR_POSTING = 'APPROVED_FOR_POSTING'
}

export type UserRole = 'scholar' | 'admin';

export interface Task {
  id: string;
  text: string;
  isCompleted: boolean;
  status?: 'APPROVED' | 'PENDING'; // Default is APPROVED if undefined
  addedBy?: UserRole;
  actionTimestamp?: string; // ISO String when admin approved/rejected or employee added
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  monthlyGoal: number; // Represents Currency Target (e.g. 3000 for $3000)
  avatarInitials: string;
  achievedMilestones: number[]; // Tracks percentages hit: [80, 90, 100]
  phoneNumber?: string; // For SMS Alerts
}

export interface Job {
  id: string;
  clientName: string;
  address: string;
  date: string; // ISO String
  scheduledEndTime: string; // ISO String - Expected completion time
  pay: number;
  description: string;
  status: JobStatus;
  locationLat: number;
  locationLng: number;
  checkInTime?: string;
  checkOutTime?: string;
  checkInMedia?: JobMedia;
  checkOutMedia?: JobMedia;
  qualityReport?: string;
  checklist: Task[];
  assigneeId?: string; // 'user-1' is the current logged in user
  assigneeName?: string;
  cancellationReason?: string;
  sopId?: string;
  intakeMediaPaths?: string[];
}

export interface SopSectionStep {
  id: string;
  text: string;
  requiresApproval?: boolean;
  requiredPhotoKey?: string;
}

export interface SopSection {
  title: string;
  steps: SopSectionStep[];
}

export interface SopRequiredPhoto {
  key: string;
  label: string;
  required: boolean;
}

export interface SopDoc {
  id: string;
  jobId: string;
  qaStatus: 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED';
  brandStyleVersion: 'v1';
  sections: SopSection[];
  requiredPhotos: SopRequiredPhoto[];
  createdAt?: string;
  updatedAt?: string;
}

export interface JobMedia {
  photoFrontOfHouse: string; // Base64
  videoGarage: string; // Base64 or Blob URL
  timestamp: string; // Submission Timestamp
  photoTimestamp?: string; // ISO String for Photo Upload
  videoTimestamp?: string; // ISO String for Video Upload
}

export interface Notification {
  id: string;
  jobId: string;
  message: string;
  type: '3_DAY' | '1_DAY' | '6_HOUR' | 'CHECKOUT_REMINDER' | 'CHECKLIST_REQUEST' | 'CELEBRATION';
  isRead: boolean;
  timestamp: string;
}

export const MOCK_USERS: User[] = [
  { id: 'user-1', name: 'Alex Scholar', role: 'scholar', monthlyGoal: 3000, avatarInitials: 'AS', achievedMilestones: [], phoneNumber: '555-0123' },
  { id: 'user-2', name: 'Sarah Connor', role: 'scholar', monthlyGoal: 4500, avatarInitials: 'SC', achievedMilestones: [], phoneNumber: '555-0198' },
  { id: 'user-3', name: 'John Matrix', role: 'scholar', monthlyGoal: 3500, avatarInitials: 'JM', achievedMilestones: [], phoneNumber: '555-0145' },
  { id: 'user-4', name: 'Ellen Ripley', role: 'scholar', monthlyGoal: 5000, avatarInitials: 'ER', achievedMilestones: [], phoneNumber: '555-0167' },
];

export const MOCK_JOBS: Job[] = [
  {
    id: 'job-101',
    clientName: 'Smith Residence',
    address: '124 Maple Drive, Springfield',
    date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    scheduledEndTime: new Date(Date.now() + 86400000 + 14400000).toISOString(), // +4 hours
    pay: 350.00,
    description: 'Full garage organization and deep clean. Heavy lifting required for shelving units.',
    status: JobStatus.UPCOMING,
    locationLat: 34.05,
    locationLng: -118.25,
    assigneeId: 'user-1',
    assigneeName: 'Alex Scholar',
    checklist: [
      { id: 't1', text: 'Clear driveway for staging', isCompleted: false, status: 'APPROVED' },
      { id: 't2', text: 'Assemble 3 metal shelving units', isCompleted: false, status: 'APPROVED' },
      { id: 't3', text: 'Sort loose tools into labeled bins', isCompleted: false, status: 'PENDING', addedBy: 'scholar', actionTimestamp: new Date().toISOString() },
      { id: 't4', text: 'Sweep and hose down garage floor', isCompleted: false, status: 'APPROVED' }
    ]
  },
  {
    id: 'job-102',
    clientName: 'Johnson Estate',
    address: '8800 Sunset Blvd, Beverly Hills',
    date: new Date(Date.now() + 259200000).toISOString(), // 3 Days out
    scheduledEndTime: new Date(Date.now() + 259200000 + 18000000).toISOString(), // +5 hours
    pay: 600.00,
    description: 'Two-car garage + detached workspace organization.',
    status: JobStatus.UPCOMING,
    locationLat: 34.07,
    locationLng: -118.40,
    assigneeId: 'user-2',
    assigneeName: 'Sarah Connor',
    checklist: [
      { id: 't1', text: 'Photograph initial state of workspace', isCompleted: false, status: 'APPROVED' },
      { id: 't2', text: 'Break down and recycle old cardboard boxes', isCompleted: false, status: 'APPROVED' },
      { id: 't3', text: 'Organize workspace drawers by item type', isCompleted: false, status: 'APPROVED' },
      { id: 't4', text: 'Install wall hooks for bicycles', isCompleted: false, status: 'APPROVED' }
    ]
  },
  {
    id: 'job-103',
    clientName: 'Doe Bungalow',
    address: '45 Ocean View, Santa Monica',
    date: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    scheduledEndTime: new Date(Date.now() + 3000000).toISOString(), // Ends in ~50 mins from now
    pay: 275.00,
    description: 'Standard cleaning and box labeling.',
    status: JobStatus.IN_PROGRESS, 
    locationLat: 34.01,
    locationLng: -118.49,
    assigneeId: 'user-1',
    assigneeName: 'Alex Scholar',
    checkInTime: new Date(Date.now() - 3600000).toISOString(),
    checklist: [
      { id: 't1', text: 'Label all holiday decoration boxes', isCompleted: true, status: 'APPROVED' },
      { id: 't2', text: 'Stack boxes safely against north wall', isCompleted: false, status: 'APPROVED' },
      { id: 't3', text: 'Wipe down workbench', isCompleted: false, status: 'APPROVED' }
    ]
  },
  {
    id: 'job-104',
    clientName: 'Tech Startup Garage',
    address: '500 Innovation Way, Silicon Beach',
    date: new Date(Date.now() + 432000000).toISOString(), // 5 Days out
    scheduledEndTime: new Date(Date.now() + 432000000 + 21600000).toISOString(), // +6 hours
    pay: 500.00,
    description: 'Convert garage into office space. Clear all debris.',
    status: JobStatus.UPCOMING,
    locationLat: 34.02,
    locationLng: -118.45,
    assigneeId: undefined, // Unassigned
    assigneeName: undefined,
    checklist: [
      { id: 't1', text: 'Remove old workbench', isCompleted: false, status: 'PENDING', addedBy: 'scholar', actionTimestamp: new Date().toISOString() },
      { id: 't2', text: 'Sweep and mop', isCompleted: false, status: 'APPROVED' }
    ]
  }
];
