/**
 * hpp-guard
 * v1: protects req.query + req.body with a global or per key policy
 * Web Security Final Project F25
 * HTTP Parameter Polution Defense
 */

function hppGuard(options = {}) {
    const {
      mode = "reject",      // "reject" | "first" | "last"
      paramModes = null,  // per param mode overrides global mode { paramName: "reject" | "first" | "last" }
      allowlist = null,     // null = all params, or array of params ... maybe we should change the name
      onPollution = null,   // optional reporting
      multiValAllowed=null, //whitelist for params with multiple values
      checkBody=true,       //disable request body check by setting to false
    } = options;
    
    const allowedSet = Array.isArray(allowlist) ? new Set(allowlist) : null;
    const multiSet=Array.isArray(multiValAllowed) ? new Set(multiValAllowed) : null;
    const paramModeMap = (paramModes && typeof paramModes === "object") ? paramModes : null;

    // checking which mode is being used for a specific parameter    
    function getMode(key){
      if (paramModeMap && typeof paramModeMap[key] === "string") {
        return paramModeMap[key];
      }
      return mode; //falling back to global if no per param mode found
    }

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
      //determine mode for each polluted key
      const effectiveModes={};
      for (const key of pollutedArray){
        effectiveModes[key]=getMode(key);
      }

      const report = {
        polluted: true,
        keys: pollutedArray,
        mode,
        paramModes,
        effectiveModes,
      };
  
      if (typeof onPollution === "function") {
        try { onPollution(report, req); } catch (_) {}
      }
      ///checking if any keys have reject mode
      const hasRejectKey = pollutedArray.some(
        (key) => getMode(key) === "reject"
      );
      //check if any key has reject mode
      if (hasRejectKey) {
        return res.status(400).json({
          status: "blocked",
          message: "Duplicate HTTP parameters detected",
          pollutedKeys:pollutedArray,
          effectiveModes,
        });
      }
/*
      //reject take priority over sanitize in this logic
      if (mode === "reject") {
        return res.status(400).json({
          status: "blocked",
          message: "Duplicate HTTP parameters detected",
          pollutedKeys:pollutedArray,
        });
      }
        */
      function sanitizeReq(obj){
        if (!obj) return;
        // sanitize in-place (if first is specified, keep first value, otherwise keep last)
        for (const key of pollutedArray) {
          const arr = obj[key];
          if(!Array.isArray(arr)) continue;
          const keyMode = getMode(key); //determine mode for this specific key if available
          if (keyMode === "first") {
            obj[key] = arr[0];
          } else if (keyMode === "last") {
            obj[key] = arr[arr.length - 1];
          } else {
          //falback to global mode if unknown mode found
          obj[key] = (mode === "first") ? arr[0] : arr[arr.length - 1];
          }
        }
      }
      sanitizeReq(req.query);
      if(IsURLEncoded) sanitizeReq(req.body);
      return next();
    };
  }
  
  module.exports = { hppGuard };
  