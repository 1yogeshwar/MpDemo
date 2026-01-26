const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadExcelController } = require('../controller/fs.controller');

const upload = multer({ dest: 'uploads/' });


router.post('/validate-excel', upload.single('file'), uploadExcelController);

module.exports = router;

