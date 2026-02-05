# Phase X Migration Scripts

## Overview
This directory contains data migration scripts for the Application Integration - Phase X project.

## Running the Migration

### Prerequisites
- Firebase Admin SDK credentials configured (`service-account.json`)
- Node.js v16+ installed
- All dependencies installed (`npm install` in backend directory)

### Step 1: Backup Your Data
**CRITICAL**: Before running any migration, create a Firestore backup.

```bash
# Export all Firestore data to Google Cloud Storage
firebase firestore:export gs://garage-scholars-v2.appspot.com/backups/pre-phase-x-migration
```

### Step 2: Review the Migration Plan
Read [PHASE_X_DATA_MODEL.md](../../PHASE_X_DATA_MODEL.md) to understand:
- What collections will be created
- How data will be transformed
- What relationships will be established

### Step 3: Run the Migration (Dry Run Recommended)
```bash
cd backend/migrations
node phaseX_migration.js
```

The migration is designed to be:
- **Non-destructive**: Creates new collections without deleting originals
- **Idempotent**: Can be run multiple times safely
- **Resumable**: Uses batch commits to handle interruptions

### Step 4: Verify Migration
After running the migration, verify in Firebase Console:

1. **New Collections Created**:
   - `clients` - Should contain unique client records
   - `properties` - Should contain unique property records
   - `serviceJobs` - Should contain all scheduling app jobs
   - `automationJobs` - Should contain all resale automation queue jobs

2. **Data Integrity Checks**:
   - Count of `serviceJobs` + `automationJobs` = count of old `jobs` collection
   - All `serviceJobs` have `clientId` and `propertyId` populated
   - All `inventory` items have `clientId` populated where client name existed

3. **Relationship Verification**:
   - Clients have correct `stats` initialized
   - Properties are linked to correct clients
   - Service jobs reference correct clients and properties

### Step 5: Update Application Code
Before deploying, ensure all application code has been updated to use new collections:
- Scheduling app: `jobs` → `serviceJobs`
- Resale backend: `jobs` → `automationJobs`
- Both apps: Use `clients` and `properties` collections

### Step 6: Deploy and Test
1. Deploy updated functions: `firebase deploy --only functions`
2. Deploy updated hosting: `firebase deploy --only hosting`
3. Test all workflows end-to-end
4. Monitor for errors

### Step 7: Cleanup (After Verification)
**ONLY after 1-2 weeks of successful operation:**
```javascript
// Delete the old jobs collection
// WARNING: This is permanent!
const deleteCollection = async (collectionPath, batchSize = 500) => {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
};

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();
  if (snapshot.size === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

// Run deletion
await deleteCollection('jobs');
```

## Rollback Plan
If you need to rollback:

1. **Restore from backup**:
```bash
firebase firestore:import gs://garage-scholars-v2.appspot.com/backups/pre-phase-x-migration
```

2. **Revert application code** to use old collection names

3. **Delete new collections** (if necessary):
```javascript
await deleteCollection('serviceJobs');
await deleteCollection('automationJobs');
await deleteCollection('clients');
await deleteCollection('properties');
```

## Migration Scripts

### `phaseX_migration.js`
Main migration script that:
1. Analyzes existing `jobs` collection
2. Creates `clients` from unique client names
3. Creates `properties` from unique addresses
4. Migrates service jobs to `serviceJobs`
5. Migrates automation jobs to `automationJobs`
6. Enhances `inventory` with client references
7. Enhances `users` with app access controls

## Support
If you encounter issues during migration:
1. Check migration stats output for error details
2. Review Firebase Console for data anomalies
3. Check application logs for runtime errors
4. Contact development team for assistance

## Migration Checklist
- [ ] Created Firestore backup
- [ ] Reviewed migration plan
- [ ] Ran migration script successfully
- [ ] Verified new collections in Firebase Console
- [ ] Updated application code
- [ ] Deployed updated code
- [ ] Tested all workflows
- [ ] Monitored for 1-2 weeks
- [ ] Deleted old `jobs` collection (optional cleanup)
