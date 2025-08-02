function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateDisplayName(displayName) {
  if (!displayName || typeof displayName !== 'string') {
    return false;
  }
  
  const trimmed = displayName.trim();
  return trimmed.length >= 2 && trimmed.length <= 50;
}

function validateWorkoutId(workoutId) {
  if (!workoutId || typeof workoutId !== 'string') {
    return false;
  }
  
  return workoutId.match(/^workout_\d+$/);
}

function validateItemId(itemId) {
  if (!itemId || typeof itemId !== 'string') {
    return false;
  }
  
  return itemId.match(/^item_\d+$/);
}

function validateDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return false;
  }
  
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

function validatePeriod(period) {
  return ['thisMonth', 'lastMonth'].includes(period);
}

function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

function validateRequestBody(body, requiredFields) {
  const errors = [];
  
  if (!body || typeof body !== 'object') {
    return ['Invalid request body'];
  }
  
  for (const field of requiredFields) {
    if (!body.hasOwnProperty(field) || body[field] === null || body[field] === undefined) {
      errors.push(`${field} is required`);
    }
  }
  
  return errors;
}

module.exports = {
  validateEmail,
  validateDisplayName,
  validateWorkoutId,
  validateItemId,
  validateDateString,
  validatePeriod,
  sanitizeInput,
  validateRequestBody
};