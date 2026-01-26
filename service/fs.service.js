const { Transform } = require('stream');
const pool = require('../config/db')
const ExcelJS = require('exceljs');
// const {isValidYYYYMMDD} = require('../utils/dateFormat')
const fs = require('fs');

const REQUIRED_HEADERS = [
  'ID',
  'Team',
  'Position',
  'Player',
  'Age',
  'Caps',
  'Goals',
  'WC Goals',
  'League',
  'Club'
];

exports.processExcelFile = async (filePath) => { 

    const  fileStream  = fs.createReadStream(filePath);

    //read excel row by row
    const workbook = new ExcelJS.stream.xlsx.WorkbookReader(fileStream);

      //create batch 
      const BATCH_SIZE = 100;
      let dbBuffer= [];  //store temp row
      let headerValidated = false;
      const processedData = [];

  function isValidYYYYMMDD(dateStr) {
  return typeof dateStr === 'string' &&
         /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr);
}
    //to write clean code, prevent sql injection
      const columns  = [...REQUIRED_HEADERS, 'Remarks'] 
       .map(col => `\`${col}\``)
       .join(', ');

    // const sql = `INSERT INTO matches (${columns}) VALUES ?`;
    //to ignore duplicasy
    const sql = `
INSERT IGNORE INTO matches (${columns})   
VALUES ?
`;

        for await (const worksheet of workbook){  //iterate over worksheet excel can have many

        for await (const row of worksheet){    //iterate over rows, one row at memory at a time

        const values = row.values.slice(1);   //extract row value


         //check header validate
                  if (!headerValidated) {
        const isValid =
          values.length === REQUIRED_HEADERS.length &&
          values.every((h, i) => h === REQUIRED_HEADERS[i]);

        if (!isValid) {
          throw new Error('Invalid Excel headers');
        }

        headerValidated = true;
        continue;
      }

      const rowData = {}
          // Header name  →  Column number  →  Cell value  →  rowData object
    REQUIRED_HEADERS.forEach((header, index) => {
  let cell = row.getCell(index + 1).value;

  if (header === 'Date') {
    if (!isValidYYYYMMDD(cell)) {
      cell = null; 
    }
  }

  rowData[header] = cell ?? null;
});


          //to add remark data
       const remarks = [];
      //  REQUIRED_HEADERS.forEach(col => {
        // if (rowData[col] === null || rowData[col] === '' || rowData[col] === 0) {
        //   remarks.push(`${col} is missing`);
       // }

REQUIRED_HEADERS.forEach(col => {
  const value = rowData[col];

  if (
    value === null ||
    value === undefined ||
    value === '' ||
    value === 0 ||
    value === '0'
  ) {
    remarks.push(`${col} is missing`);
  }
    rowData.remarks = remarks.join(',') 
      });
       
  processedData.push({ ...rowData });

          //push data into db now
              dbBuffer.push([
              ...REQUIRED_HEADERS.map(h => rowData[h]),
                rowData.remarks
                ]);

        if (dbBuffer.length >= BATCH_SIZE) {
  await pool.query(sql, [dbBuffer]);
  dbBuffer = []; 
}

        }
       }

         if (dbBuffer.length > 0) {
    await pool.query(sql, [dbBuffer]);
  }
  return processedData;
};

exports.exportExcelFile = async (processedData) =>{
   
   const workbook = new ExcelJS.Workbook(); // create new excel in memory
   const worksheet = workbook.addWorksheet('Validated Result'); // create sheet
   
   worksheet.addRow([...REQUIRED_HEADERS, 'Remarks']);

   processedData.forEach(row =>{
      worksheet.addRow([
        ...REQUIRED_HEADERS.map(h => row[h]),
        row.remarks
      ])
   })

     return await workbook.xlsx.writeBuffer();
}
