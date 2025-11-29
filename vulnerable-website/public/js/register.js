document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(formData))
        });
        
        const data = await res.json();
        
        if (data.success) {
            alert('Registration successful! Please login.');
            window.location.href = '/login';
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('Registration error: ' + err.message);
    }
});