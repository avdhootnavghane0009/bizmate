import app from './app.js';
import { config } from './config/environment.js';
import { logger } from './utils/logger.js';

const server = app.listen(config.PORT, () => {
  logger.info(`BizMate Node.js backend listening on http://localhost:${config.PORT}`);
  logger.info(`API v1 Base URL: http://localhost:${config.PORT}${config.API_V1_STR}`);
  logger.info(`Gemini AI Model: ${config.GEMINI_MODEL}`);
  logger.info(`WhatsApp API Version: ${config.WHATSAPP_API_VERSION}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});
