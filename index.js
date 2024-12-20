const express = require('express');
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.up5eg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' ? true : false,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
};


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const userCollection = client.db('bistroBossDB').collection('users');
    const menuCollection = client.db('bistroBossDB').collection('menu');
    const reviewCollection = client.db('bistroBossDB').collection('reviews');
    const cartCollection = client.db('bistroBossDB').collection('carts');

    // Verify Middleware
    const verifyToken = async(req, res, next) => {
      const token = req.cookies.token;
      if(!token) return res.status(401).send({message: 'Forbidden Access'});
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if(error) return res.status(401).send({message: 'Forbidden Access'});
        req.decode = decoded
        next();
      })
    };
    // Verify Admin after checking token
    const verifyAdmin = async(req, res, next) => {
      const email = req.decode.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user.role === 'admin';
      if(!isAdmin) return res.status(403).send({message: 'Unauthorized Access'});
      next();
    }

    // Authentication by jwt
    app.post('/jwt', async(req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
      res
      .cookie('token', token, cookieOptions)
      .send({success: true});
      // if work with localstorage
      // res.send({token}) ----- and receive it from client side and set token to localstorage
    });
    app.get('/logout', async(req, res) => {
      res
      .clearCookie('token', cookieOptions)
      .send({success: true})
    })
   
    // users related api
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })
    app.post('/users', async(req, res) => {
      const user = req.body;
      const query = {email: user.email};
      const isExistingUser = await userCollection.findOne(query);
      if(isExistingUser){
        return res.send({message: 'Already user exist'})
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.delete('/users/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    // is admin checking api
    app.get('/users/admin/:email', verifyToken, async(req, res) => {
      const email = req.params.email;
      if(email !== req.decode.email) return res.status(403).send({message: 'Unauthorized Access'});
      const query = {email: email};
      const user = await userCollection.findOne(query);
      // let admin = false;
      // if(user){
      //   admin = user.role === 'admin'
      // }
      // res.send({admin});
      const admin = user?.role === 'admin';
      res.send({admin})
    })

    // menu related api
    app.get('/menu', async(req, res) => {
        const result = await menuCollection.find().toArray();
        res.send(result);
    });
    app.get('/menu/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: id};
      const result = await menuCollection.findOne(query);
      res.send(result);
    });
    app.post('/menu', verifyToken, verifyAdmin, async(req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result);
    });
    app.patch('/menu/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const item = req.body;
      const filter = {_id: id};
      const updatedItem = {
        $set: {
          name: item.name,
          image: item.image,
          price: item.price,
          category: item.category,
          recipe: item.recipe
        }
      }
      const result = await menuCollection.updateOne(filter, updatedItem);
      res.send(result)
    })
    app.delete('/menu/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })
    app.get('/reviews', async(req, res) => {
        const result = await reviewCollection.find().toArray();
        res.send(result);
    });

    // Cart collection
    app.get('/carts', async(req, res) => {
      const email = req.query.email;
      const query = {email: email}
      const result = await cartCollection.find(query).toArray();
      res.send(result)
    })
    app.post('/carts', async(req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });
    app.delete('/carts/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId (id)};
      const result = await cartCollection.deleteOne(query);
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from Bistro Boss');
});
app.listen(port, () => {
    console.log('Bistro boss is listening on port:', port)
})