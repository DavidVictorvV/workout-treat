exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  const { email, password, displayName } = JSON.parse(event.body);

  if (!email || !password) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Email and password are required" }),
    };
  }

  // Basic password validation
  if (password.length < 6) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Password must be at least 6 characters long",
      }),
    };
  }

  const firebaseApiKey = process.env.FIREBASE_API_KEY;

  try {
    // Create new user account
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

    const data = await response.json();

    if (data.error) {
      // Handle common Firebase errors
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
        body: JSON.stringify({ error: errorMessage }),
      };
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        localId: data.localId,
        email: data.email,
        displayName: data.displayName || null,
        isNewUser: true,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
