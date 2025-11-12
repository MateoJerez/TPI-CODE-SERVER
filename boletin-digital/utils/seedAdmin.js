const pool = require('../db');
const bcrypt = require('bcrypt');

module.exports = async function seedAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  const [rows] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [ADMIN_EMAIL]);
  if (rows.length) return;
  const [r2] = await pool.query('SELECT id FROM roles WHERE nombre = ?', ['Administrador']);
  const adminRoleId = r2.length ? r2[0].id : 3;
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await pool.query(
    'INSERT INTO usuarios (nombre, apellido, dni, email, password, id_rol) VALUES (?, ?, ?, ?, ?, ?)',
    ['Administrador', 'Unico', '00000000', ADMIN_EMAIL, hashed, adminRoleId]
  );
  console.log('Admin seeded:', ADMIN_EMAIL);
};
