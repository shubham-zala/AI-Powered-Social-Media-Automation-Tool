const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

// Define log directory
const logDir = path.join(__dirname, '../logs');

// Define Log Format
const logFormat = winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level}]: ${message}`;
});

// Create Transports (Destinations)
const transports = [
    // 1. Console (Terminal) - Keep original colors
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }),

    // 2. Daily Rotate File (Application Logs)
    new winston.transports.DailyRotateFile({
        filename: path.join(logDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true, // Compress old logs
        maxSize: '20m',      // Rotate if file > 20MB
        maxFiles: '14d',     // Keep logs for 14 days
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            logFormat
        )
    }),

    // 3. Separate Error File (Only Errors)
    new winston.transports.DailyRotateFile({
        level: 'error',
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            logFormat
        )
    })
];

// Create Logger Instance
const logger = winston.createLogger({
    level: 'info', // Capture info, warn, error
    transports: transports
});

// --- Magic: Override Console.log ---
// This ensures we capture logs from existing code without rewriting everything.
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {
    const msg = args.map(arg => {
        if (arg instanceof Error) return arg.stack || arg.message;
        return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg;
    }).join(' ');
    logger.info(msg);
};

console.error = (...args) => {
    const msg = args.map(arg => {
        if (arg instanceof Error) return arg.stack || arg.message;
        return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg;
    }).join(' ');
    logger.error(msg);
};

console.warn = (...args) => {
    const msg = args.map(arg => {
        if (arg instanceof Error) return arg.stack || arg.message;
        return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg;
    }).join(' ');
    logger.warn(msg);
};

console.info = console.log; // Alias

module.exports = logger;
