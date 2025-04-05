/**
 * Log levels for the Logger
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
/**
 * Simple logging utility for the caching service
 */
export class Logger {
    /**
     * Create a new Logger
     * @param config Logger configuration
     */
    constructor(config) {
        this.config = {
            minLevel: LogLevel.INFO,
            includeTimestamps: true,
            environment: 'development',
            ...config,
        };
    }
    /**
     * Format a log message
     * @param level Log level
     * @param message Message to log
     * @param data Additional data to log
     * @returns Formatted log message
     */
    formatMessage(level, message, data) {
        const parts = [];
        if (this.config.includeTimestamps) {
            parts.push(`[${new Date().toISOString()}]`);
        }
        parts.push(`[${LogLevel[level]}]`);
        parts.push(`[${this.config.environment}]`);
        parts.push(message);
        if (data) {
            parts.push(JSON.stringify(data));
        }
        return parts.join(' ');
    }
    /**
     * Log a message if the level is at or above the minimum level
     * @param level Log level
     * @param message Message to log
     * @param data Additional data to log
     */
    log(level, message, data) {
        if (level < this.config.minLevel)
            return;
        const formattedMessage = this.formatMessage(level, message, data);
        switch (level) {
            case LogLevel.ERROR:
                console.error(formattedMessage);
                break;
            case LogLevel.WARN:
                console.warn(formattedMessage);
                break;
            case LogLevel.INFO:
                console.info(formattedMessage);
                break;
            case LogLevel.DEBUG:
            default:
                console.debug(formattedMessage);
                break;
        }
    }
    /**
     * Log a debug message
     * @param message Message to log
     * @param data Additional data to log
     */
    debug(message, data) {
        this.log(LogLevel.DEBUG, message, data);
    }
    /**
     * Log an info message
     * @param message Message to log
     * @param data Additional data to log
     */
    info(message, data) {
        this.log(LogLevel.INFO, message, data);
    }
    /**
     * Log a warning message
     * @param message Message to log
     * @param data Additional data to log
     */
    warn(message, data) {
        this.log(LogLevel.WARN, message, data);
    }
    /**
     * Log an error message
     * @param message Message to log
     * @param data Additional data to log
     */
    error(message, data) {
        this.log(LogLevel.ERROR, message, data);
    }
}
// Get log level from environment or default to INFO
const getLogLevelFromEnv = () => {
    const envLevel = globalThis.LOG_LEVEL || 'INFO';
    switch (envLevel.toUpperCase()) {
        case 'DEBUG': return LogLevel.DEBUG;
        case 'INFO': return LogLevel.INFO;
        case 'WARN': return LogLevel.WARN;
        case 'ERROR': return LogLevel.ERROR;
        default: return LogLevel.INFO;
    }
};
// Get environment name from config
const getEnvironment = () => {
    return globalThis.ENVIRONMENT || 'development';
};
// Export a default logger instance configured from environment
export const logger = new Logger({
    minLevel: getLogLevelFromEnv(),
    includeTimestamps: true,
    environment: getEnvironment()
});
//# sourceMappingURL=logger.js.map