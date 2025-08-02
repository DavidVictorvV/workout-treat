const { verifyToken, createResponse, handleCORS } = require('./shared/auth-middleware');
const { getFirestore } = require('./shared/firebase-config');
const { workouts } = require('./shared/seed-data');

exports.handler = async function (event, context) {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "GET") {
    return createResponse(405, { error: "Method not allowed" });
  }

  try {
    const db = getFirestore();
    
    let workoutData = [];
    const workoutsSnapshot = await db.collection('workouts').where('isActive', '==', true).get();
    
    if (workoutsSnapshot.empty) {
      for (const workout of workouts) {
        await db.collection('workouts').doc(workout.id).set(workout);
      }
      workoutData = workouts;
    } else {
      workoutData = workoutsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    return createResponse(200, {
      workouts: workoutData.map(workout => ({
        id: workout.id,
        name: workout.name,
        icon: workout.icon,
        category: workout.category,
        duration: workout.duration,
        points: workout.points
      }))
    });

  } catch (error) {
    console.error('Workouts error:', error);
    return createResponse(500, { error: "Internal server error" });
  }
};