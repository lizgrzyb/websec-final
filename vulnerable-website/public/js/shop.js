async function loadSession() {
    const res = await fetch('/api/session');
    const data = await res.json();
    if (!data.authenticated) {
        window.location.href = '/login';
        return;
    }
    document.getElementById('username').textContent = data.username;
    document.getElementById('balance').textContent = data.balance.toFixed(2);
}

async function loadProducts() {
    const res = await fetch('/products');
    const products = await res.json();
    
    const grid = document.getElementById('products');
    grid.innerHTML = products.map(p => `
        <div class="product-card">
            <h3>${p.name}</h3>
            <p class="price">$${p.price.toFixed(2)}</p>
            <p>${p.description}</p>
            <a href="/checkout?product_id=${p.id}" class="btn">Buy Now</a>
        </div>
    `).join('');
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
}

loadSession();
loadProducts();