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
  
  // Check if this looks like an address (has address keywords)
  // Addresses often contain place names like "beirut" which shouldn't trigger language detection
  // But DON'T default to English just because of address keywords - keep previous language
  const addressKeywords = /\b(street|building|floor|block|avenue|road|boulevard|lane|drive|beirut|lebanon|salim|salam|abraj|hamra)\b/i;
  const isLikelyAddress = addressKeywords.test(lowerText) && lowerText.split(' ').length > 4;
  
  // If it's likely an address, check for Arabic numbers (3, 7, etc.) which indicate Arabizi
  if (isLikelyAddress) {
    const hasArabicNumbers = /[3|5|7|2|8|9]/.test(text);
    if (hasArabicNumbers) {
      return 'arabizi';
    }
    // Otherwise don't change language detection - let other patterns determine it
  }
  
  // Lebanese Arabizi patterns (Arabic written in Latin script with Lebanese-specific characters)
  // Lebanese uses: 2 (alif), 3 (ayn), 5 (kh), 6 (ta), 7 (ha), 8 (gh), 9 (qaf)
  // Common Lebanese words/patterns
  const lebaneseArabiziPatterns = [
    /[3|5|7|2|8|9]/,  // Arabic number substitutions
    /\b(kif|shu|mish|bi|ma|fi|min|3al|fiyyi|ana|inti|hiyye|huwwe)\b/i,  // Lebanese common words
    /\b(metl|wala|aw|bas|ayy|ktir|mnih|3alashan)\b/i,  // More Lebanese words
    /kis/i,  // Lebanese specific
    /7abb?/i,  // Love/habb
    /shuft/i,  // Saw (shuf)
    /7allak/i,  // Ready (7allak)
    /3amil/i,  // Doing (3amil)
    /7a2/i,  // True (7a2)
    /7alib/i,  // Milk (7alib)
  ];
  
  if (lebaneseArabiziPatterns.some(pattern => pattern.test(lowerText))) {
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
