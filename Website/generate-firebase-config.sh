#!/bin/bash
# Generate firebase-config.js from environment variables for Vercel deployment

cat > firebase-config.js <<EOF
// Firebase Configuration - Generated at build time
window.firebaseConfig = {
    apiKey: "${FIREBASE_API_KEY}",
    authDomain: "${FIREBASE_AUTH_DOMAIN}",
    projectId: "${FIREBASE_PROJECT_ID}",
    storageBucket: "${FIREBASE_STORAGE_BUCKET}",
    messagingSenderId: "${FIREBASE_MESSAGING_SENDER_ID}",
    appId: "${FIREBASE_APP_ID}"
};
EOF

echo "firebase-config.js generated successfully"
