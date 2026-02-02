// 1️⃣ Decrypt the original encrypted file
const decryptedFile = await decryptSingleFile(file);

// 2️⃣ Process Excel (this inserts ROWS into DB)
const excelData = await processExcelFile(
  decryptedFile.decrypted_content
);

console.log('Rows processed:', excelData.count);

// 3️⃣ Export processed Excel (ALL columns + remarks)
const buffer = await exportValidated(
  excelData.processedData
);

// ❌ DO NOT write plain file to disk
// fs.writeFileSync(`./${file.file_name}`, buffer);

// 4️⃣ 🔐 Encrypt the processed Excel
const reEncrypted = await commonUtils.encryptFileBuffer(
  buffer,                  // processed Excel buffer
  file.file_name,
  file,
  file.encryption_key,
  file.encryption_iv
);

// 5️⃣ 💾 Store encrypted processed file in DB
await fileMaster.saveProcessedEncryptedFile({
  file_id: file.id,
  encrypted_file: reEncrypted.file
});

// 6️⃣ Update file status
await fileMaster.updateStatus(file.id, 'completed', {
  remark: `Success: ${excelData.count} rows processed`,
  scanned_on: new Date()
});

// 7️⃣ Push success summary
summary.push({
  id: file.id,
  name: file.file_name,
  status: 'Success'
});
