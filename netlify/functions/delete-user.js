const { verifyToken, createResponse, handleCORS } = require('./shared/auth-middleware');
const { getFirestore, getAuth } = require('./shared/firebase-config');

/**
 * Delete User Account - DELETE /delete-user
 * Permanently deletes user account and all associated data
 */
exports.handler = async function (event, context) {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== "DELETE") {
    return createResponse(405, { error: "Method not allowed" });
  }

  try {
    const decodedToken = await verifyToken(event);
    const userId = decodedToken.uid;
    const db = getFirestore();
    const auth = getAuth();

    console.log(`🗑️  Starting account deletion for user: ${userId}`);

    // Use a transaction to ensure all deletions happen together
    await db.runTransaction(async (transaction) => {
      // 1. Delete user profile
      const userRef = db.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);
      if (userDoc.exists) {
        console.log(`🗑️  Deleting user profile: ${userId}`);
        transaction.delete(userRef);
      }

      // 2. Delete user workout progress
      const progressRef = db.collection('user_progress').doc(userId);
      const progressDoc = await transaction.get(progressRef);
      if (progressDoc.exists) {
        console.log(`🗑️  Deleting workout progress: ${userId}`);
        transaction.delete(progressRef);
      }

      // 3. Delete user's daily workouts subcollection
      const dailyWorkoutsRef = db.collection('users').doc(userId).collection('daily_workouts');
      const dailyWorkoutsSnapshot = await dailyWorkoutsRef.get();
      dailyWorkoutsSnapshot.docs.forEach(doc => {
        console.log(`🗑️  Deleting daily workout: ${doc.id}`);
        transaction.delete(doc.ref);
      });

      // 4. Delete user's workout history subcollection
      const workoutHistoryRef = db.collection('users').doc(userId).collection('workout_history');
      const workoutHistorySnapshot = await workoutHistoryRef.get();
      workoutHistorySnapshot.docs.forEach(doc => {
        console.log(`🗑️  Deleting workout history: ${doc.id}`);
        transaction.delete(doc.ref);
      });

      // 5. Delete old global workout history entries (for backward compatibility)
      const oldWorkoutHistoryRef = db.collection('workout_history').where('userId', '==', userId);
      const oldWorkoutHistorySnapshot = await oldWorkoutHistoryRef.get();
      oldWorkoutHistorySnapshot.docs.forEach(doc => {
        console.log(`🗑️  Deleting old workout history: ${doc.id}`);
        transaction.delete(doc.ref);
      });
    });

    // 6. Delete Firebase Authentication user (outside transaction)
    try {
      console.log(`🗑️  Deleting Firebase Auth user: ${userId}`);
      await auth.deleteUser(userId);
    } catch (authError) {
      console.error('Warning: Failed to delete Firebase Auth user:', authError);
      // Continue even if Firebase Auth deletion fails
      // The user data is already deleted from Firestore
    }

    console.log(`✅ Account deletion completed for user: ${userId}`);

    return createResponse(200, {
      success: true,
      message: "Account and all associated data have been permanently deleted"
    });

  } catch (error) {
    console.error('❌ Account deletion error:', error);
    
    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return createResponse(401, { error: error.message });
    }
    
    return createResponse(500, { 
      error: "Failed to delete account", 
      details: error.message 
    });
  }
};