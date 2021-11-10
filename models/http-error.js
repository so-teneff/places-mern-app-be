class HttpError extends Error {
  constructor(message, errorCode, cause) {
    super(message); // Add a "message" property
    this.code = errorCode; // Add a "code" property
    this.cause = cause;
  }
}

module.exports = HttpError;
