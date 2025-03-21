import React from 'react';
import EncodingTest from './components/EncodingTest';

function EncodingTestPage() {
  return (
    <div className="container mx-auto p-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Base64 Encoding Test</h1>
        <p className="text-gray-600">
          Test base64 encoding consistency between local and production environments
        </p>
      </header>

      <EncodingTest 
        localUrl="http://localhost:3001"
        productionUrl={window.location.origin.includes('localhost') 
          ? 'https://candidate-report-generator.vercel.app' 
          : window.location.origin}
      />

      <div className="mt-8 p-4 border rounded bg-yellow-50">
        <h2 className="text-xl font-bold mb-2">About this test</h2>
        <p>
          This test checks if base64 encoding is consistent between browser (frontend) and server (backend) environments.
          Inconsistencies can cause issues when encoding/decoding data like file contents.
        </p>
        
        <h3 className="text-lg font-semibold mt-4 mb-2">What we're testing</h3>
        <ul className="list-disc pl-5 mb-4">
          <li>Simple ASCII strings</li>
          <li>Strings with special characters</li>
          <li>Strings with emoji</li>
          <li>Strings with newlines</li>
          <li>Strings with Unicode characters</li>
        </ul>
        
        <h3 className="text-lg font-semibold mt-4 mb-2">Common issues</h3>
        <ul className="list-disc pl-5">
          <li>Different handling of Unicode characters between browsers and Node.js</li>
          <li>Newline character differences between environments</li>
          <li>Encoding/decoding differences for non-ASCII characters</li>
        </ul>
        
        <div className="mt-4 text-sm">
          <p className="font-semibold">How to fix inconsistencies:</p>
          <ol className="list-decimal pl-5">
            <li>Use consistent encoding/decoding libraries on both client and server</li>
            <li>Consider using Buffer in Node.js and specific encoding/decoding functions in the browser</li>
            <li>For file content, consider using standard libraries for handling binary data</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default EncodingTestPage; 