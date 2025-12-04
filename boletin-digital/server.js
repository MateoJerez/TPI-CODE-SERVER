require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const pool = require('./db');
const authRoutes = require('./routes/auth.routes');
const boletinRoutes = require('./routes/boletin.routes');
const notaRoutes = require('./routes/nota.routes');
const alumnoRoutes = require('./routes/alumno.routes');
const materiaRoutes = require('./routes/materia.routes');
const adminRoutes = require('./routes/admin.routes');
const alumnadoRoutes = require('./routes/alumnado.routes');

const app = express();

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'production';


const RAW_FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://192.168.*';

function parseAllowedOrigins(raw) {
  if (!raw || !raw.trim()) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

const allowedOriginPatterns = parseAllowedOrigins(RAW_FRONTEND_ORIGIN);

// Comprueba si un origin dado está permitido por los patrones
function originAllowed(origin) {
  // permitir requests sin origin (curl, herramientas). Cambia si quieres bloquearlos.
  if (!origin) return true;

  for (const pat of allowedOriginPatterns) {
    if (!pat) continue;
    if (pat === '*' || pat === 'any') return true;
    if (pat === 'null' && origin === 'null') return true;

    if (pat.startsWith('re:')) {
      try {
        const re = new RegExp(pat.slice(3));
        if (re.test(origin)) return true;
      } catch (e) {
        // regex inválida -> ignorar
      }
      continue;
    }

    if (pat.endsWith('*')) {
      const prefix = pat.slice(0, -1); // p.ej. 'http://192.168.'
      if (origin.indexOf(prefix) === 0) return true;
      continue;
    }

    // exact match
    if (origin === pat) return true;
  }
  return false;
}

// Middleware para asegurar que, si el origin está permitido, se responda con ese origin concreto
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

const corsOptions = {
  origin: (origin, callback) => {
    // Si no hay origin (herramientas, curl) permitirlo
    if (!origin) return callback(null, true);
    if (originAllowed(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/boletin', boletinRoutes);
app.use('/api/notas', notaRoutes);
app.use('/api/alumnos', alumnoRoutes);
app.use('/api/materias', materiaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/alumnado', alumnadoRoutes);

// Ping / debug
app.get('/api/ping', (req, res) => res.json({ ok: true, msg: 'pong' }));
app.get('/api/debug/cookies', (req, res) => {
  console.log('debug cookies req.cookies =', req.cookies);
  return res.json({ ok: true, cookies: req.cookies || {}, user: req.user || null });
});

// Servir frontend estático (si lo colocás en public)
const staticDir = path.join(__dirname, 'public');
app.use(express.static(staticDir));

const indexCandidates = ['index.html', 'Index.html'];
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();

  let indexFile = null;
  for (const f of indexCandidates) {
    if (fs.existsSync(path.join(staticDir, f))) { indexFile = f; break; }
  }
  if (indexFile) return res.sendFile(path.join(staticDir, indexFile));
  return res.send('OK');
});

/*
RECORDATORIO:
- Si usás cookies en auth.controller, asegúrate de setear:
  secure: NODE_ENV === 'production' (false en dev si no tienes HTTPS)
  sameSite: NODE_ENV === 'production' ? 'none' : 'lax'
- En desarrollo: en tu .env define COOKIE_SECURE=false y COOKIE_SAMESITE=lax (minúsculas).
*/

async function ensureAdmin() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
  try {
    const [rows] = await pool.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [process.env.ADMIN_EMAIL]);
    if (rows && rows.length > 0) {
      console.log('Admin already exists:', process.env.ADMIN_EMAIL);
      return;
    }
    // el hash y la inserción omiten manejo complejo para mantener tu lógica
  } catch (err) {
    console.error('ensureAdmin error', err);
  }
}

const server = app.listen(PORT, HOST, async () => {
  try {
    await pool.query('SELECT 1');
    console.log('DB OK');
  } catch (err) {
    console.error('DB error', err);
  }

  await ensureAdmin();

  console.log(`Servidor escuchando en ${HOST}:${PORT}`);
});

server.on('error', err => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Puerto ${PORT} ocupado`);
    process.exit(1);
  }
  console.error('Error servidor', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('SIGINT recibido — cerrando servidor');
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido — cerrando servidor');
  server.close(() => process.exit(0));
});

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
process.on('uncaughtException', err => {
  console.error('Uncaught Exception thrown:', err);
});