
document.addEventListener('DOMContentLoaded', () => {
  
  const q = s => document.querySelector(s);
  const qs = s => Array.from(document.querySelectorAll(s));
  const showAlert = (msg) => alert(msg);

  
  const usersTbody = q('#usersTable tbody');
  const searchUser = q('#searchUser');
  const filterRole = q('#filterRole');
  const totalUsersEl = q('#total-users');
  const totalStudentsEl = q('#total-students');
  const totalTeachersEl = q('#total-teachers');

  const alumnosListDiv = q('#alumnosList');
  const btnReloadAlumnos = q('#btnReloadAlumnos');
  const cargarNotasForm = q('#cargarNotasForm');

  
  const api = (path, opts = {}) => fetch(path, Object.assign({
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  }, opts));

  
  async function loadUsers() {
    try {
      const res = await api('/api/admin/users');
      if (!res.ok) {
        const txt = await res.text();
        console.warn('loadUsers: no OK', res.status, txt);
        return showAlert('No autorizado o error al cargar usuarios');
      }
      const data = await res.json();
      renderUsers(data.users || []);
      updateOverview(data.users || []);
    } catch (err) {
      console.error('loadUsers error', err);
      showAlert('Error al cargar usuarios');
    }
  }

  function renderUsers(users) {
    usersTbody.innerHTML = '';
    const term = (searchUser.value || '').trim().toLowerCase();
    const roleFilter = filterRole.value;

    const filtered = users.filter(u => {
      if (roleFilter && String(u.id_rol) !== roleFilter) return false;
      if (!term) return true;
      return [u.nombre, u.apellido, u.email, u.dni, String(u.id)].some(v => (v||'').toLowerCase().includes(term));
    });

    if (filtered.length === 0) {
      usersTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:12px;">No hay usuarios</td></tr>';
      return;
    }

    filtered.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = [
        `<td>${u.id}</td>`,
        `<td>${escapeHtml(u.nombre)}</td>`,
        `<td>${escapeHtml(u.apellido||'')}</td>`,
        `<td>${escapeHtml(u.email)}</td>`,
        `<td>${escapeHtml(u.dni||'')}</td>`,
        `<td>${roleLabel(u.id_rol)}</td>`,
        `<td>
          <button class="btn btn-small" data-act="edit" data-id="${u.id}">Editar</button>
          <button class="btn btn-small" data-act="role" data-id="${u.id}">Cambiar rol</button>
          <button class="btn btn-small danger" data-act="del" data-id="${u.id}">Eliminar</button>
        </td>`
      ].join('');
      usersTbody.appendChild(tr);
    });
  }

  
  function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function roleLabel(r){ return r === 1 ? 'Estudiante' : r === 2 ? 'Docente' : r === 3 ? 'Administrador' : 'Desconocido'; }

  
  usersTbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const act = btn.getAttribute('data-act');

    if (act === 'del') {
      if (!confirm('Eliminar usuario permanentemente?')) return;
      try {
        const res = await api(`/api/admin/users/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const t = await res.text(); console.warn('del error', t);
          return showAlert('No se pudo eliminar usuario');
        }
        showAlert('Usuario eliminado');
        loadUsers();
      } catch (err) { console.error(err); showAlert('Error al eliminar'); }
    }

    if (act === 'role') {
      const newRole = prompt('Nuevo rol: 1=Estudiante, 2=Docente, 3=Administrador');
      if (!newRole || ![ '1','2','3' ].includes(newRole)) return showAlert('Rol inválido');
      try {
        const res = await api(`/api/admin/users/${id}/role`, {
          method: 'PUT',
          body: JSON.stringify({ id_rol: Number(newRole) })
        });
        if (!res.ok) {
          const t = await res.text(); console.warn('role change error', t);
          return showAlert('No se pudo cambiar rol');
        }
        showAlert('Rol actualizado');
        loadUsers();
      } catch (err) { console.error(err); showAlert('Error al cambiar rol'); }
    }

    if (act === 'edit') {
      
      const row = btn.closest('tr');
      const nombre = row.children[1].textContent;
      const apellido = row.children[2].textContent;
      const email = row.children[3].textContent;
      const dni = row.children[4].textContent;

      const newNombre = prompt('Nombre', nombre) || nombre;
      const newApellido = prompt('Apellido', apellido) || apellido;
      const newEmail = prompt('Email', email) || email;
      const newDni = prompt('DNI', dni) || dni;

      try {
        const res = await api(`/api/admin/users/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ nombre: newNombre, apellido: newApellido, email: newEmail, dni: newDni })
        });
        if (!res.ok) {
          const t = await res.text(); console.warn('edit error', t);
          return showAlert('No se pudo actualizar usuario');
        }
        showAlert('Usuario actualizado');
        loadUsers();
      } catch (err) { console.error(err); showAlert('Error al actualizar'); }
    }
  });

  
  async function loadAlumnos() {
    try {
      const res = await api('/api/alumnado/alumnos');
      if (!res.ok) {
        const txt = await res.text();
        console.warn('loadAlumnos no OK', res.status, txt);
        return alumnosListDiv.innerHTML = '<p>No autorizado o error al cargar alumnos</p>';
      }
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.alumnos)) return alumnosListDiv.innerHTML = '<p>Sin datos</p>';
      const table = document.createElement('table');
      table.className = 'table';
      table.innerHTML = '<thead><tr><th>ID</th><th>Nombre</th><th>Apellido</th><th>Email</th><th>DNI</th></tr></thead>';
      const tbody = document.createElement('tbody');
      data.alumnos.forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${a.id}</td><td>${escapeHtml(a.nombre)}</td><td>${escapeHtml(a.apellido||'')}</td><td>${escapeHtml(a.email)}</td><td>${escapeHtml(a.dni||'')}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      alumnosListDiv.innerHTML = '';
      alumnosListDiv.appendChild(table);
    } catch (err) {
      console.error('loadAlumnos error', err);
      alumnosListDiv.innerHTML = '<p>Error al cargar alumnos</p>';
    }
  }

  
  if (cargarNotasForm) {
    cargarNotasForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id_usuario = Number(q('#alumnoId').value);
      const id_materia = Number(q('#materiaId').value);
      const cuatrimestre = Number(q('#cuatrimestre').value);
      const parcial = Number(q('#parcial').value);
      const nota = parseFloat(q('#nota').value || null);

      if (!id_usuario || !id_materia || !cuatrimestre || !parcial) return showAlert('Completá todos los campos obligatorios');

      try {
        const res = await api('/api/alumnado/notas', {
          method: 'POST',
          body: JSON.stringify({ id_usuario, id_materia, cuatrimestre, parcial, nota })
        });
        if (!res.ok) {
          const t = await res.text(); console.warn('cargar nota error', t);
          return showAlert('Error al cargar nota');
        }
        showAlert('Nota cargada correctamente');
        cargarNotasForm.reset();
      } catch (err) { console.error('cargar nota error', err); showAlert('Error de conexión'); }
    });
  }

  
  function updateOverview(users = []) {
    totalUsersEl.textContent = users.length;
    totalStudentsEl.textContent = users.filter(u => u.id_rol === 1).length;
    totalTeachersEl.textContent = users.filter(u => u.id_rol === 2).length;
  }

  
  searchUser.addEventListener('input', () => renderUsersCached());
  filterRole.addEventListener('change', () => renderUsersCached());

  let cachedUsers = [];
  async function renderUsersCached() {
    
    if (!cachedUsers.length) {
      try {
        const res = await api('/api/admin/users');
        if (!res.ok) { cachedUsers = []; return renderUsers([]); }
        const data = await res.json();
        cachedUsers = data.users || [];
      } catch (err) { cachedUsers = []; console.error(err); }
    }
    renderUsers(cachedUsers);
  }

  
  loadUsers();
  loadAlumnos();

  
  if (btnReloadAlumnos) btnReloadAlumnos.addEventListener('click', loadAlumnos);
});
