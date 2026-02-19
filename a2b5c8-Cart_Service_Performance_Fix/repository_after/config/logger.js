const logger = {
  error: (msg) => console.error(`[ERROR] ${msg}`),
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`),
};

module.exports = logger;

