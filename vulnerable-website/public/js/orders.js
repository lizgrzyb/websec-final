let currentUserId;

async function loadOrders() {
    const sessionRes = await fetch('/api/session');
    const session = await sessionRes.json();
    
    if (!session.authenticated) {
        window.location.href = '/login';
        return;
    }
    
    currentUserId = session.userId;
    
    const res = await fetch(`/api/orders?user_id=${session.userId}`);
    const orders = await res.json();
    
    const container = document.getElementById('orders');
    
    if (orders.length === 0) {
        container.innerHTML = '<p>No orders yet</p>';
        return;
    }
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Order ID</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
                ${orders.map(o => `
                    <tr>
                        <td>${o.id}</td>
                        <td>${o.productName}</td>
                        <td>${o.quantity}</td>
                        <td>$${o.total.toFixed(2)}</td>
                        <td>${o.status}</td>
                        <td>${new Date(o.createdAt).toLocaleDateString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

document.getElementById('refundForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const res = await fetch('/api/refund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(formData))
        });
        
        const data = await res.json();
        
        if (data.success) {
            alert(`Refund processed! Amount: $${data.amount} sent to ${data.refundEmail}`);
            loadOrders();
            e.target.reset();
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
}

loadOrders();