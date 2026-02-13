require('dotenv').config();

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const express = require('express');
const os = require('os');
const { runListingAutomation, closeAllProxies } = require('./automation/runListingAutomation');
const { logger } = require('./lib/logger');
const { cleanupStaleFiles } = require('./lib/cleanup');

// --- Configuration ---
const WORKER_ID = process.env.WORKER_ID || `${os.hostname()}-${process.pid}`;
const LEASE_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS, 10) || 3;
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS, 10) || 2;
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT, 10) || 3001;
const STALE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// --- Firebase Init ---
const serviceAccount = require('./service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = getFirestore();

const jobsCollection = db.collection('automationJobs');
const inventoryCollection = db.collection('inventory');
const notificationsCollection = db.collection('adminNotifications');

// --- Worker State ---
let activeJobCount = 0;
let shuttingDown = false;
let pollInterval = null;
let staleCleanupInterval = null;
let snapshotUnsubscribe = null;
const startedAt = Date.now();
let lastJobAt = null;
let jobsProcessed = 0;
let jobsSucceeded = 0;
let jobsFailed = 0;

// =====================
// JOB QUEUE FUNCTIONS
// =====================

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
    // Skip jobs that have exceeded max attempts
    const queuedSnap = await jobsCollection
        .where('status', '==', 'queued')
        .orderBy('createdAt')
        .limit(1)
        .get();

    if (!queuedSnap.empty) {
        const doc = queuedSnap.docs[0];
        const data = doc.data();
        if ((data.attempts || 0) >= MAX_ATTEMPTS) {
            await markDeadLetter(doc.ref, data);
            return null;
        }
        return doc.ref;
    }

    const now = admin.firestore.Timestamp.fromMillis(Date.now());
    const expiredSnap = await jobsCollection
        .where('status', '==', 'running')
        .where('leaseExpiresAt', '<=', now)
        .orderBy('leaseExpiresAt')
        .limit(1)
        .get();

    if (!expiredSnap.empty) {
        const doc = expiredSnap.docs[0];
        const data = doc.data();
        if ((data.attempts || 0) >= MAX_ATTEMPTS) {
            await markDeadLetter(doc.ref, data);
            return null;
        }
        return doc.ref;
    }

    return null;
}

async function markDeadLetter(jobRef, jobData) {
    logger.warn('Job exceeded max attempts, moving to dead letter', {
        jobId: jobRef.id,
        inventoryId: jobData?.inventoryId,
        attempts: jobData?.attempts,
        maxAttempts: MAX_ATTEMPTS
    });

    await jobRef.update({
        status: 'dead_letter',
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        leaseOwner: null,
        leaseExpiresAt: null
    });

    // Alert admins
    try {
        await notificationsCollection.add({
            type: 'dead_letter_job',
            jobId: jobRef.id,
            inventoryId: jobData?.inventoryId || null,
            message: `Automation job failed after ${jobData?.attempts || MAX_ATTEMPTS} attempts`,
            lastError: jobData?.lastError || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });
    } catch (err) {
        logger.error('Failed to create admin notification', { error: err.message });
    }

    jobsFailed++;
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
        if (attempts > MAX_ATTEMPTS) return null;

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
    const log = logger.child({ jobId: jobRef.id, inventoryId: jobData.inventoryId });
    const inventoryRef = inventoryCollection.doc(jobData.inventoryId);
    const inventorySnap = await inventoryRef.get();

    if (!inventorySnap.exists) {
        log.error('Inventory document not found');
        await completeJob(jobRef, 'failed', {
            lastError: {
                message: 'Inventory document not found',
                platform: 'JOB',
                screenshotPath: ''
            }
        });
        jobsFailed++;
        return;
    }

    try {
        log.info('Starting automation', { attempt: jobData.attempts });
        const result = await runListingAutomation(jobData.inventoryId, inventorySnap.data(), db, admin);
        if (result.success) {
            log.info('Automation succeeded');
            await completeJob(jobRef, 'succeeded', {
                lastError: null,
                artifacts: { screenshots: result.screenshots || [] },
                results: result.results || {}
            });
            jobsSucceeded++;
        } else if (result.complianceFailed) {
            // Compliance failures are permanent — the listing content itself violates
            // platform rules. Retrying won't help, so mark as final and don't count
            // toward retry attempts.
            log.warn('Compliance check failed — not retryable', {
                errors: result.errors,
                inventoryId: jobData.inventoryId
            });
            await completeJob(jobRef, 'compliance_failed', {
                lastError: result.lastError || {
                    message: `Compliance failed: ${(result.errors || []).join('; ')}`,
                    platform: 'FB',
                    screenshotPath: ''
                },
                artifacts: { screenshots: [] },
                results: result.results || {}
            });
            // Notify admins about the compliance issue
            try {
                await notificationsCollection.add({
                    type: 'compliance_failure',
                    jobId: jobRef.id,
                    inventoryId: jobData.inventoryId,
                    errors: result.errors || [],
                    message: `Listing failed compliance: ${(result.errors || []).join('; ')}`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false
                });
            } catch (notifErr) {
                log.error('Failed to create compliance notification', { error: notifErr.message });
            }
            jobsFailed++;
        } else {
            log.warn('Automation failed', { lastError: result.lastError });
            await completeJob(jobRef, 'failed', {
                lastError: result.lastError || {
                    message: 'Automation failed',
                    platform: 'JOB',
                    screenshotPath: ''
                },
                artifacts: { screenshots: result.screenshots || [] },
                results: result.results || {}
            });
            jobsFailed++;
        }
    } catch (error) {
        log.error('Automation threw exception', { error: error.message, stack: error.stack });
        await completeJob(jobRef, 'failed', {
            lastError: {
                message: error.message || String(error),
                platform: 'JOB',
                screenshotPath: ''
            }
        });
        jobsFailed++;
    }

    lastJobAt = Date.now();
    jobsProcessed++;
}

