const pool = require('../db');

async function listarAlumnos(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, apellido, email, dni
       FROM usuarios
       WHERE id_rol = 1`
    );
    return res.json({ ok: true, alumnos: rows });
  } catch (err) {
    console.error('listarAlumnos error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

module.exports = { listarAlumnos };
