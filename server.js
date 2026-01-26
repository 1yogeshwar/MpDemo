const express = require('express');
const routes = require('./routes/fs.routes');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// Load routes
app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

});
