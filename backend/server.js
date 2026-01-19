require('dotenv').config();

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const os = require('os');
const { runListingAutomation } = require('./automation/runListingAutomation');

// 1. INITIALIZE FIREBASE
const serviceAccount = require('./service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = getFirestore();
const WORKER_ID = process.env.WORKER_ID || `${os.hostname()}-${process.pid}`;
const LEASE_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 5000;

console.log("🤖 NODE ROBOT ONLINE: Watching for 'Pending' items...");

const jobsCollection = db.collection('jobs');
const inventoryCollection = db.collection('inventory');

async function enqueueJob(inventoryRef) {
    return db.runTransaction(async (tx) => {
        const inventorySnap = await tx.get(inventoryRef);
        if (!inventorySnap.exists) return null;
        const inventory = inventorySnap.data();
        if (inventory.status !== 'Pending') return null;

        const activeJobId = inventory.activeJobId;
        if (activeJobId) {
            const activeJobRef = jobsCollection.doc(activeJobId);
            const activeJobSnap = await tx.get(activeJobRef);
            if (activeJobSnap.exists) {
                const status = activeJobSnap.data().status;
                if (status === 'queued' || status === 'running') return null;
            }
        }

        const jobRef = jobsCollection.doc();
        tx.set(jobRef, {
            inventoryId: inventoryRef.id,
            status: 'queued',
            attempts: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            startedAt: null,
            finishedAt: null,
            leaseOwner: null,
            leaseExpiresAt: null,
            lastError: null,
            artifacts: { screenshots: [] }
        });
        tx.update(inventoryRef, { activeJobId: jobRef.id });
        return jobRef.id;
    });
}

async function findClaimableJob() {
    const queuedSnap = await jobsCollection
        .where('status', '==', 'queued')
        .orderBy('createdAt')
        .limit(1)
        .get();

    if (!queuedSnap.empty) return queuedSnap.docs[0].ref;

    const now = admin.firestore.Timestamp.fromMillis(Date.now());
    const expiredSnap = await jobsCollection
        .where('status', '==', 'running')
        .where('leaseExpiresAt', '<=', now)
        .orderBy('leaseExpiresAt')
        .limit(1)
        .get();

    if (!expiredSnap.empty) return expiredSnap.docs[0].ref;
    return null;
}

async function claimJob(jobRef) {
    return db.runTransaction(async (tx) => {
        const jobSnap = await tx.get(jobRef);
        if (!jobSnap.exists) return null;

        const job = jobSnap.data();
        const now = Date.now();
        const leaseExpired = job.leaseExpiresAt && job.leaseExpiresAt.toMillis && job.leaseExpiresAt.toMillis() <= now;
        const canClaim = job.status === 'queued' || (job.status === 'running' && leaseExpired);
        if (!canClaim) return null;

        const attempts = (job.attempts || 0) + 1;
        const leaseExpiresAt = admin.firestore.Timestamp.fromMillis(now + LEASE_MS);
        tx.update(jobRef, {
            status: 'running',
            startedAt: job.startedAt || admin.firestore.FieldValue.serverTimestamp(),
            leaseOwner: WORKER_ID,
            leaseExpiresAt,
            attempts
        });
        return { id: jobRef.id, ...job, attempts, leaseExpiresAt };
    });
}

async function completeJob(jobRef, status, data = {}) {
    await jobRef.update({
        status,
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        leaseOwner: null,
        leaseExpiresAt: null,
        ...data
    });
}

async function processJob(jobRef, jobData) {
    const inventoryRef = inventoryCollection.doc(jobData.inventoryId);
    const inventorySnap = await inventoryRef.get();
    if (!inventorySnap.exists) {
        await completeJob(jobRef, 'failed', {
            lastError: {
                message: 'Inventory document not found',
                platform: 'JOB',
                screenshotPath: ''
            }
        });
        return;
    }

    try {
        const result = await runListingAutomation(jobData.inventoryId, inventorySnap.data(), db, admin);
        if (result.success) {
            await completeJob(jobRef, 'succeeded', {
                lastError: null,
                artifacts: { screenshots: result.screenshots || [] },
                results: result.results || {}
            });
        } else {
            await completeJob(jobRef, 'failed', {
                lastError: result.lastError || {
                    message: 'Automation failed',
                    platform: 'JOB',
                    screenshotPath: ''
                },
                artifacts: { screenshots: result.screenshots || [] },
                results: result.results || {}
            });
        }
    } catch (error) {
        await completeJob(jobRef, 'failed', {
            lastError: {
                message: error.message || String(error),
                platform: 'JOB',
                screenshotPath: ''
            }
        });
    }
}

let workerActive = false;
async function jobWorkerLoop() {
    if (workerActive) return;
    workerActive = true;
    try {
        const jobRef = await findClaimableJob();
        if (!jobRef) return;
        const claimed = await claimJob(jobRef);
        if (!claimed) return;
        await processJob(jobRef, claimed);
    } catch (error) {
        console.error('Job worker error:', error);
    } finally {
        workerActive = false;
    }
}

// 👂 INVENTORY -> JOB ENQUEUER
inventoryCollection.where('status', '==', 'Pending').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
            enqueueJob(change.doc.ref).catch((error) => {
                console.error('Failed to enqueue job:', error);
            });
        }
    });
});

setInterval(jobWorkerLoop, POLL_INTERVAL_MS);
