const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.use(requireAdmin);

router.get('/users', adminController.getUsers);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id', adminController.updateUser);
router.put('/users/:id/role', adminController.changeUserRole);

module.exports = router;
