/**
 * Log levels for the Logger
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
/**
 * Logger configuration
 */
interface LoggerConfig {
    minLevel: LogLevel;
    includeTimestamps: boolean;
    environment: string;
}
/**
 * Simple logging utility for the caching service
 */
export declare class Logger {
    private config;
    /**
     * Create a new Logger
     * @param config Logger configuration
     */
    constructor(config?: Partial<LoggerConfig>);
    /**
     * Format a log message
     * @param level Log level
     * @param message Message to log
     * @param data Additional data to log
     * @returns Formatted log message
     */
    private formatMessage;
    /**
     * Log a message if the level is at or above the minimum level
     * @param level Log level
     * @param message Message to log
     * @param data Additional data to log
     */
    private log;
    /**
     * Log a debug message
     * @param message Message to log
     * @param data Additional data to log
     */
    debug(message: string, data?: any): void;
    /**
     * Log an info message
     * @param message Message to log
     * @param data Additional data to log
     */
    info(message: string, data?: any): void;
    /**
     * Log a warning message
     * @param message Message to log
     * @param data Additional data to log
     */
    warn(message: string, data?: any): void;
    /**
     * Log an error message
     * @param message Message to log
     * @param data Additional data to log
     */
    error(message: string, data?: any): void;
}
export declare const logger: Logger;
export {};
