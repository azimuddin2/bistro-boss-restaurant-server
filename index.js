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
    const reviewsCollection = client.db('bistroBossRestaurant').collection('review');
    const cartCollection = client.db('bistroBossRestaurant').collection('carts');

    app.get('/menu', async (req, res) => {
      const query = {};
      const menu = await menuCollection.find(query).toArray();
      res.send(menu);
    });

    app.get('/reviews', async (req, res) => {
      const query = {};
      const reviews = await reviewsCollection.find(query).toArray();
      res.send(reviews);
    });

    // cart operations
    app.post('/carts', async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
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