const { createResponse, handleCORS } = require('./shared/auth-middleware');
const { getFirestore } = require('./shared/firebase-config');
const { storeItems } = require('./shared/seed-data');

exports.handler = async function (event, context) {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "GET") {
    return createResponse(405, { error: "Method not allowed" });
  }

  try {
    const db = getFirestore();
    
    let itemsData = [];
    const itemsSnapshot = await db.collection('store_items').where('isAvailable', '==', true).get();
    
    if (itemsSnapshot.empty) {
      for (const item of storeItems) {
        await db.collection('store_items').doc(item.id).set(item);
      }
      itemsData = storeItems;
    } else {
      itemsData = itemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    return createResponse(200, {
      items: itemsData.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        icon: item.icon,
        category: item.category,
        price: item.price,
        isAvailable: item.isAvailable
      }))
    });

  } catch (error) {
    console.error('Store items error:', error);
    return createResponse(500, { error: "Internal server error" });
  }
};