const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');

const { ensureArray } = require('./utils/helpers');
const { requireLogin, requireAdmin, checkUserAccess } = require('./middleware/auth');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: 'shop-secret-key',
    resave: false,
    saveUninitialized: true
}));

const products = JSON.parse(fs.readFileSync('products.json', 'utf8'));

// In-memory databases
const users = {
    'alice': { id: 1, username: 'alice', password: 'password123', email: 'alice@example.com', balance: 1000, isAdmin: false, orders: [1000, 1001, 1002] },
    'bob': { id: 2, username: 'bob', password: 'password456', email: 'bob@example.com', balance: 100, isAdmin: false, orders: [] },
    'admin': { id: 999, username: 'admin', password: 'admin123', email: 'admin@shop.com', balance: 999999, isAdmin: true, orders: [] }
};

const orders = {
    1000: {
        id: 1000,
        userId: 1,
        username: 'alice',
        productId: 2,
        productName: 'Smartphone',
        quantity: 1,
        engravingColors: ['gold'],
        discountCodes: ['SAVE20'],
        total: 564.99,
        status: 'completed',  // For TEST 4
        createdAt: new Date('2024-11-20')
    },
    1001: {
        id: 1001,
        userId: 1,
        username: 'alice',
        productId: 3,
        productName: 'Headphones',
        quantity: 2,
        engravingColors: [],
        discountCodes: [],
        total: 304.98,
        status: 'completed',  // For TEST 5
        createdAt: new Date('2024-11-25')
    },
    1002: {
        id: 1002,
        userId: 1,
        username: 'alice',
        productId: 1,
        productName: 'Laptop',
        quantity: 1,
        engravingColors: ['silver'],
        discountCodes: ['SAVE10'],
        total: 904.99,
        status: 'completed',  // Extra order
        createdAt: new Date('2024-11-26')
    }
};
let orderCounter = 1003;

// Public routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// HPP VULNERABILITY 1: Privilege Escalation
// Pattern: Session storage bug with truthy check
app.post('/api/register', (req, res) => {
    const { username, password, email, is_admin } = req.body;
    
    if (users[username]) {
        return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Convert string 'true'/'false' to boolean
    const isAdminFlag = is_admin === 'true';
    
    const userId = Object.keys(users).length + 1;
    users[username] = {
        id: userId,
        username,
        password,
        email,
        isAdmin: isAdminFlag,  // Stored correctly as false
        balance: 10000,  // Give enough balance for testing
        orders: []
    };
    
    // Login the user immediately after registration
    req.session.userId = userId;
    req.session.username = username;
    
    // BUG: Storing the raw value instead of the converted boolean
    // Developer copy-pasted and forgot to use isAdminFlag
    req.session.isAdmin = req.body.is_admin;
    
    res.json({ success: true, userId: userId });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    
    if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.userId = user.id;
    req.session.username = username;
    req.session.isAdmin = user.isAdmin;
    
    res.json({ 
        success: true,
        isAdmin: user.isAdmin,
        redirect: user.isAdmin ? '/admin' : '/shop'
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// User routes
app.get('/shop', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'shop.html'));
});

app.get('/checkout', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'checkout.html'));
});

app.get('/orders', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'orders.html'));
});

app.get('/products', (req, res) => {
    res.json(products);
});

