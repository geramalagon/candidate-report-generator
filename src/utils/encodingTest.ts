/**
 * Utility to test base64 encoding consistency across environments
 */

/**
 * Test data with various characters to ensure encoding handles different types of content
 */
export const TEST_DATA = {
  simple: "Hello, world!",
  withSpecialChars: "Special chars: !@#$%^&*()_+{}|:<>?",
  withEmoji: "With emoji: 🚀🔥🌟",
  withNewlines: "Line 1\nLine 2\r\nLine 3",
  withUnicode: "Unicode: 你好, مرحبا, こんにちは"
};

/**
 * Encodes test data to base64 and returns the results
 */
export function getLocalEncodings(): Record<string, string> {
  const results: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(TEST_DATA)) {
    results[key] = btoa(unescape(encodeURIComponent(value)));
  }
  
  return results;
}

/**
 * Compare local and server encodings and return any discrepancies
 */
export function compareEncodings(
  localEncodings: Record<string, string>,
  serverEncodings: Record<string, string>
): { 
  consistent: boolean;
  discrepancies: Array<{ key: string, local: string, server: string }> 
} {
  const discrepancies = [];
  
  for (const [key, localValue] of Object.entries(localEncodings)) {
    const serverValue = serverEncodings[key];
    
    if (localValue !== serverValue) {
      discrepancies.push({
        key,
        local: localValue,
        server: serverValue
      });
    }
  }
  
  return {
    consistent: discrepancies.length === 0,
    discrepancies
  };
} 