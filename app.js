//this is the index.js file
const express = require("express");
const app = express();
const url = require("url");

const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");

//import database connection config
const connectDatabase = require("./config/database_connection");

const errorMiddleware = require("./middlewares/errors");
const ErrorHandler = require("./utils/errorHandler");

// Setting up config.env file variables
dotenv.config({ path: "./config/config.env" });

//setting up body parser
app.use(express.json());

//creating own midddlware
const middleware = (req, res, next) => {
  next();
};

app.use(middleware);

//middleware to handle errors
app.use(errorMiddleware);

// Setup CORS - Accessible by other domains
app.use(cors());

//setting up body parser
app.use(bodyParser.urlencoded({ extended: true }));

// importing all routes
const user = require("./routes/user");
const a3 = require("./routes/a3route");

/*
app.use((req, res, next) => {
  const { query } = req;
  console.log(req.url);

  if (req.url.includes("?") || Object.keys(query).length > 0) {
    return res.status(200).json({
      result: "KEE018",
    });
  }
  try {
    decodeURIComponent(req.path);
  } catch (error) {
    return res.status(200).json({
      result: "KEE018",
    });
  }
  next();
});
*/
const interceptCheckURL = (req, res, next) => {
  const { query } = req;
  console.log(req.url);
  //const parsedUrl = url.parse(req.url, true);
  //console.log(parsedUrl.hash);

  if (req.url.includes("?") || req.url.includes("=") || req.url.includes("%")) {
    return res.status(200).json({
      result: "KEE018",
    });
  }
  next();
};

app.use("/", interceptCheckURL);

app.use("/", user);
app.use("/", a3);

app.all("*", (req, res, next) => {
  return res.status(200).json({
    result: "KEE018",
  });
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server started on port ${process.env.PORT} in ${process.env.NODE_ENV} mode`);
});
