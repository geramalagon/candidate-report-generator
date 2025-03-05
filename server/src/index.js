const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = 3001;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

app.post('/generate-report', upload.fields([
  { name: 'csvFile', maxCount: 1 },
  { name: 'pdfFiles', maxCount: 10 }
]), (req, res) => {
  const csvFile = req.files.csvFile[0];
  const pdfFiles = req.files.pdfFiles;
  
  const pythonScriptPath = path.join(__dirname, 'candidate_report_generator.py');
  const pdfPaths = pdfFiles.map(file => file.path).join('" "');
  
  const command = `python "${pythonScriptPath}" "${csvFile.path}" "${pdfPaths}"`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing Python script: ${error}`);
      return res.status(500).json({ error: `Python script error: ${error.message || error}` });
    }
    
    // Clean up uploaded files
    fs.unlinkSync(csvFile.path);
    pdfFiles.forEach(file => fs.unlinkSync(file.path));
    
    res.send(stdout);
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
}); 