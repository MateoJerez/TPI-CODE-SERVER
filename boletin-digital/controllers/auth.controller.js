const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const COOKIE_NAME = process.env.COOKIE_NAME || 'token';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || false;
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || 'Lax';
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function parseExpirationToMs(exp) {
  if (!exp || typeof exp !== 'string') return undefined;
  const match = /^(\d+)([smhd])$/.exec(exp);
  if (!match) return undefined;
  const n = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default: return undefined;
  }
}

function sendTokenCookie(res, token) {
  const maxAge = parseExpirationToMs(process.env.JWT_EXPIRES_IN || JWT_EXPIRES_IN) || (1000 * 60 * 60 * 8);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    maxAge,
    path: '/'
  });
}

async function login(req, res) {
  try {
    const { email, password, id_rol } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, msg: 'Faltan email o contraseña' });

    const [rows] = await pool.query('SELECT id, nombre, apellido, email, password_hash, id_rol, password FROM usuarios WHERE email = ? LIMIT 1', [email]);
    const user = rows && rows[0];
    if (!user) return res.status(401).json({ ok: false, msg: 'Credenciales inválidas' });

    const hash = user.password_hash || user.password;
    const match = hash ? await bcrypt.compare(password, hash) : false;
    if (!match) return res.status(401).json({ ok: false, msg: 'Credenciales inválidas' });

    if (id_rol !== undefined && Number(id_rol) !== Number(user.id_rol)) {
      console.log('login: role mismatch between requested and stored (info only)');
    }

    const payload = { id: user.id, id_rol: user.id_rol };
    const token = signToken(payload);
    sendTokenCookie(res, token);

    return res.json({
      ok: true,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        id_rol: user.id_rol
      }
    });
  } catch (err) {
    console.error('auth.login error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: COOKIE_SECURE, sameSite: COOKIE_SAMESITE, path: '/' });
  return res.json({ ok: true, msg: 'Sesión finalizada' });
}

async function register(req, res) {
  try {
    const { nombre, apellido, email, password, dni, id_rol, invite_code } = req.body || {};
    if (!nombre || !apellido || !email || !password) return res.status(400).json({ ok: false, msg: 'Faltan datos obligatorios' });

    const [exists] = await pool.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [email]);
    if (exists && exists.length > 0) return res.status(409).json({ ok: false, msg: 'Email ya registrado' });

    const providedInviteRaw = invite_code;
    console.log('register: received id_rol=', id_rol, 'invite_code raw=', JSON.stringify(providedInviteRaw));

    const validInvite = String(process.env.INVITE_CODE || '').trim();
    const providedInvite = providedInviteRaw !== undefined && providedInviteRaw !== null ? String(providedInviteRaw).trim() : '';

    if (Number(id_rol) === 2) {
      if (!providedInvite || providedInvite !== validInvite) {
        console.warn('register: invite mismatch. provided=', providedInvite, ' expected=', validInvite);
        return res.status(403).json({ ok: false, msg: 'Código de invitación inválido' });
      }
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.query(
      'INSERT INTO usuarios (nombre, apellido, email, password_hash, dni, id_rol) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, apellido, email, password_hash, dni || null, id_rol || 1]
    );

    const newUserId = result.insertId;
    return res.status(201).json({ ok: true, msg: 'Usuario creado', userId: newUserId });
  } catch (err) {
    console.error('auth.register error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

function whoami(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, msg: 'No autenticado' });
  return res.json({ ok: true, usuario: { id: req.user.id, id_rol: req.user.id_rol, raw: req.user.rawPayload } });
}

function refreshToken(req, res) {
  try {
    if (!req.user) return res.status(401).json({ ok: false, msg: 'No autenticado' });
    const payload = { id: req.user.id, id_rol: req.user.id_rol };
    const token = signToken(payload);
    sendTokenCookie(res, token);
    return res.json({ ok: true, msg: 'Token renovado' });
  } catch (err) {
    console.error('auth.refreshToken error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

module.exports = {
  login,
  logout,
  register,
  whoami,
  refreshToken
};
