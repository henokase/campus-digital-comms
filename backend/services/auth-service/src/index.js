const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

app.post('/api/auth/register', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: register' });
});

app.post('/api/auth/login', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: login' });
});

app.get('/api/auth/profile', (_req, res) => {
  res.status(501).json({ message: 'Not implemented: profile' });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`auth-service listening on ${port}`);
});
