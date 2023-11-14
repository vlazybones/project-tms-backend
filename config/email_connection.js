const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "af522ebaf1337c",
    pass: "b76c93f1b381af",
  },
});

module.exports = transporter;
