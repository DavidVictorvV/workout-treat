const fetch = require("node-fetch");

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  const { email, password } = JSON.parse(event.body);

  if (!email || !password) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Email and password are required" }),
    };
  }

  const firebaseApiKey = process.env.FIREBASE_API_KEY;

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: data.error.message }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ idToken: data.idToken, refreshToken: data.refreshToken }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
