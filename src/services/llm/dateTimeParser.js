// Date/Time Parser
// Parse natural language date/time input for order scheduling

const logger = require('../../utils/logger');

/**
 * Parse natural language date/time text
 * @param {string} text - Natural language input (e.g., "tomorrow at 7pm", "Friday 6:30")
 * @param {string} timezone - Business timezone (default: 'Asia/Beirut')
 * @param {Array} openingHours - Array of opening hours from database
 * @returns {Date|null} - Parsed date or null if invalid
 */
function parseDateTime(text, timezone = 'Asia/Beirut', openingHours = []) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const lowerText = text.toLowerCase().trim();
  const now = new Date();
  
  // Initialize result date
  let resultDate = null;
  
  // Pattern 1: "tomorrow" or "tmrw" or "2moro"
  if (/\b(tomorrow|tmrw|2moro|tmw)\b/i.test(lowerText)) {
    resultDate = new Date(now);
    resultDate.setDate(resultDate.getDate() + 1);
  }
  
  // Pattern 2: "today"
  else if (/\btoday\b/i.test(lowerText)) {
    resultDate = new Date(now);
  }
  
  // Pattern 3: Day of week (monday, tuesday, etc.)
  else {
    const dayMatch = lowerText.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i);
    if (dayMatch) {
      const dayName = dayMatch[1].toLowerCase();
      const dayMap = {
        'monday': 1, 'mon': 1,
        'tuesday': 2, 'tue': 2,
        'wednesday': 3, 'wed': 3,
        'thursday': 4, 'thu': 4,
        'friday': 5, 'fri': 5,
        'saturday': 6, 'sat': 6,
        'sunday': 0, 'sun': 0
      };
      
      const targetDay = dayMap[dayName];
      const currentDay = now.getDay();
      
      // Calculate days to add (if same day, assume next week)
      let daysToAdd = (targetDay - currentDay + 7) % 7;
      if (daysToAdd === 0) {
        daysToAdd = 7; // Next occurrence of same day
      }
      
      resultDate = new Date(now);
      resultDate.setDate(resultDate.getDate() + daysToAdd);
    }
  }
  
  // Pattern 4: "in X hours" or "in X minutes"
  const inTimeMatch = lowerText.match(/\bin\s+(\d+)\s+(hour|hours|hr|hrs|minute|minutes|min|mins)\b/i);
  if (inTimeMatch) {
    const amount = parseInt(inTimeMatch[1]);
    const unit = inTimeMatch[2].toLowerCase();
    
    resultDate = new Date(now);
    
    if (unit.startsWith('hour') || unit.startsWith('hr')) {
      resultDate.setHours(resultDate.getHours() + amount);
    } else if (unit.startsWith('minute') || unit.startsWith('min')) {
      resultDate.setMinutes(resultDate.getMinutes() + amount);
    }
  }
  
  // If no date found, default to today
  if (!resultDate) {
    resultDate = new Date(now);
  }
  
  // Parse time component
  let hour = null;
  let minute = 0;
  
  // Pattern: 7pm, 6:30pm, 19:00, 7:30 PM
  const timeMatch = lowerText.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\b/i);
  if (timeMatch) {
    hour = parseInt(timeMatch[1]);
    minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3] ? timeMatch[3].toLowerCase().replace(/\./g, '') : null;
    
    // Convert to 24-hour format
    if (meridiem === 'pm' && hour < 12) {
      hour += 12;
    } else if (meridiem === 'am' && hour === 12) {
      hour = 0;
    } else if (!meridiem && hour < 12 && hour >= 1) {
      // If no AM/PM specified and hour is 1-11, assume PM for typical restaurant hours
      hour += 12;
    }
  }
  
  // Set time if parsed
  if (hour !== null) {
    resultDate.setHours(hour, minute, 0, 0);
  } else {
    // Default to next available opening time
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][resultDate.getDay()];
    const todayHours = openingHours.find(h => h.day_of_week === dayOfWeek);
    
    if (todayHours && todayHours.open_time && !todayHours.is_closed) {
      const [openHour, openMinute] = todayHours.open_time.split(':').map(n => parseInt(n));
      resultDate.setHours(openHour, openMinute, 0, 0);
    } else {
      // Default to noon
      resultDate.setHours(12, 0, 0, 0);
    }
  }
  
  // Validate against opening hours if provided
  if (openingHours && openingHours.length > 0) {
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][resultDate.getDay()];
    const dayHours = openingHours.find(h => h.day_of_week === dayOfWeek);
    
    if (dayHours) {
      if (dayHours.is_closed) {
        logger.warn('Parsed date falls on closed day', { date: resultDate, dayOfWeek });
        return null;
      }
      
      if (dayHours.open_time && dayHours.close_time) {
        const [openHour, openMinute] = dayHours.open_time.split(':').map(n => parseInt(n));
        const [closeHour, closeMinute] = dayHours.close_time.split(':').map(n => parseInt(n));
        
        const resultTime = resultDate.getHours() * 60 + resultDate.getMinutes();
        const openTime = openHour * 60 + openMinute;
        const closeTime = closeHour * 60 + closeMinute;
        
        if (resultTime < openTime || resultTime > closeTime) {
          logger.warn('Parsed time outside opening hours', {
            date: resultDate,
            resultTime,
            openTime,
            closeTime
          });
          return null;
        }
      }
    }
  }
  
  // Ensure scheduled time is in the future
  if (resultDate <= now) {
    logger.warn('Parsed date is in the past', { date: resultDate, now });
    return null;
  }
  
  return resultDate;
}

/**
 * Validate that scheduled time meets minimum hours requirement
 * @param {Date} scheduledDate - The scheduled date/time
 * @param {number} minScheduleHours - Minimum hours in advance required
 * @returns {Object} - { valid: boolean, hoursUntil: number, message: string }
 */
function validateMinScheduleTime(scheduledDate, minScheduleHours = 0) {
  if (!scheduledDate) {
    return { valid: false, hoursUntil: 0, message: 'Invalid date' };
  }
  
  const now = new Date();
  const msUntil = scheduledDate.getTime() - now.getTime();
  const hoursUntil = msUntil / (1000 * 60 * 60);
  
  if (hoursUntil < minScheduleHours) {
    return {
      valid: false,
      hoursUntil: Math.round(hoursUntil * 10) / 10,
      message: `This item requires scheduling at least ${minScheduleHours} hours in advance. You selected ${Math.round(hoursUntil * 10) / 10} hours from now.`
    };
  }
  
  return {
    valid: true,
    hoursUntil: Math.round(hoursUntil * 10) / 10,
    message: 'Valid scheduling time'
  };
}

/**
 * Format date for display
 * @param {Date} date
 * @param {string} language
 * @returns {string}
 */
function formatDate(date, language = 'english') {
  if (!date) return '';
  
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  const localeMap = {
    'arabic': 'ar-LB',
    'arabizi': 'en-US',
    'english': 'en-US',
    'french': 'fr-FR'
  };
  
  const locale = localeMap[language] || 'en-US';
  
  return date.toLocaleString(locale, options);
}

module.exports = {
  parseDateTime,
  validateMinScheduleTime,
  formatDate
};
