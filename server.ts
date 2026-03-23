import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";

const db = new Database("church.db");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS churches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    location TEXT,
    admin_name TEXT,
    admin_email TEXT UNIQUE,
    phone TEXT,
    status TEXT DEFAULT 'active', -- active, inactive
    plan TEXT DEFAULT 'basic', -- basic, premium
    expiry_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT, -- super_admin, pastor, accountant, staff
    name TEXT,
    email TEXT,
    church_id INTEGER,
    status TEXT DEFAULT 'active',
    FOREIGN KEY(church_id) REFERENCES churches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_reset_otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    otp TEXT,
    expires_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER,
    member_code TEXT,
    name TEXT,
    tamil_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    family_details TEXT,
    membership_type TEXT, -- regular, visitor, life
    joined_date TEXT,
    status TEXT DEFAULT 'active',
    dob TEXT,
    marital_status TEXT DEFAULT 'unmarried', -- married, unmarried
    anniversary_date TEXT,
    spouse_name TEXT,
    FOREIGN KEY(church_id) REFERENCES churches(id) ON DELETE CASCADE,
    UNIQUE(church_id, member_code)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER,
    invoice_no TEXT,
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
    FOREIGN KEY(church_id) REFERENCES churches(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE SET NULL,
    UNIQUE(church_id, invoice_no)
  );

  CREATE INDEX IF NOT EXISTS idx_users_church_id ON users(church_id);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  CREATE INDEX IF NOT EXISTS idx_transactions_church_id ON transactions(church_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
`);

// Migration: Add invoice_seq to transactions
try {
  db.prepare("ALTER TABLE transactions ADD COLUMN invoice_seq INTEGER").run();
} catch (e) {}

// Cleanup Migration: Populate invoice_seq and fix numbering only if needed
try {
  const needsFix = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE invoice_seq IS NULL").get() as { count: number };
  if (needsFix.count > 0) {
    const churches = db.prepare("SELECT id FROM churches").all() as { id: number }[];
    for (const church of churches) {
      for (const type of ['income', 'expense']) {
        const prefix = type === 'income' ? 'INC ' : 'EXP ';
        const txs = db.prepare("SELECT id, invoice_no FROM transactions WHERE church_id = ? AND type = ? ORDER BY id ASC").all(church.id, type) as { id: number, invoice_no: string }[];
        
        let currentSeq = 1;
        for (const tx of txs) {
          const oldInvoiceNo = tx.invoice_no;
          // Try to extract sequence from existing invoice_no if it matches the prefix
          let seq = currentSeq;
          if (oldInvoiceNo && oldInvoiceNo.startsWith(prefix)) {
            const num = parseInt(oldInvoiceNo.replace(prefix, ''));
            if (!isNaN(num)) seq = num;
          }
          
          const newInvoiceNo = `${prefix}${seq}`;
          
          // Update transaction
          db.prepare("UPDATE transactions SET invoice_no = ?, invoice_seq = ? WHERE id = ?").run(newInvoiceNo, seq, tx.id);
          
          // Update corrections that reference this invoice
          if (oldInvoiceNo !== newInvoiceNo) {
            db.prepare("UPDATE corrections SET ref_invoice_no = ? WHERE ref_invoice_no = ? AND church_id = ?").run(newInvoiceNo, oldInvoiceNo, church.id);
          }
          
          // If we are assigning new sequences, we should keep track of the max
          if (seq >= currentSeq) {
            currentSeq = seq + 1;
          } else {
            currentSeq++;
          }
        }
      }
    }
    console.log("Invoice sequence migration completed.");
  }
} catch (e) {
  console.error("Cleanup migration failed:", e);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER,
    member_id INTEGER,
    start_date TEXT,
    end_date TEXT,
    amount REAL,
    status TEXT, -- paid, pending
    last_reminder_date TEXT,
    transaction_id INTEGER,
    FOREIGN KEY(church_id) REFERENCES churches(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    church_id INTEGER,
    key TEXT,
    value TEXT,
    PRIMARY KEY (church_id, key),
    FOREIGN KEY(church_id) REFERENCES churches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS church_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER,
    category TEXT, -- event, prayer, auction, materials
    content TEXT,
    user_name TEXT,
    mobile TEXT,
    address TEXT,
    date TEXT,
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(church_id) REFERENCES churches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER,
    correction_no TEXT,
    ref_invoice_no TEXT,
    type TEXT, -- income, expense
    amount REAL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY(church_id) REFERENCES churches(id) ON DELETE CASCADE,
    UNIQUE(church_id, correction_no)
  );
`);

