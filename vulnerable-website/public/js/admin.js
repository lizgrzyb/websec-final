async function loadUsers() {
    const res = await fetch('/api/admin/users');
    const users = await res.json();
    
    const container = document.getElementById('users');
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Balance</th>
                    <th>Orders</th>
                    <th>Admin</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(u => `
                    <tr>
                        <td>${u.id}</td>
                        <td>${u.username}</td>
                        <td>${u.email}</td>
                        <td>$${u.balance.toFixed(2)}</td>
                        <td>${u.orderCount}</td>
                        <td>${u.isAdmin ? 'Yes' : 'No'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function loadOrders() {
    const res = await fetch('/api/admin/orders');
    const orders = await res.json();
    
    const container = document.getElementById('orders');
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Order ID</th>
                    <th>User</th>
                    <th>Product</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
                ${orders.map(o => `
                    <tr>
                        <td>${o.id}</td>
                        <td>${o.username}</td>
                        <td>${o.productName}</td>
                        <td>$${o.total.toFixed(2)}</td>
                        <td>${o.status}</td>
                        <td>${new Date(o.createdAt).toLocaleDateString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

document.getElementById('bulkRefundForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const orderIds = formData.get('order_ids').split(',').map(id => id.trim());
    
    try {
        const res = await fetch('/api/admin/bulk-refund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_ids: orderIds,
                recipient_email: formData.get('recipient_email')
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            alert(`Bulk refund processed!\nOrders: ${data.refundedCount}\nTotal: $${data.totalAmount}\nRecipient: ${data.recipientEmail}`);
            loadUsers();
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

loadUsers();
loadOrders();