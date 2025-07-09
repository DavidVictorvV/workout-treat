exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  const { idToken, testMode } = JSON.parse(event.body);

  if (!idToken) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Google ID token is required" }),
    };
  }

  // Test mode for Swagger testing - return mock data immediately
  if (testMode) {
    return {
      statusCode: 200,
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
    // Sign in with Google ID token
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postBody: `id_token=${idToken}&providerId=google.com`,
          requestUri: process.env.REQUEST_URI || "http://localhost:3000", // Your app's URI
          returnIdpCredential: true,
          returnSecureToken: true,
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: data.error.message }),
      };
    }

    // Return user data and tokens
    return {
      statusCode: 200,
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
      body: JSON.stringify({ error: error.message }),
    };
  }
};
