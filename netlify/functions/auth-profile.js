const { verifyToken, createResponse, handleCORS } = require('./shared/auth-middleware');
const { getUserProfile, updateUserProfile } = require('./shared/user-helpers');
const { getAuth } = require('./shared/firebase-config');

exports.handler = async function (event, context) {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    const decodedToken = await verifyToken(event);
    const userId = decodedToken.uid;

    if (event.httpMethod === "GET") {
      const auth = getAuth();
      const firebaseUser = await auth.getUser(userId);
      const userProfile = await getUserProfile(userId);

      return createResponse(200, {
        user: {
          id: userId,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || userProfile.displayName || null,
          totalPoints: userProfile.totalPoints,
          currentStreak: userProfile.currentStreak,
          longestStreak: userProfile.longestStreak,
          lastWorkoutDate: userProfile.lastWorkoutDate,
          memberSince: userProfile.memberSince,
          fitnessLevel: userProfile.fitnessLevel
        }
      });
    }

    if (event.httpMethod === "PUT") {
      const { displayName, fitnessLevel } = JSON.parse(event.body);

      // Validate inputs
      if (displayName !== undefined && (!displayName || displayName.trim() === '')) {
        return createResponse(400, { error: "Display name cannot be empty" });
      }
      
      if (fitnessLevel !== undefined && (fitnessLevel < 1 || fitnessLevel > 10 || !Number.isInteger(fitnessLevel))) {
        return createResponse(400, { error: "Fitness level must be an integer between 1 and 10" });
      }

      // Update Firebase display name if provided
      if (displayName !== undefined) {
        const auth = getAuth();
        await auth.updateUser(userId, { displayName: displayName.trim() });
      }
      
      // Prepare update object
      const updates = {};
      if (displayName !== undefined) updates.displayName = displayName.trim();
      if (fitnessLevel !== undefined) updates.fitnessLevel = fitnessLevel;
      
      const updatedProfile = await updateUserProfile(userId, updates);

      return createResponse(200, {
        user: {
          id: userId,
          email: updatedProfile.email,
          displayName: updatedProfile.displayName || displayName?.trim(),
          totalPoints: updatedProfile.totalPoints,
          currentStreak: updatedProfile.currentStreak,
          longestStreak: updatedProfile.longestStreak,
          lastWorkoutDate: updatedProfile.lastWorkoutDate,
          memberSince: updatedProfile.memberSince,
          fitnessLevel: updatedProfile.fitnessLevel
        }
      });
    }

    return createResponse(405, { error: "Method not allowed" });

  } catch (error) {
    console.error('Profile error:', error);
    
    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return createResponse(401, { error: error.message });
    }
    
    return createResponse(500, { error: "Internal server error" });
  }
};