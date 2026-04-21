const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const multer = require("multer");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const phonePe = require("./phonePeClient.js");

/** Always load `.env` next to this file (fixes "injecting env (0)" when cwd is not `backend/`). */
dotenv.config({ path: path.resolve(__dirname, ".env") });

const MB = 1024 * 1024;
function clampEnvInt(name, def, min, max) {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** Max size per blog image file (cover or block). Env MAX_BLOG_UPLOAD_MB (1–64), default 16. */
const MAX_BLOG_UPLOAD_MB = clampEnvInt("MAX_BLOG_UPLOAD_MB", 16, 1, 64);

/**
 * Per-connection SESSION limit (bytes). Cannot exceed the server's global max_allowed_packet.
 * Env MYSQL_SESSION_MAX_PACKET (e.g. 134217728 for 128 MB). Default 128 MB.
 */
const MYSQL_SESSION_MAX_PACKET = (() => {
  const n = Number(process.env.MYSQL_SESSION_MAX_PACKET);
  if (Number.isFinite(n) && n >= 1_048_576 && n <= 1_073_741_824) return Math.floor(n);
  return 128 * MB;
})();

const app = express();
const PORT = process.env.PORT || 5001;
const upload = multer({ storage: multer.memoryStorage() });

/** Product uploads: cap each file so MySQL / proxy are less likely to drop the connection. */
const uploadProduct = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
    files: 4,
    fields: 40,
    fieldSize: 2 * 1024 * 1024,
  },
});

const uploadBlog = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_BLOG_UPLOAD_MB * MB,
    files: 28,
    fields: 20,
    fieldSize: 8 * MB,
  },
});

/**
 * Browser origins allowed for CORS. Use CORS_ORIGIN (one) and/or CORS_ORIGINS (comma-separated).
 * For each non-localhost origin, the apex ↔ www variant is added automatically
 * (e.g. https://sand24.in also allows https://www.sand24.in).
 */
function buildAllowedCorsOriginSet() {
  const raw = [process.env.CORS_ORIGIN, process.env.CORS_ORIGINS]
    .filter(Boolean)
    .join(",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const set = new Set(raw);
  for (const o of [...set]) {
    try {
      const u = new URL(o);
      if (!/^https?:$/.test(u.protocol)) continue;
      const portPart = u.port ? `:${u.port}` : "";
      const host = u.hostname;
      const isLocal =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".localhost");
      if (isLocal) continue;
      if (host.startsWith("www.")) {
        set.add(`${u.protocol}//${host.slice(4)}${portPart}`);
      } else {
        set.add(`${u.protocol}//www.${host}${portPart}`);
      }
    } catch {
      /* ignore invalid URL */
    }
  }
  return set;
}

const ALLOWED_CORS_ORIGINS = buildAllowedCorsOriginSet();

