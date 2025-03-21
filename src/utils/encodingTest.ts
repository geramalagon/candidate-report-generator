/**
 * Utility to test base64 encoding consistency across environments
 */

/**
 * Test data with various characters to ensure encoding handles different types of content
 */
const TEST_DATA = {
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
 * Fetches base64 encodings from server for comparison
 */
export async function getServerEncodings(apiUrl: string): Promise<Record<string, string>> {
  try {
    // Construct a proper URL that works in both development and production
    // If the URL already contains http:// or https://, use it as is
    // Otherwise, assume it's a relative URL or path
    let fullUrl = apiUrl;
    if (!apiUrl.includes('/api/')) {
      fullUrl = `${apiUrl}/api/test-encoding`;
    } else {
      fullUrl = apiUrl; // URL already contains the endpoint
    }

    console.log('Making encoding test request to:', fullUrl);
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(TEST_DATA)
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error testing server encodings:', error);
    throw error;
  }
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

/**
 * Run the full encoding test against a server
 */
export async function testEncodingConsistency(apiUrl: string): Promise<{
  consistent: boolean;
  discrepancies: Array<{ key: string, local: string, server: string }>;
  localEncodings: Record<string, string>;
  serverEncodings: Record<string, string>;
}> {
  const localEncodings = getLocalEncodings();
  const serverEncodings = await getServerEncodings(apiUrl);
  const comparison = compareEncodings(localEncodings, serverEncodings);
  
  return {
    ...comparison,
    localEncodings,
    serverEncodings
  };
} 