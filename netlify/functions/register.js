const fetch = require("node-fetch");
const admin = require("firebase-admin");
const { createResponse, handleCORS } = require('./shared/auth-middleware');
const { getFirestore } = require('./shared/firebase-config');

exports.handler = async function (event, context) {
  console.log("🚀 Email/Password signup function started");
  console.log("HTTP Method:", event.httpMethod);
  console.log("Request body length:", event.body?.length || 0);

  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "POST") {
    console.log("❌ Invalid HTTP method:", event.httpMethod);
    return createResponse(405, { error: "Method Not Allowed" });
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
    return createResponse(400, { error: "Invalid JSON in request body" });
  }

  if (!email || !password) {
    console.log(
      "❌ Missing required fields - Email:",
      !!email,
      "Password:",
      !!password
    );
    return createResponse(400, { error: "Email and password are required" });
  }

  if (password.length < 6) {
    console.log("❌ Password too short:", password.length, "characters");
    return createResponse(400, {
      error: "Password must be at least 6 characters long",
    });
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

      return createResponse(400, { error: errorMessage });
    }

    console.log("✅ Firebase signup successful for user:", data.localId);

    // Create Firestore document for the new user (always true for signup)
    console.log("👤 New user created! Creating Firestore document...");
    console.log("User ID:", data.localId);
    console.log("Email:", data.email);
    console.log("Display Name:", data.displayName);

    try {
      const db = getFirestore();
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
    return createResponse(201, {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      localId: data.localId,
      email: data.email,
      displayName: data.displayName || displayName || null,
      isNewUser: true,
    });
  } catch (error) {
    console.error("❌ Signup process error:", error.message);
    console.error("🔍 Full error details:", error);
    return createResponse(500, { error: error.message });
  }
};
