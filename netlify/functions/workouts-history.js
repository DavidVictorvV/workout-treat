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
    
    const { startDate, endDate } = event.queryStringParameters || {};

    const db = getFirestore();
    const workoutHistory = [];
    
    // Try to get data from individual workout history first (new structure)
    let individualHistoryData = [];
    try {
      let query = db.collection('users').doc(userId).collection('workout_history');

      if (startDate && endDate) {
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
          return createResponse(400, { error: "Invalid date format. Use YYYY-MM-DD" });
        }
        
        query = query.where('date', '>=', startDate).where('date', '<=', endDate);
      }

      const historySnapshot = await query.orderBy('completedAt', 'desc').get();
      
      if (historySnapshot && historySnapshot.docs && historySnapshot.docs.length > 0) {
        console.log(`Found ${historySnapshot.docs.length} workouts in individual history for user:`, userId);
        
        for (const doc of historySnapshot.docs) {
          const data = doc.data();
          individualHistoryData.push({
            id: data.workoutId || doc.id,
            workoutName: data.workoutName || 'Unknown Workout',
            workoutIcon: data.workoutIcon || '🏃',
            category: data.category || 'unknown',
            pointsEarned: data.pointsEarned || 0,
            completedAt: data.completedAt || new Date().toISOString(),
            date: data.date || new Date(data.completedAt).toISOString().split('T')[0]
          });
        }
      }
    } catch (queryError) {
      console.log('Individual workout history not available for user:', userId);
    }

    // Try daily summaries if no individual history (fallback to consolidated structure)
    let dailySummaryData = [];
    if (individualHistoryData.length === 0) {
      try {
        let query = db.collection('users').doc(userId).collection('daily_workouts');

        if (startDate && endDate) {
          // For date filtering, we filter by document ID (which is the date)
          query = query.where(db.FieldPath.documentId(), '>=', startDate).where(db.FieldPath.documentId(), '<=', endDate);
        }

        const historySnapshot = await query.orderBy(db.FieldPath.documentId(), 'desc').get();
        
        if (historySnapshot && historySnapshot.docs && historySnapshot.docs.length > 0) {
          console.log(`Found ${historySnapshot.docs.length} daily summaries for user:`, userId);
          
          // Transform daily summary data to individual entries
          for (const doc of historySnapshot.docs) {
            const dailyData = doc.data();
            
            if (!dailyData || !dailyData.workouts || !Array.isArray(dailyData.workouts) || !dailyData.workoutDetails) {
              continue;
            }
            
            for (const workoutId of dailyData.workouts) {
              const workoutDetail = dailyData.workoutDetails[workoutId];
              if (!workoutDetail) continue;
              
              dailySummaryData.push({
                id: workoutId,
                workoutName: workoutDetail.name || 'Unknown Workout',
                workoutIcon: workoutDetail.icon || '🏃',
                category: workoutDetail.category || 'unknown',
                pointsEarned: workoutDetail.points || 0,
                completedAt: workoutDetail.completedAt || dailyData.lastCompletedAt || new Date().toISOString(),
                date: dailyData.date || doc.id
              });
            }
          }
        }
      } catch (queryError) {
        console.log('Daily workouts structure not available for user:', userId);
      }
    }

    // If no data in individual or daily summaries, try old global structure for backward compatibility
    let oldStructureData = [];
    if (individualHistoryData.length === 0 && dailySummaryData.length === 0) {
      try {
        let oldQuery = db.collection('workout_history').where('userId', '==', userId);

        if (startDate && endDate) {
          oldQuery = oldQuery.where('date', '>=', startDate).where('date', '<=', endDate);
        }

        const oldHistorySnapshot = await oldQuery.orderBy('completedAt', 'desc').get();
        
        if (oldHistorySnapshot && oldHistorySnapshot.docs && oldHistorySnapshot.docs.length > 0) {
          console.log(`Found ${oldHistorySnapshot.docs.length} workouts in old global structure for user:`, userId);
          
          for (const doc of oldHistorySnapshot.docs) {
            const data = doc.data();
            oldStructureData.push({
              id: data.workoutId || doc.id,
              workoutName: data.workoutName || 'Unknown Workout',
              workoutIcon: data.workoutIcon || '🏃',
              category: data.category || 'unknown',
              pointsEarned: data.pointsEarned || 0,
              completedAt: data.completedAt || new Date().toISOString(),
              date: data.date || new Date(data.completedAt).toISOString().split('T')[0]
            });
          }
        }
      } catch (oldQueryError) {
        console.log('Old workout_history collection query failed:', oldQueryError.message);
      }
    }

    // Prioritize individual history, then daily summaries, then old structure
    const combinedData = [...individualHistoryData, ...dailySummaryData, ...oldStructureData];
    
    console.log(`Returning ${combinedData.length} workouts for user ${userId} (${individualHistoryData.length} individual + ${dailySummaryData.length} daily + ${oldStructureData.length} old)`);

    return createResponse(200, {
      workouts: combinedData
    });

  } catch (error) {
    console.error('Workout history error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    
    if (error.message.includes('Authorization') || error.message.includes('token')) {
      return createResponse(401, { error: error.message });
    }
    
    return createResponse(500, { 
      error: "Internal server error",
      details: error.message // Include error message for debugging
    });
  }
};