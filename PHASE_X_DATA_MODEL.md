# Application Integration - Phase X: Data Model

## Overview
This document defines the unified data model for the Garage Scholars platform, integrating the Scheduling App and Resale Concierge App through shared collections and clear domain boundaries.

---

## Collection Architecture

### **Core Entity Collections**

#### 1. `clients` (NEW - Shared)
Central registry of all Garage Scholars clients.

```typescript
interface Client {
  id: string;                    // Auto-generated Firestore ID
  name: string;                  // Client full name
  email: string;                 // Contact email
  phone?: string;                // Contact phone (optional)
  createdAt: Timestamp;          // First interaction date
  source: 'scheduling' | 'resale' | 'both';  // How they came to us

  // Aggregated metrics (updated via Cloud Functions)
  stats: {
    totalServiceJobs: number;    // Count of completed garage clean-outs
    totalPropertiesServiced: number;  // Count of unique properties
    totalItemsListed: number;    // Count of inventory items from this client
    totalItemsSold: number;      // Count of sold items
    totalRevenue: number;        // Sum of sold item prices
  };

  // Metadata
  notes?: string;                // Admin notes about client
  tags?: string[];               // Tags: 'vip', 'repeat', 'high-value', etc.
}
```

#### 2. `properties` (NEW - Shared)
Physical locations where service jobs occur and items are sourced.

```typescript
interface Property {
  id: string;                    // Auto-generated Firestore ID
  clientId: string;              // Reference to clients/{clientId}

  // Address
  address: string;               // Street address
  city: string;
  state: string;
  zip: string;

  // Relationships
  serviceJobIds: string[];       // Array of serviceJobs/{jobId}
  inventoryItemIds: string[];    // Array of inventory/{itemId}

  // Metadata
  createdAt: Timestamp;
  lastServicedAt?: Timestamp;    // Most recent service job completion
  propertyType?: 'residential' | 'commercial' | 'storage';
  notes?: string;
}
```

---

### **Scheduling App Collections**

#### 3. `serviceJobs` (RENAMED from `jobs`)
Garage clean-out service jobs managed by scholars.

```typescript
interface ServiceJob {
  id: string;

  // Client & Location (NEW - structured references)
  clientId: string;              // Reference to clients/{clientId}
  propertyId: string;            // Reference to properties/{propertyId}

  // Legacy fields (maintain for backward compatibility during migration)
  clientAddress?: string;        // DEPRECATED: use propertyId instead

  // Job Details
  title: string;
  description: string;
  scheduledDate: string;
  pay: number;

  // Assignment
  assigneeName: string;          // Scholar name
  assigneeId?: string;           // Reference to users/{userId}

  // Status & Workflow
  status: 'UPCOMING' | 'IN_PROGRESS' | 'REVIEW_PENDING' | 'COMPLETED';
  createdAt: Timestamp;
  checkInTime?: string;
  checkOutTime?: string;
  approvedAt?: string;

  // Media
  checkInMedia?: {
    photoFrontOfHouse: string;   // Storage path
    videoGarage: string;         // Storage path
    timestamp: string;
  };
  checkOutMedia?: {
    photoAfter: string;          // Storage path
    timestamp: string;
  };

  // SOP Checklist
  checklist: Array<{
    id: string;
    text: string;
    isCompleted: boolean;
  }>;

  // Payout tracking
  payoutId?: string;             // Reference to payouts/{payoutId}

  // NEW: Inventory extraction tracking
  inventoryExtracted: boolean;   // Has admin created inventory from this job?
  extractedItemIds?: string[];   // Array of inventory/{itemId} created from this job
}
```

#### 4. `users` (Existing - Enhanced)
Scholar and admin user accounts.

```typescript
interface User {
  id: string;                    // Firebase Auth UID
  email: string;
  name: string;
  role: 'admin' | 'scholar';
  status: 'active' | 'pending' | 'declined';

  // NEW: Access control
  appAccess: {
    scheduling: boolean;         // Can access Scheduling app
    resale: boolean;             // Can access Resale Concierge app
  };

  // Existing fields
  createdAt: Timestamp;
  requestId?: string;
  approvedAt?: Timestamp;
  approvedByUid?: string;
}
```

#### 5. `signupRequests` (Existing - No changes)
Pending scholar signup requests (admin approval workflow).

#### 6. `payouts` (Existing - Enhanced)
Scholar payment tracking.

```typescript
interface Payout {
  id: string;
  serviceJobId: string;          // RENAMED from jobId - references serviceJobs/{id}
  scholarId: string;
  scholarName: string;
  scholarEmail?: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed';
  createdAt: string;
  paidAt?: string;
  paymentMethod?: 'Venmo' | 'Zelle' | 'Cash' | 'Check';
  transactionNote?: string;
  approvedBy?: string;
}
```

---

### **Resale Concierge Collections**

#### 7. `inventory` (Existing - Enhanced)
Items to be listed on marketplaces.

```typescript
interface InventoryItem {
  id: string;                    // Custom ID: "{clientName} - {title}"

  // Item details
  title: string;
  price: string;
  description: string;
  condition?: 'new' | 'used';

  // NEW: Structured client & source tracking
  clientId?: string;             // Reference to clients/{clientId}
  propertyId?: string;           // Reference to properties/{propertyId}
  sourceServiceJobId?: string;   // Reference to serviceJobs/{jobId} if extracted from job

  // Legacy field (maintain during migration)
  clientName?: string;           // DEPRECATED: use clientId instead

  // Listing configuration
  platform: 'Both' | 'All' | 'Craigslist' | 'FB Marketplace' | 'eBay Only';
  status: 'Pending' | 'Running' | 'Active' | 'Error';

  // Media
  imageUrls: string[];           // Firebase Storage URLs

  // Automation tracking
  activeJobId?: string;          // Reference to automationJobs/{jobId}
  progress?: {
    craigslist?: 'queued' | 'running' | 'success' | 'error';
    facebook?: 'queued' | 'running' | 'success' | 'error';
    ebay?: 'queued' | 'running' | 'success' | 'error';
  };

  // eBay specific
  ebay?: {
    enabled: boolean;
    status: 'queued' | 'running' | 'ready_to_publish' | 'published' | 'failed';
    sku?: string;
    offerId?: string;
    listingId?: string;
    // ... other eBay fields
  };

  // Metadata
  dateListed: string;
  lastUpdated: Timestamp;
  lastError?: {
    platform: string;
    message: string;
    screenshotPath: string;
  };
}
```

