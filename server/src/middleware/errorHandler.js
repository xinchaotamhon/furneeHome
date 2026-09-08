function errorHandler(error, req, res, next) {
  void req;
  void next;
  let status = error.status || 500;
  let message = error.message || 'Server error';

  if (error.name === 'ValidationError' || error.name === 'CastError') status = 400;
  if (error.code === 11000) {
    status = 409;
    message = 'Dữ liệu này đã tồn tại.';
  }

  if (status >= 500) console.error(error.message);

  res.status(status).json({ success: false, message, data: null });
}

module.exports = errorHandler;
