const pool = require('../db');

async function listarNotas(req, res) {
  const userId = req.user?.id;
  const rol = req.user?.id_rol;
  try {
    if (rol === 1) {
      const [rows] = await pool.query(
        `SELECT n.id, n.materia_id, m.nombre AS materia, n.nota1, n.nota2, n.nota_final, n.cuatrimestre
         FROM notas n JOIN materias m ON m.id = n.materia_id
         WHERE n.usuario_id = ?`, [userId]
      );
      return res.json({ ok: true, notas: rows });
    }

    const [rows] = await pool.query(
      `SELECT n.id, n.usuario_id, u.nombre, u.apellido, n.materia_id, m.nombre AS materia, n.nota1, n.nota2, n.nota_final, n.cuatrimestre
       FROM notas n
       JOIN usuarios u ON u.id = n.usuario_id
       JOIN materias m ON m.id = n.materia_id
       ORDER BY u.apellido, m.nombre`
    );
    return res.json({ ok: true, notas: rows });
  } catch (err) {
    console.error('listarNotas error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

async function actualizarNota(req, res) {
  const rol = req.user?.id_rol;
  if (![2,3].includes(rol)) return res.status(403).json({ ok: false, msg: 'No autorizado' });

  const { id, nota1, nota2, nota_final } = req.body;
  if (!id) return res.status(400).json({ ok: false, msg: 'Falta id de nota' });

  try {
    await pool.query(
      'UPDATE notas SET nota1 = ?, nota2 = ?, nota_final = ? WHERE id = ?',
      [nota1 ?? null, nota2 ?? null, nota_final ?? null, id]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('actualizarNota error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

async function cargarNota(req, res) {
  try {
    const rol = req.user?.id_rol;
    if (![2,3].includes(rol)) return res.status(403).json({ ok: false, msg: 'No autorizado' });

    const { alumno_id, materia_id, cuatrimestre, parcial, nota } = req.body;
    if (!alumno_id || !materia_id || !cuatrimestre || !parcial) {
      return res.status(400).json({ ok: false, msg: 'Datos incompletos' });
    }

    const campo = Number(parcial) === 1 ? 'nota1' : Number(parcial) === 2 ? 'nota2' : null;
    if (!campo) return res.status(400).json({ ok: false, msg: 'Parcial inválido' });

    const [existing] = await pool.query(
      'SELECT id FROM notas WHERE usuario_id = ? AND materia_id = ? AND cuatrimestre = ? LIMIT 1',
      [alumno_id, materia_id, cuatrimestre]
    );

    if (existing && existing.length > 0) {
      const notaId = existing[0].id;
      await pool.query(`UPDATE notas SET ${campo} = ? WHERE id = ?`, [nota ?? null, notaId]);
      return res.json({ ok: true, action: 'updated', id: notaId });
    }

    const nota1 = campo === 'nota1' ? (nota ?? null) : null;
    const nota2 = campo === 'nota2' ? (nota ?? null) : null;
    const [result] = await pool.query(
      'INSERT INTO notas (usuario_id, materia_id, nota1, nota2, nota_final, cuatrimestre) VALUES (?, ?, ?, ?, ?, ?)',
      [alumno_id, materia_id, nota1, nota2, null, cuatrimestre]
    );

    return res.json({ ok: true, action: 'inserted', insertId: result.insertId });
  } catch (err) {
    console.error('cargarNota error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

module.exports = { listarNotas, actualizarNota, cargarNota };
