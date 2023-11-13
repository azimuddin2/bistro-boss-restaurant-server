const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }

  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    req.decoded = decoded;
    next();
  })

};


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
    const usersCollection = client.db('bistroBossRestaurant').collection('users');
    const menuCollection = client.db('bistroBossRestaurant').collection('menu');
    const reviewsCollection = client.db('bistroBossRestaurant').collection('review');
    const cartCollection = client.db('bistroBossRestaurant').collection('carts');
    const paymentCollection = client.db('bistroBossRestaurant').collection('payments');
    const bookingCollection = client.db('bistroBossRestaurant').collection('bookings');

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
      res.send({ token });
    });


    // users API operations
    app.post('/users', async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exists' });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;

      if (decodedEmail !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' };
      res.send(result);
    });

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });



    // menu API operation
    app.get('/menu', async (req, res) => {
      const query = {};
      const menu = await menuCollection.find(query).toArray();
      res.send(menu);
    });

    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    app.post('/menu', verifyJWT, verifyAdmin, async (req, res) => {
      const addNewItem = req.body;
      const result = await menuCollection.insertOne(addNewItem);
      res.send(result);
    });

    app.delete('/menu/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    app.put('/menu/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updateItem = req.body;
      const { name, price, recipe } = updateItem;

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name,
          price,
          recipe
        },
      };
      const result = await menuCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });


    // cart operations
    app.post('/carts', async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' });
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"]
      })

      res.send({
        clientSecret: paymentIntent.client_secret
      });
    });


    // payment related api
    app.post('/payments', verifyJWT, async (req, res) => {
      const paymentInfo = req.body;
      const insertResult = await paymentCollection.insertOne(paymentInfo);

      const query = { _id: { $in: paymentInfo.cartItems.map(id => new ObjectId(id)) } };
      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ insertResult, deleteResult });
    });

    app.get('/payments', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }

      const query = { email: email };
      const payments = await paymentCollection.find(query).toArray();
      res.send(payments)
    });


    // booking related api
    app.post('/bookings', verifyJWT, async (req, res) => {
      const bookingInfo = req.body;
      const result = await bookingCollection.insertOne(bookingInfo);
      res.send(result);
    });

    app.get('/bookings', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }

      const query = { email: email };
      const bookings = await bookingCollection.find(query).toArray();
      res.send(bookings);
    });

    app.get('/all-bookings', verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const bookings = await bookingCollection.find(query).toArray();
      res.send(bookings);
    });

    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          status: status
        }
      }
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    // review operations
    app.get('/reviews', async (req, res) => {
      const query = {};
      const reviews = await reviewsCollection.find(query).toArray();
      res.send(reviews);
    });

    app.post('/reviews', async (req, res) => {
      const reviewInfo = req.body;
      const result = await reviewsCollection.insertOne(reviewInfo);
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