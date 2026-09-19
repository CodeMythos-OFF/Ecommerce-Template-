# ShopMaster 🛒

A modern full-stack e-commerce platform with MongoDB backend and Google/Microsoft OAuth authentication.

**Live Demo:** https://scs577738.vercel.app

## Features

### 🛍️ Shopping Experience
- Browse products with search and category filters
- Add to cart with quantity management
- Secure checkout process
- Responsive design for all devices

### 🔐 Authentication
- Google OAuth sign-in
- Microsoft OAuth sign-in
- Session management
- Per-user cart persistence

### 📊 Admin Dashboard
- Real-time statistics tracking
- Order management
- View analytics (total/today)
- Cross-browser data synchronization

### ☁️ Cloud Backend
- MongoDB Atlas cloud database
- RESTful API with Express.js
- Cross-browser order synchronization
- Automatic localStorage fallback

## Tech Stack

### Frontend
- **React** - UI framework
- **Vite** - Build tool
- **Bootstrap** - CSS framework
- **SweetAlert2** - Beautiful alerts
- **OAuth 2.0** - Authentication

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **CORS** - Cross-origin support

### Deployment
- **Vercel** - Frontend & Backend hosting
- **MongoDB Atlas** - Cloud database (FREE tier)

## Quick Start

### Prerequisites
- Node.js 18+ installed
- MongoDB Atlas account (FREE)
- npm or yarn

### 1. Clone Repository

```bash
git clone https://github.com/Rohan-Sivakumar/shop.git
cd shop
```

### 2. Install Dependencies

```bash
# Frontend
npm install

# Backend
cd server
npm install
cd ..
```

### 3. Setup MongoDB

Follow the complete guide: [MONGODB_SETUP.md](./MONGODB_SETUP.md)

Quick version:
1. Create MongoDB Atlas account
2. Create free cluster
3. Get connection string
4. Create `server/.env` with your connection string

### 4. Start Development Servers

```bash
# Terminal 1: Start backend
cd server
npm run dev

# Terminal 2: Start frontend
cd ..
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## Project Structure

```
shop/
├── src/                    # Frontend source
│   ├── App.jsx            # Main React component
│   ├── AdminPanel.jsx     # Admin dashboard
│   ├── Auth.jsx           # OAuth authentication
│   ├── api.js             # API service layer
│   └── ...
├── server/                # Backend source
│   ├── index.js           # Express server
│   ├── package.json       # Backend dependencies
│   └── .env.example       # Environment template
├── public/                # Static assets
├── MONGODB_SETUP.md       # MongoDB setup guide
├── DEPLOYMENT_GUIDE.md    # Deployment instructions
└── package.json           # Frontend dependencies
```

## Environment Variables

### Frontend (`.env`)
```env
VITE_API_URL=http://localhost:5000/api
```

### Backend (`server/.env`)
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/shopmaster
PORT=5000
```

## API Endpoints

### Statistics
- `GET /api/stats` - Get current statistics
- `POST /api/stats/view` - Track page view

### Orders
- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get specific order

### Health
- `GET /api/health` - Server health check

## Deployment

See detailed guide: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

### Quick Deploy

**Frontend (Already Deployed):**
- URL: https://scs577738.vercel.app

**Backend:**
```bash
cd server
vercel
```

Then update frontend environment variable `VITE_API_URL` with your backend URL.

## Features Roadmap

- [x] Product catalog with search/filter
- [x] Shopping cart management
- [x] Google OAuth authentication
- [x] Microsoft OAuth authentication
- [x] MongoDB cloud database
- [x] Admin dashboard
- [x] Cross-browser sync
- [ ] Payment gateway integration
- [ ] Order history for users
- [ ] Product reviews
- [ ] Wishlist functionality
- [ ] Email notifications

## Screenshots

### Home Page
Modern landing page with product showcase

### Product Catalog
Searchable and filterable product grid

### Admin Dashboard
Real-time statistics and order management

## Database Schema

### Orders Collection
```javascript
{
  user: String,        // User email
  userName: String,    // User display name
  items: Number,       // Total items count
  total: Number,       // Total price in ₹
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

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

ISC License - feel free to use for learning and personal projects!

## Author

**Rohan Sivakumar**
- GitHub: [@Rohan-Sivakumar](https://github.com/Rohan-Sivakumar)
- Email: rohan.sivaa@gmail.com

## Support

If you find this project helpful:
- ⭐ Star the repository
- 🐛 Report bugs via Issues
- 💡 Suggest features via Issues
- 🤝 Contribute via Pull Requests

## Acknowledgments

- Bootstrap for UI components
- MongoDB Atlas for free cloud database
- Vercel for free hosting
- Google & Microsoft for OAuth services

---

**Made with ❤️ in India**