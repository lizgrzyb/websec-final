/**
 * hpp-guard
 * v0: only protects req.query with a single global duplicate policy.
 * Web Security Final Project F25
 * HTTP Parameter Polution Defense
 */

function hppGuard(options = {}) {
    const {
      mode = "reject",      // "reject" | "first" | "last"
      allowlist = null,     // null = all keys, or array of keys
      onPollution = null,   // optional callback(report)
    } = options;
  
    const allowedSet = Array.isArray(allowlist) ? new Set(allowlist) : null;
  
    return function hppGuard(req, res, next) {
      const pollutedKeys = [];
  
      for (const key of Object.keys(req.query || {})) {
        if (allowedSet && !allowedSet.has(key)) continue;
  
        const val = req.query[key];
        if (Array.isArray(val)) pollutedKeys.push(key);
      }
  
      if (pollutedKeys.length === 0) return next();
  
      const report = {
        polluted: true,
        keys: pollutedKeys,
        mode,
      };
  
      if (typeof onPollution === "function") {
        try { onPollution(report, req); } catch (_) {}
      }
  
      if (mode === "reject") {
        return res.status(400).json({
          success: false,
          error: "Duplicate query parameters detected",
          pollutedKeys,
        });
      }
  
      // sanitize in-place
      for (const key of pollutedKeys) {
        const arr = req.query[key];
        req.query[key] = (mode === "first") ? arr[0] : arr[arr.length - 1];
      }
  
      return next();
    };
  }
  
  module.exports = { hppGuard };
  