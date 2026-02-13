const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

const TEMP_DIR = path.join(__dirname, '..', 'temp_downloads');
const DEBUG_DIR = path.join(__dirname, '..', 'debug_screenshots');

/**
 * Remove all temp files associated with a specific job/document ID.
 */
function cleanupJobFiles(docId) {
    let removed = 0;
    for (const dir of [TEMP_DIR, DEBUG_DIR]) {
        if (!fs.existsSync(dir)) continue;
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (file.includes(docId)) {
                    fs.unlinkSync(path.join(dir, file));
                    removed++;
                }
            }
        } catch (err) {
            logger.warn('Failed to cleanup job files', { docId, dir, error: err.message });
        }
    }
    if (removed > 0) {
        logger.debug('Cleaned up temp files', { docId, removed });
    }
}

/**
 * Remove files older than maxAgeMs from temp directories.
 * Call this periodically to prevent disk fill.
 */
function cleanupStaleFiles(maxAgeMs = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const dir of [TEMP_DIR, DEBUG_DIR]) {
        if (!fs.existsSync(dir)) continue;
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                if (stat.mtimeMs < cutoff) {
                    fs.unlinkSync(filePath);
                    removed++;
                }
            }
        } catch (err) {
            logger.warn('Failed to cleanup stale files', { dir, error: err.message });
        }
    }
    if (removed > 0) {
        logger.info('Cleaned up stale temp files', { removed, maxAgeMs });
    }
}

module.exports = { cleanupJobFiles, cleanupStaleFiles, TEMP_DIR, DEBUG_DIR };
