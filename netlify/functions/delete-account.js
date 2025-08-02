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

const db = admin.firestore();
console.log("✅ Firestore database reference obtained");

exports.handler = async function (event, context) {
  console.log("🗑️ Delete account function started");
  console.log("HTTP Method:", event.httpMethod);
  console.log("Request body length:", event.body?.length || 0);

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  };

  // Handle preflight CORS
  if (event.httpMethod === "OPTIONS") {
    console.log("📡 Handling CORS preflight request");
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "DELETE") {
    console.log("❌ Invalid HTTP method:", event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  // Extract Firebase ID token from Authorization header
  const authHeader = event.headers.authorization || event.headers.Authorization;
  console.log("🔑 Authorization header present:", !!authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("❌ Missing or invalid Authorization header");
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        error: "Authorization header with Bearer token required",
      }),
    };
  }

  const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix
  console.log("🎫 ID Token extracted, length:", idToken.length);

  let userId, userEmail;

  try {
    // Verify the Firebase ID token
    console.log("🔍 Verifying Firebase ID token...");
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    userId = decodedToken.uid;
    userEmail = decodedToken.email;

    console.log("✅ Token verified successfully");
    console.log("👤 User ID:", userId);
    console.log("📧 User Email:", userEmail);
  } catch (tokenError) {
    console.error("❌ Token verification failed:", tokenError.message);
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Invalid or expired token" }),
    };
  }

  try {
    console.log("🗂️ Starting account deletion process...");

    // Step 1: Delete user data from Firestore
    console.log("📄 Deleting userData document...");
    try {
      await db.collection("userData").doc(userId).delete();
      console.log("✅ Successfully deleted userData document:", userId);
    } catch (firestoreError) {
      console.error(
        "❌ Error deleting userData document:",
        firestoreError.message
      );
      // Continue with auth deletion even if Firestore fails
    }

    // Step 2: Delete any other user-related collections
    // Add more collections here as needed for your app
    const collectionsToClean = [
      // Example: Add other collections that might contain user data
      // 'userPreferences',
      // 'userPosts',
      // 'userMessages'
    ];

    for (const collectionName of collectionsToClean) {
      try {
        console.log(`🗂️ Checking collection: ${collectionName}`);
        const querySnapshot = await db
          .collection(collectionName)
          .where("userId", "==", userId)
          .get();

        if (!querySnapshot.empty) {
          console.log(
            `📄 Found ${querySnapshot.size} documents in ${collectionName}`
          );
          const batch = db.batch();
          querySnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          console.log(
            `✅ Deleted ${querySnapshot.size} documents from ${collectionName}`
          );
        } else {
          console.log(`ℹ️ No documents found in ${collectionName}`);
        }
      } catch (collectionError) {
        console.error(
          `❌ Error cleaning ${collectionName}:`,
          collectionError.message
        );
        // Continue with other collections
      }
    }

    // Step 3: Delete user from Firebase Authentication
    console.log("🔐 Deleting user from Firebase Authentication...");
    try {
      await admin.auth().deleteUser(userId);
      console.log("✅ Successfully deleted user from Authentication:", userId);
    } catch (authError) {
      console.error(
        "❌ Error deleting user from Authentication:",
        authError.message
      );
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Failed to delete user from authentication",
          details: authError.message,
        }),
      };
    }

    console.log("🎉 Account deletion completed successfully");
    console.log("📊 Summary:");
    console.log("  - User removed from Authentication ✅");
    console.log("  - userData document deleted ✅");
    console.log("  - Additional collections cleaned ✅");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Account deleted successfully",
        userId: userId,
        email: userEmail,
        deletedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("❌ Account deletion failed:", error.message);
    console.error("🔍 Full error details:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to delete account",
        details: error.message,
      }),
    };
  }
};
