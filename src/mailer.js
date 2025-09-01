// src/mailer.js
const nodemailer = require("nodemailer");

let transporterPromise;

async function createTransporter() {
  // DEV mode: Ethereal test inbox (no signup)
  if (process.env.ETHEREAL === "true") {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }

  // PROD mode: real SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,                // e.g. smtp.gmail.com
    port: Number(process.env.SMTP_PORT || 587), // 465 if secure=true
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
    auth: {
      user: process.env.SMTP_USER,              // your SMTP username
      pass: process.env.SMTP_PASS,              // your SMTP password/app password
    },
  });
}

async function sendMail({ to, subject, html, text }) {
  if (!transporterPromise) transporterPromise = createTransporter();
  const transporter = await transporterPromise;

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Career Portal" <no-reply@yourdomain.com>',
    to,
    subject,
    text,
    html,
  });

  // Show a preview URL in console when using Ethereal
  if (process.env.ETHEREAL === "true") {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log("📧 Email preview:", previewUrl);
  }

  return info;
}

module.exports = { sendMail };
