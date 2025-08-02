const requestCounts = new Map();

function rateLimiter(identifier, maxRequests = 100, windowMs = 60 * 1000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!requestCounts.has(identifier)) {
    requestCounts.set(identifier, []);
  }
  
  const requests = requestCounts.get(identifier);
  
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (validRequests.length >= maxRequests) {
    return false;
  }
  
  validRequests.push(now);
  requestCounts.set(identifier, validRequests);
  
  if (requestCounts.size > 10000) {
    const oldestKey = requestCounts.keys().next().value;
    requestCounts.delete(oldestKey);
  }
  
  return true;
}

function getClientIP(event) {
  return event.headers['x-forwarded-for'] || 
         event.headers['x-real-ip'] || 
         event.requestContext?.identity?.sourceIp || 
         'unknown';
}

module.exports = {
  rateLimiter,
  getClientIP
};