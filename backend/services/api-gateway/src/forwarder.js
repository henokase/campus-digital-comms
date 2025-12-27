async function forwardRequest({ req, res, targetBaseUrl }) {
  const url = new URL(req.originalUrl, targetBaseUrl);

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (k.toLowerCase() === 'host') continue;
    if (k.toLowerCase() === 'content-length') continue;
    if (k.toLowerCase() === 'connection') continue;
    headers[k] = v;
  }

  if (req.user) {
    if (req.user.userId && !headers['x-user-id']) headers['x-user-id'] = String(req.user.userId);
    if (req.user.role && !headers['x-user-role']) headers['x-user-role'] = String(req.user.role);
  }

  const init = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = JSON.stringify(req.body ?? {});
    if (!headers['content-type'] && !headers['Content-Type']) {
      init.headers['content-type'] = 'application/json';
    }
  }

  const upstream = await fetch(url.toString(), init);

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    res.setHeader(key, value);
  });

  const contentType = upstream.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await upstream.json();
    return res.json(json);
  }

  const text = await upstream.text();
  return res.send(text);
}

module.exports = { forwardRequest };
