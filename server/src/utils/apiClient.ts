import { config } from '../config/environment';
import { GoogleAuth } from 'google-auth-library';

// Initialize Google Auth client
const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

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

export async function generateContent(prompt: string) {
  try {
    // Get credentials
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    
    if (!accessToken.token) {
      throw new Error('Failed to get access token');
    }

    const endpoint = `https://${config.google.location}-aiplatform.googleapis.com/v1/projects/${config.google.projectId}/locations/${config.google.location}/publishers/google/models/gemini-2.0-flash:generateContent`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken.token}`,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      console.error(`Error: ${response.status} - ${response.statusText}`);
      throw new Error(`Failed to generate content: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Content generation failed:', error);
    throw error;
  }
}

// You can add more exported functions here
export async function otherFunction() {
  // ... implementation
} 