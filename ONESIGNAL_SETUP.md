# OneSignal Push Notification Setup Guide

This guide will help you set up OneSignal push notifications for ShopMaster e-commerce platform.

## 🚀 Features

- 📧 Email notifications to admin (rohan.sivaa@gmail.com)
- 🔔 Real-time push notifications for new orders
- 📱 Works on desktop and mobile browsers
- 🎉 Beautiful notification UI with order details

## 🛠️ Backend Setup (Already Done!)

The backend is already configured with:
- OneSignal Node.js SDK (`@onesignal/node-onesignal`)
- Automatic notification sending when orders are created
- Email + Push notification combo

## 🌐 OneSignal Dashboard Setup

### Step 1: Create OneSignal Account

1. Go to [OneSignal](https://onesignal.com/)
2. Click **"Get Started Free"**
3. Sign up with your email or Google account

### Step 2: Create a New App

1. After login, click **"New App/Website"**
2. Name your app: **"ShopMaster"**
3. Select platform: **"Web Push"**
4. Click **"Next: Configure Your Platform"**

### Step 3: Configure Web Push

#### Choose Configuration Type:
Select **"Typical Site"** (recommended for most websites)

#### Site Setup:
1. **Site Name**: `ShopMaster`
2. **Site URL**: `https://scs577738.vercel.app`
3. **Auto Resubscribe**: Toggle ON
4. **Default Notification Icon**: Upload your logo (optional)

#### Permission Prompt:
- Choose when to show the subscription prompt:
  - **Slide Prompt**: Shows a subtle slide-in prompt
  - **Custom Code**: For advanced control

Recommended: Use **Slide Prompt** with:
- **Auto-prompt**: After 30 seconds on page
- **Prompt text**: "Get notified about new products and deals!"

### Step 4: Get Your Credentials

1. After setup, go to **Settings** → **Keys & IDs**
2. Copy these values:
   - **App ID** (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
   - **REST API Key** (e.g., `OWVhZGI3YmQt...`)

### Step 5: Update Environment Variables

Add to your `server/.env` file:

```env
ONESIGNAL_APP_ID=your_app_id_here
ONESIGNAL_REST_API_KEY=your_rest_api_key_here
```

## 👨‍💻 Frontend Integration (React)

### Step 1: Add OneSignal Script to HTML

Update your `public/index.html` or `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ShopMaster</title>
  
  <!-- OneSignal Web SDK -->
  <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

### Step 2: Initialize OneSignal in Your App

Create a new file `src/utils/oneSignal.js`:

```javascript
export const initOneSignal = () => {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  
  window.OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
      appId: "YOUR_ONESIGNAL_APP_ID", // Replace with your App ID
      safari_web_id: "web.onesignal.auto.YOUR_ID", // Optional: for Safari
      notifyButton: {
        enable: true,
      },
      allowLocalhostAsSecureOrigin: true, // For local development
      welcomeNotification: {
        title: "ShopMaster",
        message: "Thanks for subscribing! You'll get notified about new orders.",
      },
    });
    
    // Optional: Check subscription status
    const isSubscribed = await OneSignal.User.PushSubscription.optedIn;
    console.log('Push subscription status:', isSubscribed);
    
    // Optional: Add tags for user segmentation
    OneSignal.User.addTag("user_type", "admin");
  });
};
```

### Step 3: Initialize in Your Main Component

Update `src/App.jsx` or `src/main.jsx`:

```javascript
import { useEffect } from 'react';
import { initOneSignal } from './utils/oneSignal';

function App() {
  useEffect(() => {
    // Initialize OneSignal when app loads
    if (typeof window !== 'undefined') {
      initOneSignal();
    }
  }, []);

  return (
    // Your app components
  );
}

