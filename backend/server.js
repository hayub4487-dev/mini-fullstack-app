const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI. Add it to backend/.env");
  process.exit(1);
}

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5500").replace(/\/+$/, "");

if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
  console.warn("SendGrid is not configured. Add SENDGRID_API_KEY and SENDGRID_FROM_EMAIL to backend/.env");
} else {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

const resetTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

resetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const User = mongoose.model("User", userSchema);
const ResetToken = mongoose.model("ResetToken", resetTokenSchema);

async function ensureDefaultUser() {
  const email = "test@test.com";
  const existing = await User.findOne({ email });
  if (existing) {
    return;
  }

  const passwordHash = await bcrypt.hash("123456", 10);
  await User.create({
    name: "Test User",
    email,
    passwordHash
  });
}

async function sendResetEmail({ to, resetUrl }) {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
    throw new Error("SendGrid is not configured");
  }

  const message = {
    to,
    from: SENDGRID_FROM_EMAIL,
    subject: "Reset your password",
    text: `You requested a password reset. Open this link to reset your password: ${resetUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Reset your password</h2>
        <p>You requested a password reset. Click the button below to set a new password:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 16px; background: #ffb703; color: #1c1c1c; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Reset Password
          </a>
        </p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `
  };

  await sgMail.send(message);
}

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body || {};

    if (!name || !email || !password || !confirmPassword) {
      res.status(400).json({
        success: false,
        message: "All fields are required"
      });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "Email already registered"
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash
    });

    res.json({
      success: true,
      message: "Sign up successful"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
      return;
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
      return;
    }

    res.json({
      success: true,
      message: "Login successful",
      token: "dummy-jwt-token"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      res.status(400).json({
        success: false,
        message: "Email is required"
      });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.json({
        success: true,
        message: "If the email exists, a reset link was sent."
      });
      return;
    }

    await ResetToken.deleteMany({ userId: user._id });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await ResetToken.create({
      userId: user._id,
      token,
      expiresAt
    });

    const resetUrl = `${FRONTEND_URL}/reset-password.html?token=${token}`;
    await sendResetEmail({ to: user.email, resetUrl });

    res.json({
      success: true,
      message: "Reset link sent to your email. Use it within 30 minutes.",
      resetToken: token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Unable to send reset email"
    });
  }
});

app.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (!token || !password) {
      res.status(400).json({
        success: false,
        message: "Token and new password are required"
      });
      return;
    }

    const resetToken = await ResetToken.findOne({ token });
    if (!resetToken || resetToken.expiresAt < new Date()) {
      res.status(400).json({
        success: false,
        message: "Reset token is invalid or expired"
      });
      return;
    }

    const user = await User.findById(resetToken.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();
    await ResetToken.deleteMany({ userId: user._id });

    res.json({
      success: true,
      message: "Password updated successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    await ensureDefaultUser();
    app.listen(3000, () => {
      console.log("Backend running on http://localhost:3000");
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed", error);
    process.exit(1);
  });
