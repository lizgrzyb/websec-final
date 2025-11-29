// Utility functions for parameter handling
// Based on common patterns from Stack Overflow and best practices

function ensureArray(value) {
    if (!value) return [];
    return [].concat(value).filter(Boolean);
}

function normalizeInput(input) {
    if (Array.isArray(input)) {
        return input.map(item => typeof item === 'string' ? item.trim() : item);
    }
    return typeof input === 'string' ? input.trim() : input;
}

module.exports = {
    ensureArray,
    normalizeInput
};