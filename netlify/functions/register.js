const admin = require("firebase-admin");

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
  console.log("Initializing Firebase Admin SDK...");
  console.log("Project ID:", process.env.FIREBASE_PROJECT_ID);
  console.log("Client Email:", process.env.FIREBASE_CLIENT_EMAIL);
  console.log("Private Key exists:", !!process.env.FIREBASE_PRIVATE_KEY);
  console.log(
    "Private Key length:",
    process.env.FIREBASE_PRIVATE_KEY?.length || 0
  );

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
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
  console.log("🚀 Email/Password signup function started");
  console.log("HTTP Method:", event.httpMethod);
  console.log("Request body length:", event.body?.length || 0);

  const headers = {
    "Access-Control-Allow-Origin": "*", // Or replace with your domain for tighter security
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight request
  if (event.httpMethod === "OPTIONS") {
    console.log("📡 Handling CORS preflight request");
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    console.log("❌ Invalid HTTP method:", event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  let email, password, displayName;
  try {
    console.log("📝 Parsing request body...");
    const requestBody = JSON.parse(event.body);
    email = requestBody.email;
    password = requestBody.password;
    displayName = requestBody.displayName;

    console.log("✅ Request body parsed successfully");
    console.log("Email:", email);
    console.log("Display Name:", displayName || "Not provided");
    console.log("Password length:", password?.length || 0);
  } catch (parseError) {
    console.error("❌ Error parsing request body:", parseError.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  if (!email || !password) {
    console.log(
      "❌ Missing required fields - Email:",
      !!email,
      "Password:",
      !!password
    );
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Email and password are required" }),
    };
  }

  if (password.length < 6) {
    console.log("❌ Password too short:", password.length, "characters");
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Password must be at least 6 characters long",
      }),
    };
  }

  const firebaseApiKey = process.env.FIREBASE_API_KEY;
  console.log("🔑 Firebase API Key exists:", !!firebaseApiKey);

  try {
    console.log("🔥 Making signup request to Firebase Identity Toolkit...");
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
          displayName: displayName || null,
        }),
      }
    );

    console.log("Firebase signup response status:", response.status);
    const data = await response.json();
    console.log("Firebase signup response received");

    if (data.error) {
      console.log("❌ Firebase signup error:", data.error.message);
      let errorMessage = data.error.message;

      if (errorMessage.includes("EMAIL_EXISTS")) {
        errorMessage = "An account with this email already exists";
      } else if (errorMessage.includes("WEAK_PASSWORD")) {
        errorMessage = "Password is too weak";
      } else if (errorMessage.includes("INVALID_EMAIL")) {
        errorMessage = "Invalid email address";
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: errorMessage }),
      };
    }

    console.log("✅ Firebase signup successful for user:", data.localId);

    // Create Firestore document for the new user (always true for signup)
    console.log("👤 New user created! Creating Firestore document...");
    console.log("User ID:", data.localId);
    console.log("Email:", data.email);
    console.log("Display Name:", data.displayName);

    try {
      const userData = {
        username:
          data.displayName ||
          displayName ||
          email?.split("@")[0] ||
          "Unknown User",
        userId: data.localId,
        email: data.email,
        dateCreated: admin.firestore.FieldValue.serverTimestamp(),
        photoUrl: null, // No photo URL for email signups
      };

      console.log("📄 Creating userData document with data:", {
        ...userData,
        dateCreated: "[ServerTimestamp]", // Don't log the actual timestamp object
      });

      await db.collection("userData").doc(data.localId).set(userData);
      console.log(
        "✅ Successfully created userData document for user:",
        data.localId
      );
      console.log("📍 Document path: userData/" + data.localId);
    } catch (firestoreError) {
      console.error(
        "❌ Error creating Firestore document:",
        firestoreError.message
      );
      console.error("🔍 Firestore error details:", firestoreError);
      // Don't fail the entire request if Firestore creation fails
      // The user account was already created successfully
    }

    console.log("🎉 Signup process completed successfully");
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        localId: data.localId,
        email: data.email,
        displayName: data.displayName || displayName || null,
        isNewUser: true,
      }),
    };
  } catch (error) {
    console.error("❌ Signup process error:", error.message);
    console.error("🔍 Full error details:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
