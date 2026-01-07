// Language Detector
// Detect language from text (arabic, arabizi, english, french)

/**
 * Simple language detection
 * In production, you might want to use a proper language detection library
 */
async function detectLanguage(text) {
  if (!text || text.length === 0) {
    return 'english'; // Default
  }
  
  const lowerText = text.toLowerCase();
  
  // Arabic script detection
  const arabicPattern = /[\u0600-\u06FF]/;
  if (arabicPattern.test(text)) {
    return 'arabic';
  }
  
  // Arabizi patterns (Arabic written in Latin script with numbers)
  const arabiziPattern = /[3|5|7|2|9|kh|sh|gh|3a|7a|2a]/i;
  if (arabiziPattern.test(lowerText)) {
    return 'arabizi';
  }
  
  // French patterns
  const frenchWords = ['bonjour', 'merci', 'oui', 'non', 'salut', 'ça', 'être', 'avoir'];
  if (frenchWords.some(word => lowerText.includes(word))) {
    return 'french';
  }
  
  // Default to English
  return 'english';
}

module.exports = {
  detectLanguage
};
