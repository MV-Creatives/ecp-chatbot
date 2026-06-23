function widgetAuth(req, res, next) {
  // Skip auth in development
  if (process.env.NODE_ENV === 'development') return next();

  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const expectedKey = process.env.WIDGET_API_KEY || 'ecp-widget-2026';
  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = { widgetAuth };
