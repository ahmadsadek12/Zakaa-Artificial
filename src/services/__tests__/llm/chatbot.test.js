// Chatbot Service Tests
// Basic tests for chatbot functionality

const { sanitizeResponse } = require('../../llm/chatbot');

describe('Chatbot Service', () => {
  describe('sanitizeResponse', () => {
    it('should truncate messages longer than 4096 characters', () => {
      const longMessage = 'a'.repeat(5000);
      const result = sanitizeResponse(longMessage);
      
      expect(result.length).toBeLessThanOrEqual(4096);
      expect(result).toContain('[Message truncated...]');
    });
    
    it('should remove HTML tags', () => {
      const message = 'Hello <script>alert("xss")</script> World';
      const result = sanitizeResponse(message);
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });
    
    it('should remove excessive whitespace', () => {
      const message = 'Hello\n\n\n\n\nWorld';
      const result = sanitizeResponse(message);
      
      // Should have max 3 consecutive newlines
      expect(result).not.toMatch(/\n{4,}/);
    });
    
    it('should return empty string for non-string input', () => {
      expect(sanitizeResponse(null)).toBe('');
      expect(sanitizeResponse(undefined)).toBe('');
      expect(sanitizeResponse(123)).toBe('');
    });
    
    it('should trim whitespace', () => {
      const message = '   Hello World   ';
      const result = sanitizeResponse(message);
      
      expect(result).toBe('Hello World');
    });
  });
});