// Create indexes for performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_members_church_id ON members(church_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_church_id ON transactions(church_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  CREATE INDEX IF NOT EXISTS idx_transactions_church_type_amount ON transactions(church_id, type, amount);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_church_id ON subscriptions(church_id);
  CREATE INDEX IF NOT EXISTS idx_church_notes_church_id ON church_notes(church_id);
  CREATE INDEX IF NOT EXISTS idx_corrections_church_id ON corrections(church_id);
  CREATE INDEX IF NOT EXISTS idx_users_church_id ON users(church_id);
`);

// Migration: Update member codes from CSIM to M
try {
  const membersTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='members'").get();
  if (membersTableExists) {
    const csimMembers = db.prepare("SELECT id, member_code FROM members WHERE member_code LIKE 'CSIM%'").all() as { id: number, member_code: string }[];
    for (const m of csimMembers) {
      if (m.member_code) {
        const newCode = m.member_code.replace('CSIM', 'M');
        try {
          db.prepare("UPDATE members SET member_code = ? WHERE id = ?").run(newCode, m.id);
        } catch (err) {
          // Ignore if unique constraint fails
        }
      }
    }
  }
} catch (e) {
  console.error("Migration error (CSIM to M):", e);
}

// Migration: Multi-Church SaaS
try {
  db.prepare("ALTER TABLE users ADD COLUMN church_id INTEGER").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE users ADD COLUMN role TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE users ADD COLUMN name TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE users ADD COLUMN email TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE members ADD COLUMN church_id INTEGER").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE transactions ADD COLUMN church_id INTEGER").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE subscriptions ADD COLUMN church_id INTEGER").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE church_notes ADD COLUMN church_id INTEGER").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE corrections ADD COLUMN church_id INTEGER").run();
} catch (e) {}

// Seed default church if none exists
const churchExists = db.prepare("SELECT * FROM churches WHERE id = 1").get();
if (!churchExists) {
  db.prepare("INSERT INTO churches (id, name, location, admin_name, admin_email, status) VALUES (?, ?, ?, ?, ?, ?)").run(
    1,
    "C.S.I W.J HATCH MEMORIAL CHURCH",
    "Chennai, Tamil Nadu",
    "Admin",
    "sriarunkumarphy@gmail.com",
    "active"
  );
  
  // Assign existing data to default church
  try {
    db.prepare("UPDATE users SET church_id = 1 WHERE role != 'super_admin' OR role IS NULL").run();
    db.prepare("UPDATE members SET church_id = 1 WHERE church_id IS NULL").run();
    db.prepare("UPDATE transactions SET church_id = 1 WHERE church_id IS NULL").run();
    db.prepare("UPDATE subscriptions SET church_id = 1 WHERE church_id IS NULL").run();
    db.prepare("UPDATE church_notes SET church_id = 1 WHERE church_id IS NULL").run();
    db.prepare("UPDATE corrections SET church_id = 1 WHERE church_id IS NULL").run();
  } catch (e) {
    console.error("Error migrating data to default church:", e);
  }
  
  // Migrate settings
  const oldSettings = db.prepare("SELECT * FROM settings WHERE church_id IS NULL").all() as any[];
  for (const s of oldSettings) {
    try {
      db.prepare("INSERT INTO settings (church_id, key, value) VALUES (1, ?, ?)").run(s.key, s.value);
    } catch (e) {}
  }
}

// Migration: Ensure dob column exists in members table
try {
  db.prepare("ALTER TABLE members ADD COLUMN dob TEXT").run();
  console.log("Added dob column to members table.");
} catch (e: any) {
  if (e.message.includes("duplicate column name")) {
    console.log("dob column already exists in members table.");
  }
}

// Migration: Ensure marital_status column exists in members table
try {
  db.prepare("ALTER TABLE members ADD COLUMN marital_status TEXT DEFAULT 'unmarried'").run();
  console.log("Added marital_status column to members table.");
} catch (e: any) {
  if (e.message.includes("duplicate column name")) {
    console.log("marital_status column already exists in members table.");
  }
}

// Migration: Ensure anniversary_date column exists in members table
try {
  db.prepare("ALTER TABLE members ADD COLUMN anniversary_date TEXT").run();
  console.log("Added anniversary_date column to members table.");
} catch (e: any) {
  if (e.message.includes("duplicate column name")) {
    console.log("anniversary_date column already exists in members table.");
  }
}

// Migration: Ensure spouse_name column exists in members table
try {
  db.prepare("ALTER TABLE members ADD COLUMN spouse_name TEXT").run();
  console.log("Added spouse_name column to members table.");
} catch (e: any) {
  if (e.message.includes("duplicate column name")) {
    console.log("spouse_name column already exists in members table.");
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

// Seed default user if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE username = ?").get("admin") as any;
if (!adminExists) {
  console.log("Seeding default admin user...");
  db.prepare("INSERT INTO users (username, password, role, name, email, status) VALUES (?, ?, ?, ?, ?, ?)").run(
    "admin",
    "admin123", // In a real app, use bcrypt
    "super_admin",
    "Super Admin",
    "sriarunkumarphy@gmail.com",
    "active"
  );
  console.log("Default admin user seeded.");
} else {
  console.log("Admin user already exists. Ensuring password is 'admin123', role is 'super_admin', status is 'active', and email is updated.");
  db.prepare("UPDATE users SET password = ?, email = ?, role = ?, status = ? WHERE username = ?").run(
    "admin123",
    "sriarunkumarphy@gmail.com",
    "super_admin",
    "active",
    "admin"
  );
}

// Seed default pastor for church 1
const pastorExists = db.prepare("SELECT * FROM users WHERE username = ?").get("pastor") as any;
if (!pastorExists) {
  console.log("Seeding default pastor user for church 1...");
  db.prepare("INSERT INTO users (username, password, role, name, email, church_id) VALUES (?, ?, ?, ?, ?, ?)").run(
    "pastor",
    "pastor123",
    "pastor",
    "Church Pastor",
    "pastor@example.com",
    1
  );
  console.log("Default pastor user seeded.");
}

// Seed default settings for church 1
const settings = [
  { key: "church_name", value: "C.S.I W.J HATCH MEMORIAL CHURCH" },
  { key: "church_name_tamil", value: "C.S.I W.J ஹட்ச் மெமோரியல் சர்ச்" },
  { key: "address", value: "123 Church Street, Chennai, Tamil Nadu" },
  { key: "currency", value: "INR" },
  { key: "financial_year", value: "2024-2025" }
];

for (const s of settings) {
  const exists = db.prepare("SELECT * FROM settings WHERE church_id = 1 AND key = ?").get(s.key);
  if (!exists) {
    db.prepare("INSERT INTO settings (church_id, key, value) VALUES (1, ?, ?)").run(s.key, s.value);
  }
}

// Update church name if it's still the old one for church 1
try {
  db.prepare("UPDATE settings SET value = ? WHERE church_id = 1 AND key = 'church_name' AND value = 'Arul Church'").run("C.S.I W.J HATCH MEMORIAL CHURCH");
  db.prepare("UPDATE settings SET value = ? WHERE church_id = 1 AND key = 'church_name_tamil' AND value = 'அருள் தேவாலயம்'").run("C.S.I W.J ஹட்ச் மெமோரியல் சர்ச்");
} catch (e) {}

// Helper functions for ID validation
const parseId = (id: any): number | null => {
  if (id === "" || id === undefined || id === null || id === "null" || id === "undefined") return null;
  const parsed = parseInt(id);
  return isNaN(parsed) ? null : parsed;
};

const validateChurchId = (id: any, req?: any) => {
  // Allow super_admin to bypass church_id check for super admin routes
  if (req && req.headers['x-user-role'] === 'super_admin') {
    return parseId(id) || 0; // Return the ID if provided, or 0 as a placeholder
  }
  const parsed = parseId(id);
  if (parsed === null) return null;
  const exists = db.prepare("SELECT 1 FROM churches WHERE id = ?").get(parsed);
  return exists ? parsed : null;
};

const validateMemberId = (id: any, churchId: number) => {
  const parsed = parseId(id);
  if (parsed === null) return null;
  const exists = db.prepare("SELECT 1 FROM members WHERE id = ? AND church_id = ?").get(parsed, churchId);
  return exists ? parsed : null;
};

const validateTransactionId = (id: any, churchId: number) => {
  const parsed = parseId(id);
  if (parsed === null) return null;
  const exists = db.prepare("SELECT 1 FROM transactions WHERE id = ? AND church_id = ?").get(parsed, churchId);
  return exists ? parsed : null;
};

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
  app.get("/api/health", (req, res) => {
    try {
      db.prepare("SELECT 1").get();
      res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error("Health check database error:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  app.post("/api/login", (req, res) => {
    const { username: rawUsername, password: rawPassword } = req.body;
    const username = rawUsername?.trim();
    const password = rawPassword?.trim();
    console.log(`[${new Date().toISOString()}] Login attempt: username="${username}"`);
    
    if (!username || !password) {
      console.log(`[${new Date().toISOString()}] Login failed: Missing credentials`);
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    try {
      const user = db.prepare("SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?").get(username, username, password) as any;
      if (user) {
        if (user.status === 'inactive') {
          console.log(`[${new Date().toISOString()}] Login failed: User "${username}" is inactive`);
          return res.status(401).json({ success: false, message: "Account is inactive" });
        }
        
        let church = null;
        if (user.church_id) {
          church = db.prepare("SELECT * FROM churches WHERE id = ?").get(user.church_id);
          if (church && (church as any).status === 'inactive') {
            console.log(`[${new Date().toISOString()}] Login failed: Church for user "${username}" is inactive`);
            return res.status(401).json({ success: false, message: "Church account is inactive" });
          }
        }

        const matchType = user.username === username ? 'username' : 'email';
        console.log(`[${new Date().toISOString()}] Login success: user="${user.username}" (matched via ${matchType}), role="${user.role}"`);
        res.json({ 
          success: true, 
          user: { 
            id: user.id, 
            username: user.username, 
            role: user.role, 
            name: user.name, 
            email: user.email,
            church_id: user.church_id,
            church_name: church ? (church as any).name : null
          } 
        });
      } else {
        // Debug: check if user exists at all
        const userOnly = db.prepare("SELECT id, username, role, status, email FROM users WHERE username = ? OR email = ?").get(username, username) as any;
        let debugMsg = "Invalid credentials";
        if (userOnly) {
          const foundVia = userOnly.username === username ? 'username' : 'email';
          debugMsg = `Invalid password for user ${userOnly.username} (Found via ${foundVia}, Role: ${userOnly.role}, Status: ${userOnly.status})`;
        } else {
          debugMsg = `User "${username}" not found in database (checked username and email)`;
        }
        console.log(`[${new Date().toISOString()}] Login failed: ${debugMsg}`);
        res.status(401).json({ success: false, message: debugMsg });
      }
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Login error:`, error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  // Super Admin APIs moved to consolidated section below

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
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const members = db.prepare("SELECT * FROM members WHERE (status = 'active' OR status IS NULL) AND church_id = ?").all(churchId);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/members", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const { name, tamil_name, phone, email, address, family_details, membership_type, joined_date, dob, marital_status, anniversary_date, spouse_name } = req.body;
      
      const lastMember = db.prepare("SELECT member_code FROM members WHERE (member_code LIKE 'CSIM%' OR member_code LIKE 'M%') AND church_id = ? ORDER BY id DESC LIMIT 1").get(churchId) as { member_code: string } | undefined;
      let nextNum = 1;
      if (lastMember && lastMember.member_code) {
        const lastNum = parseInt(lastMember.member_code.replace('CSIM', '').replace('M', ''));
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      const member_code = `M${nextNum}`;

      const result = db.prepare(`
        INSERT INTO members (church_id, member_code, name, tamil_name, phone, email, address, family_details, membership_type, joined_date, dob, marital_status, anniversary_date, spouse_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(churchId, member_code, name, tamil_name, phone, email, address, family_details, membership_type, joined_date, dob, marital_status, anniversary_date, spouse_name);
      res.json({ success: true, id: result.lastInsertRowid, member_code });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/members/:id", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const { name, tamil_name, phone, email, address, family_details, membership_type, joined_date, dob, marital_status, anniversary_date, spouse_name } = req.body;
      db.prepare(`
        UPDATE members 
        SET name = ?, tamil_name = ?, phone = ?, email = ?, address = ?, family_details = ?, membership_type = ?, joined_date = ?, dob = ?, marital_status = ?, anniversary_date = ?, spouse_name = ?
        WHERE id = ? AND church_id = ?
      `).run(name, tamil_name, phone, email, address, family_details, membership_type, joined_date, dob, marital_status, anniversary_date, spouse_name, req.params.id, churchId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/members/:id", (req, res) => {
    const { id } = req.params;
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const result = db.prepare("UPDATE members SET status = 'inactive' WHERE id = ? AND church_id = ?").run(id, churchId);
      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: "Member not found" });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/reminders", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const today = new Date();
      const todayMonthDay = today.toISOString().slice(5, 10); // MM-DD
      
      const next7Days = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        next7Days.push(d.toISOString().slice(5, 10));
      }

      // Optimization: Filter in database using strftime
      const todayBirthdays = db.prepare(`
        SELECT * FROM members 
        WHERE (status = 'active' OR status IS NULL) 
        AND church_id = ? 
        AND strftime('%m-%d', dob) = ?
      `).all(churchId, todayMonthDay);

      const todayAnniversaries = db.prepare(`
        SELECT * FROM members 
        WHERE (status = 'active' OR status IS NULL) 
        AND church_id = ? 
        AND marital_status = 'married' 
        AND strftime('%m-%d', anniversary_date) = ?
      `).all(churchId, todayMonthDay);

      const upcomingBirthdays = db.prepare(`
        SELECT * FROM members 
        WHERE (status = 'active' OR status IS NULL) 
        AND church_id = ? 
        AND strftime('%m-%d', dob) IN (${next7Days.map(() => '?').join(',')})
      `).all(churchId, ...next7Days);

      const upcomingAnniversaries = db.prepare(`
        SELECT * FROM members 
        WHERE (status = 'active' OR status IS NULL) 
        AND church_id = ? 
        AND marital_status = 'married' 
        AND strftime('%m-%d', anniversary_date) IN (${next7Days.map(() => '?').join(',')})
      `).all(churchId, ...next7Days);

      res.json({
        today: {
          birthdays: todayBirthdays,
          anniversaries: todayAnniversaries
        },
        upcoming: {
          birthdays: upcomingBirthdays,
          anniversaries: upcomingAnniversaries
        }
      });
    } catch (error: any) {
      console.error("Error fetching reminders:", error);
      res.status(500).json({ success: false, message: "Database error", error: error.message });
    }
  });

  // Transactions API
  app.post("/api/transactions/renumber", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });

    try {
      db.transaction(() => {
        for (const type of ['income', 'expense']) {
          const prefix = type === 'income' ? 'INC ' : 'EXP ';
          // Order by date then id to ensure logical sequence
          const txs = db.prepare("SELECT id, invoice_no FROM transactions WHERE church_id = ? AND type = ? ORDER BY date ASC, id ASC").all(churchId, type) as { id: number, invoice_no: string }[];
          
          // Phase 1: Move to temporary names to avoid unique constraint collisions
          for (const tx of txs) {
            db.prepare("UPDATE transactions SET invoice_no = ? WHERE id = ?").run(`TEMP_${tx.id}_${Date.now()}`, tx.id);
          }

          // Phase 2: Set final sequential numbers
          let currentSeq = 1;
          for (const tx of txs) {
            const newInvoiceNo = `${prefix}${currentSeq}`;
            const oldInvoiceNo = tx.invoice_no;
            
            db.prepare("UPDATE transactions SET invoice_no = ?, invoice_seq = ? WHERE id = ?").run(newInvoiceNo, currentSeq, tx.id);
            
            if (oldInvoiceNo !== newInvoiceNo) {
              db.prepare("UPDATE corrections SET ref_invoice_no = ? WHERE ref_invoice_no = ? AND church_id = ?").run(newInvoiceNo, oldInvoiceNo, churchId);
            }
            
            currentSeq++;
          }
        }
      })();
      res.json({ success: true, message: "Invoices renumbered successfully" });
    } catch (error: any) {
      console.error("Renumbering error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/transactions", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      let query = `
        SELECT t.*, m.name as member_name, s.start_date as sub_start_date, s.end_date as sub_end_date,
        (SELECT COUNT(*) FROM corrections c WHERE c.ref_invoice_no = t.invoice_no AND c.church_id = t.church_id) as correction_count
        FROM transactions t 
        LEFT JOIN members m ON t.member_id = m.id
        LEFT JOIN subscriptions s ON t.id = s.transaction_id
        WHERE t.church_id = ?
        ORDER BY t.date DESC
      `;
      
      if (limit) {
        query += ` LIMIT ${limit}`;
      }
      
      const transactions = db.prepare(query).all(churchId);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/transactions", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    
    try {
      const { type, category, amount, date, payment_mode, member_id, vendor_name, item_details, gst_amount, notes } = req.body;
      
      const finalMemberId = validateMemberId(member_id, churchId);
      
      if (category === 'subscriptions' && !finalMemberId) {
        return res.status(400).json({ success: false, message: "Valid Member is required for subscriptions" });
      }
      
      let invoice_no = req.body.invoice_no;
      let invoice_seq = req.body.invoice_seq;
      const prefix = type === 'income' ? 'INC ' : 'EXP ';
      
      if (!invoice_no) {
        // Find the first available sequence number starting from 1
        let nextNum = 1;
        let unique = false;
        while (!unique) {
          invoice_no = `${prefix}${nextNum}`;
          const exists = db.prepare("SELECT 1 FROM transactions WHERE invoice_no = ? AND church_id = ?").get(invoice_no, churchId);
          if (!exists) {
            unique = true;
            invoice_seq = nextNum;
          } else {
            nextNum++;
          }
        }
      } else if (!invoice_seq) {
        // Extract sequence from manual invoice_no
        const match = invoice_no.match(/\d+/);
        invoice_seq = match ? parseInt(match[0]) : 0;
      }
      
      const finalAmount = parseFloat(amount) || 0;
      const finalGstAmount = parseFloat(gst_amount) || 0;

      const result = db.prepare(`
        INSERT INTO transactions (church_id, invoice_no, invoice_seq, type, category, amount, date, payment_mode, member_id, vendor_name, item_details, gst_amount, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(churchId, invoice_no, invoice_seq, type, category, finalAmount, date, payment_mode, finalMemberId, vendor_name, item_details, finalGstAmount, notes);
      
      const transactionId = result.lastInsertRowid;

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
          INSERT INTO subscriptions (church_id, member_id, start_date, end_date, amount, status, transaction_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(churchId, finalMemberId, sDate, eDate, finalAmount, 'paid', transactionId);
      }

      res.json({ success: true, id: transactionId, invoice_no });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/transactions/:id", (req, res) => {
    const { id } = req.params;
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });

    try {
      const { category, amount, date, payment_mode, member_id, vendor_name, item_details, gst_amount, notes, invoice_no, invoice_seq } = req.body;
      const finalMemberId = validateMemberId(member_id, churchId);

      if (category === 'subscriptions' && !finalMemberId) {
        return res.status(400).json({ success: false, message: "Valid Member is required for subscriptions" });
      }

      const finalAmount = parseFloat(amount) || 0;
      const finalGstAmount = parseFloat(gst_amount) || 0;

      // Build dynamic update query to handle optional invoice_no/invoice_seq
      const updateFields = [
        "category = ?", "amount = ?", "date = ?", "payment_mode = ?", 
        "member_id = ?", "vendor_name = ?", "item_details = ?", 
        "gst_amount = ?", "notes = ?"
      ];
      const params = [category, finalAmount, date, payment_mode, finalMemberId, vendor_name, item_details, finalGstAmount, notes];

      if (invoice_no !== undefined) {
        updateFields.push("invoice_no = ?");
        params.push(invoice_no);
      }
      if (invoice_seq !== undefined) {
        updateFields.push("invoice_seq = ?");
        params.push(invoice_seq);
      }

      params.push(id, churchId);

      db.prepare(`
        UPDATE transactions 
        SET ${updateFields.join(", ")}
        WHERE id = ? AND church_id = ?
      `).run(...params);

      if (category === 'subscriptions' && finalMemberId) {
        const { start_date, end_date } = req.body;
        const sDate = start_date || date;
        let eDate = end_date;
        if (!eDate) {
          const d = new Date(sDate);
          d.setFullYear(d.getFullYear() + 1);
          eDate = d.toISOString().split('T')[0];
        }

        const existingSub = db.prepare("SELECT id FROM subscriptions WHERE transaction_id = ? AND church_id = ?").get(id, churchId) as { id: number } | undefined;
        if (existingSub) {
          db.prepare(`
            UPDATE subscriptions 
            SET member_id = ?, start_date = ?, end_date = ?, amount = ?, status = 'paid'
            WHERE id = ? AND church_id = ?
          `).run(finalMemberId, sDate, eDate, finalAmount, existingSub.id, churchId);
        } else {
          db.prepare(`
            INSERT INTO subscriptions (church_id, member_id, start_date, end_date, amount, status, transaction_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(churchId, finalMemberId, sDate, eDate, finalAmount, 'paid', id);
        }
      } else {
        db.prepare("DELETE FROM subscriptions WHERE transaction_id = ? AND church_id = ?").run(id, churchId);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/corrections", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const corrections = db.prepare("SELECT * FROM corrections WHERE church_id = ? ORDER BY id DESC").all(churchId);
      res.json(corrections);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/transactions/:id", (req, res) => {
    const { id } = req.params;
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      db.prepare("DELETE FROM subscriptions WHERE transaction_id = ? AND church_id = ?").run(id, churchId);
      db.prepare("DELETE FROM transactions WHERE id = ? AND church_id = ?").run(id, churchId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/corrections", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const { ref_invoice_no, type, amount, reason, created_by } = req.body;
      
      const lastCorrection = db.prepare("SELECT correction_no FROM corrections WHERE church_id = ? ORDER BY id DESC LIMIT 1").get(churchId) as { correction_no: string } | undefined;
      let nextNum = 1;
      if (lastCorrection && lastCorrection.correction_no) {
        const lastNum = parseInt(lastCorrection.correction_no.replace('CORR-', ''));
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      const correction_no = `CORR-${nextNum}`;

      db.prepare(`
        INSERT INTO corrections (church_id, correction_no, ref_invoice_no, type, amount, reason, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(churchId, correction_no, ref_invoice_no, type, amount, reason, created_by);
      
      res.json({ success: true, correction_no });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Subscriptions API
  app.get("/api/subscriptions", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const subscriptions = db.prepare(`
        SELECT s.*, m.name as member_name 
        FROM subscriptions s 
        JOIN members m ON s.member_id = m.id
        WHERE s.church_id = ?
        ORDER BY s.end_date ASC
      `).all(churchId);
      res.json(subscriptions);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/subscriptions", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });

    try {
      const { member_id, start_date, end_date, amount, status, transaction_id } = req.body;
      const finalMemberId = validateMemberId(member_id, churchId);
      const finalTransactionId = transaction_id ? validateTransactionId(transaction_id, churchId) : null;
      
      if (!finalMemberId) {
        return res.status(400).json({ success: false, message: "Valid Member is required for subscriptions" });
      }

      const result = db.prepare(`
        INSERT INTO subscriptions (church_id, member_id, start_date, end_date, amount, status, transaction_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(churchId, finalMemberId, start_date, end_date, amount, status, finalTransactionId);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/subscriptions/:id", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });

    try {
      const { member_id, start_date, end_date, amount, status, transaction_id } = req.body;
      const finalMemberId = validateMemberId(member_id, churchId);
      const finalTransactionId = transaction_id ? validateTransactionId(transaction_id, churchId) : null;

      if (!finalMemberId) {
        return res.status(400).json({ success: false, message: "Valid Member is required for subscriptions" });
      }

      db.prepare(`
        UPDATE subscriptions 
        SET member_id = ?, start_date = ?, end_date = ?, amount = ?, status = ?, transaction_id = ?
        WHERE id = ? AND church_id = ?
      `).run(finalMemberId, start_date, end_date, amount, status, finalTransactionId, req.params.id, churchId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/subscriptions/:id", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      db.prepare("DELETE FROM subscriptions WHERE id = ? AND church_id = ?").run(req.params.id, churchId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const income = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'income' AND church_id = ?").get(churchId).total || 0;
      const expense = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'expense' AND church_id = ?").get(churchId).total || 0;
      const correction = db.prepare("SELECT SUM(amount) as total FROM corrections WHERE church_id = ?").get(churchId).total || 0;
      const membersCount = db.prepare("SELECT COUNT(*) as count FROM members WHERE church_id = ?").get(churchId).count;
      const activeSubs = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'paid' AND church_id = ?").get(churchId).count;
      
      res.json({ income, expense, correction, balance: income - expense + correction, membersCount, activeSubs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Settings API
  app.get("/api/settings", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const settings = db.prepare("SELECT * FROM settings WHERE church_id = ?").all(churchId);
      const settingsObj = settings.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
      res.json(settingsObj);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Church Notes API
  app.get("/api/notes", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const notes = db.prepare("SELECT * FROM church_notes WHERE church_id = ? ORDER BY created_at DESC").all(churchId);
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/notes", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const { category, content, user_name, mobile, address, date, amount, status } = req.body;
      const result = db.prepare(`
        INSERT INTO church_notes (church_id, category, content, user_name, mobile, address, date, amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        churchId,
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
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/notes/:id", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const { category, content, user_name, mobile, address, date, amount, status } = req.body;
      db.prepare(`
        UPDATE church_notes 
        SET category = ?, content = ?, user_name = ?, mobile = ?, address = ?, date = ?, amount = ?, status = ?
        WHERE id = ? AND church_id = ?
      `).run(category, content, user_name, mobile, address, date, amount || 0, status || 'pending', req.params.id, churchId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/notes/:id", (req, res) => {
    const { id } = req.params;
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const parsedId = parseInt(id);
      if (isNaN(parsedId)) return res.status(400).json({ success: false, message: "Invalid Note ID" });
      const result = db.prepare("DELETE FROM church_notes WHERE id = ? AND church_id = ?").run(parsedId, churchId);
      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: "Note not found" });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/reports/top-contributors", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
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
        WHERE t.type = 'income' AND t.church_id = ? AND m.church_id = ?
        GROUP BY m.id
        ORDER BY total_contribution DESC
      `).all(churchId, churchId);
      res.json(topContributors);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/settings", (req, res) => {
    const rawChurchId = req.headers['x-church-id'];
    const churchId = validateChurchId(rawChurchId, req);
    if (!churchId) return res.status(400).json({ success: false, message: "Valid Church ID required" });
    try {
      const updates = req.body;
      const stmt = db.prepare("INSERT OR REPLACE INTO settings (church_id, key, value) VALUES (?, ?, ?)");
      const transaction = db.transaction((data) => {
        for (const [key, value] of Object.entries(data)) {
          stmt.run(churchId, key, value);
          
          // Sync with churches table for key fields - only if value is not empty
          if (key === 'church_name' && typeof value === 'string' && value.trim() !== '') {
            db.prepare("UPDATE churches SET name = ? WHERE id = ?").run(value, churchId);
          } else if (key === 'address' && typeof value === 'string' && value.trim() !== '') {
            db.prepare("UPDATE churches SET location = ? WHERE id = ?").run(value, churchId);
          }
        }
      });
      transaction(updates);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
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

  // Super Admin API
  const validateSuperAdmin = (req: any, res: any, next: any) => {
    const userRole = req.headers['x-user-role'];
    if (userRole !== 'super_admin') {
      return res.status(403).json({ success: false, message: "Super Admin access required" });
    }
    next();
  };

  app.get("/api/super/stats", validateSuperAdmin, (req, res) => {
    console.log("Super Admin: Fetching stats");
    try {
      const totalChurches = db.prepare("SELECT COUNT(*) as count FROM churches").get() as any;
      const activeChurches = db.prepare("SELECT COUNT(*) as count FROM churches WHERE status = 'active'").get() as any;
      const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
      
      res.json({
        totalChurches: totalChurches.count,
        activeChurches: activeChurches.count,
        totalUsers: totalUsers.count
      });
    } catch (error: any) {
      console.error("Super Admin Stats Error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/super/churches", validateSuperAdmin, (req, res) => {
    console.log("Super Admin: Fetching churches - Start");
    try {
      // Optimized query using LEFT JOINs instead of correlated subqueries
      const churches = db.prepare(`
        SELECT 
          c.*, 
          c.plan as subscription_plan,
          u.username as admin_username,
          u.id as admin_user_id,
          COALESCE(t.total, 0) as total_contribution
        FROM churches c
        LEFT JOIN (
          SELECT church_id, username, id 
          FROM users 
          WHERE role IN ('pastor', 'accountant')
          GROUP BY church_id
        ) u ON u.church_id = c.id
        LEFT JOIN (
          SELECT church_id, SUM(amount) as total 
          FROM transactions 
          WHERE type = 'income' 
          GROUP BY church_id
        ) t ON t.church_id = c.id
      `).all();
      console.log(`Super Admin: Fetched ${churches.length} churches`);
      res.json(churches);
    } catch (error: any) {
      console.error("Super Admin Churches Error:", error);
      res.status(500).json({ success: false, message: "Error fetching churches", error: error.message });
    }
  });

  app.post("/api/super/churches", validateSuperAdmin, (req, res) => {
    const { name, location, admin_name, admin_email, phone, username, password, plan, expiry_date } = req.body;
    try {
      const result = db.prepare("INSERT INTO churches (name, location, admin_name, admin_email, phone, status, plan, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
        name, location, admin_name, admin_email, phone, 'active', plan || 'Basic', expiry_date || null
      );
      const churchId = result.lastInsertRowid;

      db.prepare("INSERT INTO users (username, password, role, name, email, church_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        username, password, 'pastor', admin_name, admin_email, churchId, 'active'
      );

      // Seed default settings for the new church
      const defaultSettings = [
        { key: "church_name", value: name },
        { key: "church_name_tamil", value: "" },
        { key: "address", value: location },
        { key: "currency", value: "INR" },
        { key: "financial_year", value: "2024-2025" }
      ];
      for (const s of defaultSettings) {
        db.prepare("INSERT INTO settings (church_id, key, value) VALUES (?, ?, ?)").run(churchId, s.key, s.value);
      }

      res.json({ success: true, message: "Church and Admin User created successfully", churchId });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/super/churches/:id", validateSuperAdmin, (req, res) => {
    const { id } = req.params;
    const { name, location, admin_name, admin_email, phone, status, plan, expiry_date } = req.body;
    try {
      const transaction = db.transaction(() => {
        db.prepare("UPDATE churches SET name = ?, location = ?, admin_name = ?, admin_email = ?, phone = ?, status = ?, plan = ?, expiry_date = ? WHERE id = ?").run(
          name, location, admin_name, admin_email, phone, status, plan || 'Basic', expiry_date || null, id
        );
        
        // Also update the pastor user if exists
        db.prepare("UPDATE users SET name = ?, email = ? WHERE church_id = ? AND (role = 'pastor' OR role = 'accountant')").run(
          admin_name, admin_email, id
        );

        // Update church settings if they exist, or create them if they don't
        db.prepare("INSERT OR REPLACE INTO settings (church_id, key, value) VALUES (?, 'church_name', ?)").run(id, name);
        db.prepare("INSERT OR REPLACE INTO settings (church_id, key, value) VALUES (?, 'address', ?)").run(id, location);
      });

      transaction();
      res.json({ success: true, message: "Church updated successfully" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/super/profile", validateSuperAdmin, (req, res) => {
    const userId = req.headers['x-user-id'];
    try {
      const user = db.prepare("SELECT name, username, email FROM users WHERE id = ?").get(userId) as any;
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/super/profile", validateSuperAdmin, (req, res) => {
    const userId = req.headers['x-user-id'];
    const { name, email } = req.body;
    try {
      db.prepare("UPDATE users SET name = ?, email = ? WHERE id = ?").run(name, email, userId);
      res.json({ success: true, message: "Profile updated successfully" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/super/change-password", validateSuperAdmin, (req, res) => {
    const userId = req.headers['x-user-id'];
    const { currentPassword, newPassword } = req.body;
    try {
      const user = db.prepare("SELECT password FROM users WHERE id = ?").get(userId) as any;
      if (user.password !== currentPassword) {
        return res.status(400).json({ success: false, message: "Incorrect current password" });
      }
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newPassword, userId);
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/super/churches/:id/password", validateSuperAdmin, (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    try {
      db.prepare("UPDATE users SET password = ? WHERE church_id = ? AND (role = 'pastor' OR role = 'accountant')").run(
        password, id
      );
      res.json({ success: true, message: "Admin password updated successfully" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
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

startServer().catch(err => {
  console.error("CRITICAL: Failed to start server:", err);
  process.exit(1);
});
