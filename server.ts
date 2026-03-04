import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";

const db = new Database("church.db");
db.exec("PRAGMA foreign_keys = ON;");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT, -- super_admin, pastor, accountant, staff
    name TEXT,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS password_reset_otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    otp TEXT,
    expires_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_code TEXT UNIQUE,
    name TEXT,
    tamil_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    family_details TEXT,
    membership_type TEXT, -- regular, visitor, life
    joined_date TEXT,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT UNIQUE,
    type TEXT, -- income, expense
    category TEXT, -- offering, tithe, event, book_sale, maintenance, salary, utility, etc.
    amount REAL,
    date TEXT,
    payment_mode TEXT, -- cash, bank, upi, cheque
    member_id INTEGER,
    vendor_name TEXT,
    item_details TEXT,
    gst_amount REAL DEFAULT 0,
    bill_url TEXT,
    notes TEXT,
    FOREIGN KEY(member_id) REFERENCES members(id)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER,
    start_date TEXT,
    end_date TEXT,
    amount REAL,
    status TEXT, -- paid, pending
    last_reminder_date TEXT,
    transaction_id INTEGER,
    FOREIGN KEY(member_id) REFERENCES members(id),
    FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS church_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT, -- event, prayer, auction, materials
    content TEXT,
    user_name TEXT,
    mobile TEXT,
    address TEXT,
    date TEXT,
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Ensure status column exists in members table
try {
  db.prepare("ALTER TABLE members ADD COLUMN status TEXT DEFAULT 'active'").run();
  console.log("Added status column to members table.");
} catch (e: any) {
  if (e.message.includes("duplicate column name")) {
    console.log("Status column already exists in members table.");
  } else {
    console.error("Migration error:", e.message);
  }
}

// Ensure all members have a status
db.prepare("UPDATE members SET status = 'active' WHERE status IS NULL").run();

// Migration: Ensure transaction_id column exists in subscriptions table
try {
  db.prepare("ALTER TABLE subscriptions ADD COLUMN transaction_id INTEGER").run();
  console.log("Added transaction_id column to subscriptions table.");
} catch (e: any) {
  if (e.message.includes("duplicate column name")) {
    console.log("transaction_id column already exists in subscriptions table.");
  } else {
    console.error("Migration error:", e.message);
  }
}

// Migration: Ensure amount and status columns exist in church_notes table
try {
  db.prepare("ALTER TABLE church_notes ADD COLUMN amount REAL DEFAULT 0").run();
  console.log("Added amount column to church_notes table.");
} catch (e: any) {}

try {
  db.prepare("ALTER TABLE church_notes ADD COLUMN status TEXT DEFAULT 'pending'").run();
  console.log("Added status column to church_notes table.");
} catch (e: any) {}

// Migration: Ensure email column exists in users table
try {
  db.prepare("ALTER TABLE users ADD COLUMN email TEXT").run();
  console.log("Added email column to users table.");
} catch (e: any) {
  if (e.message.includes("duplicate column name")) {
    console.log("Email column already exists in users table.");
  } else {
    console.error("Migration error:", e.message);
  }
}

// Seed default user if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE username = ?").get("admin") as any;
if (!adminExists) {
  console.log("Seeding default admin user...");
  db.prepare("INSERT INTO users (username, password, role, name, email) VALUES (?, ?, ?, ?, ?)").run(
    "admin",
    "admin123", // In a real app, use bcrypt
    "super_admin",
    "Super Admin",
    "sriarunkumarphy@gmail.com"
  );
  console.log("Default admin user seeded.");
} else {
  console.log("Admin user already exists. Ensuring password is 'admin123' and email is updated.");
  db.prepare("UPDATE users SET password = ?, email = ? WHERE username = ?").run(
    "admin123",
    "sriarunkumarphy@gmail.com",
    "admin"
  );
}