app.use(
  cors({
    origin(origin, callback) {
      const isLocalhostOrigin =
        !origin ||
        /^http:\/\/localhost:\d+$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);

      if (isLocalhostOrigin) {
        callback(null, true);
        return;
      }

      if (ALLOWED_CORS_ORIGINS.size === 0) {
        if (origin === "http://localhost:5173") {
          callback(null, true);
          return;
        }
        callback(null, false);
        return;
      }

      if (ALLOWED_CORS_ORIGINS.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(express.json({ limit: "50mb" }));

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "fashion_db",
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
  connectTimeout: 60000,
  enableKeepAlive: true,
});

/** Request a larger per-query packet limit for this connection (cannot exceed MySQL GLOBAL). */
async function mysqlBumpSessionPacket(connection) {
  try {
    await connection.query("SET SESSION max_allowed_packet = ?", [MYSQL_SESSION_MAX_PACKET]);
  } catch (e) {
    console.warn("[Sand24] SET SESSION max_allowed_packet:", e.message);
  }
}

async function logMysqlGlobalMaxPacket() {
  try {
    const [rows] = await db.query("SHOW GLOBAL VARIABLES LIKE 'max_allowed_packet'");
    const v = Number(rows[0]?.Value);
    if (!Number.isFinite(v)) return;
    console.log(
      `[Sand24] MySQL GLOBAL max_allowed_packet = ${v} bytes (${(v / MB).toFixed(1)} MB) — each image INSERT must fit in one packet`
    );
    if (v < 32 * MB) {
      console.warn(
        "[Sand24] GLOBAL limit is low. Edit my.cnf: [mysqld] max_allowed_packet=128M — restart MySQL — verify with: SHOW GLOBAL VARIABLES LIKE 'max_allowed_packet';"
      );
    }
  } catch (e) {
    console.warn("[Sand24] Could not read max_allowed_packet (check DB credentials):", e.message);
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const OTP_PEPPER = process.env.OTP_PEPPER || "dev-otp-pepper-change-me";
const OTP_TTL_MS = 10 * 60 * 1000;
/** Signup/password hashing (bcrypt). Default 4 = fast signup; set BCRYPT_ROUNDS=10+ in production if policy requires. */
const BCRYPT_ROUNDS = Math.min(12, Math.max(4, Number(process.env.BCRYPT_ROUNDS) || 4));

function hashOtpCode(plain, userId, purpose) {
  return crypto.createHmac("sha256", OTP_PEPPER).update(`${userId}|${purpose}|${plain}`).digest("hex");
}

function timingSafeEqualHex(a, b) {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function randomSixDigitOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function signUserToken(userRow) {
  return jwt.sign(
    { sub: userRow.id, email: userRow.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

let mailTransport = null;
function getMailTransport() {
  if (mailTransport) return mailTransport;
  const user = process.env.SMTP_USER?.trim();
  const rawPass = process.env.SMTP_PASS;
  if (!user || rawPass == null || String(rawPass).trim() === "") return null;
  /** Gmail app passwords are often copied with spaces; SMTP expects 16 chars without spaces. */
  const pass = String(rawPass).replace(/\s+/g, "");
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  /** 465 = SSL; 587 = STARTTLS (secure must be false). */
  const secure =
    process.env.SMTP_SECURE != null ? process.env.SMTP_SECURE === "true" : port === 465;
  /** Pooling reuses the TLS session so OTP #2+ (and often #1 after warm-up) reach the provider much faster. */
  const usePool = process.env.SMTP_POOL !== "false";
  mailTransport = nodemailer.createTransport({
    ...(usePool
      ? {
          pool: true,
          maxConnections: Number(process.env.SMTP_POOL_MAX || 3),
          maxMessages: 500,
        }
      : {}),
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 60000,
    ...(port === 587 ? { requireTLS: true } : {}),
  });
  return mailTransport;
}

function buildOtpEmailParts(otp, purposeLabel) {
  const subject =
    purposeLabel === "register"
      ? "Verify your Sand 24 account"
      : purposeLabel === "password_reset"
        ? "Reset your Sand 24 password"
        : "Your Sand 24 sign-in code";
  const html =
    purposeLabel === "password_reset"
      ? `
    <p>To reset your Sand 24 password, use this one-time code:</p>
    <p><strong style="font-size:22px;letter-spacing:3px">${otp}</strong></p>
    <p>This code expires in 10 minutes. If you did not request a password reset, you can ignore this email.</p>
  `
      : `
    <p>Your verification code is: <strong style="font-size:20px;letter-spacing:2px">${otp}</strong></p>
    <p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
  `;
  const text =
    purposeLabel === "password_reset"
      ? `To reset your Sand 24 password, use this one-time code: ${otp}\n\nThis code expires in 10 minutes. If you did not request a password reset, ignore this email.`
      : `Your Sand 24 verification code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request this, ignore this email.`;
  return { subject, html, text };
}

/** Optional: Resend HTTP API — often reaches Gmail in seconds vs 30s–2m via SMTP. Set RESEND_API_KEY in .env */
async function tryDeliverOtpViaResend(toEmail, otp, purposeLabel) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  const { subject, html, text } = buildOtpEmailParts(otp, purposeLabel);
  const from =
    process.env.RESEND_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    "Sand 24 <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend ${res.status}: ${errBody}`);
  }
  return true;
}

const isProduction = process.env.NODE_ENV === "production";

function printDevOtpBanner(toEmail, otp, purposeLabel) {
  if (isProduction) return;
  console.warn(
    "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      `  [Sand24 dev] SMTP_USER / SMTP_PASS not set in backend/.env\n` +
      `  OTP for ${toEmail} (${purposeLabel}): ${otp}\n` +
      "  Add Gmail + app password to .env to receive real emails.\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
  );
}

/** Sends OTP email: Resend API if configured, else SMTP pool (async from HTTP via queueOtpEmail). */
async function deliverOtpEmail(toEmail, otp, purposeLabel) {
  try {
    if (await tryDeliverOtpViaResend(toEmail, otp, purposeLabel)) return;
  } catch (e) {
    console.error("[Sand24] Resend OTP send failed, trying SMTP:", e.message);
  }
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim();
  const t = getMailTransport();
  if (!t || !from) {
    throw new Error("SMTP not configured");
  }
  const { subject, html, text } = buildOtpEmailParts(otp, purposeLabel);
  await t.sendMail({
    from: `"Sand 24" <${from}>`,
    to: toEmail,
    subject,
    html,
    text,
    headers: {
      "X-Priority": "1",
      Importance: "high",
    },
  });
}

function queueOtpEmail(toEmail, otp, purposeLabel) {
  setImmediate(() => {
    deliverOtpEmail(toEmail, otp, purposeLabel).catch((e) =>
      console.error(`[Sand24] Async OTP email (${purposeLabel}):`, e.message)
    );
  });
}

function escapeHtmlEmail(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatInrEmail(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "₹0.00";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function coerceOrderLinesArray(raw) {
  let lines = raw;
  if (typeof lines === "string") {
    try {
      lines = JSON.parse(lines);
    } catch {
      lines = [];
    }
  }
  return Array.isArray(lines) ? lines : [];
}

function parseCustomerJsonSnapshot(raw) {
  if (raw == null) return {};
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

async function tryDeliverHtmlViaResend(to, subject, html, text) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  const from =
    process.env.RESEND_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    "Sand 24 <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend ${res.status}: ${errBody}`);
  }
  return true;
}

/** Order / notification emails: Resend if configured, else SMTP (same as OTP). */
async function deliverHtmlEmail(to, subject, html, text) {
  if (!to || !String(to).trim()) return;
  try {
    if (await tryDeliverHtmlViaResend(to, subject, html, text)) return;
  } catch (e) {
    console.error("[Sand24] Resend notification failed, trying SMTP:", e.message);
  }
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim();
  const t = getMailTransport();
  if (!t || !from) {
    console.warn("[Sand24] Order email skipped: configure RESEND_API_KEY or SMTP_USER / SMTP_PASS.");
    return;
  }
  await t.sendMail({
    from: `"Sand 24" <${from}>`,
    to: String(to).trim(),
    subject,
    html,
    text,
  });
}

function buildOrderLinesHtmlTable(lines) {
  const rows = lines
    .map((line) => {
      const title = escapeHtmlEmail(line?.title ?? "Item");
      const qty = escapeHtmlEmail(String(line?.quantity ?? ""));
      const size = escapeHtmlEmail(line?.sizeLabel != null ? String(line.sizeLabel) : "—");
      const lineTotal =
        line?.lineTotal != null
          ? Number(line.lineTotal)
          : (Number(line?.unitPrice) || 0) * (Number(line?.quantity) || 0);
      const total = formatInrEmail(lineTotal);
      return `<tr><td>${title}</td><td style="text-align:center">${qty}</td><td>${size}</td><td style="text-align:right">${total}</td></tr>`;
    })
    .join("");
  return `<table cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #ccc;max-width:560px"><thead><tr style="background:#f5f5f5"><th align="left">Item</th><th>Qty</th><th align="left">Size</th><th align="right">Line total</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildOrderLinesText(lines) {
  return lines
    .map((line, i) => {
      const title = String(line?.title ?? "Item");
      const qty = String(line?.quantity ?? "");
      const size = line?.sizeLabel != null ? String(line.sizeLabel) : "—";
      const lineTotal =
        line?.lineTotal != null
          ? Number(line.lineTotal)
          : (Number(line?.unitPrice) || 0) * (Number(line?.quantity) || 0);
      return `${i + 1}. ${title} — Qty ${qty}, Size ${size}, ${formatInrEmail(lineTotal)}`;
    })
    .join("\n");
}

/**
 * After payment is confirmed (PAID): thank-you + details to customer; short alert to admin.
 * Uses ORDER_ALERT_EMAIL or defaults to naveenreddy.webdev@gmail.com.
 */
async function sendOrderPaidNotificationEmails({
  customerEmail,
  customerName,
  orderId,
  merchantOrderId,
  amountInr,
  lines,
}) {
  const adminTo = process.env.ORDER_ALERT_EMAIL?.trim() || "naveenreddy.webdev@gmail.com";
  const totalStr = formatInrEmail(amountInr);
  const linesArr = coerceOrderLinesArray(lines);
  const linesHtml = linesArr.length ? buildOrderLinesHtmlTable(linesArr) : "<p><em>(No line items)</em></p>";
  const linesText = linesArr.length ? buildOrderLinesText(linesArr) : "(No line items)";

  const greeting = customerName ? `Hi ${escapeHtmlEmail(customerName)},` : "Hi,";
  const greetingPlain = customerName ? `Hi ${customerName},` : "Hi,";

  const userSubject = `Thank you for your order — Sand 24`;
  const userHtml = `
    <p>${greeting}</p>
    <p>Thank you for shopping with Sand 24. Your payment was received and your order is confirmed.</p>
    <p><strong>Order ID:</strong> #${escapeHtmlEmail(orderId)}<br/>
    <strong>Reference:</strong> ${escapeHtmlEmail(merchantOrderId)}<br/>
    <strong>Total:</strong> ${escapeHtmlEmail(totalStr)}</p>
    ${linesHtml}
    <p style="margin-top:16px">Further updates and tracking details will be shared on your <strong>Profile</strong> page (open <strong>Orders</strong> after signing in).</p>
    <p style="color:#666;font-size:13px">If you did not place this order, please contact us immediately.</p>
  `;
  const userText = `${greetingPlain}

Thank you for shopping with Sand 24. Your payment was received and your order is confirmed.

Order ID: #${orderId}
Reference: ${merchantOrderId}
Total: ${totalStr}

${linesText}

Further updates and tracking details will be shared on your Profile page (Orders tab) after you sign in.

If you did not place this order, please contact us immediately.
`;

  const adminSubject = `[Sand24] Order alert — #${orderId} (${totalStr})`;
  const adminHtml = `
    <p><strong>New paid order</strong></p>
    <p>Order #${escapeHtmlEmail(orderId)} · ${escapeHtmlEmail(merchantOrderId)}<br/>
    Customer: ${escapeHtmlEmail(customerEmail)}<br/>
    Total: ${escapeHtmlEmail(totalStr)}</p>
    ${linesHtml}
  `;
  const adminText = `New paid order\nOrder #${orderId} · ${merchantOrderId}\nCustomer: ${customerEmail}\nTotal: ${totalStr}\n\n${linesText}`;

  await deliverHtmlEmail(customerEmail, userSubject, userHtml, userText);
  await deliverHtmlEmail(adminTo, adminSubject, adminHtml, adminText);
}

function queueOrderPaidNotificationEmails(payload) {
  setImmediate(() => {
    sendOrderPaidNotificationEmails(payload).catch((e) =>
      console.error("[Sand24] Order confirmation email:", e.message)
    );
  });
}

function smtpRequiredInProductionResponse(res) {
  return res.status(500).json({
    success: false,
    message:
      "Email is not configured. Set SMTP_USER and SMTP_PASS in backend/.env (see .env.example).",
  });
}

async function storeOtp(userId, purpose, plainCode) {
  const codeHash = hashOtpCode(plainCode, userId, purpose);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await db.query(
    "UPDATE auth_otps SET consumed = 1 WHERE user_id = ? AND purpose = ? AND consumed = 0",
    [userId, purpose]
  );
  await db.query(
    "INSERT INTO auth_otps (user_id, code_hash, purpose, expires_at) VALUES (?, ?, ?, ?)",
    [userId, codeHash, purpose, expiresAt]
  );
}

const BANNED_USER_MESSAGE = "You are not authorised to use Sand 24 products.";

function sendBannedUserResponse(res) {
  res.status(403).json({
    success: false,
    code: "USER_BANNED",
    message: BANNED_USER_MESSAGE,
  });
}

/** Optional: set ADMIN_API_KEY in backend/.env and send X-Admin-Key from the admin UI (VITE_ADMIN_API_KEY). */
function adminApiMiddleware(req, res, next) {
  const key = process.env.ADMIN_API_KEY?.trim();
  if (!key) return next();
  if (req.headers["x-admin-key"] !== key) {
    res.status(403).json({ success: false, message: "Admin access denied." });
    return;
  }
  next();
}

function slugifyBlogTitle(title) {
  const s = String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "post";
}

async function ensureUniqueBlogSlug(base) {
  let slug = String(base).slice(0, 180);
  let n = 0;
  for (;;) {
    const trySlug = n === 0 ? slug : `${slug}-${n}`;
    const [rows] = await db.query("SELECT id FROM blog_posts WHERE slug = ? LIMIT 1", [trySlug]);
    if (!rows.length) return trySlug;
    n += 1;
  }
}

async function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Unauthorized." });
    return;
  }
  try {
    const payload = jwt.verify(h.slice(7), JWT_SECRET);
    const [rows] = await db.query(
      `SELECT id, email, first_name, last_name, email_verified, banned,
       shipping_address_line1, shipping_address_line2, shipping_landmark,
       shipping_state, shipping_district, shipping_city, shipping_pincode
       FROM users WHERE id = ? LIMIT 1`,
      [payload.sub]
    );
    if (!rows.length) {
      res.status(401).json({ success: false, message: "Unauthorized." });
      return;
    }
    if (Number(rows[0].banned) === 1) {
      sendBannedUserResponse(res);
      return;
    }
    req.authUser = rows[0];
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired session." });
  }
}

app.get("/", (_req, res) => {
  res.json({ message: "Fashion backend is running." });
});

app.get("/api/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      message: error.message,
    });
  }
});

/** Public customer auth: register / login require email OTP before JWT is issued. */
app.post("/api/auth/register", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    const firstName = String(req.body?.firstName || "").trim();
    const lastName = String(req.body?.lastName || "").trim();
    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ success: false, message: "All fields are required." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
      return;
    }
    const [existing] = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existing.length) {
      res.status(409).json({ success: false, message: "An account with this email already exists." });
      return;
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [ins] = await db.query(
      "INSERT INTO users (email, password_hash, first_name, last_name, email_verified, banned) VALUES (?, ?, ?, ?, 0, 0)",
      [email, passwordHash, firstName, lastName]
    );
    const userId = ins.insertId;
    const otp = randomSixDigitOtp();
    await storeOtp(userId, "register", otp);
    if (isProduction && !getMailTransport()) {
      smtpRequiredInProductionResponse(res);
      return;
    }
    let devOtpInConsole = false;
    if (!getMailTransport()) {
      printDevOtpBanner(email, otp, "register");
      devOtpInConsole = true;
    } else {
      queueOtpEmail(email, otp, "register");
    }
    res.json({
      success: true,
      message: devOtpInConsole
        ? "SMTP not configured — see the backend terminal for the OTP, or add SMTP_USER / SMTP_PASS to backend/.env."
        : "Verification code sent to your email.",
      nextStep: "verify-otp",
      purpose: "register",
      email,
      devOtpInConsole,
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(500).json({
        success: false,
        message: "Users table missing. Run backend/schema-users.sql on your database.",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Registration failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) {
      res.status(400).json({ success: false, message: "Email and password are required." });
      return;
    }
    const [rows] = await db.query(
      "SELECT id, email, password_hash, first_name, last_name, email_verified, banned FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (!rows.length) {
      res.status(401).json({ success: false, message: "Invalid email or password." });
      return;
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ success: false, message: "Invalid email or password." });
      return;
    }
    if (Number(user.banned) === 1) {
      sendBannedUserResponse(res);
      return;
    }
    /** Sign-in is email + password only. OTP email is used for registration (and password reset), not for login. */
    const token = signUserToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        emailVerified: Boolean(user.email_verified),
      },
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(500).json({
        success: false,
        message: "Users table missing. Run backend/schema-users.sql on your database.",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Login failed." });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      res.status(400).json({ success: false, message: "Email is required." });
      return;
    }
    const [users] = await db.query("SELECT id, banned FROM users WHERE email = ? LIMIT 1", [email]);
    if (!users.length) {
      res.status(404).json({ success: false, message: "No account found with this email." });
      return;
    }
    if (Number(users[0].banned) === 1) {
      sendBannedUserResponse(res);
      return;
    }
    const userId = users[0].id;
    const otp = randomSixDigitOtp();
    try {
      await storeOtp(userId, "password_reset", otp);
    } catch (err) {
      if (err.code === "WARN_DATA_TRUNCATED" || err.errno === 1265 || /password_reset|ENUM|truncated/i.test(String(err.sqlMessage || ""))) {
        res.status(500).json({
          success: false,
          message:
            "Database migration required. Run: mysql ... < backend/schema-auth-password-reset.sql",
        });
        return;
      }
      throw err;
    }
    if (isProduction && !getMailTransport()) {
      smtpRequiredInProductionResponse(res);
      return;
    }
    let devOtpInConsole = false;
    if (!getMailTransport()) {
      printDevOtpBanner(email, otp, "password_reset");
      devOtpInConsole = true;
    } else {
      queueOtpEmail(email, otp, "password_reset");
    }
    res.json({
      success: true,
      message: devOtpInConsole
        ? "SMTP not configured — see the backend terminal for the OTP, or add SMTP_USER / SMTP_PASS to backend/.env."
        : "We sent a verification code to your email.",
      nextStep: "otp",
      email,
      devOtpInConsole,
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(500).json({
        success: false,
        message: "Users table missing. Run backend/schema-users.sql on your database.",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Request failed." });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const code = String(req.body?.otp || "").replace(/\D/g, "");
    const newPassword = String(req.body?.newPassword || "");
    const confirmPassword = String(req.body?.confirmPassword || "");
    if (!email || code.length !== 6) {
      res.status(400).json({ success: false, message: "Email and a 6-digit code are required." });
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: "Passwords do not match." });
      return;
    }
    const [users] = await db.query(
      "SELECT id, email, first_name, last_name, email_verified, banned FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (!users.length) {
      res.status(400).json({ success: false, message: "Invalid code or email." });
      return;
    }
    const user = users[0];
    if (Number(user.banned) === 1) {
      sendBannedUserResponse(res);
      return;
    }
    const [otpRows] = await db.query(
      `SELECT id, code_hash FROM auth_otps
       WHERE user_id = ? AND purpose = ? AND consumed = 0 AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [user.id, "password_reset"]
    );
    if (!otpRows.length) {
      res.status(400).json({ success: false, message: "Code expired or invalid. Request a new code." });
      return;
    }
    const expected = hashOtpCode(code, user.id, "password_reset");
    if (!timingSafeEqualHex(otpRows[0].code_hash, expected)) {
      res.status(400).json({ success: false, message: "Invalid verification code." });
      return;
    }
    await db.query("UPDATE auth_otps SET consumed = 1 WHERE id = ?", [otpRows[0].id]);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, user.id]);
    const token = signUserToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        emailVerified: Boolean(user.email_verified),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Could not reset password." });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (req.body?.purpose !== "register") {
      res.status(400).json({
        success: false,
        message: "Email OTP is only used to complete registration. Sign in with email and password.",
      });
      return;
    }
    const purpose = "register";
    const code = String(req.body?.otp || "").replace(/\D/g, "");
    if (!email || code.length !== 6) {
      res.status(400).json({ success: false, message: "Email and a 6-digit code are required." });
      return;
    }
    const [users] = await db.query(
      "SELECT id, email, first_name, last_name, email_verified, banned FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (!users.length) {
      res.status(400).json({ success: false, message: "Invalid code or email." });
      return;
    }
    const user = users[0];
    if (Number(user.banned) === 1) {
      sendBannedUserResponse(res);
      return;
    }
    const [otpRows] = await db.query(
      `SELECT id, code_hash FROM auth_otps
       WHERE user_id = ? AND purpose = ? AND consumed = 0 AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [user.id, purpose]
    );
    if (!otpRows.length) {
      res.status(400).json({ success: false, message: "Code expired or invalid. Request a new one." });
      return;
    }
    const expected = hashOtpCode(code, user.id, purpose);
    if (!timingSafeEqualHex(otpRows[0].code_hash, expected)) {
      res.status(400).json({ success: false, message: "Invalid verification code." });
      return;
    }
    await db.query("UPDATE auth_otps SET consumed = 1 WHERE id = ?", [otpRows[0].id]);
    await db.query("UPDATE users SET email_verified = 1 WHERE id = ?", [user.id]);
    user.email_verified = 1;
    const token = signUserToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        emailVerified: true,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Verification failed." });
  }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  const u = req.authUser;
  res.json({
    success: true,
    user: {
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      emailVerified: Boolean(u.email_verified),
      shippingAddress: {
        addressLine1: u.shipping_address_line1 ?? "",
        addressLine2: u.shipping_address_line2 ?? "",
        landmark: u.shipping_landmark ?? "",
        state: u.shipping_state ?? "",
        district: u.shipping_district ?? "",
        city: u.shipping_city ?? "",
        pincode: u.shipping_pincode ?? "",
      },
    },
  });
});

app.get("/api/me/addresses", authMiddleware, async (req, res) => {
  try {
    const uid = req.authUser.id;
    const [rows] = await db.query(
      `SELECT id, address_line1, landmark, state, district, city, pincode, created_at, updated_at
       FROM user_addresses WHERE user_id = ? ORDER BY updated_at DESC, id DESC`,
      [uid]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        addressLine1: r.address_line1,
        landmark: r.landmark || "",
        state: r.state,
        district: r.district,
        city: r.city,
        pincode: r.pincode,
      })),
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-user-addresses.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not load addresses." });
  }
});

