const winston = require('winston');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const logger = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'garage-scholars-backend' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, jobId, platform, inventoryId, ...rest }) => {
                    let prefix = `${timestamp} [${level}]`;
                    if (jobId) prefix += ` [job:${jobId}]`;
                    if (platform) prefix += ` [${platform}]`;
                    if (inventoryId) prefix += ` [inv:${inventoryId}]`;
                    const extra = Object.keys(rest).length > 0
                        ? ` ${JSON.stringify(rest)}`
                        : '';
                    return `${prefix} ${message}${extra}`;
                })
            )
        })
    ]
});

/**
 * Create a child logger with job context baked in.
 * Usage: const log = createJobLogger({ jobId, inventoryId });
 *        log.info('Starting automation');
 */
const createJobLogger = (meta = {}) => logger.child(meta);

module.exports = { logger, createJobLogger };
