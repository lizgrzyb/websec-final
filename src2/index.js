/**
 * hpp-guard
 * v0: protects req.query + req.body with a single global duplicate policy.
 * Web Security Final Project F25
 * HTTP Parameter Polution Defense
 */

function hppGuard(options = {}) {
    const {
      mode = "reject",      // "reject" | "first" | "last"
      allowlist = null,     // null = all keys, or array of keys ... maybe we should change the name
      onPollution = null,   // optional reporting
      multiValAllowed=null, //whitelist for keys with multiple values
      checkBody=true,       //disable request body check by setting to false
    } = options;
    
    const allowedSet = Array.isArray(allowlist) ? new Set(allowlist) : null;
    const multiSet=Array.isArray(multiValAllowed) ? new Set(multiValAllowed) : null;
    return function hppGuard(req, res, next) {
      const pollutedKeys = new Set(); //sets dont duplicate keys
      const IsURLEncoded=checkBody&&req.is("application/x-www-form-urlencoded");
      function scanReq(obj){
        for (const key of Object.keys(obj || {})) {
          if (allowedSet && !allowedSet.has(key)) continue;
          if(multiSet && multiSet.has(key)) continue;
          const val = obj[key];
          if (Array.isArray(val)) pollutedKeys.add(key);
        }
      }
      scanReq(req.query)
      if(IsURLEncoded){ //json bodies cant contain duplicate keys..
        scanReq(req.body);
      }
      const pollutedArray=Array.from(pollutedKeys);
      if (pollutedArray.length === 0) return next();
      const report = {
        polluted: true,
        keys: pollutedKeys,
        mode,
      };
  
      if (typeof onPollution === "function") {
        try { onPollution(report, req); } catch (_) {}
      }
      //reject take priority over sanitize in this logic
      if (mode === "reject") {
        return res.status(400).json({
          status: "blocked",
          message: "Duplicate HTTP parameters detected",
          pollutedKeys:pollutedArray,
        });
      }
      function sanitizeReq(obj){
        // sanitize in-place (if first is specified, keep first value, otherwise keep last)
        for (const key of pollutedArray) {
          const arr = obj[key];
          if(!Array.isArray(arr)) continue;
          obj[key] = (mode === "first") ? arr[0] : arr[arr.length - 1];
        }
      }
      sanitizeReq(req.query);
      if(IsURLEncoded) sanitizeReq(req.body);
      return next();
    };
  }
  
  module.exports = { hppGuard };
  