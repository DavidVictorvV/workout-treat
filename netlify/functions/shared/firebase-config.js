const admin = require('firebase-admin');

let firebaseApp;
let firestoreInstance;

function initializeFirebase() {
  if (!firebaseApp) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKey) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required');
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      
      if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
        throw new Error('Invalid Firebase service account configuration');
      }
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
    } catch (error) {
      console.error('Firebase initialization error:', error.message);
      throw new Error('Failed to initialize Firebase');
    }
  }
  
  return firebaseApp;
}

function getFirestore() {
  try {
    if (!firestoreInstance) {
      const app = initializeFirebase();
      firestoreInstance = admin.firestore(app);
      
      firestoreInstance.settings({
        ignoreUndefinedProperties: true
      });
    }
    
    return firestoreInstance;
  } catch (error) {
    console.error('Firestore connection error:', error.message);
    throw new Error('Database connection failed');
  }
}

function getAuth() {
  try {
    const app = initializeFirebase();
    return admin.auth(app);
  } catch (error) {
    console.error('Firebase Auth error:', error.message);
    throw new Error('Authentication service unavailable');
  }
}

module.exports = {
  initializeFirebase,
  getFirestore,
  getAuth
};