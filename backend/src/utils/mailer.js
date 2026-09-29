const nodemailer = require('nodemailer');

// With SMTP_HOST in the .env the mail is really sent. Without it (development) it is only printed on the
// server console, so the password recovery link can still be used while working on the project.
const transport = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
    : null;

exports.sendMail = async ({ to, subject, text }) => {
    if (!transport) {
        console.log(`[mail] to=${to} subject="${subject}"\n${text}`);
        return;
    }
    await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
};
