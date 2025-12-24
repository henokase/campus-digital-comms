const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

app.get('/api/notifications', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: list notifications' });
});

app.get('/api/notifications/unread-count', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: unread count' });
});

app.put('/api/notifications/:id/read', (req, res) => {
  res.status(501).json({ message: `Not implemented: mark read ${req.params.id}` });
});

const port = Number(process.env.PORT || 3003);
app.listen(port, () => {
  console.log(`notification-service listening on ${port}`);
});
