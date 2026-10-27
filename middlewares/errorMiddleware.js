function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "An unexpected error occurred on the server";

  // Log in server console for debugging
  console.error(`[Error] ${req.method} ${req.url}:`, err.message);

  return res.status(statusCode).json({
    error: message,
  });
}

function notFoundHandler(req, res) {
  return res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