#### 8. `automationJobs` (NEW - extracted from old `jobs`)
Queue jobs for marketplace listing automation.

```typescript
interface AutomationJob {
  id: string;                    // Auto-generated Firestore ID
  inventoryId: string;           // Reference to inventory/{itemId}

  // Queue management
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  attempts: number;

  // Lease system (prevents race conditions)
  leaseOwner: string | null;     // Worker ID that claimed this job
  leaseExpiresAt: Timestamp | null;

  // Timing
  createdAt: Timestamp;
  startedAt?: Timestamp;
  finishedAt?: Timestamp;

  // Results
  lastError?: {
    platform: string;
    message: string;
    screenshotPath: string;
  };
  artifacts: {
    screenshots: string[];       // Debug screenshot paths
  };
  results?: {
    craigslist?: 'success' | 'error' | 'skipped';
    facebook?: 'success' | 'error' | 'skipped';
    ebay?: {
      ok: boolean;
      offerId?: string;
      listingId?: string;
      error?: any;
    };
  };
}
```

#### 9. `sold_inventory` (Existing - Enhanced)
Archived items that have been sold (revenue tracking).

```typescript
interface SoldInventoryItem extends InventoryItem {
  // Additional fields for sold items
  status: 'Sold';
  dateSold: string;
  archivedAt: Date;
  soldBy: string;
  soldPlatform?: 'Craigslist' | 'Facebook' | 'eBay';

  // Revenue attribution
  clientId?: string;             // NEW: Link revenue back to client
  propertyId?: string;           // NEW: Link revenue back to property
}
```

#### 10. `conversations` (Existing - No changes)
Buyer message threads from marketplace platforms.

---

## Migration Strategy

### Phase 1: Create New Collections (Non-Breaking)
1. Create `clients` collection
2. Create `properties` collection
3. Create `automationJobs` collection

### Phase 2: Backfill Data
1. Extract unique clients from existing `jobs` collection → `clients`
2. Extract unique properties from existing `jobs` collection → `properties`
3. Copy automation-related jobs from `jobs` → `automationJobs`

### Phase 3: Rename & Update References
1. Rename `jobs` → `serviceJobs` (or create new collection and migrate)
2. Update all Scheduling app code to use `serviceJobs`
3. Update Resale backend to use `automationJobs`

### Phase 4: Enhance Existing Collections
1. Add `clientId`, `propertyId`, `sourceServiceJobId` to `inventory` items
2. Add `appAccess` to `users` collection
3. Update `payouts` to reference `serviceJobId` instead of `jobId`

---

## Collection Relationships Diagram

```
┌─────────────┐
│   clients   │──┐
└─────────────┘  │
                 │
                 ├──→ ┌──────────────┐
                 │    │  properties  │──┐
                 │    └──────────────┘  │
                 │                      │
                 │                      ├──→ ┌────────────────┐
                 │                      │    │  serviceJobs   │──→ ┌──────────┐
                 │                      │    └────────────────┘    │  payouts │
                 │                      │                          └──────────┘
                 │                      │
                 │                      └──→ ┌───────────────────┐
                 │                           │    inventory      │──→ ┌──────────────────┐
                 └──────────────────────────→└───────────────────┘    │ automationJobs   │
                                                     │                └──────────────────┘
                                                     │
                                                     └──→ ┌──────────────────┐
                                                          │ sold_inventory   │
                                                          └──────────────────┘
```

---

## Business Logic Rules

### Client Creation
- **Trigger**: Admin creates a new service job with a new client name
- **Action**: Auto-create client record if doesn't exist

### Property Creation
- **Trigger**: Admin creates a new service job with a new address
- **Action**: Auto-create property record linked to client

### Service Job → Inventory Pipeline
- **Trigger**: Admin clicks "Extract Inventory from Job" in completed service job
- **Action**:
  1. Show modal with job photos
  2. Admin creates inventory items, assigns photos
  3. Each item gets `clientId`, `propertyId`, `sourceServiceJobId`
  4. Update service job: `inventoryExtracted = true`

### Revenue Attribution
- **Trigger**: Item marked as sold in Resale app
- **Action**:
  1. Move to `sold_inventory`
  2. Update `client.stats.totalItemsSold` and `client.stats.totalRevenue`
  3. Update `property` with sold item tracking

---

## Index Requirements

Create composite indexes for efficient queries:

```javascript
// Firestore indexes needed:
serviceJobs: [clientId, status], [propertyId, status], [assigneeId, status]
inventory: [clientId, status], [propertyId, status], [sourceServiceJobId]
automationJobs: [status, createdAt], [status, leaseExpiresAt]
payouts: [scholarId, status], [serviceJobId]
sold_inventory: [clientId], [propertyId], [dateSold]
```

---

## Next Steps
1. ✅ Schema designed and documented
2. ⏳ Create migration scripts
3. ⏳ Update application code to use new collections
4. ⏳ Build job→inventory extraction UI
5. ⏳ Implement Cloud Functions for auto-aggregation
6. ⏳ Test end-to-end workflows
