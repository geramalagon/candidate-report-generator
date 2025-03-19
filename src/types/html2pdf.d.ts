declare module 'html2pdf.js' {
  function html2pdf(): html2pdf.Html2PdfInstance;
  
  namespace html2pdf {
    interface Html2PdfInstance {
      set(options: Html2PdfOptions): Html2PdfInstance;
      from(element: HTMLElement): Html2PdfInstance;
      save(): Promise<void>;
    }
    
    interface Html2PdfOptions {
      margin?: number;
      filename?: string;
      image?: {
        type?: string;
        quality?: number;
      };
      html2canvas?: {
        scale?: number;
        useCORS?: boolean;
      };
      jsPDF?: {
        unit?: string;
        format?: string;
        orientation?: 'portrait' | 'landscape';
      };
    }
  }
  
  export = html2pdf;
} 