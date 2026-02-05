exports.getUCSRPending = async (req, res, next) => {
  try {
    const payload = await getFilesForProcessing();
    const summary = [];

    for (const file of payload) {
      try {
        console.log('Processing file:', file.id);
        
        const decryptedFile = await decryptSingleFile(file);

        // CRITICAL FIX: Pass false to prevent auto-insert
        const excelData = await processExcelFile(
          decryptedFile.decrypted_content,
          file.id,
          file.client_id,
          false  // DON'T execute inserts yet!
        );

        const remarkMessage = (excelData.remarks || [])
          .map(item => item.error)
          .filter(error => error)
          .join(', ');

        // SUCCESS SCENARIO
        if (excelData.successCount > 0) {
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

          await fileMaster.updateFileStatus(
            file.id,
            'Scanned',
            remarkMessage,
            req.user.id
          );

          // NOW insert data AFTER status update
          await excelData.executeInsert();

          summary.push({
            id: file.id,
            name: file.file_name,
            status: 'Scanned'
          });
        }
        // REJECTED SCENARIO
        else if (excelData.successCount === 0 && excelData.failedCount > 0) {
          await fileMaster.updateFileStatus(
            file.id,
            'Rejected',
            remarkMessage || 'All rows failed validation',
            req.user.id
          );

          // NO data insert here!

          summary.push({
            id: file.id,
            name: file.file_name,
            status: 'Rejected'
          });
        }

      } catch (err) {
        console.error(`ERROR for file ${file.id}:`, err.message);

        // Invalid headers
        if (err.message && err.message.startsWith('Invalid Excel headers')) {
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
        } 
        // Code errors
        else {
          console.log(`Calling updateFileExceptionRemark for file ${file.id}`);
          
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
