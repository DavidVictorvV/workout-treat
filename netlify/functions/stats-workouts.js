const { verifyToken, createResponse, handleCORS } = require('./shared/auth-middleware');
const { getFirestore } = require('./shared/firebase-config');
const { parse, format, startOfDay, endOfDay } = require('date-fns');

exports.handler = async function (event, context) {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "GET") {
    return createResponse(405, { error: "Method not allowed" });
  }

  try {
    const decodedToken = await verifyToken(event);
    const userId = decodedToken.uid;
    
    const { startDate, endDate } = event.queryStringParameters || {};

    const db = getFirestore();
    let query = db.collection('workout_history').where('userId', '==', userId);

    if (startDate && endDate) {
      const start = format(startOfDay(parse(startDate, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd');
      const end = format(endOfDay(parse(endDate, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd');
      
      query = query.where('date', '>=', start).where('date', '<=', end);
    }

    const historySnapshot = await query.orderBy('completedAt', 'desc').get();
    
    const workouts = [];
    let totalPointsEarned = 0;
    const uniqueWorkoutTypes = new Set();
    const activeDates = new Set();
    
    for (const doc of historySnapshot.docs) {
      const historyData = doc.data();
      
      const workoutDoc = await db.collection('workouts').doc(historyData.workoutId).get();
      const workoutData = workoutDoc.data();
      
      workouts.push({
        id: doc.id,
        workoutName: workoutData?.name || 'Unknown Workout',
        workoutIcon: workoutData?.icon || '💪',
        category: workoutData?.category || 'unknown',
        pointsEarned: historyData.pointsEarned,
        completedAt: historyData.completedAt,
        date: historyData.date
      });

      totalPointsEarned += historyData.pointsEarned || 0;
      uniqueWorkoutTypes.add(historyData.workoutId);
      activeDates.add(historyData.date);
    }

    return createResponse(200, {
      workouts,
      summary: {
        totalWorkouts: workouts.length,
        pointsEarned: totalPointsEarned,
        uniqueWorkoutTypes: uniqueWorkoutTypes.size,
        activeDays: activeDates.size
      }
    });

  } catch (error) {
    console.error('Stats workouts error:', error);
    
    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return createResponse(401, { error: error.message });
    }
    
    return createResponse(500, { error: "Internal server error" });
  }
};