app.post("/api/me/addresses", authMiddleware, async (req, res) => {
  try {
    const uid = req.authUser.id;
    const addressLine1 = String(req.body?.addressLine1 ?? "").trim();
    const landmarkRaw = String(req.body?.landmark ?? "").trim();
    const landmark = landmarkRaw || null;
    const state = String(req.body?.state ?? "").trim();
    const district = String(req.body?.district ?? "").trim();
    const city = String(req.body?.city ?? "").trim();
    const pincode = String(req.body?.pincode ?? "").trim();

    if (!addressLine1) {
      res.status(400).json({ success: false, message: "Address line 1 is required." });
      return;
    }
    if (!state || !district || !city) {
      res.status(400).json({ success: false, message: "State, district, and city are required." });
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(pincode)) {
      res.status(400).json({ success: false, message: "Enter a valid 6-digit PIN code." });
      return;
    }

    const [ins] = await db.query(
      `INSERT INTO user_addresses (user_id, address_line1, landmark, state, district, city, pincode)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uid, addressLine1, landmark, state, district, city, pincode]
    );
    const newId = ins.insertId;

    await db.query(
      `UPDATE users SET
        shipping_address_line1 = ?,
        shipping_address_line2 = NULL,
        shipping_landmark = ?,
        shipping_state = ?,
        shipping_district = ?,
        shipping_city = ?,
        shipping_pincode = ?
       WHERE id = ?`,
      [addressLine1, landmark, state, district, city, pincode, uid]
    );

    res.json({
      success: true,
      message: "Address saved.",
      data: {
        id: newId,
        addressLine1,
        landmark: landmark || "",
        state,
        district,
        city,
        pincode,
      },
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-user-addresses.sql",
      });
      return;
    }
    if (error.code === "ER_BAD_FIELD_ERROR") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-users-shipping.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not save address." });
  }
});

app.patch("/api/me/shipping-address", authMiddleware, async (req, res) => {
  try {
    const uid = req.authUser.id;

    const userAddressId = Number(req.body?.userAddressId);
    if (Number.isInteger(userAddressId) && userAddressId > 0) {
      const [[row]] = await db.query(
        `SELECT id, address_line1, landmark, state, district, city, pincode
         FROM user_addresses WHERE id = ? AND user_id = ? LIMIT 1`,
        [userAddressId, uid]
      );
      if (!row) {
        res.status(404).json({ success: false, message: "Address not found." });
        return;
      }
      const landmark = row.landmark || null;
      await db.query(
        `UPDATE users SET
          shipping_address_line1 = ?,
          shipping_address_line2 = NULL,
          shipping_landmark = ?,
          shipping_state = ?,
          shipping_district = ?,
          shipping_city = ?,
          shipping_pincode = ?
         WHERE id = ?`,
        [
          row.address_line1,
          landmark,
          row.state,
          row.district,
          row.city,
          row.pincode,
          uid,
        ]
      );
      res.json({
        success: true,
        message: "Delivery address selected.",
        data: {
          userAddressId: row.id,
          shippingAddress: {
            addressLine1: row.address_line1,
            addressLine2: "",
            landmark: row.landmark || "",
            state: row.state,
            district: row.district,
            city: row.city,
            pincode: row.pincode,
          },
        },
      });
      return;
    }

    const addressLine1 = String(req.body?.addressLine1 ?? "").trim();
    const addressLine2Raw = String(req.body?.addressLine2 ?? "").trim();
    const addressLine2 = addressLine2Raw || null;
    const landmarkRaw = String(req.body?.landmark ?? "").trim();
    const landmark = landmarkRaw || null;
    const state = String(req.body?.state ?? "").trim();
    const district = String(req.body?.district ?? "").trim();
    const city = String(req.body?.city ?? "").trim();
    const pincode = String(req.body?.pincode ?? "").trim();

    if (!addressLine1) {
      res.status(400).json({ success: false, message: "Address line 1 is required." });
      return;
    }
    if (!state || !district || !city) {
      res.status(400).json({ success: false, message: "State, district, and city are required." });
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(pincode)) {
      res.status(400).json({ success: false, message: "Enter a valid 6-digit PIN code." });
      return;
    }

    await db.query(
      `UPDATE users SET
        shipping_address_line1 = ?,
        shipping_address_line2 = ?,
        shipping_landmark = ?,
        shipping_state = ?,
        shipping_district = ?,
        shipping_city = ?,
        shipping_pincode = ?
       WHERE id = ?`,
      [addressLine1, addressLine2, landmark, state, district, city, pincode, uid]
    );

    try {
      const [[cntRow]] = await db.query("SELECT COUNT(*) AS n FROM user_addresses WHERE user_id = ?", [uid]);
      if (Number(cntRow?.n) === 0) {
        await db.query(
          `INSERT INTO user_addresses (user_id, address_line1, landmark, state, district, city, pincode)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uid, addressLine1, landmark, state, district, city, pincode]
        );
      }
    } catch (syncErr) {
      if (syncErr.code !== "ER_NO_SUCH_TABLE") {
        throw syncErr;
      }
    }

    res.json({
      success: true,
      message: "Shipping address saved.",
      data: {
        shippingAddress: {
          addressLine1,
          addressLine2: addressLine2 || "",
          landmark: landmark || "",
          state,
          district,
          city,
          pincode,
        },
      },
    });
  } catch (error) {
    if (error.code === "ER_BAD_FIELD_ERROR") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-users-shipping.sql",
      });
      return;
    }
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-user-addresses.sql (and schema-users-shipping.sql if needed).",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not save address." });
  }
});

function newMerchantOrderId(userId) {
  const part = `S${String(userId)}T${Date.now()}${crypto.randomBytes(8).toString("hex")}`;
  return String(part)
    .replace(/[^a-zA-Z0-9_-]/g, "x")
    .slice(0, 63);
}

/** Parse `orders.address_json` whether MySQL returned string, Buffer, or object. */
function parseOrderAddressJson(raw) {
  let o = {};
  if (raw == null) return o;
  if (typeof raw === "object" && !Buffer.isBuffer(raw)) {
    o = raw;
  } else {
    const s = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
    try {
      const p = JSON.parse(s);
      o = typeof p === "object" && p !== null ? p : {};
    } catch {
      return {};
    }
  }
  return {
    addressLine1: o.addressLine1,
    landmark: o.landmark,
    state: o.state,
    district: o.district,
    city: o.city,
    pincode: o.pincode,
  };
}

function formatAddressHover(addr) {
  if (!addr || typeof addr !== "object") return "";
  const parts = [addr.addressLine1, addr.landmark, addr.state, addr.district, addr.city, addr.pincode]
    .map((x) => (x != null ? String(x).trim() : ""))
    .filter(Boolean);
  return parts.join(" · ");
}

/** Admin: list paid order lines with fulfilment row for shipping / delivered views. */
async function buildAdminFulfillmentLineList(stage) {
  const [orders] = await db.query(
    `SELECT o.id, o.merchant_order_id, o.user_id, o.lines_json, o.address_json, o.customer_json, o.created_at,
            u.first_name, u.last_name, u.email AS user_account_email
     FROM orders o
     INNER JOIN users u ON u.id = o.user_id
     WHERE o.status = 'PAID'
     ORDER BY o.id DESC`
  );
  if (!orders.length) return [];

  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map(() => "?").join(",");
  const [fulRows] = await db.query(
    `SELECT id, order_id, line_index, tracking_url, tracking_id, shipped_at, delivered_at
     FROM order_line_fulfillment WHERE order_id IN (${placeholders})`,
    orderIds
  );
  const fMap = new Map();
  for (const f of fulRows) {
    fMap.set(`${f.order_id}_${f.line_index}`, f);
  }

  const out = [];
  for (const o of orders) {
    const lines = coerceOrderLinesArray(o.lines_json);
    const addr = parseOrderAddressJson(o.address_json);
    const cust = parseCustomerJsonSnapshot(o.customer_json);
    const userName =
      [o.first_name, o.last_name].filter(Boolean).join(" ").trim() ||
      [cust.firstName, cust.lastName].filter(Boolean).join(" ").trim() ||
      o.user_account_email;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const f = fMap.get(`${o.id}_${i}`) || null;
      const shippedAt = f?.shipped_at;
      const deliveredAt = f?.delivered_at;

      const isPending = !shippedAt;
      const isShipped = Boolean(shippedAt) && !deliveredAt;
      const isDelivered = Boolean(deliveredAt);

      if (stage === "pending" && !isPending) continue;
      if (stage === "shipped" && !isShipped) continue;
      if (stage === "delivered" && !isDelivered) continue;

      const lineTotal =
        line?.lineTotal != null
          ? Number(line.lineTotal)
          : (Number(line?.unitPrice) || 0) * (Number(line?.quantity) || 0);

      out.push({
        fulfillmentId: f?.id ?? null,
        orderId: o.id,
        lineIndex: i,
        merchantOrderId: o.merchant_order_id,
        userName,
        userEmail: o.user_account_email || "",
        shippingAddress: {
          addressLine1: String(addr.addressLine1 || "").trim(),
          landmark: String(addr.landmark || "").trim(),
          state: String(addr.state || "").trim(),
          district: String(addr.district || "").trim(),
          city: String(addr.city || "").trim(),
          pincode: String(addr.pincode || "").trim(),
        },
        productTitle: String(line?.title || "Product"),
        linePrice: lineTotal,
        orderedAt: o.created_at,
        trackingUrl: f?.tracking_url != null ? String(f.tracking_url) : "",
        trackingId: f?.tracking_id != null ? String(f.tracking_id) : "",
        shippedAt: f?.shipped_at ?? null,
        deliveredAt: f?.delivered_at ?? null,
      });
    }
  }
  return out;
}

/** Never let PhonePe state overflow `orders.phonepe_state` VARCHAR(32). */
function safePhonePeState(pgState) {
  return String(pgState ?? "").slice(0, 32);
}

/**
 * Best-effort: update profile shipping + saved address. Must not throw — payment is already confirmed with PhonePe.
 */
async function persistShippingAfterSuccessfulPayment(uid, address) {
  try {
    const addressLine1 = String(address?.addressLine1 || "").trim();
    const landmark = String(address?.landmark || "").trim() || null;
    const state = String(address?.state || "").trim();
    const district = String(address?.district || "").trim();
    const city = String(address?.city || "").trim();
    const pincode = String(address?.pincode || "").trim();
    if (!addressLine1 || !state || !district || !city || !/^[1-9][0-9]{5}$/.test(pincode)) {
      return;
    }
    await db.query(
      `UPDATE users SET
        shipping_address_line1 = ?,
        shipping_address_line2 = NULL,
        shipping_landmark = ?,
        shipping_state = ?,
        shipping_district = ?,
        shipping_city = ?,
        shipping_pincode = ?
       WHERE id = ?`,
      [addressLine1, landmark, state, district, city, pincode, uid]
    );
    try {
      await db.query(
        `INSERT INTO user_addresses (user_id, address_line1, landmark, state, district, city, pincode) VALUES (?,?,?,?,?,?,?)`,
        [uid, addressLine1, landmark, state, district, city, pincode]
      );
    } catch (e) {
      if (e.code !== "ER_NO_SUCH_TABLE" && e.code !== "ER_DUP_ENTRY") {
        console.error("[persistShipping] user_addresses insert:", e.code, e.message);
      }
    }
  } catch (e) {
    console.error("[persistShipping] users update or address flow:", e.code || "", e.message || e);
  }
}

/**
 * Classify a single PhonePe state string (order-level or payment-attempt-level).
 */
