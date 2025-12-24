const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

app.use('/api/auth', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: route to auth-service' });
});

app.use('/api/announcements', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: route to announcement-service' });
});

app.use('/api/notifications', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: route to notification-service' });
});

app.use('/api/feedback', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: route to feedback-analytics-service' });
});

app.use('/api/analytics', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: route to feedback-analytics-service' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`api-gateway listening on ${port}`);
});
