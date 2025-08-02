const { getAuth } = require('./firebase-config');
const { rateLimiter, getClientIP } = require('./rate-limiter');

async function verifyToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization header with Bearer token required');
  }

  const token = authHeader.substring(7);
  
  if (!token || token.length < 10) {
    throw new Error('Invalid token format');
  }
  
  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token, true);
    
    if (!decodedToken.uid) {
      throw new Error('Invalid token payload');
    }
    
    return decodedToken;
  } catch (error) {
    console.error('Token verification error:', error.message);
    throw new Error('Invalid or expired token');
  }
}

function createResponse(statusCode, body, headers = {}) {
  const responseHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    ...headers
  };

  let responseBody = body;
  if (typeof body === 'object') {
    responseBody = JSON.stringify(body);
  }

  return {
    statusCode,
    headers: responseHeaders,
    body: responseBody
  };
}

function handleCORS(event) {
  if (event.httpMethod === "OPTIONS") {
    return createResponse(200, {});
  }
  return null;
}

function checkRateLimit(event, maxRequests = 60, windowMs = 60 * 1000) {
  const clientIP = getClientIP(event);
  const identifier = `${clientIP}_${event.path}`;
  
  if (!rateLimiter(identifier, maxRequests, windowMs)) {
    return createResponse(429, { 
      error: "Too many requests. Please try again later." 
    });
  }
  
  return null;
}

function validateContentType(event, expectedType = 'application/json') {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  
  if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
    if (!contentType || !contentType.includes(expectedType)) {
      return createResponse(400, { 
        error: `Content-Type must be ${expectedType}` 
      });
    }
  }
  
  return null;
}

module.exports = {
  verifyToken,
  createResponse,
  handleCORS,
  checkRateLimit,
  validateContentType
};