const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// ── Initialize Firebase Admin ────────────────────────────────
// The service account credentials are stored as a JSON string in an
// environment variable to avoid committing secrets to source control.
if (!getApps().length) {
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Production: parse from environment variable (set in Render dashboard)
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    // Local development: load from the JSON file directly
    try {
      serviceAccount = require('./firebase-service-account.json');
    } catch {
      console.warn('[Firebase Admin] No service account found. Auth middleware will be disabled.');
      serviceAccount = null;
    }
  }

  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount),
    });
    console.log('[Firebase Admin] Initialized successfully.');
  }
}

// Export the auth instance for use in middleware
module.exports = { getAuth };
