const express = require('express');
const app = express();
const port = process.env.PORT || 5000;


app.get('/', (req, res) => {
  res.send('Hello Bistro Boss restaurant server running!!')
})

app.listen(port, () => {
  console.log(`Bistro Boss app listening on port ${port}`)
})