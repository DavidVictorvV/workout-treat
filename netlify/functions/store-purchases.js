const { verifyToken, createResponse, handleCORS } = require('./shared/auth-middleware');
const { getFirestore } = require('./shared/firebase-config');

exports.handler = async function (event, context) {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "GET") {
    return createResponse(405, { error: "Method not allowed" });
  }

  try {
    const decodedToken = await verifyToken(event);
    const userId = decodedToken.uid;

    const db = getFirestore();
    const purchasesSnapshot = await db.collection('purchases')
      .where('userId', '==', userId)
      .orderBy('purchasedAt', 'desc')
      .get();
    
    const purchases = [];
    
    for (const doc of purchasesSnapshot.docs) {
      const purchaseData = doc.data();
      
      const itemDoc = await db.collection('store_items').doc(purchaseData.storeItemId).get();
      const itemData = itemDoc.data();
      
      purchases.push({
        id: doc.id,
        itemName: itemData?.name || 'Unknown Item',
        itemIcon: itemData?.icon || '🛒',
        pointsSpent: purchaseData.pointsSpent,
        purchasedAt: purchaseData.purchasedAt
      });
    }

    return createResponse(200, {
      purchases
    });

  } catch (error) {
    console.error('Purchases history error:', error);
    
    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return createResponse(401, { error: error.message });
    }
    
    return createResponse(500, { error: "Internal server error" });
  }
};