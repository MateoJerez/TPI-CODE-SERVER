const pool = require('../db');

async function getUsers(req, res) {
  try {
    const [rows] = await pool.query('SELECT id, nombre, apellido, email, dni, id_rol FROM usuarios ORDER BY id DESC');
    return res.json({ ok: true, users: rows });
  } catch (err) {
    console.error('admin.getUsers error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

async function deleteUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, msg: 'ID inválido' });

    if (req.user && Number(req.user.id) === id) {
      return res.status(400).json({ ok: false, msg: 'No podés eliminarte a vos mismo' });
    }

    await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
    return res.json({ ok: true, msg: 'Usuario eliminado' });
  } catch (err) {
    console.error('admin.deleteUser error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

async function updateUser(req, res) {
  try {
    const id = Number(req.params.id);
    const { nombre, apellido, email, dni } = req.body || {};
    if (!id || !nombre || !apellido || !email) return res.status(400).json({ ok: false, msg: 'Faltan datos' });

    await pool.query('UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, dni = ? WHERE id = ?', [nombre, apellido, email, dni || null, id]);
    return res.json({ ok: true, msg: 'Usuario actualizado' });
  } catch (err) {
    console.error('admin.updateUser error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

async function changeUserRole(req, res) {
  try {
    const id = Number(req.params.id);
    const { id_rol } = req.body || {};
    const newRole = Number(id_rol);
    if (!id || ![1,2,3].includes(newRole)) return res.status(400).json({ ok: false, msg: 'Datos inválidos' });

    if (newRole === 3) {
      const [admins] = await pool.query('SELECT id FROM usuarios WHERE id_rol = 3 AND id != ? LIMIT 1', [id]);
      if (admins && admins.length > 0) return res.status(400).json({ ok: false, msg: 'Ya existe otro administrador' });
    }

    await pool.query('UPDATE usuarios SET id_rol = ? WHERE id = ?', [newRole, id]);
    return res.json({ ok: true, msg: 'Rol actualizado' });
  } catch (err) {
    console.error('admin.changeUserRole error', err);
    return res.status(500).json({ ok: false, msg: 'Error interno' });
  }
}

module.exports = { getUsers, deleteUser, updateUser, changeUserRole };
