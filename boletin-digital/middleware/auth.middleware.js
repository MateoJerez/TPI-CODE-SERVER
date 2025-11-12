const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev';

function extractToken(req) {
  const cookieName = process.env.COOKIE_NAME || 'token';
  if (req.cookies && req.cookies[cookieName]) return req.cookies[cookieName];
  if (req.headers && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') return parts[1];
  }
  if (req.query && req.query.token) return req.query.token;
  return null;
}

function verifyToken(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      console.warn('verifyToken: token not found');
      return res.status(401).json({ ok: false, msg: 'No autenticado' });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.warn('verifyToken: jwt.verify failed', err && err.message);
      return res.status(401).json({ ok: false, msg: 'Token inválido' });
    }

    if (!payload || typeof payload !== 'object') {
      console.warn('verifyToken: invalid payload', payload);
      return res.status(401).json({ ok: false, msg: 'Token inválido' });
    }

    const id = payload.id ?? payload.userId ?? payload.sub;
    const id_rol = payload.rol ?? payload.role ?? payload.id_rol;

    if (!id) {
      console.warn('verifyToken: payload missing id field', payload);
      return res.status(401).json({ ok: false, msg: 'Token inválido: falta id' });
    }

    const userObj = { id: Number(id), id_rol: id_rol !== undefined ? Number(id_rol) : null, rawPayload: payload };

    req.user = userObj;
    req.usuario = userObj;

    return next();
  } catch (err) {
    console.error('verifyToken unexpected error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno en autenticación' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, msg: 'No autenticado' });
  if (Number(req.user.id_rol) !== 3) return res.status(403).json({ ok: false, msg: 'No autorizado' });
  return next();
}

module.exports = { verifyToken, requireAdmin };
