import React from 'react';
import html2pdf from 'html2pdf.js';

interface DownloadButtonProps {
  htmlContent: string;
  filename?: string;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ 
  htmlContent, 
  filename = 'candidate-report.pdf' 
}) => {
  const handleDownload = () => {
    // Create a temporary div to hold the HTML content
    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    document.body.appendChild(element);
    
    // Configure html2pdf options
    const options = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // Generate PDF
    html2pdf()
      .set(options)
      .from(element)
      .save()
      .then(() => {
        // Remove the temporary element
        document.body.removeChild(element);
      });
  };

  return (
    <button 
      onClick={handleDownload}
      className="download-button"
      title="Download as PDF"
    >
      Download PDF
    </button>
  );
};

export default DownloadButton; 