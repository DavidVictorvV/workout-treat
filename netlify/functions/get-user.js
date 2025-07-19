const admin = require("firebase-admin");
admin.initializeApp();

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const { userId, displayName } = event.queryStringParameters || {};

  if (!userId && !displayName) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Either userId or displayName is required",
      }),
    };
  }

  try {
    if (userId) {
      const userRecord = await admin.auth().getUser(userId);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          userId: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || null,
          photoUrl: userRecord.photoURL || null,
        }),
      };
    } else if (displayName) {
      const db = admin.firestore();
      const snapshot = await db
        .collection("users")
        .where("displayName", "==", displayName)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "User not found" }),
        };
      }

      const userDoc = snapshot.docs[0].data();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          userId: userDoc.userId,
          email: userDoc.email,
          displayName: userDoc.displayName,
          photoUrl: userDoc.photoUrl || null,
        }),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
