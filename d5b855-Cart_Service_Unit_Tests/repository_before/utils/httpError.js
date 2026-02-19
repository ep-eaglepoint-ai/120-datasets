class HttpError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'HttpError';
  }
}

module.exports = HttpError;

