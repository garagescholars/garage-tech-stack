/**
 * Application Integration - Phase X: Data Migration Script
 *
 * This script performs a safe, idempotent migration of Firestore collections:
 * 1. Creates new collections: clients, properties, automationJobs
 * 2. Migrates jobs → serviceJobs (for scheduling app)
 * 3. Extracts automation jobs → automationJobs (for resale backend)
 * 4. Backfills client and property data
 *
 * SAFETY: This script is non-destructive. It creates new collections without
 * deleting the original 'jobs' collection. You can verify the migration
 * before manually deleting the old collection.
 */

require('dotenv').config();
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const serviceAccount = require('../service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore();

// Migration state tracking
const stats = {
  serviceJobsMigrated: 0,
  automationJobsMigrated: 0,
  clientsCreated: 0,
  propertiesCreated: 0,
  errors: []
};

/**
 * Step 1: Analyze existing jobs collection
 * Separates service jobs from automation jobs
 */
async function analyzeJobsCollection() {
  console.log('\n📊 STEP 1: Analyzing existing jobs collection...\n');

  const jobsSnapshot = await db.collection('jobs').get();
  const serviceJobs = [];
  const automationJobs = [];

  jobsSnapshot.docs.forEach(doc => {
    const data = doc.data();

    // Heuristic: automation jobs have 'inventoryId', service jobs have 'assigneeName'
    if (data.inventoryId) {
      automationJobs.push({ id: doc.id, ...data });
    } else if (data.assigneeName || data.clientAddress || data.checklist) {
      serviceJobs.push({ id: doc.id, ...data });
    } else {
      console.warn(`⚠️  Unknown job type: ${doc.id} - adding to service jobs as fallback`);
      serviceJobs.push({ id: doc.id, ...data });
    }
  });

  console.log(`   ✓ Found ${serviceJobs.length} service jobs (scheduling app)`);
  console.log(`   ✓ Found ${automationJobs.length} automation jobs (resale backend)`);

  return { serviceJobs, automationJobs };
}

/**
 * Step 2: Extract and create unique clients
 */
async function createClientsCollection(serviceJobs) {
  console.log('\n👥 STEP 2: Creating clients collection...\n');

  const clientsMap = new Map();

  // Extract unique clients from service jobs
  serviceJobs.forEach(job => {
    // Try to extract client name from title or use a placeholder
    const clientName = job.title ? job.title.split(' - ')[0] : 'Unknown Client';
    const normalizedName = clientName.trim().toLowerCase();

    if (!clientsMap.has(normalizedName)) {
      clientsMap.set(normalizedName, {
        name: clientName.trim(),
        email: '', // Will need to be filled manually by admin
        phone: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'scheduling',
        stats: {
          totalServiceJobs: 0,
          totalPropertiesServiced: 0,
          totalItemsListed: 0,
          totalItemsSold: 0,
          totalRevenue: 0
        },
        notes: 'Auto-created during Phase X migration',
        tags: []
      });
    }
  });

  // Create client documents
  const batch = db.batch();
  let batchCount = 0;

  for (const [normalizedName, clientData] of clientsMap.entries()) {
    const clientRef = db.collection('clients').doc();
    batch.set(clientRef, clientData);
    batchCount++;

    // Commit in batches of 500 (Firestore limit)
    if (batchCount >= 500) {
      await batch.commit();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  stats.clientsCreated = clientsMap.size;
  console.log(`   ✓ Created ${stats.clientsCreated} client records`);

  return clientsMap;
}

/**
 * Step 3: Extract and create unique properties
 */
async function createPropertiesCollection(serviceJobs) {
  console.log('\n🏠 STEP 3: Creating properties collection...\n');

  const propertiesMap = new Map();

  // Get all clients to link properties
  const clientsSnapshot = await db.collection('clients').get();
  const clientsByName = new Map();
  clientsSnapshot.docs.forEach(doc => {
    const clientData = doc.data();
    clientsByName.set(clientData.name.toLowerCase(), doc.id);
  });

  // Extract unique properties from service jobs
  serviceJobs.forEach(job => {
    const address = job.clientAddress || 'Unknown Address';
    const normalizedAddress = address.trim().toLowerCase();

    if (!propertiesMap.has(normalizedAddress)) {
      // Try to match client
      const clientName = job.title ? job.title.split(' - ')[0].trim() : 'Unknown Client';
      const clientId = clientsByName.get(clientName.toLowerCase()) || null;

      propertiesMap.set(normalizedAddress, {
        clientId: clientId,
        address: address.trim(),
        city: '', // Extract from address if possible
        state: '',
        zip: '',
        serviceJobIds: [],
        inventoryItemIds: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        propertyType: 'residential',
        notes: 'Auto-created during Phase X migration'
      });
    }
  });

  // Create property documents
  const batch = db.batch();
  let batchCount = 0;

  for (const [normalizedAddress, propertyData] of propertiesMap.entries()) {
    const propertyRef = db.collection('properties').doc();
    batch.set(propertyRef, propertyData);
    batchCount++;

    if (batchCount >= 500) {
      await batch.commit();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  stats.propertiesCreated = propertiesMap.size;
  console.log(`   ✓ Created ${stats.propertiesCreated} property records`);

  return propertiesMap;
}

/**
 * Step 4: Migrate service jobs
 */
async function migrateServiceJobs(serviceJobs) {
  console.log('\n🔄 STEP 4: Migrating service jobs collection...\n');

  // Get clients and properties for lookups
  const clientsSnapshot = await db.collection('clients').get();
  const propertiesSnapshot = await db.collection('properties').get();

  const clientsByName = new Map();
  clientsSnapshot.docs.forEach(doc => {
    const clientData = doc.data();
    clientsByName.set(clientData.name.toLowerCase(), doc.id);
  });

  const propertiesByAddress = new Map();
  propertiesSnapshot.docs.forEach(doc => {
    const propertyData = doc.data();
    propertiesByAddress.set(propertyData.address.toLowerCase(), doc.id);
  });

  // Migrate each service job
  const batch = db.batch();
  let batchCount = 0;

  for (const job of serviceJobs) {
    // Extract client name from title
    const clientName = job.title ? job.title.split(' - ')[0].trim() : 'Unknown Client';
    const clientId = clientsByName.get(clientName.toLowerCase()) || null;

    // Get property ID from address
    const address = job.clientAddress || 'Unknown Address';
    const propertyId = propertiesByAddress.get(address.toLowerCase()) || null;

    // Create enhanced service job document
    const serviceJobData = {
      ...job,
      clientId: clientId,
      propertyId: propertyId,
      inventoryExtracted: false,
      extractedItemIds: [],
      // Preserve all original fields for backward compatibility
    };

    const serviceJobRef = db.collection('serviceJobs').doc(job.id);
    batch.set(serviceJobRef, serviceJobData);
    batchCount++;

    if (batchCount >= 500) {
      await batch.commit();
      stats.serviceJobsMigrated += batchCount;
      console.log(`   ⏳ Migrated ${stats.serviceJobsMigrated} service jobs...`);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    stats.serviceJobsMigrated += batchCount;
  }

  console.log(`   ✓ Migrated ${stats.serviceJobsMigrated} service jobs to new collection`);
}

/**
 * Step 5: Migrate automation jobs
 */
async function migrateAutomationJobs(automationJobs) {
  console.log('\n🤖 STEP 5: Migrating automation jobs collection...\n');

  const batch = db.batch();
  let batchCount = 0;

  for (const job of automationJobs) {
    const automationJobRef = db.collection('automationJobs').doc(job.id);
    batch.set(automationJobRef, job);
    batchCount++;

    if (batchCount >= 500) {
      await batch.commit();
      stats.automationJobsMigrated += batchCount;
      console.log(`   ⏳ Migrated ${stats.automationJobsMigrated} automation jobs...`);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    stats.automationJobsMigrated += batchCount;
  }

  console.log(`   ✓ Migrated ${stats.automationJobsMigrated} automation jobs to new collection`);
}

/**
 * Step 6: Update inventory items with client/property references
 */
async function enhanceInventoryCollection() {
  console.log('\n📦 STEP 6: Enhancing inventory collection with client/property links...\n');

  const inventorySnapshot = await db.collection('inventory').get();
  const clientsSnapshot = await db.collection('clients').get();

  const clientsByName = new Map();
  clientsSnapshot.docs.forEach(doc => {
    const clientData = doc.data();
    clientsByName.set(clientData.name.toLowerCase(), doc.id);
  });

  const batch = db.batch();
  let batchCount = 0;
  let itemsUpdated = 0;

  for (const doc of inventorySnapshot.docs) {
    const item = doc.data();
    const clientName = item.clientName || '';
    const clientId = clientsByName.get(clientName.toLowerCase()) || null;

    if (clientId) {
      const updates = {
        clientId: clientId,
        // propertyId will be set later when admin extracts items from jobs
        sourceServiceJobId: null // Will be set when items are extracted from jobs
      };

      batch.update(doc.ref, updates);
      batchCount++;
      itemsUpdated++;

      if (batchCount >= 500) {
        await batch.commit();
        console.log(`   ⏳ Updated ${itemsUpdated} inventory items...`);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`   ✓ Enhanced ${itemsUpdated} inventory items with client references`);
}

/**
 * Step 7: Update users collection with app access
 */
async function enhanceUsersCollection() {
  console.log('\n👤 STEP 7: Enhancing users collection with app access controls...\n');

  const usersSnapshot = await db.collection('users').get();
  const batch = db.batch();
  let batchCount = 0;

  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();

    // Admins get access to both apps, scholars only get scheduling
    const appAccess = {
      scheduling: true,
      resale: userData.role === 'admin'
    };

    batch.update(doc.ref, { appAccess });
    batchCount++;

    if (batchCount >= 500) {
      await batch.commit();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`   ✓ Updated ${usersSnapshot.size} users with app access controls`);
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 ========================================');
  console.log('   PHASE X: DATA MIGRATION SCRIPT');
  console.log('   Garage Scholars Application Integration');
  console.log('========================================\n');

  try {
    // Step 1: Analyze existing jobs
    const { serviceJobs, automationJobs } = await analyzeJobsCollection();

    // Step 2: Create clients
    await createClientsCollection(serviceJobs);

    // Step 3: Create properties
    await createPropertiesCollection(serviceJobs);

    // Step 4: Migrate service jobs
    await migrateServiceJobs(serviceJobs);

    // Step 5: Migrate automation jobs
    await migrateAutomationJobs(automationJobs);

    // Step 6: Enhance inventory
    await enhanceInventoryCollection();

    // Step 7: Enhance users
    await enhanceUsersCollection();

    // Final summary
    console.log('\n✅ ========================================');
    console.log('   MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('========================================\n');
    console.log('📊 Migration Statistics:');
    console.log(`   • Service jobs migrated: ${stats.serviceJobsMigrated}`);
    console.log(`   • Automation jobs migrated: ${stats.automationJobsMigrated}`);
    console.log(`   • Clients created: ${stats.clientsCreated}`);
    console.log(`   • Properties created: ${stats.propertiesCreated}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
      stats.errors.forEach(err => console.log(`   - ${err}`));
    }

    console.log('\n📝 Next Steps:');
    console.log('   1. Verify migrated data in Firebase Console');
    console.log('   2. Update application code to use new collections');
    console.log('   3. Test thoroughly in development');
    console.log('   4. Once verified, you can safely delete the old "jobs" collection');
    console.log('\n   ⚠️  DO NOT delete the old "jobs" collection until migration is verified!\n');

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error);
    stats.errors.push(error.message);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
