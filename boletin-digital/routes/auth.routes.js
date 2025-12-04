const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/logout', authController.logout);
router.get('/whoami', verifyToken, authController.whoami);
router.get('/me', verifyToken, authController.whoami);
router.post('/refresh', verifyToken, authController.refreshToken);


router.get('/invite', authController.getInvite);

module.exports = router;