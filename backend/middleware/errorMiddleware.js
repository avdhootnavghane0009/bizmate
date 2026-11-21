import { logger } from '../utils/logger.js';

export function errorMiddleware(err, req, res, next) {
  logger.error(`Unhandled error at ${req.method} ${req.url}:`, err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    detail: message,
    error: err.name || 'Error',
    status_code: statusCode,
  });
}
