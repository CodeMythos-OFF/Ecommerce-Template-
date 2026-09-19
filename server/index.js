import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://scs577738.vercel.app',
    'https://shopmaster-mobile.vercel.app'
  ],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'rohan.sivaa@gmail.com',
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Verify email configuration
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Email configuration error:', error.message);
  } else {
    console.log('✅ Email server ready to send messages');
  }
});

// MongoDB Connection with proper error handling
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shopmaster';

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
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4
    });
    
    isConnected = true;
    console.log('✅ Connected to MongoDB');
    
    await initializeData();
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    isConnected = false;
    
    console.log('⏳ Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectDB, 5000);
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
  sellerName: { type: String, required: true },
  sellerBusinessName: { type: String, required: true },
  stock: { type: Number, default: 100 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.index({ id: 1, sellerEmail: 1 }, { unique: true });

const Product = mongoose.model('Product', productSchema);

// Order Schema (updated with cart field for complete product details)
const orderSchema = new mongoose.Schema({
  trackingId: { type: String, required: true, unique: true },
  user: { type: String, required: true },
  userName: { type: String, required: true },
  items: { type: Number, required: true },
  total: { type: Number, required: true },
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
    country: { type: String }
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

// Email template function
const createOrderEmailHTML = (orderData) => {
  const productRows = orderData.products.map(p => `
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;">${p.name}</td>
      <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${p.quantity}</td>
      <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${p.price.toFixed(2)}</td>
      <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${(p.price * p.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ff9900; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 18px; font-weight: bold; color: #ff9900; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #232f3e; color: white; padding: 10px; text-align: left; }
        .total { font-size: 20px; font-weight: bold; color: #b12704; text-align: right; margin-top: 15px; }
        .footer { text-align: center; margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 0 0 5px 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 New Order Received!</h1>
        </div>
        <div class="content">
          <div class="section">
            <div class="section-title">📦 Order Details</div>
            <p><strong>Tracking ID:</strong> <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${orderData.trackingId}</code></p>
            <p><strong>Order Date:</strong> ${new Date(orderData.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
            <p><strong>Total Items:</strong> ${orderData.items}</p>
          </div>

          <div class="section">
            <div class="section-title">👤 Customer Information</div>
            <p><strong>Name:</strong> ${orderData.userName}</p>
            <p><strong>Email:</strong> ${orderData.user}</p>
          </div>

          <div class="section">
            <div class="section-title">📍 Delivery Address</div>
            <p><strong>Name:</strong> ${orderData.address.name}</p>
            <p><strong>Address:</strong> ${orderData.address.street}</p>
            <p><strong>City:</strong> ${orderData.address.city}</p>
            <p><strong>State:</strong> ${orderData.address.state}</p>
            <p><strong>Pincode:</strong> ${orderData.address.pincode}</p>
            <p><strong>Phone:</strong> ${orderData.address.phone}</p>
          </div>

          <div class="section">
            <div class="section-title">🛒 Products Ordered</div>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Price</th>
                  <th style="text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${productRows}
              </tbody>
            </table>
            <div class="total">Total: ₹${orderData.total.toFixed(2)}</div>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated notification from ShopMaster</p>
          <p style="color: #666; font-size: 12px;">Do not reply to this email</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send order notification email
const sendOrderEmail = async (orderData) => {
  try {
    const mailOptions = {
      from: `ShopMaster <${process.env.EMAIL_USER || 'rohan.sivaa@gmail.com'}>`,
      to: orderData.user, // Send to customer's email address
      subject: `🛒 Order Confirmation - ₹${orderData.total.toFixed(2)} - ${orderData.userName}`,
      html: createOrderEmailHTML(orderData)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Order confirmation email sent to:', orderData.user, 'Message ID:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Error sending order email:', error.message);
    throw error;
  }
};



// Initialize all data
const initializeData = async () => {
  try {
    const stats = await Stats.findOne();
    if (!stats) {
      await Stats.create({});
      console.log('📊 Stats initialized');
    }

    const superAdmin = await Seller.findOne({ email: 'rohan.sivaa@gmail.com' });
    if (!superAdmin) {
      await Seller.create({
        email: 'rohan.sivaa@gmail.com',
        name: 'Rohan',
        businessName: 'ShopMaster',
        isApproved: true,
        isSuperAdmin: true
      });
      console.log('👑 Super admin seller initialized');
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    database: isConnected ? 'connected' : 'connecting...',
    email: transporter ? 'configured' : 'not configured'
  });
});

// ========== AUTHENTICATION ROUTES ==========

/**
 * Google OAuth 2.0 Token Exchange
 * Exchanges authorization code for ID token and user info
 * This is called by the backend to securely exchange the code
 */
app.post('/api/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code || !state) {
      return res.status(400).json({ 
        error: 'Missing required parameters: code and state' 
      });
    }

    // IMPORTANT: In production, verify the state against a stored value
    // and exchange the code for tokens via Google's token endpoint
    // This requires your Google OAuth client secret (keep it server-side only!)

    // For now, we'll return a mock response
    // In production, implement actual Google token exchange here

    const mockUserData = {
      provider: 'google',
      email: 'user@example.com',
      name: 'User Name',
      picture: 'https://via.placeholder.com/80',
      sub: 'google-user-id',
      loginTime: new Date().toISOString(),
    };

    // In production:
    // 1. Verify state
    // 2. Exchange code for tokens using Google's OAuth endpoint
    // 3. Extract user info from ID token
    // 4. Create/update user in database if needed

    res.json({
      success: true,
      user: mockUserData,
      token: 'mock-jwt-token', // Replace with actual JWT token in production
    });
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== SELLER ROUTES ==========

app.post('/api/sellers/register', async (req, res) => {
  try {
    const { email, name, businessName, phone, address } = req.body;
    
    const existing = await Seller.findOne({ email }).maxTimeMS(5000);
    if (existing) {
      return res.status(400).json({ error: 'Seller already registered with this email' });
    }
    
    const seller = await Seller.create({
      email,
      name,
      businessName,
      phone,
      address,
      isApproved: email === 'rohan.sivaa@gmail.com'
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
    const sellers = await Seller.find().sort({ createdAt: -1 }).maxTimeMS(5000);
    res.json(sellers);
  } catch (error) {
    console.error('Get all sellers error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sellers/:email/approve', async (req, res) => {
  try {
    const seller = await Seller.findOneAndUpdate(
      { email: req.params.email },
      { isApproved: true, updatedAt: new Date() },
      { new: true }
    ).maxTimeMS(5000);
    
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }
    
    res.json(seller);
  } catch (error) {
    console.error('Approve seller error:', error);
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
    const products = await Product.find({ sellerEmail: req.params.email }).sort({ createdAt: -1 }).maxTimeMS(5000);
    res.json(products);
  } catch (error) {
    console.error('Get seller products error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id }).maxTimeMS(5000);
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
    const { id, year, cost, img, category, description, sellerEmail } = req.body;
    
    const seller = await Seller.findOne({ email: sellerEmail }).maxTimeMS(5000);
    if (!seller) {
      return res.status(403).json({ error: 'Seller not registered' });
    }
    if (!seller.isApproved) {
      return res.status(403).json({ error: 'Seller account pending approval' });
    }
    
    const existing = await Product.findOne({ id, sellerEmail }).maxTimeMS(5000);
    if (existing) {
      return res.status(400).json({ error: 'You already have a product with this name' });
    }
    
    const product = await Product.create({
      id,
      year,
      cost,
      img,
      category,
      description,
      sellerEmail,
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
    const { year, cost, img, category, description, sellerEmail, stock, isActive } = req.body;
    
    const product = await Product.findOne({ id: req.params.id, sellerEmail }).maxTimeMS(5000);
    if (!product) {
      return res.status(404).json({ error: 'Product not found or you do not have permission to edit it' });
    }
    
    product.year = year || product.year;
    product.cost = cost !== undefined ? cost : product.cost;
    product.img = img || product.img;
    product.category = category || product.category;
    product.description = description || product.description;
    product.stock = stock !== undefined ? stock : product.stock;
    product.isActive = isActive !== undefined ? isActive : product.isActive;
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
    const { sellerEmail } = req.query;
    
    const product = await Product.findOneAndDelete({ id: req.params.id, sellerEmail }).maxTimeMS(5000);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found or you do not have permission to delete it' });
    }
    
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
    
    if (sellerEmail) {
      const products = await Product.find({ sellerEmail }).maxTimeMS(5000);
      const orders = await Order.find({ 'products.sellerEmail': sellerEmail }).maxTimeMS(5000);
      
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => {
        const sellerItems = order.products.filter(p => p.sellerEmail === sellerEmail);
        return sum + sellerItems.reduce((s, item) => s + (item.price * item.quantity), 0);
      }, 0);
      
      res.json({
        totalProducts: products.length,
        totalOrders,
        totalRevenue,
        activeProducts: products.filter(p => p.isActive).length
      });
    } else {
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

// ========== ORDER ROUTES ==========

// Generate unique tracking ID
const generateTrackingId = () => {
  const randomNum = Math.floor(100000 + Math.random() * 900000); // 6-digit number
  return `SM${randomNum}`;
};

// Create order with email notification
app.post('/api/orders', async (req, res) => {
  try {
    const { user, userName, items, total, products, cart, address } = req.body;

    // Validate address
    if (!address || !address.name || !address.street || !address.city || !address.state || !address.pincode || !address.phone) {
      return res.status(400).json({ error: 'Complete address information is required' });
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
      items,
      total,
      products,
      cart: cart || [],  // Store full cart items with images and details
      address
    });

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

    // Send email notification (non-blocking)
    sendOrderEmail(order).catch(err => {
      console.error('Email sending failed (non-blocking):', err.message);
    });

    res.status(201).json({ 
      order, 
      stats, 
      message: 'Order created successfully, email notification will be sent' 
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const { sellerEmail, limit } = req.query;
    const orderLimit = parseInt(limit) || 50;
    
    let orders;
    if (sellerEmail) {
      orders = await Order.find({ 'products.sellerEmail': sellerEmail })
        .sort({ createdAt: -1 })
        .limit(orderLimit)
        .maxTimeMS(5000);
    } else {
      orders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(orderLimit)
        .maxTimeMS(5000);
    }
    
    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).maxTimeMS(5000);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
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
    const order = await Order.findByIdAndDelete(req.params.id).maxTimeMS(5000);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Update stats - decrease total orders count
    let stats = await Stats.findOne().maxTimeMS(5000);
    if (stats && stats.totalOrders > 0) {
      stats.totalOrders -= 1;
      stats.updatedAt = new Date();
      await stats.save();
    }
    
    res.json({ 
      message: 'Order deleted permanently from database', 
      deletedOrder: order 
    });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update order status
app.put('/api/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['Order Placed', 'Processing', 'Shipped', 'Delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

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
