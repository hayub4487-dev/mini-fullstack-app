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

const salonSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  area: { type: String, required: true, trim: true },
  rating: { type: Number, required: true, min: 0, max: 5 },
  services: { type: [String], default: [] },
  price: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  hours: { type: String, required: true, trim: true },
  notes: { type: String, trim: true }
}, { timestamps: true });

const Salon = mongoose.model("Salon", salonSchema);

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

async function ensureDefaultSalons() {
  const count = await Salon.countDocuments();
  if (count > 0) {
    return;
  }

  await Salon.insertMany([
    {
      name: "Glam Avenue Salon",
      area: "D-Ground",
      rating: 4.8,
      services: ["Bridal", "Hair Spa", "Makeup"],
      price: "PKR 1,200 - 6,500",
      phone: "+92 321 1112233",
      address: "Main Boulevard, D-Ground",
      hours: "11:00 AM - 10:00 PM",
      notes: "Known for bridal packages"
    },
    {
      name: "Velvet Touch Studio",
      area: "Peoples Colony",
      rating: 4.6,
      services: ["Keratin", "Hair Color", "Facials"],
      price: "PKR 900 - 5,000",
      phone: "+92 300 4455667",
      address: "Peoples Colony No. 1",
      hours: "10:00 AM - 9:00 PM",
      notes: "Signature hair treatments"
    },
    {
      name: "Noor Beauty Lounge",
      area: "Kohinoor City",
      rating: 4.7,
      services: ["Mehndi", "Makeup", "Threading"],
      price: "PKR 700 - 4,800",
      phone: "+92 333 9988776",
      address: "Kohinoor City, Block A",
      hours: "12:00 PM - 10:00 PM",
      notes: "Party makeup specialists"
    },
    {
      name: "The Shear Bar",
      area: "Susan Road",
      rating: 4.5,
      services: ["Men's Grooming", "Beard", "Haircut"],
      price: "PKR 600 - 2,500",
      phone: "+92 341 2233445",
      address: "Susan Road, Plaza 3",
      hours: "10:00 AM - 8:30 PM",
      notes: "Premium grooming for men"
    },
    {
      name: "Rose & Blush Studio",
      area: "Satiana Road",
      rating: 4.4,
      services: ["Manicure", "Pedicure", "Skin Care"],
      price: "PKR 500 - 3,200",
      phone: "+92 322 7654321",
      address: "Satiana Road, Block C",
      hours: "9:30 AM - 8:00 PM",
      notes: "Relaxing spa treatments"
    },
    {
      name: "Luxe Locks Salon",
      area: "Canal Road",
      rating: 4.9,
      services: ["Balayage", "Hair Repair", "Styling"],
      price: "PKR 1,500 - 7,000",
      phone: "+92 345 8899001",
      address: "Canal Road, Mall Area",
      hours: "11:00 AM - 11:00 PM",
      notes: "Luxury hair care"
    }
  ]);
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

app.get("/salons", async (_req, res) => {
  try {
    const salons = await Salon.find().sort({ createdAt: -1 });
    res.json({ success: true, salons });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to load salons" });
  }
});

app.post("/salons", async (req, res) => {
  try {
    const {
      name,
      area,
      rating,
      services,
      price,
      phone,
      address,
      hours,
      notes
    } = req.body || {};

    if (!name || !area || rating === undefined || !price || !phone || !address || !hours) {
      res.status(400).json({
        success: false,
        message: "Missing required salon fields"
      });
      return;
    }

    const parsedRating = Number(rating);
    if (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 5) {
      res.status(400).json({
        success: false,
        message: "Rating must be between 0 and 5"
      });
      return;
    }

    const salon = await Salon.create({
      name: String(name).trim(),
      area: String(area).trim(),
      rating: parsedRating,
      services: Array.isArray(services)
        ? services.map((service) => String(service).trim()).filter(Boolean)
        : String(services || "")
            .split(",")
            .map((service) => service.trim())
            .filter(Boolean),
      price: String(price).trim(),
      phone: String(phone).trim(),
      address: String(address).trim(),
      hours: String(hours).trim(),
      notes: notes ? String(notes).trim() : ""
    });

    res.status(201).json({ success: true, salon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Unable to save salon" });
  }
});

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    await ensureDefaultUser();
    await ensureDefaultSalons();
    app.listen(3000, () => {
      console.log("Backend running on http://localhost:3000");
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed", error);
    process.exit(1);
  });
