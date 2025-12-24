const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'feedback-analytics-service' });
});

app.post('/api/feedback', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: submit feedback' });
});

app.get('/api/feedback/announcement/:id', (req, res) => {
  res.status(501).json({ message: `Not implemented: feedback for announcement ${req.params.id}` });
});

app.get('/api/feedback/my', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: my feedback' });
});

app.get('/api/analytics/dashboard', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: analytics dashboard' });
});

app.get('/api/analytics/announcement/:id', (req, res) => {
  res.status(501).json({ message: `Not implemented: analytics for announcement ${req.params.id}` });
});

const port = Number(process.env.PORT || 3004);
app.listen(port, () => {
  console.log(`feedback-analytics-service listening on ${port}`);
});
