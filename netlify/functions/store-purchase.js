const { verifyToken, createResponse, handleCORS } = require('./shared/auth-middleware');
const { getFirestore } = require('./shared/firebase-config');
const { getUserProfile, updateUserProfile } = require('./shared/user-helpers');
const { v4: uuidv4 } = require('uuid');

exports.handler = async function (event, context) {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "POST") {
    return createResponse(405, { error: "Method not allowed" });
  }

  try {
    const decodedToken = await verifyToken(event);
    const userId = decodedToken.uid;
    const { itemId } = JSON.parse(event.body);

    if (!itemId) {
      return createResponse(400, { error: "Item ID is required" });
    }

    const db = getFirestore();
    
    const itemDoc = await db.collection('store_items').doc(itemId).get();
    if (!itemDoc.exists || !itemDoc.data().isAvailable) {
      return createResponse(404, { error: "Item not found or unavailable" });
    }

    const item = itemDoc.data();
    const userProfile = await getUserProfile(userId);

    if (userProfile.totalPoints < item.price) {
      return createResponse(400, { error: "Insufficient points" });
    }

    const purchaseEntry = {
      id: uuidv4(),
      userId,
      storeItemId: itemId,
      pointsSpent: item.price,
      purchasedAt: new Date().toISOString()
    };

    const newTotalPoints = userProfile.totalPoints - item.price;

    await Promise.all([
      db.collection('purchases').doc(purchaseEntry.id).set(purchaseEntry),
      updateUserProfile(userId, {
        totalPoints: newTotalPoints
      })
    ]);

    return createResponse(200, {
      success: true,
      pointsSpent: item.price,
      newTotalPoints,
      item: {
        id: itemId,
        name: item.name,
        description: item.description
      }
    });

  } catch (error) {
    console.error('Purchase error:', error);
    
    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return createResponse(401, { error: error.message });
    }
    
    return createResponse(500, { error: "Internal server error" });
  }
};