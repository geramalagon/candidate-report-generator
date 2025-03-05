import React, { useState } from 'react';
import axios from 'axios';

function ReportGenerator() {
  const [reportHtml, setReportHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [pdfFiles, setPdfFiles] = useState([]);

  const handleCsvChange = (event) => {
    setCsvFile(event.target.files[0]);
  };

  const handlePdfChange = (event) => {
    setPdfFiles(Array.from(event.target.files));
  };

  const generateReport = async () => {
    if (!csvFile || pdfFiles.length === 0) {
      setError("Please select a CSV file and one or more PDF files.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setReportHtml('');

    const formData = new FormData();
    formData.append('csvFile', csvFile);
    pdfFiles.forEach(file => {
      formData.append('pdfFiles', file);
    });
    
    try {
      const response = await axios.post('http://localhost:3001/generate-report', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setReportHtml(response.data);
    } catch (err) {
      console.error("Error generating report:", err);
      setError(err.response?.data?.error || 'An error occurred while generating the report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Candidate Report Generator</h1>
      
      <div className="mb-4">
        <label htmlFor="csvFile" className="block text-gray-700 text-sm font-bold mb-2">
          CSV File:
        </label>
        <input 
          type="file" 
          id="csvFile" 
          accept=".csv" 
          onChange={handleCsvChange} 
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" 
        />
      </div>

      <div className="mb-4">
        <label htmlFor="pdfFiles" className="block text-gray-700 text-sm font-bold mb-2">
          PDF Files:
        </label>
        <input 
          type="file" 
          id="pdfFiles" 
          accept=".pdf" 
          multiple 
          onChange={handlePdfChange} 
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" 
        />
      </div>

      <button
        onClick={generateReport}
        disabled={loading}
        className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {loading ? 'Generating...' : 'Generate Report'}
      </button>

      {error && <p className="text-red-500 mt-2">{error}</p>}

      {reportHtml && (
        <div className="mt-4 p-4 border rounded">
          <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
        </div>
      )}
    </div>
  );
}

export default ReportGenerator; 