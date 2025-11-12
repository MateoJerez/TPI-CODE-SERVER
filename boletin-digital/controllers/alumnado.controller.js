const pool = require('../db');

async function listarAlumnos(req, res) {
  try {
    const [rows] = await pool.query('SELECT id, nombre, apellido, email, dni, id_rol FROM usuarios WHERE id_rol = 1 ORDER BY id DESC');
    return res.json({ ok: true, alumnos: rows });
  } catch (err) {
    console.error('alumnado.listarAlumnos error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

async function getAlumno(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, msg: 'ID inválido' });
    const [rows] = await pool.query('SELECT id, nombre, apellido, email, dni, id_rol FROM usuarios WHERE id = ? AND id_rol = 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ ok: false, msg: 'Alumno no encontrado' });
    return res.json({ ok: true, alumno: rows[0] });
  } catch (err) {
    console.error('alumnado.getAlumno error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

async function crearNota(req, res) {
  try {
    const { usuario_id, materia_id, cuatrimestre, nota1, nota2, nota_final } = req.body || {};

    if (!usuario_id || !materia_id || !cuatrimestre) {
      return res.status(400).json({ ok: false, msg: 'Faltan datos obligatorios' });
    }

    const sql = `
      INSERT INTO notas (usuario_id, materia_id, cuatrimestre, nota1, nota2, nota_final)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await pool.query(sql, [
      usuario_id,
      materia_id,
      cuatrimestre,
      nota1 || null,
      nota2 || null,
      nota_final || null
    ]);

    return res.status(201).json({ ok: true, msg: 'Nota registrada correctamente' });
  } catch (err) {
    console.error('alumnado.crearNota error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

module.exports = {
  listarAlumnos,
  getAlumno,
  crearNota
};
