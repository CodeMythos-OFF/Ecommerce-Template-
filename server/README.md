# ShopMaster Backend Server

Express.js backend with MongoDB for ShopMaster e-commerce platform.

## Features

✅ RESTful API for orders and statistics
✅ MongoDB database integration
✅ Cross-browser data synchronization
✅ Real-time stats tracking
✅ CORS enabled for frontend communication

## Installation

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Setup MongoDB

**Option A: Local MongoDB**
1. Install MongoDB locally: https://www.mongodb.com/try/download/community
2. Start MongoDB service
3. Use default connection: `mongodb://localhost:27017/shopmaster`

**Option B: MongoDB Atlas (Cloud - Free)**
1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get connection string
4. Update `.env` file

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your MongoDB connection string.

### 4. Start Server

```bash
# Development mode (auto-restart on changes)
npm run dev

# Production mode
npm start
```

Server runs on: http://localhost:5000

## API Endpoints

### Health Check
```
GET /api/health
```

### Statistics
```
GET  /api/stats           # Get current stats
POST /api/stats/view      # Track page view
```

### Orders
```
GET  /api/orders          # Get all orders (limit=50)
GET  /api/orders/:id      # Get specific order
POST /api/orders          # Create new order
```

### Example: Create Order

```javascript
POST /api/orders
Content-Type: application/json

{
  "user": "user@example.com",
  "userName": "John Doe",
  "items": 3,
  "total": 15999,
  "products": [
    {
      "name": "Wireless Headphone",
      "quantity": 1,
      "price": 9999
    }
  ]
}
```

## Database Schema

### Orders Collection
```javascript
{
  user: String,        // User email
  userName: String,    // User display name
  items: Number,       // Total items count
  total: Number,       // Total price
  products: [{         // Order items
    name: String,
    quantity: Number,
    price: Number
  }],
  createdAt: Date      // Auto-generated
}
```

### Stats Collection
```javascript
{
  totalViews: Number,
  totalOrders: Number,
  todayViews: Number,
  todayOrders: Number,
  lastViewDate: String,
  lastOrderDate: String,
  updatedAt: Date
}
```

## Deployment

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard

### Deploy to Railway

1. Push code to GitHub
2. Connect repository to Railway
3. Add MongoDB connection string as environment variable
4. Deploy!

## Troubleshooting

### MongoDB Connection Error
- Check if MongoDB service is running
- Verify connection string in `.env`
- For Atlas: Whitelist your IP address

### CORS Issues
- Server already has CORS enabled for all origins
- For production, restrict origins in `cors()` config

### Port Already in Use
- Change PORT in `.env` file
- Or kill process: `lsof -ti:5000 | xargs kill`

## Tech Stack

- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **CORS** - Cross-origin support
- **dotenv** - Environment variables