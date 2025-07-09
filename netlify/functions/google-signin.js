exports.handler = async function (event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*", // Consider restricting to your domain
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  let idToken, testMode;
  try {
    const body = JSON.parse(event.body);
    idToken = body.idToken;
    testMode = body.testMode;
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  if (!idToken && !testMode) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Google ID token is required" }),
    };
  }

  // For mock testing (e.g., Swagger)
  if (testMode) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        idToken: "test_firebase_id_token_eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9",
        refreshToken: "test_firebase_refresh_token_AEu4IL2X7Y9k",
        localId: "test_user_id_123",
        email: "testuser@example.com",
        displayName: "Test User",
        photoUrl: "https://example.com/avatar.jpg",
        isNewUser: false,
      }),
    };
  }

  const firebaseApiKey = process.env.FIREBASE_API_KEY;

  try {
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
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "Unexpected response format from Firebase",
          status: firebaseResponse.status,
          rawResponse: rawText,
        }),
      };
    }

    const data = JSON.parse(rawText);

    if (data.error) {
      let errorMessage = data.error.message || "Unknown Firebase error";

      if (errorMessage.includes("INVALID_IDP_RESPONSE")) {
        errorMessage = "Invalid Google ID token or provider response";
      }

      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: errorMessage }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        localId: data.localId,
        email: data.email,
        displayName: data.displayName,
        photoUrl: data.photoUrl,
        isNewUser: data.isNewUser || false,
      }),
    };
  } catch (error) {
    console.error("Firebase sign-in error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