// =====================
// WORKER LOOP
// =====================

async function jobWorkerLoop() {
    if (shuttingDown) return;
    if (activeJobCount >= MAX_CONCURRENT_JOBS) return;

    activeJobCount++;
    try {
        const jobRef = await findClaimableJob();
        if (!jobRef) return;
        const claimed = await claimJob(jobRef);
        if (!claimed) return;
        await processJob(jobRef, claimed);
    } catch (error) {
        logger.error('Job worker loop error', { error: error.message, stack: error.stack });
    } finally {
        activeJobCount--;
    }
}

// =====================
// HEALTH CHECK SERVER
// =====================

const app = express();

app.get('/health', (_req, res) => {
    res.json({
        status: shuttingDown ? 'shutting_down' : 'ok',
        workerId: WORKER_ID,
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        activeJobs: activeJobCount,
        maxConcurrentJobs: MAX_CONCURRENT_JOBS,
        lastJobAt: lastJobAt ? new Date(lastJobAt).toISOString() : null
    });
});

app.get('/stats', (_req, res) => {
    res.json({
        workerId: WORKER_ID,
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        jobsProcessed,
        jobsSucceeded,
        jobsFailed,
        activeJobs: activeJobCount,
        maxAttempts: MAX_ATTEMPTS,
        maxConcurrentJobs: MAX_CONCURRENT_JOBS
    });
});

// =====================
// GRACEFUL SHUTDOWN
// =====================

async function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutdown signal received, stopping...', { signal });

    // Stop accepting new work
    if (pollInterval) clearInterval(pollInterval);
    if (staleCleanupInterval) clearInterval(staleCleanupInterval);
    if (snapshotUnsubscribe) snapshotUnsubscribe();

    // Wait for in-flight jobs (up to 30s)
    const deadline = Date.now() + 30000;
    while (activeJobCount > 0 && Date.now() < deadline) {
        logger.info('Waiting for in-flight jobs to complete...', { activeJobs: activeJobCount });
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (activeJobCount > 0) {
        logger.warn('Forcing shutdown with active jobs', { activeJobs: activeJobCount });
    }

    // Close any open proxy connections
    await closeAllProxies().catch(() => {});

    logger.info('Shutdown complete', { jobsProcessed, jobsSucceeded, jobsFailed });
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// =====================
// STARTUP
// =====================

logger.info('Worker starting', { workerId: WORKER_ID, maxConcurrentJobs: MAX_CONCURRENT_JOBS, maxAttempts: MAX_ATTEMPTS });

// Inventory listener — enqueue jobs for pending items
snapshotUnsubscribe = inventoryCollection.where('status', '==', 'Pending').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
            enqueueJob(change.doc.ref).catch((error) => {
                logger.error('Failed to enqueue job', { inventoryId: change.doc.id, error: error.message });
            });
        }
    });
});

// Poll for claimable jobs
pollInterval = setInterval(jobWorkerLoop, POLL_INTERVAL_MS);

// Periodic stale file cleanup (every hour, removes files older than 24h)
staleCleanupInterval = setInterval(() => cleanupStaleFiles(), STALE_CLEANUP_INTERVAL_MS);

// Health check server
app.listen(HEALTH_PORT, () => {
    logger.info('Health check server listening', { port: HEALTH_PORT });
});
