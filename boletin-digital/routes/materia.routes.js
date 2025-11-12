const express = require('express');
const router = express.Router();
const { listarMaterias } = require('../controllers/materia.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/', verifyToken, listarMaterias);

module.exports = router;