function classifyPgState(stateRaw) {
  const s = String(stateRaw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (!s) return "unknown";

  const paid =
    s === "COMPLETED" ||
    s === "PAYMENT_SUCCESS" ||
    s === "SUCCESS" ||
    s === "SUCCEEDED" ||
    s === "PAID" ||
    s === "PG_ORDER_COMPLETED";
  if (paid) return "paid";

  const failed =
    s === "FAILED" ||
    s === "FAILURE" ||
    s === "PAYMENT_ERROR" ||
    s === "PAYMENT_FAILED" ||
    s === "TRANSACTION_FAILED" ||
    s === "DECLINED" ||
    s === "CANCELLED" ||
    s === "CANCELED" ||
    s === "USER_DROPPED" ||
    s === "DROPPED" ||
    s === "ERRORED" ||
    s === "ERROR" ||
    s === "AUTHORIZATION_FAILED" ||
    s === "AUTHENTICATION_FAILED" ||
    s === "EXPIRED" ||
    s === "EXPIRY" ||
    s === "PAYMENT_EXPIRED" ||
    s === "ORDER_EXPIRED" ||
    s === "SESSION_EXPIRED" ||
    s === "LINK_EXPIRED" ||
    s === "TRANSACTION_EXPIRED" ||
    s === "TIMED_OUT" ||
    s === "TIMEOUT";
  if (failed) return "failed";

  const pending =
    s.includes("PENDING") ||
    s === "CREATED" ||
    s === "INITIATED" ||
    s === "NEW" ||
    s.includes("CHECKOUT") ||
    s === "SUBMITTED";
  if (pending) return "pending";

  return "unknown";
}

/** Non-empty PhonePe / PG error strings usually mean the payment did not succeed. */
function errorCodesLookFailure(...parts) {
  const t = parts
    .filter(Boolean)
    .map((p) => String(p).trim())
    .join(" ")
    .toUpperCase();
  if (!t) return false;
  // Avoid matching benign strings like NO_ERROR; still catch PAYMENT_ERROR, *_FAILED, etc.
  if (/\b(NO_ERROR|SUCCESS|COMPLETED)\b/i.test(t)) return false;
  return /\b(FAIL|FAILED|FAILURE|ERROR|EXPIR|DECLIN|CANCEL|DENY|DENIED|TIMEOUT|INVALID|REJECT|ABORT|DROP)\b/i.test(t);
}

/** Per payment attempt: state + errorCode fields (see PaymentDetail in PG SDK). */
function classifyPaymentAttempt(detail) {
  if (!detail || typeof detail !== "object") return "unknown";
  const state = classifyPgState(detail.state);
  if (state === "failed" || state === "paid") return state;
  if (errorCodesLookFailure(detail.errorCode, detail.detailedErrorCode)) {
    return "failed";
  }
  return state;
}

/**
 * Order-level `state` alone can be misleading; use paymentDetails + errorCode fields.
 * Simulator "Failure" / "Expiry" often set detailedErrorCode or attempt state EXPIRED/FAILED.
 */
function derivePhonePeOutcome(statusResponse) {
  const st = statusResponse || {};
  const orderState = st.state != null ? String(st.state) : "";
  const details = Array.isArray(st.paymentDetails) ? st.paymentDetails : [];
  const sorted = [...details].sort((a, b) => (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0));
  const latest = sorted[0];

  const store = (v) => String(v || "").slice(0, 32);

  const orderClass = classifyPgState(orderState);
  if (errorCodesLookFailure(st.errorCode, st.detailedErrorCode)) {
    return { outcome: "failed", pgState: store(st.errorCode || st.detailedErrorCode || orderState) };
  }

  if (latest) {
    const attempt = classifyPaymentAttempt(latest);
    if (attempt === "failed") {
      return { outcome: "failed", pgState: store(latest.state != null ? String(latest.state) : st.errorCode || "") };
    }
    if (attempt === "paid") {
      return { outcome: "paid", pgState: store(latest.state != null ? String(latest.state) : orderState) };
    }
    if (orderClass === "failed") {
      return { outcome: "failed", pgState: store(orderState) };
    }
    if (orderClass === "paid") {
      return { outcome: "pending", pgState: store(`${orderState}|${latest?.state || ""}`) };
    }
    return { outcome: "pending", pgState: store(latest?.state != null ? String(latest.state) : orderState) };
  }

  if (orderClass === "failed") {
    return { outcome: "failed", pgState: store(orderState) };
  }
  if (orderClass === "paid") {
    return { outcome: "paid", pgState: store(orderState) };
  }
  return { outcome: "pending", pgState: store(orderState) };
}

/** PhonePe Standard Checkout (v2): create pending order + return gateway redirect URL. Address is stored on the order row only until payment succeeds. */
app.post("/api/me/payment/init", authMiddleware, async (req, res) => {
  try {
    if (!phonePe.isPhonePeConfigured()) {
      res.status(503).json({
        success: false,
        message: "PhonePe is not configured. Set PHONEPE_CLIENT_ID and PHONEPE_CLIENT_SECRET in backend/.env",
      });
      return;
    }

    const uid = req.authUser.id;
    const lines = req.body?.lines;
    const orderTotal = Number(req.body?.orderTotal);
    const address = req.body?.address;

    if (!Array.isArray(lines) || lines.length === 0) {
      res.status(400).json({ success: false, message: "Order lines are required." });
      return;
    }
    if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
      res.status(400).json({ success: false, message: "Invalid order total." });
      return;
    }

    const addressLine1 = String(address?.addressLine1 || "").trim();
    const landmark = String(address?.landmark || "").trim() || null;
    const state = String(address?.state || "").trim();
    const district = String(address?.district || "").trim();
    const city = String(address?.city || "").trim();
    const pincode = String(address?.pincode || "").trim();

    if (!addressLine1) {
      res.status(400).json({ success: false, message: "Address line 1 is required." });
      return;
    }
    if (!state || !district || !city) {
      res.status(400).json({ success: false, message: "State, district, and city are required." });
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(pincode)) {
      res.status(400).json({ success: false, message: "Enter a valid 6-digit PIN code." });
      return;
    }

    const amountPaise = Math.round(orderTotal * 100);
    if (amountPaise < 100) {
      res.status(400).json({ success: false, message: "Minimum payable amount is ₹1." });
      return;
    }
    const amountInr = Math.round(orderTotal * 100) / 100;

    const merchantOrderId = newMerchantOrderId(uid);
    const addressJson = {
      addressLine1,
      landmark: landmark || "",
      state,
      district,
      city,
      pincode,
    };
    const customerJson = {
      firstName: req.authUser.first_name,
      lastName: req.authUser.last_name,
      email: req.authUser.email,
    };

    await db.query(
      `INSERT INTO orders (merchant_order_id, user_id, amount_inr, status, lines_json, address_json, customer_json)
       VALUES (?, ?, ?, 'PENDING_PAYMENT', ?, ?, ?)`,
      [merchantOrderId, uid, amountInr, JSON.stringify(lines), JSON.stringify(addressJson), JSON.stringify(customerJson)]
    );

    const frontend = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const redirectUrl = `${frontend}/payment/result?merchantOrderId=${encodeURIComponent(merchantOrderId)}`;

    const checkoutPageUrl = await phonePe.initiateStandardCheckout(
      merchantOrderId,
      amountPaise,
      redirectUrl,
      "Sand24 order payment"
    );

    res.json({
      success: true,
      data: {
        redirectUrl: checkoutPageUrl,
        merchantOrderId,
      },
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-orders.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not start payment." });
  }
});

/** After PhonePe redirect: resolve status, persist profile address only when payment is paid. */
app.get("/api/me/payment/finalize", authMiddleware, async (req, res) => {
  try {
    if (!phonePe.isPhonePeConfigured()) {
      res.status(503).json({
        success: false,
        message: "PhonePe is not configured on the server.",
      });
      return;
    }

    const uid = req.authUser.id;
    const merchantOrderId = String(req.query?.merchantOrderId || "").trim();
    if (!merchantOrderId) {
      res.status(400).json({ success: false, message: "merchantOrderId is required." });
      return;
    }

    const [[order]] = await db.query(
      `SELECT id, user_id, status, address_json, merchant_order_id, amount_inr, lines_json, customer_json
       FROM orders WHERE merchant_order_id = ? AND user_id = ? LIMIT 1`,
      [merchantOrderId, uid]
    );
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found." });
      return;
    }

    if (order.status === "PAID") {
      res.json({
        success: true,
        outcome: "paid",
        orderId: order.id,
        merchantOrderId: order.merchant_order_id,
      });
      return;
    }
    if (order.status === "FAILED") {
      res.json({
        success: true,
        outcome: "failed",
        orderId: order.id,
        merchantOrderId: order.merchant_order_id,
      });
      return;
    }

    let pgState = "";
    let outcome = "pending";
    try {
      const st = await phonePe.fetchOrderStatus(merchantOrderId, true);
      let derived;
      try {
        derived = derivePhonePeOutcome(st);
      } catch (e) {
        console.error("[finalize] derivePhonePeOutcome", e?.message || e);
        derived = { outcome: "pending", pgState: "" };
      }
      outcome = derived.outcome;
      pgState = derived.pgState;
      if (process.env.PHONEPE_DEBUG === "1") {
        const orderStateDbg = st?.state != null ? String(st.state) : "";
        const detailsDbg = Array.isArray(st?.paymentDetails) ? st.paymentDetails : [];
        const latestDbg = [...detailsDbg].sort((a, b) => (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0))[0];
        console.log("[PhonePe finalize]", {
          merchantOrderId,
          orderState: orderStateDbg,
          orderErrorCode: st?.errorCode,
          orderDetailedErrorCode: st?.detailedErrorCode,
          latestAttemptState: latestDbg?.state,
          latestAttemptErrorCode: latestDbg?.errorCode,
          outcome,
          pgState,
        });
      }
    } catch (e) {
      res.status(502).json({
        success: false,
        message: e?.message || "Could not fetch payment status from PhonePe.",
      });
      return;
    }

    if (outcome === "paid") {
      const addr = parseOrderAddressJson(order.address_json);
      await persistShippingAfterSuccessfulPayment(uid, addr);
      const pgSafe = safePhonePeState(pgState);
      await db.query(`UPDATE orders SET status = 'PAID', phonepe_state = ? WHERE id = ?`, [pgSafe, order.id]);
      const cust = parseCustomerJsonSnapshot(order.customer_json);
      const nameParts = [cust.firstName, cust.lastName].filter(Boolean);
      queueOrderPaidNotificationEmails({
        customerEmail: String(cust.email || req.authUser?.email || "").trim(),
        customerName: nameParts.length ? nameParts.join(" ") : "",
        orderId: order.id,
        merchantOrderId: order.merchant_order_id,
        amountInr: order.amount_inr,
        lines: order.lines_json,
      });
      res.json({
        success: true,
        outcome: "paid",
        orderId: order.id,
        merchantOrderId: order.merchant_order_id,
      });
      return;
    }

    if (outcome === "failed") {
      await db.query(`UPDATE orders SET status = 'FAILED', phonepe_state = ? WHERE id = ?`, [
        safePhonePeState(pgState),
        order.id,
      ]);
      res.json({
        success: true,
        outcome: "failed",
        orderId: order.id,
        merchantOrderId: order.merchant_order_id,
      });
      return;
    }

    await db.query(`UPDATE orders SET status = 'PENDING', phonepe_state = ? WHERE id = ?`, [
      safePhonePeState(pgState),
      order.id,
    ]);
    res.json({
      success: true,
      outcome: "pending",
      orderId: order.id,
      merchantOrderId: order.merchant_order_id,
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-orders.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not finalize payment." });
  }
});

/** List current user's orders with line items (for account / orders tab). */
app.get("/api/me/orders", authMiddleware, async (req, res) => {
  try {
    const uid = req.authUser.id;
    const [rows] = await db.query(
      `SELECT id, merchant_order_id, status, amount_inr, lines_json, created_at, updated_at
       FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 100`,
      [uid]
    );

    let fulfillmentByOrder = new Map();
    if (rows.length) {
      try {
        const ids = rows.map((r) => r.id);
        const [fulRows] = await db.query(
          `SELECT order_id, line_index, shipped_at, delivered_at
           FROM order_line_fulfillment WHERE order_id IN (?)`,
          [ids]
        );
        for (const fr of fulRows) {
          const oid = fr.order_id;
          if (!fulfillmentByOrder.has(oid)) fulfillmentByOrder.set(oid, []);
          fulfillmentByOrder.get(oid).push({
            lineIndex: Number(fr.line_index),
            shippedAt: fr.shipped_at,
            deliveredAt: fr.delivered_at,
          });
        }
      } catch (e) {
        if (e.code === "ER_NO_SUCH_TABLE") {
          fulfillmentByOrder = new Map();
        } else {
          throw e;
        }
      }
    }

    const data = rows.map((row) => {
      let lines = row.lines_json;
      if (typeof lines === "string") {
        try {
          lines = JSON.parse(lines);
        } catch {
          lines = [];
        }
      }
      if (!Array.isArray(lines)) lines = [];
      const flines = fulfillmentByOrder.get(row.id) || [];
      const fMap = new Map(flines.map((f) => [f.lineIndex, f]));
      const lineFulfillment = lines.map((_, idx) => {
        const f = fMap.get(idx);
        return {
          lineIndex: idx,
          shippedAt: f?.shippedAt ?? null,
          deliveredAt: f?.deliveredAt ?? null,
        };
      });
      return {
        id: row.id,
        merchantOrderId: row.merchant_order_id,
        status: row.status,
        amountInr: Number(row.amount_inr) || 0,
        lines,
        lineFulfillment,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
    res.json({ success: true, data });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-orders.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not load orders." });
  }
});

const QUERY_CATEGORY_LABELS = {
  purchase_problem: "Facing problem while purchasing",
  payment_deducted_no_order: "Money got deducted but order not placed",
  bulk_order_request: "Request bulk orders facility",
  custom: "Custom query",
};

function normalizeQueryCategory(input) {
  const k = String(input || "").trim();
  return Object.prototype.hasOwnProperty.call(QUERY_CATEGORY_LABELS, k) ? k : null;
}

function mapCustomerQueryRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    mobile: r.mobile,
    category: r.category,
    categoryLabel: QUERY_CATEGORY_LABELS[r.category] || r.category,
    message: r.message,
    adminNote: r.admin_note || "",
    contacted: r.contacted,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapContactRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    message: r.message,
    adminNote: r.admin_note || "",
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Public: site contact form (no login). */
app.post("/api/contact", async (req, res) => {
  try {
    const fullName = String(req.body?.fullName ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const message = String(req.body?.message ?? "").trim();
    if (!fullName || fullName.length > 255) {
      res.status(400).json({ success: false, message: "Please enter your full name." });
      return;
    }
    if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, message: "Please enter a valid email address." });
      return;
    }
    if (!message || message.length > 8000) {
      res.status(400).json({
        success: false,
        message: "Please enter a message (up to 8000 characters).",
      });
      return;
    }
    const [result] = await db.query(
      `INSERT INTO contacts (full_name, email, message) VALUES (?, ?, ?)`,
      [fullName, email, message]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-contacts.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not send your message." });
  }
});

/** Logged-in customer: raise and list support queries. */
app.get("/api/me/queries", authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM customer_queries WHERE user_id = ? ORDER BY id DESC LIMIT 200`,
      [req.authUser.id]
    );
    res.json({ success: true, data: rows.map(mapCustomerQueryRow) });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-customer-queries.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not load queries." });
  }
});

app.post("/api/me/queries", authMiddleware, async (req, res) => {
  try {
    const uid = req.authUser.id;
    const firstName = String(req.body?.firstName ?? "").trim().slice(0, 120);
    const lastName = String(req.body?.lastName ?? "").trim().slice(0, 120);
    const email = String(req.body?.email ?? "").trim().slice(0, 255);
    const mobile = String(req.body?.mobile ?? "").replace(/\D/g, "").slice(0, 15);
    const category = normalizeQueryCategory(req.body?.category);
    const message = String(req.body?.message ?? "").trim().slice(0, 8000);
    if (!firstName || !lastName || !email || !mobile) {
      res.status(400).json({ success: false, message: "First name, last name, email and mobile are required." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, message: "Invalid email address." });
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      res.status(400).json({ success: false, message: "Enter a valid 10-digit Indian mobile number." });
      return;
    }
    if (!category) {
      res.status(400).json({ success: false, message: "Please select a query type." });
      return;
    }
    if (category === "custom" && message.length < 4) {
      res.status(400).json({
        success: false,
        message: "Please enter your message (at least 4 characters) for a custom query.",
      });
      return;
    }
    const msgToSave = category === "custom" ? message : message || "—";

    const [ins] = await db.query(
      `INSERT INTO customer_queries (user_id, first_name, last_name, email, mobile, category, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uid, firstName, lastName, email, mobile, category, msgToSave]
    );
    const id = ins.insertId;
    const [[row]] = await db.query(`SELECT * FROM customer_queries WHERE id = ?`, [id]);
    res.json({ success: true, data: mapCustomerQueryRow(row) });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-customer-queries.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not save query." });
  }
});

/** Logged-in customer: cart + wishlist counts (header badges). */
app.get("/api/me/shop-summary", authMiddleware, async (req, res) => {
  try {
    const uid = req.authUser.id;
    const [[cartRow]] = await db.query(
      "SELECT COALESCE(SUM(quantity), 0) AS q FROM cart_items WHERE user_id = ?",
      [uid]
    );
    const [[wishRow]] = await db.query(
      "SELECT COUNT(*) AS c FROM wishlist_items WHERE user_id = ?",
      [uid]
    );
    res.json({
      success: true,
      data: {
        cartQuantity: Number(cartRow?.q) || 0,
        wishlistCount: Number(wishRow?.c) || 0,
      },
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-cart-wishlist.sql",
        error: error.message,
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Failed to load summary." });
  }
});

app.get("/api/me/cart", authMiddleware, async (req, res) => {
  try {
    const uid = req.authUser.id;
    const [rows] = await db.query(
      `SELECT c.id, c.product_id, c.quantity, c.size_label, p.title, p.final_price, p.original_price, p.offer_percent
       FROM cart_items c
       INNER JOIN products p ON p.id = c.product_id
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC`,
      [uid]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        productId: r.product_id,
        quantity: Number(r.quantity) || 0,
        sizeLabel: r.size_label || "",
        title: r.title,
        finalPrice: Number(r.final_price),
        originalPrice: Number(r.original_price),
        offerPercent: Number(r.offer_percent),
      })),
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-cart-wishlist.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Failed to load cart." });
  }
});

app.post("/api/me/cart", authMiddleware, async (req, res) => {
  try {
    const uid = req.authUser.id;
    const productId = Number(req.body?.productId);
    let quantity = Number(req.body?.quantity);
    const sizeLabel = String(req.body?.sizeLabel ?? "").trim().slice(0, 64);
    if (!Number.isInteger(productId) || productId < 1) {
      res.status(400).json({ success: false, message: "Invalid product." });
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;

    const [prows] = await db.query(
      "SELECT id, quantity_available FROM products WHERE id = ? LIMIT 1",
      [productId]
    );
    if (!prows.length) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }
    const stock = Number(prows[0].quantity_available) || 0;
    if (stock < 1) {
      res.status(400).json({ success: false, message: "Product is out of stock." });
      return;
    }

    const [[existing]] = await db.query(
      "SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND size_label = ? LIMIT 1",
      [uid, productId, sizeLabel]
    );

    if (existing) {
      const [[cartRow]] = await db.query(
        "SELECT COALESCE(SUM(quantity), 0) AS q FROM cart_items WHERE user_id = ?",
        [uid]
      );
      res.json({
        success: true,
        alreadyInCart: true,
        message: "This item is already in your cart.",
        cartQuantity: Number(cartRow?.q) || 0,
      });
      return;
    }

    let newQty = quantity;
    if (newQty > stock) newQty = stock;

    await db.query(
      "INSERT INTO cart_items (user_id, product_id, quantity, size_label) VALUES (?, ?, ?, ?)",
      [uid, productId, newQty, sizeLabel]
    );

    const [[cartRow]] = await db.query(
      "SELECT COALESCE(SUM(quantity), 0) AS q FROM cart_items WHERE user_id = ?",
      [uid]
    );
    res.json({
      success: true,
      message: "Added to cart.",
      cartQuantity: Number(cartRow?.q) || 0,
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-cart-wishlist.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not update cart." });
  }
});

app.patch("/api/me/cart/items/:itemId", authMiddleware, async (req, res) => {
  try {
    const uid = req.authUser.id;
    const itemId = Number(req.params.itemId);
    let quantity = Number(req.body?.quantity);
    if (!Number.isInteger(itemId) || itemId < 1) {
      res.status(400).json({ success: false, message: "Invalid item." });
      return;
    }
    if (!Number.isFinite(quantity)) {
      res.status(400).json({ success: false, message: "Invalid quantity." });
      return;
    }

    const [[line]] = await db.query(
      "SELECT id, product_id FROM cart_items WHERE id = ? AND user_id = ? LIMIT 1",
      [itemId, uid]
    );
    if (!line) {
      res.status(404).json({ success: false, message: "Cart line not found." });
      return;
    }

    if (quantity <= 0) {
      await db.query("DELETE FROM cart_items WHERE id = ? AND user_id = ?", [itemId, uid]);
      const [[cartRow]] = await db.query(
        "SELECT COALESCE(SUM(quantity), 0) AS q FROM cart_items WHERE user_id = ?",
        [uid]
      );
      res.json({ success: true, deleted: true, cartQuantity: Number(cartRow?.q) || 0 });
      return;
    }

    const [prows] = await db.query(
      "SELECT quantity_available FROM products WHERE id = ? LIMIT 1",
      [line.product_id]
    );
    const stock = Number(prows[0]?.quantity_available) || 0;
    if (stock < 1) {
      res.status(400).json({ success: false, message: "Product is out of stock." });
      return;
    }
    const newQty = Math.min(Math.max(1, Math.floor(quantity)), stock);

    await db.query("UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?", [
      newQty,
      itemId,
      uid,
    ]);
    const [[cartRow]] = await db.query(
      "SELECT COALESCE(SUM(quantity), 0) AS q FROM cart_items WHERE user_id = ?",
      [uid]
    );
    res.json({
      success: true,
      quantity: newQty,
      cartQuantity: Number(cartRow?.q) || 0,
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-cart-wishlist.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not update cart line." });
  }
});

app.delete("/api/me/cart/items/:itemId", authMiddleware, async (req, res) => {
  try {
    const uid = req.authUser.id;
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(itemId) || itemId < 1) {
      res.status(400).json({ success: false, message: "Invalid item." });
      return;
    }
    const [r] = await db.query("DELETE FROM cart_items WHERE id = ? AND user_id = ?", [itemId, uid]);
    if (!r.affectedRows) {
      res.status(404).json({ success: false, message: "Cart line not found." });
      return;
    }
    const [[cartRow]] = await db.query(
      "SELECT COALESCE(SUM(quantity), 0) AS q FROM cart_items WHERE user_id = ?",
      [uid]
    );
    res.json({ success: true, cartQuantity: Number(cartRow?.q) || 0 });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-cart-wishlist.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not remove item." });
  }
});

app.get("/api/me/wishlist", authMiddleware, async (req, res) => {
  try {
    const uid = req.authUser.id;
    const [rows] = await db.query(
      `SELECT w.product_id, p.title, p.final_price, p.original_price, p.offer_percent
       FROM wishlist_items w
       INNER JOIN products p ON p.id = w.product_id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC`,
      [uid]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        productId: r.product_id,
        title: r.title,
        finalPrice: Number(r.final_price),
        originalPrice: Number(r.original_price),
        offerPercent: Number(r.offer_percent),
      })),
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-cart-wishlist.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Failed to load wishlist." });
  }
});

app.post("/api/me/wishlist", authMiddleware, async (req, res) => {
  try {
    const uid = req.authUser.id;
    const productId = Number(req.body?.productId);
    if (!Number.isInteger(productId) || productId < 1) {
      res.status(400).json({ success: false, message: "Invalid product." });
      return;
    }
    const [prows] = await db.query("SELECT id FROM products WHERE id = ? LIMIT 1", [productId]);
    if (!prows.length) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }
    const [ins] = await db.query(
      "INSERT IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)",
      [uid, productId]
    );
    const [[wishRow]] = await db.query(
      "SELECT COUNT(*) AS c FROM wishlist_items WHERE user_id = ?",
      [uid]
    );
    res.json({
      success: true,
      wishlistCount: Number(wishRow?.c) || 0,
      alreadyHad: ins.affectedRows === 0,
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-cart-wishlist.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not update wishlist." });
  }
});

app.delete("/api/me/wishlist/:productId", authMiddleware, async (req, res) => {
  try {
    const uid = req.authUser.id;
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId < 1) {
      res.status(400).json({ success: false, message: "Invalid product." });
      return;
    }
    await db.query("DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?", [uid, productId]);
    const [[wishRow]] = await db.query(
      "SELECT COUNT(*) AS c FROM wishlist_items WHERE user_id = ?",
      [uid]
    );
    res.json({ success: true, wishlistCount: Number(wishRow?.c) || 0 });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-cart-wishlist.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Could not remove from wishlist." });
  }
});

app.get("/api/admin/users", adminApiMiddleware, async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, first_name, last_name, email, created_at, banned
       FROM users
       ORDER BY created_at DESC`
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        firstName: r.first_name || "",
        lastName: r.last_name || "",
        email: r.email,
        createdAt: r.created_at,
        banned: Number(r.banned) === 1,
      })),
    });
  } catch (error) {
    if (error.code === "ER_BAD_FIELD_ERROR" && String(error.sqlMessage || "").includes("banned")) {
      res.status(500).json({
        success: false,
        message: "Run database migration: mysql ... < backend/schema-users-ban.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Failed to load users." });
  }
});

app.post("/api/admin/users/:id/ban", adminApiMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      res.status(400).json({ success: false, message: "Invalid user id." });
      return;
    }
    const banned = Boolean(req.body?.banned);
    const [r] = await db.query("UPDATE users SET banned = ? WHERE id = ?", [banned ? 1 : 0, id]);
    if (!r.affectedRows) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }
    res.json({ success: true, banned });
  } catch (error) {
    if (error.code === "ER_BAD_FIELD_ERROR" && String(error.sqlMessage || "").includes("banned")) {
      res.status(500).json({
        success: false,
        message: "Run database migration: mysql ... < backend/schema-users-ban.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Update failed." });
  }
});

/** Admin: customer support queries (list + update note / contacted / status). */
app.get("/api/admin/queries", adminApiMiddleware, async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT q.*, u.email AS user_account_email
       FROM customer_queries q
       INNER JOIN users u ON u.id = q.user_id
       ORDER BY q.id DESC
       LIMIT 500`
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        ...mapCustomerQueryRow(r),
        userAccountEmail: r.user_account_email || "",
      })),
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-customer-queries.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Failed to load queries." });
  }
});

