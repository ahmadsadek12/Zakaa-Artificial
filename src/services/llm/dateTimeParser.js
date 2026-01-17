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
  
  // Pattern: 7pm, 6:30pm, 19:00, 7:30 PM, 7 p.m., 7pm
  // Improved regex to better capture time with optional spaces
  const timeMatch = lowerText.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|a m|p m)?\b/i);
  if (timeMatch) {
    hour = parseInt(timeMatch[1]);
    minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3] ? timeMatch[3].toLowerCase().replace(/\./g, '').replace(/\s/g, '') : null;
    
    // Convert to 24-hour format
    if (meridiem === 'pm' && hour < 12) {
      hour += 12;
    } else if (meridiem === 'am' && hour === 12) {
      hour = 0;
    } else if (!meridiem) {
      // If no AM/PM specified:
      // - If hour is 0-11, assume PM for typical restaurant hours (1pm, 2pm, etc.)
      // - If hour is 12-23, use as-is (12 = noon, 13 = 1pm, etc.)
      if (hour >= 1 && hour <= 11) {
        hour += 12; // Assume PM
      }
      // If hour is 0, it's midnight (00:00), keep as 0
      // If hour is 12-23, use as-is (already 24-hour format)
    }
  }
  
  // Set time if parsed - MUST use business timezone, not server timezone
  // The issue: setHours() uses server timezone (UTC), not business timezone
  // Solution: Use helper function to get timezone offset, then adjust UTC time
  if (hour !== null) {
    // Get the date (year, month, day) as it appears in the business timezone
    const dateFormatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const dateParts = dateFormatter.formatToParts(resultDate);
    const tzYear = dateParts.find(p => p.type === 'year').value;
    const tzMonth = dateParts.find(p => p.type === 'month').value;
    const tzDay = dateParts.find(p => p.type === 'day').value;
    
    // Helper function to get timezone offset in hours for a specific date
    function getTimezoneOffsetHours(timezoneName, date) {
      // Format the date in business timezone and UTC
      const formatterTz = new Intl.DateTimeFormat('en-US', {
        timeZone: timezoneName,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const formatterUtc = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      const tzTime = formatterTz.format(date);
      const utcTime = formatterUtc.format(date);
      
      const [tzHour, tzMin] = tzTime.split(':').map(Number);
      const [utcHour, utcMin] = utcTime.split(':').map(Number);
      
      // Calculate difference: business TZ - UTC
      const tzMinutes = tzHour * 60 + tzMin;
      const utcMinutes = utcHour * 60 + utcMin;
      let diffMinutes = tzMinutes - utcMinutes;
      
      // Handle day wrap-around (could be -23 to +23 hours difference)
      if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
      if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
      
      return diffMinutes / 60; // Return hours
    }
    
    // Get timezone offset for the target date
    const offsetHours = getTimezoneOffsetHours(timezone, resultDate);
    
    // User wants hour:minute in business timezone
    // To convert to UTC: subtract the offset
    // Example: Lebanon (UTC+2), user wants 19:00, so UTC = 19:00 - 2 = 17:00
    let utcHour = hour - offsetHours;
    let utcMinute = minute;
    
    // Handle day boundaries
    if (utcHour < 0) {
      utcHour += 24;
      resultDate.setDate(resultDate.getDate() - 1);
    }
    if (utcHour >= 24) {
      utcHour -= 24;
      resultDate.setDate(resultDate.getDate() + 1);
    }
    
    // Create date with UTC time
    const utcYear = resultDate.getUTCFullYear();
    const utcMonth = resultDate.getUTCMonth() + 1;
    const utcDay = resultDate.getUTCDate();
    const utcDateStr = `${utcYear}-${String(utcMonth).padStart(2, '0')}-${String(utcDay).padStart(2, '0')}T${String(utcHour).padStart(2, '0')}:${String(utcMinute).padStart(2, '0')}:00Z`;
    resultDate = new Date(utcDateStr);
    
    // Log for debugging
    logger.debug('Time parsed with timezone', {
      input: text,
      parsedHour: hour,
      parsedMinute: minute,
      timezone,
      offsetHours,
      utcHour,
      utcMinute,
      resultDate: resultDate.toISOString(),
      businessTime: resultDate.toLocaleString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }),
      businessDate: resultDate.toLocaleString('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    });
  } else {
    // Default to next available opening time
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][resultDate.getDay()];
    const todayHours = openingHours.find(h => h.day_of_week === dayOfWeek);
    
    if (todayHours && todayHours.open_time && !todayHours.is_closed) {
      const [openHour, openMinute] = todayHours.open_time.split(':').map(n => parseInt(n));
      
      // Helper to get offset
      function getTimezoneOffsetHours(timezoneName, date) {
        const formatterTz = new Intl.DateTimeFormat('en-US', {
          timeZone: timezoneName,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const formatterUtc = new Intl.DateTimeFormat('en-US', {
          timeZone: 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const tzTime = formatterTz.format(date);
        const utcTime = formatterUtc.format(date);
        const [tzHour, tzMin] = tzTime.split(':').map(Number);
        const [utcHour, utcMin] = utcTime.split(':').map(Number);
        const tzMinutes = tzHour * 60 + tzMin;
        const utcMinutes = utcHour * 60 + utcMin;
        let diffMinutes = tzMinutes - utcMinutes;
        if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
        if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
        return diffMinutes / 60;
      }
      
      const offsetHours = getTimezoneOffsetHours(timezone, resultDate);
      let utcHour = openHour - offsetHours;
      let utcMinute = openMinute;
      
      if (utcHour < 0) {
        utcHour += 24;
        resultDate.setDate(resultDate.getDate() - 1);
      }
      if (utcHour >= 24) {
        utcHour -= 24;
        resultDate.setDate(resultDate.getDate() + 1);
      }
      
      const utcYear = resultDate.getUTCFullYear();
      const utcMonth = resultDate.getUTCMonth() + 1;
      const utcDay = resultDate.getUTCDate();
      const utcDateStr = `${utcYear}-${String(utcMonth).padStart(2, '0')}-${String(utcDay).padStart(2, '0')}T${String(utcHour).padStart(2, '0')}:${String(utcMinute).padStart(2, '0')}:00Z`;
      resultDate = new Date(utcDateStr);
    } else {
      // Default to noon in business timezone
      function getTimezoneOffsetHours(timezoneName, date) {
        const formatterTz = new Intl.DateTimeFormat('en-US', {
          timeZone: timezoneName,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const formatterUtc = new Intl.DateTimeFormat('en-US', {
          timeZone: 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const tzTime = formatterTz.format(date);
        const utcTime = formatterUtc.format(date);
        const [tzHour, tzMin] = tzTime.split(':').map(Number);
        const [utcHour, utcMin] = utcTime.split(':').map(Number);
        const tzMinutes = tzHour * 60 + tzMin;
        const utcMinutes = utcHour * 60 + utcMin;
        let diffMinutes = tzMinutes - utcMinutes;
        if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
        if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
        return diffMinutes / 60;
      }
      
      const offsetHours = getTimezoneOffsetHours(timezone, resultDate);
      let utcHour = 12 - offsetHours;
      
      if (utcHour < 0) {
        utcHour += 24;
        resultDate.setDate(resultDate.getDate() - 1);
      }
      if (utcHour >= 24) {
        utcHour -= 24;
        resultDate.setDate(resultDate.getDate() + 1);
      }
      
      const utcYear = resultDate.getUTCFullYear();
      const utcMonth = resultDate.getUTCMonth() + 1;
      const utcDay = resultDate.getUTCDate();
      const utcDateStr = `${utcYear}-${String(utcMonth).padStart(2, '0')}-${String(utcDay).padStart(2, '0')}T${String(utcHour).padStart(2, '0')}:00:00Z`;
      resultDate = new Date(utcDateStr);
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
