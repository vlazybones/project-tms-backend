module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal Server Error";

  if (process.env.NODE_ENV === "development") {
    res.status(err.statusCode).json({
      success: false,
      error: err,
    });
  }
  // Handling Wrong JWT token error
  if (err.name === "JsonWebTokenError") {
    const message = "KEE010";
    error = new ErrorHandler(message, 200);
  }

  // Handling Expired JWT token error
  if (err.name === "TokenExpiredError") {
    const message = "KEE010";
    error = new ErrorHandler(message, 200);
  }

  // sql errors
  if (err.name === "SError") {
    const message = "KEE016";
    error = new ErrorHandler(message, 200);

    return res.status(error.statusCode).json({
      result: message,
    });
  }
};
