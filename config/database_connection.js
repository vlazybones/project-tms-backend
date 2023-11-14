const mysql = require("mysql2");

const con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password",
  database: "tms",
});

module.exports = con;
