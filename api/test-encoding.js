// Base64 encoding test endpoint using Vercel's native API routes
export default function handler(req, res) {
  try {
    console.log('Received encoding test request via Vercel API route');
    
    // Handle both GET and POST requests
    if (req.method === 'GET') {
      // Pre-defined test data for GET requests
      const testData = {
        simple: "Hello, world!",
        withSpecialChars: "Special chars: !@#$%^&*()_+{}|:<>?",
        withEmoji: "With emoji: 🚀🔥🌟",
        withNewlines: "Line 1\nLine 2\r\nLine 3",
        withUnicode: "Unicode: 你好, مرحبا, こんにちは"
      };
      
      // Encode each test string
      const results = {};
      for (const [key, value] of Object.entries(testData)) {
        // Node.js Buffer provides proper UTF-8 handling
        results[key] = Buffer.from(value, 'utf-8').toString('base64');
      }
      
      res.status(200).json({
        success: true,
        message: 'Encoding test completed successfully',
        results
      });
    } 
    else if (req.method === 'POST') {
      // Handle custom test data from POST request
      const testData = req.body;
      
      if (!testData || typeof testData !== 'object') {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid request body, expected object',
          received: typeof testData
        });
      }
      
      // Encode each string in the request body
      const results = {};
      for (const [key, value] of Object.entries(testData)) {
        if (typeof value === 'string') {
          results[key] = Buffer.from(value, 'utf-8').toString('base64');
        } else {
          results[key] = `ERROR: Expected string value, got ${typeof value}`;
        }
      }
      
      res.status(200).json(results);
    }
    else {
      // Method not allowed
      res.status(405).json({
        success: false,
        error: `Method ${req.method} not allowed`
      });
    }
  } catch (error) {
    console.error('Error in encoding test endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to encode test data', 
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
} 