app.get('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const product = products.find(p => p.id === productId);
    
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

// HPP VULNERABILITY 2: Discount Stacking
// Pattern: Defensive programming with ensureArray helper
app.post('/checkout/process', requireLogin, (req, res) => {
    const { product_id, quantity, discount_code, shipping_method, engraving_colors } = req.body;
    
    const product = products.find(p => p.id == product_id);
    if (!product) {
        return res.status(404).json({ error: 'Product not found' });
    }
    
    const qty = parseInt(quantity) || 1;
    let total = product.price * qty;
    
    // Use helper function to ensure consistent array handling
    // This seems like good defensive programming, but creates vulnerability
    const discountCodes = ensureArray(discount_code);
    const colors = ensureArray(engraving_colors);
    
    let discountHistory = [];
    discountCodes.forEach(code => {
        const beforeDiscount = total;
        if (code === 'SAVE10') {
            total *= 0.9;
            discountHistory.push(`SAVE10: $${beforeDiscount.toFixed(2)} → $${total.toFixed(2)}`);
        } else if (code === 'SAVE20') {
            total *= 0.8;
            discountHistory.push(`SAVE20: $${beforeDiscount.toFixed(2)} → $${total.toFixed(2)}`);
        } else if (code === 'FREESHIP') {
            discountHistory.push(`FREESHIP: Free shipping applied`);
        }
    });
    
    const shippingCost = discountCodes.includes('FREESHIP') ? 0 : 
                        shipping_method === 'express' ? 15 :
                        shipping_method === 'overnight' ? 25 : 5;
    
    total += shippingCost;
    
    const user = Object.values(users).find(u => u.id === req.session.userId);
    
    if (user.balance < total) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    user.balance -= total;
    
    const orderId = orderCounter++;
    orders[orderId] = {
        id: orderId,
        userId: user.id,
        username: user.username,
        productId: product.id,
        productName: product.name,
        quantity: qty,
        engravingColors: colors,
        discountCodes: discountCodes,
        total: total,
        status: 'completed',
        createdAt: new Date()
    };
    
    user.orders.push(orderId);
    
    res.json({
        status: 'success',
        message: 'Order processed successfully!',
        order_details: {
            order_id: orderId,
            product_name: product.name,
            base_price: product.price,
            quantity: qty,
            engraving_colors: colors,
            discount_codes: discountCodes,
            discount_history: discountHistory,
            shipping_method: shipping_method || 'standard',
            shipping_cost: shippingCost,
            subtotal: (product.price * qty).toFixed(2),
            final_total: total.toFixed(2),
            new_balance: user.balance.toFixed(2)
        },
        debug_info: {
            all_product_ids: req.body.product_id,
            all_quantities: req.body.quantity,
            all_discounts: req.body.discount_code,
            all_shipping_methods: req.body.shipping_method,
            all_engraving_colors: req.body.engraving_colors
        }
    });
});

// HPP VULNERABILITY 3: IDOR via inconsistent parameter handling
// Pattern: Middleware validates, but route uses raw value with ORM-like behavior
app.get('/api/orders', checkUserAccess, async (req, res) => {
    // checkUserAccess already validated the first user_id value
    // Developer assumes it's safe to use req.query.user_id directly
    
    const userId = req.query.user_id;
    
    // Simulate ORM behavior: if userId is array, some ORMs use IN clause
    // or take the last value, or toString() it
    let userOrders;
    if (Array.isArray(userId)) {
        // Simulating Sequelize-like behavior: WHERE userId IN (...)
        const ids = userId.map(id => parseInt(id));
        userOrders = Object.values(orders).filter(o => ids.includes(o.userId));
    } else {
        userOrders = Object.values(orders).filter(o => o.userId === parseInt(userId));
    }
    
    res.json(userOrders);
});

// HPP VULNERABILITY 4: Payment Redirect
// Pattern: Taking last value from array (ORM-like behavior)
app.post('/api/refund', requireLogin, async (req, res) => {
    const { order_id, refund_email } = req.body;
    
    const orderId = parseInt(order_id);
    const order = orders[orderId];
    
    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.status === 'refunded') {
        return res.status(400).json({ error: 'Order already refunded' });
    }
    
    // BUG: If refund_email is array, take the last value
    // Developer thought: "normalize input by taking last value if multiple"
    // This looks like handling edge cases, but creates vulnerability
    let emailToUse = refund_email;
    if (Array.isArray(refund_email)) {
        emailToUse = refund_email[refund_email.length - 1];
    }
    
    const recipient = Object.values(users).find(u => u.email === emailToUse);
    
    if (recipient) {
        recipient.balance += order.total;
    }
    
    order.status = 'refunded';
    
    res.json({
        success: true,
        orderId: orderId,
        amount: order.total.toFixed(2),
        refundEmail: emailToUse
    });
});

// Admin routes
app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
    const userList = Object.values(users).map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        isAdmin: u.isAdmin,
        balance: u.balance,
        orderCount: u.orders.length
    }));
    res.json(userList);
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
    res.json(Object.values(orders));
});

// HPP VULNERABILITY 5: Bulk Refund
// Pattern: Taking last value from array (same as refund)
app.post('/api/admin/bulk-refund', requireAdmin, (req, res) => {
    const { order_ids, recipient_email } = req.body;
    
    // Support both comma-separated string and array (backward compatibility)
    let orderIdList;
    if (typeof order_ids === 'string') {
        orderIdList = order_ids.split(',').map(id => id.trim());
    } else {
        orderIdList = order_ids;
    }
    
    // BUG: If recipient_email is array, take the last value
    // Developer copy-pasted from refund endpoint
    let emailToUse = recipient_email;
    if (Array.isArray(recipient_email)) {
        emailToUse = recipient_email[recipient_email.length - 1];
    }
    
    const recipient = Object.values(users).find(u => u.email === emailToUse);
    
    if (!recipient) {
        return res.status(404).json({ error: 'Recipient not found' });
    }
    
    let totalRefunded = 0;
    orderIdList.forEach(id => {
        const order = orders[parseInt(id)];
        if (order && order.status !== 'refunded') {
            recipient.balance += order.total;
            totalRefunded += order.total;
            order.status = 'refunded';
        }
    });
    
    res.json({
        success: true,
        refundedCount: orderIdList.length,
        totalAmount: totalRefunded.toFixed(2),
        recipientEmail: emailToUse
    });
});

app.get('/api/session', (req, res) => {
    if (!req.session.userId) {
        return res.json({ authenticated: false });
    }
    
    const user = Object.values(users).find(u => u.id === req.session.userId);
    res.json({
        authenticated: true,
        userId: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        // Return session value, not user value (to show the vulnerability)
        isAdmin: req.session.isAdmin
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});