export const responseHandler = {
  success: (res, data = {}, statusCode = 200) => {
    return res.status(statusCode).json(data);
  },
  error: (res, message = 'Internal Server Error', statusCode = 500, detail = null) => {
    return res.status(statusCode).json({
      detail: detail || message,
      error: message,
      status_code: statusCode,
    });
  }
};
