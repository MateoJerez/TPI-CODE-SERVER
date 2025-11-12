// script.js — Versión fusionada y estable (tu script original + logout/admin fixes)
// Usa API_BASE = 'http://localhost:3000' por defecto; cambialo arriba si tu backend corre en otro puerto.
(() => {
  let API_BASE = 'http://localhost:3000';
  const apiUrl = path => `${API_BASE}${path}`;

  // Detecta un API disponible de una lista de candidatos y actualiza API_BASE
  async function detectApiBase(candidates = [
    'http://localhost:3000',
    'http://localhost:4000',
    'http://localhost:17201',
    'http://localhost:3001'
  ]) {
    for (const base of candidates) {
      try {
        // Intentamos una petición GET simple a /api/auth/me (no causará efectos secundarios)
        const res = await fetch(`${base}/api/auth/me`, { method: 'GET', credentials: 'include' });
        if (res && (res.ok || res.status === 204 || res.status === 200)) {
          API_BASE = base;
          console.info('API base detectada:', base);
          return base;
        }
      } catch (e) {
        // Ignorar errores de red y pasar al siguiente candidato
      }
    }
    console.warn('No se detectó un API disponible, se usará el valor por defecto:', API_BASE);
    return API_BASE;
  }

  // ---------- utilidades ----------
  async function safeJson(res) {
    if (!res || !res.headers) return null;
    const ct = res.headers.get?.('content-type') || '';
    if (!ct.includes('application/json')) return res.text().catch(() => null);
    return res.json().catch(() => null);
  }

  async function fetchWithCred(url, opts = {}) {
    opts = { credentials: 'include', headers: { ...(opts.headers || {}) }, ...opts };
    return fetch(url, opts);
  }

  // ---------- session keepalive ----------
  let _sessionKeepaliveTimer = null;
  function startSessionKeepalive(intervalMs = 5 * 60 * 1000) {
    stopSessionKeepalive();
    async function tick() {
      try {
        const res = await fetchWithCred(apiUrl('/api/auth/refresh'), { method: 'POST' });
        if (res.status === 404) { stopSessionKeepalive(); return; }
        if (res.status === 401 || res.status === 403) { stopSessionKeepalive(); await verificarSesion(); return; }
      } catch (err) { console.warn('session keepalive error', err); }
    }
    tick();
    _sessionKeepaliveTimer = setInterval(tick, intervalMs);
  }
  function stopSessionKeepalive() { if (_sessionKeepaliveTimer) { clearInterval(_sessionKeepaliveTimer); _sessionKeepaliveTimer = null; } }

  // ---------- logout: asegurar botón y handler robusto ----------
  function ensureLogoutButtonInNav() {
    let bt = document.querySelector('#logoutBtn');
    if (bt) return bt;
    const nav = document.querySelector('nav') || document.querySelector('.nav-inner') || document.querySelector('header');
    bt = document.createElement('button');
    bt.id = 'logoutBtn';
    bt.type = 'button';
    bt.className = 'btn';
    bt.textContent = 'Cerrar sesión';
    bt.style.marginLeft = '8px';
    bt.style.display = 'none';
    if (nav) nav.appendChild(bt); else document.body.appendChild(bt);
    return bt;
  }

  function attachLogoutHandlerRobust(selector = '#logoutBtn') {
    const btn = document.querySelector(selector) || ensureLogoutButtonInNav();
    if (!btn) return;
    const newBtn = btn.cloneNode(true);
    btn.replaceWith(newBtn);
    newBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      try {
        newBtn.disabled = true;
        newBtn.textContent = 'Cerrando sesión...';
        const res = await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok && res.status !== 200 && res.status !== 204) {
          let body = null;
          try { body = await safeJson(res); } catch (e) { body = await res.text().catch(()=>null); }
          console.warn('Logout falló', res.status, body);
          alert('No se pudo cerrar sesión (ver consola)');
        }
      } catch (err) {
        console.error('Logout request error', err);
        alert('Error de conexión al cerrar sesión');
      } finally {
        stopSessionKeepalive();
        try { await verificarSesion(); } catch (e) { /* ignore */ }
        const finalBtn = document.querySelector(selector);
        if (finalBtn) { finalBtn.disabled = false; finalBtn.textContent = 'Cerrar sesión'; }
        window.location.href = '/login.html';
      }
    });
  }

  async function updateLogoutButtonVisibility() {
    const btn = ensureLogoutButtonInNav();
    try {
      const usuario = await verificarSesion().catch(()=>null);
      if (usuario) btn.style.display = 'inline-block';
      else btn.style.display = 'none';
    } catch (e) {
      btn.style.display = 'none';
    }
  }

  // ---------- DOM ready (principal) ----------
  document.addEventListener('DOMContentLoaded', async () => {
    // Esperar a detectar un backend antes de ejecutar llamadas iniciales
    await detectApiBase().catch(()=>{});

    // Selectores generales (mantengo nombres de tu script antiguo)
    const inputAlumnoId = document.getElementById('alumnoId');
    const selMateria = document.getElementById('materiaId');
    const selCuatrimestre = document.getElementById('cuatrimestre');
    const selParcial = document.getElementById('parcial');
    const inputNota = document.getElementById('nota');
    const btnListarAlumnos = document.getElementById('btnListarAlumnos');
    const contAlumnos = document.getElementById('alumnosList');
    const formCargar = document.getElementById('cargarNotasForm');

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    const linkAlumnado = Array.from(document.querySelectorAll('nav a')).find(a => /Departamento de Alumnado/i.test(a.textContent));
    const linkLogin = document.getElementById('link-login') || Array.from(document.querySelectorAll('nav a')).find(a => /Iniciar Sesi[oó]n/i.test(a.textContent) || /Login/i.test(a.textContent));

    const adminUsersContainer = document.getElementById('adminUsersList');

    // ---------- permisos helper ----------
    async function permisosDeUsuario() {
      try {
        const r = await fetchWithCred(apiUrl('/api/auth/me'), { method: 'GET' });
        if (!r || r.status === 401 || r.status === 403) return null;
        const d = await safeJson(r);
        return d?.usuario ?? null;
      } catch (e) { return null; }
    }

    // ---------- materias ----------
    async function cargarMateriasDesdeAPI() {
      if (!selMateria) return;
      try {
        const res = await fetchWithCred(apiUrl('/api/materias'), { method: 'GET' });
        if (!res.ok) return;
        const data = await safeJson(res);
        const arr = Array.isArray(data) ? data : (data?.materias || []);
        if (!arr.length) return;
        selMateria.innerHTML = '<option value="">Seleccione materia</option>';
        arr.forEach(m => {
          const o = document.createElement('option');
          o.value = m.id ?? m.id_materia ?? '';
          o.textContent = m.nombre ?? m.materia ?? `ID ${m.id ?? m.id_materia}`;
          selMateria.appendChild(o);
        });
      } catch (e) { console.warn('cargarMateriasDesdeAPI', e); }
    }

    // ---------- listar alumnos ----------
    async function listarAlumnos() {
      if (!contAlumnos) { console.warn('contenedor #alumnosList no encontrado'); return; }
      contAlumnos.innerHTML = 'Cargando alumnos...';
      try {
        const res = await fetchWithCred(apiUrl('/api/alumnos'), { method: 'GET' });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) contAlumnos.innerHTML = 'No autorizado de error al cargar alumnos';
          else contAlumnos.innerHTML = 'Error al cargar alumnos';
          console.warn('listarAlumnos status', res.status);
          return;
        }
        const data = await safeJson(res);
        const alumnos = Array.isArray(data) ? data : (data?.alumnos || []);
        if (!alumnos.length) { contAlumnos.innerHTML = '<div>No hay alumnos</div>'; return; }

        const table = document.createElement('table');
        table.className = 'small-table';
        const tbody = document.createElement('tbody');

        alumnos.forEach(a => {
          const id = a.id ?? a.id_alumno ?? a.alumno_id ?? '';
          const nombre = ((a.nombre ?? a.firstName ?? '') + ' ' + (a.apellido ?? a.lastName ?? '')).trim() || id;

          const tr = document.createElement('tr');

          const tdNombre = document.createElement('td');
          tdNombre.style.padding = '6px 8px';
          tdNombre.style.cursor = 'pointer';
          tdNombre.textContent = nombre;
          tdNombre.dataset.id = id;
          tdNombre.addEventListener('click', () => {
            if (inputAlumnoId) inputAlumnoId.value = id;
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
            tr.classList.add('selected');
          });

          const tdInfo = document.createElement('td');
          tdInfo.style.padding = '6px 8px';
          tdInfo.textContent = a.dni ? a.dni : (a.email || '');

          const tdActions = document.createElement('td');
          tdActions.style.padding = '6px 8px';
          const btnVer = document.createElement('button');
          btnVer.type = 'button';
          btnVer.className = 'btn small';
          btnVer.textContent = 'Ver boletín';
          btnVer.addEventListener('click', (ev) => {
            ev.stopPropagation();
            window.location.href = `/boletin.html?alumno_id=${encodeURIComponent(id)}`;
          });
          tdActions.appendChild(btnVer);

          tr.appendChild(tdNombre);
          tr.appendChild(tdInfo);
          tr.appendChild(tdActions);
          tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        contAlumnos.innerHTML = '';
        contAlumnos.appendChild(table);
      } catch (err) {
        console.error('listarAlumnos error', err);
        contAlumnos.innerHTML = 'Error al cargar alumnos (ver consola)';
      }
    }

    // ---------- cargar nota ----------
    async function cargarNotaHandler(ev) {
      ev?.preventDefault?.();
      const alumno_id = inputAlumnoId?.value;
      const materia_id = selMateria?.value;
      const cuatrimestre = selCuatrimestre?.value;
      const parcial = selParcial?.value;
      const nota = inputNota?.value;

      if (!alumno_id || !materia_id || !cuatrimestre || !parcial) return alert('Seleccioná/ingresá alumno, materia, cuatrimestre y parcial');

      const body = {
        alumno_id: Number(alumno_id),
        materia_id: Number(materia_id),
        cuatrimestre: Number(cuatrimestre),
        parcial: Number(parcial),
        nota: nota === '' ? null : Number(nota)
      };

      try {
        const res = await fetchWithCred(apiUrl('/api/notas/cargar'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await safeJson(res);
        if (!res.ok) { console.warn('cargarNota status', res.status, data); return alert('Error al cargar nota (revisá consola)'); }
        if (!data || !data.ok) return alert(data?.msg || 'Error al cargar nota');
        alert(`Nota ${data.action === 'inserted' ? 'cargada' : 'actualizada'} correctamente`);
      } catch (err) {
        console.error('cargarNota error', err);
        alert('Error al cargar nota (ver consola)');
      }
    }

    // ---------- edición inline ----------
    function attachInlineEdit() {
      const cells = Array.from(document.querySelectorAll('td[data-nota-id]'));
      cells.forEach(td => {
        if (td._attached) return;
        td._attached = true;
        td.style.cursor = 'pointer';
        td.addEventListener('click', async () => {
          if (td.querySelector('input')) return;
          const prev = td.textContent.trim();
          const id = td.getAttribute('data-nota-id');
          const input = document.createElement('input');
          input.type = 'number'; input.step = '0.5'; input.min = 0; input.max = 10;
          input.value = prev || '';
          td.innerHTML = ''; td.appendChild(input); input.focus();

          const finish = async (save) => {
            const val = input.value === '' ? null : Number(input.value);
            td.textContent = val === null ? '' : String(val);
            if (!save) return;
            try {
              const res = await fetchWithCred(apiUrl('/api/notas'), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: Number(id), nota: val })
              });
              const d = await safeJson(res);
              if (!res.ok || !d || !(d.ok || d.success)) { console.warn('update nota', res.status, d); td.textContent = prev; }
            } catch (e) { console.error('edit nota', e); td.textContent = prev; }
          };

          input.addEventListener('blur', () => finish(true));
          input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { td.textContent = prev; } });
        });
      });
    }

    // ---------- renderBoletin ----------
    async function renderBoletin(alumnoId, opts = {}) {
      const API = typeof apiUrl === 'function' ? apiUrl : (p => `http://localhost:3000${p}`);
      const headerSel = opts.targetSelectorHeader || 'main h2';
      const tableBodySel = opts.targetSelectorTable || 'main table tbody';
      const headerEl = document.querySelector(headerSel);
      const tbody = document.querySelector(tableBodySel);

      if (headerEl) headerEl.textContent = 'Cargando boletín...';
      if (tbody) tbody.innerHTML = '<tr><td colspan="7">Cargando notas...</td></tr>';

      let sessionUsuario = null;
      try {
        const meRes = await fetchWithCred(API('/api/auth/me'), { method: 'GET' });
        if (meRes.ok) {
          const meData = await safeJson(meRes);
          if (meData && (meData.ok || meData.success) && meData.usuario) sessionUsuario = meData.usuario;
        }
      } catch (e) { /* ignore */ }

      if (!alumnoId && sessionUsuario) alumnoId = sessionUsuario.id ?? sessionUsuario.id_alumno ?? sessionUsuario.alumno_id ?? alumnoId;

      if (!alumnoId) {
        if (headerEl) headerEl.textContent = 'Boletín: alumno no identificado';
        if (tbody) tbody.innerHTML = '<tr><td colspan="7">No hay alumno seleccionado</td></tr>';
        return;
      }

      let data = null;
      try {
        const r = await fetchWithCred(API(`/api/boletin?alumno_id=${encodeURIComponent(alumnoId)}`), { method: 'GET' });
        if (r.ok) data = await safeJson(r);
        else if (r.status === 401 || r.status === 403) {
          if (headerEl) headerEl.textContent = 'Acceso denegado';
          if (tbody) tbody.innerHTML = '<tr><td colspan="7">No tenés permisos para ver este boletín</td></tr>';
          return;
        }
      } catch (e) { /* ignore */ }

      if (!data) {
        try {
          const r2 = await fetchWithCred(API('/api/boletin/consulta'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alumno_id: Number(alumnoId) })
          });
          if (r2.ok) data = await safeJson(r2);
          else if (r2.status === 401 || r2.status === 403) {
            if (headerEl) headerEl.textContent = 'Acceso denegado';
            if (tbody) tbody.innerHTML = '<tr><td colspan="7">No tenés permisos para ver este boletín</td></tr>';
            return;
          }
        } catch (e) { /* ignore */ }
      }

      if (!data) {
        if (headerEl) headerEl.textContent = 'Boletín: error al cargar';
        if (tbody) tbody.innerHTML = '<tr><td colspan="7">No se pudo obtener el boletín</td></tr>';
        return;
      }

      let boletin = []; let nombre = ''; let apellido = '';
      if (Array.isArray(data)) boletin = data;
      else if (data.boletin) {
        boletin = Array.isArray(data.boletin) ? data.boletin : (data.boletin.rows || []);
        nombre = data.nombre || data.nombres || data.usuario?.nombre || '';
        apellido = data.apellido || data.apellidos || data.usuario?.apellido || '';
      } else if (Array.isArray(data.rows)) {
        boletin = data.rows;
        nombre = data.nombre || data.nombres || '';
        apellido = data.apellido || data.apellidos || '';
      } else if (data.ok && Array.isArray(data.data)) boletin = data.data;
      else boletin = data;

      if (sessionUsuario && Number(sessionUsuario.id_rol) === 1) {
        nombre = sessionUsuario.nombre ?? sessionUsuario.nombres ?? nombre;
        apellido = sessionUsuario.apellido ?? sessionUsuario.apellidos ?? apellido;
      } else {
        nombre = nombre || data.usuario?.nombre || data.alumno_nombre || '';
        apellido = apellido || data.usuario?.apellido || data.alumno_apellido || '';
      }

      if (headerEl) {
        const full = `${nombre || ''} ${apellido || ''}`.trim();
        headerEl.textContent = full ? `Boletín de: ${full}` : `Boletín del alumno ID: ${alumnoId}`;
      }

      if (!tbody) return;
      tbody.innerHTML = '';
      if (!Array.isArray(boletin) || boletin.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No hay notas para este alumno</td></tr>';
        return;
      }

      boletin.forEach(row => {
        const materia = row.materia ?? row.nombre ?? row.materia_nombre ?? '';
        const n11 = row.nota1_c1 ?? row.nota1 ?? row['1erParcial'] ?? '';
        const n12 = row.nota2_c1 ?? row.nota2 ?? row['2doParcial'] ?? '';
        const f1  = row.final_c1 ?? row.nota_final ?? row.final ?? '';
        const n21 = row.nota1_c2 ?? row.nota1c2 ?? '';
        const n22 = row.nota2_c2 ?? row.nota2c2 ?? '';
        const f2  = row.final_c2 ?? row.nota_final_2 ?? '';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="materia">${materia}</td><td>${n11}</td><td>${n12}</td><td>${f1}</td><td>${n21}</td><td>${n22}</td><td>${f2}</td>`;
        tbody.appendChild(tr);
      });
    }

    // ---------- ADMIN: listar / editar / eliminar usuarios ----------
    function renderAdminUsersTable(users, container) {
      container.innerHTML = '';
      if (!users || !users.length) {
        container.textContent = 'No hay usuarios';
        return;
      }
      const table = document.createElement('table');
      table.className = 'small-table';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Nombre</th><th>Email</th><th>Rol</th><th>DNI</th><th>Acciones</th></tr>';
      table.appendChild(thead);
      const tbody = document.createElement('tbody');

      users.forEach(u => {
        const id = u.id ?? u.user_id ?? u.id_usuario ?? '';
        const nombre = ((u.nombre ?? u.firstName ?? '') + ' ' + (u.apellido ?? u.lastName ?? '')).trim();
        const email = u.email ?? u.correo ?? '';
        const dni = u.dni ?? u.documento ?? '';
        const rol = u.id_rol ?? u.rol ?? u.role ?? '';

        const tr = document.createElement('tr');

        const tdNombre = document.createElement('td'); tdNombre.textContent = nombre || ('ID ' + id);
        const tdEmail = document.createElement('td'); tdEmail.textContent = email;
        const tdRol = document.createElement('td'); tdRol.textContent = String(rol);
        const tdDni = document.createElement('td'); tdDni.textContent = dni;

        const tdAcc = document.createElement('td');
        const btnEdit = document.createElement('button'); btnEdit.type='button'; btnEdit.className='btn small'; btnEdit.textContent='Editar';
        btnEdit.addEventListener('click', () => openUserEditForm(u, tr, container));
        const btnDel = document.createElement('button'); btnDel.type='button'; btnDel.className='btn small danger'; btnDel.style.marginLeft='6px'; btnDel.textContent='Eliminar';
        btnDel.addEventListener('click', async () => {
          if (!confirm(`Eliminar usuario ${nombre || email}? Esta acción no se puede deshacer.`)) return;
          try {
            const res = await fetchWithCred(apiUrl(`/api/users/${encodeURIComponent(id)}`), { method: 'DELETE' });
            if (res.status === 401 || res.status === 403) return alert('No autorizado para eliminar usuarios');
            if (!res.ok) { const dd = await safeJson(res); console.warn('delete user', res.status, dd); return alert(dd?.msg || 'Error al eliminar usuario'); }
            alert('Usuario eliminado');
            await listAdminUsers(container);
          } catch (err) { console.error('delete user error', err); alert('Error al eliminar usuario (ver consola)'); }
        });

        tdAcc.appendChild(btnEdit); tdAcc.appendChild(btnDel);
        tr.appendChild(tdNombre); tr.appendChild(tdEmail); tr.appendChild(tdRol); tr.appendChild(tdDni); tr.appendChild(tdAcc);
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      container.appendChild(table);
    }

    async function listAdminUsers(container = adminUsersContainer) {
      if (!container) return;
      container.innerHTML = 'Cargando usuarios...';
      try {
        const res = await fetchWithCred(apiUrl('/api/users'), { method: 'GET' });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) container.innerHTML = 'No autorizado de error al cargar usuarios';
          else container.innerHTML = 'Error al cargar usuarios';
          console.warn('listAdminUsers status', res.status);
          return;
        }
        const data = await safeJson(res);
        const users = Array.isArray(data) ? data : (data?.users || data?.usuarios || []);
        renderAdminUsersTable(users, container);
      } catch (err) {
        console.error('listAdminUsers error', err);
        container.innerHTML = 'Error al cargar usuarios (ver consola)';
      }
    }

    function openUserEditForm(user, rowElement, container) {
      const existing = container.querySelector('.user-edit-form');
      if (existing) existing.remove();

      const form = document.createElement('form');
      form.className = 'user-edit-form';
      form.style.border = '1px solid #ddd';
      form.style.padding = '12px';
      form.style.marginTop = '8px';
      form.style.background = '#fff';

      form.innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input name="nombre" placeholder="Nombre" value="${(user.nombre ?? user.firstName ?? '')}" />
          <input name="apellido" placeholder="Apellido" value="${(user.apellido ?? user.lastName ?? '')}" />
          <input name="email" placeholder="Email" value="${(user.email ?? user.correo ?? '')}" />
          <input name="dni" placeholder="DNI" value="${(user.dni ?? user.documento ?? '')}" />
          <select name="id_rol">
            <option value="1" ${Number(user.id_rol)===1?'selected':''}>Estudiante</option>
            <option value="2" ${Number(user.id_rol)===2?'selected':''}>Docente</option>
            <option value="3" ${Number(user.id_rol)===3?'selected':''}>Administrador</option>
          </select>
          <div style="flex-basis:100%;display:flex;gap:8px;margin-top:6px">
            <button type="submit" class="btn">Guardar</button>
            <button type="button" class="btn" id="cancelEdit">Cancelar</button>
          </div>
        </div>
      `;

      rowElement.after(form);
      form.querySelector('#cancelEdit').addEventListener('click', () => form.remove());

      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(form);
        const body = {
          nombre: fd.get('nombre')?.trim() || '',
          apellido: fd.get('apellido')?.trim() || '',
          email: fd.get('email')?.trim() || '',
          dni: fd.get('dni')?.trim() || '',
          id_rol: Number(fd.get('id_rol') || 0)
        };
        if (!body.nombre || !body.apellido || !body.email) return alert('Nombre, apellido y email son obligatorios');
        try {
          const id = user.id ?? user.user_id ?? user.id_usuario ?? '';
          const res = await fetchWithCred(apiUrl(`/api/users/${encodeURIComponent(id)}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          if (res.status === 401 || res.status === 403) return alert('No autorizado para editar usuarios');
          const data = await safeJson(res);
          if (!res.ok) { console.warn('update user', res.status, data); return alert(data?.msg || 'Error al actualizar usuario'); }
          alert('Usuario actualizado correctamente');
          form.remove();
          await listAdminUsers(container);
        } catch (err) {
          console.error('update user error', err); alert('Error al actualizar usuario (ver consola)');
        }
      });
    }

    // ---------- verificar sesión ----------
    async function verificarSesion() {
      try {
        const onAuthPage = !!document.getElementById('loginForm') || !!document.getElementById('registerForm');
        if (linkAlumnado) linkAlumnado.style.display = 'none';
        if (linkLogin) linkLogin.style.display = 'inline-block';

        if (onAuthPage) {
          try {
            const maybe = await fetchWithCred(apiUrl('/api/auth/me'), { method: 'GET' });
            const maybeData = await safeJson(maybe);
            if (maybe && maybe.ok && maybeData && (maybeData.ok || maybeData.success) && maybeData.usuario) {
              const rol = Number(maybeData.usuario.id_rol);
              if (linkLogin) linkLogin.style.display = 'none';
              if (linkAlumnado) linkAlumnado.style.display = (rol === 2 || rol === 3) ? 'inline-block' : 'none';
              updateLogoutButtonVisibility().catch(()=>{});
              return maybeData.usuario;
            }
          } catch (err) { console.warn('verificarSesion (auth page) fallo', err); }
          updateLogoutButtonVisibility().catch(()=>{});
          return null;
        }

        const res = await fetchWithCred(apiUrl('/api/auth/me'), { method: 'GET' });
        const data = await safeJson(res);
        if (data && (data.ok || data.success) && data.usuario) {
          const rol = Number(data.usuario.id_rol);
          if (linkLogin) linkLogin.style.display = 'none';
          if (linkAlumnado) linkAlumnado.style.display = (rol === 2 || rol === 3) ? 'inline-block' : 'none';
          updateLogoutButtonVisibility().catch(()=>{});
          return data.usuario;
        } else {
          if (linkAlumnado) linkAlumnado.style.display = 'none';
          if (linkLogin) linkLogin.style.display = 'inline-block';
          updateLogoutButtonVisibility().catch(()=>{});
          return null;
        }
      } catch (err) {
        console.error('verificarSesion', err);
        if (linkAlumnado) linkAlumnado.style.display = 'none';
        if (linkLogin) linkLogin.style.display = 'inline-block';
        updateLogoutButtonVisibility().catch(()=>{});
        return null;
      }
    }

    // ---------- attach login ----------
    (function attachLoginHandler() {
      if (!loginForm) return;
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailEl = loginForm.querySelector('input[type="email"], input[name="email"]');
        const passEl = loginForm.querySelector('input[type="password"], input[name="password"]');
        const roleEl = loginForm.querySelector('select#login_role, select[name="login_role"], select[name="id_rol"], select#id_rol');

        const email = emailEl ? emailEl.value.trim() : '';
        const password = passEl ? passEl.value : '';
        const id_rol = Number(roleEl ? roleEl.value : 0);
        if (!email || !password || !id_rol) return alert('Completá correo, contraseña y rol');

        try {
          const res = await fetchWithCred(apiUrl('/api/auth/login'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, id_rol })
          });
          const data = await safeJson(res) || {};
          if (!res.ok || !(data.ok || data.success)) return alert(data?.msg || data?.error || 'Error en login');

          const usuario = await verificarSesion();
          const roleToUse = usuario?.id_rol ?? data.usuario?.id_rol ?? id_rol;

          if (Number(roleToUse) === 1) window.location.href = '/boletin.html';
          else if (Number(roleToUse) === 2) window.location.href = '/alumnado.html';
          else window.location.href = '/admin.html';
        } catch (err) {
          console.error('login error:', err);
          alert('Error de conexión');
        }
      });
    })();

    // ---------- attach register ----------
    (function attachRegisterHandler() {
      if (!registerForm) return;
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = registerForm.querySelector('input[name="nombre"]')?.value.trim() || '';
        const apellido = registerForm.querySelector('input[name="apellido"]')?.value.trim() || '';
        const email = registerForm.querySelector('input[name="email"]')?.value.trim() || '';
        const password = registerForm.querySelector('input[name="password"]')?.value || '';
        const dni = registerForm.querySelector('input[name="dni"]')?.value.trim() || '';
        const id_rol = Number(registerForm.querySelector('select[name="id_rol"]')?.value || 0);
        const invite_code = registerForm.querySelector('input[name="invite_code"]')?.value.trim() || undefined;

        if (!nombre || !apellido || !email || !password || !dni || !id_rol) {
          return alert('Completá todos los campos obligatorios');
        }
        if (id_rol === 2 && (!invite_code || invite_code.length === 0)) {
          return alert('El código de invitación es obligatorio para docentes');
        }

        try {
          const res = await fetchWithCred(apiUrl('/api/auth/register'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, apellido, email, password, dni, id_rol, invite_code })
          });
          const data = await safeJson(res) || {};
          if (res.ok && (data?.ok || data?.success)) {
            alert('Registrado correctamente. Iniciá sesión.');
            window.location.href = '/login.html';
          } else {
            console.warn('register response', res.status, data);
            return alert(data?.msg || data?.error || 'Error en registro');
          }
        } catch (err) {
          console.error('register error', err);
          alert('Error de conexión al registrar');
        }
      });
    })();

    // ---------- admin attach if needed ----------
    async function attachAdminIfNeeded() {
      const usuario = await permisosDeUsuario();
      if (!usuario) return;
      if (Number(usuario.id_rol) === 3) {
        if (adminUsersContainer) await listAdminUsers(adminUsersContainer);
      }
    }

    // ---------- attaches y arranque ----------
    if (btnListarAlumnos) btnListarAlumnos.addEventListener('click', listarAlumnos);
    if (formCargar) formCargar.addEventListener('submit', cargarNotaHandler);

    attachInlineEdit();
    attachAlumnoToBoletinClicks('#alumnosList');
    ensureLogoutButtonInNav();
    attachLogoutHandlerRobust('#logoutBtn');

    verificarSesion().then(user => {
      if (user) {
        startSessionKeepalive();
        updateLogoutButtonVisibility().catch(()=>{});
        attachAdminIfNeeded();
      } else {
        updateLogoutButtonVisibility().catch(()=>{});
      }
    });

    cargarMateriasDesdeAPI().catch(()=>{});

    // Auto-load del boletín: usa ?alumno_id o session si no hay query
    (function autoLoadBoletinFromQueryOrSession(){
      const params = new URLSearchParams(window.location.search);
      const id = params.get('alumno_id');
      if (window.location.pathname.endsWith('/boletin.html') || window.location.pathname === '/boletin') {
        setTimeout(()=> renderBoletin(id || undefined, { targetSelectorHeader: 'main h2', targetSelectorTable: 'main table tbody' }), 100);
      }
    })();
  });

  // ---------- delegación: click en lista de alumnos ----------
  function attachAlumnoToBoletinClicks(containerSelector) {
    const sel = containerSelector || '#alumnosList';
    const cont = document.querySelector(sel);
    if (!cont) return;
    cont.addEventListener('click', (ev) => {
      const td = ev.target.closest('[data-id]');
      let id = null;
      if (td) id = td.getAttribute('data-id') || td.dataset.id;
      else {
        const tr = ev.target.closest('tr');
        if (tr) id = tr.querySelector('[data-id]')?.getAttribute('data-id') || tr.dataset.id;
      }
      if (!id) return;
      const inputAlumnoId = document.getElementById('alumnoId');
      if (inputAlumnoId) inputAlumnoId.value = id;
      if (window.location.pathname.endsWith('/boletin.html') || window.location.pathname === '/boletin') {
        if (typeof renderBoletin === 'function') renderBoletin(id);
        setTimeout(() => { if (typeof attachInlineEdit === 'function') attachInlineEdit(); }, 50);
      } else {
        window.location.href = `/boletin.html?alumno_id=${encodeURIComponent(id)}`;
      }
    });
  }
})();
