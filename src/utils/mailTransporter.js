import nodemailer from "nodemailer";
const mailId = process.env.EMAIL_USER;
const mailPass = process.env.EMAIL_PASS;
export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: mailId,
    pass: mailPass,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

await transporter
  .verify()
  .then(() => console.log("SMTP working"))
  .catch((err) => console.error(err));
