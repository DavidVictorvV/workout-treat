exports.handler = async function (event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*", // Change to specific origin if needed
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight request
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

  const { idToken, testMode } = JSON.parse(event.body);

  if (!idToken) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Google ID token is required" }),
    };
  }

  // Test mode for Swagger or mock testing
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
    const response = await fetch(
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

    const data = await response.json();

    if (data.error) {
      let errorMessage = data.error.message;

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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
