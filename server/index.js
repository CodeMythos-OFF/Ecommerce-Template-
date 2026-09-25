import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { createMicrosoftAuthUrl, exchangeMicrosoftCode, getMicrosoftAccessToken, getMicrosoftRedirectUri, isMicrosoftEmailConfigured, sendMicrosoftEmail } from './microsoftEmailService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '34579317567-tals9olen2trsjfs3gfualbdlfdkki7n.apps.googleusercontent.com';
const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET;
const ADMIN_EMAILS = [
  'codemythos@outlook.com',
  // Add more admin email addresses here.
].map((email) => email.toLowerCase());

// Backward-compatible alias for any older code paths that still reference ADMIN_EMAIL.
const ADMIN_EMAIL = ADMIN_EMAILS[0];
const SUPER_ADMIN_EMAIL = 'codemythos@outlook.com';
const SUPER_ADMIN_DELETE_PIN = process.env.SUPER_ADMIN_DELETE_PIN || '2014';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Middleware
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:3000',
  'https://scs577738.vercel.app',
  'https://testsampleindev.vercel.app'
]);

app.use((req, res, next) => {
  // Google Identity Services uses window.postMessage for the sign-in popup.
  // Allow the popup communication without weakening other security headers.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Super-Admin-Pin', 'X-Product-Seller-Email']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// ========== AUTHENTICATION HELPERS ==========

const createSessionToken = (user) => {
  if (!AUTH_SESSION_SECRET || AUTH_SESSION_SECRET.length < 32) {
    throw new Error('AUTH_SESSION_SECRET must be configured with at least 32 characters');
  }

  const payload = {
    sub: user.sub,
    provider: 'google',
    email: user.email,
    name: user.name,
    picture: user.picture || null,
    isAdmin: ADMIN_EMAILS.includes(user.email?.toLowerCase()),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  return `${encoded}.${signature}`;
};

const verifySessionToken = (token) => {
  if (!token || !AUTH_SESSION_SECRET) return null;

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = crypto.createHmac('sha256', AUTH_SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
};

const parseCookies = (req) => {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((cookies, part) => {
    const i = part.indexOf('=');
    if (i > 0) cookies[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    return cookies;
  }, {});
};

const setAuthCookie = (res, token) => {
  // The frontend and API are different origins but share the same Vercel site.
  // Lax is sufficient for same-site requests and is more broadly accepted than
  // SameSite=None by browsers with stricter cookie/privacy settings.
  res.setHeader(
    'Set-Cookie',
    `shopmaster_session=${token}; Max-Age=604800; Path=/; HttpOnly; SameSite=None; Secure`
  );
};

const clearAuthCookie = (res) => {
  res.setHeader(
    'Set-Cookie',
    'shopmaster_session=; Max-Age=0; Path=/; HttpOnly; SameSite=None; Secure'
  );
};

const getSessionUser = (req) => {
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cookieToken = parseCookies(req).shopmaster_session;
  return verifySessionToken(bearer || cookieToken);
};

const getAccessContext = async (req) => {
  const sessionUser = getSessionUser(req);
  if (!sessionUser?.email) return null;

  const email = sessionUser.email.toLowerCase();
  const isSuperAdmin = email === SUPER_ADMIN_EMAIL;
  const seller = await Seller.findOne({ email }).maxTimeMS(5000);
  const isSeller = Boolean(seller?.isApproved);

  return { sessionUser, seller, isSuperAdmin, isSeller, canManageProducts: isSuperAdmin || isSeller };
};

const requireProductManager = async (req, res) => {
  const access = await getAccessContext(req);
  if (!access?.canManageProducts) {
    res.status(403).json({ error: 'Approved seller or super admin access is required' });
    return null;
  }
  return access;
};

const verifySuperAdminPin = (req) => {
  const pin = req.headers['x-super-admin-pin'] || req.body?.pin || req.query?.pin;
  return typeof pin === 'string' && pin === SUPER_ADMIN_DELETE_PIN;
};

// MongoDB Connection with proper error handling
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not configured. Set it in your deployment environment.');
}

// Configure mongoose settings
mongoose.set('strictQuery', false);
mongoose.set('bufferTimeoutMS', 30000);

// Connection flag
let isConnected = false;

// Connect to MongoDB with retry logic (non-blocking)
const connectDB = async () => {
  if (isConnected) {
    console.log('✅ MongoDB already connected');
    return;
  }

  try {
    if (!MONGODB_URI) {
      isConnected = false;
      return;
    }

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4
    });
    
    isConnected = true;
    console.log('✅ Connected to MongoDB');

    // Initialization is intentionally not awaited here. API requests should
    // not be blocked by seed/setup work during a Vercel cold start.
    initializeEmailTemplates().catch((error) => console.error('Email template initialization error:', error.message));
    initializeData().catch((error) => {
      console.error('❌ Background data initialization error:', error.message);
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    isConnected = false;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('⏳ Retrying MongoDB connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    }
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('⚠️ Mongoose disconnected from MongoDB');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error('❌ Mongoose connection error:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('👋 MongoDB connection closed through app termination');
  process.exit(0);
});

// Start connection (non-blocking)
connectDB();

// Seller Schema
const sellerSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  businessName: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  isApproved: { type: Boolean, default: false },
  isSuperAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Seller = mongoose.model('Seller', sellerSchema);

// Product Schema
const productSchema = new mongoose.Schema({
  id: { type: String, required: true },
  year: { type: Number, required: true },
  cost: { type: Number, required: true },
  img: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  sellerEmail: { type: String, required: true },
  sellerId: { type: String },
  sellerName: { type: String, required: true },
  sellerBusinessName: { type: String, required: true },
  brand: { type: String },
  stock: { type: Number, default: 100 },
  isActive: { type: Boolean, default: true },
  averageRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  images: { type: [String], default: [] },
  variants: { type: [mongoose.Schema.Types.Mixed], default: [] },
  specifications: { type: Map, of: String, default: {} },
  relatedProductIds: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.index({ id: 1, sellerEmail: 1 }, { unique: true });

const Product = mongoose.model('Product', productSchema);

const reviewSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  orderId: { type: String, required: true },
  userEmail: { type: String, required: true },
  userName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
  verifiedPurchase: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
reviewSchema.index({ productId: 1, orderId: 1, userEmail: 1 }, { unique: true });
const Review = mongoose.model('Review', reviewSchema);

// Order Schema (updated with cart field for complete product details)
const orderSchema = new mongoose.Schema({
  trackingId: { type: String, required: true, unique: true },
  user: { type: String, required: true },
  userName: { type: String, required: true },
  items: { type: Number, required: true },
  subtotal: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  couponCode: { type: String, default: '' },
  shippingAmount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['COD'], default: 'COD', required: true },
  returnPolicy: { type: String, default: 'No returns' },
  products: [{
    name: String,
    quantity: Number,
    price: Number,
    sellerEmail: String,
    sellerName: String
  }],
  cart: [{
    id: String,
    cost: Number,
    img: String,
    brand: String,
    category: String,
    quantity: Number
  }],
  address: {
    name: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    phone: { type: String, required: true },
    country: { type: String },
    digipin: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
    locationTimestamp: { type: Date },
    displayAddress: { type: String },
    district: { type: String }
  },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: 'Order Placed' }
});

const Order = mongoose.model('Order', orderSchema);

// Stats Schema
const statsSchema = new mongoose.Schema({
  totalViews: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  todayViews: { type: Number, default: 0 },
  todayOrders: { type: Number, default: 0 },
  lastViewDate: { type: String, default: () => new Date().toLocaleDateString() },
  lastOrderDate: { type: String, default: () => new Date().toLocaleDateString() },
  updatedAt: { type: Date, default: Date.now }
});

const Stats = mongoose.model('Stats', statsSchema);
const microsoftEmailSchema = new mongoose.Schema({
  accountEmail: { type: String, required: true },
  encryptedTokenCache: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
});
const MicrosoftEmail = mongoose.model('MicrosoftEmail', microsoftEmailSchema);

// Store OAuth state server-side instead of relying on a cross-site cookie.
// This avoids state loss caused by browser privacy/third-party cookie policies.
const microsoftOAuthStateSchema = new mongoose.Schema({
  state: { type: String, unique: true, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now, expires: 900 }
});
const MicrosoftOAuthState = mongoose.model('MicrosoftOAuthState', microsoftOAuthStateSchema);

const emailTemplateSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  name: String, subject: String, text: String, html: String,
  enabled: { type: Boolean, default: true }, updatedAt: { type: Date, default: Date.now }
});
const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['percent', 'fixed', 'free_delivery'], required: true },
  value: { type: Number, default: 0 },
  minSubtotal: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  expiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Coupon = mongoose.model('Coupon', couponSchema);

const DEFAULT_COUPONS = [
  { code: 'WELCOME10', type: 'percent', value: 10, minSubtotal: 0, active: true },
  { code: 'SAVE100', type: 'fixed', value: 100, minSubtotal: 1000, active: true },
  { code: 'SHOP15', type: 'percent', value: 15, minSubtotal: 2000, active: true }
];

const DEFAULT_EMAIL_TEMPLATES = {
  welcome: { name: 'Welcome email', subject: 'Welcome to ShopMaster', text: 'Hi {{name}},\n\nWelcome to ShopMaster. Your account {{email}} is ready.', html: '<h1>Welcome to ShopMaster</h1><p>Hi {{name}},</p><p>Your account {{email}} is ready.</p>' },
  order_confirmation: { name: 'Order confirmation', subject: 'Order {{orderId}} confirmed', text: 'Your order {{orderId}} has been placed. Total: ₹{{total}}.', html: '<h2>Order confirmed</h2><p>Order <strong>{{orderId}}</strong> has been placed.</p><p>Total: ₹{{total}}</p>' },
  order_status: { name: 'Order status', subject: 'Order {{orderId}} status updated', text: 'Order {{orderId}} status: {{status}}.', html: '<h2>Order update</h2><p>Order <strong>{{orderId}}</strong> status: {{status}}.</p>' },
  seller_application: { name: 'Seller application', subject: 'Seller application received', text: 'Hi {{name}}, your seller application for {{businessName}} was received.', html: '<p>Hi {{name}},</p><p>Your seller application for <strong>{{businessName}}</strong> was received.</p>' },
  seller_approved: { name: 'Seller approved', subject: 'Seller access approved', text: 'Your seller access for {{businessName}} has been approved.', html: '<p>Your seller access for <strong>{{businessName}}</strong> has been approved.</p>' },
  seller_revoked: { name: 'Seller revoked', subject: 'Seller access updated', text: 'Seller access for {{businessName}} has been revoked.', html: '<p>Seller access for <strong>{{businessName}}</strong> has been revoked.</p>' }
};

const renderEmailTemplate = (value, variables) => String(value || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => variables?.[key] ?? '');

const sendTemplateEmail = async (key, to, variables) => {
  if (!to) return;
  try {
    const integration = await MicrosoftEmail.findOne().maxTimeMS(5000);
    if (!integration) return;
    const template = await EmailTemplate.findOne({ key }).maxTimeMS(5000) || DEFAULT_EMAIL_TEMPLATES[key];
    if (!template || template.enabled === false) return;
    const mail = await getMicrosoftAccessToken(integration.encryptedTokenCache);
    await sendMicrosoftEmail({ accessToken: mail.accessToken, to, subject: renderEmailTemplate(template.subject, variables), text: renderEmailTemplate(template.text, variables), html: renderEmailTemplate(template.html, variables) });
    integration.encryptedTokenCache = mail.cache;
    integration.accountEmail = mail.account?.username || integration.accountEmail;
    integration.updatedAt = new Date();
    await integration.save();
  } catch (error) {
    console.error(`📧 Microsoft automated email error [${key}]:`, error.message);
  }
};

const initializeEmailTemplates = async () => {
  for (const [key, template] of Object.entries(DEFAULT_EMAIL_TEMPLATES)) {
    await EmailTemplate.findOneAndUpdate({ key }, { $setOnInsert: { key, ...template, enabled: true, updatedAt: new Date() } }, { upsert: true });
  }
};


// Initialize all data
const initializeData = async () => {
  try {
    for (const coupon of DEFAULT_COUPONS) {
      await Coupon.findOneAndUpdate(
        { code: coupon.code },
        { $setOnInsert: { ...coupon, createdAt: new Date(), updatedAt: new Date() } },
        { upsert: true }
      );
    }

    const stats = await Stats.findOne();
    if (!stats) {
      await Stats.create({});
      console.log('📊 Stats initialized');
    }

    const superAdmin = await Seller.findOne({ email: ADMIN_EMAILS[0] });
    if (!superAdmin) {
      await Seller.create({
        email: ADMIN_EMAILS[0],
        name: 'CodeMythos',
        businessName: 'ShopMaster',
        isApproved: true,
        isSuperAdmin: true
      });
      console.log('👑 Super admin seller initialized for CodeMythos');
    } else if (!superAdmin.isSuperAdmin || !superAdmin.isApproved) {
      superAdmin.isSuperAdmin = true;
      superAdmin.isApproved = true;
      superAdmin.updatedAt = new Date();
      await superAdmin.save();
      console.log('👑 CodeMythos seller promoted to super admin');
    }

    const count = await Product.countDocuments();
    if (count === 0) {
      const defaultProducts = [
        {
          id: "Wireless headphone",
          year: 2025,
          cost: 9999,
          img: "/images/headphone.webp",
          category: "Electronics",
          description: "High-quality wireless headphones with noise cancellation.",
          sellerEmail: 'rohan.sivaa@gmail.com',
          sellerName: 'Rohan',
          sellerBusinessName: 'ShopMaster'
        },
        {
          id: "Smart Watch",
          year: 2024,
          cost: 4999,
          img: "/images/watch.webp",
          category: "Wearables",
          description: "Feature-rich smart watch with health tracking.",
          sellerEmail: 'rohan.sivaa@gmail.com',
          sellerName: 'Rohan',
          sellerBusinessName: 'ShopMaster'
        },
        {
          id: "Bluetooth Speaker",
          year: 2025,
          cost: 2999,
          img: "/images/speaker.webp",
          category: "Electronics",
          description: "Portable Bluetooth speaker with premium sound quality and 12-hour battery life.",
          sellerEmail: 'rohan.sivaa@gmail.com',
          sellerName: 'Rohan',
          sellerBusinessName: 'ShopMaster'
        },
        {
          id: "Wireless Mouse",
          year: 2024,
          cost: 799,
          img: "/images/mouse.webp",
          category: "Electronics",
          description: "Ergonomic wireless mouse with precision tracking and long battery life.",
          sellerEmail: 'rohan.sivaa@gmail.com',
          sellerName: 'Rohan',
          sellerBusinessName: 'ShopMaster'
        },
        {
          id: "USB-C Cable",
          year: 2025,
          cost: 299,
          img: "/images/cable.webp",
          category: "Accessories",
          description: "Fast charging USB-C cable with durable braided design.",
          sellerEmail: 'rohan.sivaa@gmail.com',
          sellerName: 'Rohan',
          sellerBusinessName: 'ShopMaster'
        },
        {
          id: "Fitness Band",
          year: 2024,
          cost: 1999,
          img: "/images/band.webp",
          category: "Wearables",
          description: "Track your fitness goals with heart rate monitoring and sleep tracking.",
          sellerEmail: 'rohan.sivaa@gmail.com',
          sellerName: 'Rohan',
          sellerBusinessName: 'ShopMaster'
        },
        {
          id: "Phone Case",
          year: 2025,
          cost: 499,
          img: "/images/case.webp",
          category: "Accessories",
          description: "Shockproof phone case with premium finish and raised edges.",
          sellerEmail: 'rohan.sivaa@gmail.com',
          sellerName: 'Rohan',
          sellerBusinessName: 'ShopMaster'
        },
        {
          id: "Power Bank",
          year: 2024,
          cost: 1499,
          img: "/images/powerbank.webp",
          category: "Electronics",
          description: "20000mAh power bank with fast charging support for multiple devices.",
          sellerEmail: 'rohan.sivaa@gmail.com',
          sellerName: 'Rohan',
          sellerBusinessName: 'ShopMaster'
        }
      ];
      
      await Product.insertMany(defaultProducts);
      console.log('📦 Default products initialized');
    }

    console.log('✅ All data initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing data:', error.message);
  }
};

// Routes
// Ensure every API request has a ready MongoDB connection.
// Vercel serverless functions can receive a request before the non-blocking
// startup connection above has finished, which otherwise causes intermittent
// 500 errors on stats/orders during cold starts.
app.use('/api', async (req, res, next) => {
  // Authentication endpoints use the signed session cookie and Google token;
  // they do not require MongoDB to answer.
  if (req.path.startsWith('/auth/')) {
    return next();
  }

  if (!isConnected) {
    await connectDB();
  }

  if (!isConnected) {
    return res.status(503).json({
      success: false,
      error: 'Database is not ready. Please retry shortly.'
    });
  }

  next();
});


// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    database: isConnected ? 'connected' : 'connecting...',
  });
});

