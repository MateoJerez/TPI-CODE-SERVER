const express = require('express');
const router = express.Router();
const { listarAlumnos } = require('../controllers/alumno.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/', verifyToken, listarAlumnos);

module.exports = router;
