const express = require('express');
const router = express.Router();
const alumnadoController = require('../controllers/alumnado.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.get('/alumnos', alumnadoController.listarAlumnos);
router.post('/notas', alumnadoController.crearNota);
router.get('/alumno/:id', alumnadoController.getAlumno);

module.exports = router;
