function errorHandler(error, req, res, next) {
  void req;
  void next;
  console.error(error.message);
  res.status(error.status || 500).json({ success: false, message: error.message || 'Server error', data: null });
}

module.exports = errorHandler;
