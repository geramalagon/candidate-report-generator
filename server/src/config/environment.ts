import dotenv from 'dotenv';
import path from 'path';

// Load .env file in development
if (process.env.NODE_ENV !== 'production') {
  const result = dotenv.config({
    path: path.resolve(__dirname, '../../.env')
  });
  
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  } else {
    console.log('Environment variables loaded:', {
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION,
    });
  }
}

// Environment variable configuration
export const config = {
  google: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'talenthq-451516',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    apiKey: process.env.GOOGLE_API_KEY,
    useWIF: process.env.NODE_ENV === 'production',
  },
  environment: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

// Validation function with more detailed error messages
export function validateConfig() {
  const requiredVars = ['GOOGLE_CLOUD_PROJECT', 'GOOGLE_CLOUD_LOCATION'] as const;
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('Authentication Configuration Error:');
    console.error('Missing required environment variables:', missingVars.join(', '));
    console.error('\nTo fix this:');
    console.error('1. For local development:');
    console.error('   - Run: gcloud auth application-default login');
    console.error('   - Set environment variables in .env file');
    console.error('2. For production:');
    console.error('   - Configure Workload Identity Federation');
    console.error('   - Set environment variables in Vercel');
    
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
} 