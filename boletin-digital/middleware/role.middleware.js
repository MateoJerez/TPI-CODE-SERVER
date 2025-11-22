function allowRoles(...rolesAllowed) {
  return (req, res, next) => {
    const rol = Number(req.usuario && req.usuario.id_rol);
    if (!rolesAllowed.includes(rol)) return res.status(403).json({ ok: false, msg: 'Acceso restringido' });
    next();
  };
}

module.exports = { allowRoles };
