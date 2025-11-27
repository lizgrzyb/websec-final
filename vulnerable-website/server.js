const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

const products = JSON.parse(fs.readFileSync('products.json', 'utf8'));

app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'checkout.html'));
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

// processes parameters in order
app.post('/checkout/process', (req, res) => {

    console.log('Received parameters:', req.body);

    let basePrice = 0;
    let quantity = 1;
    let discountCodes = [];
    let shippingMethod = 'standard';
    let productId = null;
    
    // product_id
    if (Array.isArray(req.body.product_id)) {
        productId = parseInt(req.body.product_id[req.body.product_id.length - 1]) || null;
    } else {
        productId = parseInt(req.body.product_id) || null;
    }
    
    // base_price
    if (Array.isArray(req.body.base_price)) {
        basePrice = parseFloat(req.body.base_price[req.body.base_price.length - 1]) || 0;
    } else {
        basePrice = parseFloat(req.body.base_price) || 0;
    }
    
    // quantity
    if (Array.isArray(req.body.quantity)) {
        quantity = parseInt(req.body.quantity[req.body.quantity.length - 1]) || 1;
    } else {
        quantity = parseInt(req.body.quantity) || 1;
    }
    
    // discount codes
    if (Array.isArray(req.body.discount_code)) {
        discountCodes = req.body.discount_code.filter(code => code !== '');
    } else if (req.body.discount_code && req.body.discount_code !== '') {
        discountCodes = [req.body.discount_code];
    }
    
    // shipping method
    if (Array.isArray(req.body.shipping_method)) {
        shippingMethod = req.body.shipping_method[req.body.shipping_method.length - 1] || 'standard';
    } else {
        shippingMethod = req.body.shipping_method || 'standard';
    }
    
    let productName = 'Custom Product';
    if (productId) {
        const product = products.find(p => p.id === productId);
        if (product) {
            basePrice = product.price;
            productName = product.name;
        }
    }

    let total = basePrice * quantity;
    
    let discountHistory = [];
    discountCodes.forEach(discount => {
        const beforeDiscount = total;
        if (discount === 'SAVE10') {

            total *= 0.9; 
            discountHistory.push(`SAVE10: $${beforeDiscount.toFixed(2)} → $${total.toFixed(2)}`);

        } else if (discount === 'SAVE20') {

            total *= 0.8; 
            discountHistory.push(`SAVE20: $${beforeDiscount.toFixed(2)} → $${total.toFixed(2)}`);

        } else if (discount === 'FREESHIP') {

            discountHistory.push(`FREESHIP: Free shipping applied`);

        }
    });
    
    const shippingCost = discountCodes.includes('FREESHIP') ? 0 : 
                        shippingMethod === 'express' ? 15 :
                        shippingMethod === 'overnight' ? 25 : 5;
    
    total += shippingCost;
    
    const response = {
        status: 'success',
        message: 'Order processed successfully!',
        order_details: {
            product_name: productName,
            base_price: basePrice,
            quantity: quantity,
            discount_codes: discountCodes,
            discount_history: discountHistory,
            shipping_method: shippingMethod,
            shipping_cost: shippingCost,
            subtotal: (basePrice * quantity).toFixed(2),
            final_total: total.toFixed(2)
        },
        debug_info: {
            all_base_prices: req.body.base_price,
            all_quantities: req.body.quantity,
            all_discounts: req.body.discount_code,
            all_shipping_methods: req.body.shipping_method,
            all_product_ids: req.body.product_id
        }
    };
    
    res.json(response);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`HPP Demo server running at http://localhost:${PORT}`);
});