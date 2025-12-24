const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'announcement-service' });
});

app.post('/api/announcements', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: create announcement' });
});

app.get('/api/announcements', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: list announcements' });
});

app.get('/api/announcements/:id', (req, res) => {
  res.status(501).json({ message: `Not implemented: get announcement ${req.params.id}` });
});

app.put('/api/announcements/:id', (req, res) => {
  res.status(501).json({ message: `Not implemented: update announcement ${req.params.id}` });
});

app.delete('/api/announcements/:id', (req, res) => {
  res.status(501).json({ message: `Not implemented: delete announcement ${req.params.id}` });
});

app.post('/api/announcements/:id/publish', (req, res) => {
  res.status(501).json({ message: `Not implemented: publish announcement ${req.params.id}` });
});

const port = Number(process.env.PORT || 3002);
app.listen(port, () => {
  console.log(`announcement-service listening on ${port}`);
});
