const express = require("express");
const app = express();
//cors ebong dotenv require filetake uporer dike rakhte hobe. nahole sommosa hobe,error dibe.
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const nodemailer = require("nodemailer");
const mg = require("nodemailer-mailgun-transport");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.flyev.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, function (err, decoded) {
    if (err) {
      return res
        .status(403)
        .send({ message: "Forbidden Access From VerifyJWT" });
    }
    req.decoded = decoded;
    next();
  });
}
const auth = {
  auth: {
    api_key: process.env.NODE_MAILER_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
  },
};
const nodemailerMailgun = nodemailer.createTransport(mg(auth));
const sentPurchaseEmail = (order) => {
  const {
    userName,

    productName,
    productCode,
    productPrice,

    orderQuantity,
    productImage,
    totalPrice,
  } = order;
  nodemailerMailgun.sendMail(
    {
      from: "myemail@example.com",
      to: "mehmetsaki789@gmail.com",

      subject: `Purchase request for ${productName}`,
      replyTo: "reply2this@company.com",

      text: ``,
      html: `<div>
      <p>Hi, ${userName} you give a purchase request to Bit & Bytes for ${productName} your requested
      product code is ${productCode}. your requested prodct price per unit is ${productPrice} and you
       requested for ${orderQuantity} items. your total cost will be  $ ${totalPrice} we are waiting for your payment
        confirmation so we can ship you the product.Thanks for choosing us.<p/>
      <img src=${productImage} alt="" />
      </div>`,
    },
    (err, info) => {
      if (err) {
        console.log(`Error: ${err}`);
      } else {
        console.log(`Response: ${info}`);
      }
    }
  );
};
const sentPaymentConfarmationEmail = (payment) => {
  const {
    userName,

    productName,
    productCode,
    productPrice,

    orderQuantity,
    productImage,
    totalPrice,
  } = payment.order;
  const transactionId = payment.transactionId;
  nodemailerMailgun.sendMail(
    {
      from: "myemail@example.com",
      to: "mehmetsaki789@gmail.com",

      subject: `Purchase request for ${productName}`,
      replyTo: "reply2this@company.com",

      text: ``,
      html: `<div>
      <p>Hi, ${userName} you give a purchase request to Bit & Bytes for ${productName} your requested
      product code is ${productCode}. your requested prodct price per unit is ${productPrice} and you
       requested for ${orderQuantity} items. your total cost will be  $ ${totalPrice}. And You paid the bill $ ${totalPrice}.we are ship your product as soon as possible and inform you soon,keep in touch.
        your Transaction Id is ${transactionId}.<p/>
      <img src=${productImage} alt="" />
      </div>`,
    },
    (err, info) => {
      if (err) {
        console.log(`Error: ${err}`);
      } else {
        console.log(`Response: ${info}`);
      }
    }
  );
};
async function run() {
  try {
    await client.connect();
    const toolsCollection = client
      .db("computer_manufacturing_tools")
      .collection("tools");
    const reveiwCollection = client
      .db("computer_manufacturing_tools")
      .collection("ratings");
    const usersCollection = client
      .db("computer_manufacturing_tools")
      .collection("users");
    const orderCollection = client
      .db("computer_manufacturing_tools")
      .collection("orders");
    const newToolsCollection = client
      .db("computer_manufacturing_tools")
      .collection("newTools");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const filter = { email: email };
      const requesterAccount = await usersCollection.findOne(filter);
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "You are not an admin" });
      }
    };
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const paidOrder = req.body;
      const totalPrice = paidOrder.totalPrice;
      const amount = parseFloat(totalPrice) * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    app.get("/tools", async (req, res) => {
      const query = {};
      const cursor = toolsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/newtools", async (req, res) => {
      const query = {};
      const cursor = newToolsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/newtools/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const tool = await newToolsCollection.findOne(query);
      res.send(tool);
    });
    app.get("/reviews", async (req, res) => {
      const query = {};
      const cursor = reveiwCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reveiwCollection.insertOne(review);
      res.send(result);
    });
    app.put("/adduser/:email", async (req, res) => {
      const email = req.params.email;
      const currentUser = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: currentUser,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_SECRET_TOKEN,
        {
          expiresIn: "1d",
        }
      );
      res.send({ result, token: token });
    });
    app.put("/useraddinfo/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateInfo = req.body;
      console.log(updateInfo);
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          education: updateInfo.education,
          address: updateInfo.address,
          social: updateInfo.social,
          number: updateInfo.number,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    app.get("/user", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const productCode = req.body.productCode;
      const userEmail = req.body.userEmail;
      const query = { productCode, userEmail };
      const exist = await orderCollection.findOne(query);
      if (!exist) {
        const result = await orderCollection.insertOne(order);
        sentPurchaseEmail(order);
        res.send(result);
      } else {
        res.send({ message: "Your order is already in pending" });
      }
    });
    app.get("/order", async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/payorder/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.findOne(query);
      res.send(result);
    });
    app.patch(
      "/adminorderupdate/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };
        const updateDoc = {
          $set: {
            shipped: true,
          },
        };
        const result = await orderCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );
    app.patch("/order/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const result = await orderCollection.updateOne(filter, updateDoc);
      sentPaymentConfarmationEmail(payment);
      res.send(result);
    });
    app.get("/allorders", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });
    app.delete(
      "/orderadmindelete/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await orderCollection.deleteOne(query);
        res.send(result);
      }
    );
    app.delete("/order/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });
    app.get("/alluser", verifyJWT, async (req, res) => {
      const query = {};
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });
    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.post("/addproduct", async (req, res) => {
      const newProduct = req.body;
      const result = await newToolsCollection.insertOne(newProduct);
      res.send(result);
    });
    app.get("/alltools", verifyJWT, async (req, res) => {
      const query = {};
      const result = await newToolsCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/deletetool/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await newToolsCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Computer part manufacturer server connected");
});
app.listen(port, () => {
  console.log("listening to port", port);
});
