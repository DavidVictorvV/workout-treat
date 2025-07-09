const fetch = require("node-fetch");

exports.handler = async function (event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*", // You can change this to a specific origin if needed
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

  const { email, password } = JSON.parse(event.body);

  if (!email || !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Email and password are required" }),
    };
  }

  const firebaseApiKey = process.env.FIREBASE_API_KEY;

  try {
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

      // Optional: Friendly messages
      if (errorMessage.includes("EMAIL_NOT_FOUND")) {
        errorMessage = "No account found with this email";
      } else if (errorMessage.includes("INVALID_PASSWORD")) {
        errorMessage = "Incorrect password";
      } else if (errorMessage.includes("USER_DISABLED")) {
        errorMessage = "This user account has been disabled";
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
        displayName: data.displayName || null,
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