app.patch("/api/admin/queries/:id", adminApiMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      res.status(400).json({ success: false, message: "Invalid query id." });
      return;
    }
    const updates = [];
    const vals = [];
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "adminNote")) {
      const adminNote = String(req.body.adminNote ?? "").trim().slice(0, 8000);
      updates.push("admin_note = ?");
      vals.push(adminNote || null);
    }
    if (req.body?.contacted === "contacted" || req.body?.contacted === "not_contacted") {
      updates.push("contacted = ?");
      vals.push(req.body.contacted);
    }
    if (req.body?.status === "pending" || req.body?.status === "completed") {
      updates.push("status = ?");
      vals.push(req.body.status);
    }
    if (!updates.length) {
      res.status(400).json({ success: false, message: "Nothing to update (adminNote, contacted, or status)." });
      return;
    }
    vals.push(id);
    const [r] = await db.query(`UPDATE customer_queries SET ${updates.join(", ")} WHERE id = ?`, vals);
    if (!r.affectedRows) {
      res.status(404).json({ success: false, message: "Query not found." });
      return;
    }
    const [[row]] = await db.query(`SELECT * FROM customer_queries WHERE id = ?`, [id]);
    res.json({ success: true, data: mapCustomerQueryRow(row) });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-customer-queries.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Update failed." });
  }
});

/** Admin: Get in Touch / contact form submissions. */
app.get("/api/admin/contacts", adminApiMiddleware, async (_req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM contacts ORDER BY id DESC LIMIT 500`);
    res.json({ success: true, data: rows.map(mapContactRow) });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-contacts.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Failed to load contact messages." });
  }
});

app.patch("/api/admin/contacts/:id", adminApiMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      res.status(400).json({ success: false, message: "Invalid contact id." });
      return;
    }
    const updates = [];
    const vals = [];
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "adminNote")) {
      const adminNote = String(req.body.adminNote ?? "").trim().slice(0, 8000);
      updates.push("admin_note = ?");
      vals.push(adminNote || null);
    }
    if (req.body?.status === "pending" || req.body?.status === "completed") {
      updates.push("status = ?");
      vals.push(req.body.status);
    }
    if (!updates.length) {
      res.status(400).json({ success: false, message: "Nothing to update (adminNote or status)." });
      return;
    }
    vals.push(id);
    const [r] = await db.query(`UPDATE contacts SET ${updates.join(", ")} WHERE id = ?`, vals);
    if (!r.affectedRows) {
      res.status(404).json({ success: false, message: "Contact entry not found." });
      return;
    }
    const [[row]] = await db.query(`SELECT * FROM contacts WHERE id = ?`, [id]);
    res.json({ success: true, data: mapContactRow(row) });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-contacts.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Update failed." });
  }
});

/** Admin: order lines for fulfilment (pending = paid, not shipped yet; shipped; delivered). */
app.get("/api/admin/orders/fulfillment-lines", adminApiMiddleware, async (req, res) => {
  const stage = String(req.query.stage || "pending").toLowerCase();
  if (!["pending", "shipped", "delivered"].includes(stage)) {
    res.status(400).json({ success: false, message: "Invalid stage." });
    return;
  }
  try {
    const data = await buildAdminFulfillmentLineList(stage);
    res.json({ success: true, data });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-order-line-fulfillment.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Failed to load orders." });
  }
});

app.post("/api/admin/orders/fulfillment/update-shipping", adminApiMiddleware, async (req, res) => {
  try {
    const orderId = Number(req.body?.orderId);
    const lineIndex = Number(req.body?.lineIndex);
    const trackingUrl = String(req.body?.trackingUrl ?? "").trim().slice(0, 512);
    const trackingId = String(req.body?.trackingId ?? "").trim().slice(0, 128);
    if (!Number.isFinite(orderId) || orderId < 1 || !Number.isFinite(lineIndex) || lineIndex < 0) {
      res.status(400).json({ success: false, message: "Invalid order or line index." });
      return;
    }
    const [[o]] = await db.query(`SELECT id, status, lines_json FROM orders WHERE id = ? LIMIT 1`, [orderId]);
    if (!o || o.status !== "PAID") {
      res.status(400).json({ success: false, message: "Order not found or not paid." });
      return;
    }
    const lines = coerceOrderLinesArray(o.lines_json);
    if (lineIndex >= lines.length) {
      res.status(400).json({ success: false, message: "Invalid line index for this order." });
      return;
    }
    await db.query(
      `INSERT INTO order_line_fulfillment (order_id, line_index, tracking_url, tracking_id, shipped_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE tracking_url = VALUES(tracking_url), tracking_id = VALUES(tracking_id), shipped_at = NOW()`,
      [orderId, lineIndex, trackingUrl || null, trackingId || null]
    );
    res.json({ success: true });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-order-line-fulfillment.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Update failed." });
  }
});

app.post("/api/admin/orders/fulfillment/mark-delivered", adminApiMiddleware, async (req, res) => {
  try {
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: "No items selected." });
      return;
    }
    for (const it of items) {
      const orderId = Number(it?.orderId);
      const lineIndex = Number(it?.lineIndex);
      if (!Number.isFinite(orderId) || orderId < 1 || !Number.isFinite(lineIndex) || lineIndex < 0) {
        res.status(400).json({ success: false, message: "Invalid order or line in list." });
        return;
      }
    }
    for (const it of items) {
      const orderId = Number(it.orderId);
      const lineIndex = Number(it.lineIndex);
      const [r] = await db.query(
        `UPDATE order_line_fulfillment SET delivered_at = NOW()
         WHERE order_id = ? AND line_index = ? AND shipped_at IS NOT NULL AND delivered_at IS NULL`,
        [orderId, lineIndex]
      );
      if (!r.affectedRows) {
        res.status(400).json({
          success: false,
          message: `Could not mark delivered for order ${orderId} line ${lineIndex}.`,
        });
        return;
      }
    }
    res.json({ success: true });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Run: mysql ... < backend/schema-order-line-fulfillment.sql",
      });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Update failed." });
  }
});

app.get("/api/background-image", async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, page_key, image_name, image_mime, is_active, updated_at
       FROM website_background
       ORDER BY updated_at DESC`
    );

    const data = rows.map((row) => ({
      id: row.id,
      pageKey: row.page_key,
      imageName: row.image_name,
      imageMime: row.image_mime,
      isActive: Boolean(row.is_active),
      updatedAt: row.updated_at,
      previewUrl: `/api/background-image/${row.id}/preview`,
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load background images.",
      error: error.message,
    });
  }
});

