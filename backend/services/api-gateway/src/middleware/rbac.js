function rbacMiddleware(req, res, next) {
  const isAnnouncementWrite = req.path.startsWith('/api/announcements') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const isAnalytics = req.path.startsWith('/api/analytics');
  if (!isAnnouncementWrite && !isAnalytics) return next();

  const role = req.user?.role;
  if (role === 'admin' || role === 'faculty') return next();

  return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role for this action.' } });
}

module.exports = { rbacMiddleware };
