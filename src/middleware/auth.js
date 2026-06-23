function widgetAuth(req, res, next) {
  // Skip auth in development
  if (process.env.NODE_ENV === 'development') return next();

  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!apiKey || apiKey !== process.env.WIDGET_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = { widgetAuth };
