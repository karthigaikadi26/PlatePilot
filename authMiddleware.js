const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'platepilot_capstone_jwt_secret_key_2026_secure';
const TOKEN_EXPIRY = '7d';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function extractToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.headers['x-auth-token']) {
    return String(req.headers['x-auth-token']).trim();
  }
  if (req.query && req.query.token) {
    return String(req.query.token).trim();
  }
  return null;
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be logged in to perform this action. Please log in or register.'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      message: 'Your session has expired. Please log in again.'
    });
  }

  req.user = decoded;
  next();
}

function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    } else {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

module.exports = {
  JWT_SECRET,
  generateToken,
  verifyToken,
  requireAuth,
  optionalAuth
};
