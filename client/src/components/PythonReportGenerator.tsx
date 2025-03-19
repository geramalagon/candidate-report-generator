import React, { useState, useRef } from 'react';
import axios from 'axios';

const PythonReportGenerator: React.FC = () => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [report, setReport] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // References to file inputs for resetting
  const csvInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      if (!file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      
      setCsvFile(file);
    } else {
      setCsvFile(null);
    }
  };

  const handlePdfFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      
      // Basic validation - just check file extension
      const nonPdfFiles = files.filter(file => !file.name.toLowerCase().endsWith('.pdf'));
      if (nonPdfFiles.length > 0) {
        setError(`Some files are not PDFs: ${nonPdfFiles.map(f => f.name).join(', ')}`);
        return;
      }
      
      setPdfFiles(files);
    } else {
      setPdfFiles([]);
    }
  };

  const resetForm = () => {
    setCsvFile(null);
    setPdfFiles([]);
    setError(null);
    setReport('');
    
    // Reset file inputs
    if (csvInputRef.current) csvInputRef.current.value = '';
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!csvFile) {
      setError('Please select a CSV file');
      return;
    }
    
    if (pdfFiles.length === 0) {
      setError('Please select at least one PDF file');
      return;
    }
    
    setLoading(true);
    
    try {
      // Create a new FormData object
      const formData = new FormData();
      
      // Append the CSV file
      formData.append('csvFile', csvFile);
      
      // Append each PDF file
      pdfFiles.forEach(file => {
        formData.append('pdfFiles', file);
      });
      
      console.log('Sending files to server:', {
        csv: csvFile.name,
        pdfs: pdfFiles.map(f => f.name)
      });
      
      // Send the request
      const response = await axios.post('/api/generate-report-python', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 300000 // 5 minute timeout
      });
      
      if (response.data.success) {
        setReport(response.data.data);
      } else {
        setError(response.data.error?.message || 'An error occurred');
      }
    } catch (err: any) {
      console.error('Error generating report:', err);
      setError(err.response?.data?.error?.message || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Python Report Generator</h2>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">CSV File:</label>
          <input 
            ref={csvInputRef}
            type="file" 
            accept=".csv" 
            onChange={handleCsvFileChange}
            className="border rounded p-2 w-full"
          />
          {csvFile && <p className="mt-1 text-sm text-gray-500">Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(2)} KB)</p>}
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">PDF Files:</label>
          <input 
            ref={pdfInputRef}
            type="file" 
            accept=".pdf" 
            multiple 
            onChange={handlePdfFilesChange}
            className="border rounded p-2 w-full"
          />
          {pdfFiles.length > 0 && (
            <div className="mt-1 text-sm text-gray-500">
              <p>Selected {pdfFiles.length} files:</p>
              <ul className="list-disc pl-5">
                {pdfFiles.map((file, index) => (
                  <li key={index}>{file.name} ({(file.size / 1024).toFixed(2)} KB)</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <div className="flex space-x-4">
          <button 
            type="submit" 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
            disabled={loading || !csvFile || pdfFiles.length === 0}
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          
          <button
            type="button"
            onClick={resetForm}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            disabled={loading}
          >
            Reset
          </button>
        </div>
      </form>
      
      {loading && (
        <div className="text-center p-4">
          <p>Generating report, please wait...</p>
        </div>
      )}
      
      {report && (
        <div className="mt-6">
          <h3 className="text-xl font-bold mb-2">Generated Report</h3>
          <div 
            className="border p-4 rounded bg-white"
            dangerouslySetInnerHTML={{ __html: report }}
          />
        </div>
      )}
    </div>
  );
};

export default PythonReportGenerator; 