// Seed default settings
const settings = [
  { key: "church_name", value: "C.S.I W.J HATCH MEMORIAL CHURCH" },
  { key: "church_name_tamil", value: "C.S.I W.J ஹட்ச் மெமோரியல் சர்ச்" },
  { key: "address", value: "123 Church Street, Chennai, Tamil Nadu" },
  { key: "currency", value: "INR" },
  { key: "financial_year", value: "2024-2025" }
];

for (const s of settings) {
  const exists = db.prepare("SELECT * FROM settings WHERE key = ?").get(s.key);
  if (!exists) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(s.key, s.value);
  }
}

// Update church name if it's still the old one
db.prepare("UPDATE settings SET value = ? WHERE key = 'church_name' AND value = 'Arul Church'").run("C.S.I W.J HATCH MEMORIAL CHURCH");
db.prepare("UPDATE settings SET value = ? WHERE key = 'church_name_tamil' AND value = 'அருள் தேவாலயம்'").run("C.S.I W.J ஹட்ச் மெமோரியல் சர்ச்");

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);

  // Logging middleware - VERY FIRST
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json());

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    console.log(`Login attempt for username: ${username}, password: ${password}`);
    
    try {
      const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
      if (user) {
        console.log(`Login successful for: ${username}`);
        res.json({ success: true, user: { id: user.id, username: user.username, role: user.role, name: user.name, email: user.email } });
      } else {
        console.log(`Login failed for: ${username} - Invalid credentials`);
        res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    } catch (error: any) {
      console.error("Database error during login:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  // Forgot Password API
  app.post("/api/forgot-password", async (req, res) => {
    const { email } = req.body;
    console.log(`Forgot password request for email: ${email}`);
    
    try {
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (!user) {
        // For security, don't reveal if user exists
        return res.json({ success: true, message: "If an account exists with this email, an OTP has been sent." });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

      db.prepare("DELETE FROM password_reset_otps WHERE user_id = ?").run(user.id);
      db.prepare("INSERT INTO password_reset_otps (user_id, otp, expires_at) VALUES (?, ?, ?)").run(user.id, otp, expiresAt);

      // Send Email
      const dbSettings = db.prepare("SELECT * FROM settings").all();
      const settingsObj = dbSettings.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});

      let smtpHost = settingsObj.smtp_host || process.env.SMTP_HOST || 'smtp.ethereal.email';
      const smtpPort = parseInt(settingsObj.smtp_port || process.env.SMTP_PORT || '587');
      const smtpUser = (settingsObj.smtp_user || process.env.SMTP_USER || '').trim();
      const smtpPass = (settingsObj.smtp_pass || process.env.SMTP_PASS || '').trim();
      let emailErrorMsg = '';

      // Validation: Check if host looks like a password or is misconfigured
      if (smtpHost.includes('@') || !smtpHost.includes('.')) {
        console.warn(`SMTP_HOST "${smtpHost}" looks invalid. Falling back to ethereal.`);
        smtpHost = 'smtp.ethereal.email';
      }

      // Validation: Check if user looks like a simple name instead of an email (Warning only)
      if (smtpUser.toLowerCase() === 'admin' || smtpPass.toLowerCase() === 'admin') {
        console.warn("WARNING: SMTP_USER or SMTP_PASS is set to 'Admin'. This might be incorrect for most public SMTP providers.");
      }

      console.log(`Attempting to send email via ${smtpHost}:${smtpPort} (User: ${smtpUser || 'NOT SET'})`);

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        requireTLS: smtpPort === 587,
        auth: (smtpUser && smtpPass && !emailErrorMsg) ? {
          user: smtpUser,
          pass: smtpPass,
        } : undefined,
        debug: true,
        logger: true
      });

      const mailOptions = {
        from: `"Church Management System" <${smtpUser || 'noreply@church.com'}>`,
        to: email,
        subject: "Password Reset OTP",
        text: `Your OTP for password reset is: ${otp}. It expires in 10 minutes.`,
        html: `<p>Your OTP for password reset is: <b>${otp}</b>. It expires in 10 minutes.</p>`,
      };

      let emailSent = false;

      try {
        if (emailErrorMsg) throw new Error(emailErrorMsg);
        await transporter.sendMail(mailOptions);
        console.log(`OTP sent successfully to ${email}`);
        emailSent = true;
      } catch (emailError: any) {
        emailErrorMsg = emailError.message;
        console.error("Error sending email:", emailError.message);
        if (emailError.message.includes('535')) {
          if (smtpHost.includes('gmail')) {
            const tip = "TIP: For Gmail, you MUST use an 'App Password' instead of your regular password. Also ensure SMTP_USER is your full email address.";
            console.warn(tip);
            emailErrorMsg += `\n\n${tip}`;
          } else if (smtpUser === 'Admin') {
            const tip = "TIP: SMTP_USER is set to 'Admin'. This should likely be your full email address or a specific SMTP username provided by your host.";
            console.warn(tip);
            emailErrorMsg += `\n\n${tip}`;
          }
        }
        if (emailError.code === 'ENOTFOUND') {
          console.error(`CRITICAL: SMTP Host "${smtpHost}" could not be resolved. Please check your SMTP_HOST environment variable.`);
        }
        // In dev, log the OTP so user can see it
        console.log(`FALLBACK: OTP for ${email} is ${otp} (Email failed: ${emailError.message})`);
      }

      if (emailSent) {
        res.json({ 
          success: true, 
          message: "OTP sent successfully to your email."
        });
      } else {
        const devNote = process.env.NODE_ENV !== 'production' ? ` (DEV: Your code is ${otp})` : '';
        res.status(400).json({
          success: false,
          message: `Email delivery failed: ${emailErrorMsg}. Please check server logs for the OTP.${devNote}`
        });
      }
    } catch (error: any) {
      console.error("Error in forgot-password:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/verify-otp", (req, res) => {
    const { email, otp } = req.body;
    try {
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (!user) return res.status(400).json({ success: false, message: "Invalid request" });

      const record = db.prepare("SELECT * FROM password_reset_otps WHERE user_id = ? AND otp = ?").get(user.id, otp);
      if (!record) return res.status(400).json({ success: false, message: "Invalid OTP" });

      if (new Date(record.expires_at) < new Date()) {
        return res.status(400).json({ success: false, message: "OTP expired" });
      }

      res.json({ success: true, message: "OTP verified" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/reset-password-otp", (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (!user) return res.status(400).json({ success: false, message: "Invalid request" });

      const record = db.prepare("SELECT * FROM password_reset_otps WHERE user_id = ? AND otp = ?").get(user.id, otp);
      if (!record || new Date(record.expires_at) < new Date()) {
        return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
      }

      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newPassword, user.id);
      db.prepare("DELETE FROM password_reset_otps WHERE user_id = ?").run(user.id);

      res.json({ success: true, message: "Password reset successfully" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Members API
  app.get("/api/members", (req, res) => {
    console.log("GET /api/members hit");
    try {
      const members = db.prepare("SELECT * FROM members WHERE status = 'active' OR status IS NULL").all();
      res.json(members);
    } catch (error: any) {
      console.error("Error fetching members:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.post("/api/members", (req, res) => {
    console.log("POST /api/members hit");
    try {
      const { name, tamil_name, phone, email, address, family_details, membership_type, joined_date } = req.body;
      
      // Generate member_code: CSIM0001, CSIM0002, etc.
      const lastMember = db.prepare("SELECT member_code FROM members WHERE member_code LIKE 'CSIM%' ORDER BY id DESC LIMIT 1").get();
      let nextNum = 1;
      if (lastMember && lastMember.member_code) {
        const lastNum = parseInt(lastMember.member_code.replace('CSIM', ''));
        if (!isNaN(lastNum)) {
          nextNum = lastNum + 1;
        }
      }
      const member_code = `CSIM${nextNum.toString().padStart(4, '0')}`;

      const result = db.prepare(`
        INSERT INTO members (member_code, name, tamil_name, phone, email, address, family_details, membership_type, joined_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(member_code, name, tamil_name, phone, email, address, family_details, membership_type, joined_date);
      res.json({ success: true, id: result.lastInsertRowid, member_code });
    } catch (error: any) {
      console.error("Error creating member:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.put("/api/members/:id", (req, res) => {
    console.log(`PUT /api/members/${req.params.id} hit`);
    try {
      const { name, tamil_name, phone, email, address, family_details, membership_type, joined_date } = req.body;
      db.prepare(`
        UPDATE members 
        SET name = ?, tamil_name = ?, phone = ?, email = ?, address = ?, family_details = ?, membership_type = ?, joined_date = ?
        WHERE id = ?
      `).run(name, tamil_name, phone, email, address, family_details, membership_type, joined_date, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating member:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.delete("/api/members/:id", (req, res) => {
    const { id } = req.params;
    console.log(`DELETE /api/members/${id} hit`);
    try {
      // Soft delete: set status to 'inactive'
      const result = db.prepare("UPDATE members SET status = 'inactive' WHERE id = ?").run(id);
      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: "Member not found" });
      }
    } catch (error: any) {
      console.error("Error deleting member:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  // Transactions API
  app.get("/api/transactions", (req, res) => {
    console.log("GET /api/transactions hit");
    try {
      const transactions = db.prepare(`
        SELECT t.*, m.name as member_name, s.start_date as sub_start_date, s.end_date as sub_end_date
        FROM transactions t 
        LEFT JOIN members m ON t.member_id = m.id
        LEFT JOIN subscriptions s ON t.id = s.transaction_id
        ORDER BY t.date DESC
      `).all();
      res.json(transactions);
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.post("/api/transactions", (req, res) => {
    console.log("POST /api/transactions hit");
    try {
      const { type, category, amount, date, payment_mode, member_id, vendor_name, item_details, gst_amount, notes } = req.body;
      
      let invoice_no;
      if (type === "income") {
        // Find the highest bill number
        const lastIncome = db.prepare("SELECT invoice_no FROM transactions WHERE type = 'income' AND invoice_no LIKE 'Bill No %' ORDER BY id DESC LIMIT 1").get() as { invoice_no: string } | undefined;
        let nextNum = 1;
        if (lastIncome) {
          const match = lastIncome.invoice_no.match(/Bill No (\d+)/);
          if (match) {
            nextNum = parseInt(match[1]) + 1;
          }
        }
        invoice_no = `Bill No ${nextNum}`;
      } else {
        invoice_no = "EXP" + Date.now();
      }
      
      // Ensure member_id is null if not provided or empty string
      const finalMemberId = (member_id === "" || member_id === undefined || member_id === null) ? null : member_id;
      const finalAmount = parseFloat(amount) || 0;
      const finalGstAmount = parseFloat(gst_amount) || 0;

      const result = db.prepare(`
        INSERT INTO transactions (invoice_no, type, category, amount, date, payment_mode, member_id, vendor_name, item_details, gst_amount, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(invoice_no, type, category, finalAmount, date, payment_mode, finalMemberId, vendor_name, item_details, finalGstAmount, notes);
      
      const transactionId = result.lastInsertRowid;

      // If category is subscriptions, also add to subscriptions table
      if (category === 'subscriptions' && finalMemberId) {
        const { start_date, end_date } = req.body;
        const sDate = start_date || date;
        let eDate = end_date;
        if (!eDate) {
          const d = new Date(sDate);
          d.setFullYear(d.getFullYear() + 1);
          eDate = d.toISOString().split('T')[0];
        }
        
        db.prepare(`
          INSERT INTO subscriptions (member_id, start_date, end_date, amount, status, transaction_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(finalMemberId, sDate, eDate, finalAmount, 'paid', transactionId);
      }

      res.json({ success: true, id: transactionId, invoice_no });
    } catch (error: any) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.put("/api/transactions/:id", (req, res) => {
    const { id } = req.params;
    try {
      const { category, amount, date, payment_mode, member_id, vendor_name, item_details, gst_amount, notes } = req.body;
      const finalMemberId = (member_id === "" || member_id === undefined || member_id === null) ? null : member_id;
      const finalAmount = parseFloat(amount) || 0;
      const finalGstAmount = parseFloat(gst_amount) || 0;

      db.prepare(`
        UPDATE transactions 
        SET category = ?, amount = ?, date = ?, payment_mode = ?, member_id = ?, vendor_name = ?, item_details = ?, gst_amount = ?, notes = ?
        WHERE id = ?
      `).run(category, finalAmount, date, payment_mode, finalMemberId, vendor_name, item_details, finalGstAmount, notes, id);

      // Handle subscription sync
      if (category === 'subscriptions' && finalMemberId) {
        const { start_date, end_date } = req.body;
        const sDate = start_date || date;
        let eDate = end_date;
        if (!eDate) {
          const d = new Date(sDate);
          d.setFullYear(d.getFullYear() + 1);
          eDate = d.toISOString().split('T')[0];
        }

        // Check if subscription already exists for this transaction
        const existingSub = db.prepare("SELECT id FROM subscriptions WHERE transaction_id = ?").get(id) as { id: number } | undefined;
        if (existingSub) {
          db.prepare(`
            UPDATE subscriptions 
            SET member_id = ?, start_date = ?, end_date = ?, amount = ?, status = 'paid'
            WHERE id = ?
          `).run(finalMemberId, sDate, eDate, finalAmount, existingSub.id);
        } else {
          db.prepare(`
            INSERT INTO subscriptions (member_id, start_date, end_date, amount, status, transaction_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(finalMemberId, sDate, eDate, finalAmount, 'paid', id);
        }
      } else {
        // If category changed from subscriptions, delete the linked subscription
        db.prepare("DELETE FROM subscriptions WHERE transaction_id = ?").run(id);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating transaction:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  // Subscriptions API
  app.get("/api/subscriptions", (req, res) => {
    console.log("GET /api/subscriptions hit");
    try {
      const subscriptions = db.prepare(`
        SELECT s.*, m.name as member_name 
        FROM subscriptions s 
        JOIN members m ON s.member_id = m.id
        ORDER BY s.end_date ASC
      `).all();
      res.json(subscriptions);
    } catch (error: any) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.post("/api/subscriptions", (req, res) => {
    console.log("POST /api/subscriptions hit");
    try {
      const { member_id, start_date, end_date, amount, status } = req.body;
      const result = db.prepare(`
        INSERT INTO subscriptions (member_id, start_date, end_date, amount, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(member_id, start_date, end_date, amount, status);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.put("/api/subscriptions/:id", (req, res) => {
    console.log(`PUT /api/subscriptions/${req.params.id} hit`);
    try {
      const { member_id, start_date, end_date, amount, status } = req.body;
      db.prepare(`
        UPDATE subscriptions 
        SET member_id = ?, start_date = ?, end_date = ?, amount = ?, status = ?
        WHERE id = ?
      `).run(member_id, start_date, end_date, amount, status, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating subscription:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.delete("/api/subscriptions/:id", (req, res) => {
    console.log(`DELETE /api/subscriptions/${req.params.id} hit`);
    try {
      db.prepare("DELETE FROM subscriptions WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting subscription:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", (req, res) => {
    console.log("GET /api/dashboard/stats hit");
    try {
      const income = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'income'").get().total || 0;
      const expense = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'expense'").get().total || 0;
      const membersCount = db.prepare("SELECT COUNT(*) as count FROM members").get().count;
      const activeSubs = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'paid'").get().count;
      
      res.json({ income, expense, balance: income - expense, membersCount, activeSubs });
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  // Settings API
  app.get("/api/settings", (req, res) => {
    console.log("GET /api/settings hit");
    try {
      const settings = db.prepare("SELECT * FROM settings").all();
      const settingsObj = settings.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
      res.json(settingsObj);
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  // Church Notes API
  app.get("/api/notes", (req, res) => {
    console.log("GET /api/notes hit");
    try {
      const notes = db.prepare("SELECT * FROM church_notes ORDER BY created_at DESC").all();
      res.json(notes);
    } catch (error: any) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.post("/api/notes", (req, res) => {
    console.log("POST /api/notes hit");
    try {
      const { category, content, user_name, mobile, address, date, amount, status } = req.body;
      const result = db.prepare(`
        INSERT INTO church_notes (category, content, user_name, mobile, address, date, amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        category, 
        content, 
        user_name, 
        mobile, 
        address, 
        date || new Date().toISOString().split('T')[0],
        amount || 0,
        status || 'pending'
      );
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      console.error("Error creating note:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.put("/api/notes/:id", (req, res) => {
    console.log(`PUT /api/notes/${req.params.id} hit`);
    try {
      const { category, content, user_name, mobile, address, date, amount, status } = req.body;
      db.prepare(`
        UPDATE church_notes 
        SET category = ?, content = ?, user_name = ?, mobile = ?, address = ?, date = ?, amount = ?, status = ?
        WHERE id = ?
      `).run(category, content, user_name, mobile, address, date, amount || 0, status || 'pending', req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating note:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.delete("/api/notes/:id", (req, res) => {
    const { id } = req.params;
    console.log(`DELETE /api/notes/${id} hit`);
    try {
      const result = db.prepare("DELETE FROM church_notes WHERE id = ?").run(id);
      console.log(`Delete result for note ${id}:`, result);
      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: "Note not found" });
      }
    } catch (error: any) {
      console.error("Error deleting note:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.get("/api/reports/top-contributors", (req, res) => {
    console.log("GET /api/reports/top-contributors hit");
    try {
      const topContributors = db.prepare(`
        SELECT 
          m.id, 
          m.name, 
          m.tamil_name, 
          m.member_code, 
          SUM(t.amount) as total_contribution,
          COUNT(t.id) as transaction_count
        FROM members m
        JOIN transactions t ON m.id = t.member_id
        WHERE t.type = 'income'
        GROUP BY m.id
        ORDER BY total_contribution DESC
      `).all();
      res.json(topContributors);
    } catch (error: any) {
      console.error("Error fetching top contributors:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.post("/api/settings", (req, res) => {
    console.log("POST /api/settings hit");
    try {
      const updates = req.body;
      const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
      const transaction = db.transaction((data) => {
        for (const [key, value] of Object.entries(data)) {
          stmt.run(key, value);
        }
      });
      transaction(updates);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating settings:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.post("/api/settings/test-email", async (req, res) => {
    const { email } = req.body;
    const dbSettings = db.prepare("SELECT * FROM settings").all();
    const settingsObj = dbSettings.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});

    let smtpHost = settingsObj.smtp_host || process.env.SMTP_HOST || 'smtp.ethereal.email';
    const smtpPort = parseInt(settingsObj.smtp_port || process.env.SMTP_PORT || '587');
    const smtpUser = (settingsObj.smtp_user || process.env.SMTP_USER || '').trim();
    const smtpPass = (settingsObj.smtp_pass || process.env.SMTP_PASS || '').trim();

    // Validation
    if (smtpHost.includes('@') || !smtpHost.includes('.')) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid SMTP_HOST: "${smtpHost}". Please check your settings.` 
      });
    }

    if (!smtpUser || !smtpPass) {
      return res.status(400).json({
        success: false,
        message: "SMTP_USER or SMTP_PASS is missing in environment variables or settings."
      });
    }

    console.log(`SMTP Test: Sending to ${email} via ${smtpHost}:${smtpPort} (User: ${smtpUser})`);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      requireTLS: smtpPort === 587,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      debug: true, // Enable debug output
      logger: true // Log information to console
    });

    try {
      const info = await transporter.sendMail({
        from: `"Church Management System" <${smtpUser || 'noreply@church.com'}>`,
        to: email,
        subject: "SMTP Test Email",
        text: "If you are reading this, your SMTP settings are working correctly!",
      });
      console.log("SMTP Test Success:", info.messageId);
      res.json({ success: true, message: "Test email sent successfully!" });
    } catch (error: any) {
      console.error("SMTP Test failed:", error);
      let message = `SMTP Test failed: ${error.message}`;
      if (error.message.includes('535') && smtpHost.includes('gmail')) {
        message += "\n\nTIP: For Gmail, you MUST use an 'App Password' instead of your regular password. Enable 2FA in your Google Account and search for 'App Passwords'.";
      }
      res.status(500).json({ success: false, message });
    }
  });

  app.post("/api/settings/email", (req, res) => {
    const { username, email } = req.body;
    try {
      db.prepare("UPDATE users SET email = ? WHERE username = ?").run(email, username);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating email:", error);
      res.status(500).json({ success: false, message: "Database error" });
    }
  });

  app.post("/api/settings/password", (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    console.log(`Password change attempt for: ${username}`);
    try {
      const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, currentPassword);
      if (!user) {
        console.log(`Password change failed: Invalid current password for ${username}`);
        return res.status(401).json({ success: false, message: "Invalid current password" });
      }
      db.prepare("UPDATE users SET password = ? WHERE username = ?").run(newPassword, username);
      console.log(`Password updated successfully for: ${username}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Database error during password change:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.post("/api/settings/reset-password", (req, res) => {
    const { username } = req.body;
    console.log(`Password reset attempt for: ${username}`);
    try {
      db.prepare("UPDATE users SET password = ? WHERE username = ?").run("admin123", username);
      console.log(`Password reset successfully for: ${username}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Database error during password reset:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    try {
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (!user) {
        return res.status(404).json({ success: false, message: "Email not found" });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

      db.prepare("DELETE FROM password_reset_otps WHERE user_id = ?").run(user.id);
      db.prepare("INSERT INTO password_reset_otps (user_id, otp, expires_at) VALUES (?, ?, ?)").run(user.id, otp, expiresAt);

      // Setup nodemailer
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER || 'your-email@gmail.com',
          pass: process.env.EMAIL_PASS || 'your-app-password'
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_USER || 'your-email@gmail.com',
        to: email,
        subject: 'Password Reset OTP - CSI CMS',
        text: `Your OTP for password reset is: ${otp}. It will expire in 10 minutes.`
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "OTP sent to your email" });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ success: false, message: "Error sending OTP", error: error.message });
    }
  });

  app.post("/api/auth/verify-otp", (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const otpRecord = db.prepare("SELECT * FROM password_reset_otps WHERE user_id = ? AND otp = ?").get(user.id, otp);
      if (!otpRecord) {
        return res.status(400).json({ success: false, message: "Invalid OTP" });
      }

      if (new Date(otpRecord.expires_at) < new Date()) {
        return res.status(400).json({ success: false, message: "OTP expired" });
      }

      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newPassword, user.id);
      db.prepare("DELETE FROM password_reset_otps WHERE user_id = ?").run(user.id);

      res.json({ success: true, message: "Password reset successful" });
    } catch (error: any) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ success: false, message: "Error resetting password", error: error.message });
    }
  });

  // 404 for API routes - prevent falling through to SPA fallback
  app.all("/api/*", (req, res) => {
    res.status(404).json({ success: false, message: `API route ${req.method} ${req.url} not found` });
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Server Error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    // SPA fallback - exclude API routes
    app.get(/^(?!\/api).+/, (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
