const formatTime = () => new Date().toISOString();

export const logger = {
  info: (...args) => console.log(`[${formatTime()}] [INFO]:`, ...args),
  warn: (...args) => console.warn(`[${formatTime()}] [WARN]:`, ...args),
  error: (...args) => console.error(`[${formatTime()}] [ERROR]:`, ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${formatTime()}] [DEBUG]:`, ...args);
    }
  }
};
