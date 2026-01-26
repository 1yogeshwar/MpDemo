const {
  processExcelFile,
  exportValidated
} = require('../service/fs.service');

exports.uploadController = async (req, res) => {
  try {
    // 1️⃣ File validation
    if (!req.file || !req.file.path) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // 2️⃣ Process excel (validate + batch insert)
    const processedData = await processExcelFile(req.file.path);

    if (!processedData || !processedData.length) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is empty or invalid'
      });
    }

    // 3️⃣ Export validated XLSX
    const buffer = exportValidated(processedData);

    // 4️⃣ Set headers (controller responsibility ✅)
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=validated.xlsx'
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    // 5️⃣ Send file
    return res.send(buffer);

  } catch (error) {
    console.error('Upload Controller Error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'File processing failed'
    });
  }
};
