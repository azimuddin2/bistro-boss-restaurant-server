const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// database connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qmrysfz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const menuCollection = client.db('bistroBossRestaurant').collection('menu');

    app.get('/menu', async (req, res) => {
      const query = {};
      const menu = await menuCollection.find(query).toArray();
      res.send(menu);
    });


  } finally {

  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello Bistro Boss restaurant server running!!')
})

app.listen(port, () => {
  console.log(`Bistro Boss app listening on port ${port}`)
})