const fetch = require("node-fetch");
const { createResponse, handleCORS } = require('./shared/auth-middleware');
const { getUserProfile } = require('./shared/user-helpers');

exports.handler = async function (event, context) {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "POST") {
    return createResponse(405, { error: "Method Not Allowed" });
  }

  try {
    console.log('Raw event.body:', event.body);
    console.log('Event body length:', event.body?.length);
    
    if (!event.body) {
      return createResponse(400, { error: "Request body is required" });
    }
    
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return createResponse(400, { error: "Email and password are required" });
    }

    const firebaseApiKey = process.env.FIREBASE_API_KEY;
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      let errorMessage = data.error.message;

      if (errorMessage.includes("EMAIL_NOT_FOUND")) {
        errorMessage = "No account found with this email";
      } else if (errorMessage.includes("INVALID_PASSWORD")) {
        errorMessage = "Incorrect password";
      } else if (errorMessage.includes("USER_DISABLED")) {
        errorMessage = "This user account has been disabled";
      }

      return createResponse(401, { error: errorMessage });
    }

    const userProfile = await getUserProfile(data.localId);

    return createResponse(200, {
      user: {
        id: data.localId,
        email: data.email,
        displayName: data.displayName || userProfile.displayName || null,
        totalPoints: userProfile.totalPoints,
        currentStreak: userProfile.currentStreak,
        longestStreak: userProfile.longestStreak,
        memberSince: userProfile.memberSince
      },
      token: data.idToken
    });

  } catch (error) {
    console.error('Login error:', error);
    
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return createResponse(400, { error: "Invalid JSON in request body" });
    }
    
    return createResponse(500, { error: "Internal server error" });
  }
};