app.get("/api/background-image/:id/preview", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT image_mime, image_data FROM website_background WHERE id = ?",
      [id]
    );

    if (!rows.length) {
      res.status(404).json({ success: false, message: "Image not found." });
      return;
    }

    res.set("Content-Type", rows[0].image_mime || "application/octet-stream");
    res.send(rows[0].image_data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load preview image.",
      error: error.message,
    });
  }
});

app.post("/api/background-image", upload.single("image"), async (req, res) => {
  try {
    const pageKey = req.body.pageKey || "global";
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, message: "Image file is required." });
      return;
    }

    await db.query(
      `INSERT INTO website_background
        (page_key, image_name, image_mime, image_data, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
        image_name = VALUES(image_name),
        image_mime = VALUES(image_mime),
        image_data = VALUES(image_data),
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP`,
      [pageKey, file.originalname, file.mimetype, file.buffer]
    );

    res.json({ success: true, message: "Background image saved successfully." });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to save background image.",
      error: error.message,
    });
  }
});

app.get("/api/home-hero-image", async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, section_key, image_name, image_mime, is_active, updated_at
       FROM home_hero_image
       ORDER BY updated_at DESC`
    );

    const data = rows.map((row) => ({
      id: row.id,
      sectionKey: row.section_key,
      imageName: row.image_name,
      imageMime: row.image_mime,
      isActive: Boolean(row.is_active),
      updatedAt: row.updated_at,
      previewUrl: `/api/home-hero-image/${row.id}/preview`,
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load hero images.",
      error: error.message,
    });
  }
});

app.get("/api/home-hero-image/:id/preview", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT image_mime, image_data FROM home_hero_image WHERE id = ?",
      [id]
    );

    if (!rows.length) {
      res.status(404).json({ success: false, message: "Hero image not found." });
      return;
    }

    res.set("Content-Type", rows[0].image_mime || "application/octet-stream");
    res.send(rows[0].image_data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load hero preview image.",
      error: error.message,
    });
  }
});

app.post("/api/home-hero-image", upload.single("image"), async (req, res) => {
  try {
    const sectionKey = req.body.sectionKey || "hero_main";
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, message: "Hero image file is required." });
      return;
    }

    await db.query(
      `INSERT INTO home_hero_image
        (section_key, image_name, image_mime, image_data, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
        image_name = VALUES(image_name),
        image_mime = VALUES(image_mime),
        image_data = VALUES(image_data),
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP`,
      [sectionKey, file.originalname, file.mimetype, file.buffer]
    );

    res.json({ success: true, message: "Hero image saved successfully." });
  } catch (error) {
    const isPacketLimitError =
      error.code === "ER_NET_PACKET_TOO_LARGE" ||
      /max_allowed_packet/i.test(error.message);

    res.status(500).json({
      success: false,
      message: isPacketLimitError
        ? "Upload failed: MySQL packet limit too small. Increase max_allowed_packet or use a smaller image."
        : "Failed to save hero image.",
      error: error.message,
    });
  }
});

app.get("/api/home-trending-content", async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, section_key, heading, tag_line, button_link, updated_at
       FROM home_trending_content
       ORDER BY updated_at DESC`
    );

    const data = rows.map((row) => ({
      id: row.id,
      sectionKey: row.section_key,
      heading: row.heading,
      tagLine: row.tag_line,
      buttonLink: row.button_link,
      updatedAt: row.updated_at,
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load trending section content.",
      error: error.message,
    });
  }
});

app.post("/api/home-trending-content", async (req, res) => {
  try {
    const sectionKey = req.body.sectionKey || "trending_main";
    const heading = (req.body.heading || "").trim();
    const tagLine = (req.body.tagLine || "").trim();
    const buttonLink = (req.body.buttonLink || "").trim();

    if (!heading || !tagLine || !buttonLink) {
      res.status(400).json({
        success: false,
        message: "Heading, secondary heading and button link are required.",
      });
      return;
    }

    await db.query(
      `INSERT INTO home_trending_content
        (section_key, heading, tag_line, button_link)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        heading = VALUES(heading),
        tag_line = VALUES(tag_line),
        button_link = VALUES(button_link),
        updated_at = CURRENT_TIMESTAMP`,
      [sectionKey, heading, tagLine, buttonLink]
    );

    res.json({ success: true, message: "Trending section saved successfully." });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to save trending section content.",
      error: error.message,
    });
  }
});

app.get("/api/home-story-content", async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, section_key, heading, cards_json, updated_at
       FROM home_story_content
       ORDER BY updated_at DESC`
    );

    const data = rows.map((row) => ({
      id: row.id,
      sectionKey: row.section_key,
      heading: row.heading,
      cards: JSON.parse(row.cards_json || "[]"),
      updatedAt: row.updated_at,
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load story section content.",
      error: error.message,
    });
  }
});

app.post("/api/home-story-content", async (req, res) => {
  try {
    const sectionKey = req.body.sectionKey || "story_main";
    const heading = (req.body.heading || "").trim();
    const cards = Array.isArray(req.body.cards) ? req.body.cards : [];

    if (!heading || cards.length !== 3) {
      res.status(400).json({
        success: false,
        message: "Heading and exactly 3 cards are required.",
      });
      return;
    }

    const sanitizedCards = cards.map((card) => ({
      imageUrl: (card.imageUrl || "").trim(),
      title: (card.title || "").trim(),
      description: (card.description || "").trim(),
    }));

    const hasInvalidCard = sanitizedCards.some(
      (card) => !card.imageUrl || !card.title || !card.description
    );

    if (hasInvalidCard) {
      res.status(400).json({
        success: false,
        message: "Each card must include image URL, title, and description.",
      });
      return;
    }

    await db.query(
      `INSERT INTO home_story_content
        (section_key, heading, cards_json)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
        heading = VALUES(heading),
        cards_json = VALUES(cards_json),
        updated_at = CURRENT_TIMESTAMP`,
      [sectionKey, heading, JSON.stringify(sanitizedCards)]
    );

    res.json({ success: true, message: "Story section saved successfully." });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to save story section content.",
      error: error.message,
    });
  }
});

const AUDIENCE_VALUES = ["for_him", "for_her", "kids"];

app.get("/api/categories", async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, audience, name, product_count, created_at, updated_at
       FROM categories
       ORDER BY created_at DESC`
    );

    const audienceLabel = {
      for_him: "For Him",
      for_her: "For Her",
      kids: "Kids",
    };

    const data = rows.map((row) => ({
      id: row.id,
      audience: row.audience,
      audienceLabel: audienceLabel[row.audience] || row.audience,
      name: row.name,
      productCount: Number(row.product_count) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load categories.",
      error: error.message,
    });
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const audience = (req.body.audience || "").trim();
    const name = (req.body.name || "").trim();

    if (!AUDIENCE_VALUES.includes(audience)) {
      res.status(400).json({
        success: false,
        message: "Audience must be for_him, for_her, or kids.",
      });
      return;
    }

    if (!name) {
      res.status(400).json({ success: false, message: "Category name is required." });
      return;
    }

    await db.query(
      `INSERT INTO categories (audience, name, product_count) VALUES (?, ?, 0)`,
      [audience, name]
    );

    res.json({ success: true, message: "Category created successfully." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        success: false,
        message: "A category with this name already exists for that audience.",
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Failed to create category.",
      error: error.message,
    });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const name = (req.body.name || "").trim();

    if (!name) {
      res.status(400).json({ success: false, message: "Category name is required." });
      return;
    }

    const [result] = await db.query(
      "UPDATE categories SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [name, id]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: "Category not found." });
      return;
    }

    res.json({ success: true, message: "Category updated successfully." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        success: false,
        message: "A category with this name already exists for that audience.",
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Failed to update category.",
      error: error.message,
    });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query("DELETE FROM categories WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: "Category not found." });
      return;
    }

    res.json({ success: true, message: "Category deleted successfully." });
  } catch (error) {
    const fkBlocked =
      error.errno === 1451 ||
      error.code === "ER_ROW_IS_REFERENCED" ||
      error.code === "ER_ROW_IS_REFERENCED_2" ||
      String(error.sqlMessage || "").toLowerCase().includes("foreign key constraint");
    if (fkBlocked) {
      res.status(409).json({
        success: false,
        message:
          "Cannot delete this category while products are assigned to it. Move or delete those products first.",
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Failed to delete category.",
      error: error.message,
    });
  }
});

const PRODUCT_SIZE_OPTIONS = ["S", "M", "L", "XL"];

function computeFinalPrice(originalPrice, offerPercent) {
  const o = Number(originalPrice);
  const p = Number(offerPercent);
  if (!Number.isFinite(o) || o < 0) return null;
  if (!Number.isFinite(p) || p < 0 || p > 100) return null;
  return Math.round((o * (100 - p)) / 100 * 100) / 100;
}

/** Which image slots 1–4 have data (from nullable mime columns). */
function imageSlotsFromProductRow(row) {
  const slots = [];
  for (let i = 1; i <= 4; i++) {
    const m = row[`image_${i}_mime`];
    if (m != null && String(m).trim() !== "") slots.push(i);
  }
  return slots;
}

const productImageUpload = uploadProduct.fields([
  { name: "image1", maxCount: 1 },
  { name: "image2", maxCount: 1 },
  { name: "image3", maxCount: 1 },
  { name: "image4", maxCount: 1 },
]);

function uploadMime(file) {
  if (!file) return "application/octet-stream";
  return file.mimetype || file.mimeType || "application/octet-stream";
}

const AUDIENCE_LABEL = {
  for_him: "For Him",
  for_her: "For Her",
  kids: "Kids",
};

function parseProductFields(req) {
  const categoryId = Number(req.body.categoryId);
  const title = (req.body.title || "").trim();
  const originalPrice = Number(req.body.originalPrice);
  const offerPercent =
    req.body.offerPercent === "" || req.body.offerPercent === undefined
      ? 0
      : Number(req.body.offerPercent);
  const quantityAvailable = Number(req.body.quantityAvailable);

  let sizesParsed;
  try {
    sizesParsed = JSON.parse(req.body.sizes || "[]");
  } catch {
    return { error: { status: 400, message: "Invalid sizes data." } };
  }

  if (!Array.isArray(sizesParsed) || sizesParsed.length === 0) {
    return {
      error: { status: 400, message: "Select at least one size (S, M, L, XL)." },
    };
  }

  const sizes = [...new Set(sizesParsed.map((s) => String(s).toUpperCase()))].filter((s) =>
    PRODUCT_SIZE_OPTIONS.includes(s)
  );
  if (sizes.length === 0) {
    return {
      error: { status: 400, message: "Sizes must be one or more of S, M, L, XL." },
    };
  }

  const fabric = (req.body.fabric || "").trim();
  const color = (req.body.color || "").trim();
  const printStyle = (req.body.printStyle || "").trim();
  const bodyFit = (req.body.bodyFit || "").trim();
  const features = (req.body.features || "").trim();
  const neckType = (req.body.neckType || "").trim();
  const productDetails = (req.body.productDetails || "").trim();
  const shipmentDelivery = (req.body.shipmentDelivery || "").trim();
  const returnExchange = (req.body.returnExchange || "").trim();

  if (!title) {
    return { error: { status: 400, message: "Title is required." } };
  }

  if (!Number.isInteger(categoryId) || categoryId < 1) {
    return { error: { status: 400, message: "Select a valid category." } };
  }

  if (!Number.isFinite(originalPrice) || originalPrice < 0) {
    return {
      error: { status: 400, message: "Original price must be a valid non-negative number." },
    };
  }

  if (!Number.isFinite(offerPercent) || offerPercent < 0 || offerPercent > 100) {
    return {
      error: { status: 400, message: "Offer percentage must be between 0 and 100." },
    };
  }

  const finalPrice = computeFinalPrice(originalPrice, offerPercent);
  if (finalPrice === null) {
    return { error: { status: 400, message: "Could not compute final price." } };
  }

  if (
    !Number.isFinite(quantityAvailable) ||
    quantityAvailable < 0 ||
    !Number.isInteger(quantityAvailable)
  ) {
    return {
      error: { status: 400, message: "Quantity must be a non-negative whole number." },
    };
  }

  return {
    ok: true,
    data: {
      categoryId,
      title,
      originalPrice,
      offerPercent,
      finalPrice,
      sizes,
      quantityAvailable,
      fabric,
      color,
      printStyle,
      bodyFit,
      features,
      neckType,
      productDetails,
      shipmentDelivery,
      returnExchange,
    },
  };
}

