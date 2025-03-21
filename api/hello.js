// A minimal test endpoint to verify Vercel API routing
export default function handler(req, res) {
  // No dependencies, no complex logic
  const timestamp = new Date().toISOString();
  
  // Return a simple JSON response with basic information
  res.status(200).json({
    status: "ok",
    message: "API server is operational",
    timestamp: timestamp,
    environment: process.env.NODE_ENV || "unknown",
    // Include request info for verification
    method: req.method,
    path: req.url,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'host': req.headers['host']
    }
  });
} 