// ========== AUTHENTICATION ROUTES ==========

app.post('/api/auth/google/verify', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ success: false, error: 'Google credential is required' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
      return res.status(401).json({ success: false, error: 'Google account could not be verified' });
    }

    const seller = await Seller.findOne({ email: payload.email.toLowerCase() }).maxTimeMS(5000);
    const isSuperAdmin = payload.email.toLowerCase() === SUPER_ADMIN_EMAIL;
    const isSeller = Boolean(seller?.isApproved);

    const user = {
      provider: 'google',
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture || null,
      isAdmin: isSuperAdmin || isSeller,
      isSuperAdmin,
      isSeller,
      sellerId: seller ? String(seller._id) : null,
      sellerName: seller?.name || null,
      sellerBusinessName: seller?.businessName || null,
    };

    const sessionToken = createSessionToken(user);
    sendTemplateEmail('welcome', user.email, user);
    setAuthCookie(res, sessionToken);
    return res.json({ success: true, user, sessionToken });
  } catch (error) {
    console.error('Google ID token verification failed:', error.message);
    return res.status(401).json({ success: false, error: 'Invalid Google credential' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  const user = getSessionUser(req);

  if (!user) {
    // A missing session is a normal signed-out state, not a server error.
    return res.json({ success: false, authenticated: false, user: null });
  }

  return res.json({
    success: true,
    authenticated: true,
    user: await (async () => {
      const seller = await Seller.findOne({ email: user.email.toLowerCase() }).maxTimeMS(5000);
      const isSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN_EMAIL;
      return {
        provider: user.provider,
        sub: user.sub,
        email: user.email,
        name: user.name,
        picture: user.picture || null,
        isAdmin: isSuperAdmin || Boolean(seller?.isApproved),
        isSuperAdmin,
        isSeller: Boolean(seller?.isApproved),
        sellerId: seller ? String(seller._id) : null,
        sellerName: seller?.name || null,
        sellerBusinessName: seller?.businessName || null,
      };
    })(),
  });
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ success: true });
});