app.get("/api/products", async (req, res) => {
  try {
    const raw = req.query.categoryId ?? req.query.category;
    let filterCategoryId = null;
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) filterCategoryId = n;
    }

    const rawQ = String(req.query.q ?? req.query.search ?? "").trim();
    const safeSearch = rawQ.replace(/[%_\\]/g, "");

    let sql = `SELECT p.id, p.title, p.original_price, p.offer_percent, p.final_price,
              p.quantity_available, p.created_at, p.category_id,
              p.image_1_mime, p.image_2_mime, p.image_3_mime, p.image_4_mime,
              c.audience, c.name AS category_name
       FROM products p
       INNER JOIN categories c ON c.id = p.category_id`;
    const params = [];
    const conditions = [];
    if (filterCategoryId != null) {
      conditions.push(`p.category_id = ?`);
      params.push(filterCategoryId);
    }
    if (safeSearch.length > 0) {
      const like = `%${safeSearch}%`;
      conditions.push(`(p.title LIKE ? OR c.name LIKE ? OR c.audience LIKE ?)`);
      params.push(like, like, like);
    }
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }
    sql += ` ORDER BY p.created_at DESC`;

    const [rows] = await db.query(sql, params);

    const data = rows.map((row) => {
      const imageSlots = imageSlotsFromProductRow(row);
      return {
        id: row.id,
        title: row.title,
        originalPrice: Number(row.original_price) || 0,
        offerPercent: Number(row.offer_percent) || 0,
        finalPrice: Number(row.final_price) || 0,
        quantityAvailable: Number(row.quantity_available) || 0,
        createdAt: row.created_at,
        categoryId: Number(row.category_id) || 0,
        categoryLabel: `${AUDIENCE_LABEL[row.audience] || row.audience} — ${row.category_name}`,
        imageSlots,
        primaryImageSlot: imageSlots[0] ?? null,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/products:", error.code, error.message);
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message:
          "Database is missing the `products` table. In phpMyAdmin, run the SQL in backend/products_table.sql, then try again.",
        error: error.message,
        sqlMessage: error.sqlMessage,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Failed to load products.",
      error: error.message,
      sqlMessage: error.sqlMessage,
    });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ success: false, message: "Invalid product id." });
      return;
    }

    const [rows] = await db.query(
      `SELECT p.id, p.category_id, p.title, p.original_price, p.offer_percent, p.final_price,
              p.sizes_json, p.quantity_available, p.fabric, p.color, p.print_style, p.body_fit,
              p.features, p.neck_type, p.product_details, p.shipment_delivery, p.return_exchange,
              p.updated_at,
              p.image_1_mime, p.image_2_mime, p.image_3_mime, p.image_4_mime,
              c.audience, c.name AS category_name
       FROM products p
       INNER JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
      [id]
    );

    if (!rows.length) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }

    const row = rows[0];
    let sizesArr = [];
    try {
      sizesArr = JSON.parse(row.sizes_json || "[]");
      if (!Array.isArray(sizesArr)) sizesArr = [];
    } catch {
      sizesArr = [];
    }

    const imageSlots = imageSlotsFromProductRow(row);

    res.json({
      success: true,
      data: {
        id: row.id,
        categoryId: row.category_id,
        categoryLabel: `${AUDIENCE_LABEL[row.audience] || row.audience} — ${row.category_name}`,
        title: row.title,
        originalPrice: Number(row.original_price),
        offerPercent: Number(row.offer_percent),
        finalPrice: Number(row.final_price),
        sizes: sizesArr,
        quantityAvailable: Number(row.quantity_available) || 0,
        fabric: row.fabric || "",
        color: row.color || "",
        printStyle: row.print_style || "",
        bodyFit: row.body_fit || "",
        features: row.features || "",
        neckType: row.neck_type || "",
        productDetails: row.product_details || "",
        shipmentDelivery: row.shipment_delivery || "",
        returnExchange: row.return_exchange || "",
        updatedAt: row.updated_at
          ? new Date(row.updated_at).toISOString()
          : null,
        imageSlots,
        primaryImageSlot: imageSlots[0] ?? null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load product.",
      error: error.message,
    });
  }
});

app.post("/api/products", productImageUpload, async (req, res) => {
  let connection;
  try {
    const files = req.files || {};
    const img1 = files.image1?.[0];
    const img2 = files.image2?.[0];
    const img3 = files.image3?.[0];
    const img4 = files.image4?.[0];

    const parsed = parseProductFields(req);
    if (parsed.error) {
      res.status(parsed.error.status).json({
        success: false,
        message: parsed.error.message,
      });
      return;
    }

    const p = parsed.data;
    const [catRows] = await db.query("SELECT id FROM categories WHERE id = ?", [p.categoryId]);
    if (!catRows.length) {
      res.status(404).json({ success: false, message: "Category not found." });
      return;
    }

    connection = await db.getConnection();
    try {
      await mysqlBumpSessionPacket(connection);
      await connection.beginTransaction();

      const sizesJson = JSON.stringify(p.sizes);

      const [insertResult] = await connection.query(
        `INSERT INTO products (
          category_id, title, original_price, offer_percent, final_price, sizes_json,
          quantity_available, fabric, color, print_style, body_fit, features, neck_type,
          product_details, shipment_delivery, return_exchange,
          image_1_mime, image_1_data, image_2_mime, image_2_data,
          image_3_mime, image_3_data, image_4_mime, image_4_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.categoryId,
          p.title,
          p.originalPrice,
          p.offerPercent,
          p.finalPrice,
          sizesJson,
          p.quantityAvailable,
          p.fabric,
          p.color,
          p.printStyle,
          p.bodyFit,
          p.features,
          p.neckType,
          p.productDetails,
          p.shipmentDelivery,
          p.returnExchange,
          img1 ? uploadMime(img1) : null,
          img1 ? img1.buffer : null,
          img2 ? uploadMime(img2) : null,
          img2 ? img2.buffer : null,
          img3 ? uploadMime(img3) : null,
          img3 ? img3.buffer : null,
          img4 ? uploadMime(img4) : null,
          img4 ? img4.buffer : null,
        ]
      );

      await connection.query(
        "UPDATE categories SET product_count = product_count + 1 WHERE id = ?",
        [p.categoryId]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Product created successfully.",
        data: { id: insertResult.insertId, finalPrice: p.finalPrice },
      });
    } catch (innerErr) {
      try {
        await connection.rollback();
      } catch (rbErr) {
        console.error("POST /api/products rollback failed:", rbErr.message);
        try {
          connection.destroy();
        } catch (_) {
          /* ignore */
        }
        connection = null;
      }
      throw innerErr;
    } finally {
      if (connection) {
        try {
          connection.release();
        } catch (relErr) {
          console.error("POST /api/products release failed:", relErr.message);
          try {
            connection.destroy();
          } catch (_) {
            /* ignore */
          }
        }
      }
    }
  } catch (error) {
    console.error("POST /api/products:", error);
    const sqlMsg = error.sqlMessage || error.code;

    if (
      error.errno === 1153 ||
      error.code === "ER_NET_PACKET_TOO_LARGE" ||
      (typeof error.message === "string" && error.message.includes("max_allowed_packet"))
    ) {
      if (!res.headersSent) {
        res.status(413).json({
          success: false,
          message:
            "Product images are saved in one database query. Their combined size is larger than MySQL allows per packet (max_allowed_packet). Fix: raise the limit in MySQL, or use smaller/compressed photos. See backend/.env.example for SQL.",
          sqlMessage: sqlMsg,
        });
      }
      return;
    }

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to create product.",
        error: error.message,
        ...(sqlMsg ? { sqlMessage: sqlMsg } : {}),
      });
    }
  }
});

app.put("/api/products/:id", productImageUpload, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId < 1) {
      res.status(400).json({ success: false, message: "Invalid product id." });
      return;
    }

    const parsed = parseProductFields(req);
    if (parsed.error) {
      res.status(parsed.error.status).json({
        success: false,
        message: parsed.error.message,
      });
      return;
    }

    const p = parsed.data;
    const files = req.files || {};
    const img1 = files.image1?.[0];
    const img2 = files.image2?.[0];
    const img3 = files.image3?.[0];
    const img4 = files.image4?.[0];

    const [catRows] = await db.query("SELECT id FROM categories WHERE id = ?", [p.categoryId]);
    if (!catRows.length) {
      res.status(404).json({ success: false, message: "Category not found." });
      return;
    }

    let connection = await db.getConnection();
    try {
      await mysqlBumpSessionPacket(connection);
      await connection.beginTransaction();

      const [existingRows] = await connection.query(
        "SELECT * FROM products WHERE id = ? FOR UPDATE",
        [productId]
      );
      if (!existingRows.length) {
        await connection.rollback();
        res.status(404).json({ success: false, message: "Product not found." });
        return;
      }

      const prev = existingRows[0];
      const oldCategoryId = prev.category_id;

      const m1 = img1 ? uploadMime(img1) : prev.image_1_mime;
      const d1 = img1 ? img1.buffer : prev.image_1_data;
      const m2 = img2 ? uploadMime(img2) : prev.image_2_mime;
      const d2 = img2 ? img2.buffer : prev.image_2_data;
      const m3 = img3 ? uploadMime(img3) : prev.image_3_mime;
      const d3 = img3 ? img3.buffer : prev.image_3_data;
      const m4 = img4 ? uploadMime(img4) : prev.image_4_mime;
      const d4 = img4 ? img4.buffer : prev.image_4_data;

      const sizesJson = JSON.stringify(p.sizes);

      await connection.query(
        `UPDATE products SET
          category_id = ?, title = ?, original_price = ?, offer_percent = ?, final_price = ?,
          sizes_json = ?, quantity_available = ?, fabric = ?, color = ?, print_style = ?,
          body_fit = ?, features = ?, neck_type = ?, product_details = ?,
          shipment_delivery = ?, return_exchange = ?,
          image_1_mime = ?, image_1_data = ?, image_2_mime = ?, image_2_data = ?,
          image_3_mime = ?, image_3_data = ?, image_4_mime = ?, image_4_data = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          p.categoryId,
          p.title,
          p.originalPrice,
          p.offerPercent,
          p.finalPrice,
          sizesJson,
          p.quantityAvailable,
          p.fabric,
          p.color,
          p.printStyle,
          p.bodyFit,
          p.features,
          p.neckType,
          p.productDetails,
          p.shipmentDelivery,
          p.returnExchange,
          m1,
          d1,
          m2,
          d2,
          m3,
          d3,
          m4,
          d4,
          productId,
        ]
      );

      if (p.categoryId !== oldCategoryId) {
        await connection.query(
          "UPDATE categories SET product_count = GREATEST(product_count - 1, 0) WHERE id = ?",
          [oldCategoryId]
        );
        await connection.query(
          "UPDATE categories SET product_count = product_count + 1 WHERE id = ?",
          [p.categoryId]
        );
      }

      await connection.commit();

      res.json({
        success: true,
        message: "Product updated successfully.",
        data: { id: productId, finalPrice: p.finalPrice },
      });
    } catch (innerErr) {
      try {
        await connection.rollback();
      } catch (rbErr) {
        console.error("PUT /api/products/:id rollback failed:", rbErr.message);
        try {
          connection.destroy();
        } catch (_) {
          /* ignore */
        }
        connection = null;
      }
      throw innerErr;
    } finally {
      if (connection) {
        try {
          connection.release();
        } catch (relErr) {
          console.error("PUT /api/products/:id release failed:", relErr.message);
          try {
            connection.destroy();
          } catch (_) {
            /* ignore */
          }
        }
      }
    }
  } catch (error) {
    console.error("PUT /api/products/:id:", error);
    const sqlMsg = error.sqlMessage || error.code;

    if (
      error.errno === 1153 ||
      error.code === "ER_NET_PACKET_TOO_LARGE" ||
      (typeof error.message === "string" && error.message.includes("max_allowed_packet"))
    ) {
      if (!res.headersSent) {
        res.status(413).json({
          success: false,
          message:
            "Product images are saved in one database query. Their combined size is larger than MySQL allows per packet (max_allowed_packet). Fix: raise the limit in MySQL, or use smaller/compressed photos. See backend/.env.example for SQL.",
          sqlMessage: sqlMsg,
        });
      }
      return;
    }

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to update product.",
        error: error.message,
        ...(sqlMsg ? { sqlMessage: sqlMsg } : {}),
      });
    }
  }
});

app.delete("/api/products/:id", async (req, res) => {
  let connection;
  try {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId < 1) {
      res.status(400).json({ success: false, message: "Invalid product id." });
      return;
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT category_id FROM products WHERE id = ? FOR UPDATE",
      [productId]
    );
    if (!rows.length) {
      await connection.rollback();
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }

    const categoryId = rows[0].category_id;

    await connection.query("DELETE FROM products WHERE id = ?", [productId]);
    await connection.query(
      "UPDATE categories SET product_count = GREATEST(product_count - 1, 0) WHERE id = ?",
      [categoryId]
    );

    await connection.commit();

    res.json({ success: true, message: "Product deleted successfully." });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rbErr) {
        console.error("DELETE /api/products/:id rollback failed:", rbErr.message);
        try {
          connection.destroy();
        } catch (_) {
          /* ignore */
        }
        connection = null;
      }
    }
    console.error("DELETE /api/products/:id:", error);
    const sqlMsg = error.sqlMessage || error.code;
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to delete product.",
        error: error.message,
        ...(sqlMsg ? { sqlMessage: sqlMsg } : {}),
      });
    }
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (relErr) {
        console.error("DELETE /api/products/:id release failed:", relErr.message);
        try {
          connection.destroy();
        } catch (_) {
          /* ignore */
        }
      }
    }
  }
});

app.get("/api/products/:id/images/:slot/preview", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const slot = Number(req.params.slot);
    if (!Number.isInteger(id) || id < 1 || slot < 1 || slot > 4) {
      res.status(400).json({ success: false, message: "Invalid product or image slot." });
      return;
    }

    const [rows] = await db.query(
      `SELECT image_${slot}_mime AS mime, image_${slot}_data AS data FROM products WHERE id = ?`,
      [id]
    );

    if (!rows.length || !rows[0].data) {
      res.status(404).json({ success: false, message: "Image not found." });
      return;
    }

    res.set("Content-Type", rows[0].mime || "application/octet-stream");
    res.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    res.set("Pragma", "no-cache");
    res.send(rows[0].data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load product image.",
      error: error.message,
    });
  }
});

/* —— Blog / Journal —— */
app.get("/api/admin/blog-posts", adminApiMiddleware, async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, slug, title, is_published, created_at, updated_at
       FROM blog_posts ORDER BY created_at DESC`
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        isPublished: Number(r.is_published) === 1,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.status(503).json({
        success: false,
        message: "Blog tables missing. Run backend/schema-blog-posts.sql in phpMyAdmin.",
      });
      return;
    }
    console.error("GET /api/admin/blog-posts:", error);
    res.status(500).json({ success: false, message: "Failed to load blog posts." });
  }
});