export default App;
```

### Alternative: Simple Inline Initialization

Or add directly to your `App.jsx`:

```javascript
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      await OneSignal.init({
        appId: "YOUR_ONESIGNAL_APP_ID",
        allowLocalhostAsSecureOrigin: true,
      });
    });
  }, []);

  return (
    // Your app
  );
}
```

## 🧪 Testing

### Test Backend Setup:

1. Install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Start server:
   ```bash
   npm run dev
   ```

3. Check console for:
   ```
   ✅ OneSignal configured
   ```

### Test Push Notifications:

1. Open your website: `https://scs577738.vercel.app`
2. Allow notification permissions when prompted
3. Check OneSignal dashboard → **Audience** → **All Users** (should show 1+ subscribers)
4. Create a test order through your app
5. You should receive:
   - 📧 Email to rohan.sivaa@gmail.com
   - 🔔 Push notification on your browser

### Manual Test from OneSignal Dashboard:

1. Go to OneSignal → **Messages** → **New Push**
2. **Message**: "Test notification from ShopMaster"
3. **Audience**: All Subscribed Users
4. Click **Send Message**

## 📝 Notification Content

When an order is placed, the notification includes:

- **Title**: 🎉 New Order Received!
- **Message**: `{userName} ordered {items} item(s) for ₹{total}`
- **Subtitle**: List of products ordered
- **Click Action**: Opens admin orders page
- **Icon**: Your ShopMaster logo

## ⚡ Advanced Features

### Segment Users:

Add tags to users for targeted notifications:

```javascript
OneSignal.User.addTag("user_type", "admin");
OneSignal.User.addTag("location", "salem");
```

### Custom Notification Buttons:

```javascript
const notification = new OneSignal.Notification();
notification.buttons = [
  { id: "view-order", text: "View Order", icon: "ic_menu_view" },
  { id: "mark-complete", text: "Mark Complete", icon: "ic_menu_check" }
];
```

### Listen for Notification Clicks:

```javascript
OneSignal.Notifications.addEventListener('click', (event) => {
  console.log('Notification clicked:', event);
  // Handle navigation or actions
});
```

## 🛡️ Security Notes

- Never commit your REST API Key to public repositories
- Use environment variables for all credentials
- REST API Key is only used on the server-side
- App ID is safe to expose on the frontend

## 🐛 Troubleshooting

### Push Notifications Not Working?

1. **Check browser support**: Chrome, Firefox, Safari (macOS), Edge
2. **Verify HTTPS**: Web push requires HTTPS (not HTTP)
3. **Check permissions**: Allow notifications in browser settings
4. **Check credentials**: Verify App ID and REST API Key in `.env`
5. **Check console**: Look for OneSignal initialization errors

### Subscription Issues?

```javascript
// Check subscription status
OneSignal.User.PushSubscription.optedIn.then(isOptedIn => {
  console.log('Opted in:', isOptedIn);
});

// Manually prompt for subscription
OneSignal.Slidedown.promptPush();
```

### Not Receiving on Mobile?

- iOS Safari: Requires adding to Home Screen first
- Android Chrome: Should work directly
- Check notification permissions in phone settings

## 📊 Analytics

View notification analytics in OneSignal dashboard:
- **Delivery** → **Messages** → Select message
- See: Sent, Delivered, Clicked, Conversion rates

## 🔗 Useful Links

- [OneSignal Dashboard](https://app.onesignal.com/)
- [OneSignal React Documentation](https://documentation.onesignal.com/docs/react-js-setup)
- [Web Push API Documentation](https://documentation.onesignal.com/docs/web-push-setup)
- [Node.js SDK Documentation](https://github.com/OneSignal/node-onesignal)

## ✅ Checklist

- [ ] Created OneSignal account
- [ ] Created new app for ShopMaster
- [ ] Configured web push settings
- [ ] Copied App ID and REST API Key
- [ ] Updated server `.env` file
- [ ] Added OneSignal script to HTML
- [ ] Initialized OneSignal in React app
- [ ] Tested subscription on website
- [ ] Created test order
- [ ] Verified email received
- [ ] Verified push notification received
- [ ] Deployed to Vercel

## 🎉 You're All Set!

Your ShopMaster platform now has:
- ✅ Email notifications
- ✅ Push notifications  
- ✅ Real-time order alerts
- ✅ Multi-channel communication

Every new order will trigger both email and push notifications to keep you instantly informed! 🚀