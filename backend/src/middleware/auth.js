const { getAuth } = require('../config/firebaseAdmin');
const asyncHandler = require('./asyncHandler');
const { sendError } = require('../utils/apiResponse');

// ── protect — verify Firebase ID Token and attach req.user ──
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Accept token from Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return sendError(res, 'Not authorised — no token provided', 401);
  }

  let decoded;
  try {
    // Verify the Firebase ID token using Firebase Admin SDK
    decoded = await getAuth().verifyIdToken(token);
  } catch (err) {
    const message =
      err.code === 'auth/id-token-expired'
        ? 'Session expired — please log in again'
        : 'Invalid token — please log in again';
    return sendError(res, message, 401);
  }

  // Attach a user object to req so existing controllers work unchanged
  req.user = {
    uid: decoded.uid,
    _id: decoded.uid,   // alias for any controller using req.user._id
    email: decoded.email,
    name: decoded.name || 'User',
    role: decoded.role || 'user',
    isActive: true,
  };

  next();
});

// ── authorize — restrict to specific roles ───────────────
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return sendError(
      res,
      `Role '${req.user.role}' is not authorised to access this resource`,
      403
    );
  }
  next();
};

module.exports = { protect, authorize };