app.post(
  "/api/admin/blog-posts",
  adminApiMiddleware,
  uploadBlog.fields([
    { name: "cover", maxCount: 1 },
    { name: "blockImages", maxCount: 24 },
  ]),
  async (req, res) => {
    let payload;
    try {
      payload = JSON.parse(req.body.payload || "{}");
    } catch {
      res.status(400).json({ success: false, message: "Invalid payload JSON." });
      return;
    }
    const title = String(payload.title || "").trim();
    if (!title) {
      res.status(400).json({ success: false, message: "Title is required." });
      return;
    }
    const blocksIn = Array.isArray(payload.blocks) ? payload.blocks : [];
    for (const b of blocksIn) {
      const t = String(b.type || "");
      if (!["heading", "paragraph", "heading_paragraph", "image"].includes(t)) {
        res.status(400).json({ success: false, message: `Unknown block type: ${t || "(empty)"}` });
        return;
      }
    }
    const imageBlockCount = blocksIn.filter((b) => b.type === "image").length;
    const blockImageFiles = req.files?.blockImages || [];
    if (blockImageFiles.length !== imageBlockCount) {
      res.status(400).json({
        success: false,
        message: `Expected ${imageBlockCount} image file(s) for image blocks, got ${blockImageFiles.length}.`,
      });
      return;
    }

    const coverFile = req.files?.cover?.[0];
    let imageIdx = 0;
    const rowsToInsert = [];
    for (let i = 0; i < blocksIn.length; i++) {
      const b = blocksIn[i];
      const colSpan = Math.min(12, Math.max(1, Number(b.colSpan) || 12));
      if (b.type === "heading") {
        rowsToInsert.push({
          sort_order: i,
          block_type: "heading",
          col_span: colSpan,
          heading: String(b.heading || "").trim() || null,
          paragraph: null,
          image_mime: null,
          image_data: null,
        });
      } else if (b.type === "paragraph") {
        rowsToInsert.push({
          sort_order: i,
          block_type: "paragraph",
          col_span: colSpan,
          heading: null,
          paragraph: String(b.paragraph || "").trim() || null,
          image_mime: null,
          image_data: null,
        });
      } else if (b.type === "heading_paragraph") {
        rowsToInsert.push({
          sort_order: i,
          block_type: "heading_paragraph",
          col_span: colSpan,
          heading: String(b.heading || "").trim() || null,
          paragraph: String(b.paragraph || "").trim() || null,
          image_mime: null,
          image_data: null,
        });
      } else if (b.type === "image") {
        const f = blockImageFiles[imageIdx];
        imageIdx += 1;
        if (!f || !f.buffer?.length) {
          res.status(400).json({ success: false, message: "Each image block needs a valid file." });
          return;
        }
        rowsToInsert.push({
          sort_order: i,
          block_type: "image",
          col_span: colSpan,
          heading: null,
          paragraph: null,
          image_mime: f.mimetype || "application/octet-stream",
          image_data: f.buffer,
        });
      }
    }

    let baseSlug = String(payload.slug || "").trim();
    if (!baseSlug) baseSlug = slugifyBlogTitle(title);
    let slug;
    try {
      slug = await ensureUniqueBlogSlug(baseSlug);
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: "Could not assign slug." });
      return;
    }

    const connection = await db.getConnection();
    try {
      await mysqlBumpSessionPacket(connection);
      await connection.beginTransaction();
      const [ins] = await connection.query(
        `INSERT INTO blog_posts (
          slug, title, banner_headline, banner_subtitle, button_label, button_href,
          listing_summary, cover_image_mime, cover_image_data, is_published
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          slug,
          title,
          String(payload.bannerHeadline || "").trim() || null,
          String(payload.bannerSubtitle || "").trim() || null,
          String(payload.buttonLabel || "").trim() || null,
          String(payload.buttonHref || "").trim() || null,
          String(payload.listingSummary || "").trim() || null,
          coverFile ? coverFile.mimetype || null : null,
          coverFile && coverFile.buffer?.length ? coverFile.buffer : null,
        ]
      );
      const blogId = ins.insertId;
      for (const row of rowsToInsert) {
        await connection.query(
          `INSERT INTO blog_blocks (blog_id, sort_order, block_type, col_span, heading, paragraph, image_mime, image_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            blogId,
            row.sort_order,
            row.block_type,
            row.col_span,
            row.heading,
            row.paragraph,
            row.image_mime,
            row.image_data,
          ]
        );
      }
      await connection.commit();
      res.json({
        success: true,
        data: { id: blogId, slug },
        message: "Blog has been posted.",
      });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (_) {
        /* ignore */
      }
      console.error("POST /api/admin/blog-posts:", error);
      if (error.code === "ER_NO_SUCH_TABLE") {
        res.status(503).json({
          success: false,
          message: "Blog tables missing. Run backend/schema-blog-posts.sql in phpMyAdmin.",
        });
        return;
      }
      if (
        error.errno === 1153 ||
        error.code === "ER_NET_PACKET_TOO_LARGE" ||
        (typeof error.message === "string" && error.message.includes("max_allowed_packet"))
      ) {
        res.status(413).json({
          success: false,
          message:
            `MySQL blocked this save: the server's GLOBAL max_allowed_packet is smaller than the image data (app allows up to ${MAX_BLOG_UPLOAD_MB} MB per file). ` +
            "Fix: stop MySQL, edit config file (my.cnf / my.ini) under [mysqld] add: max_allowed_packet=128M — start MySQL — run SHOW GLOBAL VARIABLES LIKE 'max_allowed_packet'; " +
            "SET GLOBAL in phpMyAdmin often does not persist after restart. See backend/.env.example.",
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: error.sqlMessage || error.message || "Failed to save blog post.",
      });
    } finally {
      connection.release();
    }
  }
);

app.patch("/api/admin/blog-posts/:id/published", adminApiMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ success: false, message: "Invalid post id." });
      return;
    }
    const next = req.body?.isPublished === true || req.body?.isPublished === 1;
    const [prevRows] = await db.query(
      "SELECT is_published FROM blog_posts WHERE id = ? LIMIT 1",
      [id]
    );
    if (!prevRows.length) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }
    const was = Number(prevRows[0].is_published) === 1;
    await db.query("UPDATE blog_posts SET is_published = ? WHERE id = ?", [next ? 1 : 0, id]);
    const publishedNow = !was && next;
    res.json({
      success: true,
      data: { id, isPublished: next, publishedNow },
    });
  } catch (error) {
    console.error("PATCH blog published:", error);
    res.status(500).json({ success: false, message: "Failed to update publish state." });
  }
});

app.delete("/api/admin/blog-posts/:id", adminApiMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ success: false, message: "Invalid post id." });
      return;
    }
    const [r] = await db.query("DELETE FROM blog_posts WHERE id = ?", [id]);
    if (r.affectedRows === 0) {
      res.status(404).json({ success: false, message: "Post not found." });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE blog:", error);
    res.status(500).json({ success: false, message: "Failed to delete post." });
  }
});

app.get("/api/blog-posts", async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, slug, title, listing_summary, created_at
       FROM blog_posts WHERE is_published = 1 ORDER BY created_at DESC`
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        listingSummary: r.listing_summary,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      res.json({ success: true, data: [] });
      return;
    }
    console.error("GET /api/blog-posts:", error);
    res.status(500).json({ success: false, message: "Failed to load journals." });
  }
});

app.get("/api/blog-posts/by-slug/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug) {
      res.status(400).json({ success: false, message: "Invalid slug." });
      return;
    }
    const [posts] = await db.query(
      `SELECT id, slug, title, banner_headline, banner_subtitle, button_label, button_href,
              listing_summary, created_at
       FROM blog_posts WHERE slug = ? AND is_published = 1 LIMIT 1`,
      [slug]
    );
    if (!posts.length) {
      res.status(404).json({ success: false, message: "Not found." });
      return;
    }
    const post = posts[0];
    const [blocks] = await db.query(
      `SELECT id, block_type, col_span, heading, paragraph
       FROM blog_blocks WHERE blog_id = ? ORDER BY sort_order ASC, id ASC`,
      [post.id]
    );
    res.json({
      success: true,
      data: {
        id: post.id,
        slug: post.slug,
        title: post.title,
        bannerHeadline: post.banner_headline,
        bannerSubtitle: post.banner_subtitle,
        buttonLabel: post.button_label,
        buttonHref: post.button_href,
        listingSummary: post.listing_summary,
        createdAt: post.created_at,
        coverUrl: `/api/blog-posts/${post.id}/cover`,
        blocks: blocks.map((b) => ({
          id: b.id,
          type: b.block_type,
          colSpan: Number(b.col_span) || 12,
          heading: b.heading,
          paragraph: b.paragraph,
          imageUrl:
            b.block_type === "image"
              ? `/api/blog-posts/${post.id}/blocks/${b.id}/image`
              : null,
        })),
      },
    });
  } catch (error) {
    console.error("GET by-slug:", error);
    res.status(500).json({ success: false, message: "Failed to load post." });
  }
});

app.get("/api/blog-posts/:id/cover", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).end();
      return;
    }
    const [rows] = await db.query(
      `SELECT cover_image_mime, cover_image_data, is_published FROM blog_posts WHERE id = ?`,
      [id]
    );
    if (!rows.length || !rows[0].cover_image_data || Number(rows[0].is_published) !== 1) {
      res.status(404).end();
      return;
    }
    res.set("Content-Type", rows[0].cover_image_mime || "image/jpeg");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(rows[0].cover_image_data);
  } catch (error) {
    console.error("cover:", error);
    res.status(500).end();
  }
});

app.get("/api/blog-posts/:postId/blocks/:blockId/image", async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    const blockId = Number(req.params.blockId);
    if (!Number.isInteger(postId) || !Number.isInteger(blockId)) {
      res.status(400).end();
      return;
    }
    const [rows] = await db.query(
      `SELECT b.image_mime, b.image_data, p.is_published
       FROM blog_blocks b
       INNER JOIN blog_posts p ON p.id = b.blog_id
       WHERE b.id = ? AND b.blog_id = ? AND b.block_type = 'image'`,
      [blockId, postId]
    );
    if (!rows.length || !rows[0].image_data || Number(rows[0].is_published) !== 1) {
      res.status(404).end();
      return;
    }
    res.set("Content-Type", rows[0].image_mime || "application/octet-stream");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(rows[0].image_data);
  } catch (error) {
    console.error("block image:", error);
    res.status(500).end();
  }
});

app.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const isBlog = String(req.path || "").includes("blog-posts");
      return res.status(400).json({
        success: false,
        message: isBlog
          ? `Each blog image (cover or block) must be ${MAX_BLOG_UPLOAD_MB} MB or smaller. Increase MAX_BLOG_UPLOAD_MB in backend/.env (max 64). If MySQL still errors, raise max_allowed_packet on the server (see .env.example).`
          : "Each product image must be 12 MB or smaller. For heavy uploads in dev, set VITE_API_BASE_URL=http://localhost:5001 in web/.env (bypasses the Vite proxy).",
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }

  console.error("Unhandled API error:", err);
  if (res.headersSent) {
    return;
  }
  const sqlMsg = err.sqlMessage || err.code;
  res.status(500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(sqlMsg ? { sqlMessage: sqlMsg } : {}),
  });
});

function warmupMailOutbound() {
  if (process.env.SMTP_WARMUP === "false") return;
  setImmediate(async () => {
    if (process.env.RESEND_API_KEY?.trim()) {
      console.log("[Sand24] Outbound mail: Resend API (RESEND_API_KEY set)");
      return;
    }
    try {
      const t = getMailTransport();
      if (!t) return;
      await t.verify();
      console.log("[Sand24] SMTP connection verified — pooled connection ready (faster OTP delivery)");
    } catch (e) {
      console.warn("[Sand24] SMTP verify failed — first OTP may be slower:", e.message);
    }
  });
}

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Database: ${process.env.DB_NAME || "fashion_db"} (create tables from backend/*.sql if needed)`);
  console.log(`Blog images: max ${MAX_BLOG_UPLOAD_MB} MB per file (MAX_BLOG_UPLOAD_MB in backend/.env; MySQL max_allowed_packet must be high enough)`);
  const smtpOk = Boolean(process.env.SMTP_USER?.trim() && String(process.env.SMTP_PASS ?? "").trim());
  const resendOk = Boolean(process.env.RESEND_API_KEY?.trim());
  if (resendOk) {
    console.log("Outbound OTP email: Resend API (set RESEND_FROM if not using default sandbox sender)");
  } else {
    console.log(
      smtpOk
        ? `SMTP: OK (pooled, sending as ${process.env.SMTP_USER?.trim()})`
        : "SMTP: not loaded — put SMTP_USER and SMTP_PASS in backend/.env next to index.js, then restart"
    );
  }
  warmupMailOutbound();
  setImmediate(() => {
    logMysqlGlobalMaxPacket().catch(() => {});
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\nPort ${PORT} is already in use — another process (often another \`node index.js\`) is bound to it.\n` +
        `Free it, then start again:\n` +
        `  npm run free-port\n` +
        `Or:  lsof -i :${PORT}     then    kill <PID>\n` +
        `Or set PORT=5002 in backend/.env\n`
    );
  } else {
    console.error("Cannot start HTTP server:", err.message);
  }
  process.exit(1);
});

server.requestTimeout = 600000;
server.headersTimeout = 610000;
