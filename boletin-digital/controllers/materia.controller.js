const pool = require('../db');

async function listarMaterias(req, res) {
  try {
    const [rows] = await pool.query('SELECT id, nombre FROM materias ORDER BY nombre');
    return res.json({ ok: true, materias: rows });
  } catch (err) {
    console.error('listarMaterias error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

module.exports = { listarMaterias };
