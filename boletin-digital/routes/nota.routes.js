const express = require('express');
const router = express.Router();
const { listarNotas, actualizarNota, cargarNota } = require('../controllers/nota.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/', verifyToken, listarNotas);
router.put('/', verifyToken, actualizarNota);
router.post('/cargar', verifyToken, cargarNota);

module.exports = router;
