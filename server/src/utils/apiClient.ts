import { config } from '../config/environment';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';

// Initialize Google Auth client
const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

// Approximate token count estimation (rough estimate)
function estimateTokenCount(text: string): number {
  // A very rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Function to truncate text to fit within token limit
function truncateToTokenLimit(text: string, maxTokens: number = 30000): string {
  const estimatedTokens = estimateTokenCount(text);
  
  if (estimatedTokens <= maxTokens) {
    return text;
  }
  
  // If we need to truncate, do it by character count (approximate)
  const maxChars = maxTokens * 4;
  console.warn(`Input text truncated from ~${estimatedTokens} tokens to ${maxTokens} tokens`);
  return text.substring(0, maxChars);
}

// Export the function
export async function fetchData() {
  try {
    // Get credentials
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    
    if (!accessToken.token) {
      throw new Error('Failed to get access token');
    }

    const endpoint = `https://${config.google.location}-aiplatform.googleapis.com/v1/projects/${config.google.projectId}/locations/${config.google.location}`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken.token}`,
      },
    });

    if (!response.ok) {
      console.error(`Error: ${response.status} - ${response.statusText}`);
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// Make sure the API key is available and log it (partially masked for security)
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error('GOOGLE_API_KEY environment variable is not set');
} else {
  // Log first 4 and last 4 characters of the API key for debugging
  const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
  console.log(`Using API key: ${maskedKey}`);
}

export async function generateContent(prompt: string) {
  try {
    // Log the full URL (with masked API key)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;
    const maskedUrl = url.replace(apiKey as string, apiKey?.substring(0, 4) + '...' + apiKey?.substring((apiKey as string).length - 4));
    console.log(`Making API request to: ${maskedUrl}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
          responseMimeType: "text/plain"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      throw new Error(`API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('API response received successfully');
    return data;
  } catch (error) {
    console.error('Error generating content:', error);
    throw error;
  }
}

// You can add more exported functions here
export async function otherFunction() {
  // ... implementation
} 