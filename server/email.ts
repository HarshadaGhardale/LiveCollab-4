import nodemailer from "nodemailer";

interface MailOptions {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail({ to, subject, html }: MailOptions) {
    // Create a transporter using environment variables
    // This works with Gmail, SendGrid, Brevo, etc.
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"SynapseCollab" <no-reply@synapsecollab.com>', // sender address
            to,
            subject,
            html,
        });

        console.log("Message sent: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}

export async function sendPasswordResetEmail(email: string, token: string) {
    // In a real app, this URL should probably come from an env var too, 
    // but for now we'll assume the same host or localhost.
    // Since we don't always know the specific frontend URL here easily without config,
    // we'll construct a link. If the app is SPA, usually we point to the frontend route.

    // Assuming the frontend handles /reset-password?token=...
    // You might need to adjust the base URL if deploying to Vercel/similar.
    const resetLink = `${process.env.APP_URL || "http://localhost:5000"}/reset-password?token=${token}`;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>Hello,</p>
      <p>You requested a password reset for your SynapseCollab account.</p>
      <p>Click the button below to reset your password. This link is valid for 1 hour.</p>
      <a href="${resetLink}" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Reset Password</a>
      <p style="margin-top: 20px;">If you didn't request this, please ignore this email.</p>
      <p>Thanks,<br>SynapseCollab Team</p>
    </div>
  `;

    return sendEmail({
        to: email,
        subject: "Reset Your Password - SynapseCollab",
        html,
    });
}
