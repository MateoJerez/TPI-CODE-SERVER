const pool = require('../db');

async function getBoletin(req, res) {
  const id_usuario = req.user?.id;
  if (!id_usuario) return res.status(401).json({ ok: false, msg: 'No autenticado' });

  try {
    const [materias] = await pool.query('SELECT id, nombre FROM materias');
    const [notas] = await pool.query(
      `SELECT id, usuario_id, materia_id, nota1, nota2, nota_final, cuatrimestre
       FROM notas
       WHERE usuario_id = ?`, [id_usuario]
    );

    const boletin = materias.map(m => {
      const cuatr1 = notas.find(n => Number(n.materia_id) === Number(m.id) && Number(n.cuatrimestre) === 1) || {};
      const cuatr2 = notas.find(n => Number(n.materia_id) === Number(m.id) && Number(n.cuatrimestre) === 2) || {};
      return {
        materia_id: m.id,
        materia: m.nombre,
        nota1_c1: cuatr1.nota1 ?? '',
        nota2_c1: cuatr1.nota2 ?? '',
        final_c1: cuatr1.nota_final ?? '',
        nota_row_id_c1: cuatr1.id ?? null,
        nota1_c2: cuatr2.nota1 ?? '',
        nota2_c2: cuatr2.nota2 ?? '',
        final_c2: cuatr2.nota_final ?? '',
        nota_row_id_c2: cuatr2.id ?? null
      };
    });

    const [user] = await pool.query('SELECT nombre, apellido FROM usuarios WHERE id = ?', [id_usuario]);
    const nombre = user?.[0]?.nombre || '';
    const apellido = user?.[0]?.apellido || '';

    return res.json({ ok: true, nombre, apellido, boletin });
  } catch (err) {
    console.error('getBoletin error:', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

module.exports = { getBoletin };
