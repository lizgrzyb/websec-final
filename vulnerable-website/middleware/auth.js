// Authentication middleware
// Handles user authentication and authorization

/**
 * Require user to be logged in
 */
function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
}

/**
 * Require user to have admin privileges
 */
function requireAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    
    // BUG: Using truthy check instead of strict boolean
    // If session.isAdmin is an array ['false', 'true'], this evaluates to true!
    // Arrays are truthy in JavaScript
    if (!req.session.isAdmin) {
        return res.status(403).send('Access Denied: Admin privileges required');
    }
    
    next();
}

/**
 * Check if user has access to requested resource
 * Validates that the requested user_id matches the session user
 */
function checkUserAccess(req, res, next) {
    const requestedUserId = req.query.user_id;
    
    // Normalize input - get first value if array
    // This is a common pattern for handling potential array inputs
    const userIdToCheck = [].concat(requestedUserId)[0];
    
    if (parseInt(userIdToCheck) !== req.session.userId) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
}

module.exports = {
    requireLogin,
    requireAdmin,
    checkUserAccess
};