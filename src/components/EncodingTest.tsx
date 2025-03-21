import React, { useState } from 'react';
import { getLocalEncodings, compareEncodings } from '../utils/encodingTest';

interface EncodingTestProps {
  productionUrl?: string;
  localUrl?: string;
}

const EncodingTest: React.FC<EncodingTestProps> = ({
  productionUrl = 'https://your-production-url.vercel.app',
  localUrl = 'http://localhost:3001'
}) => {
  const [localResults, setLocalResults] = useState<any>(null);
  const [productionResults, setProductionResults] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // New function to fetch server encodings using the GET endpoint
  const fetchServerEncodings = async (url: string) => {
    console.log('Fetching server encodings from:', url);
    
    try {
      // First try the GET endpoint which is more robust
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Server response:', data);
      
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
    
    try {
      // Determine if we're in production
      const isProduction = window.location.hostname !== 'localhost';
      
      // For local environment testing
      let localTestUrl = localUrl;
      if (isProduction) {
        // When running in production, use relative URL for "local" test
        localTestUrl = '/api/test-encoding';
        console.log('Using relative URL for server test in production');
      }
      
      // Test local environment (or the current server in production)
      console.log('Running local test with URL:', localTestUrl);
      try {
        // Get browser-side encodings
        const localEncodings = getLocalEncodings();
        
        // Get server-side encodings
        const serverEncodings = await fetchServerEncodings(localTestUrl);
        
        // Compare encodings
        const comparison = compareEncodings(localEncodings, serverEncodings);
        
        setLocalResults({
          ...comparison,
          localEncodings,
          serverEncodings
        });
      } catch (err) {
        console.error('Error running local tests:', err);
        setError((err as Error).message || 'Failed to run local encoding tests');
      }
      
      // Only run production test if in dev mode and URLs are different
      if (!isProduction && productionUrl !== localUrl) {
        // Test production environment
        console.log('Running production test with URL:', productionUrl);
        try {
          // Get browser-side encodings
          const localEncodings = getLocalEncodings();
          
          // Get server-side encodings
          const serverEncodings = await fetchServerEncodings(`${productionUrl}/api/test-encoding`);
          
          // Compare encodings
          const comparison = compareEncodings(localEncodings, serverEncodings);
          
          setProductionResults({
            ...comparison,
            localEncodings,
            serverEncodings
          });
        } catch (prodErr) {
          console.error('Error running production tests:', prodErr);
          // Don't fail completely if just the production test fails
        }
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
      
      <div className="mb-4">
        <button
          onClick={runTests}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Running Tests...' : 'Run Test'}
        </button>
      </div>
      
      {error && (
        <div className="p-3 mb-4 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}
      
      {localResults && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Local Environment</h3>
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
      
      {productionResults && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Production Environment</h3>
          <div className="p-3 rounded bg-gray-100">
            <p>
              Status: {' '}
              <span className={productionResults.consistent ? 'text-green-600' : 'text-red-600'}>
                {productionResults.consistent ? 'Consistent ✓' : 'Inconsistent ✗'}
              </span>
            </p>
            {productionResults.discrepancies.length > 0 && (
              <div className="mt-2">
                <p className="font-semibold">Discrepancies:</p>
                <ul className="list-disc pl-5">
                  {productionResults.discrepancies.map((d: any, i: number) => (
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
      
      {(localResults || productionResults) && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            Browser and server side encoding can differ with special characters or Unicode.
            If inconsistencies are found, consider implementing consistent encoding/decoding in both environments.
          </p>
        </div>
      )}
    </div>
  );
};

export default EncodingTest; 