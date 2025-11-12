const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const { getBoletin } = require('../controllers/boletin.controller');

router.get('/', verifyToken, getBoletin);

router.post('/consulta', verifyToken, getBoletin);

module.exports = router;
