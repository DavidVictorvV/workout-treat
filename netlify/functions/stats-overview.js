const { verifyToken, createResponse, handleCORS } = require('./shared/auth-middleware');
const { getFirestore } = require('./shared/firebase-config');
const { getUserProfile } = require('./shared/user-helpers');

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
    const userProfile = await getUserProfile(userId);

    const [workoutHistorySnapshot, purchasesSnapshot] = await Promise.all([
      db.collection('workout_history').where('userId', '==', userId).get(),
      db.collection('purchases').where('userId', '==', userId).get()
    ]);

    const totalWorkouts = workoutHistorySnapshot.size;
    let totalPointsEarned = 0;
    const uniqueWorkoutTypes = new Set();

    workoutHistorySnapshot.forEach(doc => {
      const data = doc.data();
      totalPointsEarned += data.pointsEarned || 0;
      uniqueWorkoutTypes.add(data.workoutId);
    });

    let totalPointsSpent = 0;
    purchasesSnapshot.forEach(doc => {
      const data = doc.data();
      totalPointsSpent += data.pointsSpent || 0;
    });

    return createResponse(200, {
      totalPoints: userProfile.totalPoints,
      currentStreak: userProfile.currentStreak,
      longestStreak: userProfile.longestStreak,
      totalWorkouts,
      totalPointsEarned,
      totalPointsSpent,
      uniqueWorkoutTypes: uniqueWorkoutTypes.size,
      memberSince: userProfile.memberSince
    });

  } catch (error) {
    console.error('Stats overview error:', error);
    
    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return createResponse(401, { error: error.message });
    }
    
    return createResponse(500, { error: "Internal server error" });
  }
};