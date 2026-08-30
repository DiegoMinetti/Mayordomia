var RateLimit = (function () {
  function assertAllowed(key, limit, windowSeconds) {
    var cache = CacheService.getScriptCache(); var bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    var digest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key + ':' + bucket));
    var cacheKey = 'rl:' + digest; var lock = LockService.getScriptLock(); lock.waitLock(3000);
    try { var count = Number(cache.get(cacheKey) || 0) + 1; if (count > limit) throw ApiError.rateLimited(); cache.put(cacheKey, String(count), windowSeconds); }
    finally { lock.releaseLock(); }
  }
  return { assertAllowed: assertAllowed };
})();
