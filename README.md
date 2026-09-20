# ShopMaster 🛒

> A modern full-stack e-commerce platform built with React, Express.js, MongoDB Atlas, and Google authentication.

ShopMaster is a responsive e-commerce application with a product catalog, user accounts, carts, orders, seller management, and a super-administrator dashboard.

## 🌐 Project Links

- **Frontend:** https://testsampleindev.vercel.app
- **Backend:** https://backend-cm-test.vercel.app
- **GitHub:** https://github.com/CodeMythos-OFF/Ecommerce-Template-

## ✨ Features

### 🛍️ Customer Shopping
- Product search and category filtering
- Detailed product pages
- Product images, descriptions, pricing, stock, brand, and seller information
- Add-to-cart and quantity management
- Per-user cart persistence
- Responsive desktop, tablet, and mobile UI
- Checkout and order creation
- Shipping calculated at **5% of subtotal**

### 🔐 Authentication
- Google Sign-In
- Persistent authenticated sessions
- Session restoration and logout
- Authenticated API requests
- Per-user cart separation

### 🏪 Seller System
- **Become a Seller** application page
- Seller applications require administrator approval
- Unique seller name and business/brand information
- Seller data stored in MongoDB
- Approved sellers can manage their own products
- Seller order-status management
- Seller access can be revoked by the super administrator

### 👑 Super Administrator
The super administrator has platform-wide management access:
- Manage products across sellers
- Create products for approved sellers
- View seller information
- Approve or revoke seller applications
- View platform orders
- Delete protected products and orders using the configured administrator PIN

### 📦 Product Management
Products support IDs, names, brands, categories, descriptions, prices, stock, model year, images, seller information, active status, and timestamps.

### 📋 Order Management
Orders include customer information, products, quantities, subtotal, shipping, final total, address/phone details, and order status.

## 🧱 Technology Stack

**Frontend**
- React
- Vite
- JavaScript / JSX
- CSS
- SweetAlert2
- Google Identity Services

**Backend**
- Node.js
- Express.js
- MongoDB
- Mongoose
- Google OAuth verification
- HMAC-based session tokens
- CORS

**Deployment**
- Vercel
- MongoDB Atlas

## 📁 Project Structure

```
Ecommerce-Template-/
├── public/
├── src/
│   ├── App.jsx
│   ├── AdminPanel.jsx
│   ├── Auth.jsx
│   ├── Navigation.jsx
│   ├── SellerApplication.jsx
│   ├── api.js
│   ├── cartService.js
│   └── ...
├── server/
│   ├── index.js
│   ├── package.json
│   └── .env.example
├── MONGODB_SETUP.md
├── DEPLOYMENT_GUIDE.md
├── package.json
└── README.md
```

## 🚀 Run Locally

### Requirements
- Node.js 18+
- npm
- MongoDB Atlas or local MongoDB
- Google OAuth credentials for development

### Clone

```bash
git clone https://github.com/CodeMythos-OFF/Ecommerce-Template-.git
cd Ecommerce-Template-
```

### Install

```bash
npm install
cd server
npm install
cd ..
```

### Backend environment

Create `server/.env`:

```env
MONGODB_URI=your_mongodb_connection_string
AUTH_SESSION_SECRET=your_long_random_secret
PORT=5000
```

For production, use a strong random session secret of at least 32 characters.

### Start backend

```bash
cd server
npm run dev
```

Backend: `http://localhost:5000`

### Start frontend

In another terminal:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

## 🔧 Environment Variables

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `AUTH_SESSION_SECRET` | Secret used to sign authentication sessions |
| `PORT` | Local backend port |
| `SUPER_ADMIN_DELETE_PIN` | Optional protected-deletion PIN |

**Never commit database credentials, session secrets, or other private credentials to GitHub.**

## 🔑 API Overview

### Authentication
```
POST /api/auth/google
GET  /api/auth/me
POST /api/auth/logout
```

### Products
```
GET    /api/products
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
```

### Sellers
```
POST /api/sellers/apply
GET  /api/sellers
PUT  /api/sellers/:email/approve
PUT  /api/sellers/:email/revoke
```

### Orders
```
GET    /api/orders
POST   /api/orders
PUT    /api/orders/:id/status
DELETE /api/orders/:id
```

## 🔐 Permission Model

| Account type | Product access | Order access | Seller approvals |
|---|---|---|---|
| Customer | View | Customer checkout | Apply |
| Approved Seller | Own products | Relevant orders | No |
| Super Admin | All products | All orders | Approve / revoke |

Permissions are enforced by the backend.

## 💰 Pricing

Current checkout calculation:

```
Shipping = Subtotal × 5%
Total = Subtotal + Shipping
```

Shipping is displayed separately from the product subtotal.

## 🗄️ Main Database Collections

- **Products** — catalog, pricing, stock, and seller ownership
- **Sellers** — applications, business information, and approval state
- **Orders** — customer/order details, products, totals, address, and status
- **Stats** — application statistics

## 🌍 Deployment

Current deployment:
- Frontend: `testsampleindev.vercel.app`
- Backend: `backend-cm-test.vercel.app`
- Database: MongoDB Atlas

The production frontend uses a same-origin `/api` route that is rewritten to the deployed backend.

See **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** for deployment information.

## 🛡️ Security Notes

- Authentication is verified by the backend.
- Authenticated API requests use session credentials.
- Seller permissions are checked server-side.
- Protected deletion operations require an additional administrator PIN.
- MongoDB credentials and session secrets must remain in environment variables.
- Google OAuth origins must match the deployed application.

## 🗺️ Roadmap

- [ ] Payment gateway integration
- [ ] User order history
- [ ] Product reviews and ratings
- [ ] Wishlist
- [ ] Seller analytics
- [ ] Inventory alerts
- [ ] Advanced product specifications
- [ ] Order tracking
- [ ] Seller storefronts
- [ ] Notifications

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test locally.
5. Commit and push.
6. Open a Pull Request.

For bugs and feature requests, use GitHub Issues.

## 📞 Contact

**CodeMythos**

- GitHub: https://github.com/CodeMythos-OFF
- Repository: https://github.com/CodeMythos-OFF/Ecommerce-Template-
- Email: **codemythos@outlook.com**

For bugs, feature requests, and project discussions, please use GitHub Issues.

## 📄 License

This project uses the license specified in the repository. Check the repository license before redistribution or commercial use.

---

<div align="center">

**ShopMaster 🛒**

Built with React, Node.js, Express, MongoDB, and Vercel.

</div>
