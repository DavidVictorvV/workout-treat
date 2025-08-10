const admin = require("firebase-admin");
const fetch = require("node-fetch");
const { createResponse, handleCORS } = require('./shared/auth-middleware');
const { getFirestore } = require('./shared/firebase-config');

exports.handler = async function (event, context) {
  console.log("🚀 Lambda function started");
  console.log("HTTP Method:", event.httpMethod);
  console.log("Request body length:", event.body?.length || 0);

  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "POST") {
    console.log("❌ Invalid HTTP method:", event.httpMethod);
    return createResponse(405, { error: "Method Not Allowed" });
  }

  let idToken, testMode;
  try {
    console.log("📝 Parsing request body...");
    const body = JSON.parse(event.body);
    idToken = body.idToken;
    testMode = body.testMode;
    console.log("✅ Request body parsed successfully");
    console.log("ID Token exists:", !!idToken);
    console.log("Test Mode:", testMode);
  } catch (err) {
    console.error("❌ Error parsing request body:", err.message);
    return createResponse(400, { error: "Invalid JSON in request body" });
  }

  if (!idToken && !testMode) {
    console.log("❌ Missing required parameters: idToken or testMode");
    return createResponse(400, { error: "Google ID token is required" });
  }

  // For mock testing (e.g., Swagger)
  if (testMode) {
    console.log("🧪 Running in test mode - returning mock data");
    return createResponse(200, {
      idToken: "test_firebase_id_token_eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9",
      refreshToken: "test_firebase_refresh_token_AEu4IL2X7Y9k",
      localId: "test_user_id_123",
      email: "testuser@example.com",
      displayName: "Test User",
      photoUrl: "https://example.com/avatar.jpg",
      isNewUser: false,
    });
  }

  const firebaseApiKey = process.env.FIREBASE_API_KEY;
  console.log("🔑 Firebase API Key exists:", !!firebaseApiKey);

  try {
    console.log("🔥 Making request to Firebase Identity Toolkit...");
    const firebaseResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postBody: `id_token=${idToken}&providerId=google.com`,
          requestUri: process.env.REQUEST_URI || "http://localhost:3000",
          returnIdpCredential: true,
          returnSecureToken: true,
        }),
      }
    );

    const contentType = firebaseResponse.headers.get("content-type") || "";
    const rawText = await firebaseResponse.text();

    console.log("Firebase response status:", firebaseResponse.status);
    console.log("Firebase raw response text:", rawText);

    if (!contentType.includes("application/json")) {
      return createResponse(502, {
        error: "Unexpected response format from Firebase",
        status: firebaseResponse.status,
        rawResponse: rawText,
      });
    }

    const data = JSON.parse(rawText);

    if (data.error) {
      let errorMessage = data.error.message || "Unknown Firebase error";

      if (errorMessage.includes("INVALID_IDP_RESPONSE")) {
        errorMessage = "Invalid Google ID token or provider response";
      }

      return createResponse(401, { error: errorMessage });
    }

    // Create Firestore document for new users
    if (data.isNewUser) {
      console.log("👤 New user detected! Creating Firestore document...");
      console.log("User ID:", data.localId);
      console.log("Email:", data.email);
      console.log("Display Name:", data.displayName);

      try {
        const db = getFirestore();
        const userData = {
          displayName: data.displayName || data.email?.split("@")[0] || "Unknown User",
          totalPoints: 300,
          currentStreak: 0,
          longestStreak: 0,
          lastWorkoutDate: null,
          memberSince: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        console.log("📄 Creating user profile document with data:", userData);

        await db.collection("users").doc(data.localId).set(userData);
        console.log(
          "✅ Successfully created userData document for user:",
          data.localId
        );
        console.log("📍 Document path: users/" + data.localId);
      } catch (firestoreError) {
        console.error(
          "❌ Error creating Firestore document:",
          firestoreError.message
        );
        console.error("🔍 Firestore error details:", firestoreError);
        // Don't fail the entire request if Firestore creation fails
        // You might want to handle this differently based on your requirements
      }
    } else {
      console.log("🔄 Existing user - skipping Firestore document creation");
    }

    return createResponse(200, {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      localId: data.localId,
      email: data.email,
      displayName: data.displayName,
      photoUrl: data.photoUrl,
      isNewUser: data.isNewUser || false,
    });
  } catch (error) {
    console.error("❌ Firebase sign-in error:", error.message);
    console.error("🔍 Full error details:", error);
    return createResponse(500, { error: error.message });
  }
};
