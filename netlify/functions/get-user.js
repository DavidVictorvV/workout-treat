const admin = require("firebase-admin");

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
  console.log("Initializing Firebase Admin SDK...");
  
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  console.log("Project ID:", serviceAccount.project_id);
  console.log("Client Email:", serviceAccount.client_email);
  console.log("Private Key exists:", !!serviceAccount.private_key);
  console.log(
    "Private Key length:",
    serviceAccount.private_key?.length || 0
  );

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin SDK initialized successfully");
  } catch (initError) {
    console.error(
      "❌ Firebase Admin SDK initialization failed:",
      initError.message
    );
    throw initError;
  }
} else {
  console.log("🔄 Firebase Admin SDK already initialized");
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const id = event.queryStringParameters?.id;

  if (!id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Query parameter 'id' is required" }),
    };
  }

  try {
    // First try as userId (Firebase UID)
    try {
      const userRecord = await admin.auth().getUser(id);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          userId: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || null,
          photoUrl: userRecord.photoURL || null,
          source: "auth",
        }),
      };
    } catch (authError) {
      // If not found, fall back to Firestore displayName
      if (authError.code !== "auth/user-not-found") {
        throw authError; // real error, rethrow
      }

      const db = admin.firestore();
      const snapshot = await db
        .collection("users")
        .where("displayName", "==", id)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "User not found" }),
        };
      }

      const userDoc = snapshot.docs[0].data();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          userId: userDoc.userId,
          email: userDoc.email,
          displayName: userDoc.displayName,
          photoUrl: userDoc.photoUrl || null,
          source: "firestore",
        }),
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
