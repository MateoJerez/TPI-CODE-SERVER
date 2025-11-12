require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const boletinRoutes = require('./routes/boletin.routes');
const notaRoutes = require('./routes/nota.routes');
const alumnoRoutes = require('./routes/alumno.routes');
const materiaRoutes = require('./routes/materia.routes'); // añadido
const adminRoutes = require('./routes/admin.routes');
const alumnadoRoutes = require('./routes/alumnado.routes');
const pool = require('./db');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:4000';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Allow common dev origins and the configured FRONTEND_ORIGIN
const allowedOrigins = [FRONTEND_ORIGIN, `http://localhost:${PORT}`, 'http://localhost:3000', 'http://localhost:4000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.options('*', cors());

app.use('/api/auth', authRoutes);
app.use('/api/boletin', boletinRoutes);
app.use('/api/notas', notaRoutes);
app.use('/api/alumnos', alumnoRoutes);
app.use('/api/materias', materiaRoutes); // añadido

// Mount admin and alumnado routes under multiple prefixes for frontend compatibility
app.use('/api', adminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/alumnos', alumnadoRoutes);
app.use('/api/alumnado', alumnadoRoutes);

app.get('/api/ping', (req, res) => res.json({ ok: true, msg: 'pong' }));

app.get('/api/debug/cookies', (req, res) => {
  console.log('debug cookies req.cookies =', req.cookies);
  return res.json({ ok: true, cookies: req.cookies || {}, user: req.user || null });
});

const staticDir = path.join(__dirname, 'public');
app.use(express.static(staticDir));
// serve index file, accept Index.html or index.html
const indexCandidates = ['index.html', 'Index.html'];
let indexFile = 'index.html';
for (const f of indexCandidates) {
  if (fs.existsSync(path.join(staticDir, f))) { indexFile = f; break; }
}
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(staticDir, indexFile), err => {
    if (err) next(err);
  });
});

async function ensureAdmin() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
  try {
    const [rows] = await pool.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [process.env.ADMIN_EMAIL]);
    if (rows && rows.length > 0) return;
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, Number(process.env.SALT_ROUNDS) || 10);
    await pool.query(
      'INSERT INTO usuarios (nombre, apellido, email, password_hash, id_rol) VALUES (?, ?, ?, ?, ?)',
      ['Admin', 'User', process.env.ADMIN_EMAIL, hashed, 3]
    );
    console.log('Admin creado:', process.env.ADMIN_EMAIL);
  } catch (err) {
    console.error('ensureAdmin error', err);
  }
}

const server = app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    console.log('DB OK');
  } catch (err) {
    console.error('DB error', err);
  }
  await ensureAdmin();
  console.log(`Servidor escuchando en ${PORT}`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Puerto ${PORT} ocupado`);
    process.exit(1);
  }
  console.error('Error servidor', err);
  process.exit(1);
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
