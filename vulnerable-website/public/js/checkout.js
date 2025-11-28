document.addEventListener('DOMContentLoaded', function() {
    
    const checkoutForm = document.getElementById('checkoutForm');
    const loadingElement = document.getElementById('loading');
    const resultsElement = document.getElementById('results');

    checkoutForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        loadingElement.style.display = 'block';
        resultsElement.style.display = 'none';

        try {
            const formData = new FormData(checkoutForm);
            
            const data = {};
            for (let [key, value] of formData.entries()) {

                if (data[key]) {
                    if (Array.isArray(data[key])) {
                        data[key].push(value);
                    } else {
                        data[key] = [data[key], value];
                    }
                } else {
                    data[key] = value;
                }
            }

            const response = await fetch('/checkout/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(data).toString()
            });

            const result = await response.json();

            loadingElement.style.display = 'none';
            
            displayResults(result);

        } catch (error) {
            console.error('Error:', error);
            loadingElement.style.display = 'none';
            showError('An error occurred while processing your order.');
        }
    });

    function displayResults(result) {
    if (result.status === 'success') {
        const details = result.order_details;
        const debug = result.debug_info;

        let discountHistoryHTML = '';
        if (details.discount_history && details.discount_history.length > 0) {
            discountHistoryHTML = `
                <div class="discount-history">
                    <h4>Discounts Applied (in order):</h4>
                    ${details.discount_history.map(step => 
                        `<div class="discount-step">${step}</div>`
                    ).join('')}
                </div>
            `;
        }

        let engravingHTML = '';
        if (details.engraving_colors && details.engraving_colors.length > 0) {
            engravingHTML = `
                <div class="detail-item">
                    <span>Engraving Colors:</span>
                    <span>${details.engraving_colors.join(', ')}</span>
                </div>
            `;
        }

        resultsElement.innerHTML = `
            <div class="alert alert-success">
                <h2>Order Processed Successfully!</h2>
            </div>

            <div class="order-details">
                <h3>Order Summary</h3>
                <div class="detail-item">
                    <span>Product:</span>
                    <span>${details.product_name}</span>
                </div>
                <div class="detail-item">
                    <span>Base Price:</span>
                    <span>$${details.base_price}</span>
                </div>
                <div class="detail-item">
                    <span>Quantity:</span>
                    <span>${details.quantity}</span>
                </div>
                <div class="detail-item">
                    <span>Subtotal:</span>
                    <span>$${details.subtotal}</span>
                </div>
                ${engravingHTML}
                <div class="detail-item">
                    <span>Discounts Applied:</span>
                    <span>${details.discount_codes.length > 0 ? details.discount_codes.join(', ') : 'None'}</span>
                </div>
                <div class="detail-item">
                    <span>Shipping Method:</span>
                    <span>${details.shipping_method} ($${details.shipping_cost})</span>
                </div>
                <div class="detail-item">
                    <span><strong>Final Total:</strong></span>
                    <span><strong>$${details.final_total}</strong></span>
                </div>
            </div>

            ${discountHistoryHTML}

            <div class="debug-info">
                <h4>Processing Information:</h4>
                <pre>Products Received: ${JSON.stringify(debug.all_product_ids, null, 2)}</pre>
                <pre>Quantities Received: ${JSON.stringify(debug.all_quantities, null, 2)}</pre>
                <pre>Discount Codes Received: ${JSON.stringify(debug.all_discounts, null, 2)}</pre>
                <pre>Shipping Methods Received: ${JSON.stringify(debug.all_shipping_methods, null, 2)}</pre>
                <pre>Engraving Colors Received: ${JSON.stringify(debug.all_engraving_colors, null, 2)}</pre>
            </div>
        `;
    } else {
        showError(result.message || 'Order processing failed.');
    }
    
    resultsElement.style.display = 'block';
    resultsElement.scrollIntoView({ behavior: 'smooth' });
}

    function showError(message) {
        resultsElement.innerHTML = `
            <div class="alert alert-error">
                <h2>Order Failed</h2>
                <p>${message}</p>
            </div>
            <button onclick="location.reload()" class="btn">Try Again</button>
        `;
        resultsElement.style.display = 'block';
    }
});
