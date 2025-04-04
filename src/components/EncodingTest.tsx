import React, { useState, useEffect } from 'react';
import { getLocalEncodings, compareEncodings } from '../utils/encodingTest';

interface EncodingTestProps {
  productionUrl?: string;
  localUrl?: string;
}

interface DiagnosticsData {
  environment: string;
  serverTime: string;
  nodeVersion: string;
  expressJson: boolean;
  expressCors: boolean;
  hasEncodingEndpoints: boolean;
  [key: string]: any;
}

const EncodingTest: React.FC<EncodingTestProps> = ({
  productionUrl = 'https://your-production-url.vercel.app',
  localUrl = 'http://localhost:3001'
}) => {
  const [localResults, setLocalResults] = useState<any>(null);
  const [productionResults, setProductionResults] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [serverStatus, setServerStatus] = useState<'unknown' | 'up' | 'down'>('unknown');
  const [serverInfo, setServerInfo] = useState<any>(null);

  // Function to check if the server is up by using the simple /api/hello endpoint
  const checkServerStatus = async (baseUrl: string) => {
    try {
      console.log('Checking server status at:', baseUrl);
      // Use the native API route endpoint
      const url = baseUrl.includes('/api/') ? baseUrl : `${baseUrl}/api/hello`;
      
      const response = await fetch(url, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Server response:', data);
        setServerInfo(data);
        setServerStatus('up');
        return true;
      } else {
        console.error('Server check failed with status:', response.status);
        setServerStatus('down');
        return false;
      }
    } catch (error) {
      console.error('Error checking server status:', error);
      setServerStatus('down');
      return false;
    }
  };
  
  // Function to fetch diagnostics data
  const fetchDiagnostics = async (baseUrl: string) => {
    try {
      console.log('Fetching diagnostics from:', baseUrl);
      const url = baseUrl.includes('/api/') ? baseUrl : `${baseUrl}/api/health`;
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Health data:', data);
        
        // Transform the health data to match our diagnostics structure
        const diagnosticsData = {
          environment: data.environment || process.env.NODE_ENV || 'unknown',
          serverTime: data.timestamp || new Date().toISOString(),
          nodeVersion: data.node || 'unknown',
          expressJson: true,
          expressCors: true,
          hasEncodingEndpoints: true,
          memory: data.memory || {},
          components: data.components || {},
          uptime: data.uptime || 0
        };
        
        setDiagnostics(diagnosticsData);
        return diagnosticsData;
      } else {
        console.error('Health request failed with status:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error fetching health data:', error);
      return null;
    }
  };

  // Function to fetch server encodings using the GET endpoint
  const fetchServerEncodings = async (baseUrl: string) => {
    console.log('Fetching server encodings from:', baseUrl);
    
    try {
      // Construct the proper URL for the test-encoding endpoint
      const url = baseUrl.endsWith('/test-encoding') 
        ? baseUrl 
        : (baseUrl.endsWith('/api') 
          ? `${baseUrl}/test-encoding` 
          : `${baseUrl}/api/test-encoding`);
      
      console.log('Using encoding test URL:', url);
      
      // First try the GET endpoint which is more robust
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Server encoding response:', data);
      
      // Extract the results from the response
      return data.results || data;
    } catch (error) {
      console.error('Error fetching server encodings:', error);
      throw error;
    }
  };

  const runTests = async () => {
    setLoading(true);
    setError(null);
    setDiagnostics(null);
    setServerInfo(null);
    
    try {
      // Determine if we're in production
      const isProduction = window.location.hostname !== 'localhost';
      
      // For local environment testing
      let apiBaseUrl = isProduction ? '/api' : localUrl;
      console.log('Using API base URL:', apiBaseUrl);
      
      // First check if the server is up
      const serverUp = await checkServerStatus(apiBaseUrl);
      
      if (!serverUp) {
        setError(`Server at ${apiBaseUrl} is not responding. Check if it's running.`);
        setLoading(false);
        return;
      }
      
      // Then fetch health data
      await fetchDiagnostics(apiBaseUrl);
      
      // Test environment encodings
      console.log('Running encoding test');
      try {
        // Get browser-side encodings
        const localEncodings = getLocalEncodings();
        
        // Get server-side encodings
        const serverEncodings = await fetchServerEncodings(apiBaseUrl);
        
        // Compare encodings
        const comparison = compareEncodings(localEncodings, serverEncodings);
        
        setLocalResults({
          ...comparison,
          localEncodings,
          serverEncodings
        });
      } catch (err) {
        console.error('Error running encoding tests:', err);
        setError((err as Error).message || 'Failed to run encoding tests');
      }
      
      // Only run production test if in dev mode and URLs are different
      if (!isProduction && productionUrl) {
        // Skip production test for now as we're focusing on getting the local test working
        console.log('Skipping production environment test for now');
      }
    } catch (err) {
      setError('Failed to run encoding tests');
      console.error('Error running encoding tests:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="encoding-test p-4 border rounded shadow-sm mb-4">
      <h2 className="text-xl font-bold mb-4">Base64 Encoding Consistency Test</h2>
      
      <div className="mb-4 flex space-x-4">
        <button
          onClick={runTests}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Running Tests...' : 'Run Test'}
        </button>
        
        <button
          onClick={() => window.open('/api/hello', '_blank')}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Test Hello API
        </button>
        
        <button
          onClick={() => window.open('/api/health', '_blank')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Health API
        </button>
        
        <button
          onClick={() => window.open('/api/test-encoding', '_blank')}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Test Encoding API
        </button>
      </div>
      
      {error && (
        <div className="p-3 mb-4 bg-red-100 text-red-700 rounded">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}
      
      {/* Server Info Section */}
      {serverInfo && (
        <div className="mb-4 p-3 rounded bg-green-50 border">
          <h3 className="text-lg font-semibold mb-2">API Server Info</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>Status:</div>
            <div><span className="text-green-600">{serverInfo.status}</span></div>
            
            <div>Message:</div>
            <div>{serverInfo.message}</div>
            
            <div>Environment:</div>
            <div>{serverInfo.environment}</div>
            
            <div>Timestamp:</div>
            <div>{new Date(serverInfo.timestamp).toLocaleString()}</div>
            
            <div>Request Method:</div>
            <div>{serverInfo.method}</div>
            
            <div>Request Path:</div>
            <div>{serverInfo.path}</div>
          </div>
        </div>
      )}
      
      {/* Server Status Section */}
      <div className="mb-4 p-3 rounded bg-gray-50 border">
        <h3 className="text-lg font-semibold mb-2">Server Status</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>Status:</div>
          <div>
            {serverStatus === 'unknown' && <span className="text-gray-500">Unknown</span>}
            {serverStatus === 'up' && <span className="text-green-600">Up and Running ✓</span>}
            {serverStatus === 'down' && <span className="text-red-600">Not Responding ✗</span>}
          </div>
          
          <div>Environment:</div>
          <div>{diagnostics?.environment || serverInfo?.environment || 'Unknown'}</div>
          
          <div>Server Time:</div>
          <div>{diagnostics?.serverTime ? new Date(diagnostics.serverTime).toLocaleString() : 'Unknown'}</div>
          
          <div>Node Version:</div>
          <div>{diagnostics?.nodeVersion || 'Unknown'}</div>
        </div>
      </div>
      
      {/* Server Diagnostics Section (only show if available) */}
      {diagnostics && (
        <div className="mb-4 p-3 rounded bg-gray-50 border">
          <h3 className="text-lg font-semibold mb-2">Server Diagnostics</h3>
          <details>
            <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
              View Detailed Server Information
            </summary>
            <div className="mt-2 text-sm">
              <table className="w-full border-collapse">
                <tbody>
                  {Object.entries(diagnostics).map(([key, value]) => (
                    <tr key={key} className="border-b">
                      <td className="py-1 pr-4 font-medium">{key}:</td>
                      <td className="py-1">
                        {typeof value === 'object' 
                          ? <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(value, null, 2)}</pre>
                          : String(value)
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
      
      {localResults && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Encoding Test Results</h3>
          <div className="p-3 rounded bg-gray-100">
            <p>
              Status: {' '}
              <span className={localResults.consistent ? 'text-green-600' : 'text-red-600'}>
                {localResults.consistent ? 'Consistent ✓' : 'Inconsistent ✗'}
              </span>
            </p>
            {localResults.discrepancies.length > 0 && (
              <div className="mt-2">
                <p className="font-semibold">Discrepancies:</p>
                <ul className="list-disc pl-5">
                  {localResults.discrepancies.map((d: any, i: number) => (
                    <li key={i}>
                      <strong>{d.key}:</strong>
                      <div className="text-xs overflow-x-auto">
                        <div>Local: {d.local}</div>
                        <div>Server: {d.server}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Debugging Tips Section */}
      <div className="mt-4 p-4 border rounded bg-blue-50 text-sm">
        <h3 className="font-bold text-md mb-2">Debugging Tips</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>If the server status is <strong className="text-red-600">Not Responding</strong>, check if the server is running and accessible.</li>
          <li>
            <p><strong>Testing Native API Routes:</strong></p>
            <ul className="list-circle pl-5">
              <li>Click the test buttons above to directly access the API endpoints</li>
              <li>Check Vercel logs for any errors in the API routes</li>
              <li>Verify that <code>vercel.json</code> has correct route configurations</li>
            </ul>
          </li>
          <li>For Unicode issues, verify that both browser and server handle UTF-8 encoding properly</li>
        </ul>
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        Using API routes: <code>/api/hello</code>, <code>/api/health</code>, <code>/api/test-encoding</code>
      </div>
    </div>
  );
};

export default EncodingTest; 