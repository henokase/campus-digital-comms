require('dotenv').config();

const { createApp } = require('./app');

const app = createApp();

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`api-gateway listening on ${port}`);
});