// ========== EMAIL ROUTES ==========


app.get('/api/email/microsoft/authorize', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.isSuperAdmin) return res.status(403).json({ error: 'Only the super admin can connect the email account' });

    // Keep OAuth state in MongoDB so the callback does not depend on a
    // cross-site cookie surviving the Microsoft login redirect.
    const state = crypto.randomBytes(32).toString('hex');
    await MicrosoftOAuthState.create({
      state,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    const url = await createMicrosoftAuthUrl(state);
    res.redirect(url);
  } catch (error) {
    console.error('Microsoft authorization start failed:', error);
    res.status(500).send(`Microsoft authorization could not start: ${error.message}`);
  }
});

app.get('/api/email/microsoft/callback', async (req, res) => {
  try {
    const state = String(req.query.state || '');
    const code = String(req.query.code || '');
    if (!state || !code) {
      return res.status(400).send('Microsoft authorization response is missing state or code.');
    }

    const stateRecord = await MicrosoftOAuthState.findOneAndDelete({
      state,
      expiresAt: { $gt: new Date() }
    }).maxTimeMS(5000);

    if (!stateRecord) {
      return res.status(400).send('Microsoft authorization state is invalid or expired. Please start the connection again.');
    }

    const result = await exchangeMicrosoftCode(code);
    await MicrosoftEmail.findOneAndUpdate(
      {},
      {
        accountEmail: result.account.username || result.account.homeAccountId,
        encryptedTokenCache: result.cache,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.redirect((process.env.FRONTEND_PUBLIC_URL || 'https://testsampleindev.vercel.app') + '/#admin');
  } catch (error) {
    console.error('Microsoft email callback failed:', error);
    res.status(500).send(`Microsoft email connection failed: ${error.message}`);
  }
});

app.get('/api/email/status', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.isSuperAdmin) return res.status(403).json({ error: 'Super admin access is required' });
    const integration = await MicrosoftEmail.findOne().select('accountEmail updatedAt').lean();
    res.json({ configured: isMicrosoftEmailConfigured(), connected: Boolean(integration), accountEmail: integration?.accountEmail || null, updatedAt: integration?.updatedAt || null, redirectUri: getMicrosoftRedirectUri() });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/email/templates', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.isSuperAdmin) return res.status(403).json({ error: 'Super admin access is required' });
    res.json(await EmailTemplate.find().sort({ key: 1 }).maxTimeMS(5000));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/email/templates/:key', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.isSuperAdmin) return res.status(403).json({ error: 'Super admin access is required' });
    if (!DEFAULT_EMAIL_TEMPLATES[req.params.key]) return res.status(404).json({ error: 'Unknown email template' });
    const template = await EmailTemplate.findOneAndUpdate({ key: req.params.key }, { $set: { subject: String(req.body.subject || ''), text: String(req.body.text || ''), html: String(req.body.html || ''), enabled: req.body.enabled !== false, updatedAt: new Date() } }, { new: true, upsert: true });
    res.json({ success: true, template });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/email/test', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.isSuperAdmin) return res.status(403).json({ error: 'Super admin access is required' });
    const integration = await MicrosoftEmail.findOne();
    if (!integration) return res.status(400).json({ error: 'Connect your Microsoft account first.' });
    const mail = await getMicrosoftAccessToken(integration.encryptedTokenCache);
    const to = String(req.body?.to || access.sessionUser.email).trim();
    await sendMicrosoftEmail({ accessToken: mail.accessToken, to, subject: 'ShopMaster test email', text: 'Your ShopMaster Microsoft email connection is working.' });
    integration.encryptedTokenCache = mail.cache; await integration.save();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ========== SELLER ROUTES ==========

app.post('/api/sellers/apply', async (req, res) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser?.email) {
      return res.status(401).json({ error: 'Please sign in before applying to become a seller' });
    }

    const email = sessionUser.email.toLowerCase();
    const { name, businessName, phone, address } = req.body;

    if (!businessName || String(businessName).trim().length < 2) {
      return res.status(400).json({ error: 'A valid business or brand name is required' });
    }

    const existing = await Seller.findOne({ email }).maxTimeMS(5000);
    if (existing) {
      if (existing.isSuperAdmin || existing.isApproved) {
        return res.status(400).json({ error: 'This account already has seller access' });
      }
      return res.status(409).json({ error: 'A seller application for this account is already pending approval' });
    }

    const seller = await Seller.create({
      email,
      name: String(name || sessionUser.name || email.split('@')[0]).trim(),
      businessName: String(businessName).trim(),
      phone: String(phone || '').trim(),
      address: String(address || '').trim(),
      isApproved: false,
      isSuperAdmin: false
    });
    sendTemplateEmail('seller_application', seller.email, seller);

    res.status(201).json({
      success: true,
      seller,
      message: 'Seller application submitted. Please wait for super admin approval.'
    });
  } catch (error) {
    console.error('Seller application error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sellers/register', async (req, res) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser?.email) return res.status(401).json({ error: 'Authentication is required' });

    const { name, businessName, phone, address } = req.body;
    const email = sessionUser.email.toLowerCase();
    const safeName = String(name || sessionUser.name || '').trim();
    const safeBusinessName = String(businessName || '').trim();

    if (!safeName || !safeBusinessName) {
      return res.status(400).json({ error: 'Name and business name are required' });
    }

    const existing = await Seller.findOne({ email }).maxTimeMS(5000);
    if (existing) {
      return res.status(400).json({ error: 'Seller already registered with this account' });
    }

    const seller = await Seller.create({
      email,
      name: safeName,
      businessName: safeBusinessName,
      phone: String(phone || '').trim(),
      address: String(address || '').trim(),
      isApproved: email === SUPER_ADMIN_EMAIL,
      isSuperAdmin: email === SUPER_ADMIN_EMAIL
    });

    res.status(201).json(seller);
  } catch (error) {
    console.error('Register seller error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sellers/:email', async (req, res) => {
  try {
    const seller = await Seller.findOne({ email: req.params.email }).maxTimeMS(5000);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }
    res.json(seller);
  } catch (error) {
    console.error('Get seller error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sellers', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin access is required' });
    }

    const sellers = await Seller.find().sort({ createdAt: -1 }).maxTimeMS(5000);
    res.json(sellers);
  } catch (error) {
    console.error('Get all sellers error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sellers/:email/approve', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only the super admin can approve sellers' });
    }

    const seller = await Seller.findOneAndUpdate(
      { email: req.params.email.toLowerCase() },
      { isApproved: true, updatedAt: new Date() },
      { new: true }
    ).maxTimeMS(5000);
    
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    if (seller.email.toLowerCase() === SUPER_ADMIN_EMAIL) {
      seller.isApproved = true;
      seller.isSuperAdmin = true;
      await seller.save();
    }
    sendTemplateEmail('seller_approved', seller.email, seller);

    res.json({ success: true, seller, message: 'Seller approved successfully' });
  } catch (error) {
    console.error('Approve seller error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sellers/:email/revoke', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only the super admin can revoke seller access' });
    }

    const email = req.params.email.toLowerCase();
    if (email === SUPER_ADMIN_EMAIL) {
      return res.status(400).json({ error: 'The super admin cannot be revoked' });
    }

    const seller = await Seller.findOneAndUpdate(
      { email },
      { isApproved: false, updatedAt: new Date() },
      { new: true }
    ).maxTimeMS(5000);

    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }
    sendTemplateEmail('seller_revoked', seller.email, seller);

    res.json({ success: true, seller, message: 'Seller access revoked' });
  } catch (error) {
    console.error('Revoke seller error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== PRODUCT ROUTES ==========

app.get('/api/products', async (req, res) => {
  try {
    const { sellerEmail } = req.query;
    const filter = { isActive: true };
    
    if (sellerEmail) {
      filter.sellerEmail = sellerEmail;
    }
    
    const products = await Product.find(filter).sort({ createdAt: -1 }).maxTimeMS(5000);
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sellers/:email/products', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    const requestedEmail = String(req.params.email || '').toLowerCase();
    if (!access?.isSuperAdmin && (!access?.isSeller || access.sessionUser.email.toLowerCase() !== requestedEmail)) {
      return res.status(403).json({ error: 'Seller access is required' });
    }
    const products = await Product.find({ sellerEmail: requestedEmail }).sort({ createdAt: -1 }).maxTimeMS(5000);
    res.json(products);
  } catch (error) {
    console.error('Get seller products error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id, isActive: true }).maxTimeMS(5000);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const access = await requireProductManager(req, res);
    if (!access) return;

    const { id, year, cost, img, category, description, brand, sellerEmail: requestedSellerEmail, stock, isActive, images, variants, specifications, relatedProductIds } = req.body;
    const targetEmail = access.isSuperAdmin
      ? String(requestedSellerEmail || '').toLowerCase()
      : access.sessionUser.email.toLowerCase();

    if (!targetEmail) return res.status(400).json({ error: 'Seller email is required' });

    const seller = access.isSuperAdmin
      ? await Seller.findOne({ email: targetEmail }).maxTimeMS(5000)
      : access.seller;

    if (!seller) return res.status(404).json({ error: 'Seller not found' });
    if (!access.isSuperAdmin && !seller.isApproved) {
      return res.status(403).json({ error: 'Seller account pending approval' });
    }

    const existing = await Product.findOne({ id, sellerEmail: seller.email }).maxTimeMS(5000);
    if (existing) return res.status(400).json({ error: 'This seller already has a product with this name' });

    const product = await Product.create({
      id, year, cost, img, category, description,
      brand: String(brand || seller.businessName || '').trim(),
      stock: Number.isInteger(Number(stock)) ? Math.max(0, Number(stock)) : 100,
      isActive: isActive !== false,
      images: Array.isArray(images) ? images.filter(Boolean).slice(0, 10) : [],
      variants: Array.isArray(variants) ? variants.slice(0, 20) : [],
      specifications: specifications && typeof specifications === 'object' ? specifications : {},
      relatedProductIds: Array.isArray(relatedProductIds) ? relatedProductIds.slice(0, 20) : [],
      sellerEmail: seller.email,
      sellerId: String(seller._id),
      sellerName: seller.name,
      sellerBusinessName: seller.businessName
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const access = await requireProductManager(req, res);
    if (!access) return;

    const { year, cost, img, category, description, brand, stock, isActive, images, variants, specifications, relatedProductIds } = req.body;
    const filter = { id: req.params.id };
    if (access.isSuperAdmin && req.body.sellerEmail) {
      filter.sellerEmail = String(req.body.sellerEmail).toLowerCase();
    } else if (!access.isSuperAdmin) {
      filter.sellerEmail = access.seller.email;
    }

    const product = await Product.findOne(filter).maxTimeMS(5000);
    if (!product) return res.status(404).json({ error: 'Product not found or you do not have permission to edit it' });

    product.year = year || product.year;
    product.cost = cost !== undefined ? cost : product.cost;
    product.img = img || product.img;
    product.category = category || product.category;
    product.description = description || product.description;
    product.brand = brand !== undefined ? String(brand).trim() : (product.brand || product.sellerBusinessName);
    product.stock = stock !== undefined ? stock : product.stock;
    product.isActive = isActive !== undefined ? Boolean(isActive) : product.isActive;
    if (images !== undefined) product.images = Array.isArray(images) ? images.filter(Boolean).slice(0, 10) : [];
    if (variants !== undefined) product.variants = Array.isArray(variants) ? variants.slice(0, 20) : [];
    if (specifications !== undefined) product.specifications = specifications && typeof specifications === 'object' ? specifications : {};
    if (relatedProductIds !== undefined) product.relatedProductIds = Array.isArray(relatedProductIds) ? relatedProductIds.slice(0, 20) : [];
    product.updatedAt = new Date();

    await product.save();
    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const access = await requireProductManager(req, res);
    if (!access) return;

    if (!access.isSuperAdmin) {
      return res.status(403).json({ error: 'Only the super admin can delete products' });
    }
    if (!verifySuperAdminPin(req)) {
      return res.status(403).json({ error: 'A valid super admin PIN is required' });
    }

    const filter = { id: req.params.id };
    const requestedSellerEmail = req.headers['x-product-seller-email'];
    if (requestedSellerEmail) {
      filter.sellerEmail = String(requestedSellerEmail).toLowerCase();
    }

    const product = await Product.findOneAndDelete(filter).maxTimeMS(5000);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json({ message: 'Product deleted successfully', product });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== STATS ROUTES ==========

app.get('/api/stats', async (req, res) => {
  try {
    const { sellerEmail } = req.query;
    const access = await getAccessContext(req);
    if (sellerEmail) {
      if (!access?.canManageProducts) return res.status(403).json({ error: 'Seller or super admin access is required' });
      if (!access.isSuperAdmin && String(sellerEmail).toLowerCase() !== access.sessionUser.email.toLowerCase()) {
        return res.status(403).json({ error: 'You can only view your own seller statistics' });
      }
      const scopedSellerEmail = access.isSuperAdmin
        ? String(sellerEmail).toLowerCase()
        : access.sessionUser.email.toLowerCase();
      const products = await Product.find({ sellerEmail: scopedSellerEmail }).maxTimeMS(5000);
      const orders = await Order.find({ 'products.sellerEmail': scopedSellerEmail }).maxTimeMS(5000);
      
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => {
        const sellerItems = order.products.filter(p => p.sellerEmail === scopedSellerEmail);
        return sum + sellerItems.reduce((s, item) => s + (item.price * item.quantity), 0);
      }, 0);
      
      res.json({
        totalProducts: products.length,
        totalOrders,
        totalRevenue,
        activeProducts: products.filter(p => p.isActive).length
      });
    } else {
      if (!access?.isSuperAdmin) return res.status(403).json({ error: 'Super admin access is required' });
      let stats = await Stats.findOne().maxTimeMS(5000);
      if (!stats) {
        stats = await Stats.create({});
      }
      res.json(stats);
    }
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stats/view', async (req, res) => {
  try {
    let stats = await Stats.findOne().maxTimeMS(5000);
    if (!stats) {
      stats = await Stats.create({});
    }

    const today = new Date().toLocaleDateString();
    
    if (stats.lastViewDate !== today) {
      stats.todayViews = 1;
      stats.lastViewDate = today;
    } else {
      stats.todayViews += 1;
    }
    
    stats.totalViews += 1;
    stats.updatedAt = new Date();
    
    await stats.save();
    res.json(stats);
  } catch (error) {
    console.error('Track view error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== PRODUCT REVIEW ROUTES ==========

app.get('/api/reviews/product/:productId', async (req, res) => {
  try {
    const productId = String(req.params.productId || '').trim();
    if (!productId) return res.status(400).json({ error: 'Product ID is required' });

    const reviews = await Review.find({ productId })
      .select('-userEmail')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .maxTimeMS(5000);
    const summary = await Review.aggregate([
      { $match: { productId } },
      { $group: { _id: null, averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } }
    ]);

    res.json({
      reviews,
      averageRating: summary[0] ? Number(summary[0].averageRating.toFixed(1)) : 0,
      reviewCount: summary[0]?.reviewCount || 0
    });
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reviews/mine/:productId', async (req, res) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser?.email) return res.status(401).json({ error: 'Authentication is required' });
    const productId = String(req.params.productId || '').trim();
    if (!productId) return res.status(400).json({ error: 'Product ID is required' });

    const reviews = await Review.find({
      productId,
      userEmail: sessionUser.email.toLowerCase()
    }).select('orderId').lean().maxTimeMS(5000);

    res.json({ orderIds: reviews.map((review) => String(review.orderId)) });
  } catch (error) {
    console.error('Get my product review history error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser?.email) return res.status(401).json({ error: 'Please sign in to write a review' });

    const productId = String(req.body?.productId || '').trim();
    const orderId = String(req.body?.orderId || '').trim();
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || '').trim();

    if (!productId || !orderId) return res.status(400).json({ error: 'Product and order are required' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    if (comment.length > 1000) return res.status(400).json({ error: 'Review must be 1000 characters or less' });

    const order = await Order.findOne({
      _id: orderId,
      user: sessionUser.email.toLowerCase(),
      status: 'Delivered',
      'cart.id': productId
    }).lean().maxTimeMS(5000);

    if (!order) return res.status(403).json({ error: 'You can review this product only after it has been delivered to your account' });

    const product = await Product.findOne({ id: productId }).lean().maxTimeMS(5000);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const review = await Review.findOneAndUpdate(
      { productId, orderId, userEmail: sessionUser.email.toLowerCase() },
      {
        productId,
        orderId,
        userEmail: sessionUser.email.toLowerCase(),
        userName: sessionUser.name || sessionUser.email.split('@')[0],
        rating,
        comment,
        verifiedPurchase: true,
        updatedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const summary = await Review.aggregate([
      { $match: { productId } },
      { $group: { _id: null, averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } }
    ]);
    const averageRating = summary[0] ? Number(summary[0].averageRating.toFixed(1)) : 0;
    const reviewCount = summary[0]?.reviewCount || 0;

    await Product.updateMany({ id: productId }, { $set: { averageRating, reviewCount, updatedAt: new Date() } });

    res.status(201).json({ success: true, review, averageRating, reviewCount });
  } catch (error) {
    console.error('Submit review error:', error);
    if (error?.code === 11000) return res.status(409).json({ error: 'You have already reviewed this product for this order' });
    res.status(500).json({ error: error.message });
  }
});

// ========== ORDER ROUTES ==========

// Coupon management
const calculateCoupon = async (code, subtotal) => {
  const normalized = String(code || '').trim().toUpperCase();
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const coupon = await Coupon.findOne({ code: normalized, active: true }).lean().maxTimeMS(5000);
  if (!coupon) return { valid: false, error: 'Invalid, inactive, or expired coupon code' };
  if (coupon.expiresAt && new Date(coupon.expiresAt) <= new Date()) {
    return { valid: false, error: 'This coupon has expired' };
  }
  if (safeSubtotal < coupon.minSubtotal) {
    return { valid: false, error: `${coupon.code} requires a minimum subtotal of ₹${coupon.minSubtotal.toLocaleString('en-IN')}` };
  }

  const rawDiscount = coupon.type === 'percent'
    ? safeSubtotal * (coupon.value / 100)
    : coupon.type === 'fixed'
      ? coupon.value
      : 0;
  const discountAmount = Math.min(Math.round(rawDiscount), safeSubtotal);
  const discountedSubtotal = safeSubtotal - discountAmount;
  const shippingAmount = coupon.type === 'free_delivery' ? 0 : Math.round(discountedSubtotal * 0.05);
  const total = discountedSubtotal + shippingAmount;

  return {
    valid: true,
    coupon,
    discountAmount,
    discountedSubtotal,
    shippingAmount,
    total,
    message: coupon.type === 'free_delivery'
      ? `${coupon.code} applied — Free delivery`
      : `${coupon.code} applied — ${coupon.type === 'percent' ? coupon.value + '% off' : '₹' + coupon.value + ' off'}`
  };
};

app.post('/api/coupons/validate', async (req, res) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser?.email) return res.status(401).json({ error: 'Please sign in before applying a coupon' });
    const result = await calculateCoupon(req.body?.code, req.body?.subtotal);
    if (!result.valid) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/coupons', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.isSuperAdmin) return res.status(403).json({ error: 'Only the super admin can manage coupons' });
    res.json(await Coupon.find().sort({ createdAt: -1 }).maxTimeMS(5000));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/coupons', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.isSuperAdmin) return res.status(403).json({ error: 'Only the super admin can manage coupons' });

    const { code, type, value, minSubtotal, active, expiresAt } = req.body;
    const normalized = String(code || '').trim().toUpperCase();
    const numericValue = Number(value) || 0;
    const minimum = Math.max(0, Number(minSubtotal) || 0);
    if (!/^[A-Z0-9_-]{3,30}$/.test(normalized)) return res.status(400).json({ error: 'Coupon code must be 3–30 characters using letters, numbers, _ or -' });
    if (!['percent', 'fixed', 'free_delivery'].includes(type)) return res.status(400).json({ error: 'Invalid coupon type' });
    if ((type === 'percent' && (numericValue <= 0 || numericValue > 100)) || (type === 'fixed' && numericValue <= 0)) return res.status(400).json({ error: 'Enter a valid discount value' });
    if (type === 'free_delivery' && numericValue !== 0) return res.status(400).json({ error: 'Free delivery coupons do not need a discount value' });

    const coupon = await Coupon.create({
      code: normalized, type, value: type === 'free_delivery' ? 0 : numericValue,
      minSubtotal: minimum, active: active !== false,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });
    res.status(201).json(coupon);
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'That coupon code already exists' });
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/coupons/:id', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.isSuperAdmin) return res.status(403).json({ error: 'Only the super admin can manage coupons' });

    const { code, type, value, minSubtotal, active, expiresAt } = req.body;
    const normalized = String(code || '').trim().toUpperCase();
    const numericValue = Number(value) || 0;
    const minimum = Math.max(0, Number(minSubtotal) || 0);
    if (!/^[A-Z0-9_-]{3,30}$/.test(normalized)) return res.status(400).json({ error: 'Invalid coupon code' });
    if (!['percent', 'fixed', 'free_delivery'].includes(type)) return res.status(400).json({ error: 'Invalid coupon type' });
    if ((type === 'percent' && (numericValue <= 0 || numericValue > 100)) || (type === 'fixed' && numericValue <= 0)) return res.status(400).json({ error: 'Enter a valid discount value' });

    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      { code: normalized, type, value: type === 'free_delivery' ? 0 : numericValue, minSubtotal: minimum, active: active !== false, expiresAt: expiresAt ? new Date(expiresAt) : null, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    res.json(coupon);
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'That coupon code already exists' });
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/coupons/:id', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.isSuperAdmin) return res.status(403).json({ error: 'Only the super admin can manage coupons' });
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate unique tracking ID
const generateTrackingId = () => {
  const randomNum = Math.floor(100000 + Math.random() * 900000); // 6-digit number
  return `SM${randomNum}`;
};

// Create order with email notification
app.post('/api/orders', async (req, res) => {
  try {
    const { user, userName, items, subtotal, discountAmount, couponCode, shippingAmount, total, products, cart, address, paymentMethod } = req.body;
    if (String(paymentMethod || 'COD').toUpperCase() !== 'COD') {
      return res.status(400).json({ error: 'Only Cash on Delivery is available.' });
    }

    const sessionUser = getSessionUser(req);
    if (!sessionUser?.email || sessionUser.email.toLowerCase() !== String(user || '').toLowerCase()) {
      return res.status(403).json({ error: 'You can only place orders for your own account' });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty or invalid' });
    }

    const trustedProducts = [];
    let baseSubtotal = 0;

    for (const item of products) {
      const productId = String(item?.name || '').trim();
      const sellerEmail = String(item?.sellerEmail || '').trim().toLowerCase();
      const quantity = Number(item?.quantity);

      if (!productId || !sellerEmail || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({ error: 'Invalid product or quantity in cart' });
      }

      const product = await Product.findOne({
        id: productId,
        sellerEmail,
        isActive: true
      }).maxTimeMS(5000);

      if (!product) {
        return res.status(400).json({ error: `Product "${productId}" is no longer available from this seller` });
      }

      if (quantity > product.stock) {
        return res.status(400).json({ error: `Only ${product.stock} unit(s) of "${productId}" are available` });
      }

      const trustedPrice = Number(product.cost);
      baseSubtotal += trustedPrice * quantity;
      trustedProducts.push({
        name: product.id,
        quantity,
        price: trustedPrice,
        sellerEmail: product.sellerEmail,
        sellerName: product.sellerName
      });
    }

    baseSubtotal = Math.round(baseSubtotal);
    let calculatedDiscount = 0;
    let calculatedSubtotal = baseSubtotal;
    let calculatedShipping = Math.round(baseSubtotal * 0.05);
    let calculatedTotal = calculatedSubtotal + calculatedShipping;
    let normalizedCouponCode = '';

    if (couponCode) {
      const couponResult = await calculateCoupon(couponCode, baseSubtotal);
      if (!couponResult.valid) return res.status(400).json({ error: couponResult.error });
      calculatedDiscount = couponResult.discountAmount;
      calculatedSubtotal = couponResult.discountedSubtotal;
      calculatedShipping = couponResult.shippingAmount;
      calculatedTotal = couponResult.total;
      normalizedCouponCode = couponResult.coupon.code;
    }

    if (Math.round(Number(total) || 0) !== calculatedTotal) {
      return res.status(400).json({ error: 'Order total is out of sync. Please return to checkout and try again.' });
    }

    // Validate address
    if (!address || !address.name || !address.street || !address.city || !address.state || !address.pincode || !address.phone) {
      return res.status(400).json({ error: 'Complete address information is required' });
    }

    // Reserve stock atomically before creating the order.
    const reserved = [];
    let stockReserved = false;
    try {
      for (const item of trustedProducts) {
        const result = await Product.findOneAndUpdate(
          { id: item.name, sellerEmail: item.sellerEmail, isActive: true, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity }, $set: { updatedAt: new Date() } },
          { new: true }
        ).maxTimeMS(5000);
        if (!result) throw new Error(`Stock changed while checking "${item.name}". Please refresh and try again.`);
        reserved.push(item);
      }
      stockReserved = true;
    } catch (reservationError) {
      for (const item of reserved) {
        await Product.updateOne(
          { id: item.name, sellerEmail: item.sellerEmail },
          { $inc: { stock: item.quantity }, $set: { updatedAt: new Date() } }
        ).catch(() => {});
      }
      return res.status(409).json({ error: reservationError.message });
    }

    // Generate unique tracking ID
    let trackingId;
    let attempts = 0;
    do {
      trackingId = generateTrackingId();
      attempts++;
      if (attempts > 10) {
        return res.status(500).json({ error: 'Failed to generate unique tracking ID' });
      }
    } while (await Order.findOne({ trackingId }).maxTimeMS(5000));

    // Create order with both products (for summary) and cart (for display)
    const order = await Order.create({
      trackingId,
      user,
      userName,
      items: trustedProducts.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: calculatedSubtotal,
      discountAmount: calculatedDiscount,
      couponCode: normalizedCouponCode,
      shippingAmount: calculatedShipping,
      total: calculatedTotal,
      paymentMethod: 'COD',
      returnPolicy: 'No returns',
      products: trustedProducts,
      cart: trustedProducts.map((item) => {
        const source = Array.isArray(cart) ? cart.find((cartItem) =>
          String(cartItem?.id || '') === item.name
        ) : null;
        const product = {
          id: item.name,
          cost: item.price,
          img: source?.img || '',
          brand: source?.brand || '',
          category: source?.category || '',
          quantity: item.quantity
        };
        return product;
      }),  // Store trusted price/seller data with client display metadata
      address
    });

    stockReserved = false;

    // Update stats
    let stats = await Stats.findOne().maxTimeMS(5000);
    if (!stats) {
      stats = await Stats.create({});
    }

    const today = new Date().toLocaleDateString();
    
    if (stats.lastOrderDate !== today) {
      stats.todayOrders = 1;
      stats.lastOrderDate = today;
    } else {
      stats.todayOrders += 1;
    }
    
    stats.totalOrders += 1;
    stats.updatedAt = new Date();
    
    await stats.save();

    sendTemplateEmail('order_confirmation', order.user, { name: order.userName, email: order.user, orderId: order.trackingId, total: order.total, status: order.status });

    res.status(201).json({ 
      order, 
      stats, 
      message: 'Order created successfully' 
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const { sellerEmail, userEmail, limit } = req.query;
    const orderLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const sessionUser = getSessionUser(req);
    if (!sessionUser?.email) return res.status(401).json({ error: 'Authentication is required to view orders' });

    const sessionEmail = sessionUser.email.toLowerCase();
    const isSuperAdmin = sessionEmail === SUPER_ADMIN_EMAIL;
    let filter = {};

    if (userEmail) {
      if (String(userEmail).toLowerCase() !== sessionEmail && !isSuperAdmin) {
        return res.status(403).json({ error: 'You can only view your own order history' });
      }
      filter = { user: String(userEmail).toLowerCase() };
    } else if (sellerEmail) {
      const access = await getAccessContext(req);
      if (!access?.canManageProducts) return res.status(403).json({ error: 'Approved seller or super admin access is required' });
      filter = isSuperAdmin ? { 'products.sellerEmail': sellerEmail } : { 'products.sellerEmail': sessionEmail };
    } else {
      if (!isSuperAdmin) filter = { user: sessionEmail };
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(orderLimit).maxTimeMS(5000);
    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser?.email) return res.status(401).json({ error: 'Authentication is required' });

    const access = await getAccessContext(req);
    const order = await Order.findById(req.params.id).maxTimeMS(5000);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const isOwner = order.user.toLowerCase() === sessionUser.email.toLowerCase();
    const isSuperAdmin = Boolean(access?.isSuperAdmin);
    const isSellerForOrder = Boolean(
      access?.isSeller &&
      (order.products || []).some((item) => String(item.sellerEmail || '').toLowerCase() === sessionUser.email.toLowerCase())
    );

    if (!isOwner && !isSuperAdmin && !isSellerForOrder) {
      return res.status(403).json({ error: 'You do not have permission to view this order' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete order permanently from MongoDB
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only the super admin can delete orders' });
    }
    if (!verifySuperAdminPin(req)) {
      return res.status(403).json({ error: 'A valid super admin PIN is required' });
    }

    const order = await Order.findByIdAndDelete(req.params.id).maxTimeMS(5000);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    let stats = await Stats.findOne().maxTimeMS(5000);
    if (stats && stats.totalOrders > 0) {
      stats.totalOrders -= 1;
      stats.updatedAt = new Date();
      await stats.save();
    }

    res.json({ message: 'Order deleted permanently from database', deletedOrder: order });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update order status
app.put('/api/orders/:orderId/status', async (req, res) => {
  try {
    const access = await getAccessContext(req);
    if (!access?.canManageProducts) {
      return res.status(403).json({ error: 'Approved seller or super admin access is required' });
    }

    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['Order Placed', 'Processing', 'Shipped', 'Delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const statusFilter = { _id: orderId };
    if (!access.isSuperAdmin) {
      statusFilter['products.sellerEmail'] = access.sessionUser.email.toLowerCase();
    }

    const order = await Order.findOneAndUpdate(
      statusFilter,
      { status },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found or you do not manage any products in this order' });
    }

    sendTemplateEmail('order_status', order.user, { name: order.userName, email: order.user, orderId: order.trackingId, total: order.total, status: order.status });

    res.json({ message: 'Order status updated successfully', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

export default app;
