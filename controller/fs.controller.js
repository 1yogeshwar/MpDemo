const path = require('path');
const fs = require('fs');
const { processExcelFile, exportExcelFile } = require('../service/fs.service');

exports.uploadExcelController = async (req, res) => {
  try {
    const filePath = req.file.path; // Multer's temp path
    const processedData = await processExcelFile(filePath);

    // Now this returns a real Buffer, not a string path
    const excelBuffer = await exportExcelFile(processedData);

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="validate_data.xlsx"'
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    // Send the actual binary data
    return res.send(excelBuffer);

  } catch (error) {
    console.error('Upload Controller Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};
