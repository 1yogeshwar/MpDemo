const { getFilesForProcessing } = require('../services/getFileMaster.service');
const { decryptSingleFile } = require('../services/getPayload.service');
const { processExcelFile, exportValidated } = require('../services/fileProcess.service');
const commonUtils = require('../utils/common.utils');
const fs = require('fs');
const path = require('path');
const getPath = new (require('../config/s3.js'))();
const MOUNTED_BASE_STORE = getPath.getName('mounted-store-path');
const fileMaster = require('../models/fileMaster.model');

exports.getUCSRPending = async (req, res, next) => {
  try {
    const payload = await getFilesForProcessing();
    const summary = [];

    for (const file of payload) {
      try {
        console.log('Processing file:', file.id);
        const decryptedFile = await decryptSingleFile(file);

        const excelData = await processExcelFile(
          decryptedFile.decrypted_content,
          file.id,
          file.client_id
        );

        const remarkMessage = (excelData.remarks || [])
          .map(item => item.error)
          .filter(error => error)
          .join(', ');

        // Scenario 1: Any Success (successCount > 0) = Scanned
        // This includes: full success OR partial success
        if (excelData.successCount > 0) {
          // Data already inserted by processExcelFile
          // Re-encrypt and save file
          const buffer = await exportValidated(excelData.processedData);
          const reEncrypted = await commonUtils.encryptFileBuffer(
            buffer,
            file.file_name,
            'buffer',
            file.encryption_key,
            file.encryption_iv
          );

          const fullPath = path.join(MOUNTED_BASE_STORE, file.upload_file_path);
          fs.writeFileSync(fullPath, reEncrypted.file);

          // Update status to Scanned
          await fileMaster.updateFileStatus(
            file.id,
            'Scanned',
            remarkMessage,
            req.user.id
          );

          summary.push({
            id: file.id,
            name: file.file_name,
            status: 'Scanned'
          });
        }
        // Scenario 2: Complete Failure (successCount === 0 AND failedCount > 0)
        else if (excelData.successCount === 0 && excelData.failedCount > 0) {
          // NO data inserted to ucsr_sales_order (handled in processExcelFile)
          // Update status to Rejected
          await fileMaster.updateFileStatus(
            file.id,
            'Rejected',
            remarkMessage || 'All rows failed validation',
            req.user.id
          );

          summary.push({
            id: file.id,
            name: file.file_name,
            status: 'Rejected'
          });
        }

      } catch (err) {
        // Scenario 3: Exception handling
        if (err.message && err.message.startsWith('Invalid Excel headers')) {
          // Invalid headers = Rejected
          await fileMaster.updateFileStatus(
            file.id,
            'Rejected',
            err.message,
            req.user.id
          );

          summary.push({
            id: file.id,
            name: file.file_name,
            status: 'Rejected'
          });

        } else {
          // Code/Logic error: Do NOT change status, only update remark
          await fileMaster.updateFileExceptionRemark(
            file.id,
            err.message,
            req.user.id
          );

          summary.push({
            id: file.id,
            name: file.file_name,
            status: 'Error',
            error: err.message
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Files processed successfully',
      data: summary
    });

  } catch (err) {
    next(err);
  }
};
