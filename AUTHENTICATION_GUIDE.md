# Future Authentication & License Implementation Guide

## ✅ Current Status (Prepared for Future)

### Files Created
- `electron/auth.js` - Authentication module (placeholder with TODO comments)
- `electron/license.js` - License validation module (placeholder with TODO comments)
- `.env.example` - Environment variables template

### Settings Structure Ready
```javascript
settings: {
  // User info (currently used throughout app)
  userName: 'ilhan.yalcin',
  workspaceName: 'workspace_1',
  userEmail: '',
  
  // License fields (added, not yet used)
  licenseKey: '',
  licensePlan: 'free',
  licenseExpiry: null,
  lastLicenseCheck: null,
  sessionToken: ''
}
```

### Code Already Uses Settings
✓ All new records use `settings.userName` instead of hardcoded values
✓ All new records use `settings.workspaceName` instead of hardcoded values
✓ Ready for authentication integration with minimal refactoring

---

## 🚀 Implementation Steps (When Ready)

### Phase 1: Backend Setup (Week 1)

#### Option 1: Supabase (Recommended)
```bash
# 1. Create Supabase project
# 2. Setup authentication
# 3. Create users table
# 4. Create licenses table
# 5. Add environment variables to .env
```

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  subscription_status TEXT DEFAULT 'free',
  subscription_expires_at TIMESTAMP
);

-- Licenses table
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  license_key TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL, -- 'monthly', 'yearly'
  active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Option 2: Firebase
```bash
# 1. Create Firebase project
# 2. Enable Authentication
# 3. Setup Firestore
# 4. Add environment variables to .env
```

---

### Phase 2: Electron Integration (Week 2)

#### 1. Implement auth.js
```javascript
// electron/auth.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Store session token
  const settings = store.get('settings', {});
  store.set('settings', {
    ...settings,
    sessionToken: data.session.access_token,
    userEmail: email
  });
  
  return { success: true, user: data.user };
}
```

#### 2. Implement license.js
```javascript
// electron/license.js
async function validateOnline() {
  const settings = store.get('settings', {});
  const { sessionToken } = settings;
  
  // Call backend API
  const response = await fetch(`${API_URL}/api/license/validate`, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`
    }
  });
  
  const data = await response.json();
  
  // Update local license info
  store.set('settings', {
    ...settings,
    licenseExpiry: data.expiryDate,
    lastLicenseCheck: new Date().toISOString()
  });
  
  return { success: true, valid: data.active };
}
```

#### 3. Add startup check in main.js
```javascript
// electron/main.js
const auth = require('./auth');
const license = require('./license');

app.whenReady().then(async () => {
  // Check if authenticated
  if (!auth.isAuthenticated()) {
    // Show login window
    createLoginWindow();
    return;
  }
  
  // Check license
  const licenseCheck = await license.canStartApp();
  if (!licenseCheck.canStart) {
    // Show license expired window
    createLicenseExpiredWindow(licenseCheck.reason);
    return;
  }
  
  // All good - start app
  createWindow();
});
```

---

### Phase 3: React UI Components (Week 2)

#### 1. Create LoginScreen.jsx
```jsx
// src/components/LoginScreen.jsx
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleLogin = async () => {
    setLoading(true);
    const result = await window.electronAPI.login(email, password);
    
    if (result.success) {
      onLogin(result.user);
    } else {
      alert(result.error);
    }
    
    setLoading(false);
  };
  
  return (
    <div className="login-container">
      <h1>TripInConnect</h1>
      <input 
        type="email" 
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input 
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button onClick={handleLogin} disabled={loading}>
        {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
      </button>
    </div>
  );
}
```

#### 2. Update preload.js
```javascript
// electron/preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods
  
  // Auth methods
  login: (email, password) => ipcRenderer.invoke('auth:login', email, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  
  // License methods
  validateLicense: () => ipcRenderer.invoke('license:validate'),
  getLicenseInfo: () => ipcRenderer.invoke('license:getInfo')
});
```

---

### Phase 4: Payment Integration (Week 3)

#### Stripe Setup
```javascript
// Backend API endpoint
app.post('/api/create-checkout-session', async (req, res) => {
  const { plan, userId } = req.body;
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price: plan === 'monthly' ? 'price_monthly_id' : 'price_yearly_id',
      quantity: 1
    }],
    mode: 'subscription',
    success_url: 'tripinconnect://payment-success',
    cancel_url: 'tripinconnect://payment-cancel',
    metadata: { userId }
  });
  
  res.json({ url: session.url });
});

// Webhook handler
app.post('/api/webhook', async (req, res) => {
  const event = req.body;
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Update user subscription in database
    await updateUserSubscription(session.metadata.userId, {
      active: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
  }
  
  res.json({ received: true });
});
```

---

## 🔒 Security Best Practices

### 1. Never Store Secrets in Code
```javascript
// ❌ Bad
const API_KEY = 'sk_test_abc123';

// ✅ Good
const API_KEY = process.env.STRIPE_SECRET_KEY;
```

### 2. Encrypt Sensitive Data
```javascript
// Encrypt license before storing
const encrypted = crypto.createCipher('aes-256-cbc', secret)
  .update(licenseData, 'utf8', 'hex');
```

### 3. Use HTTPS for API Calls
```javascript
// Never use http:// in production
const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.tripinconnect.com'
  : 'http://localhost:3000';
```

---

## 📦 Required NPM Packages (Install When Implementing)

```bash
# Supabase client
npm install @supabase/supabase-js

# OR Firebase
npm install firebase

# Stripe
npm install stripe

# Encryption
npm install crypto-js

# HTTP client (if needed)
npm install axios
```

---

## 📚 Documentation Links

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Stripe Docs](https://stripe.com/docs)
- [Electron Security Guide](https://www.electronjs.org/docs/latest/tutorial/security)

---

## ⚠️ Important Notes

1. **Test in Development First**
   - Use Stripe test mode
   - Test license validation offline
   - Test grace period functionality

2. **User Data Privacy**
   - Comply with GDPR if EU users
   - Clear privacy policy
   - Data deletion on request

3. **Error Handling**
   - Handle network failures gracefully
   - Show user-friendly error messages
   - Log errors for debugging

4. **Backup Before Auth**
   - Backup system already implemented ✓
   - Users won't lose data during auth migration

---

## 🎯 Current vs Future Data Flow

### Current (No Auth)
```
User opens app → App starts → Uses local settings
```

### Future (With Auth)
```
User opens app 
  → Check if logged in
    → No → Show login screen
    → Yes → Check license validity
      → Invalid → Show renewal screen
      → Valid (or grace period) → App starts
        → Periodic online validation (every 7 days)
```

---

**Last Updated**: 2026-03-18  
**Status**: Ready for implementation when needed  
**Estimated Time**: 2-3 weeks for full implementation
