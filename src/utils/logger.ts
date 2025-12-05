import winston from 'winston';
import path from 'path';

// Define custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Choose the aspect of your log customizing the log format.
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define which transports the logger must use to print out messages.
const transports: winston.transport[] = [
  // Allow console logging
  new winston.transports.Console({
    format: format,
  }),
];

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// In production, also log to files
if (process.env.NODE_ENV === 'production') {
  transports.push(
    // Allow to print all the error level messages inside the error.log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
    // Allow to print all the messages inside the all.log file
    new winston.transports.File({
      filename: path.join(logsDir, 'all.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  // Do not exit on handled exceptions
  exitOnError: false,
});

// Create a stream object with a 'write' function that will be used by morgan
const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export { logger, morganStream };

// Export specific logging functions for convenience
export const logError = (message: string, error?: any) => {
  if (error) {
    logger.error(`${message}: ${error.message}`, { stack: error.stack });
  } else {
    logger.error(message);
  }
};

export const logWarn = (message: string) => {
  logger.warn(message);
};

export const logInfo = (message: string) => {
  logger.info(message);
};

export const logDebug = (message: string) => {
  logger.debug(message);
};

export const logHttp = (message: string) => {
  logger.http(message);
};

// For auth-specific logging
export const logAuth = {
  signup: (email: string, success: boolean) => {
    logger.info(`AUTH: Signup attempt - ${email} - ${success ? 'SUCCESS' : 'FAILED'}`);
  },
  login: (email: string, success: boolean, reason?: string) => {
    const status = success ? 'SUCCESS' : `FAILED${reason ? ` - ${reason}` : ''}`;
    logger.info(`AUTH: Login attempt - ${email} - ${status}`);
  },
  logout: (email: string) => {
    logger.info(`AUTH: Logout - ${email}`);
  },
  passwordChange: (email: string, success: boolean) => {
    logger.info(`AUTH: Password change - ${email} - ${success ? 'SUCCESS' : 'FAILED'}`);
  },
  emailVerification: (email: string, success: boolean) => {
    logger.info(`AUTH: Email verification - ${email} - ${success ? 'SUCCESS' : 'FAILED'}`);
  },
  passwordReset: (email: string, action: 'REQUEST' | 'RESET', success: boolean) => {
    logger.info(`AUTH: Password ${action.toLowerCase()} - ${email} - ${success ? 'SUCCESS' : 'FAILED'}`);
  },
  accountLock: (email: string, attempts: number) => {
    logger.warn(`AUTH: Account locked - ${email} - ${attempts} failed attempts`);
  },
  tokenRefresh: (email: string, success: boolean) => {
    logger.info(`AUTH: Token refresh - ${email} - ${success ? 'SUCCESS' : 'FAILED'}`);
  },
  securityEvent: (email: string, event: string, details?: string) => {
    logger.warn(`AUTH: Security event - ${email} - ${event}${details ? ` - ${details}` : ''}`);
  }
};