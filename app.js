// ── SIDEBAR (removido — los stubs no-op se mantienen por compatibilidad
//    con código viejo que pueda llamarlos. La nav vive en page-tablero) ──
let sidebarOpen = false;
function toggleSidebar() {}
function openSidebar() {}
function closeSidebar() {}

// ── NAV ───────────────────────────────────────────────────
// Default: tablero (home estilo Odoo). Antes era 'buscar' / 'analisis'.
let currentPage = 'tablero';

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(t => t.classList.remove('active'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');
  const nav = document.getElementById('nav-' + id);
  if (nav) nav.classList.add('active');
  currentPage = id;
  // Marca el body para esconder el botón "Inicio" cuando estamos en el tablero
  document.body.classList.toggle('in-tablero', id === 'tablero');
  try { history.pushState({ page: id }, '', ''); } catch(e) {}
  const sw = document.querySelector('.scroll-wrap');
  if (sw) sw.scrollTop = 0;
  if (id === 'sync')    setTimeout(() => { try { cargarEstadoSync();   } catch(e) {} }, 100);
  if (id === 'pedidos') setTimeout(() => { try { cargarPedidos();      } catch(e) {} }, 100);
  if (id === 'orden')   setTimeout(() => { try { iniciarPaginaOrden(); } catch(e) {} }, 100);
  if (id === 'analisis') setTimeout(() => { try { cargarAnalisis();    } catch(e) {} }, 100);
  if (id === 'invodoo')  setTimeout(() => { try { cargarInvOdoo();     } catch(e) {} }, 100);
  if (id === 'exportar') setTimeout(() => { try { cargarExportar();    } catch(e) {} }, 100);
  if (id === 'odoo')     setTimeout(() => { try { cargarVentasOdoo();  } catch(e) {} }, 100);
}

window.addEventListener('popstate', e => {
  if (!e.state) return;
  const { page, sub } = e.state;
  if (!page) return;

  if (page === 'buscar' && !sub && _lastTablaHTML) {
    const el = document.getElementById('buscar-result');
    if (el) {
      window._buscarPag = _lastTablaPag;
      el.innerHTML = _lastTablaHTML;
      _lastTablaHTML = null;
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pg = document.getElementById('page-buscar');
    if (pg) pg.classList.add('active');
    return;
  }

  const pg = document.getElementById('page-' + page);
  if (pg) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sb-item').forEach(t => t.classList.remove('active'));
    pg.classList.add('active');
    const nav = document.getElementById('nav-' + page);
    if (nav) nav.classList.add('active');
  }
});

// ── API ───────────────────────────────────────────────────
const GAS_URL = 'https://script.google.com/macros/s/AKfycby9biqEbiv4syc3St3TuPKXkG9rI5A4YsmtNta3OEJ4mD0i8sg0PPg9OhfrPDZJuO_L/exec';

// ── MODO DIRECTO CVA (cuando GAS agota su cuota) ──────────────
// Llama a CVA directamente desde el browser via proxy CORS
const CVA_DIRECT = {
  BASE  : 'https://apicvaservices.grupocva.com/api/v2',
  USER  : 'admin78308',
  PASS  : 'r7j6nh47',
  PROXY : 'https://corsproxy.io/?', // proxy CORS público
  token : null,
  tokenExp: 0,
};

// Obtener/renovar token CVA directo
async function _cvaToken() {
  if (CVA_DIRECT.token && Date.now() < CVA_DIRECT.tokenExp) return CVA_DIRECT.token;
  const url = CVA_DIRECT.PROXY + encodeURIComponent(CVA_DIRECT.BASE + '/user/login');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: CVA_DIRECT.USER, password: CVA_DIRECT.PASS }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('CVA login falló: ' + JSON.stringify(data));
  CVA_DIRECT.token    = data.token;
  CVA_DIRECT.tokenExp = Date.now() + 11 * 3600 * 1000;
  return data.token;
}

// GET a CVA directo (para búsquedas)
async function cvaDirectGet(path, params = {}) {
  const token = await _cvaToken();
  const qs = Object.entries(params)
    .filter(([,v]) => v !== '' && v !== null && v !== undefined)
    .map(([k,v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');
  const url = CVA_DIRECT.PROXY + encodeURIComponent(CVA_DIRECT.BASE + path + (qs ? '?' + qs : ''));
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) throw new Error('CVA ' + res.status);
  return res.json();
}

// POST a CVA directo (para crear órdenes)
async function cvaDirectPost(path, body) {
  const token = await _cvaToken();
  const url = CVA_DIRECT.PROXY + encodeURIComponent(CVA_DIRECT.BASE + path);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('CVA ' + res.status);
  return res.json();
}

// Flag: ¿usar modo directo? Se activa automáticamente si GAS falla
let _gasOk = true; // asume GAS ok al inicio, se detecta en el primer error

// Wrapper: intenta GAS primero, si falla usa CVA directo
async function apiConFallback(action, params = {}) {
  if (_gasOk) {
    try {
      const data = await api(action, params);
      // Si GAS responde con error de cuota, activar modo directo
      if (data?.error && (data.error.includes('demasiadas veces') || data.error.includes('urlfetch') || data.error.includes('quota'))) {
        console.warn('GAS cuota agotada — activando modo CVA directo');
        _gasOk = false;
        addLog('warn', 'GAS sin cuota — modo directo CVA activado', 'Las búsquedas van directo a CVA');
      } else {
        return data;
      }
    } catch(e) {
      if (e.message && (e.message.includes('503') || e.message.includes('quota') || e.message.includes('CORS'))) {
        _gasOk = false;
      } else {
        throw e;
      }
    }
  }
  // Modo directo
  return cvaDirectAction(action, params);
}

// Ejecutar acción CVA en modo directo
async function cvaDirectAction(action, params) {
  switch(action) {
    case 'cva_buscar': {
      const p = { ...params };
      delete p.action;
      // Parámetros mínimos para búsqueda rápida
      const fetchParams = {
        MonedaPesos: 'true',
        porcentaje : 16,
        tc         : 'true',
        batch      : p.batch || 'SM',
        page       : p.page  || 1,
      };
      if (p.clave) fetchParams.clave = p.clave;
      if (p.marca) fetchParams.marca = p.marca;
      if (p.grupo) fetchParams.grupo = p.grupo;
      if (p.desc)  fetchParams.desc  = p.desc;
      if (p.exist && p.exist !== 'any') fetchParams.exist = p.exist;
      const data = await cvaDirectGet('/catalogo_clientes/lista_precios', fetchParams);
      // Filtro local exist=any
      if (p.exist === 'any' && data.articulos) {
        data.articulos = data.articulos.filter(a =>
          (parseFloat(a.disponible)||0) > 0 || (parseFloat(a.disponibleCD)||0) > 0
        );
      }
      return { ok: true, ...data };
    }
    case 'cva_producto': {
      const fetchParams = {
        clave: params.clave,
        MonedaPesos: 'true', porcentaje: 16, tc: 'true',
        promos: 'true', sucursales: 'true', images: 'true',
      };
      const data = await cvaDirectGet('/catalogo_clientes/lista_precios', fetchParams);
      return { ok: true, producto: data };
    }
    case 'cva_precio_stock': {
      const data = await cvaDirectGet('/catalogo_clientes/precios_stock_ofertas', {
        clave: params.clave, MonedaPesos: 'true', porcentaje: 16,
      });
      return { ok: true, ...data };
    }
    case 'cva_sucursales': {
      const res = await fetch(CVA_DIRECT.PROXY + encodeURIComponent(CVA_DIRECT.BASE + '/catalogo_clientes/sucursales'));
      const data = await res.json();
      return { ok: true, ...data };
    }
    case 'ping':
      return { ok: true, ts: new Date().toISOString(), modo: 'directo' };
    default:
      // Para acciones que solo GAS puede hacer (sync, odoo, etc.)
      throw new Error('Acción ' + action + ' requiere GAS — disponible cuando se resetee la cuota (medianoche)');
  }
}


async function api(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  let res;
  try {
    res = await fetch(`${GAS_URL}?${qs}`, { method: 'GET', redirect: 'follow' });
  } catch(e) {
    const isCors = e.message && (e.message.includes('fetch') || e.message.includes('CORS') || e.message.includes('network') || e.message.includes('Failed'));
    throw new Error(isCors
      ? 'Sin conexión al servidor GAS. Abre la app desde GitHub Pages o verifica que el Web App esté publicado.'
      : e.message);
  }
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function apiPost(action, body = {}) {
  const payload = JSON.stringify({ action, ...body });
  let res;
  try {
    res = await fetch(GAS_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: payload,
    });
  } catch(e) {
    throw new Error(e.message && e.message.includes('fetch')
      ? 'Sin conexión al servidor GAS. Verifica que estés en GitHub Pages.'
      : e.message);
  }
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ── UTILS ─────────────────────────────────────────────────
function loading(el) {
  el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:11px;letter-spacing:2px;text-transform:uppercase"><span class="spin"></span>Cargando</div>';
}
function alert_(el, msg, tipo = 'info') {
  el.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
}
function fmtFecha(raw) {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (isNaN(d)) return String(raw).substring(0, 10);
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
  } catch(e) { return String(raw).substring(0, 10); }
}

function fmt(n, moneda) {
  const sym = moneda === 'Dolares' ? 'USD ' : '$';
  return sym + parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
}
function stockTag(qty, label) {
  if (!qty) return `<span class="tag tag-red">Sin stock</span>`;
  if (qty < 5) return `<span class="tag tag-orange">${label}: ${qty}</span>`;
  return `<span class="tag tag-green">${label}: ${qty}</span>`;
}
function stockCellAM(qty) {
  if (!qty || qty === 0) {
    return `<div class="stock-cell"><div class="stock-dot none"></div><span class="stock-none-txt">—</span></div>`;
  }
  const cls = qty < 5 ? 'low' : 'ok';
  return `<div class="stock-cell"><div class="stock-dot ${cls}"></div><span class="stock-num">${qty}</span></div>`;
}

// ── BUSCAR ────────────────────────────────────────────────
let _buscarPage = 1;
let _buscarArts = [];
let _sortCol    = null;
let _sortDir    = 1;

function sortBuscar(col) {
  if (_sortCol === col) _sortDir *= -1;
  else { _sortCol = col; _sortDir = 1; }
  _buscarArts = [..._buscarArts].sort((a, b) => {
    let va = a[col], vb = b[col];
    if (col === 'precio') { va = parseFloat(va)||0; vb = parseFloat(vb)||0; }
    else if (col === 'disponible' || col === 'disponibleCD') { va = parseInt(va)||0; vb = parseInt(vb)||0; }
    else { va = String(va||'').toLowerCase(); vb = String(vb||'').toLowerCase(); }
    return va < vb ? -_sortDir : va > vb ? _sortDir : 0;
  });
  renderTablaBusqueda(_buscarArts);
}

function sortIcon(col) {
  if (_sortCol !== col) return '<span style="opacity:0.2;margin-left:4px">⇅</span>';
  return _sortDir === 1
    ? '<span style="color:var(--green-lt);margin-left:4px">↑</span>'
    : '<span style="color:var(--green-lt);margin-left:4px">↓</span>';
}

async function buscarCVA(pagina) {
  if (pagina !== undefined) _buscarPage = pagina;
  const el = document.getElementById('buscar-result');
  loading(el);
  const params = {
    clave: document.getElementById('s-clave').value.trim(),
    marca: document.getElementById('s-marca').value.trim(),
    grupo: document.getElementById('s-grupo').value.trim(),
    desc : document.getElementById('s-desc').value.trim(),
    exist: document.getElementById('s-exist').value,
    batch: document.getElementById('s-batch')?.value || 'MD',
    page : _buscarPage,
  };
  const action = params.clave ? 'cva_producto' : 'cva_buscar';
  const data = await apiConFallback(action, params);
  if (data.ok) addLog('ok', 'Búsqueda: ' + (params.clave||params.marca||params.grupo||params.desc||'—'), (data.articulos?.length||1) + ' resultados');
  else addLog('error', 'Error búsqueda', data.error);
  if (!data.ok) {
    const isTimeout = data.error && (data.error.includes('Tiempo') || data.error.includes('timeout') || data.error.includes('agotado') || data.error.includes('deadline'));
    alert_(el, isTimeout
      ? '⏱ La búsqueda tomó demasiado tiempo. <strong>Tip:</strong> busca por clave exacta (ej: NB-1234) o combina marca + grupo para reducir resultados.'
      : '✖ ' + data.error,
      isTimeout ? 'warn' : 'error');
    return;
  }
  if (params.clave && data.producto) { el.innerHTML = renderProducto(data.producto); buscarMeli(data.producto); return; }
  const arts = data.articulos || [];
  if (arts.length === 0) { alert_(el, 'Sin resultados para la búsqueda', 'warn'); return; }
  _buscarArts = arts;
  const pag = data.paginacion || {};
  window._buscarPag = { totalPags: pag.total_paginas || 1, pagActual: pag.pagina || _buscarPage };
  renderTablaBusqueda(arts);
}

// Carga todas las páginas de resultados de una vez
async function buscarTodo() {
  const el = document.getElementById('buscar-result');
  const batch = document.getElementById('s-batch')?.value || 'LG';
  const params = {
    clave: document.getElementById('s-clave').value.trim(),
    marca: document.getElementById('s-marca').value.trim(),
    grupo: document.getElementById('s-grupo').value.trim(),
    desc : document.getElementById('s-desc').value.trim(),
    exist: document.getElementById('s-exist').value,
    batch,
    page : 1,
  };

  // Primera página — obtiene el total
  el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:11px;letter-spacing:2px;text-transform:uppercase"><span class="spin"></span>Cargando página 1…</div>';
  const action = params.clave ? 'cva_producto' : 'cva_buscar';
  const primera = await apiConFallback(action, params);
  if (!primera.ok) { alert_(el, '✖ ' + primera.error, 'error'); return; }
  if (params.clave && primera.producto) { el.innerHTML = renderProducto(primera.producto); buscarMeli(primera.producto); return; }

  const todosArts = [...(primera.articulos || [])];
  const totalPags = primera.paginacion?.total_paginas || 1;

  // Resto de páginas
  for (let pag = 2; pag <= totalPags; pag++) {
    el.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted);font-size:11px;letter-spacing:2px;text-transform:uppercase"><span class="spin"></span>Cargando página ${pag} de ${totalPags}… (${todosArts.length} artículos)</div>`;
    try {
      const data = await apiConFallback('cva_buscar', { ...params, page: pag });
      if (data.ok && data.articulos?.length) todosArts.push(...data.articulos);
    } catch(_) {}
    await new Promise(r => setTimeout(r, 200));
  }

  if (todosArts.length === 0) { alert_(el, 'Sin resultados', 'warn'); return; }
  _buscarArts = todosArts;
  window._buscarPag = { totalPags: 1, pagActual: 1 }; // todo en una sola vista
  addLog('ok', `Ver todo: ${todosArts.length} artículos`, `${totalPags} páginas cargadas`);
  renderTablaBusqueda(todosArts);
}

function renderTablaBusqueda(arts) {
  const el = document.getElementById('buscar-result');
  const { totalPags = 1, pagActual = 1 } = window._buscarPag || {};
  const tp = totalPags;

  const btnCSV = `<button class="btn btn-ghost" style="padding:6px 14px;font-size:11px;display:flex;align-items:center;gap:6px" onclick="exportBuscarCSV()">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>CSV</button>`;
  const btnPDF = `<button class="btn btn-ghost" style="padding:6px 14px;font-size:11px;display:flex;align-items:center;gap:6px" onclick="exportBuscarPDF()">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>PDF</button>`;
  const btnTodoCSV = tp > 1 ? `<button id="btn-export-todo" class="btn btn-ghost" style="padding:6px 14px;font-size:11px;display:flex;align-items:center;gap:6px;color:var(--green-lt);border-color:rgba(0,200,120,0.2)" onclick="exportarTodoCSV()">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Todo CSV (${tp} págs)</button>` : '';
  const btnTodoPDF = tp > 1 ? `<button id="btn-export-todo-pdf" class="btn btn-ghost" style="padding:6px 14px;font-size:11px;display:flex;align-items:center;gap:6px;color:var(--green-lt);border-color:rgba(0,200,120,0.2)" onclick="exportarTodoPDF()">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Todo PDF (${tp} págs)</button>` : '';

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="color:var(--muted);font-size:10px;letter-spacing:2px;text-transform:uppercase">
        ${arts.length} resultados${totalPags > 1 ? ` — Página ${pagActual} de ${totalPags}` : ''}
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        ${totalPags > 1 ? `
          <button class="btn btn-ghost" style="padding:4px 10px;font-size:10px" onclick="buscarCVA(${pagActual-1})" ${pagActual<=1?'disabled':''}>← Ant</button>
          <span style="font-size:11px;color:var(--muted);padding:0 2px">${pagActual}/${totalPags}</span>
          <button class="btn btn-ghost" style="padding:4px 10px;font-size:10px" onclick="buscarCVA(${pagActual+1})" ${pagActual>=totalPags?'disabled':''}>Sig →</button>` : ''}
        ${btnCSV}${btnPDF}${btnTodoCSV}${btnTodoPDF}
      </div>
    </div>
    <div class="table-wrap">
      <table id="buscar-table">
        <thead><tr>
          <th onclick="sortBuscar('clave')"        style="cursor:pointer;user-select:none;white-space:nowrap">Clave${sortIcon('clave')}</th>
          <th onclick="sortBuscar('descripcion')"  style="cursor:pointer;user-select:none">Descripción${sortIcon('descripcion')}</th>
          <th onclick="sortBuscar('marca')"        style="cursor:pointer;user-select:none">Marca${sortIcon('marca')}</th>
          <th onclick="sortBuscar('precio')"       style="cursor:pointer;user-select:none;white-space:nowrap">Precio${sortIcon('precio')}</th>
          <th onclick="sortBuscar('disponible')"   style="cursor:pointer;user-select:none;white-space:nowrap">Suc.${sortIcon('disponible')}</th>
          <th onclick="sortBuscar('disponibleCD')" style="cursor:pointer;user-select:none;white-space:nowrap">CEDIS${sortIcon('disponibleCD')}</th>
          <th style="white-space:nowrap;color:rgba(255,230,0,0.5);font-size:9px;letter-spacing:1px">ML</th>
          <th></th>
        </tr></thead>
        <tbody>${arts.map(a => `
          <tr>
            <td class="mono">${a.clave}</td>
            <td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.descripcion}</td>
            <td style="color:var(--muted);font-size:12px">${a.marca || '—'}</td>
            <td class="td-price">${fmt(a.precio, a.moneda)}</td>
            <td>${stockCellAM(a.disponible)}</td>
            <td>${stockCellAM(a.disponibleCD)}</td>
            <td id="ml-${a.clave.replace(/[^a-zA-Z0-9]/g,'_')}" style="white-space:nowrap;min-width:80px">
              <button class="btn btn-ghost" style="padding:3px 8px;font-size:9px;letter-spacing:1px;color:rgba(255,230,0,0.45);border-color:rgba(255,230,0,0.12)"
                onclick="buscarMeliFila(this,'${a.clave.replace(/'/g,"\\'")}','${(a.marca||'').replace(/'/g,"\\'")}','${a.descripcion.replace(/'/g,"\\'").replace(/\n/g,' ').substring(0,80)}',${a.precio},'${a.moneda||'Pesos'}',${a.tipo_cambio||0})">
                ML ↗
              </button>
            </td>
            <td style="display:flex;gap:5px">
              <button class="btn btn-ghost"   style="padding:4px 9px;font-size:10px" onclick="verProducto('${a.clave}')">Ver</button>
              <button class="btn btn-primary" style="padding:4px 9px;font-size:10px" onclick="agregarClave('${a.clave}',1)">+ Orden</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;padding-top:12px;border-top:1px solid rgba(238,240,240,0.06)">
      <span style="color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;align-self:center;margin-right:auto">${arts.length} artículos</span>
      ${btnCSV}${btnPDF}${btnTodoCSV}${btnTodoPDF}
    </div>`;
}

let _lastTablaHTML = null;
let _lastTablaPag  = { totalPags: 1, pagActual: 1 };

async function verProducto(clave) {
  const el = document.getElementById('buscar-result');
  if (el.querySelector('table')) {
    _lastTablaHTML = el.innerHTML;
    _lastTablaPag  = window._buscarPag || { totalPags: 1, pagActual: 1 };
  }
  try { history.pushState({ page: 'buscar', sub: 'producto', clave }, '', ''); } catch(e) {}
  loading(el);
  const data = await apiConFallback('cva_producto', { clave });
  if (!data.ok) { alert_(el, '✖ ' + data.error, 'error'); return; }
  el.innerHTML = renderProducto(data.producto);
  buscarMeli(data.producto);
}

function volverATabla() {
  if (_lastTablaHTML) {
    const el = document.getElementById('buscar-result');
    window._buscarPag = _lastTablaPag;
    el.innerHTML = _lastTablaHTML;
    _lastTablaHTML = null;
    try { history.pushState({ page: 'buscar' }, '', ''); } catch(e) {}
  } else {
    showPage('buscar');
  }
}

function renderProducto(p) {
  if (!p) return '<div class="alert alert-warn">Producto no encontrado</div>';
  _productoActual = p;
  const promo      = p.promociones;
  const sucursales = p.disponibilidad_sucursales || [];
  const dim        = p.dimensiones;
  const monedaStr  = p.moneda === 'Dolares' ? 'USD' : 'MXN';

  // Convertir dimensiones de metros a cm para Odoo
  const dimCm = dim ? {
    alto: (parseFloat(dim.alto) * 100).toFixed(1),
    ancho: (parseFloat(dim.ancho) * 100).toFixed(1),
    prof: (parseFloat(dim.profundidad) * 100).toFixed(1),
    peso: dim.peso,
    unidad: dim.unidad_peso || 'KG',
  } : null;

  const fmtMoney = (v, mon) => fmt(v, mon);
  const stockSuc = p.disponible || 0;
  const stockCed = p.disponibleCD || 0;
  const stockTot = stockSuc + stockCed;

  return `
    <div class="pd-wrap">
      <button class="pd-back-btn" onclick="volverATabla()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Volver al listado
      </button>

      <!-- ── HEADER del producto ── -->
      <div class="pd-header">
        <div class="pd-header-left">
          <div class="pd-breadcrumb">Producto</div>
          <div class="pd-name-row">
            <button class="pd-fav" title="Marcar como favorito">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
            <div class="pd-name">${p.descripcion || '—'}</div>
          </div>
          <div class="pd-name-underline"></div>
          <div class="pd-options">
            <label class="pd-check"><span class="pd-check-box checked"></span><span>Ventas</span></label>
            <label class="pd-check"><span class="pd-check-box checked"></span><span>Compra</span></label>
          </div>
        </div>
        <div class="pd-header-right">
          ${p.imagen
            ? `<img class="pd-image" src="${p.imagen}" alt="${p.descripcion}" onerror="this.outerHTML='<div class=\\'pd-image-placeholder\\'><svg width=\\'40\\' height=\\'40\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><polyline points=\\'21 15 16 10 5 21\\'/></svg></div>'">`
            : `<div class="pd-image-placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>`}
        </div>
      </div>

      <!-- ── TABS ── -->
      <div class="pd-tabs">
        <button class="pd-tab active" onclick="pdTab('general')">Información general</button>
        <button class="pd-tab" onclick="pdTab('stock')">Disponibilidad</button>
        ${sucursales.length > 0 ? `<button class="pd-tab" onclick="pdTab('sucursales')">Sucursales</button>` : ''}
        <button class="pd-tab" onclick="pdTab('meli')">MercadoLibre</button>
      </div>

      <!-- ── TAB: Información general ── -->
      <div class="pd-tab-content active" id="pd-tab-general">
        <div class="pd-grid">
          <div class="pd-col">
            <div class="pd-field">
              <div class="pd-field-label">Tipo de producto</div>
              <div class="pd-field-radios">
                <span class="pd-radio active"><span class="pd-radio-dot"></span> Bienes</span>
                <span class="pd-radio"><span class="pd-radio-dot"></span> Servicio</span>
                <span class="pd-radio"><span class="pd-radio-dot"></span> Combo</span>
              </div>
            </div>
            <div class="pd-field">
              <div class="pd-field-label">Política de facturación</div>
              <div class="pd-field-value">Cantidad ordenada</div>
            </div>
            <div class="pd-field">
              <div class="pd-field-label">Rastrear inventario</div>
              <div class="pd-field-check"><span class="pd-check-box checked"></span> Por cantidad</div>
              <div class="pd-field-note">Puedes facturar los bienes antes de entregarlos.</div>
            </div>
            <div class="pd-field">
              <div class="pd-field-label">Dimensiones (CM)</div>
              <div class="pd-field-value">${dimCm ? `${dimCm.alto} × ${dimCm.ancho} × ${dimCm.prof}` : '—'}</div>
            </div>
            <div class="pd-field">
              <div class="pd-field-label">Peso (KG)</div>
              <div class="pd-field-value">${dimCm ? `${dimCm.peso} ${dimCm.unidad}` : '—'}</div>
            </div>
          </div>

          <div class="pd-col">
            <div class="pd-field-row">
              <div class="pd-field-label">Precio de venta</div>
              <div class="pd-field-value pd-money">${fmtMoney(p.precio, p.moneda)} <span class="pd-unit">${monedaStr} · por Unidades</span></div>
            </div>
            ${p.tipo_cambio ? `
            <div class="pd-field-row">
              <div class="pd-field-label">Tipo de cambio</div>
              <div class="pd-field-value">$${p.tipo_cambio}</div>
            </div>` : ''}
            <div class="pd-field-row">
              <div class="pd-field-label">Impuesto de ventas</div>
              <div class="pd-field-value"><span class="pd-tax-chip">16% ×</span></div>
            </div>
            <div class="pd-field-row">
              <div class="pd-field-label">Costo</div>
              <div class="pd-field-value pd-money">${fmtMoney(p.precio, p.moneda)} <span class="pd-unit">por Unidades</span></div>
            </div>
            <div class="pd-field-row">
              <div class="pd-field-label">Impuestos de compra</div>
              <div class="pd-field-value"><span class="pd-tax-chip">16% ×</span></div>
            </div>
            ${p.grupo ? `
            <div class="pd-field-row">
              <div class="pd-field-label">Categoría</div>
              <div class="pd-field-value">${p.grupo}</div>
            </div>` : ''}
            <div class="pd-field-row">
              <div class="pd-field-label">Referencia (clave CVA)</div>
              <div class="pd-field-value pd-mono">${p.clave}</div>
            </div>
            ${p.codigo ? `
            <div class="pd-field-row">
              <div class="pd-field-label">Código de barras</div>
              <div class="pd-field-value pd-mono">${p.codigo}</div>
            </div>` : ''}
            ${p.marca ? `
            <div class="pd-field-row">
              <div class="pd-field-label">Marca</div>
              <div class="pd-field-value">${p.marca}</div>
            </div>` : ''}
            ${p.garantia ? `
            <div class="pd-field-row">
              <div class="pd-field-label">Garantía</div>
              <div class="pd-field-value">${p.garantia}</div>
            </div>` : ''}
          </div>
        </div>

        ${promo ? `
        <div class="pd-promo-banner">
          <strong>Promoción activa:</strong> ${promo.descripcion_promocion}
          <span class="pd-promo-extra">${fmtMoney(promo.precio_descuento, promo.moneda_precio_descuento)} · Vence: ${promo.promocion_vencimiento}</span>
        </div>` : ''}
      </div>

      <!-- ── TAB: Disponibilidad/Stock ── -->
      <div class="pd-tab-content" id="pd-tab-stock">
        <div class="pd-stock-grid">
          <div class="pd-stock-card">
            <div class="pd-stock-label">Stock Sucursal</div>
            <div class="pd-stock-value ${stockSuc===0?'zero':stockSuc<5?'low':'ok'}">${stockSuc.toLocaleString()}</div>
            <div class="pd-stock-unit">unidades</div>
          </div>
          <div class="pd-stock-card">
            <div class="pd-stock-label">Stock CEDIS</div>
            <div class="pd-stock-value ${stockCed===0?'zero':stockCed<5?'low':'ok'}">${stockCed.toLocaleString()}</div>
            <div class="pd-stock-unit">unidades</div>
          </div>
          <div class="pd-stock-card">
            <div class="pd-stock-label">Total disponible</div>
            <div class="pd-stock-value ${stockTot===0?'zero':stockTot<5?'low':'ok'}">${stockTot.toLocaleString()}</div>
            <div class="pd-stock-unit">unidades</div>
          </div>
          ${p.en_transito ? `
          <div class="pd-stock-card">
            <div class="pd-stock-label">En tránsito</div>
            <div class="pd-stock-value">${p.en_transito.toLocaleString()}</div>
            <div class="pd-stock-unit">unidades</div>
          </div>` : ''}
        </div>
      </div>

      ${sucursales.length > 0 ? `
      <!-- ── TAB: Sucursales ── -->
      <div class="pd-tab-content" id="pd-tab-sucursales">
        <div class="pd-suc-grid">
          ${sucursales.map(s => `
            <div class="pd-suc-item ${s.disponible === 0 ? 'zero' : ''}">
              <div class="pd-suc-name">${s.nombre.replace('VENTAS ', '').replace('CENTRO DE DIST.', 'CDIST')}</div>
              <div class="pd-suc-qty">${s.disponible}</div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- ── TAB: MercadoLibre ── -->
      <div class="pd-tab-content" id="pd-tab-meli">
        <div class="pd-meli-block" id="pv-meli-block">
          <div class="pv-meli-logo">ML</div>
          <div class="pv-meli-content">
            <div class="pv-meli-loading" id="pv-meli-loading">Buscando en MercadoLibre…</div>
          </div>
        </div>
      </div>

      <!-- ── CTA bar al fondo (siempre visible) ── -->
      <div class="pd-cta-bar">
        <div class="pd-cta-left">
          <button class="btn btn-ghost pd-cta-export" onclick="exportProductoCSV()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CSV
          </button>
          <button class="btn btn-ghost pd-cta-export" onclick="exportProductoPDF()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> PDF
          </button>
        </div>
        <div class="pd-cta-right">
          <div class="pd-qty-ctrl">
            <button class="pd-qty-btn" onclick="pvQtyChange(-1)">−</button>
            <input class="pd-qty-input" id="pv-qty" type="number" value="1" min="1" max="999">
            <button class="pd-qty-btn" onclick="pvQtyChange(1)">+</button>
          </div>
          <button class="pd-cta-main"
            onclick="agregarClave('${p.clave}', parseInt(document.getElementById('pv-qty').value)||1)">
            Agregar a orden
          </button>
        </div>
      </div>
    </div>`;
}

// ── Cambiar tab del detalle de producto ──
function pdTab(name) {
  document.querySelectorAll('.pd-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.pd-tab-content').forEach(c => c.classList.remove('active'));
  const tab = Array.from(document.querySelectorAll('.pd-tab')).find(t => t.getAttribute('onclick')?.includes("'" + name + "'"));
  if (tab) tab.classList.add('active');
  const cont = document.getElementById('pd-tab-' + name);
  if (cont) cont.classList.add('active');
}
window.pdTab = pdTab;

// ── ML ────────────────────────────────────────────────────
function _buildMLQueries(marca, descripcion) {
  const words = (descripcion || '').split(/[\s\/,\(\)]+/).map(w => w.trim()).filter(Boolean);
  const STOP = new Set(['DE','LA','EL','LOS','LAS','CON','POR','PARA','SIN','UNA','UNO',
    'DISCO','DURO','LAPTOP','MONITOR','IMPRESORA','TECLADO','MOUSE','CABLE','MEMORIA',
    'INTERNO','EXTERNO','NEGRO','BLANCO','PLATA','COLOR','PULGADAS','MODELO','TIPO',
    'SMART','SERIE','NUEVA','NUEVO','ALTA','ALTO','BAJO','BAJA','GRAN','GRANDE']);
  const isModelo = w =>
    (/^[A-Z0-9]+-[A-Z0-9]+$/.test(w) || (/[A-Z]/.test(w) && /[0-9]/.test(w) && w.length >= 4)) &&
    w !== marca && !STOP.has(w);
  const modelos = words.filter(w => isModelo(w)).slice(0, 2);
  const desc    = words.filter(w => w.length > 3 && !STOP.has(w) && w !== marca && !/^\d+$/.test(w) && !modelos.includes(w)).slice(0, 3);
  const q1 = modelos.length ? [marca, ...modelos].join(' ') : [marca, ...desc.slice(0,2)].join(' ');
  const q2 = [marca, ...desc.slice(0,2)].join(' ');
  return { q1, q2, searchUrl: `https://listado.mercadolibre.com.mx/${encodeURIComponent(q1)}` };
}

async function _searchML(q1, q2) {
  let data = await api('ml_precio', { q: q1 });
  if (!data?.ok || !data.results?.length) data = await api('ml_precio', { q: q2 });
  return (data?.results || []).filter(r => r.price > 0);
}

async function buscarMeli(producto) {
  const bloque = document.getElementById('pv-meli-block');
  if (!bloque) return;
  const { q1, q2, searchUrl } = _buildMLQueries(producto.marca || '', producto.descripcion || '');
  try {
    const results = await _searchML(q1, q2);
    if (!results.length) {
      bloque.innerHTML = `<div class="pv-meli-logo">ML</div><div class="pv-meli-content"><div class="pv-meli-error">Sin coincidencias · <a href="${searchUrl}" target="_blank" style="color:rgba(255,230,0,0.4)">buscar manualmente</a></div></div>`;
      return;
    }
    const precios = results.map(r => r.price).sort((a,b) => a-b);
    const min = precios[0], med = precios[Math.floor(precios.length/2)];
    const cvaMXN = producto.moneda === 'Dolares' ? producto.precio*(producto.tipo_cambio||17.5) : producto.precio;
    const pct = cvaMXN > 0 ? ((min-cvaMXN)/cvaMXN*100).toFixed(0) : null;
    const diffStr = pct !== null
      ? (pct>=0 ? ` · <span style="color:rgba(0,200,120,0.85)">+${pct}% margen</span>` : ` · <span style="color:rgba(255,100,100,0.8)">${pct}% bajo costo</span>`)
      : '';
    bloque.innerHTML = `
      <div class="pv-meli-logo">ML</div>
      <div class="pv-meli-content">
        <div class="pv-meli-price">$${min.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div class="pv-meli-sub">${results.length} pub encontradas · mediana $${med.toLocaleString('es-MX')}${diffStr}</div>
      </div>
      <a class="pv-meli-link" href="${searchUrl}" target="_blank">Ver en ML →</a>`;
  } catch(e) {
    bloque.innerHTML = `<div class="pv-meli-logo">ML</div><div class="pv-meli-content"><div class="pv-meli-error">No disponible</div></div><a class="pv-meli-link" href="${searchUrl}" target="_blank">Buscar →</a>`;
  }
}

async function buscarMeliFila(btn, clave, marca, descripcion, precioCVA, moneda, tc) {
  const cell = btn.parentElement;
  cell.innerHTML = `<span style="font-size:9px;color:var(--muted)">…</span>`;
  const { q1, q2, searchUrl } = _buildMLQueries(marca, descripcion);
  try {
    const results = await _searchML(q1, q2);
    if (!results.length) { cell.innerHTML = `<a href="${searchUrl}" target="_blank" style="font-size:9px;color:var(--muted);text-decoration:none">Sin coincid.</a>`; return; }
    const min    = results.map(r=>r.price).sort((a,b)=>a-b)[0];
    const cvaMXN = moneda==='Dolares' ? precioCVA*(tc||17.5) : precioCVA;
    const pct    = cvaMXN>0 ? ((min-cvaMXN)/cvaMXN*100).toFixed(0) : null;
    const color  = pct===null ? 'var(--muted)' : pct>=0 ? 'rgba(0,200,120,0.85)' : 'rgba(255,100,100,0.8)';
    const pctStr = pct!==null ? ` <span style="font-size:8px;color:${color}">${pct>=0?'+':''}${pct}%</span>` : '';
    cell.innerHTML = `<a href="${searchUrl}" target="_blank" style="text-decoration:none">
      <span style="font-size:11px;font-family:'Barlow Condensed',sans-serif;font-weight:300;color:rgba(255,230,0,0.8)">$${min.toLocaleString('es-MX',{minimumFractionDigits:0})}</span>${pctStr}
    </a>`;
  } catch(e) { cell.innerHTML = `<span style="font-size:9px;color:var(--muted)">Error</span>`; }
}

// ── EXPORTAR TODAS LAS PÁGINAS ────────────────────────────
let _exportando = false;

async function exportarTodoCSV() {
  if (_exportando) return;
  const { totalPags = 1 } = window._buscarPag || {};
  if (totalPags <= 1) { exportBuscarCSV(); return; }
  const params = {
    clave: document.getElementById('s-clave').value.trim(),
    marca: document.getElementById('s-marca').value.trim(),
    grupo: document.getElementById('s-grupo').value.trim(),
    desc : document.getElementById('s-desc').value.trim(),
    exist: document.getElementById('s-exist').value,
  };
  const btn = document.getElementById('btn-export-todo');
  if (btn) btn.disabled = true;
  _exportando = true;
  const todos = [..._buscarArts];
  const pagActual = (window._buscarPag || {}).pagActual || 1;
  try {
    for (let pag = 1; pag <= totalPags; pag++) {
      if (pag === pagActual) continue;
      if (btn) btn.textContent = `Descargando ${pag}/${totalPags}…`;
      const data = await api('cva_buscar', { ...params, page: pag });
      if (data.ok && data.articulos?.length) todos.push(...data.articulos);
      await new Promise(r => setTimeout(r, 300));
    }
    const rows = [['Clave','Descripción','Marca','Grupo','Precio','Moneda','Stock Suc.','Stock CEDIS','Garantía']];
    todos.forEach(a => rows.push([a.clave, a.descripcion, a.marca||'', a.grupo||'', a.precio||'', a.moneda||'MXN', a.disponible||0, a.disponibleCD||0, a.garantia||'']));
    downloadCSV(rows, `CVA_Completo_${new Date().toISOString().substring(0,10)}.csv`);
    addLog('ok', `Export completo: ${todos.length} artículos`, `${totalPags} páginas`);
  } catch(e) { addLog('error', 'Error export completo', e.message); }
  finally {
    _exportando = false;
    if (btn) { btn.disabled = false; btn.textContent = `↓ Todo CSV (${totalPags} págs)`; }
  }
}

async function exportarTodoPDF() {
  if (_exportando) return;
  const { totalPags = 1 } = window._buscarPag || {};
  if (totalPags <= 1) { exportBuscarPDF(); return; }
  const params = {
    clave: document.getElementById('s-clave').value.trim(),
    marca: document.getElementById('s-marca').value.trim(),
    grupo: document.getElementById('s-grupo').value.trim(),
    desc : document.getElementById('s-desc').value.trim(),
    exist: document.getElementById('s-exist').value,
  };
  const btn = document.getElementById('btn-export-todo-pdf');
  if (btn) btn.disabled = true;
  _exportando = true;
  const todos = [..._buscarArts];
  const pagActual = (window._buscarPag || {}).pagActual || 1;
  try {
    for (let pag = 1; pag <= totalPags; pag++) {
      if (pag === pagActual) continue;
      if (btn) btn.textContent = `Descargando ${pag}/${totalPags}…`;
      const data = await api('cva_buscar', { ...params, page: pag });
      if (data.ok && data.articulos?.length) todos.push(...data.articulos);
      await new Promise(r => setTimeout(r, 300));
    }
    const rows = todos.map(a => [a.clave, a.descripcion, a.marca||'—', fmt(a.precio,a.moneda), a.disponible||0, a.disponibleCD||0]);
    printPDF(`Búsqueda CVA — ${todos.length} artículos`, ['Clave','Descripción','Marca','Precio','Suc.','CEDIS'], rows);
    addLog('ok', `PDF completo: ${todos.length} artículos`);
  } catch(e) { addLog('error', 'Error PDF completo', e.message); }
  finally {
    _exportando = false;
    if (btn) { btn.disabled = false; btn.textContent = `↓ Todo PDF (${totalPags} págs)`; }
  }
}

let _productoActual = null;

function exportProductoCSV() {
  const p = _productoActual; if (!p) return;
  const dim = p.dimensiones;
  const rows = [['Campo','Valor'],
    ['Clave',p.clave],['Descripción',p.descripcion],['Marca',p.marca||''],['Grupo',p.grupo||''],
    ['Precio',p.precio],['Moneda',p.moneda||'Pesos'],['Tipo Cambio',p.tipo_cambio||''],
    ['Stock Suc.',p.disponible||0],['Stock CEDIS',p.disponibleCD||0],['En Tránsito',p.en_transito||0],
    ['Garantía',p.garantia||''],['Código UPC',p.codigo||''],
    ['Dimensiones',dim?`${dim.alto}m × ${dim.ancho}m × ${dim.profundidad}m · ${dim.peso} ${dim.unidad_peso}`:''],
    ['Promo Precio',p.promociones?.precio_descuento||''],['Promo Vence',p.promociones?.promocion_vencimiento||''],
  ];
  downloadCSV(rows, `CVA_${p.clave}_${new Date().toISOString().substring(0,10)}.csv`);
}

async function exportProductoPDF() {
  const p = _productoActual; if (!p) return;
  const dim = p.dimensiones;
  let imgBase64 = null;
  if (p.imagen) {
    try {
      const res = await fetch(p.imagen);
      const blob = await res.blob();
      imgBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch(e) {}
  }
  const w = window.open('', '_blank', 'width=900,height=700');
  const rows = [
    ['Clave',p.clave],['Marca',p.marca||'—'],['Grupo',p.grupo||'—'],
    ['Precio',fmt(p.precio,p.moneda)+(p.tipo_cambio?` · TC $${p.tipo_cambio}`:'')],
    ['Stock Suc.',p.disponible?`${p.disponible} uds`:'Sin stock'],
    ['Stock CEDIS',p.disponibleCD?`${p.disponibleCD} uds`:'Sin stock'],
    ['En Tránsito',p.en_transito?`${p.en_transito} uds`:'—'],
    ['Garantía',p.garantia||'—'],['Código UPC',p.codigo||'—'],
    ['Dimensiones',dim?`${dim.alto}m × ${dim.ancho}m × ${dim.profundidad}m · ${dim.peso} ${dim.unidad_peso}`:'—'],
    ['Promoción',p.promociones?`${p.promociones.descripcion_promocion} · ${fmt(p.promociones.precio_descuento,p.promociones.moneda_precio_descuento)}`:'—'],
  ];
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${p.clave}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;font-size:11px;color:#1e2025;padding:28px}h1{font-size:13px;font-weight:600;margin-bottom:2px;letter-spacing:.5px;text-transform:uppercase;line-height:1.3}.meta{font-size:10px;color:#666;margin-bottom:18px;letter-spacing:1px}.layout{display:flex;gap:28px;align-items:flex-start}.img-col{flex-shrink:0}.data-col{flex:1}table{width:100%;border-collapse:collapse}th{background:#1e2025;color:#fff;padding:7px 10px;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;text-align:left}td{padding:6px 10px;border-bottom:1px solid #eee;font-size:11px}td:first-child{color:#666;font-size:10px;letter-spacing:.5px;white-space:nowrap;width:120px}tr:last-child td{border-bottom:none}.price-badge{display:inline-block;background:#00665e;color:#fff;padding:4px 12px;font-size:16px;font-weight:600;margin:10px 0 18px}@media print{body{padding:12px}}</style></head><body>
  <h1>${p.descripcion}</h1>
  <div class="meta">${p.clave} · Generado: ${new Date().toLocaleString('es-MX')} · Electronics México</div>
  <div class="layout">
    ${imgBase64?`<div class="img-col"><img src="${imgBase64}" style="max-height:160px;max-width:200px;object-fit:contain;border:1px solid #eee;padding:8px"></div>`:''}
    <div class="data-col"><div class="price-badge">${fmt(p.precio,p.moneda)}</div>
    <table><thead><tr><th>Campo</th><th>Valor</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</tbody></table></div>
  </div></body></html>`);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

function filtrarPorMarca(marca) {
  limpiarBusqueda();
  document.getElementById('s-marca').value = marca;
  document.getElementById('s-exist').value = '3';
  showPage('buscar');
  addLog('info', 'Filtro por marca: ' + marca);
  buscarCVA();
}
function filtrarPorGrupo(grupo) {
  limpiarBusqueda();
  document.getElementById('s-grupo').value = grupo;
  document.getElementById('s-exist').value = '3';
  showPage('buscar');
  addLog('info', 'Filtro por grupo: ' + grupo);
  buscarCVA();
}
function limpiarBusqueda() {
  ['s-clave','s-marca','s-grupo','s-desc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('s-exist').value = '3';
  document.getElementById('buscar-result').innerHTML = '';
}

// ── CARRITO ───────────────────────────────────────────────
let carrito = (() => {
  try { return JSON.parse(localStorage.getItem('cva_carrito') || '[]'); }
  catch(_) { return []; }
})();

function guardarCarrito() {
  try { localStorage.setItem('cva_carrito', JSON.stringify(carrito)); } catch(_) {}
}
function pvQtyChange(delta) {
  const el = document.getElementById('pv-qty');
  if (!el) return;
  el.value = Math.max(1, Math.min(999, (parseInt(el.value) || 1) + delta));
}
function agregarClave(clave, qty = 1) {
  // 1. Buscar en resultados actuales de la tabla (más rápido, sin fetch)
  const enTabla = _buscarArts.find(a => a.clave === clave);
  const art = enTabla || (_productoActual?.clave === clave ? _productoActual : null);

  if (art) {
    const exist = carrito.findIndex(i => i.clave === clave);
    if (exist >= 0) {
      carrito[exist].qty += qty;
    } else {
      carrito.push({
        clave      : art.clave,
        desc       : art.descripcion || clave,
        precio     : parseFloat(art.precio) || 0,
        moneda     : art.moneda || 'Pesos',
        marca      : art.marca || '',
        qty,
        imagen     : art.imagen || null,
        tipo_cambio: parseFloat(art.tipo_cambio) || 0,
        stock_cedis: parseFloat(art.disponibleCD) || 0,
      });
    }
    addLog('ok', '+ Carrito: ' + clave, 'Qty: ' + qty);
    guardarCarrito();
    renderCarrito();
    showPage('orden');
    return;
  }

  // 2. Fallback: fetch si el producto no está en tabla (ej: agregado por clave manual)
  document.getElementById('cart-clave').value = clave;
  document.getElementById('cart-qty').value = qty;
  agregarAlCarrito().then(() => showPage('orden'));
}

async function agregarAlCarrito() {
  const clave = document.getElementById('cart-clave').value.trim().toUpperCase();
  const qty   = parseInt(document.getElementById('cart-qty').value) || 1;
  if (!clave) return;

  const btn = document.querySelector('#page-orden .btn-primary[onclick*="agregarAlCarrito"]');
  if (btn) { btn.textContent = '...'; btn.disabled = true; }

  try {
    let art = null;

    // 1. Buscar en resultados actuales — más rápido, sin fetch
    art = _buscarArts.find(a => a.clave === clave) || null;

    // 2. Si no está en tabla, hacer fetch a CVA
    if (!art) {
      try {
        const data = await apiConFallback('cva_precio_stock', { clave });
        art = data.articulos ? data.articulos[0] : (data.clave ? data : null);
      } catch(_) {}
    }

    // 3. Último fallback: buscar por clave exacta
    if (!art) {
      try {
        const data = await apiConFallback('cva_buscar', { clave, page: 1 });
        art = (data.articulos || []).find(a => a.clave === clave) || null;
      } catch(_) {}
    }

    if (!art || !art.clave) { alert('Producto no encontrado: ' + clave); return; }

    const exist = carrito.findIndex(i => i.clave === clave);
    if (exist >= 0) { carrito[exist].qty += qty; }
    else {
      let imagen = art.imagen || null;
      let tcProducto = parseFloat(art.tipo_cambio) || 0;
      if (!imagen) {
        try {
          const pd = await apiConFallback('cva_producto', { clave: art.clave });
          imagen = pd.producto?.imagen || null;
          if (!tcProducto && pd.producto?.tipo_cambio) tcProducto = parseFloat(pd.producto.tipo_cambio) || 0;
        } catch(_) {}
      }
      carrito.push({
        clave      : art.clave,
        desc       : art.descripcion || art.codigo || clave,
        precio     : parseFloat(art.precio) || 0,
        moneda     : art.moneda || 'Pesos',
        marca      : art.marca || '',
        qty,
        imagen,
        tipo_cambio: tcProducto,
        stock_cedis: (art.inventario || []).find(x => x.nombre==='TOTAL')?.disponible || 0,
      });
    }
    document.getElementById('cart-clave').value = '';
    addLog('ok', 'Agregado al carrito: ' + clave, 'Qty: ' + qty);
    guardarCarrito();
    renderCarrito();

  } finally {
    if (btn) { btn.textContent = 'Agregar'; btn.disabled = false; }
  }
}

function renderCarrito() {
  const el  = document.getElementById('carrito-items');
  const tot = document.getElementById('carrito-totales');
  const qty = carrito.reduce((s,i) => s + i.qty, 0);
  const hb = document.getElementById('cart-badge');
  const sb = document.getElementById('cart-sb-badge');
  if (hb) { hb.style.display = qty > 0 ? 'inline' : 'none'; if (qty > 0) hb.textContent = 'Cart ' + qty; }
  if (sb) { sb.style.display = qty > 0 ? 'inline' : 'none'; if (qty > 0) sb.textContent = qty; }
  if (carrito.length === 0) {
    el.innerHTML = '<div class="alert alert-info">El carrito está vacío</div>';
    tot.style.display = 'none';
    return;
  }
  const totalMXN = carrito.reduce((s,i) => s + i.precio * i.qty, 0);
  const totalItems = carrito.reduce((s,i) => s + i.qty, 0);

  el.innerHTML = carrito.map((item, idx) => {
    const subtotal = item.precio * item.qty;
    const thumbHTML = item.imagen
      ? `<img src="${item.imagen}" alt="${item.clave}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    return `<div class="cart-item">
      <div class="cart-item-thumb">
        ${thumbHTML}
        <div class="cart-item-thumb-ph" style="${item.imagen ? 'display:none' : ''}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.15"><rect x="3" y="3" width="18" height="18"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </div>
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.desc}</div>
        <div class="cart-item-meta">
          <span class="cart-item-clave">${item.clave}</span>
          ${item.marca ? `<span class="cart-item-marca">${item.marca}</span>` : ''}
        </div>
        <div class="cart-item-price-unit">${fmt(item.precio, item.moneda)} por unidad</div>
      </div>
      <div class="cart-item-qty">
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="cambiarQty(${idx},-1)">−</button>
          <input class="qty-num" type="number" value="${item.qty}" min="1" max="999"
            onchange="setQty(${idx},this.value)" onblur="setQty(${idx},this.value)">
          <button class="qty-btn" onclick="cambiarQty(${idx},1)">+</button>
        </div>
      </div>
      <div class="cart-item-total">
        <div class="cart-item-total-price">${fmt(subtotal, item.moneda)}</div>
        <button class="cart-item-remove" onclick="quitarItem(${idx})">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Eliminar
        </button>
      </div>
    </div>`;
  }).join('');

  // Resumen debajo del carrito
  tot.style.display = 'block';
  document.getElementById('carrito-total').textContent = fmt(totalMXN, 'Pesos');
}

function cambiarQty(idx,delta){ carrito[idx].qty=Math.max(1,carrito[idx].qty+delta); guardarCarrito(); renderCarrito(); }
function setQty(idx,val){ const q=parseInt(val); if(q>0){ carrito[idx].qty=q; guardarCarrito(); renderCarrito(); } }
function quitarItem(idx){ carrito.splice(idx,1); guardarCarrito(); renderCarrito(); }

async function enviarOrden(test = false, sinGuia = false) {
  if (carrito.length === 0) { alert('El carrito está vacío'); return; }

  const tipo_flete = document.getElementById('tipo-flete').value;

  // Validar guía completa cuando es SF y no es "sin guía" ni test
  if (tipo_flete === 'SF' && !sinGuia && !test) {
    const noGuia = document.getElementById('guia-numero').value.trim();
    if (!noGuia) {
      alert('⚠️ Ingresa el número de rastreo antes de crear el pedido.');
      document.getElementById('guia-numero').focus();
      return;
    }
    if (!_guiaPdfBase64) {
      const dz = document.getElementById('guia-dropzone');
      if (dz) { dz.style.borderColor = '#e05555'; dz.style.background = 'rgba(229,68,68,0.06)'; }
      document.getElementById('guia-pdf-info').innerHTML =
        '<span style="color:#e05555">⚠️ El PDF es obligatorio — CVA no puede despachar sin la etiqueta</span>';
      dz && dz.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }


  const el = document.getElementById('orden-result');
  loading(el);
  const direccion  = {
    calle: document.getElementById('f-calle').value,
    numero: document.getElementById('f-numero').value,
    colonia: document.getElementById('f-colonia').value,
    cp: document.getElementById('f-cp').value,
    estado_id: document.getElementById('f-estado').value,
    ciudad_id: document.getElementById('f-ciudad').value,
    atencion: document.getElementById('f-atencion').value,
    paqueteria_id: parseInt(document.getElementById('f-paqueteria').value) || 4,
  };
  const body = {
    action: 'cva_crear_orden',
    productos: carrito.map(i => ({ clave:i.clave, cantidad:i.qty, precio:i.precio, descripcion:i.desc })),
    num_oc: document.getElementById('num-oc').value,
    codigo_sucursal: parseInt(document.getElementById('f-sucursal')?.value ?? '1') || 1,
    observaciones: document.getElementById('observaciones').value,
    tipo_flete, direccion, test: test ? 1 : 0,
  };
  // Crear orden — intenta GAS, si no disponible usa CVA directo
  let data;
  if (_gasOk) {
    try {
      data = await apiPost('cva_crear_orden', body);
    } catch(e) {
      if (e.message && (e.message.includes('503') || e.message.includes('quota'))) {
        _gasOk = false;
      } else { throw e; }
    }
  }
  if (!_gasOk || !data) {
    // Modo directo — crear orden CVA sin pasar por GAS
    const orderBody = {
      num_oc          : body.num_oc || '',
      codigo_sucursal : parseInt(body.codigo_sucursal) || 1,
      tipo_flete      : body.tipo_flete || 'SF',
      observaciones   : body.observaciones || 'Dropship Electronics Mexico',
      cotiza_flete    : 1,
      MonedaPesos     : true,
      moneda          : 'MXN',
      productos       : (body.productos || []).map(p => ({ clave: p.clave, cantidad: parseInt(p.cantidad)||1 })),
    };
    if (body.test) orderBody.test = 1;
    const raw = await cvaDirectPost('/pedidos_web/crear_orden?MonedaPesos=true', orderBody);
    data = { ok: true, ...raw };
  }

  // CVA puede devolver ok:true pero con message de error de negocio (ej: sin crédito)
  if (!data.ok || !data.pedido) {
    const msg = data.message || data.error || 'Error desconocido';
    const action = data.action ? `<br><small style="opacity:0.7">${data.action}</small>` : '';
    alert_(el, `✖ ${msg}${action}`, 'error');
    addLog('error', 'Error crear orden CVA', msg);
    return;
  }

  // ── Calcular totales en MXN para desglose ──
  // Buscar TC más confiable: del carrito (vino del catálogo en tiempo real)
  const tcDelCarrito = carrito.reduce((best, item) => {
    const t = parseFloat(item.tipo_cambio || 0);
    return t > 0 ? t : best;
  }, 0);
  const tc         = parseFloat(data.tipo_cambio) || tcDelCarrito || 0;
  const monedaProd = data.moneda || 'USD';
  const subtotalCV = parseFloat(data.subtotal) || 0;
  const ivaCV      = parseFloat(data.iva)      || 0;
  const totalCV    = parseFloat(data.total)    || 0;
  const flete      = data.flete || null;
  const fleteTot   = flete ? parseFloat(flete.montoTotal || 0) : 0;
  const fleteIva   = flete ? parseFloat(flete.iva || 0) : 0;
  const fleteSub   = flete ? parseFloat(flete.subtotal || 0) : 0;
  const cajas      = flete ? (flete.cajas || 1) : 0;

  // Convertir productos a MXN — usar TC del catálogo (más preciso que fallback)
  // Si no hay TC disponible, forzar consulta al TC actual de CVA
  const tcVal = tc || 17.5; // fallback mínimo solo si no hay TC de ningún lado
  const toMXN = (val, mon) => mon === 'Dolares' || mon === 'USD' ? val * tcVal : val;
  const subMXN  = toMXN(subtotalCV, monedaProd);
  const ivaMXN  = toMXN(ivaCV,      monedaProd);
  const totMXN  = toMXN(totalCV,    monedaProd);
  const grandTotal = totMXN + fleteTot;

  el.innerHTML = `
    <div class="orden-confirmacion">
      <div class="orden-conf-header">
        ${test ? '<div class="orden-conf-test">MODO TEST — No se generó pedido real</div>' : ''}
        <div class="orden-conf-numero">
          <span style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--green-lt)">Pedido confirmado</span>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:36px;font-weight:300;color:#fff;letter-spacing:1px;line-height:1">${data.pedido}</div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">
          ${data.email_agente ? `Agente: ${data.email_agente}` : ''}
          ${data.email_almacen ? ` · Almacén: ${data.email_almacen}` : ''}
        </div>
      </div>

      <div class="orden-conf-desglose">
        <div class="orden-conf-row">
          <span>Subtotal productos</span>
          <span>${fmt(subMXN, 'Pesos')} MXN${monedaProd !== 'Pesos' ? ` <small style="opacity:0.5">(${fmt(subtotalCV, monedaProd)})</small>` : ''}</span>
        </div>
        <div class="orden-conf-row">
          <span>IVA (16%)</span>
          <span>${fmt(ivaMXN, 'Pesos')} MXN</span>
        </div>
        <div class="orden-conf-row orden-conf-subtotal">
          <span>Subtotal con IVA</span>
          <span>${fmt(totMXN, 'Pesos')} MXN</span>
        </div>
        ${flete ? `
        <div class="orden-conf-row" style="margin-top:8px">
          <span>Flete (${cajas} caja${cajas !== 1 ? 's' : ''}) — Paquetexpress</span>
          <span>${fmt(fleteSub, 'Pesos')} MXN</span>
        </div>
        <div class="orden-conf-row">
          <span>IVA flete</span>
          <span>${fmt(fleteIva, 'Pesos')} MXN</span>
        </div>` : ''}
        <div class="orden-conf-row orden-conf-total">
          <span>TOTAL A PAGAR</span>
          <span>${fmt(grandTotal, 'Pesos')} MXN${tc ? ` <small style="opacity:0.45;font-size:10px">TC $${tc}</small>` : ''}</span>
        </div>
      </div>

      <div style="padding:14px 20px;font-size:11px;color:var(--muted);border-top:1px solid rgba(238,240,240,0.07);display:flex;flex-direction:column;gap:6px">
        <div>💬 CVA: ${data.email_agente || 'agente CVA'} · ${data.email_almacen || ''}</div>
        <div class="guia-status" style="font-size:11px">
          ${tipo_flete === 'SF' && document.getElementById('guia-numero')?.value.trim()
            ? (_tieneTokenGuias()
                ? `<span style="color:var(--green-lt)">✓ Guía enviando a CVA…</span>`
                : `<span style="color:var(--orange)">⏳ Guía registrada localmente — pendiente token CVA para despacho automático</span>`)
            : ''}
        </div>
      </div>
    </div>`;

  addLog('ok', `Pedido CVA: ${data.pedido}`,
    `${fmt(totMXN,'Pesos')} + flete ${fmt(fleteTot,'Pesos')} = ${fmt(grandTotal,'Pesos')} MXN`);

  // ── Enviar guía a CVA si es SF y hay datos de guía ──────────
  if (!test && tipo_flete === 'SF') {
    const noGuia  = document.getElementById('guia-numero')?.value.trim() || '';
    const carrier = document.getElementById('guia-carrier')?.value || 'DHL';
    const sinGuia = !noGuia; // ← pedido creado pero sin guía todavía

    if (noGuia) {
      if (_tieneTokenGuias()) {
        // Token activo → enviar a CVA inmediatamente
        try {
          const guiaRes = await apiPost('cva_enviar_guia', {
            order_number: data.pedido,
            waybills    : noGuia,
            carrier     : carrier,
            pdf_base64  : _guiaPdfBase64 || '',
          });
          if (guiaRes.ok) {
            addLog('ok', `Guía enviada a CVA: ${data.pedido}`, `${carrier} · ${noGuia}`);
            // Agregar al desglose visual
            const guiaStatus = el.querySelector('.guia-status');
            if (guiaStatus) guiaStatus.innerHTML =
              `<span style="color:var(--green-lt)">✓ Guía enviada a CVA — ${carrier} ${noGuia}</span>`;
          } else {
            addLog('warn', 'Guía registrada localmente (error CVA)', guiaRes.error || '');
          }
        } catch(ge) {
          addLog('warn', 'Guía no enviada a CVA', ge.message);
        }
      } else {
        // Sin token → guardar localmente como pendiente
        addLog('warn', 'Guía pendiente de envío a CVA', `${carrier} · ${noGuia} — activa el token CVA`);
      }

      // Siempre registrar localmente en PEDIDOS_GUIAS
      apiPost('registrar_pedido', {
        orden_cva    : data.pedido,
        carrier      : carrier,
        no_guia      : noGuia,
        guia_enviada : _tieneTokenGuias(),
        pdf_base64   : _guiaPdfBase64 || null,
        pdf_nombre   : _guiaPdfNombre || null,
        observaciones: document.getElementById('observaciones')?.value || '',
        fecha        : new Date().toLocaleDateString('es-MX'),
      }).catch(() => {});
    } else {
      // Sin guía — registrar igualmente como "esperando guía"
      addLog('warn', `Pedido ${data.pedido} creado sin guía`, 'Pendiente de guía para despacho');
      apiPost('registrar_pedido', {
        orden_cva    : data.pedido,
        carrier      : '',
        no_guia      : '',
        guia_enviada : false,
        sin_guia     : true,
        pdf_base64   : null,
        pdf_nombre   : null,
        observaciones: document.getElementById('observaciones')?.value || '',
        fecha        : new Date().toLocaleDateString('es-MX'),
      }).catch(() => {});
      // Mostrar aviso en la confirmación
      const ordenResult = document.getElementById('orden-result');
      const aviso = ordenResult?.querySelector('.guia-status');
      if (aviso) aviso.innerHTML = `
        <div style="margin-top:10px;padding:10px 14px;background:rgba(200,151,58,0.1);border:1px solid rgba(200,151,58,0.3);border-radius:2px">
          <span style="color:var(--orange);font-size:11px;font-weight:600;letter-spacing:1px">⏳ ESPERANDO GUÍA</span>
          <div style="color:var(--muted);font-size:11px;margin-top:4px">El pedido está en CVA. Ve a <strong style="color:var(--text)">Pedidos CVA</strong> cuando tengas la guía para agregarla y despachar.</div>
        </div>`;
    }
  }

  // Enviar email de confirmación (solo en pedidos reales)
  if (!test) {
    const correosInput = document.getElementById('correos-confirmacion')?.value || '';
    const correosArr = correosInput.split(',').map(c => c.trim()).filter(Boolean);
    apiPost('enviar_confirmacion_pedido', {
      pedido     : data.pedido,
      subtotal   : subMXN,
      iva        : ivaMXN,
      total_prod : totMXN,
      flete_sub  : fleteSub,
      flete_iva  : fleteIva,
      flete_total: fleteTot,
      cajas      : cajas,
      grand_total: grandTotal,
      moneda     : 'Pesos',
      tc         : tcVal,
      email_agente : data.email_agente  || '',
      email_almacen: data.email_almacen || '',
      correos    : correosArr,
      productos  : carrito.map(i => ({ clave: i.clave, desc: i.desc, qty: i.qty, precio: i.precio, moneda: i.moneda })),
      num_oc     : document.getElementById('num-oc')?.value || '',
      sucursal   : document.getElementById('f-sucursal')?.options[document.getElementById('f-sucursal')?.selectedIndex]?.text || '',
    }).catch(e => console.warn('Email confirmación:', e.message));

    carrito=[]; guardarCarrito(); renderCarrito();
    // Limpiar campos de guía para próxima orden
    _guiaPdfBase64 = null; _guiaPdfNombre = null;
    const gnEl = document.getElementById('guia-numero');
    if (gnEl) gnEl.value = '';
    const gpLabel = document.getElementById('guia-pdf-label');
    if (gpLabel) gpLabel.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="vertical-align:middle;margin-right:6px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Subir PDF — o arrastra aquí';
    const gpInfo = document.getElementById('guia-pdf-info');
    if (gpInfo) gpInfo.textContent = '';
  }
}
function enviarOrdenTest() { enviarOrden(true); }

// ── SUCURSALES CVA — carga dinámica + sugerencia por stock ─────────────────
// Cache para no repetir el fetch en cada visita a la página
let _sucursalesCache = null;

/**
 * Carga las sucursales reales desde CVA y llena el select #f-sucursal.
 * Solo hace fetch la primera vez; después usa el cache.
 */
async function cargarSucursalesSelect() {
  const sel = document.getElementById('f-sucursal');
  if (!sel) return;

  if (_sucursalesCache) {
    _poblarSelectSucursales(sel, _sucursalesCache);
    return;
  }

  try {
    const data = await apiConFallback('cva_sucursales');
    if (!data.ok || !data.sucursales?.length) {
      sel.innerHTML = '<option value="1">GUADALAJARA (1) — default</option>';
      return;
    }
    _sucursalesCache = data.sucursales;
    _poblarSelectSucursales(sel, _sucursalesCache);
    addLog('ok', 'Sucursales CVA cargadas', `${_sucursalesCache.length} opciones`);
  } catch(e) {
    sel.innerHTML = '<option value="1">GUADALAJARA (1) — default</option>';
    console.warn('cargarSucursalesSelect:', e.message);
  }
}

function _poblarSelectSucursales(sel, sucursales) {
  sel.innerHTML = '';
  sucursales.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.clave;
    opt.textContent = `${s.nombre} (${s.clave})`;
    if (String(s.clave) === '1') opt.selected = true;
    sel.appendChild(opt);
  });
}

/**
 * Repuebla el select con stock real por sucursal.
 * Muestra primero las que tienen stock (con cantidad), luego las sin stock en gris.
 * Preselecciona la de mayor stock automáticamente.
 *
 * stockMap: { "GUADALAJARA": 45, "CEDIS GUADALAJARA": 12, ... }
 *   — claves normalizadas (sin "VENTAS ") mapeadas a su stock total del carrito
 */
function _poblarSelectConStock(sel, sucursalesCache, stockMap) {
  // normalizar nombre del catálogo para buscar en stockMap
  const norm = s => s.toUpperCase()
    .replace('VENTAS ', '')
    .replace('CENTRO DE DISTRIBUCION', 'CEDIS')
    .trim();

  // Enriquecer cada sucursal con su stock conocido
  const enriquecidas = sucursalesCache.map(s => {
    const key  = norm(s.nombre);
    // buscar en stockMap por coincidencia exacta o parcial
    let stock  = stockMap[key] || 0;
    if (!stock) {
      // intento por coincidencia parcial
      const match = Object.entries(stockMap).find(([k]) =>
        k.includes(key) || key.includes(k)
      );
      if (match) stock = match[1];
    }
    return { ...s, stock };
  });

  // Ordenar: con stock desc, sin stock al final
  enriquecidas.sort((a, b) => {
    if (a.stock > 0 && b.stock === 0) return -1;
    if (a.stock === 0 && b.stock > 0) return 1;
    return b.stock - a.stock;
  });

  sel.innerHTML = '';
  let primeraConStock = null;

  enriquecidas.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.clave;
    if (s.stock > 0) {
      opt.textContent = `${s.nombre}  ·  ${s.stock} uds (${s.clave})`;
      if (!primeraConStock) primeraConStock = opt;
    } else {
      opt.textContent = `${s.nombre} — sin stock (${s.clave})`;
      opt.style.color = 'rgba(238,240,240,0.25)';
    }
    sel.appendChild(opt);
  });

  // Preseleccionar la de mayor stock
  if (primeraConStock) primeraConStock.selected = true;

  return primeraConStock ? enriquecidas.find(s => String(s.clave) === String(primeraConStock.value)) : null;
}

// Botón ↻ Recargar — limpia cache y vuelve a cargar sucursales con sugerencia
async function recargarSucursales() {
  _sucursalesCache = null; // forzar re-fetch
  const hint = document.getElementById('sucursal-hint');
  if (hint) hint.textContent = '⟳ Recargando...';
  const sel = document.getElementById('f-sucursal');
  if (sel) sel.innerHTML = '<option value="">Cargando...</option>';
  await iniciarPaginaOrden();
}

/**
 * Al entrar a la página de Orden: carga sucursales base y luego
 * consulta stock real por sucursal para cada producto del carrito.
 */
async function iniciarPaginaOrden() {
  await cargarSucursalesSelect();
  if (carrito.length === 0) return;
  sugerirSucursalPorStock();
}

async function sugerirSucursalPorStock() {
  const hint = document.getElementById('sucursal-hint');
  const sel  = document.getElementById('f-sucursal');
  if (!hint || !sel || carrito.length === 0) return;

  hint.textContent = '⟳ Consultando stock por almacén…';

  // Acumular stock por nombre normalizado
  // Clave: nombre normalizado (sin "VENTAS ", sin "CEDIS ")
  // Valor: stock total de todos los productos del carrito en ese almacén
  const stockMap = {}; // { "GUADALAJARA": 12, "CEDIS GUADALAJARA": 45, ... }

  const norm = s => s.toUpperCase()
    .replace('VENTAS ', '')
    .replace('CENTRO DE DISTRIBUCION', 'CEDIS')
    .trim();

  try {
    const claves = [...new Set(carrito.map(i => i.clave))];
    for (let i = 0; i < claves.length; i += 4) {
      const chunk = claves.slice(i, i + 4);
      await Promise.all(chunk.map(async (clave) => {
        try {
          const data = await api('cva_producto', { clave, sucursales: 'true' });
          const suc  = data.producto?.disponibilidad_sucursales || [];
          suc.forEach(s => {
            if (!s.nombre || s.nombre === 'TOTAL') return;
            const key = norm(s.nombre);
            const qty = parseInt(s.disponible) || 0;
            stockMap[key] = (stockMap[key] || 0) + qty;
          });
        } catch(_) {}
      }));
    }
  } catch(e) {
    hint.textContent = '';
    return;
  }

  if (!_sucursalesCache) { hint.textContent = ''; return; }

  // Repoblar el select con stock real — devuelve la sucursal preseleccionada
  const ganadora = _poblarSelectConStock(sel, _sucursalesCache, stockMap);

  // Highlight temporal
  sel.classList.add('sucursal-sugerida');
  setTimeout(() => sel.classList.remove('sucursal-sugerida'), 3500);

  if (!ganadora) {
    hint.innerHTML = '<span style="color:var(--orange)">⚠ Sin stock en ningún almacén para los productos del carrito</span>';
    return;
  }

  const stockGanador = ganadora.stock;
  const esCedis = ganadora.nombre.toUpperCase().includes('CEDIS') ||
                  ganadora.nombre.toUpperCase().includes('CENTRO DE DIST');
  const tipoLabel = esCedis
    ? '<span style="color:var(--orange);font-size:9px;letter-spacing:1px;margin-left:4px">CEDIS</span>'
    : '<span style="color:var(--green-lt);font-size:9px;letter-spacing:1px;margin-left:4px">SUCURSAL</span>';

  const conStockCount = Object.values(stockMap).filter(v => v > 0).length;
  hint.innerHTML = `✓ Mejor opción: <strong>${ganadora.nombre}</strong>${tipoLabel} — ${stockGanador} uds · ${conStockCount} almacenes con stock`;

  addLog('ok',
    `Almacén sugerido: ${ganadora.nombre} (clave ${ganadora.clave})`,
    `${stockGanador} uds · ${esCedis ? 'CEDIS' : 'Sucursal'} · ${conStockCount} con stock`
  );
}

// ── CATÁLOGO ESTADOS / CIUDADES CVA ──────────────────────
const CVA_ESTADOS = [{"clave":"1","descripcion":"AGUASCALIENTES","ciudades":[{"clave":"1","descripcion":"AGUASCALIENTES"},{"clave":"2","descripcion":"ASIENTOS"},{"clave":"3","descripcion":"CALVILLO"},{"clave":"4","descripcion":"COSIO"},{"clave":"6","descripcion":"EL LLANO"},{"clave":"5","descripcion":"JESUS MARIA"},{"clave":"7","descripcion":"PABELLON DE ARTEAGA"},{"clave":"8","descripcion":"RINCON DE ROMOS"},{"clave":"9","descripcion":"SAN FRANCISCO DE LOS ROMO"},{"clave":"10","descripcion":"SAN JOSE DE GRACIA"},{"clave":"11","descripcion":"TEPEZALA"}]},{"clave":"2","descripcion":"BAJA CALIFORNIA NORTE","ciudades":[{"clave":"12","descripcion":"ENSENADA"},{"clave":"13","descripcion":"MEXICALI"},{"clave":"14","descripcion":"PLAYAS DE ROSARITO"},{"clave":"5782","descripcion":"SAN QUINTIN"},{"clave":"15","descripcion":"TECATE"},{"clave":"16","descripcion":"TIJUANA"}]},{"clave":"3","descripcion":"BAJA CALIFORNIA SUR","ciudades":[{"clave":"4261","descripcion":"CABO SAN LUCAS"},{"clave":"2681","descripcion":"CIUDAD CONSTITUCION"},{"clave":"18","descripcion":"COMONDU"},{"clave":"21","descripcion":"LA PAZ"},{"clave":"19","descripcion":"LORETO"},{"clave":"17","descripcion":"LOS CABOS"},{"clave":"20","descripcion":"MULEGE"},{"clave":"3761","descripcion":"SAN JOSE DEL CABO"}]},{"clave":"5","descripcion":"CHIAPAS","ciudades":[{"clave":"101","descripcion":"CHIAPA DE CORZO"},{"clave":"3681","descripcion":"COMITAN CHIAPAS"},{"clave":"108","descripcion":"COMITAN DE DOMINGUEZ"},{"clave":"156","descripcion":"SAN CRISTOBAL DE LAS CASAS"},{"clave":"169","descripcion":"TAPACHULA"},{"clave":"176","descripcion":"TONALA"},{"clave":"181","descripcion":"TUXTLA GUTIERREZ"}]},{"clave":"6","descripcion":"CHIHUAHUA","ciudades":[{"clave":"201","descripcion":"CAMARGO"},{"clave":"204","descripcion":"CHIHUAHUA"},{"clave":"2781","descripcion":"CIUDAD JUAREZ"},{"clave":"209","descripcion":"CUAUHTEMOC"},{"clave":"211","descripcion":"DELICIAS"},{"clave":"221","descripcion":"HIDALGO DEL PARRAL"},{"clave":"226","descripcion":"JUAREZ"},{"clave":"239","descripcion":"NUEVO CASAS GRANDES"}]},{"clave":"9","descripcion":"CIUDAD DE MEXICO","ciudades":[{"clave":"258","descripcion":"ALVARO OBREGON"},{"clave":"259","descripcion":"AZCAPOTZALCO"},{"clave":"260","descripcion":"BENITO JUAREZ"},{"clave":"261","descripcion":"COYOACAN"},{"clave":"262","descripcion":"CUAJIMALPA DE MORELOS"},{"clave":"263","descripcion":"CUAUHTEMOC"},{"clave":"264","descripcion":"GUSTAVO A. MADERO"},{"clave":"265","descripcion":"IZTACALCO"},{"clave":"266","descripcion":"IZTAPALAPA"},{"clave":"267","descripcion":"MAGDALENA CONTRERAS"},{"clave":"268","descripcion":"MIGUEL HIDALGO"},{"clave":"269","descripcion":"MILPA ALTA"},{"clave":"270","descripcion":"TLAHUAC"},{"clave":"271","descripcion":"TLALPAN"},{"clave":"272","descripcion":"VENUSTIANO CARRANZA"},{"clave":"273","descripcion":"XOCHIMILCO"}]},{"clave":"7","descripcion":"COAHUILA","ciudades":[{"clave":"33","descripcion":"ACUÑA"},{"clave":"34","descripcion":"ALLENDE"},{"clave":"41","descripcion":"FRONTERA"},{"clave":"49","descripcion":"MONCLOVA"},{"clave":"5862","descripcion":"NUEVA ROSITA"},{"clave":"56","descripcion":"PIEDRAS NEGRAS"},{"clave":"58","descripcion":"RAMOS ARIZPE"},{"clave":"59","descripcion":"SABINAS"},{"clave":"61","descripcion":"SALTILLO"},{"clave":"64","descripcion":"SAN PEDRO"},{"clave":"66","descripcion":"TORREON"}]},{"clave":"8","descripcion":"COLIMA","ciudades":[{"clave":"71","descripcion":"COLIMA"},{"clave":"72","descripcion":"COMALA"},{"clave":"76","descripcion":"MANZANILLO"},{"clave":"78","descripcion":"TECOMAN"},{"clave":"79","descripcion":"VILLA DE ALVAREZ"}]},{"clave":"10","descripcion":"DURANGO","ciudades":[{"clave":"278","descripcion":"DURANGO"},{"clave":"279","descripcion":"GOMEZ PALACIO"},{"clave":"280","descripcion":"GUADALUPE VICTORIA"},{"clave":"284","descripcion":"LERDO"},{"clave":"6262","descripcion":"VICTORIA DE DURANGO"}]},{"clave":"11","descripcion":"ESTADO DE MEXICO","ciudades":[{"clave":"648","descripcion":"ALMOLOYA DE JUAREZ"},{"clave":"652","descripcion":"AMECAMECA"},{"clave":"656","descripcion":"ATIZAPAN DE ZARAGOZA"},{"clave":"663","descripcion":"CHALCO"},{"clave":"669","descripcion":"CHIMALHUACAN"},{"clave":"670","descripcion":"COACALCO DE BERRIOZABAL"},{"clave":"674","descripcion":"CUAUTITLAN"},{"clave":"675","descripcion":"CUAUTITLAN IZCALLI"},{"clave":"677","descripcion":"ECATEPEC DE MORELOS"},{"clave":"679","descripcion":"HUEHUETOCA"},{"clave":"681","descripcion":"HUIXQUILUCAN"},{"clave":"683","descripcion":"IXTAPALUCA"},{"clave":"698","descripcion":"METEPEC"},{"clave":"701","descripcion":"NAUCALPAN DE JUAREZ"},{"clave":"703","descripcion":"NEZAHUALCOYOTL"},{"clave":"704","descripcion":"NICOLAS ROMERO"},{"clave":"726","descripcion":"TECAMAC"},{"clave":"740","descripcion":"TEPOTZOTLAN"},{"clave":"751","descripcion":"TOLUCA"},{"clave":"754","descripcion":"TULTEPEC"},{"clave":"755","descripcion":"TULTITLAN"},{"clave":"757","descripcion":"VALLE DE CHALCO SOLIDARIDAD"},{"clave":"768","descripcion":"ZUMPANGO"}]},{"clave":"12","descripcion":"GUANAJUATO","ciudades":[{"clave":"314","descripcion":"ACAMBARO"},{"clave":"318","descripcion":"CELAYA"},{"clave":"321","descripcion":"CORTAZAR"},{"clave":"324","descripcion":"DOLORES HIDALGO"},{"clave":"325","descripcion":"GUANAJUATO"},{"clave":"327","descripcion":"IRAPUATO"},{"clave":"330","descripcion":"LEON"},{"clave":"338","descripcion":"SALAMANCA"},{"clave":"339","descripcion":"SALVATIERRA"},{"clave":"345","descripcion":"SAN MIGUEL DE ALLENDE"},{"clave":"349","descripcion":"SILAO"}]},{"clave":"13","descripcion":"GUERRERO","ciudades":[{"clave":"359","descripcion":"ACAPULCO DE JUAREZ"},{"clave":"370","descripcion":"ATOYAC DE ALVAREZ"},{"clave":"376","descripcion":"CHILPANCINGO DE LOS BRAVO"},{"clave":"395","descripcion":"IGUALA DE LA INDEPENDENCIA"},{"clave":"398","descripcion":"JOSE AZUETA"},{"clave":"417","descripcion":"TAXCO DE ALARCON"},{"clave":"3381","descripcion":"ZIHUATANEJO"}]},{"clave":"14","descripcion":"HIDALGO","ciudades":[{"clave":"438","descripcion":"ACTOPAN"},{"clave":"443","descripcion":"APAN"},{"clave":"447","descripcion":"ATOTONILCO DE TULA"},{"clave":"3321","descripcion":"CIUDAD SAHAGUN"},{"clave":"463","descripcion":"HUEJUTLA DE REYES"},{"clave":"465","descripcion":"IXMIQUILPAN"},{"clave":"3101","descripcion":"PACHUCA"},{"clave":"481","descripcion":"PACHUCA DE SOTO"},{"clave":"498","descripcion":"TEPEJI DEL RIO DE OCAMPO"},{"clave":"510","descripcion":"TULA DE ALLENDE"},{"clave":"511","descripcion":"TULANCINGO DE BRAVO"}]},{"clave":"15","descripcion":"JALISCO","ciudades":[{"clave":"533","descripcion":"AUTLAN DE NAVARRO"},{"clave":"541","descripcion":"CHAPALA"},{"clave":"544","descripcion":"CIHUATLAN"},{"clave":"2461","descripcion":"CIUDAD GUZMAN"},{"clave":"553","descripcion":"ENCARNACION DE DIAZ"},{"clave":"558","descripcion":"GUADALAJARA"},{"clave":"536","descripcion":"LA BARCA"},{"clave":"572","descripcion":"LAGOS DE MORENO"},{"clave":"581","descripcion":"OCOTLAN"},{"clave":"585","descripcion":"PUERTO VALLARTA"},{"clave":"601","descripcion":"SAYULA"},{"clave":"612","descripcion":"TEPATITLAN DE MORELOS"},{"clave":"613","descripcion":"TEQUILA"},{"clave":"616","descripcion":"TLAJOMULCO DE ZUNIGA"},{"clave":"617","descripcion":"TLAQUEPAQUE"},{"clave":"620","descripcion":"TONALA"},{"clave":"626","descripcion":"TUXCUECA"},{"clave":"627","descripcion":"TUXPAN"},{"clave":"638","descripcion":"ZAPOPAN"},{"clave":"642","descripcion":"ZAPOTLAN EL GRANDE"},{"clave":"643","descripcion":"ZAPOTLANEJO"}]},{"clave":"16","descripcion":"MICHOACAN","ciudades":[{"clave":"774","descripcion":"APATZINGAN"},{"clave":"807","descripcion":"HUETAMO"},{"clave":"839","descripcion":"LA PIEDAD"},{"clave":"819","descripcion":"LAZARO CARDENAS"},{"clave":"821","descripcion":"MARAVATIO"},{"clave":"823","descripcion":"MORELIA"},{"clave":"836","descripcion":"PATZCUARO"},{"clave":"845","descripcion":"SAHUAYO"},{"clave":"871","descripcion":"URUAPAN"},{"clave":"877","descripcion":"ZAMORA"},{"clave":"881","descripcion":"ZITACUARO"}]},{"clave":"17","descripcion":"MORELOS","ciudades":[{"clave":"884","descripcion":"AXOCHIAPAN"},{"clave":"887","descripcion":"CUAUTLA"},{"clave":"888","descripcion":"CUERNAVACA"},{"clave":"892","descripcion":"JIUTEPEC"},{"clave":"893","descripcion":"JOJUTLA"},{"clave":"898","descripcion":"PUENTE DE IXTLA"},{"clave":"899","descripcion":"TEMIXCO"},{"clave":"911","descripcion":"YAUTEPEC"}]},{"clave":"18","descripcion":"NAYARIT","ciudades":[{"clave":"915","descripcion":"ACAPONETA"},{"clave":"919","descripcion":"COMPOSTELA"},{"clave":"922","descripcion":"IXTLAN DEL RIO"},{"clave":"5902","descripcion":"NUEVO VALLARTA"},{"clave":"929","descripcion":"SANTIAGO IXCUINTLA"},{"clave":"931","descripcion":"TEPIC"}]},{"clave":"19","descripcion":"NUEVO LEON","ciudades":[{"clave":"939","descripcion":"APODACA"},{"clave":"4121","descripcion":"BENITO JUAREZ"},{"clave":"942","descripcion":"CADEREYTA JIMENEZ"},{"clave":"951","descripcion":"GARCIA"},{"clave":"953","descripcion":"GRAL. ESCOBEDO"},{"clave":"958","descripcion":"GUADALUPE"},{"clave":"963","descripcion":"JUAREZ"},{"clave":"973","descripcion":"MONTEMORELOS"},{"clave":"974","descripcion":"MONTERREY"},{"clave":"976","descripcion":"PESQUERIA"},{"clave":"978","descripcion":"SABINAS HIDALGO"},{"clave":"980","descripcion":"SAN NICOLAS DE LOS GARZA"},{"clave":"981","descripcion":"SAN PEDRO GARZA GARCIA"},{"clave":"982","descripcion":"SANTA CATARINA"},{"clave":"983","descripcion":"SANTIAGO"}]},{"clave":"20","descripcion":"OAXACA","ciudades":[{"clave":"1024","descripcion":"HUAJUAPAN"},{"clave":"3341","descripcion":"HUAJUAPAN DE LEON"},{"clave":"1029","descripcion":"IXTLAN DE JUAREZ"},{"clave":"1030","descripcion":"JUCHITAN DE ZARAGOZA"},{"clave":"1031","descripcion":"LOMA BONITA"},{"clave":"1044","descripcion":"MATIAS ROMERO AVENDANO"},{"clave":"1054","descripcion":"OAXACA DE JUAREZ"},{"clave":"1055","descripcion":"OCOTLAN DE MORELOS"},{"clave":"1064","descripcion":"SALINA CRUZ"},{"clave":"3981","descripcion":"SAN JUAN BAUTISTA TUXTEPEC"}]},{"clave":"21","descripcion":"PUEBLA","ciudades":[{"clave":"1542","descripcion":"ACATZINGO"},{"clave":"1553","descripcion":"AMOZOC"},{"clave":"1558","descripcion":"ATLIXCO"},{"clave":"1570","descripcion":"CHALCHICOMULA DE SESMA"},{"clave":"1578","descripcion":"CHIGNAHUAPAN"},{"clave":"3143","descripcion":"CIUDAD SERDAN"},{"clave":"1595","descripcion":"CUAUTLANCINGO"},{"clave":"1597","descripcion":"CUETZALAN DEL PROGRESO"},{"clave":"1611","descripcion":"HUAUCHINANGO"},{"clave":"1625","descripcion":"IZUCAR DE MATAMOROS"},{"clave":"1653","descripcion":"PUEBLA"},{"clave":"1671","descripcion":"SAN MARTIN TEXMELUCAN"},{"clave":"1679","descripcion":"SAN PEDRO CHOLULA"},{"clave":"1692","descripcion":"TECAMACHALCO"},{"clave":"1694","descripcion":"TEHUACAN"},{"clave":"1712","descripcion":"TEZIUTLAN"}]},{"clave":"22","descripcion":"QUERETARO","ciudades":[{"clave":"1757","descripcion":"ARROYO SECO"},{"clave":"1758","descripcion":"CADEREYTA DE MONTES"},{"clave":"1760","descripcion":"CORREGIDORA"},{"clave":"1761","descripcion":"EL MARQUES"},{"clave":"1766","descripcion":"PEDRO ESCOBEDO"},{"clave":"1769","descripcion":"QUERETARO"},{"clave":"1771","descripcion":"SAN JUAN DEL RIO"},{"clave":"2561","descripcion":"SANTIAGO DE QUERETARO"},{"clave":"1772","descripcion":"TEQUISQUIAPAN"}]},{"clave":"23","descripcion":"QUINTANA ROO","ciudades":[{"clave":"1774","descripcion":"BENITO JUAREZ"},{"clave":"2881","descripcion":"CANCUN"},{"clave":"2861","descripcion":"CHETUMAL"},{"clave":"1775","descripcion":"COZUMEL"},{"clave":"1776","descripcion":"FELIPE CARRILLO PUERTO"},{"clave":"1777","descripcion":"ISLA MUJERES"},{"clave":"1780","descripcion":"OTHON P. BLANCO"},{"clave":"2701","descripcion":"PLAYA DEL CARMEN"},{"clave":"1781","descripcion":"SOLIDARIDAD"},{"clave":"5362","descripcion":"TULUM"}]},{"clave":"24","descripcion":"SAN LUIS POTOSI","ciudades":[{"clave":"1790","descripcion":"CERRITOS"},{"clave":"1795","descripcion":"CIUDAD VALLES"},{"clave":"1797","descripcion":"EBANO"},{"clave":"1802","descripcion":"MATEHUALA"},{"clave":"1807","descripcion":"RIOVERDE"},{"clave":"1811","descripcion":"SAN LUIS POTOSI"},{"clave":"1818","descripcion":"SOLEDAD DE GRACIANO SANCHEZ"},{"clave":"1820","descripcion":"TAMAZUNCHALE"},{"clave":"1823","descripcion":"TAMUIN"}]},{"clave":"25","descripcion":"SINALOA","ciudades":[{"clave":"1840","descripcion":"AHOME"},{"clave":"1846","descripcion":"CULIACAN"},{"clave":"6482","descripcion":"CULIACAN DE ROSALES"},{"clave":"1848","descripcion":"ESCUINAPA"},{"clave":"2542","descripcion":"GUAMUCHIL"},{"clave":"1850","descripcion":"GUASAVE"},{"clave":"2543","descripcion":"LOS MOCHIS"},{"clave":"1851","descripcion":"MAZATLAN"},{"clave":"1853","descripcion":"NAVOLATO"}]},{"clave":"26","descripcion":"SONORA","ciudades":[{"clave":"1859","descripcion":"AGUA PRIETA"},{"clave":"1875","descripcion":"CABORCA"},{"clave":"1876","descripcion":"CAJEME"},{"clave":"1877","descripcion":"CANANEA"},{"clave":"3521","descripcion":"CIUDAD OBREGON"},{"clave":"1883","descripcion":"EMPALME"},{"clave":"1884","descripcion":"ETCHOJOA"},{"clave":"1888","descripcion":"GUAYMAS"},{"clave":"1889","descripcion":"HERMOSILLO"},{"clave":"1892","descripcion":"HUATABAMPO"},{"clave":"1895","descripcion":"MAGDALENA"},{"clave":"1901","descripcion":"NAVOJOA"},{"clave":"1902","descripcion":"NOGALES"},{"clave":"1915","descripcion":"SAN LUIS RIO COLORADO"}]},{"clave":"27","descripcion":"TABASCO","ciudades":[{"clave":"1930","descripcion":"BALANCAN"},{"clave":"1931","descripcion":"CARDENAS"},{"clave":"1934","descripcion":"COMALCALCO"},{"clave":"1935","descripcion":"CUNDUACAN"},{"clave":"1937","descripcion":"HUIMANGUILLO"},{"clave":"1941","descripcion":"MACUSPANA"},{"clave":"1943","descripcion":"PARAISO"},{"clave":"2501","descripcion":"VILLAHERMOSA"}]},{"clave":"28","descripcion":"TAMAULIPAS","ciudades":[{"clave":"1949","descripcion":"ALTAMIRA"},{"clave":"1953","descripcion":"CAMARGO"},{"clave":"1955","descripcion":"CIUDAD MADERO"},{"clave":"2762","descripcion":"CIUDAD MANTE"},{"clave":"2761","descripcion":"CIUDAD VICTORIA"},{"clave":"1968","descripcion":"MATAMOROS"},{"clave":"1971","descripcion":"MIGUEL ALEMAN"},{"clave":"1973","descripcion":"NUEVO LAREDO"},{"clave":"1978","descripcion":"REYNOSA"},{"clave":"1979","descripcion":"RIO BRAVO"},{"clave":"1981","descripcion":"SAN FERNANDO"},{"clave":"1984","descripcion":"TAMPICO"},{"clave":"1987","descripcion":"VICTORIA"}]},{"clave":"29","descripcion":"TLAXCALA","ciudades":[{"clave":"1994","descripcion":"APIZACO"},{"clave":"1999","descripcion":"CHIAUTEMPAN"},{"clave":"2005","descripcion":"HUAMANTLA"},{"clave":"2039","descripcion":"TLAXCALA"}]},{"clave":"30","descripcion":"VERACRUZ","ciudades":[{"clave":"2052","descripcion":"ACAYUCAN"},{"clave":"2060","descripcion":"ALVARADO"},{"clave":"2075","descripcion":"BOCA DEL RIO"},{"clave":"2082","descripcion":"CATEMACO"},{"clave":"2099","descripcion":"COATEPEC"},{"clave":"2100","descripcion":"COATZACOALCOS"},{"clave":"2105","descripcion":"CORDOBA"},{"clave":"2106","descripcion":"COSAMALOAPAN"},{"clave":"2109","descripcion":"COSOLEACAQUE"},{"clave":"2118","descripcion":"FORTIN"},{"clave":"2122","descripcion":"HUATUSCO"},{"clave":"2139","descripcion":"JALTIPAN"},{"clave":"2152","descripcion":"MARTINEZ DE LA TORRE"},{"clave":"2158","descripcion":"MINATITLAN"},{"clave":"2159","descripcion":"MISANTLA"},{"clave":"2170","descripcion":"ORIZABA"},{"clave":"2175","descripcion":"PANUCO"},{"clave":"2176","descripcion":"PAPANTLA"},{"clave":"2921","descripcion":"POZA RICA"},{"clave":"2183","descripcion":"POZA RICA DE HIDALGO"},{"clave":"2192","descripcion":"SAN ANDRES TUXTLA"},{"clave":"2226","descripcion":"TIERRA BLANCA"},{"clave":"2243","descripcion":"TUXPAN"},{"clave":"2248","descripcion":"VERACRUZ"},{"clave":"2251","descripcion":"XALAPA"}]},{"clave":"31","descripcion":"YUCATAN","ciudades":[{"clave":"2277","descripcion":"CHEMAX"},{"clave":"2301","descripcion":"IZAMAL"},{"clave":"2302","descripcion":"KANASIN"},{"clave":"2311","descripcion":"MERIDA"},{"clave":"2313","descripcion":"MOTUL"},{"clave":"2317","descripcion":"OXKUTZCAB"},{"clave":"2320","descripcion":"PROGRESO"},{"clave":"2350","descripcion":"TICUL"},{"clave":"2357","descripcion":"TIZIMIN"},{"clave":"2363","descripcion":"VALLADOLID"}]},{"clave":"32","descripcion":"ZACATECAS","ciudades":[{"clave":"2372","descripcion":"CALERA"},{"clave":"2378","descripcion":"FRESNILLO"},{"clave":"2383","descripcion":"GUADALUPE"},{"clave":"2385","descripcion":"JALPA"},{"clave":"2386","descripcion":"JEREZ"},{"clave":"2390","descripcion":"LORETO"},{"clave":"2405","descripcion":"RIO GRANDE"},{"clave":"2409","descripcion":"SOMBRERETE"},{"clave":"2425","descripcion":"ZACATECAS"}]}];

function poblarSelectEstados() {
  const sel = document.getElementById('f-estado');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Seleccionar estado —</option>';
  CVA_ESTADOS.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.clave; opt.textContent = e.descripcion;
    sel.appendChild(opt);
  });
}

function onEstadoChange() {
  const estadoId   = document.getElementById('f-estado').value;
  const selCiudad  = document.getElementById('f-ciudad');
  selCiudad.innerHTML = '<option value="">— Seleccionar ciudad —</option>';
  selCiudad.disabled  = !estadoId;
  if (!estadoId) return;
  const estado = CVA_ESTADOS.find(e => e.clave === estadoId);
  if (!estado) return;
  (estado.ciudades || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.clave; opt.textContent = c.descripcion;
    selCiudad.appendChild(opt);
  });
}

function toggleFleteFields() {
  const tipo = document.getElementById('tipo-flete').value;
  // SF = guía propia → no se necesita dirección CVA
  document.getElementById('flete-fields').style.display = tipo === 'SF' ? 'none' : 'block';
  // Mostrar aviso de token si aplica
  const aviso = document.getElementById('guia-token-aviso');
  if (aviso) aviso.style.display = _tieneTokenGuias() ? 'none' : 'flex';
}

// ── GUÍA EN CHECKOUT ─────────────────────────────────────────
// Estado del PDF de guía en el checkout
let _guiaPdfBase64 = null;
let _guiaPdfNombre = null;

// ¿Tenemos token de guías CVA? (se activa cuando CVA lo proporcione)
// Token CVA guías activo — f4c9a82170abde56c1ef9287bd4036a91
function _tieneTokenGuias() {
  return true;
}

function handleGuiaFileSelect(e) {
  const file = e.target.files[0];
  if (file) _procesarGuiaPDF(file);
}
function handleGuiaDrop(e) {
  e.preventDefault();
  const dz = document.getElementById('guia-dropzone');
  if (dz) { dz.style.borderColor = 'var(--green-lt)'; dz.style.background = 'rgba(0,102,94,0.08)'; }
  const file = e.dataTransfer.files[0];
  if (file) _procesarGuiaPDF(file);
}
function _procesarGuiaPDF(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Solo se aceptan archivos PDF');
    return;
  }
  _guiaPdfNombre = file.name;
  const dz = document.getElementById('guia-dropzone');
  if (dz) { dz.style.borderColor = 'var(--green-lt)'; dz.style.background = 'rgba(0,102,94,0.06)'; }
  document.getElementById('guia-pdf-label').innerHTML =
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:middle;margin-right:6px;color:var(--green-lt)"><polyline points="20 6 9 17 4 12"/></svg>` +
    `<span style="color:var(--green-lt)">${file.name}</span> <span style="opacity:0.4">(${(file.size/1024).toFixed(0)} KB)</span>`;
  document.getElementById('guia-pdf-info').innerHTML =
    '<span style="color:var(--green-lt)">✓ PDF adjunto — CVA podrá imprimir la etiqueta</span>';
  const reader = new FileReader();
  reader.onload = ev => { _guiaPdfBase64 = ev.target.result.split(',')[1]; };
  reader.readAsDataURL(file);
}

// ── PEDIDOS ───────────────────────────────────────────────
let pedidosData = [];
let pdfBase64 = null, pdfNombre = null, editandoIdx = null;

// ── SALDO CVA ─────────────────────────────────────────────────
async function cargarSaldo() {
  const badge = document.getElementById('badge-saldo');
  if (!badge) return;
  try {
    const data = await api('cva_saldo');
    if (data.ok) {
      // CVA puede devolver: saldo_disponible, saldo, credito_disponible, limite_credito, etc.
      const saldo = parseFloat(
        data.saldo_disponible ?? data.saldo ?? data.credito_disponible ??
        data.limite_credito ?? data.disponible ?? data.monto ?? -1
      );
      if (saldo >= 0) {
        const saldoFmt = saldo.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
        badge.textContent = saldoFmt;
        badge.className = 'badge ' + (saldo > 1000 ? 'badge-green' : saldo > 0 ? 'badge-silver' : 'badge-red');
        badge.title = 'Saldo CVA: ' + saldoFmt;
        addLog('ok', 'Saldo CVA', saldoFmt);
      } else {
        // Endpoint existe pero estructura desconocida — log para debug
        badge.textContent = 'Saldo';
        badge.title = 'Respuesta CVA: ' + JSON.stringify(data).substring(0, 120);
        addLog('warn', 'Saldo CVA — estructura inesperada', JSON.stringify(data).substring(0, 100));
      }
    } else {
      badge.textContent = 'Saldo';
      badge.title = 'Saldo no disponible: ' + (data.error || '');
    }
  } catch(e) {
    badge.textContent = 'Saldo —';
  }
}

async function cargarPedidos() {
  const el = document.getElementById('pedidos-result');
  loading(el);

  // Cargar locales siempre — son la fuente primaria
  const locales = await api('pedidos_locales');
  const locList = (locales.pedidos || []);

  // Intentar enriquecer con datos de CVA (puede fallar sin crédito activo)
  let cvaList = [];
  try {
    const data = await api('cva_pedidos');
    if (data.ok) cvaList = data.pedidos || [];
  } catch(_) {}

  // Merge: locales como base, CVA enriquece si hay match
  const cvaMap = {};
  cvaList.forEach(p => { cvaMap[p.Numero] = p; });

  // Pedidos locales con datos CVA si existen
  const locMerged = locList.map(p => ({
    ...( cvaMap[p.orden_cva] || {} ),
    ...p,
    Numero: p.orden_cva || p.Numero,
    _local: true,
  }));

  // Pedidos CVA que no están en locales (creados por otro medio)
  const locClaves = new Set(locList.map(p => p.orden_cva).filter(Boolean));
  const soloEnCVA = cvaList
    .filter(p => !locClaves.has(p.Numero))
    .map(p => ({ ...p, _cva: true }));

  pedidosData = [...locMerged, ...soloEnCVA]
    .sort((a, b) => {
      const fa = a.fecha || a.FechaAsignado || '';
      const fb = b.fecha || b.FechaAsignado || '';
      return fb.localeCompare(fa);
    });

  renderTablaPedidos();
}

function renderTablaPedidos() {
  const el     = document.getElementById('pedidos-result');
  const filtro = (document.getElementById('p-buscar')?.value || '').toLowerCase();
  const lista  = filtro ? pedidosData.filter(p => JSON.stringify(p).toLowerCase().includes(filtro)) : pedidosData;
  if (lista.length === 0) { alert_(el, 'Sin pedidos', 'warn'); return; }
  el.innerHTML = `
    <div class="table-wrap"><table>
      <tr><th>Nuestra Orden</th><th>No Orden CVA</th><th>Tienda</th><th>Carrier</th><th>No Guía</th><th>Guía Enviada</th><th>Fecha</th><th>Estatus</th><th></th></tr>
      ${lista.map((p,i) => {
        const sinGuia = !p.no_guia;
        const rowBg = sinGuia ? ' style="background:rgba(200,151,58,0.04);border-left:2px solid rgba(200,151,58,0.4)"' : '';
        const guiaCell = p.no_guia || '<span style="color:#C8973A;font-size:10px;letter-spacing:1px;font-weight:600">⏳ PENDIENTE</span>';
        const btnClass = sinGuia ? 'btn-primary' : 'btn-ghost';
        const btnStyle = sinGuia ? 'padding:4px 12px;font-size:10px;background:rgba(200,151,58,0.15);border-color:rgba(200,151,58,0.4);color:#C8973A' : 'padding:4px 12px;font-size:10px';
        const btnLabel = sinGuia ? '+ Agregar Guía' : 'Editar';
        return '<tr' + rowBg + '>'
          + '<td class="mono" style="font-size:11px">' + (p.nuestra_orden||'—') + '</td>'
          + '<td class="mono">' + (p.Numero||p.orden_cva||'—') + '</td>'
          + '<td style="color:var(--muted);font-size:12px">' + (p.tienda||'—') + '</td>'
          + '<td style="color:var(--muted);font-size:12px">' + (p.carrier||'—') + '</td>'
          + '<td class="mono" style="font-size:11px">' + guiaCell + '</td>'
          + '<td style="text-align:center;font-size:16px">' + (p.guia_enviada?'✓':'○') + '</td>'
          + '<td style="font-size:11px;color:var(--muted)">' + fmtFecha(p.FechaAsignado||p.fecha) + '</td>'
          + '<td><span class="status-' + (p.Asignado||'pendiente').toLowerCase() + '">' + (p.Asignado||'—') + '</span></td>'
          + '<td><button class="btn ' + btnClass + '" style="' + btnStyle + '" onclick="abrirModalPedido(' + i + ')">' + btnLabel + '</button></td>'
          + '</tr>';
      }).join('')}
    </table></div>`;
}

function filtrarPedidos() { renderTablaPedidos(); }

function abrirModalPedido(idx) {
  editandoIdx = idx; pdfBase64 = null; pdfNombre = null;
  const p = idx !== null ? pedidosData[idx] : {};
  document.getElementById('m-nuestra-orden').value   = p.nuestra_orden || '';
  document.getElementById('m-orden-cva').value       = p.Numero || p.orden_cva || '';
  document.getElementById('m-tienda').value          = p.tienda   || 'ML SV';
  document.getElementById('m-carrier').value         = p.carrier  || 'DHL';
  document.getElementById('m-guia').value            = p.no_guia  || '';
  document.getElementById('m-obs').value             = p.observaciones || '';
  document.getElementById('m-guia-enviada').checked  = !!p.guia_enviada;
  document.getElementById('m-pdf-label').textContent = 'Browse — Or drop PDF here';
  document.getElementById('m-pdf-info').textContent  = p.pdf_nombre ? '✓ ' + p.pdf_nombre : '';
  document.getElementById('modal-result').innerHTML  = '';
  document.getElementById('modal-overlay').style.display = 'flex';
  // Si no tiene guía, ir directo al campo y mostrar aviso
  if (!p.no_guia) {
    setTimeout(() => {
      document.getElementById('m-guia').focus();
      document.getElementById('modal-result').innerHTML =
        '<div style="padding:8px 12px;background:rgba(200,151,58,0.1);border:1px solid rgba(200,151,58,0.3);font-size:11px;color:var(--orange);margin-bottom:8px">⏳ Este pedido está en CVA esperando guía. Ingresa el número y guarda.</div>';
    }, 100);
  }
}
function cerrarModal() { document.getElementById('modal-overlay').style.display = 'none'; }
function handleFileSelect(e) { const file = e.target.files[0]; if (file) procesarPDF(file); }
function handleDrop(e) {
  e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
  const file = e.dataTransfer.files[0]; if (file) procesarPDF(file);
}
function procesarPDF(file) {
  pdfNombre = file.name;
  const dz = document.getElementById('m-pdf-dropzone');
  if (dz) { dz.style.borderColor = 'var(--green-lt)'; dz.style.background = 'rgba(0,102,94,0.06)'; }
  document.getElementById('m-pdf-label').innerHTML =
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:middle;margin-right:6px;color:var(--green-lt)"><polyline points="20 6 9 17 4 12"/></svg>` +
    `<span style="color:var(--green-lt)">${file.name}</span> <span style="opacity:0.4">(${(file.size/1024).toFixed(0)} KB)</span>`;
  document.getElementById('m-pdf-info').innerHTML =
    '<span style="color:var(--green-lt)">✓ PDF adjunto — CVA podrá imprimir la etiqueta</span>';
  const reader = new FileReader();
  reader.onload = e => { pdfBase64 = e.target.result.split(',')[1]; };
  reader.readAsDataURL(file);
}

async function registrarPedido() {
  const el = document.getElementById('modal-result');
  loading(el);
  const payload = {
    nuestra_orden: document.getElementById('m-nuestra-orden').value.trim(),
    orden_cva    : document.getElementById('m-orden-cva').value.trim(),
    tienda       : document.getElementById('m-tienda').value,
    carrier      : document.getElementById('m-carrier').value,
    no_guia      : document.getElementById('m-guia').value.trim(),
    observaciones: document.getElementById('m-obs').value.trim(),
    guia_enviada : document.getElementById('m-guia-enviada').checked,
    pdf_base64   : pdfBase64 || null,
    pdf_nombre   : pdfNombre || null,
    fecha        : new Date().toLocaleDateString('es-MX'),
  };
  if (!payload.orden_cva) { alert_(el, '✖ El No. Orden Proveedor (CVA) es requerido', 'error'); return; }
  const data = await apiPost('registrar_pedido', payload);
  if (!data.ok) { alert_(el, '✖ ' + data.error, 'error'); return; }
  alert_(el, '✓ Pedido registrado', 'success');
  if (editandoIdx !== null) pedidosData[editandoIdx] = { ...pedidosData[editandoIdx], ...payload };
  else pedidosData.unshift({ Numero: payload.orden_cva, ...payload });
  renderTablaPedidos();
  setTimeout(cerrarModal, 700);
}

async function enviarGuiaCVA() {
  const el           = document.getElementById('modal-result');
  const order_number = document.getElementById('m-orden-cva').value.trim();
  const waybills     = document.getElementById('m-guia').value.trim();
  const carrier      = document.getElementById('m-carrier').value;
  if (!order_number) { alert_(el, '✖ Ingresa el No. Orden CVA', 'error'); return; }
  if (!waybills)     { alert_(el, '✖ Ingresa el No. de Guía', 'error'); return; }
  loading(el);
  const data = await apiPost('cva_enviar_guia', { order_number, waybills, carrier, pdf_base64: pdfBase64 || '' });
  if (!data.ok) { alert_(el, '✖ ' + data.error, 'error'); return; }
  document.getElementById('m-guia-enviada').checked = true;
  alert_(el, `✓ Guía enviada — ${order_number} · ${waybills}`, 'success');
  await registrarPedido();
}

// ── SYNC ──────────────────────────────────────────────────
async function cargarEstadoSync() {
  const el = document.getElementById('sync-status-box');
  if (!el) return;
  el.innerHTML = '<span style="color:var(--muted);font-size:11px">Cargando estado...</span>';
  const data = await api('sync_status');
  if (!data.ok) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:rgba(0,102,94,0.1);border:1px solid rgba(0,102,94,0.2);padding:14px 16px">
        <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Próxima página</div>
        <div style="font-size:28px;font-family:'Barlow Condensed',sans-serif;font-weight:300;color:var(--text)">${data.pagina_actual}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">checkpoint actual</div>
      </div>
      <div style="background:rgba(38,41,48,0.8);border:1px solid rgba(238,240,240,0.08);padding:14px 16px">
        <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Registros SYNC_CVA</div>
        <div style="font-size:28px;font-family:'Barlow Condensed',sans-serif;font-weight:300;color:var(--text)">${data.registros_sync_cva.toLocaleString()}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">artículos en catálogo</div>
      </div>
      <div style="background:rgba(38,41,48,0.8);border:1px solid rgba(238,240,240,0.08);padding:14px 16px">
        <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Historial de stock</div>
        <div style="font-size:28px;font-family:'Barlow Condensed',sans-serif;font-weight:300;color:var(--text)">${data.registros_historial.toLocaleString()}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${data.fecha_inicio_historial?'desde '+data.fecha_inicio_historial:'sin datos aún'}</div>
      </div>
    </div>
    ${data.ultimo_sync_log?`<div style="font-size:11px;color:var(--muted);padding:8px 12px;background:rgba(238,240,240,0.03);border-left:2px solid rgba(238,240,240,0.1)">Último sync: ${data.ultimo_sync_log}</div>`:''}`;
  document.getElementById('sync-page').textContent  = data.pagina_actual;
  const syncTotalEl = document.getElementById('sync-total');
  if (syncTotalEl) syncTotalEl.textContent = data.registros_sync_cva ? data.registros_sync_cva.toLocaleString() : '—';
  const histDiasEl = document.getElementById('sync-hist-dias');
  if (histDiasEl) histDiasEl.textContent = data.dias_historial || (data.registros_historial > 0 ? '✓' : '0');
  const histDesdeEl = document.getElementById('sync-hist-desde');
  if (histDesdeEl) histDesdeEl.textContent = data.fecha_inicio_historial ? 'desde ' + data.fecha_inicio_historial : 'sin snapshots aún';
}

async function ejecutarSync() {
  const el = document.getElementById('sync-result');
  // El sync completo corre como trigger directo en GAS (cada día a las 2am).
  // Desde la app solo podemos ver el estado — no ejecutar el sync completo
  // porque el browser tiene límite de 30s y el catálogo CVA tiene 700+ páginas.
  alert_(el,
    '⚠️ El sync completo corre automáticamente cada día a las 2am directo en GAS.<br><br>' +
    'Si necesitas forzarlo ahora, ve al editor de GAS y ejecuta la función <code>triggerSyncDiario()</code> manualmente.',
    'warn');
  cargarEstadoSync();
}

async function resetearSync(limpiar) {
  if (limpiar && !confirm('¿Borrar todos los datos de SYNC_CVA y empezar desde cero?')) return;
  const el = document.getElementById('sync-result');
  loading(el);
  const data = await api('reset_sync', limpiar ? { limpiar: 'true' } : {});
  if (!data.ok) { alert_(el, '✖ ' + data.error, 'error'); return; }
  alert_(el, '✓ ' + data.mensaje, 'success');
  addLog('info', 'Sync reseteado', limpiar ? 'SYNC_CVA limpiado' : 'solo checkpoint');
  cargarEstadoSync();
}

function instalarTriggers() {
  alert_(document.getElementById('sync-result'), 'Triggers activos — corren automáticamente cada 60 minutos.', 'info');
}

// ── ODOO ──────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════
//  PAGE ODOO — 3 tabs: Ventas dropship · Pickings · Buscar
// ════════════════════════════════════════════════════════════════

// Mapeo estado picking → texto + clase CSS
const _PICK_ESTADOS = {
  draft:     { texto: 'Borrador',  cls: 'pick-badge-draft' },
  waiting:   { texto: 'En espera', cls: 'pick-badge-waiting' },
  confirmed: { texto: 'En espera', cls: 'pick-badge-confirmed' },
  assigned:  { texto: 'Listo',     cls: 'pick-badge-assigned' },
  done:      { texto: 'Hecho',     cls: 'pick-badge-done' },
  cancel:    { texto: 'Cancelado', cls: 'pick-badge-cancel' },
};

function _pickBadge_(state) {
  const e = _PICK_ESTADOS[state] || { texto: state || '—', cls: 'pick-badge-draft' };
  return `<span class="pick-badge ${e.cls}">${e.texto}</span>`;
}

function _fmtFecha_(s) {
  if (!s) return '<span style="color:var(--text-3)">—</span>';
  // Odoo devuelve formato "YYYY-MM-DD HH:mm:ss"
  const t = String(s);
  return t.length >= 16 ? t.substring(0,10) + ' ' + t.substring(11,16) : t.substring(0,10);
}

function odooTab(name) {
  document.querySelectorAll('.odoo-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.odoo-tab-pane').forEach(p => p.classList.remove('active'));
  const tab = document.getElementById('otab-' + name);
  const pane = document.getElementById('opane-' + name);
  if (tab) tab.classList.add('active');
  if (pane) pane.classList.add('active');
  // Auto-cargar al cambiar de tab
  if (name === 'ventas')   cargarVentasOdoo();
  if (name === 'pickings') cargarPickingsOdoo();
}

async function cargarVentasOdoo() {
  const cont = document.getElementById('odoo-ventas-content');
  if (!cont) return;
  cont.innerHTML = `<div style="padding:30px;text-align:center;color:var(--muted);font-size:11px;letter-spacing:1.5px;text-transform:uppercase"><span class="spin"></span> Cargando ventas dropship CVA…</div>`;

  const data = await api('odoo_ventas_dropship', { limit: 200 });
  if (!data.ok) {
    cont.innerHTML = `<div class="alert alert-error">✖ ${data.error}</div>`;
    return;
  }
  const ventas = data.ventas || [];

  if (ventas.length === 0) {
    const info = data.info ? data.info : 'Sin ventas dropship pendientes';
    cont.innerHTML = `
      <div style="background:rgba(0,102,94,0.06);border:1px solid rgba(103,184,175,0.18);padding:30px;text-align:center">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;color:var(--green-lt);letter-spacing:2px;margin-bottom:10px">SIN VENTAS DROPSHIP</div>
        <div style="font-size:11px;color:var(--text-2);line-height:1.6;max-width:520px;margin:0 auto">
          ${info}.<br>
          Las ventas aparecerán aquí cuando tengan al menos un producto con
          <code style="color:var(--green-lt)">default_code</code> terminando en
          <code style="color:var(--green-lt)">-CVA</code>.
        </div>
      </div>`;
    return;
  }

  cont.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px">
      <div>
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:22px;color:var(--green-lt);font-weight:500">${ventas.length}</span>
        <span style="font-size:11px;color:var(--text-2);letter-spacing:1px;text-transform:uppercase;margin-left:6px">venta${ventas.length===1?'':'s'} dropship</span>
      </div>
      <button class="btn btn-ghost" onclick="cargarVentasOdoo()" style="padding:6px 12px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase">↻ Refrescar</button>
    </div>
    <div class="odoo-tbl-wrap">
      <table class="odoo-tbl">
        <thead><tr>
          <th>Número</th>
          <th>Fecha</th>
          <th>Cliente</th>
          <th style="text-align:right">Total</th>
          <th>Estado</th>
          <th>Guía rastreo</th>
        </tr></thead>
        <tbody>
          ${ventas.map(v => `<tr onclick="abrirVentaOdoo('${v.name}')" style="cursor:pointer">
            <td class="col-mono">${v.name || '—'}</td>
            <td class="col-date">${_fmtFecha_(v.date_order)}</td>
            <td>${Array.isArray(v.partner_id) ? v.partner_id[1] : (v.partner_id || '—')}</td>
            <td class="col-num">$${(v.amount_total||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
            <td>${_pickBadge_(v.picking_state)}</td>
            <td class="${v.guia_rastreo ? 'col-guia' : 'col-guia-empty'}">${v.guia_rastreo || 'sin guía'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function cargarPickingsOdoo() {
  const cont = document.getElementById('odoo-pickings-content');
  if (!cont) return;
  cont.innerHTML = `<div style="padding:30px;text-align:center;color:var(--muted);font-size:11px;letter-spacing:1.5px;text-transform:uppercase"><span class="spin"></span> Cargando pickings pendientes…</div>`;

  const data = await api('odoo_pickings', { limit: 200 });
  if (!data.ok) {
    cont.innerHTML = `<div class="alert alert-error">✖ ${data.error}</div>`;
    return;
  }
  const picks = data.pickings || [];
  if (picks.length === 0) {
    cont.innerHTML = `<div class="alert alert-info" style="padding:20px;text-align:center;font-size:12px">Sin pickings pendientes.</div>`;
    return;
  }

  cont.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px">
      <div>
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:22px;color:var(--green-lt);font-weight:500">${picks.length}</span>
        <span style="font-size:11px;color:var(--text-2);letter-spacing:1px;text-transform:uppercase;margin-left:6px">picking${picks.length===1?'':'s'} pendiente${picks.length===1?'':'s'}</span>
      </div>
      <button class="btn btn-ghost" onclick="cargarPickingsOdoo()" style="padding:6px 12px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase">↻ Refrescar</button>
    </div>
    <div class="odoo-tbl-wrap">
      <table class="odoo-tbl">
        <thead><tr>
          <th>Referencia</th>
          <th>Desde</th>
          <th>A</th>
          <th>Contacto</th>
          <th>Fecha programada</th>
          <th>Fecha creación</th>
          <th>Documento origen</th>
          <th>Guía rastreo</th>
          <th>Estado</th>
        </tr></thead>
        <tbody>
          ${picks.map(p => {
            const loc1 = Array.isArray(p.location_id) ? p.location_id[1] : (p.location_id || '—');
            const loc2 = Array.isArray(p.location_dest_id) ? p.location_dest_id[1] : (p.location_dest_id || '—');
            const partner = Array.isArray(p.partner_id) ? p.partner_id[1] : (p.partner_id || '—');
            const guia = p.x_studio_guia_de_rastreo || '';
            return `<tr>
              <td class="col-mono">${p.name || '—'}</td>
              <td style="font-size:11px">${loc1}</td>
              <td style="font-size:11px">${loc2}</td>
              <td>${partner}</td>
              <td class="col-date">${_fmtFecha_(p.scheduled_date)}</td>
              <td class="col-date">${_fmtFecha_(p.create_date)}</td>
              <td class="col-mono">${p.origin || ''}</td>
              <td class="${guia ? 'col-guia' : 'col-guia-empty'}">${guia || 'sin guía'}</td>
              <td>${_pickBadge_(p.state)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function abrirVentaOdoo(name) {
  // Abre la venta directamente en Odoo en una nueva pestaña
  window.open('https://electronicsmexico.odoo.com/odoo/sales?search=' + encodeURIComponent(name), '_blank');
}

async function buscarEnOdoo() {
  const clave = document.getElementById('o-clave').value.trim();
  if (!clave) return;
  const el = document.getElementById('odoo-result');
  loading(el);
  const data = await api('odoo_buscar_producto', { clave });
  if (!data.ok) { alert_(el, '✖ ' + data.error, 'error'); return; }
  if (!data.encontrado) { alert_(el, `Clave "${clave}" no encontrada en Odoo`, 'warn'); return; }
  const p = data.producto;
  el.innerHTML = `<div class="card" style="max-width:480px"><table>
    <tr><td style="color:var(--muted);width:160px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 0">ID Odoo</td><td>${p.id}</td></tr>
    <tr><td style="color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 0">Nombre</td><td>${p.name}</td></tr>
    <tr><td style="color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 0">Referencia</td><td class="mono">${p.default_code}</td></tr>
    <tr><td style="color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 0">Precio Lista</td><td>${fmt(p.list_price,'Pesos')}</td></tr>
    <tr><td style="color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 0">Stock</td><td>${p.qty_available}</td></tr>
    <tr><td style="color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 0">Stock Virtual</td><td>${p.virtual_available}</td></tr>
  </table></div>`;
}

// ── DEBUG ─────────────────────────────────────────────────
async function ejecutarDebug() {
  const action = document.getElementById('d-action').value;
  const el     = document.getElementById('d-result');
  let params   = {};
  try { params = JSON.parse(document.getElementById('d-params').value); } catch(_) {}
  el.innerHTML = '<div style="padding:20px;color:var(--muted);font-size:11px;letter-spacing:2px"><span class="spin"></span>Ejecutando...</div>';
  try {
    const data = await api(action, params);
    el.innerHTML = renderDebugResult(action, data);
  } catch(e) {
    el.innerHTML = `<div class="alert alert-error">Error: ${e.message}</div>`;
  }
}

function renderDebugResult(action, data) {
  if (!data.ok) return `<div class="alert alert-error" style="margin:0">❌ ${data.error||JSON.stringify(data)}</div>`;

  function infoTable(rows) {
    return `<div class="table-wrap"><table><tbody>
      ${rows.filter(Boolean).map(([k,v])=>`<tr>
        <td style="color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;width:160px;white-space:nowrap">${k}</td>
        <td style="font-size:13px">${v??'—'}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
  }

  if (action === 'cva_marcas' && data.marcas) {
    return `<div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${data.marcas.length} marcas</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
        ${data.marcas.map(m=>`<div onclick="filtrarPorMarca('${m.marca}')" style="background:rgba(38,41,48,0.8);border:1px solid rgba(238,240,240,0.1);padding:18px 14px;display:flex;flex-direction:column;align-items:center;gap:12px;min-height:90px;justify-content:center;cursor:pointer" onmouseover="this.style.borderColor='var(--green-lt)'" onmouseout="this.style.borderColor='rgba(238,240,240,0.1)'">
          ${m.logo?`<img src="${m.logo}" style="height:44px;width:auto;max-width:120px;object-fit:contain;filter:brightness(0) invert(1);opacity:0.8" onerror="this.style.display='none'">` : ''}
          <span style="font-size:12px;letter-spacing:1.5px;color:rgba(238,240,240,0.7);text-align:center;text-transform:uppercase;font-weight:500">${m.marca}</span>
          <span style="font-size:9px;letter-spacing:1px;color:var(--green-lt);text-transform:uppercase;opacity:0.7">Buscar →</span>
        </div>`).join('')}
      </div>`;
  }

  if (action === 'cva_grupos' && data.grupos) {
    return `<div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${data.grupos.length} grupos</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px">
        ${data.grupos.map(g=>`<div onclick="filtrarPorGrupo('${g.nombre||g.grupo||g}')" style="padding:10px 14px;background:rgba(238,240,240,0.03);border:1px solid rgba(238,240,240,0.07);font-size:13px;color:var(--text-2);cursor:pointer;display:flex;justify-content:space-between;align-items:center" onmouseover="this.style.background='rgba(0,102,94,0.1)'" onmouseout="this.style.background='rgba(238,240,240,0.03)'">
          <span>${g.nombre||g.grupo||g}</span><span style="font-size:9px;color:var(--green-lt);letter-spacing:1px">BUSCAR →</span>
        </div>`).join('')}
      </div>`;
  }

  if (action === 'cva_sucursales' && data.sucursales) {
    return `<div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${data.sucursales.length} sucursales</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
        ${data.sucursales.map(s=>`<div style="padding:14px 16px;background:rgba(38,41,48,0.8);border:1px solid rgba(238,240,240,0.08)">
          <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:3px">${s.nombre}</div>
          <div style="font-size:10px;color:var(--muted);letter-spacing:1px">Clave: ${s.clave}${s.cp?' · CP '+s.cp:''}</div>
        </div>`).join('')}
      </div>`;
  }

  if (action === 'cva_producto' && data.producto) return renderProducto(data.producto);

  if (action === 'cva_precio_stock') {
    if (data.articulos?.length) {
      return `<div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${data.articulos.length} artículos</div>
        <div class="table-wrap"><table><thead><tr><th>Clave</th><th>Descripción</th><th>Precio</th><th>Suc</th><th>CEDIS</th></tr></thead>
        <tbody>${data.articulos.map(a=>`<tr>
          <td class="mono">${a.clave}</td>
          <td style="font-size:12px;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.descripcion||a.codigo||''}</td>
          <td class="td-price">${fmt(a.precio,a.moneda)}</td>
          <td>${stockCellAM(a.disponible)}</td>
          <td>${stockCellAM(a.disponibleCD)}</td>
        </tr>`).join('')}</tbody></table></div>`;
    }
    if (data.clave) {
      return infoTable([
        ['Clave', `<span class="mono">${data.clave}</span>`],
        ['Descripción', data.descripcion||data.codigo],
        ['Precio', fmt(data.precio,data.moneda)],
        ['Stock Sucursal', data.disponible??'—'],
        ['Stock CEDIS', data.disponibleCD??'—'],
        ['Tipo de Cambio', data.tipo_cambio?`$${data.tipo_cambio}`:null],
      ]);
    }
  }

  if (action === 'cva_imagenes') {
    const imgs = data.imagenes||data.fotos||[];
    if (!imgs.length) return `<div class="alert alert-warn">Sin imágenes para esta clave</div>`;
    return `<div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${imgs.length} imágenes</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        ${imgs.map(img=>{const url=typeof img==='string'?img:(img.url||img.imagen||'');return url?`<div style="background:rgba(38,41,48,0.8);border:1px solid rgba(238,240,240,0.08);padding:8px"><img src="${url}" style="height:120px;width:auto;max-width:180px;object-fit:contain;display:block"></div>`:''}).join('')}
      </div>`;
  }

  if (action === 'cva_info_tecnica') {
    const specs = data.especificaciones||data.specs||data.informacion||[];
    if (Array.isArray(specs) && specs.length) {
      return `<div class="table-wrap"><table><thead><tr><th>Característica</th><th>Valor</th></tr></thead>
        <tbody>${specs.map(s=>`<tr>
          <td style="color:var(--muted);font-size:12px">${s.nombre||s.caracteristica||s.key||Object.keys(s)[0]}</td>
          <td style="font-size:13px">${s.valor||s.value||Object.values(s)[0]}</td>
        </tr>`).join('')}</tbody></table></div>`;
    }
    const keys = Object.keys(data).filter(k=>k!=='ok');
    if (keys.length) return infoTable(keys.map(k=>[k,data[k]]));
    return `<div class="alert alert-warn">Sin especificaciones técnicas para esta clave</div>`;
  }

  if (action === 'cva_consultar_pedido') {
    const p = data.pedido||data;
    const productos = p.productos||data.productos||[];
    return `<div style="margin-bottom:16px">${infoTable([
      ['No Pedido',p.Numero||p.numero],['Fecha', fmtFecha(p.FechaAsignado||p.fecha)],
      ['Estatus',`<span style="color:var(--green-lt);font-size:11px;letter-spacing:1.5px;text-transform:uppercase">${p.Asignado||p.estatus||'—'}</span>`],
      ['Total',p.Total?fmt(p.Total,'Pesos'):null],['Tipo Flete',p.tipo_flete||p.TipoFlete],
    ])}</div>
    ${productos.length?`<div style="margin-bottom:8px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${productos.length} productos</div>
      <div class="table-wrap"><table><thead><tr><th>Clave</th><th>Descripción</th><th>Cantidad</th><th>Precio</th></tr></thead>
      <tbody>${productos.map(pr=>`<tr>
        <td class="mono">${pr.clave||pr.Clave||'—'}</td>
        <td style="font-size:12px">${pr.descripcion||pr.Descripcion||'—'}</td>
        <td style="text-align:center">${pr.cantidad||pr.Cantidad||'—'}</td>
        <td class="td-price">${pr.precio||pr.Precio?fmt(pr.precio||pr.Precio,'Pesos'):'—'}</td>
      </tr>`).join('')}</tbody></table></div>`:''}`;
  }

  if (action === 'cva_consultar_guia') {
    return infoTable([
      ['No Orden CVA',`<span class="mono">${data.order_number||'—'}</span>`],
      ['Fecha',data.date],['No Guía',`<span class="mono">${data.waybills||'—'}</span>`],
      ['Impresa',data.printed?'✓ Sí':'✗ No'],['Entregada',data.delivered?'✓ Sí':'✗ No'],
    ]);
  }

  if (data.pedidos) {
    const lista = data.pedidos;
    if (!lista.length) return `<div class="alert alert-info">Sin pedidos registrados</div>`;
    return `<div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${lista.length} pedidos</div>
      <div class="table-wrap"><table><thead><tr><th>No Pedido</th><th>Fecha</th><th>Total</th><th>Flete</th><th>Estatus</th></tr></thead>
      <tbody>${lista.map(p=>`<tr>
        <td class="mono">${p.Numero||p.numero||'—'}</td>
        <td style="color:var(--muted);font-size:11px">${p.FechaAsignado||p.fecha||'—'}</td>
        <td class="td-price">${p.Total?fmt(p.Total,'Pesos'):'—'}</td>
        <td style="font-size:11px;color:var(--muted)">${p.TipoFlete||p.tipo_flete||'—'}</td>
        <td><span style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:var(--green-lt)">${p.Asignado||'—'}</span></td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  if (data.articulos?.length) {
    const arts = data.articulos;
    return `<div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${arts.length} artículos${data.paginacion?` — pág ${data.paginacion.pagina} de ${data.paginacion.total_paginas}`:''}</div>
      <div class="table-wrap"><table><thead><tr><th>Clave</th><th>Descripción</th><th>Marca</th><th>Precio</th><th>Suc</th><th>CEDIS</th></tr></thead>
      <tbody>${arts.map(a=>`<tr>
        <td class="mono">${a.clave}</td>
        <td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px">${a.descripcion||''}</td>
        <td style="color:var(--muted);font-size:11px">${a.marca||'—'}</td>
        <td class="td-price">${fmt(a.precio,a.moneda)}</td>
        <td>${stockCellAM(a.disponible)}</td>
        <td>${stockCellAM(a.disponibleCD)}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  if (action==='odoo_buscar_producto') {
    if (!data.encontrado) return `<div class="alert alert-warn">Producto no encontrado en Odoo</div>`;
    const p=data.producto;
    return infoTable([
      ['ID Odoo',p.id],['Nombre',p.name],['Referencia',`<span class="mono">${p.default_code||'—'}</span>`],
      ['Precio lista',fmt(p.list_price,'Pesos')],['Costo estándar',p.standard_price?fmt(p.standard_price,'Pesos'):null],
      ['Stock disponible',p.qty_available],['Stock virtual',p.virtual_available],
      ['UoM',Array.isArray(p.uom_id)?p.uom_id[1]:p.uom_id],
    ]);
  }

  if (action==='odoo_stock') {
    if (!data.encontrado) return `<div class="alert alert-warn">Producto no encontrado en Odoo</div>`;
    return infoTable([['Producto ID',data.producto_id||data.id],['Nombre',data.name||data.display_name],['Stock disponible',data.qty_available??data.qty],['Stock virtual',data.virtual_available]]);
  }

  if (action==='odoo_stock_cva') {
    if (!data.encontrado) return `<div class="alert alert-warn">Producto no encontrado en bodega CVA (location 194)</div>`;
    return infoTable([['Producto ID',data.producto_id],['Stock en CVA',`<strong style="color:var(--green-lt);font-size:18px;font-family:'Barlow Condensed',sans-serif">${data.qty}</strong>`]]);
  }

  if (action==='ping') return `<div class="alert alert-success">✓ Conexión activa · ${data.version||'GAS Online'}</div>`;

  if (data.ventas) {
    const vs=data.ventas;
    if (!vs.length) return `<div class="alert alert-info">Sin ventas encontradas</div>`;
    return `<div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${vs.length} ventas</div>
      <div class="table-wrap"><table><thead><tr><th>SO</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
      <tbody>${vs.map(v=>`<tr>
        <td class="mono">${v.name}</td>
        <td style="font-size:12px">${Array.isArray(v.partner_id)?v.partner_id[1]:v.partner_id}</td>
        <td class="td-price">${fmt(v.amount_total,'Pesos')}</td>
        <td style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">${v.state}</td>
        <td style="font-size:11px;color:var(--muted)">${v.date_order?v.date_order.substring(0,10):'—'}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  const keys = Object.keys(data).filter(k=>k!=='ok');
  if (!keys.length) return `<div class="alert alert-success">✓ Operación completada</div>`;
  return `<div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">Respuesta — ${keys.length} campos</div>
    ${infoTable(keys.map(k=>{const v=data[k];const disp=typeof v==='object'?`<code style="font-size:10px;color:var(--green-lt)">${JSON.stringify(v).substring(0,120)}${JSON.stringify(v).length>120?'…':''}</code>`:String(v);return [k,disp]}))}`;
}

// ── LOG ───────────────────────────────────────────────────
let _logEntries = [];

// ── ANÁLISIS DE MOVIMIENTO DE STOCK ──────────────────────────
// ── ANÁLISIS DE STOCK — DASHBOARD COMPLETO ─────────────────
let _analisisData = null;
let _analisisFiltros = {
  // PERIODO
  periodoPreset: 30,    // 1 | 7 | 30 | 90 | 365 | 'custom'
  fechaDesde: null,     // YYYY-MM-DD (solo cuando custom)
  fechaHasta: null,     // YYYY-MM-DD (solo cuando custom)
  // TABLA
  tab: "movidos",       // movidos | agotados | sin_movimiento | todos | marcas | grupos
  busqueda: "",
  marca: "",
  grupo: "",
  precioMin: null,
  precioMax: null,
  minMovido: null,      // unidades movidas mínimas (filtro nuevo)
  minStock: null,       // stock actual mínimo (filtro nuevo)
  soloMovimiento: false,
  pagina: 1,
  porPagina: 20,
  sortCol: "movido",
  sortDir: -1,
};

async function cargarAnalisis() {
  // Si ya existe el dashboard, mostramos un loading SUTIL en la esquina sin
  // destruir lo que está visible. El usuario sigue viendo sus datos mientras
  // se actualiza en segundo plano. Si es la primera carga, el placeholder
  // del HTML original se queda hasta que renderAnalisisDashboard lo limpia.
  const existingDash = document.getElementById('analisis-dashboard');
  if (existingDash) {
    let badge = document.getElementById('anal-loading-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'anal-loading-badge';
      badge.style.cssText = 'position:fixed;top:78px;right:24px;background:rgba(0,102,94,0.95);color:#fff;padding:10px 18px;font-size:10px;letter-spacing:2px;text-transform:uppercase;z-index:1000;display:flex;align-items:center;gap:10px;border-left:2px solid var(--green-lt);box-shadow:0 4px 14px rgba(0,0,0,0.4)';
      badge.innerHTML = '<span class="spin" style="width:12px;height:12px"></span> Recalculando…';
      document.body.appendChild(badge);
    }
  } else {
    const cont = document.getElementById('analisis-content') || document.getElementById('analisis-top-movidos');
    if (cont) cont.innerHTML = '<div style="padding:60px;text-align:center;color:var(--muted);font-size:11px;letter-spacing:2px;text-transform:uppercase"><span class="spin"></span>Calculando análisis…</div>';
  }

  // Construir params según preset o custom
  const f = _analisisFiltros;
  const params = {};
  if (f.periodoPreset === 'custom' && f.fechaDesde) {
    params.fecha_desde = f.fechaDesde;
    if (f.fechaHasta) params.fecha_hasta = f.fechaHasta;
  } else if (typeof f.periodoPreset === 'number') {
    params.dias_atras = f.periodoPreset;
  }

  const data = await api('analisis_movimiento', params);
  const badge = document.getElementById('anal-loading-badge');
  if (badge) badge.remove();
  if (!data.ok) {
    const cont = document.getElementById('analisis-content');
    if (cont) alert_(cont, '✖ ' + (data.error || 'Error'), 'error');
    return;
  }

  _analisisData = data;

  // Cargar metadata del Sheet (modelo/color/upc/ganancia editados en otros
  // dispositivos). Si falla la red, se sigue con localStorage local.
  try { await _loadMetadataFromSheet_(); } catch(e) {}

  renderAnalisisDashboard();
  addLog('ok', 'Análisis cargado', `${data.kpis.total_productos} productos · ${data.periodo.dias}d`);
}

function renderAnalisisDashboard() {
  const d = _analisisData;
  if (!d) return;

  // Crear el contenedor del dashboard si no existe
  let dash = document.getElementById('analisis-dashboard');
  if (!dash) {
    const page = document.getElementById('page-analisis');
    if (!page) return;
    const main = page.querySelector('.main-content') || page;
    dash = document.createElement('div');
    dash.id = 'analisis-dashboard';
    // Limpiar lo viejo
    ['analisis-top-movidos','analisis-agotados','analisis-marcas','analisis-grupos'].forEach(id => {
      const old = document.getElementById(id);
      if (old) old.innerHTML = '';
    });
    // Limpiar el placeholder "Calculando análisis…" del contenedor original
    const oldContent = document.getElementById('analisis-content');
    if (oldContent) oldContent.innerHTML = '';
    // Buscar el contenedor de kpis (busca por id moderno, fallback a la clase legacy)
    const kpiGrid = document.getElementById('analisis-kpis') || page.querySelector('.grid-3');
    if (kpiGrid && kpiGrid.parentNode) {
      kpiGrid.parentNode.insertBefore(dash, kpiGrid.nextSibling);
    } else {
      main.appendChild(dash);
    }
  }

  // KPIs grandes
  renderAnalisisKPIs();

  const k = d.kpis || {};
  const p = d.periodo || {};
  const productos = d.productos || [];
  const marcas    = d.marcas    || [];
  const grupos    = d.grupos    || [];
  const fmtMXN = (n) => '$' + Math.round(n||0).toLocaleString('es-MX');
  const fmtN = (n) => (n != null ? n : 0).toLocaleString('es-MX');

  dash.innerHTML = `
    <!-- Selector de Periodo - Panel con fondo sutil -->
    <div style="background:rgba(0,0,0,0.22);border:1px solid rgba(238,240,240,0.06);padding:16px 20px;margin-bottom:14px">
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <span style="font-size:9px;color:var(--muted);letter-spacing:2.5px;text-transform:uppercase;margin-right:14px;display:flex;align-items:center;height:32px">⏱ Periodo</span>
        ${[
          [1,   'Ayer'],
          [7,   '7 días'],
          [30,  '30 días'],
          [90,  '3 meses'],
          [365, '1 año'],
          ['custom', 'Rango…'],
        ].map(([v,l]) => {
          const active = _analisisFiltros.periodoPreset===v;
          return `<button onclick="anCambiarPeriodo(${typeof v==='string'?`'${v}'`:v})" style="background:${active?'var(--green)':'rgba(255,255,255,0.03)'};border:1px solid ${active?'var(--green-lt)':'rgba(238,240,240,0.1)'};color:${active?'#fff':'var(--muted)'};padding:8px 18px;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all 0.18s ease;${active?'font-weight:500':''}">${l}</button>`;
        }).join('')}
        ${_analisisFiltros.periodoPreset === 'custom' ? `
          <div style="display:flex;gap:6px;align-items:center;margin-left:14px;padding-left:14px;border-left:1px solid rgba(238,240,240,0.1)">
            <input type="date" value="${_analisisFiltros.fechaDesde||''}" onchange="_analisisFiltros.fechaDesde=this.value;cargarAnalisis()" style="background:rgba(0,0,0,0.3);border:1px solid rgba(238,240,240,0.12);color:var(--text);padding:7px 10px;font-size:11px;outline:none">
            <span style="color:var(--muted);font-size:11px">→</span>
            <input type="date" value="${_analisisFiltros.fechaHasta||''}" onchange="_analisisFiltros.fechaHasta=this.value;cargarAnalisis()" style="background:rgba(0,0,0,0.3);border:1px solid rgba(238,240,240,0.12);color:var(--text);padding:7px 10px;font-size:11px;outline:none">
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Banner Periodo Actual - panel con acento verde + barra visual -->
    <div style="background:linear-gradient(90deg, rgba(0,102,94,0.12) 0%, rgba(0,102,94,0.04) 60%, transparent 100%);border-left:3px solid var(--green-lt);padding:18px 22px;margin-bottom:22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
      <div>
        <div style="font-size:9px;color:var(--muted);letter-spacing:2.5px;text-transform:uppercase;margin-bottom:6px">Periodo analizado</div>
        <div style="display:flex;align-items:center;gap:14px;font-family:Barlow Condensed,sans-serif">
          <span style="font-size:20px;color:var(--text);font-weight:500;letter-spacing:0.5px">${p.fecha_inicio || '—'}</span>
          <div style="width:60px;height:2px;background:linear-gradient(90deg, var(--green-lt), rgba(103,184,175,0.3));position:relative">
            <span style="position:absolute;left:-3px;top:-3px;width:8px;height:8px;background:var(--green-lt);border-radius:50%"></span>
            <span style="position:absolute;right:-3px;top:-3px;width:8px;height:8px;background:rgba(103,184,175,0.5);border-radius:50%"></span>
          </div>
          <span style="font-size:20px;color:var(--text);font-weight:500;letter-spacing:0.5px">${p.fecha_fin || '—'}</span>
          <span style="font-size:11px;color:var(--muted);letter-spacing:1.5px;margin-left:8px;font-family:inherit">${p.dias} días · ${p.snapshots_validos} snapshots</span>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:9px;color:var(--muted);letter-spacing:2.5px;text-transform:uppercase;margin-bottom:6px">Total movimiento</div>
        <div style="display:flex;align-items:baseline;gap:18px;justify-content:flex-end">
          <div>
            <span style="font-family:Barlow Condensed,sans-serif;font-size:22px;color:var(--green-lt);font-weight:500">${fmtN(k.unidades_movidas)}</span>
            <span style="font-size:10px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-left:4px">unidades</span>
          </div>
          <span style="opacity:0.3">/</span>
          <div>
            <span style="font-family:Barlow Condensed,sans-serif;font-size:22px;color:var(--green-lt);font-weight:500">${fmtMXN(k.valor_movido_mxn)}</span>
            <span style="font-size:10px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-left:4px">valor</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Filtros -->
    <!-- Filtros del Dashboard - Panel cockpit -->
    <div style="background:rgba(0,0,0,0.22);border:1px solid rgba(238,240,240,0.06);padding:18px 20px;margin-bottom:14px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px">
        <span style="font-size:9px;color:var(--muted);letter-spacing:2.5px;text-transform:uppercase">⛯ Filtros del dashboard</span>
        <span style="font-size:9px;color:rgba(238,240,240,0.3);letter-spacing:1px;text-transform:uppercase">Acumulables</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:14px">
        <div>
          <label style="display:block;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">Búsqueda</label>
          <input id="anal-busqueda" placeholder="Clave, descripción…" value="${_analisisFiltros.busqueda}" oninput="anFiltrar('busqueda',this.value)" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:9px 12px;font-size:12px;outline:none;font-family:inherit">
        </div>
        <div>
          <label style="display:block;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">Marca</label>
          <select id="anal-marca" onchange="anFiltrar('marca',this.value)" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:9px 12px;font-size:12px;outline:none;font-family:inherit">
            <option value="">Todas las marcas</option>
            ${marcas.slice(0,80).map(m => `<option value="${m.marca}" ${_analisisFiltros.marca===m.marca?'selected':''}>${m.marca} (${m.productos})</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="display:block;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">Grupo</label>
          <select id="anal-grupo" onchange="anFiltrar('grupo',this.value)" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:9px 12px;font-size:12px;outline:none;font-family:inherit">
            <option value="">Todos los grupos</option>
            ${grupos.slice(0,80).map(g => `<option value="${g.grupo}" ${_analisisFiltros.grupo===g.grupo?'selected':''}>${g.grupo} (${g.productos})</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="display:block;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">Por página</label>
          <select id="anal-porpag" onchange="anFiltrar('porPagina',parseInt(this.value))" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:9px 12px;font-size:12px;outline:none;font-family:inherit">
            ${[10,20,50,100,250,500,1000,9999].map(n => `<option value="${n}" ${_analisisFiltros.porPagina===n?'selected':''}>${n>=9999?'Todos':n+' / pág'}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr) auto;gap:14px;align-items:end">
        <div>
          <label style="display:block;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">Precio mín</label>
          <input type="number" placeholder="—" value="${_analisisFiltros.precioMin||''}" oninput="anFiltrar('precioMin',this.value?parseFloat(this.value):null)" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:9px 12px;font-size:12px;outline:none">
        </div>
        <div>
          <label style="display:block;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">Precio máx</label>
          <input type="number" placeholder="—" value="${_analisisFiltros.precioMax||''}" oninput="anFiltrar('precioMax',this.value?parseFloat(this.value):null)" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:9px 12px;font-size:12px;outline:none">
        </div>
        <div>
          <label style="display:block;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">Movido ≥</label>
          <input type="number" placeholder="—" value="${_analisisFiltros.minMovido||''}" oninput="anFiltrar('minMovido',this.value?parseFloat(this.value):null)" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:9px 12px;font-size:12px;outline:none" title="Unidades movidas mínimas">
        </div>
        <div>
          <label style="display:block;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">Stock ≥</label>
          <input type="number" placeholder="—" value="${_analisisFiltros.minStock||''}" oninput="anFiltrar('minStock',this.value?parseFloat(this.value):null)" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:9px 12px;font-size:12px;outline:none" title="Stock actual mínimo">
        </div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;color:var(--muted);letter-spacing:0.5px;padding-bottom:9px">
          <input type="checkbox" ${_analisisFiltros.soloMovimiento?'checked':''} onchange="anFiltrar('soloMovimiento',this.checked)" style="accent-color:var(--green-lt);width:14px;height:14px;cursor:pointer"> Solo con movimiento
        </label>
      </div>
    </div>

    <!-- Barra de modos y acciones - panel separado -->
    <div style="background:rgba(0,0,0,0.22);border:1px solid rgba(238,240,240,0.06);padding:14px 20px;margin-bottom:14px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div>
        <span style="font-size:9px;color:var(--muted);letter-spacing:2.5px;text-transform:uppercase;margin-right:14px">Vista</span>
        <div style="display:inline-flex;gap:0;align-items:center;border:1px solid rgba(238,240,240,0.1)">
          ${[
            ['ventas','Ventas'],
            ['datos','Datos'],
            ['precios','Precios'],
          ].map(([modo, label], i) => {
            const active = _modoVistaTabla===modo;
            return `<button onclick="anSetModoVista('${modo}')" style="background:${active?'var(--green)':'transparent'};border:none;${i<2?'border-right:1px solid rgba(238,240,240,0.1);':''}color:${active?'#fff':'var(--muted)'};padding:8px 18px;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all 0.18s ease;${active?'font-weight:500':''}">${label}</button>`;
          }).join('')}
        </div>
      </div>
      ${_modoVistaTabla === 'precios' ? `
        <div style="display:flex;align-items:center;gap:10px;padding-left:18px;border-left:1px solid rgba(238,240,240,0.1)">
          <span style="font-size:9px;color:var(--muted);letter-spacing:2px;text-transform:uppercase">% Gan global</span>
          <input type="number" min="5" step="0.5" value="${_gananciaGlobal}" onchange="anCambiarGananciaGlobal(this.value)" style="background:rgba(0,102,94,0.2);border:1px solid var(--green-lt);color:var(--green-lt);padding:6px 8px;font-size:14px;width:56px;outline:none;font-weight:500;text-align:right;font-family:Barlow Condensed,sans-serif" title="Mínimo 5%. Aplica a filas sin % individual.">
        </div>
      ` : ''}
      <div style="flex:1"></div>
      <span style="font-size:9px;color:var(--muted);letter-spacing:2.5px;text-transform:uppercase">Exportar</span>
      <button onclick="anExportXLSX()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(238,240,240,0.15);color:var(--text);padding:8px 16px;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all 0.18s ease" onmouseover="this.style.borderColor='var(--green-lt)';this.style.color='var(--green-lt)'" onmouseout="this.style.borderColor='rgba(238,240,240,0.15)';this.style.color='var(--text)'" title="Excel completo con todas las columnas">📊 Excel</button>
      <button onclick="anExportCVAUPCs()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(238,240,240,0.15);color:var(--text);padding:8px 16px;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all 0.18s ease" onmouseover="this.style.borderColor='var(--green-lt)';this.style.color='var(--green-lt)'" onmouseout="this.style.borderColor='rgba(238,240,240,0.15)';this.style.color='var(--text)'" title="Archivo limpio para CVA pidiendo UPCs">📋 CVA UPCs</button>
      <button onclick="anExportPDF()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(238,240,240,0.15);color:var(--text);padding:8px 16px;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all 0.18s ease" onmouseover="this.style.borderColor='var(--green-lt)';this.style.color='var(--green-lt)'" onmouseout="this.style.borderColor='rgba(238,240,240,0.15)';this.style.color='var(--text)'">📄 PDF</button>
      <button onclick="anLimpiarFiltros()" style="background:transparent;border:1px solid rgba(238,240,240,0.1);color:var(--muted);padding:8px 16px;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all 0.18s ease" onmouseover="this.style.borderColor='rgba(224,85,85,0.5)';this.style.color='#e05555'" onmouseout="this.style.borderColor='rgba(238,240,240,0.1)';this.style.color='var(--muted)'">✕ Limpiar</button>
    </div>

    <!-- Reporte Top 20 — panel destacado con acento verde -->
    <div style="background:linear-gradient(135deg, rgba(0,102,94,0.08) 0%, rgba(0,0,0,0.22) 100%);border:1px solid rgba(103,184,175,0.18);padding:18px 22px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:12px">
        <div style="display:flex;flex-direction:column;line-height:1.2">
          <span style="font-size:9px;color:var(--green-lt);letter-spacing:2.5px;text-transform:uppercase;font-weight:500">⭐ Reporte</span>
          <span style="font-family:Barlow Condensed,sans-serif;font-size:24px;color:var(--text);font-weight:500;letter-spacing:1px">TOP 20</span>
        </div>
        <div style="width:1px;height:42px;background:rgba(103,184,175,0.2)"></div>
        <div style="display:flex;gap:12px;align-items:end">
          <div>
            <label style="display:block;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">Stock ≥</label>
            <input type="number" placeholder="—" value="${_top20Filtros.stockMin != null ? _top20Filtros.stockMin : ''}" oninput="anTop20SetFiltro('stockMin', this.value)" style="background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:8px 10px;font-size:13px;width:90px;outline:none;font-family:Barlow Condensed,sans-serif;text-align:right">
          </div>
          <div>
            <label style="display:block;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">Movido ≥</label>
            <input type="number" placeholder="—" value="${_top20Filtros.movMin != null ? _top20Filtros.movMin : ''}" oninput="anTop20SetFiltro('movMin', this.value)" style="background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:8px 10px;font-size:13px;width:90px;outline:none;font-family:Barlow Condensed,sans-serif;text-align:right">
          </div>
          <div>
            <label style="display:block;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">% Gan reporte</label>
            <input type="number" min="0" step="0.5" placeholder="${_gananciaGlobal} (global)" value="${_top20Filtros.ganancia != null ? _top20Filtros.ganancia : ''}" oninput="anTop20SetFiltro('ganancia', this.value)" style="background:rgba(0,102,94,0.18);border:1px solid var(--green-lt);color:var(--green-lt);padding:8px 10px;font-size:13px;width:120px;outline:none;font-family:Barlow Condensed,sans-serif;text-align:right;font-weight:500" title="% Ganancia para el reporte Top 20. Si lo dejas vacío usa el % Gan Global del dashboard.">
          </div>
        </div>
        <div style="width:1px;height:42px;background:rgba(103,184,175,0.2)"></div>
        <div>
          <label style="display:block;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">Agrupar por</label>
          <div style="display:inline-flex;gap:0;align-items:center;border:1px solid rgba(238,240,240,0.1)">
            ${[
              ['global','Global'],
              ['marca','Por marca'],
              ['grupo','Por grupo'],
            ].map(([modo, label], i) => {
              const active = _top20Filtros.modo === modo;
              return `<button onclick="anTop20SetModo('${modo}')" style="background:${active?'var(--green)':'transparent'};border:none;${i<2?'border-right:1px solid rgba(238,240,240,0.1);':''}color:${active?'#fff':'var(--muted)'};padding:8px 16px;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all 0.18s ease;${active?'font-weight:500':''}">${label}</button>`;
            }).join('')}
          </div>
        </div>
        <div style="flex:1"></div>
        <button onclick="anTop20Excel()" style="background:rgba(0,102,94,0.2);border:1px solid var(--green-lt);color:var(--green-lt);padding:10px 20px;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;font-family:inherit;font-weight:500;transition:all 0.18s ease" onmouseover="this.style.background='var(--green)';this.style.color='#fff'" onmouseout="this.style.background='rgba(0,102,94,0.2)';this.style.color='var(--green-lt)'" title="Descargar como Excel">📊 Excel</button>
        <button onclick="anTop20PDF()" style="background:rgba(0,102,94,0.2);border:1px solid var(--green-lt);color:var(--green-lt);padding:10px 20px;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;font-family:inherit;font-weight:500;transition:all 0.18s ease" onmouseover="this.style.background='var(--green)';this.style.color='#fff'" onmouseout="this.style.background='rgba(0,102,94,0.2)';this.style.color='var(--green-lt)'" title="Imprimir / guardar como PDF">📄 PDF</button>
      </div>
      <!-- Contador en vivo del reporte actual -->
      <div style="font-size:10px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;padding-top:8px;border-top:1px dashed rgba(103,184,175,0.15)">
        <span style="margin-right:8px">📊 Reporte actual generará</span>
        <span id="top20-contador">${(() => {
          const secciones = _calcularReporteTop20_();
          const total = secciones.reduce((s, sec) => s + sec.productos.length, 0);
          if (_top20Filtros.modo === 'global') {
            return `<span style="color:var(--green-lt);font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:500">${total}</span> <span style="color:var(--muted)">productos</span>`;
          }
          return `<span style="color:var(--green-lt);font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:500">${total}</span> <span style="color:var(--muted)">productos · </span><span style="color:var(--green-lt);font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:500">${secciones.length}</span> <span style="color:var(--muted)">${_top20Filtros.modo === 'marca' ? 'marcas' : 'grupos'}</span>`;
        })()}</span>
      </div>
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:0;margin-bottom:0;border-bottom:1px solid rgba(238,240,240,0.08);overflow-x:auto">
      ${[
        ['movidos','▼ Más movidos', productos.filter(p=>p.tiene_movimiento).length],
        ['agotados','✖ Agotados', productos.filter(p=>p.agotado_recientemente).length],
        ['sin_movimiento','• Sin movimiento', productos.filter(p=>!p.tiene_movimiento && p.total>0).length],
        ['todos','◯ Todos', productos.length],
        ['marcas','Por marca', marcas.length],
        ['grupos','Por grupo', grupos.length],
      ].map(([id,label,count]) => {
        const active = _analisisFiltros.tab===id;
        return `<button onclick="anTab('${id}')" style="background:transparent;border:none;border-bottom:2px solid ${active?'var(--green-lt)':'transparent'};color:${active?'var(--text)':'var(--muted)'};padding:14px 22px;font-size:11px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;white-space:nowrap;font-family:inherit;transition:color 0.2s, border-color 0.2s;${active?'font-weight:500':''}">
          ${label} <span style="opacity:0.4;font-size:10px;margin-left:4px;font-family:Barlow Condensed,sans-serif">${count}</span>
        </button>`;
      }).join('')}
    </div>

    <!-- Contenido del tab -->
    <div id="anal-tab-content" style="padding-top:20px"></div>
  `;

  renderAnalisisTab();
}

function renderAnalisisKPIs() {
  const k = _analisisData.kpis || {};
  const p = _analisisData.periodo || {};
  const fmtMXN = (n) => '$' + (Math.round(n||0)).toLocaleString('es-MX');
  const fmtN = (n) => (n != null ? n : 0).toLocaleString('es-MX');

  // Actualizar las 3 tarjetas KPI viejas si existen
  const map = {
    'analisis-total-stock'  : fmtN(k.productos_activos),
    'analisis-agotados-hoy' : fmtN(k.agotados_recientes),
    'analisis-movimiento'   : fmtN(k.unidades_movidas),
  };
  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = map[id];
  });

  // También actualizar el subtítulo del periodo si existe
  const periodoEl = document.getElementById('analisis-periodo');
  if (periodoEl) {
    periodoEl.textContent = `${p.dias} días · ${p.fecha_inicio} → ${p.fecha_fin}`;
  }
}

function anFiltrar(campo, valor) {
  _analisisFiltros[campo] = valor;
  _analisisFiltros.pagina = 1;
  renderAnalisisTab();
}

// Cambiar periodo de comparación — recarga datos del backend
function anCambiarPeriodo(preset) {
  _analisisFiltros.periodoPreset = preset;
  _analisisFiltros.pagina = 1;
  // Si es custom y no hay fechas previas, prellenar con últimos 30 días
  if (preset === 'custom' && !_analisisFiltros.fechaDesde) {
    const hoy = new Date();
    const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);
    _analisisFiltros.fechaDesde = hace30.toISOString().slice(0,10);
    _analisisFiltros.fechaHasta = hoy.toISOString().slice(0,10);
  }
  cargarAnalisis(); // recarga del backend
}

function anLimpiarFiltros() {
  _analisisFiltros.busqueda = "";
  _analisisFiltros.marca = "";
  _analisisFiltros.grupo = "";
  _analisisFiltros.precioMin = null;
  _analisisFiltros.precioMax = null;
  _analisisFiltros.minMovido = null;
  _analisisFiltros.minStock = null;
  _analisisFiltros.soloMovimiento = false;
  _analisisFiltros.pagina = 1;
  renderAnalisisDashboard();
}

function anTab(tab) {
  _analisisFiltros.tab = tab;
  _analisisFiltros.pagina = 1;
  renderAnalisisDashboard();
}

function anSort(col) {
  if (_analisisFiltros.sortCol === col) {
    _analisisFiltros.sortDir *= -1;
  } else {
    _analisisFiltros.sortCol = col;
    _analisisFiltros.sortDir = -1;
  }
  renderAnalisisTab();
}

function anFiltrarProductos() {
  const f = _analisisFiltros;
  let prods = _analisisData.productos || [];

  // Tab filtering
  if (f.tab === 'movidos')         prods = prods.filter(p => p.tiene_movimiento);
  else if (f.tab === 'agotados')   prods = prods.filter(p => p.agotado_recientemente);
  else if (f.tab === 'sin_movimiento') prods = prods.filter(p => !p.tiene_movimiento && p.total > 0);
  // 'todos' → sin filtro

  if (f.soloMovimiento && f.tab !== 'movidos') prods = prods.filter(p => p.tiene_movimiento);
  if (f.marca) prods = prods.filter(p => p.marca === f.marca);
  if (f.grupo) prods = prods.filter(p => p.grupo === f.grupo);
  if (f.precioMin !== null) prods = prods.filter(p => p.precio >= f.precioMin);
  if (f.precioMax !== null) prods = prods.filter(p => p.precio <= f.precioMax);
  if (f.minMovido !== null && f.minMovido !== '') prods = prods.filter(p => (p.movido||0) >= f.minMovido);
  if (f.minStock !== null && f.minStock !== '')   prods = prods.filter(p => (p.total||0)  >= f.minStock);
  if (f.busqueda) {
    const q = f.busqueda.toLowerCase();
    prods = prods.filter(p =>
      (p.clave||'').toLowerCase().includes(q) ||
      (p.desc||'').toLowerCase().includes(q) ||
      (p.marca||'').toLowerCase().includes(q)
    );
  }

  // Sort
  const dir = f.sortDir;
  const col = f.sortCol;
  prods = [...prods].sort((a, b) => {
    let va = a[col], vb = b[col];
    if (va === null || va === undefined) va = -Infinity;
    if (vb === null || vb === undefined) vb = -Infinity;
    if (typeof va === 'string') {
      return dir * va.localeCompare(vb || '');
    }
    return dir * (va - vb);
  });

  return prods;
}

function renderAnalisisTab() {
  const cont = document.getElementById('anal-tab-content');
  if (!cont || !_analisisData) return;

  const f = _analisisFiltros;
  const fmtMXN = (n) => '$' + (Math.round(n||0)).toLocaleString('es-MX');

  // Tabs de marcas y grupos
  if (f.tab === 'marcas') {
    const items = [...(_analisisData.marcas || [])].sort((a,b) => f.sortDir * ((a[f.sortCol]||0) - (b[f.sortCol]||0)));
    cont.innerHTML = renderTablaSimple(items, [
      {k:'marca',     l:'Marca',         t:'text'},
      {k:'productos', l:'Productos',     t:'num'},
      {k:'stock_total',l:'Stock Total',  t:'num'},
      {k:'movido',    l:'Unidades Movidas', t:'num', hi:true},
      {k:'valor_movido',l:'Valor Movido', t:'mxn'},
    ]);
    return;
  }
  if (f.tab === 'grupos') {
    const items = [...(_analisisData.grupos || [])].sort((a,b) => f.sortDir * ((a[f.sortCol]||0) - (b[f.sortCol]||0)));
    cont.innerHTML = renderTablaSimple(items, [
      {k:'grupo',     l:'Grupo',         t:'text'},
      {k:'productos', l:'Productos',     t:'num'},
      {k:'stock_total',l:'Stock Total',  t:'num'},
      {k:'movido',    l:'Unidades Movidas', t:'num', hi:true},
      {k:'valor_movido',l:'Valor Movido', t:'mxn'},
    ]);
    return;
  }

  // Tab de productos
  const prods = anFiltrarProductos();
  const total = prods.length;
  const inicio = (f.pagina - 1) * f.porPagina;
  const pag = prods.slice(inicio, inicio + f.porPagina);
  const totPag = Math.max(1, Math.ceil(total / f.porPagina));

  // Columnas BASE — cambian según el modo.
  // En precios: quitamos Stock Inicial / Stock Hoy / Movido y agregamos
  // Precio CVA (como referencia para ver de dónde sale cada precio calculado).
  // Eso libera 3 columnas y permite ver más plataformas sin scroll.
  // La primera columna en TODOS los modos es la miniatura (lazy-loaded).
  const colsBase = _modoVistaTabla === 'precios' ? [
    {k:'_thumb',    l:'',            t:'thumb', w:'46px'},
    {k:'clave',     l:'Clave',       t:'mono',  w:'80px'},
    {k:'desc',      l:'Descripción', t:'desc',  w:'280px'},
    {k:'marca',     l:'Marca',       t:'small', w:'85px'},
    {k:'precio',    l:'Precio CVA',  t:'mxn',   w:'90px', hi:true},
  ] : [
    {k:'_thumb',    l:'',            t:'thumb', w:'46px'},
    {k:'clave',     l:'Clave',       t:'mono', w:'80px'},
    {k:'desc',      l:'Descripción', t:'desc', w:_modoVistaTabla==='datos' ? '300px' : '320px'},
    {k:'marca',     l:'Marca',       t:'small', w:'85px'},
    {k:'stock_base',l:`Stock Inicial`, t:'num', w:'70px'},
    {k:'total',     l:'Stock Hoy',   t:'num', w:'70px'},
    {k:'movido',    l:'▼ Movido',    t:'mov', hi:true, w:'85px'},
  ];
  // Columnas centrales — cambian según el modo
  //   ventas:  Prom/día, Prom/sem, Prom/mes, Días stock, Precio CVA, Valor Hoy
  //   datos:   Modelo, Color, UPC, Cat. MELI, Peso, SKU (editables)
  //   precios: %Gan + 12 plataformas (calculadas en vivo)
  const colsVentas = [
    {k:'prom_diario',l:'Prom/día',   t:'num'},
    {k:'prom_semanal',l:'Prom/sem',  t:'num'},
    {k:'prom_mensual',l:'Prom/mes',  t:'num'},
    {k:'dias_restantes',l:'Días stock', t:'dias'},
    {k:'precio',    l:'Precio CVA',  t:'mxn'},
    {k:'valor_movido',l:'Valor Hoy', t:'mxn'},
  ];
  // En modos datos/precios, las columnas centrales son inputs/cálculos especiales
  // y se manejan aparte via _renderColumnas{Datos,Precios}{Header,Fila}_
  const cols = _modoVistaTabla === 'ventas' ? [...colsBase, ...colsVentas] : colsBase;

  const headerHtml = cols.map(c => {
    const isSort = f.sortCol === c.k;
    const arrow = isSort ? (f.sortDir > 0 ? ' ↑' : ' ↓') : '';
    return `<th onclick="anSort('${c.k}')" style="cursor:pointer;user-select:none;${c.hi?'color:var(--green-lt);':''}${c.w?'width:'+c.w+';':''}padding:8px 10px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${isSort?'var(--green-lt)':'var(--muted)'};text-align:${['num','mov','mxn','dias'].includes(c.t)?'right':'left'};border-bottom:1px solid rgba(238,240,240,0.1)">${c.l}${arrow}</th>`;
  }).join('')
    + (_modoVistaTabla==='datos'   ? _renderColumnasDatosHeader_()   : '')
    + (_modoVistaTabla==='precios' ? _renderColumnasPreciosHeader_() : '');

  const rowsHtml = pag.map(p => {
    const baseCells = cols.map(c => {
      const v = p[c.k];
      let cell = '—';
      let extra = '';
      if (c.t === 'thumb') {
        // Placeholder con data-clave — el lazy loader lo reemplaza al hacer scroll
        cell = `<div class="an-thumb" data-clave="${p.clave}" data-loaded="0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8"><rect x="3" y="3" width="18" height="18"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;
        extra = 'padding:4px;text-align:center';
      }
      else if (c.t === 'mono')  cell = `<span style="font-family:monospace;color:var(--green-lt);font-size:11px">${v||'—'}</span>`;
      else if (c.t === 'desc') {
        // En modos datos/precios: descripción completa, wrap multilinea
        // En modo ventas: truncar a 60 con tooltip
        if (_modoVistaTabla !== 'ventas') {
          cell = `<span title="${(v||'').replace(/"/g,'&quot;')}" style="font-size:11px;display:block;white-space:normal;line-height:1.35;word-break:break-word">${v||'—'}</span>`;
        } else {
          cell = `<span title="${(v||'').replace(/"/g,'&quot;')}" style="font-size:12px">${(v||'—').substring(0,60)}${v && v.length>60?'…':''}</span>`;
        }
      }
      else if (c.t === 'small') cell = `<span style="color:var(--muted);font-size:11px">${v||'—'}</span>`;
      else if (c.t === 'num') {
        cell = v !== null && v !== undefined ? Number(v).toLocaleString('es-MX') : '—';
        extra = 'text-align:right;font-family:Barlow Condensed,sans-serif;font-size:14px';
      } else if (c.t === 'mov') {
        if (v === null || v === undefined) cell = '<span style="color:rgba(238,240,240,0.2)">—</span>';
        else if (v > 0) cell = `<span style="color:var(--green-lt);font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:500">▼ ${v.toLocaleString('es-MX')}</span>`;
        else cell = '<span style="color:rgba(238,240,240,0.3)">0</span>';
        extra = 'text-align:right';
      } else if (c.t === 'mxn') {
        cell = v !== null && v !== undefined ? fmtMXN(v) : '—';
        extra = 'text-align:right;font-family:Barlow Condensed,sans-serif;color:var(--muted);font-size:12px';
      } else if (c.t === 'dias') {
        if (v === null || v === undefined) cell = '<span style="color:rgba(238,240,240,0.2)">—</span>';
        else if (v === 0) cell = '<span style="color:#e05555;font-size:11px;letter-spacing:1px">AGOTADO</span>';
        else if (v < 7) cell = `<span style="color:var(--orange);font-weight:500">${v} d</span>`;
        else cell = `<span style="color:var(--muted)">${v.toLocaleString('es-MX')} d</span>`;
        extra = 'text-align:right;font-size:12px';
      }
      return `<td style="padding:6px 10px;${extra};vertical-align:${_modoVistaTabla!=='ventas'?'middle':'top'}">${cell}</td>`;
    }).join('');
    const extraCells =
        _modoVistaTabla==='datos'   ? _renderColumnasDatosFila_(p)
      : _modoVistaTabla==='precios' ? _renderColumnasPreciosFila_(p)
      : '';
    return '<tr class="cva-row" style="border-bottom:1px solid rgba(238,240,240,0.04)">' + baseCells + extraCells + '</tr>';
  }).join('');

  // Paginación
  const pagNums = [];
  for (let i = 1; i <= Math.min(totPag, 7); i++) pagNums.push(i);
  if (totPag > 7 && f.pagina > 4) {
    pagNums.length = 0;
    pagNums.push(1, '…');
    for (let i = Math.max(2, f.pagina-2); i <= Math.min(totPag, f.pagina+2); i++) pagNums.push(i);
    if (f.pagina < totPag - 2) { pagNums.push('…'); pagNums.push(totPag); }
  }

  cont.innerHTML = `
    <div style="font-size:10px;color:var(--muted);margin-bottom:14px;letter-spacing:2px;text-transform:uppercase">
      <span style="font-family:Barlow Condensed,sans-serif;font-size:14px;color:var(--text);letter-spacing:0;font-weight:500">${total.toLocaleString('es-MX')}</span>
      <span style="opacity:0.6;margin:0 6px">productos</span>
      <span style="opacity:0.3">/</span>
      <span style="opacity:0.6;margin-left:6px">mostrando ${inicio + 1}–${Math.min(inicio + f.porPagina, total)}</span>
    </div>
    <div style="overflow-x:auto;border-top:1px solid rgba(238,240,240,0.04);border-bottom:1px solid rgba(238,240,240,0.04)">
      <table style="width:100%;border-collapse:collapse;min-width:${_modoVistaTabla==='precios'?'1700':_modoVistaTabla==='datos'?'1700':'1100'}px">
        <thead style="background:transparent;position:sticky;top:0"><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="'+(cols.length + (_modoVistaTabla==='precios'?13:_modoVistaTabla==='datos'?6:0))+'" style="padding:40px;text-align:center;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;font-size:10px">Sin productos con estos filtros</td></tr>'}</tbody>
      </table>
    </div>
    ${totPag > 1 ? `
    <div style="display:flex;justify-content:center;gap:4px;margin-top:14px;flex-wrap:wrap">
      <button onclick="anFiltrar('pagina',Math.max(1,${f.pagina-1}))" ${f.pagina<=1?'disabled':''} style="background:transparent;border:1px solid rgba(238,240,240,0.1);color:var(--muted);padding:5px 10px;cursor:pointer;font-size:11px">‹</button>
      ${pagNums.map(n => n === '…'
        ? '<span style="padding:5px 8px;color:var(--muted);font-size:11px">…</span>'
        : `<button onclick="anFiltrar('pagina',${n})" style="background:${f.pagina===n?'var(--green)':'transparent'};border:1px solid ${f.pagina===n?'var(--green)':'rgba(238,240,240,0.1)'};color:${f.pagina===n?'#fff':'var(--muted)'};padding:5px 10px;cursor:pointer;font-size:11px;min-width:32px">${n}</button>`
      ).join('')}
      <button onclick="anFiltrar('pagina',Math.min(${totPag},${f.pagina+1}))" ${f.pagina>=totPag?'disabled':''} style="background:transparent;border:1px solid rgba(238,240,240,0.1);color:var(--muted);padding:5px 10px;cursor:pointer;font-size:11px">›</button>
    </div>` : ''}
  `;
  // Disparar lazy load de miniaturas (no bloqueante)
  setTimeout(() => { try { initThumbLoader_(); } catch(e) {} }, 50);
}

function renderTablaSimple(items, cols) {
  const fmtMXN = (n) => '$' + (Math.round(n||0)).toLocaleString('es-MX');
  const f = _analisisFiltros;
  const headerHtml = cols.map(c => {
    const isSort = f.sortCol === c.k;
    return `<th onclick="anSort('${c.k}')" style="cursor:pointer;padding:8px 10px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${isSort?'var(--green-lt)':'var(--muted)'};text-align:${c.t==='text'?'left':'right'};border-bottom:1px solid rgba(238,240,240,0.1)${c.hi?';color:var(--green-lt)':''}">${c.l}${isSort?(f.sortDir>0?' ↑':' ↓'):''}</th>`;
  }).join('');
  const rowsHtml = items.map(it => '<tr class="cva-row" style="border-bottom:1px solid rgba(238,240,240,0.04)">' + cols.map(c => {
    const v = it[c.k];
    let cell = '—'; let extra = '';
    if (c.t === 'text') { cell = v || '—'; extra = 'font-size:12px'; }
    else if (c.t === 'num') { cell = (v||0).toLocaleString('es-MX'); extra = 'text-align:right;font-family:Barlow Condensed,sans-serif;font-size:14px' + (c.hi?';color:var(--green-lt);font-weight:500':''); }
    else if (c.t === 'mxn') { cell = fmtMXN(v); extra = 'text-align:right;font-family:Barlow Condensed,sans-serif;color:var(--muted);font-size:12px'; }
    return `<td style="padding:8px 10px;${extra}">${cell}</td>`;
  }).join('') + '</tr>').join('');
  return `<div style="overflow-x:auto;border-top:1px solid rgba(238,240,240,0.04);border-bottom:1px solid rgba(238,240,240,0.04)"><table style="width:100%;border-collapse:collapse">
    <thead style="background:transparent"><tr>${headerHtml}</tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="'+cols.length+'" style="padding:40px;text-align:center;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;font-size:10px">Sin datos</td></tr>'}</tbody>
  </table></div>`;
}

function anExportCSV() {
  if (!_analisisData) return;
  const prods = _analisisFiltros.tab === 'marcas' ? (_analisisData.marcas || [])
              : _analisisFiltros.tab === 'grupos' ? (_analisisData.grupos || [])
              : anFiltrarProductos();
  let header, rows;
  if (_analisisFiltros.tab === 'marcas') {
    header = ['Marca','Productos','Stock Total','Movido','Valor Movido MXN'];
    rows = prods.map(p => [p.marca, p.productos, p.stock_total, p.movido, p.valor_movido]);
  } else if (_analisisFiltros.tab === 'grupos') {
    header = ['Grupo','Productos','Stock Total','Movido','Valor Movido MXN'];
    rows = prods.map(p => [p.grupo, p.productos, p.stock_total, p.movido, p.valor_movido]);
  } else {
    header = ['Clave','Descripción','Marca','Grupo','Stock Base','Stock Hoy','Movido','Prom/día','Prom/sem','Prom/mes','Días stock','Precio','Valor Movido','Valor Inventario'];
    rows = prods.map(p => [p.clave, p.desc, p.marca, p.grupo, p.stock_base, p.total, p.movido, p.prom_diario, p.prom_semanal, p.prom_mensual, p.dias_restantes, p.precio, p.valor_movido, p.valor_inventario]);
  }
  const csv = [header, ...rows].map(r => r.map(v => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g,'""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `analisis-${_analisisFiltros.tab}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  addLog('ok','CSV exportado',`${rows.length} filas`);
}

function anExportPDF() {
  if (!_analisisData) return;
  const w = window.open('', '_blank');
  if (!w) { alert('Permite popups para exportar PDF'); return; }
  const prods = _analisisFiltros.tab === 'marcas' ? (_analisisData.marcas || [])
              : _analisisFiltros.tab === 'grupos' ? (_analisisData.grupos || [])
              : anFiltrarProductos();
  const p = _analisisData.periodo;
  const k = _analisisData.kpis;
  const fmtMXN = (n) => '$' + (Math.round(n||0)).toLocaleString('es-MX');

  let tableHtml;
  if (_analisisFiltros.tab === 'marcas' || _analisisFiltros.tab === 'grupos') {
    const isMarca = _analisisFiltros.tab === 'marcas';
    tableHtml = `<table><thead><tr><th>${isMarca?'Marca':'Grupo'}</th><th>Productos</th><th>Stock</th><th>Movido</th><th>Valor</th></tr></thead><tbody>${
      prods.map(p => `<tr><td>${isMarca?p.marca:p.grupo}</td><td>${p.productos}</td><td>${p.stock_total.toLocaleString('es-MX')}</td><td><strong>${(p.movido||0).toLocaleString('es-MX')}</strong></td><td>${fmtMXN(p.valor_movido)}</td></tr>`).join('')
    }</tbody></table>`;
  } else {
    tableHtml = `<table><thead><tr><th>Clave</th><th>Descripción</th><th>Marca</th><th>Stock Hoy</th><th>Movido</th><th>P/día</th><th>Precio</th></tr></thead><tbody>${
      prods.slice(0, 500).map(p => `<tr><td>${p.clave}</td><td>${(p.desc||'').substring(0,60)}</td><td>${p.marca||''}</td><td>${p.total.toLocaleString('es-MX')}</td><td><strong>${(p.movido||0).toLocaleString('es-MX')}</strong></td><td>${p.prom_diario}</td><td>${fmtMXN(p.precio)}</td></tr>`).join('')
    }</tbody></table>`;
  }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Análisis CVA</title><style>
    body{font-family:Arial,sans-serif;padding:20px;font-size:11px;color:#222}
    h1{color:#00665e;font-size:18px;margin:0 0 4px;font-weight:500}
    .meta{color:#777;font-size:10px;margin-bottom:20px}
    .kpis{display:flex;gap:14px;margin-bottom:20px;flex-wrap:wrap}
    .kpi{padding:8px 14px;background:#f0f7f6;border-left:3px solid #00665e}
    .kpi b{display:block;font-size:14px;color:#00665e}
    .kpi span{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#888}
    table{width:100%;border-collapse:collapse;font-size:10px}
    th{background:#00665e;color:#fff;padding:6px 8px;text-align:left;font-size:9px;letter-spacing:1px;text-transform:uppercase}
    td{padding:5px 8px;border-bottom:1px solid #eee}
    tr:nth-child(even){background:#fafafa}
    @media print { @page { size: landscape; margin: 1cm } }
  </style></head><body>
    <h1>Análisis de Movimiento CVA</h1>
    <div class="meta">Periodo: ${p.fecha_inicio} → ${p.fecha_fin} · ${p.dias} días · Generado: ${new Date().toLocaleString('es-MX')}</div>
    <div class="kpis">
      <div class="kpi"><span>Productos</span><b>${fmtN(k.total_productos)}</b></div>
      <div class="kpi"><span>Con movimiento</span><b>${fmtN(k.con_movimiento)}</b></div>
      <div class="kpi"><span>Unidades movidas</span><b>${fmtN(k.unidades_movidas)}</b></div>
      <div class="kpi"><span>Valor movido</span><b>${fmtMXN(k.valor_movido_mxn)}</b></div>
      <div class="kpi"><span>Agotados</span><b>${fmtN(k.agotados_recientes)}</b></div>
    </div>
    ${tableHtml}
    <script>setTimeout(()=>window.print(),500)<\/script>
  </body></html>`);
  w.document.close();
  addLog('ok','PDF generado',`${prods.length} filas`);
}


function addLog(tipo, msg, detalle) {
  const ts = new Date().toLocaleTimeString('es-MX');
  _logEntries.unshift({ ts, tipo, msg, detalle: detalle || '' });
  if (_logEntries.length > 100) _logEntries.pop();
  const sub = document.getElementById('log-sb-sub');
  if (sub) sub.textContent = ts + ' — ' + msg;
  renderLog();
}

function renderLog() {
  const el = document.getElementById('log-entries');
  if (!el) return;
  if (!_logEntries.length) { el.innerHTML = '<div class="alert alert-info">Sin actividad registrada aún.</div>'; return; }
  const colors = { ok:'var(--green-lt)', error:'#e05555', warn:'var(--orange)', info:'rgba(238,240,240,0.4)' };
  el.innerHTML = _logEntries.map(e=>`
    <div style="display:flex;gap:14px;padding:12px 16px;border-bottom:1px solid rgba(238,240,240,0.06);align-items:flex-start">
      <div style="font-size:10px;color:rgba(238,240,240,0.3);white-space:nowrap;padding-top:2px;font-family:monospace">${e.ts}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;color:${colors[e.tipo]||colors.info}">${e.msg}</div>
        ${e.detalle?`<div style="font-size:11px;color:rgba(238,240,240,0.3);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.detalle}</div>`:''}
      </div>
      <div style="width:6px;height:6px;border-radius:50%;background:${colors[e.tipo]||colors.info};flex-shrink:0;margin-top:5px"></div>
    </div>`).join('');
}

function limpiarLog() { _logEntries = []; renderLog(); }

async function instalarTriggersUI() {
  closeSidebar();
  addLog('info', 'Instalando triggers en GAS...', 'sync cada 60min + polling pedidos cada 15min');
  try {
    const data = await api('instalar_triggers');
    if (data.ok) { addLog('ok', 'Triggers instalados', 'Sync 60min · Polling 15min'); showPage('log'); }
    else { addLog('error', 'Error instalando triggers', data.error); alert('Los triggers se instalan ejecutando instalarTriggers() desde el editor de GAS.'); }
  } catch(e) {
    addLog('warn', 'Instala manualmente: abre GAS → ejecuta instalarTriggers()', e.message);
    alert('Los triggers se instalan ejecutando instalarTriggers() desde el editor de GAS.');
  }
}

// ── EXPORTS ───────────────────────────────────────────────
function exportBuscarCSV() {
  if (!_buscarArts.length) return;
  const rows = [['Clave','Descripción','Marca','Precio','Moneda','Stock Suc.','Stock CEDIS']];
  _buscarArts.forEach(a=>rows.push([a.clave,a.descripcion,a.marca||'',a.precio||'',a.moneda||'MXN',a.disponible||0,a.disponibleCD||0]));
  downloadCSV(rows, 'CVA_Busqueda_'+new Date().toISOString().substring(0,10)+'.csv');
}
function exportBuscarPDF() {
  if (!_buscarArts.length) return;
  printPDF('Búsqueda CVA',['Clave','Descripción','Marca','Precio','Suc.','CEDIS'],
    _buscarArts.map(a=>[a.clave,a.descripcion,a.marca||'—',fmt(a.precio,a.moneda),a.disponible||0,a.disponibleCD||0]));
}
function exportCarritoCSV() {
  if (!carrito.length) return;
  const rows=[['Clave','Descripción','Marca','Precio Unit.','Cantidad','Total']];
  carrito.forEach(i=>rows.push([i.clave,i.desc,i.marca||'',i.precio,i.qty,(i.precio*i.qty).toFixed(2)]));
  downloadCSV(rows,'CVA_Carrito_'+new Date().toISOString().substring(0,10)+'.csv');
}
function exportCarritoPDF() {
  if (!carrito.length) return;
  const rows=carrito.map(i=>[i.clave,i.desc,i.marca||'—',fmt(i.precio,i.moneda),i.qty,fmt(i.precio*i.qty,i.moneda)]);
  printPDF('Carrito CVA — Electronics México',['Clave','Descripción','Marca','Precio c/u','Qty','Total'],rows,'TOTAL: '+fmt(carrito.reduce((s,i)=>s+i.precio*i.qty,0),'Pesos'));
}

function downloadCSV(rows, filename) {
  const csv = rows.map(r=>r.map(c=>{const s=String(c===null||c===undefined?'':c).replace(/"/g,'""');return(s.indexOf(',')>=0||s.indexOf('"')>=0||s.indexOf('\n')>=0)?'"'+s+'"':s}).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function printPDF(title, headers, rows, footer) {
  const w = window.open('','_blank','width=900,height=700');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;font-size:11px;color:#1e2025;padding:28px}h1{font-size:16px;font-weight:600;margin-bottom:4px;letter-spacing:1px;text-transform:uppercase}.meta{font-size:10px;color:#666;margin-bottom:18px;letter-spacing:1px}table{width:100%;border-collapse:collapse}th{background:#1e2025;color:#fff;padding:8px 10px;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;text-align:left}td{padding:7px 10px;border-bottom:1px solid #eee;font-size:11px}tr:nth-child(even)td{background:#f8f8f8}.footer{margin-top:14px;text-align:right;font-size:13px;font-weight:600;border-top:2px solid #00665e;padding-top:8px;color:#00665e}@media print{body{padding:12px}}</style>
  </head><body>
  <h1>${title}</h1><div class="meta">Generado: ${new Date().toLocaleString('es-MX')} · Electronics México</div>
  <table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
  ${footer?`<div class="footer">${footer}</div>`:''}
  </body></html>`);
  w.document.close();
  w.onload=()=>{w.focus();w.print();};
}

// ── CARRUSEL ──────────────────────────────────────────────
let _marcasCarousel = [];
const MARCAS_FALLBACK = ['HP','Dell','Lenovo','Epson','Canon','Samsung','LG','Asus','Acer','Toshiba','Brother','Logitech','Kingston','Western Digital','Seagate','Intel','AMD','Cisco','Ubiquiti','Hikvision','Dahua','Netgear','TP-Link','Belkin','Verbatim','Micron','Crucial','Corsair','MSI','Gigabyte','Viewsonic','BenQ','Targus','Fellowes','Plantronics','Jabra','Yealink','Motorola','Zebra','Honeywell'];
const GRUPOS_FALLBACK = ['LAPTOPS','IMPRESORAS','MONITORES','CABLES','CAMARAS','REDES','SERVIDORES','BOCINAS','AUDIFONOS','TABLETS','CELULARES','ACCESORIOS','ALMACENAMIENTO','PROYECTORES','CONSUMIBLES','SEGURIDAD','ENERGIA','GAMING','DRONES','SCANNERS','MEMORIAS','DISCOS DUROS','TECLADOS','MOUSE','WEBCAMS','UPS','SWITCHES','ROUTERS','ANTENAS','SOFTWARES','LICENCIAS','CARTUCHOS','TONERS'];

async function iniciarCarruselMarcas() {
  const track = document.getElementById('marcas-carousel-track');
  const wrap  = document.getElementById('marcas-carousel-wrap');
  if (!track || _marcasCarousel.length > 0) return;

  const fb = [
    ...MARCAS_FALLBACK.map(m=>({tipo:'marca',nombre:m,logo:''})),
    ...GRUPOS_FALLBACK.map(g=>({tipo:'grupo',nombre:g,logo:''}))
  ];
  _renderCarruselItems(fb, track);

  try {
    const [rM, rG] = await Promise.allSettled([apiConFallback('cva_marcas'), apiConFallback('cva_grupos')]);
    const marcas = (rM.status==='fulfilled' && rM.value?.ok) ? rM.value.marcas : [];
    const grupos = (rG.status==='fulfilled' && rG.value?.ok) ? rG.value.grupos : [];
    if (!marcas.length && !grupos.length) return;
    const items = [
      ...marcas.map(m=>({tipo:'marca',nombre:m.marca||m.nombre||'',logo:m.logo||''})),
      ...grupos.map(g=>({tipo:'grupo',nombre:g.nombre||g.grupo||g,logo:''}))
    ].filter(i=>i.nombre);
    if (wrap) { wrap.style.transition='opacity 0.4s ease'; wrap.style.opacity='0'; }
    setTimeout(()=>{
      _renderCarruselItems(items, track);
      if (wrap) { wrap.style.opacity='1'; setTimeout(()=>{wrap.style.transition='';},400); }
    }, 400);
  } catch(e) {}
}

function _renderCarruselItems(items, track) {
  if (!track) return;
  _marcasCarousel = items;
  const shuffled = [...items].sort(()=>Math.random()-0.5);
  const renderChip = (item) => {
    const nombre  = item.nombre.replace(/'/g,"\\'");
    const isGrupo = item.tipo === 'grupo';
    const onclick = isGrupo ? `filtrarPorGrupo('${nombre}')` : `filtrarPorMarca('${nombre}')`;
    return `<div class="marca-chip${isGrupo?' marca-chip-grupo':''}" onclick="${onclick}">
      ${item.logo?`<img src="${item.logo}" alt="${nombre}" onerror="this.style.display='none'">` : ''}
      <span class="marca-chip-name">${item.nombre}</span>
    </div>`;
  };
  const html = shuffled.map(renderChip).join('');
  track.innerHTML = html + html;
  const wrap = document.getElementById('marcas-carousel-wrap');
  if (wrap) initCarouselDrag(wrap, track);
}
function _renderCarruselMarcas(marcas, track) {
  _renderCarruselItems(marcas.map(m=>({tipo:'marca',nombre:m.marca||m.nombre||'',logo:m.logo||''})), track);
}

function initCarouselDrag(wrap, track) {
  let startX=0, scrollLeft=0, isDragging=false, animOffset=0;

  wrap.addEventListener('mousedown', e=>{
    isDragging=true; wrap.classList.add('dragging'); startX=e.pageX;
    const mat=window.getComputedStyle(track).transform;
    if(mat&&mat!=='none'){const vals=mat.match(/matrix.*\((.+)\)/)[1].split(', ');animOffset=parseFloat(vals[4])||0;}
    scrollLeft=animOffset;
    track.style.transform=`translateX(${animOffset}px)`; track.style.animation='none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e=>{
    if(!isDragging) return;
    let newX=scrollLeft+(e.pageX-startX);
    const half=track.scrollWidth/2;
    if(newX<-half) newX+=half; if(newX>0) newX-=half;
    track.style.transform=`translateX(${newX}px)`;
  });
  document.addEventListener('mouseup', ()=>{
    if(!isDragging) return;
    isDragging=false; wrap.classList.remove('dragging');
    const cur=track.style.transform;
    const match=cur.match(/translateX\((.+)px\)/);
    const curX=match?parseFloat(match[1]):0;
    const half=track.scrollWidth/2;
    const pct=Math.abs(curX/half)*100;
    track.style.animation=`marquee 500s linear ${-(pct/100)*500}s infinite`;
  });

  let touchMoved=false;
  wrap.addEventListener('touchstart',e=>{
    touchMoved=false; startX=e.touches[0].pageX;
    const mat=window.getComputedStyle(track).transform;
    if(mat&&mat!=='none'){const vals=mat.match(/matrix.*\((.+)\)/);animOffset=vals?(parseFloat(vals[1].split(', ')[4])||0):0;}else{animOffset=0;}
    scrollLeft=animOffset;
  },{passive:true});
  wrap.addEventListener('touchmove',e=>{
    const dx=e.touches[0].pageX-startX;
    if(!touchMoved&&Math.abs(dx)>5){touchMoved=true;track.style.animation='none';track.style.transform=`translateX(${animOffset}px)`;}
    if(!touchMoved) return;
    let newX=scrollLeft+dx; const half=track.scrollWidth/2;
    if(newX<-half) newX+=half; if(newX>0) newX-=half;
    track.style.transform=`translateX(${newX}px)`;
  },{passive:true});
  wrap.addEventListener('touchend',()=>{
    if(!touchMoved) return;
    const cur=track.style.transform;
    const match=cur.match(/translateX\((.+)px\)/);
    const curX=match?parseFloat(match[1]):0;
    const half=track.scrollWidth/2;
    const pct=Math.abs(curX/half)*100;
    track.style.animation=`marquee 500s linear ${-(pct/100)*500}s infinite`;
    touchMoved=false;
  });
}

// ── SPLASH WORD CLOUD ─────────────────────────────────────
function lanzarWordCloud(grupos) {
  const cloud = document.getElementById('splash-cloud');
  if (!cloud) return;
  cloud._alive = false;
  const isMobile = window.innerWidth < 600;
  const words = [...grupos].sort(()=>Math.random()-0.5);
  const sizes = isMobile ? [16,20,24,28,32,38,22,26,30,18,34,21,27] : [28,34,40,48,56,64,72,32,44,52,38,46,60,36,42];
  const alphas = [0.11,0.14,0.17,0.21,0.25,0.12,0.10,0.19,0.23,0.15];
  cloud.innerHTML = '';
  words.forEach((word,i)=>{
    const el=document.createElement('div');
    el.className='splash-word';
    el.textContent=word;
    el.style.fontSize=sizes[i%sizes.length]+'px';
    el.style.setProperty('--splash-word-color',`rgba(255,255,255,${alphas[i%alphas.length]})`);
    el.style.left='-200%'; el.style.top='-200%';
    cloud.appendChild(el);
  });
  cloud.classList.add('visible');
  cloud._alive=true;

  function getLogoZone() {
    const logo=document.getElementById('splash-logo');
    if(!logo) return null;
    const r=logo.getBoundingClientRect();
    if(r.width===0) return null;
    const vw=window.innerWidth, vh=window.innerHeight, pad=isMobile?30:50;
    return {x1:(r.left-pad)/vw*100,y1:(r.top-pad)/vh*100,x2:(r.right+pad)/vw*100,y2:(r.bottom+pad)/vh*100};
  }
  function enZonaLogo(x,y){const z=getLogoZone();if(!z) return false;return x>z.x1&&x<z.x2&&y>z.y1&&y<z.y2;}

  const cols=isMobile?3:4, rows=isMobile?6:5;
  const sectores=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) sectores.push({c,r});

  function posicionEnSector(sec){
    const cw=100/cols,rh=100/rows;
    return {x:sec.c*cw+cw*0.1+Math.random()*cw*0.8, y:sec.r*rh+rh*0.1+Math.random()*rh*0.8};
  }

  Array.from(cloud.querySelectorAll('.splash-word')).forEach((el,i)=>{
    let sectorIdx=i%sectores.length;
    const startDelay=i*280;
    function ciclo(){
      if(!cloud._alive) return;
      let pos, tries=0;
      do{pos=posicionEnSector(sectores[(sectorIdx+tries)%sectores.length]);tries++;}
      while(enZonaLogo(pos.x,pos.y)&&tries<sectores.length);
      sectorIdx=(sectorIdx+3)%sectores.length;
      el.style.left=pos.x+'%'; el.style.top=pos.y+'%';
      setTimeout(()=>{
        if(!cloud._alive) return;
        el.classList.add('show');
        const stayMs=3000+Math.random()*3000;
        setTimeout(()=>{
          if(!cloud._alive) return;
          el.classList.remove('show');
          setTimeout(ciclo,400+Math.random()*500);
        },stayMs);
      },60);
    }
    setTimeout(ciclo,startDelay);
  });
}

// ── INIT ──────────────────────────────────────────────────
window.onload = () => {
  const splash     = document.getElementById('splash');
  const shell      = document.querySelector('.shell');

  let _cloudWords = [...GRUPOS_FALLBACK,...MARCAS_FALLBACK].sort(()=>Math.random()-0.5);
  Promise.allSettled([
    Promise.race([api('cva_grupos'),new Promise((_,r)=>setTimeout(()=>r(),700))]),
    Promise.race([api('cva_marcas'),new Promise((_,r)=>setTimeout(()=>r(),700))])
  ]).then(([rG,rM])=>{
    const g=(rG.status==='fulfilled'&&rG.value?.ok&&rG.value.grupos?.length)?rG.value.grupos.map(x=>x.nombre||x.grupo||x).filter(Boolean):GRUPOS_FALLBACK;
    const m=(rM.status==='fulfilled'&&rM.value?.ok&&rM.value.marcas?.length)?rM.value.marcas.map(x=>x.marca||x.nombre||x).filter(Boolean):MARCAS_FALLBACK;
    _cloudWords=[...g,...m].sort(()=>Math.random()-0.5);
  }).catch(()=>{});

  setTimeout(()=>{ requestAnimationFrame(()=>splash.classList.add('phase-1')); const by=document.getElementById('splash-by'); if(by) by.style.opacity='1'; }, 800);
  setTimeout(()=>lanzarWordCloud(_cloudWords), 1800);
  setTimeout(()=>{
    splash.classList.add('phase-2');
    setTimeout(()=>shell.classList.add('visible'),200);
    setTimeout(()=>splash.remove(),900);
  }, 7500);

  try { document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); const pg=document.getElementById('page-tablero'); if(pg) pg.classList.add('active'); document.body.classList.add('in-tablero'); const exist=document.getElementById('s-exist'); if(exist&&!exist.value) exist.value='3'; } catch(e) {}
  try { history.replaceState({page:'tablero'},'',''); } catch(e) {}
  try { toggleFleteFields(); } catch(e) {}
  try { poblarSelectEstados(); } catch(e) {}
  try { renderCarrito(); } catch(e) {}
  try { iniciarCarruselMarcas(); } catch(e) {}
  try { renderLog(); } catch(e) {}
  // Pre-cargar sucursales en background para que ya estén listas al entrar a Orden
  try { cargarSucursalesSelect(); } catch(e) {}
  // Cargar saldo CVA en background
  try { cargarSaldo(); } catch(e) {}
  // Cargar METADATA del Sheet en background — para que Exportar Datos,
  // Buscar productos, etc. vean modelos correctos desde el primer momento
  // (sin tener que pasar por Análisis primero).
  try { _loadMetadataFromSheet_(); } catch(e) {}

  // (La sección Exportar Datos ya existe como page-exportar / card del tablero)

  api('ping').then(d=>{
    const b = document.getElementById('badge-cva');
    if (d.ok) {
      if (b) b.textContent = 'CVA ✓';
    }
  }).catch(()=>{
    // GAS no responde — activar modo directo y mostrar badge
    _gasOk = false;
    const b = document.getElementById('badge-cva');
    if (b) { b.textContent = 'CVA ✓ (directo)'; b.style.color = 'var(--orange)'; b.style.borderColor = 'rgba(200,151,58,0.4)'; }
    addLog('warn', 'GAS no disponible — modo CVA directo activo', 'Búsquedas y pedidos funcionan. Sync/Odoo no disponibles hasta medianoche.');
  });
};

// ── EXPONER AL SCOPE GLOBAL ───────────────────────────────
// ════════════════════════════════════════════════════════════════
//  MÓDULO DE PRECIOS — extensión del análisis de movimiento
//
//  Toggle "modo ventas / modo precios" en el dashboard. En modo
//  precios, el grupo central de columnas (de Promedio a Valor Mov)
//  se reemplaza por las columnas de plataformas (MELI, Walmart,
//  Coppel, etc.) con precios calculados en vivo.
//
//  Persistencia: TODO se guarda en localStorage por clave de producto.
//  Modelo extraído manualmente, color corregido, UPC dictado por CVA,
//  % de ganancia individual — todo persiste entre sesiones.
// ════════════════════════════════════════════════════════════════

// ── ESTADO ───────────────────────────────────────────────────
const LS_KEY_MD       = 'cva_metadata_productos_v1';
const LS_KEY_GANANCIA = 'cva_ganancia_global_v1';

let _modoVistaTabla = 'ventas';     // 'ventas' | 'datos' | 'precios'
let _metadataProductos = {};        // { "MARCA-CLAVE": {modelo, color, upc, ganancia, cat_meli, peso, editado_at} }
let _gananciaGlobal = 5;            // % default; mínimo 5

function _loadMetadataLS_() {
  try {
    _metadataProductos = JSON.parse(localStorage.getItem(LS_KEY_MD) || '{}') || {};
    const g = parseFloat(localStorage.getItem(LS_KEY_GANANCIA) || '5');
    _gananciaGlobal = (g >= 5) ? g : 5;
  } catch(e) {
    console.warn('Metadata localStorage corrupto, reseteando:', e);
    _metadataProductos = {};
    _gananciaGlobal = 5;
  }
}
function _saveMetadataLS_() {
  try { localStorage.setItem(LS_KEY_MD, JSON.stringify(_metadataProductos)); } catch(e) {}
}
function _saveGananciaLS_() {
  try { localStorage.setItem(LS_KEY_GANANCIA, String(_gananciaGlobal)); } catch(e) {}
}
function _mdKey_(p) { return (p.marca||'').toUpperCase() + '-' + (p.clave||''); }

function _getMD_(p) {
  return _metadataProductos[_mdKey_(p)] || {};
}
function _setMD_(p, campo, valor) {
  const k = _mdKey_(p);
  if (!_metadataProductos[k]) _metadataProductos[k] = {};
  _metadataProductos[k][campo] = valor;
  _metadataProductos[k].editado_at = new Date().toISOString();
  _saveMetadataLS_();
  // Sincronización con Sheet — fire-and-forget, no bloquea la UI
  _pushMetadataToSheet_(p, campo, valor);
}

// ── SINCRONIZACIÓN CON GOOGLE SHEET ────────────────────────────
// El localStorage es cache rápida + offline; la fuente de verdad
// vive en el Sheet (hoja METADATA_PRODUCTOS). Los cambios suben en
// background después de cada edición. Si la red falla, el cambio
// queda en localStorage y se reintenta en futuras sincronizaciones.

// Cola de cambios pendientes de subir (si falla la red)
let _mdPendientes = [];

async function _pushMetadataToSheet_(p, campo, valor) {
  const update = {
    clave: p.clave || '',
    marca: p.marca || '',
  };
  update[campo] = valor === '' || valor == null ? null : valor;
  try {
    const res = await apiPost('metadata_set', update);
    if (res && res.ok) return true;
    _mdPendientes.push(update);
    return false;
  } catch(e) {
    console.warn('metadata sync falló, agregado a pendientes:', e.message);
    _mdPendientes.push(update);
    return false;
  }
}

// Carga la metadata del Sheet al iniciar el análisis o al recargar.
// El Sheet es la FUENTE DE VERDAD: pisa lo que sea que esté en localStorage.
// Esto garantiza que si editas un modelo en el sheet (manualmente o via UPC import),
// la PWA refleje el cambio al recargar.
async function _loadMetadataFromSheet_() {
  try {
    const res = await api('metadata_get', {});
    if (res && res.ok && res.metadata) {
      // PISAR completamente: el sheet es la fuente de verdad.
      // Antes hacíamos merge con localStorage, pero eso impedía que
      // los cambios del sheet se vieran en la PWA. Ahora el sheet gana.
      Object.keys(res.metadata).forEach(k => {
        _metadataProductos[k] = res.metadata[k];
      });
      _saveMetadataLS_();
      console.log('[metadata] Cargados ' + res.total + ' productos desde Sheet (pisó cache local)');
      // Intentar subir los pendientes si los hay
      if (_mdPendientes.length > 0) {
        const batch = _mdPendientes.splice(0);
        try { await apiPost('metadata_set', { updates: batch }); } catch(e) {}
      }
      return res.total;
    }
  } catch(e) {
    console.warn('No se pudo cargar metadata del Sheet (uso solo localStorage):', e.message);
  }
  return 0;
}

// ── HEURÍSTICA: EXTRAER MODELO DE LA DESCRIPCIÓN ─────────────
// Score por token: alfanumérico mixto +20, longitud 4-15 +5, no excluido
// +10, mayúsculas +2, primer token plausible +3.
const _MODELO_EXCLUIDAS = new Set([
  // Specs / unidades
  'GB','TB','MB','KB','RAM','ROM','SSD','HDD','NVME','USB','USB2','USB3','HDMI','VGA','DVI','BT','WIFI','LAN',
  'RGB','FHD','UHD','QHD','HD','4K','8K','IPS','OLED','LED','LCD','AMOLED','MAH','MHZ','GHZ','HZ','WATT','W','KG','KW','AMP','MA','V','A',
  // Procesadores
  'I3','I5','I7','I9','RYZEN','INTEL','AMD','RTX','GTX','NVIDIA','ATHLON','CELERON','PENTIUM',
  // OS
  'WIN10','WIN11','WINDOWS','MACOS','LINUX','ANDROID','IOS','CHROMEOS','CHROME',
  // Palabras genéricas
  'CON','SIN','DE','EL','LA','LOS','LAS','PARA','POR','EN','Y','O','AL','UN','UNA',
  'INALAMBRICO','INALAMBRICOS','INALAMBRICA','INALAMBRICAS','ALAMBRICO','ALAMBRICA',
  'BLUETOOTH','OPTICO','MECANICO','GAMING','ESTUCHE','AURICULARES','AUDIFONOS','BOCINA',
  'LAPTOP','MONITOR','TABLET','TABLETA','TELEFONO','CELULAR','SMARTPHONE','IMPRESORA','TECLADO','MOUSE',
  'PULGADAS','PULGADA','CON','APLICA','NUEVO','NUEVA','MODELO',
  // Colores español
  'NEGRO','BLANCO','AZUL','ROJO','VERDE','ROSA','MORADO','AMARILLO','PLATA','PLATEADO','DORADO','ORO','GRIS','NARANJA','CAFE','MARRON','TURQUESA','BEIGE','COSMIC',
  // Colores inglés
  'BLACK','WHITE','BLUE','RED','GREEN','PINK','PURPLE','YELLOW','SILVER','GOLD','GRAY','GREY','ORANGE','BROWN',
]);

function _extraerModelo_(desc, marca) {
  if (!desc) return null;
  // Tokenizar — partir por espacios pero mantener guiones internos como parte del token
  const tokens = desc.toUpperCase().split(/[\s,;:()\/]+/).filter(Boolean);
  const marcaUpper = (marca||'').toUpperCase();

  let best = null, bestScore = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // Quitar guiones internos para análisis pero conservar el original
    const tBare = t.replace(/[\-\.]/g, '');
    if (tBare.length < 3) continue;
    if (t === marcaUpper) continue;
    if (_MODELO_EXCLUIDAS.has(t) || _MODELO_EXCLUIDAS.has(tBare)) continue;
    // Excluir tokens que terminan en GB/TB/MB seguido de números (ej. 8GB, 256GB)
    if (/^\d+(GB|TB|MB|KB|MAH|MHZ|GHZ|W|KG)$/.test(t)) continue;
    // Excluir resoluciones tipo 1920X1080
    if (/^\d+X\d+$/.test(t)) continue;

    const tieneLetras = /[A-Z]/.test(tBare);
    const tieneNumeros = /\d/.test(tBare);

    let score = 0;
    if (tieneLetras && tieneNumeros) score += 20;
    if (tBare.length >= 4 && tBare.length <= 15) score += 5;
    if (/^[A-Z]/.test(tBare)) score += 2;
    if (!/^\d+$/.test(tBare)) score += 5;
    if (i <= 3) score += 3;
    if (tieneLetras && !tieneNumeros) score -= 5; // solo letras = palabra
    if (!tieneLetras && !tieneNumeros) score -= 10;

    if (score > bestScore) { bestScore = score; best = t; }
  }
  // Umbral mínimo
  return bestScore >= 25 ? best : null;
}

// ── HEURÍSTICA: EXTRAER COLOR DE LA DESCRIPCIÓN ───────────────
const _COLORES_MAP = [
  // [regex, abreviatura 3 letras]
  [/\b(NEGRO|BLACK|NEGRA|NOIR|COSMIC[\s-]?BLACK|GRAPHITE)\b/i, 'NEG'],
  [/\b(BLANCO|WHITE|BLANCA)\b/i, 'BLA'],
  [/\b(AZUL|BLUE|AZUR|NAVY)\b/i, 'AZU'],
  [/\b(ROJO|RED|ROJA|CRIMSON)\b/i, 'ROJ'],
  [/\b(VERDE|GREEN|MINT|OLIVE)\b/i, 'VER'],
  [/\b(AMARILLO|YELLOW|GOLDEN)\b/i, 'AMA'],
  [/\b(PLATA|SILVER|PLATEADO|GRAY[\s-]?SILVER)\b/i, 'PLA'],
  [/\b(GRIS|GRAY|GREY|TITANIUM)\b/i, 'GRI'],
  [/\b(DORADO|GOLD|ORO)\b/i, 'DOR'],
  [/\b(ROSA|PINK|ROSADO)\b/i, 'ROS'],
  [/\b(MORADO|PURPLE|VIOLETA)\b/i, 'MOR'],
  [/\b(NARANJA|ORANGE)\b/i, 'NAR'],
  [/\b(CAFE|BROWN|MARRON)\b/i, 'CAF'],
  [/\b(BEIGE|CREAM|CREMA)\b/i, 'BEI'],
  [/\b(TURQUESA|TURQUOISE|TEAL)\b/i, 'TUR'],
];
function _extraerColor_(desc) {
  if (!desc) return null;
  for (const [re, abrev] of _COLORES_MAP) {
    if (re.test(desc)) return abrev;
  }
  return null;
}

// ── MAPEO GRUPO CVA → CATEGORÍA MELI ─────────────────────────
function _mapeoCategoriaMELI_(grupo) {
  const g = (grupo||'').toUpperCase();
  if (/TELEFON|CELULAR|SMARTPHONE/.test(g)) return 'Celulares y smartphones';
  if (/AUDIO|BOCINA|AUDIFON/.test(g))       return 'Audio y video';
  if (/MONITOR|TELEVISOR|PROYECT|TV/.test(g)) return 'Audio y video';
  if (/CAMARA|VIDEOVIG|FOTOGRAF/.test(g))   return 'Cámaras y drones';
  if (/COMPUTO|LAPTOP|COMPUTAD|TABLET/.test(g)) return 'Computación e impresión';
  if (/IMPRESION|CONSUMIBLE|TONER|CARTUCH/.test(g)) return 'Computación e impresión';
  if (/GAMING|VIDEOJUEGO|CONSOLA/.test(g))  return 'Consolas de videojuegos';
  if (/REDES|CABLE|ACCESORIO|MEMORIA|ALMACENA|USB/.test(g)) return 'Accesorios electrónicos';
  return 'Accesorios electrónicos';
}

// ── MAPEO GRUPO CVA → PESO DEFAULT ───────────────────────────
function _pesoDefaultPorGrupo_(grupo) {
  const g = (grupo||'').toUpperCase();
  if (/MEMORIA|USB|CABLE|AUDIFON/.test(g))  return 'Hasta 0.5 Kg';
  if (/TELEFON|CELULAR|BOCINA/.test(g))      return '0.5 a 1 kg';
  if (/LAPTOP|TABLET/.test(g))                return '2 a 3 kg';
  if (/MONITOR|IMPRESORA/.test(g))            return '5 a 10 kg';
  if (/TELEVISOR|PROYECT|TV[\s-]/.test(g))    return '10 a 15 kg';
  return '1 a 2 kg';
}

// ── COMISIONES MELI (de la tabla del cotizador) ───────────────
// % de comisión clásica por categoría MELI
const _COMISIONES_MELI = {
  'Audio y video'              : 0.125,
  'Celulares y smartphones'    : 0.11,
  'Computación e impresión'    : 0.11,
  'Cámaras y drones'           : 0.11,
  'Accesorios electrónicos'    : 0.14,
  'Consolas de videojuegos'    : 0.09,
};
function _comisionMELI_(cat) { return _COMISIONES_MELI[cat] || 0.14; }

// ── COSTO DE ENVÍO POR PESO (MELI Mexico, aprox.) ─────────────
const _ENVIOS_MELI = {
  'Hasta 0.5 Kg' : 70,
  '0.5 a 1 kg'   : 90,
  '1 a 2 kg'     : 120,
  '2 a 3 kg'     : 150,
  '3 a 5 kg'     : 180,
  '5 a 10 kg'    : 240,
  '10 a 15 kg'   : 320,
  '15 a 25 kg'   : 450,
};
function _envioMELIporPeso_(peso) { return _ENVIOS_MELI[peso] || 150; }

// ── ARMADO DE SKU GENERAL ────────────────────────────────────
// Réplica de la fórmula original pero con CLAVE_CVA en lugar de
// últimos 4 dígitos de referencia, y `-CVA-` como separador.
//   3 letras MARCA + "-" + MODELO + "-" + 3 letras COLOR + "-CVA-" + CLAVE_CVA
function _calcularSKU_(marca, modelo, color, claveCVA) {
  const m  = ((marca||'').toUpperCase()).substring(0, 3);
  const mo = (modelo||'').toUpperCase().replace(/\s+/g, '');
  const c  = ((color||'').toUpperCase()).substring(0, 3);
  const k  = (claveCVA||'').toString().toUpperCase().replace(/\s+/g, '');
  return `${m}-${mo}-${c}-CVA-${k}`.replace(/\s+/g, '');
}

// ── CÁLCULO DE PRECIO MELI CLÁSICA (la base) ─────────────────
//   costos  = costo<=298 ?  costo*(1+comision)+33  :  costo*(1+comision)+envio
//   precio  = costos * (1 + ganancia)
function _calcularMELIClasica_(costo, categoria, peso, gananciaPct) {
  if (!costo || costo <= 0) return 0;
  const comision = _comisionMELI_(categoria);
  const envio    = _envioMELIporPeso_(peso);
  const costos = costo <= 298
    ? costo * (1 + comision) + 33
    : costo * (1 + comision) + envio;
  return costos * (1 + (gananciaPct || 5) / 100);
}

// ── PRECIOS DERIVADOS DE LAS 11 PLATAFORMAS ──────────────────
// roundDown a múltiplo de 10 + 9 (terminación psicológica común)
function _r9_(n) { return Math.floor(n / 10) * 10 + 9; }
function _calcularPreciosPlataformas_(meliClasica, costoCVA) {
  if (!meliClasica || meliClasica <= 0) {
    return { meli_clasica:0, meli_premium:0, walmart_clasica:0, walmart_premium:0,
             tienda_nube:0, coppel:0, sears:0, liverpool:0, elektra:0,
             aliexpress:0, totalplay:0, tiktok:0 };
  }
  const meli_clasica   = _r9_(meliClasica);
  const meli_premium   = _r9_(meli_clasica * 1.05);
  const walmart_clasica = meli_premium < 400
    ? _r9_(meli_premium + 150)
    : _r9_(meli_premium);
  const walmart_premium = _r9_(walmart_clasica * 1.05);
  // Tienda Nube: costo_cva * 1.16 * 1.073 + envío escalonado
  const tn_base = (costoCVA || 0) * 1.16 * 1.073;
  let tn_envio = 300;
  if (tn_base <= 2000) tn_envio = 0;
  else if (tn_base <= 3000) tn_envio = 100;
  else if (tn_base > 15000) tn_envio = 600;
  const tienda_nube = _r9_(tn_base + tn_envio);
  const coppel      = walmart_premium;
  const sears       = _r9_(walmart_premium * 1.02);
  const liverpool   = walmart_premium + 100;
  const elektra     = _r9_(walmart_clasica * 1.02);
  const aliexpress  = _r9_(walmart_premium * 0.98);
  const totalplay   = walmart_premium;
  const tiktok      = Math.floor(meli_clasica / 10) * 10 + 9;
  return { meli_clasica, meli_premium, walmart_clasica, walmart_premium,
           tienda_nube, coppel, sears, liverpool, elektra,
           aliexpress, totalplay, tiktok };
}

// ── COMPUTO DE METADATA + PRECIOS POR PRODUCTO (con cache) ───
// Combina:
//   1. metadata extraída automáticamente (modelo/color por heurística)
//   2. overrides del usuario en localStorage (modelo/color/upc/ganancia editados)
//   3. cálculo de precios con la ganancia (individual o global)
// Devuelve un objeto enriquecido con todos los campos calculados.
function _enriquecerProducto_(p) {
  const md = _getMD_(p);
  // Modelo
  const modeloAuto = _extraerModelo_(p.desc, p.marca);
  const modelo = md.modelo || modeloAuto || 'SINMODELO';
  const modeloEsAuto = !md.modelo && modeloAuto && modelo === modeloAuto;
  const modeloEsDefault = !modeloAuto && !md.modelo;
  // Color
  const colorAuto = _extraerColor_(p.desc);
  const color = md.color || colorAuto || 'NEG';
  const colorEsDefault = !colorAuto && !md.color;
  // UPC
  const upc = md.upc || '';
  const upcVacio = !upc;
  // Categoría MELI / peso
  const catMeli = md.cat_meli || _mapeoCategoriaMELI_(p.grupo);
  const peso    = md.peso    || _pesoDefaultPorGrupo_(p.grupo);
  // Ganancia (individual sobreescribe global)
  const ganancia = (md.ganancia != null) ? md.ganancia : _gananciaGlobal;
  // SKU
  const sku = _calcularSKU_(p.marca, modelo, color, p.clave);
  // Precios
  const meliBruto = _calcularMELIClasica_(p.precio, catMeli, peso, ganancia);
  const precios   = _calcularPreciosPlataformas_(meliBruto, p.precio);
  return {
    ...p,
    _modelo: modelo, _modeloEsDefault: modeloEsDefault,
    _color: color, _colorEsDefault: colorEsDefault,
    _upc: upc, _upcVacio: upcVacio,
    _cat_meli: catMeli, _peso: peso, _ganancia: ganancia,
    _sku: sku,
    _precios: precios,
    _gananciaIndividual: md.ganancia != null,
  };
}

// ── HANDLERS DE INPUTS EDITABLES ─────────────────────────────
function anEditarMD(claveCVA, marca, campo, valor) {
  const pseudoP = { clave: claveCVA, marca: marca };
  // Valores vacíos en algunos campos = quitar el override (vuelve al auto/global)
  if ((campo === 'ganancia') && (valor === '' || valor == null)) {
    const k = _mdKey_(pseudoP);
    if (_metadataProductos[k]) {
      delete _metadataProductos[k].ganancia;
      _saveMetadataLS_();
    }
    // También limpiar en el Sheet (null borra el override)
    _pushMetadataToSheet_(pseudoP, 'ganancia', null);
    renderAnalisisTab();
    return;
  }
  let v = valor;
  if (campo === 'ganancia') v = parseFloat(valor);
  if (campo === 'upc')      v = String(valor).replace(/\D/g, ''); // solo dígitos
  if (['modelo','color','cat_meli','peso'].includes(campo)) v = String(valor).toUpperCase().trim();
  _setMD_(pseudoP, campo, v);
  renderAnalisisTab();
}

function anCambiarGananciaGlobal(valor) {
  let v = parseFloat(valor);
  if (isNaN(v) || v < 5) v = 5;
  _gananciaGlobal = v;
  _saveGananciaLS_();
  renderAnalisisTab();
}

function anSetModoVista(modo) {
  if (!['ventas','datos','precios'].includes(modo)) modo = 'ventas';
  _modoVistaTabla = modo;
  renderAnalisisDashboard();
}

// Cargar localStorage al iniciar el módulo
try { _loadMetadataLS_(); } catch(e) {}

// ════════════════════════════════════════════════════════════════
//  RENDER DE LA TABLA DE PRECIOS (modo precios)
//  Reemplaza el bloque central de columnas en renderAnalisisTab
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
//  RENDER DE COLUMNAS: MODO DATOS (Modelo, Color, UPC, Cat. MELI, Peso, SKU)
//  Editables — para llenar y corregir la info que se guarda en
//  localStorage + Sheet
// ════════════════════════════════════════════════════════════════

function _renderColumnasDatosHeader_() {
  const cols = ['Modelo','Color','UPC','Cat. MELI','Peso','SKU'];
  return cols.map(l => `<th style="padding:8px 6px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);text-align:left;border-bottom:1px solid rgba(238,240,240,0.1);white-space:nowrap">${l}</th>`).join('');
}

function _renderColumnasDatosFila_(p) {
  const e = _enriquecerProducto_(p);
  const claveSafe = (p.clave||'').replace(/'/g, "\\'");
  const marcaSafe = (p.marca||'').replace(/'/g, "\\'");
  const inputBase = 'background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:4px 6px;font-size:11px;outline:none;font-family:inherit;width:100%';
  const cellBase = 'padding:4px 4px;border-right:1px solid rgba(238,240,240,0.03);vertical-align:middle';
  const rojoBg = 'background:rgba(224,85,85,0.18);border-color:rgba(224,85,85,0.5)';

  const inpModelo = `<input type="text" value="${e._modelo}" onchange="anEditarMD('${claveSafe}','${marcaSafe}','modelo',this.value)" style="${inputBase};${e._modeloEsDefault?rojoBg:''};min-width:120px" placeholder="Modelo">`;
  const inpColor  = `<input type="text" value="${e._color}" onchange="anEditarMD('${claveSafe}','${marcaSafe}','color',this.value)" style="${inputBase};${e._colorEsDefault?rojoBg:''};min-width:55px;text-align:center" maxlength="3">`;
  const inpUPC    = `<input type="text" value="${e._upc}" onchange="anEditarMD('${claveSafe}','${marcaSafe}','upc',this.value)" style="${inputBase};${e._upcVacio?rojoBg:''};min-width:140px;font-family:monospace;font-size:10px" placeholder="000000000000" maxlength="14">`;
  const inpCatMeli= `<input type="text" value="${e._cat_meli}" onchange="anEditarMD('${claveSafe}','${marcaSafe}','cat_meli',this.value)" style="${inputBase};min-width:160px;font-size:10px">`;
  const inpPeso   = `<input type="text" value="${e._peso}" onchange="anEditarMD('${claveSafe}','${marcaSafe}','peso',this.value)" style="${inputBase};min-width:110px;font-size:10px">`;
  const txtSku    = `<span style="font-family:monospace;color:var(--green-lt);font-size:10px;display:inline-block;min-width:160px;white-space:nowrap">${e._sku}</span>`;

  return `
    <td style="${cellBase}">${inpModelo}</td>
    <td style="${cellBase}">${inpColor}</td>
    <td style="${cellBase}">${inpUPC}</td>
    <td style="${cellBase}">${inpCatMeli}</td>
    <td style="${cellBase}">${inpPeso}</td>
    <td style="${cellBase}">${txtSku}</td>
  `;
}

// ════════════════════════════════════════════════════════════════
//  RENDER DE COLUMNAS: MODO PRECIOS (%Gan + 12 plataformas)
//  Solo precios calculados — el %Gan se queda aquí para poder
//  ajustarlo y ver los precios recalcular al instante
// ════════════════════════════════════════════════════════════════

function _renderColumnasPreciosHeader_() {
  const cols = [
    '% Gan','MELI Clás','MELI Prem','Wmt Clás','Wmt Prem',
    'T. Nube','Coppel','Sears','Liverpool','Elektra','AliEx','TotalP','TikTok'
  ];
  return cols.map(l => `<th style="padding:8px 6px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);text-align:right;border-bottom:1px solid rgba(238,240,240,0.1);white-space:nowrap">${l}</th>`).join('');
}

function _renderColumnasPreciosFila_(p) {
  const e = _enriquecerProducto_(p);
  const claveSafe = (p.clave||'').replace(/'/g, "\\'");
  const marcaSafe = (p.marca||'').replace(/'/g, "\\'");
  const inputBase = 'background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:4px 6px;font-size:11px;outline:none;font-family:inherit;width:60px;text-align:right';
  const cellBase = 'padding:4px 4px;border-right:1px solid rgba(238,240,240,0.03);vertical-align:middle';

  const inpGan = `<input type="number" min="0" step="0.5" value="${e._ganancia}" onchange="anEditarMD('${claveSafe}','${marcaSafe}','ganancia',this.value)" style="${inputBase};${e._gananciaIndividual?'border-color:var(--green-lt);color:var(--green-lt)':''}" title="${e._gananciaIndividual?'% individual':'% global ('+_gananciaGlobal+'%)'}">`;

  const precio = (n, colorTag) => {
    if (!n) return `<td style="${cellBase};text-align:right;color:rgba(238,240,240,0.2)">—</td>`;
    return `<td style="${cellBase};text-align:right;font-family:Barlow Condensed,sans-serif;font-size:13px;${colorTag||''}">$${n.toLocaleString('es-MX')}</td>`;
  };

  return `
    <td style="${cellBase};text-align:right">${inpGan}</td>
    ${precio(e._precios.meli_clasica, 'color:var(--green-lt);font-weight:500')}
    ${precio(e._precios.meli_premium)}
    ${precio(e._precios.walmart_clasica)}
    ${precio(e._precios.walmart_premium)}
    ${precio(e._precios.tienda_nube)}
    ${precio(e._precios.coppel)}
    ${precio(e._precios.sears)}
    ${precio(e._precios.liverpool)}
    ${precio(e._precios.elektra)}
    ${precio(e._precios.aliexpress)}
    ${precio(e._precios.totalplay)}
    ${precio(e._precios.tiktok)}
  `;
}

// ════════════════════════════════════════════════════════════════
//  EXPORT XLSX REAL — con todas las columnas según el modo activo
// ════════════════════════════════════════════════════════════════

// UPC con padding a 12 dígitos (ceros a la izquierda), como texto.
// Si viene vacío devuelve ''. Si trae más de 12 dígitos (EAN-13/14) lo respeta.
// Se usa en todos los exports para que Excel muestre el UPC completo
// sin comerse los ceros iniciales.
function _upc12_(upc) {
  const limpio = String(upc || '').replace(/\D/g, '');
  if (!limpio) return '';
  return limpio.length < 12 ? limpio.padStart(12, '0') : limpio;
}

async function anExportXLSX() {
  if (!_analisisData) return;
  // Cargar SheetJS si no está
  if (typeof XLSX === 'undefined') {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    }).catch(() => { alert('No se pudo cargar SheetJS, se descargará CSV en su lugar'); anExportCSV(); return; });
  }
  if (typeof XLSX === 'undefined') return;

  const prods = anFiltrarProductos();
  const fmtMXN = n => Number(n || 0);
  // Excel SIEMPRE trae todas las columnas — los 3 modos combinados.
  // El modo de la PWA solo controla qué vista ves en pantalla; el export
  // se baja completo independientemente de qué modo tengas activo.
  const headerBase   = ['Clave CVA','Descripción','Marca','Grupo','Stock Inicial','Stock Hoy','Movido','Precio CVA'];
  const headerDatos  = ['Modelo','Color','UPC','Cat. MELI','Peso','SKU'];
  const headerPrecios= ['% Gan','MELI Clás','MELI Prem','Walmart Clás','Walmart Prem',
                        'Tienda Nube','Coppel','Sears','Liverpool','Elektra','AliExpress','TotalPlay','TikTok'];
  const headerVentas = ['Prom/día','Prom/sem','Prom/mes','Días stock','Valor Movido','Valor Inventario'];
  const header = [...headerBase, ...headerDatos, ...headerPrecios, ...headerVentas];

  // Filas
  const rows = prods.map(p => {
    const e = _enriquecerProducto_(p);
    return [
      // Base (8)
      p.clave, p.desc, p.marca, p.grupo, p.stock_base||0, p.total||0, p.movido||0, fmtMXN(p.precio),
      // Datos (6)
      e._modelo, e._color, _upc12_(e._upc), e._cat_meli, e._peso, e._sku,
      // Precios (13)
      e._ganancia,
      fmtMXN(e._precios.meli_clasica), fmtMXN(e._precios.meli_premium),
      fmtMXN(e._precios.walmart_clasica), fmtMXN(e._precios.walmart_premium),
      fmtMXN(e._precios.tienda_nube), fmtMXN(e._precios.coppel),
      fmtMXN(e._precios.sears), fmtMXN(e._precios.liverpool),
      fmtMXN(e._precios.elektra), fmtMXN(e._precios.aliexpress),
      fmtMXN(e._precios.totalplay), fmtMXN(e._precios.tiktok),
      // Ventas (6)
      p.prom_diario||0, p.prom_semanal||0, p.prom_mensual||0,
      p.dias_restantes!=null?p.dias_restantes:'',
      fmtMXN(p.valor_movido), fmtMXN(p.valor_inventario),
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  // Header style
  for (let c = 0; c < header.length; c++) {
    const ref = XLSX.utils.encode_cell({r:0, c});
    if (ws[ref]) ws[ref].s = { fill:{fgColor:{rgb:'00665E'}}, font:{color:{rgb:'FFFFFF'},bold:true}, alignment:{horizontal:'center'} };
  }
  // Resaltar en rojo las celdas con SINMODELO / NEG default / UPC vacío
  // Posiciones fijas: headerBase tiene 8 columnas, así Modelo está en col 8, Color en 9, UPC en 10
  const idxModelo = headerBase.length + 0;
  const idxColor  = headerBase.length + 1;
  const idxUpc    = headerBase.length + 2;
  prods.forEach((p, ri) => {
    const e = _enriquecerProducto_(p);
    const rojo = { fill:{fgColor:{rgb:'FFD4D4'}}, font:{color:{rgb:'B30000'},bold:true} };
    if (e._modeloEsDefault) {
      const ref = XLSX.utils.encode_cell({r:ri+1, c:idxModelo});
      if (ws[ref]) ws[ref].s = rojo;
    }
    if (e._colorEsDefault) {
      const ref = XLSX.utils.encode_cell({r:ri+1, c:idxColor});
      if (ws[ref]) ws[ref].s = rojo;
    }
    if (e._upcVacio) {
      const ref = XLSX.utils.encode_cell({r:ri+1, c:idxUpc});
      if (ws[ref]) ws[ref].s = rojo;
    }
  });
  // Anchos de columna
  ws['!cols'] = header.map((h, i) => ({ wch: i===1 ? 50 : Math.max(10, h.length+2) }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Análisis Completo');
  const fname = `CVA_Analisis_Completo_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}

// ════════════════════════════════════════════════════════════════
//  EXPORT SOLICITUD DE UPCs A CVA (archivo separado, limpio)
//  Pide los UPCs de los productos del análisis. SIN rojos, formato
//  profesional para mandar a CVA.
// ════════════════════════════════════════════════════════════════
async function anExportCVAUPCs() {
  if (!_analisisData) return;
  if (typeof XLSX === 'undefined') {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    }).catch(() => alert('No se pudo cargar SheetJS'));
  }
  if (typeof XLSX === 'undefined') return;

  const prods = anFiltrarProductos();
  const aoa = [
    ['Estimado equipo de CVA,'],
    [],
    ['Solicitamos los códigos UPC de los siguientes productos. Tenemos detectado que tendrán'],
    ['una compra próxima por nuestra parte; agradecemos confirmar los UPC en la columna correspondiente.'],
    [],
    ['Atte. LEONGEM COMERCIALIZADORA (Electronics México) · Cuenta CVA 2395390'],
    [],
    ['Clave CVA','Nombre del producto','Marca','Modelo','Stock disponible','UPC'],
  ];
  prods.forEach(p => {
    const _m = _modeloDeProducto_(p);
    aoa.push([p.clave, p.desc, p.marca, _m.texto, (p.total||0), '']);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Estilo del título (filas 1-6)
  for (let r = 0; r < 6; r++) {
    const ref = XLSX.utils.encode_cell({r, c:0});
    if (ws[ref]) ws[ref].s = { font:{ sz: r===0?13:11, bold: r===0, color:{rgb: r===0?'00665E':'333333'} }};
  }
  // Estilo header (fila 8 = index 7) — ahora 6 cols
  for (let c = 0; c < 6; c++) {
    const ref = XLSX.utils.encode_cell({r:7, c});
    if (ws[ref]) ws[ref].s = { fill:{fgColor:{rgb:'00665E'}}, font:{color:{rgb:'FFFFFF'},bold:true,sz:11}, alignment:{horizontal:'center'} };
  }
  // Modelo (col D = index 3): rojo si "SIN MODELO"
  for (let i = 0; i < prods.length; i++) {
    const refMod = XLSX.utils.encode_cell({r: 8+i, c: 3});
    if (ws[refMod]) {
      const v = String(ws[refMod].v || '').toUpperCase();
      const esSinModelo = v.includes('SIN MODELO');
      ws[refMod].s = esSinModelo
        ? { fill:{fgColor:{rgb:'E05555'}}, font:{color:{rgb:'FFFFFF'},bold:true}, alignment:{horizontal:'center'} }
        : { alignment:{horizontal:'center'} };
    }
  }
  // Formato UPC: 12 ceros visualmente (col F = index 5)
  for (let i = 0; i < prods.length; i++) {
    const ref = XLSX.utils.encode_cell({r: 8+i, c: 5});
    if (!ws[ref]) ws[ref] = { v: '' };
    ws[ref].z = '000000000000';
    ws[ref].s = { fill:{fgColor:{rgb:'FFFCF0'}}, alignment:{horizontal:'center'}, font:{name:'Courier New', sz:11} };
  }

  ws['!cols'] = [{wch:14},{wch:60},{wch:18},{wch:16},{wch:12},{wch:18}];
  ws['!freeze'] = { xSplit: 0, ySplit: 8 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Solicitud UPCs');
  XLSX.writeFile(wb, `CVA_Solicitud_UPCs_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// Exponer al window al final del Object.assign existente.
// ════════════════════════════════════════════════════════════════
//  REPORTE TOP 20 — pre-armados con filtros propios
//
//  Genera reportes profesionales (XLSX o PDF) del top 20 de productos
//  más movidos. Tiene 3 modos:
//   - GLOBAL: top 20 del catálogo completo
//   - POR MARCA: top 20 por cada marca activa
//   - POR GRUPO: top 20 por cada grupo (categoría CVA)
//
//  Los filtros stockMin/movMin son INDEPENDIENTES de los filtros
//  del dashboard — solo se respeta el periodo activo (porque sin
//  periodo no hay cálculo de "movido").
//  Todas las marcas/grupos se incluyen (las que tengan menos de 20
//  productos salen con los que tengan, no se filtran por cardinalidad).
// ════════════════════════════════════════════════════════════════

let _top20Filtros = { stockMin: null, movMin: null, modo: 'global', ganancia: null };

function anTop20SetModo(modo) {
  _top20Filtros.modo = modo;
  renderAnalisisDashboard();
}
function anTop20SetFiltro(campo, valor) {
  _top20Filtros[campo] = (valor === '' || valor == null) ? null : parseFloat(valor);
  // Re-render del dashboard si afecta el contador visible
  if (campo === 'stockMin' || campo === 'movMin') {
    // No re-render porque solo afecta el archivo exportado, no la PWA.
    // El contador del dashboard se actualizará en el siguiente render natural.
    // Para mostrar el conteo en vivo sin re-renderizar todo, actualizamos solo
    // el span del contador.
    _top20ActualizarContador_();
  }
}

// Actualiza solo el span del contador sin re-render completo del dashboard
function _top20ActualizarContador_() {
  const span = document.getElementById('top20-contador');
  if (!span) return;
  const secciones = _calcularReporteTop20_();
  const total = secciones.reduce((s, sec) => s + sec.productos.length, 0);
  const modo = _top20Filtros.modo;
  if (modo === 'global') {
    span.innerHTML = `<span style="color:var(--green-lt);font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:500">${total}</span> <span style="color:var(--muted)">productos</span>`;
  } else {
    span.innerHTML = `<span style="color:var(--green-lt);font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:500">${total}</span> <span style="color:var(--muted)">productos · </span><span style="color:var(--green-lt);font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:500">${secciones.length}</span> <span style="color:var(--muted)">${modo === 'marca' ? 'marcas' : 'grupos'}</span>`;
  }
}

// Calcula las secciones del reporte. Devuelve un array de
// { titulo, subtitulo, productos } — siempre al menos un elemento.
function _calcularReporteTop20_() {
  const productos = (_analisisData && _analisisData.productos) || [];
  const f = _top20Filtros;

  // Filtros base: solo productos con movimiento real, y los filtros opcionales
  let lista = productos.filter(p => {
    if (!p.tiene_movimiento || (p.movido || 0) === 0) return false;
    if (f.stockMin != null && (p.total || 0) < f.stockMin) return false;
    if (f.movMin   != null && (p.movido || 0) < f.movMin) return false;
    return true;
  });

  // Orden global por movido descendente
  lista.sort((a, b) => (b.movido || 0) - (a.movido || 0));

  if (f.modo === 'global') {
    return [{
      titulo: 'TOP 20 GLOBAL',
      subtitulo: `${lista.length} productos califican · top 20 mostrados`,
      productos: lista.slice(0, 20),
    }];
  }

  // Agrupar por marca o grupo
  const campo = f.modo === 'marca' ? 'marca' : 'grupo';
  const agrup = {};
  lista.forEach(p => {
    const key = (p[campo] || '(Sin ' + campo + ')').toString();
    if (!agrup[key]) agrup[key] = [];
    agrup[key].push(p);
  });

  // Ordenar grupos por su total de movimiento (más activos arriba)
  return Object.keys(agrup).map(k => {
    const top = agrup[k].slice(0, 20);
    const totalMov = agrup[k].reduce((s, p) => s + (p.movido || 0), 0);
    return {
      titulo: k.toUpperCase(),
      subtitulo: `${agrup[k].length} producto${agrup[k].length !== 1 ? 's' : ''} · ${totalMov.toLocaleString('es-MX')} unidades movidas total`,
      productos: top,
    };
  }).sort((a, b) => {
    // Sort grupos por unidades movidas (extraído del subtitulo no es seguro,
    // mejor calcularlo aquí de nuevo)
    const aMov = a.productos.reduce((s, p) => s + (p.movido || 0), 0);
    const bMov = b.productos.reduce((s, p) => s + (p.movido || 0), 0);
    return bMov - aMov;
  });
}

function _top20FiltrosTxt_() {
  const f = _top20Filtros;
  const parts = [];
  if (f.stockMin != null) parts.push(`Stock ≥ ${f.stockMin}`);
  if (f.movMin   != null) parts.push(`Movido ≥ ${f.movMin}`);
  return parts.length ? parts.join(' · ') : '(sin filtros adicionales)';
}

async function anTop20Excel() {
  const secciones = _calcularReporteTop20_();
  // Aplanar todos los productos de todas las secciones en UNA sola tabla vertical.
  // En modo "marca" o "grupo", el campo Marca/Grupo del producto sirve para filtrar
  // desde Excel (autofilter habilitado). Sin filas separadoras.
  const productosFlat = [];
  secciones.forEach(sec => sec.productos.forEach(p => productosFlat.push(p)));

  if (productosFlat.length === 0) {
    alert('Ningún producto cumple los filtros del reporte.');
    return;
  }

  // Cargar SheetJS si no está
  if (typeof XLSX === 'undefined') {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    }).catch(() => alert('No se pudo cargar SheetJS'));
  }
  if (typeof XLSX === 'undefined') return;

  const periodo = (_analisisData && _analisisData.periodo) || {};
  const fechaGen = new Date().toLocaleString('es-MX');
  const modoTxt = _top20Filtros.modo === 'global' ? 'GLOBAL'
                : _top20Filtros.modo === 'marca'  ? 'POR MARCA'
                : 'POR GRUPO';

  // % de ganancia a usar: el del Top 20 si está, sino el global
  const gananciaUsar = _top20Filtros.ganancia != null ? _top20Filtros.ganancia : _gananciaGlobal;

  // Encabezado profesional
  const aoa = [
    [`REPORTE TOP 20 · ${modoTxt}`],
    [`Electronics México · LEONGEM COMERCIALIZADORA · Cuenta CVA 2395390`],
    [`Periodo:  ${periodo.fecha_inicio || '—'}  →  ${periodo.fecha_fin || '—'}   (${periodo.dias || 0} días)`],
    [`Filtros:  ${_top20FiltrosTxt_()}`],
    [`% Ganancia base: ${gananciaUsar}%  (editable por fila en columna G)`],
    [`Total productos en este reporte:  ${productosFlat.length}${secciones.length > 1 ? `  ·  ${secciones.length} ${_top20Filtros.modo === 'marca' ? 'marcas' : 'grupos'} analizadas` : ''}`],
    [`Generado: ${fechaGen}`],
    [],
  ];

  // Encabezado de tabla — 11 columnas:
  //   A=Clave  B=Descripción  C=Marca  D=Grupo  E=Stock  F=Precio CVA
  //   G=% Gan  H=Precio MELI (fórmula)  I=Unidades  J=Total (fórmula)  K=UPC
  const headersTabla = [
    'Clave CVA', 'Descripción', 'Marca', 'Modelo', 'Grupo',
    'Stock Hoy', 'Precio CVA', '% Gan', 'Precio MELI Clás.',
    'Unidades Solicitadas', 'Total Pedido CVA', 'UPC'
  ];
  const headerRowIdx = aoa.length;
  aoa.push(headersTabla);

  // Filas de productos
  productosFlat.forEach(p => {
    const md = _getMD_(p);
    const upc = _upc12_(md && md.upc);
    const _m = _modeloDeProducto_(p);
    aoa.push([
      p.clave || '',
      p.desc || '',
      p.marca || '',
      _m.texto,                                  // ← METADATA → heurística → SIN MODELO
      p.grupo || '',
      p.total || 0,
      p.precio || 0,
      gananciaUsar,
      null,
      1,
      null,
      upc,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const moneyFmt = '"$"#,##0.00';
  const lastHeaderCol = 11; // 0-indexed: L = 11 (12 columnas con Modelo)

  // ── Estilos del encabezado profesional ──
  ws['!merges'] = ws['!merges'] || [];
  for (let r = 0; r < headerRowIdx; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[ref]) ws[ref].s = {
      font: { sz: r === 0 ? 14 : 11, bold: r === 0, color: { rgb: r === 0 ? '00665E' : '333333' } },
    };
    ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: lastHeaderCol } });
  }

  // ── Header de tabla ──
  for (let c = 0; c < headersTabla.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    if (ws[ref]) ws[ref].s = {
      fill: { fgColor: { rgb: '00665E' } },
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  // ── Calcular comisión y envío por producto, insertar fórmulas y formato ──
  productosFlat.forEach((p, i) => {
    const r = headerRowIdx + 1 + i;          // 0-indexed row
    const excelRow = r + 1;                   // 1-indexed para fórmulas

    const e = _enriquecerProducto_(p);
    const comision = _comisionMELI_(e._cat_meli);
    const envio    = _envioMELIporPeso_(e._peso);

    // Modelo (col D = index 3) — fondo rojo si "SIN MODELO"
    const modeloRef = XLSX.utils.encode_cell({ r, c: 3 });
    if (ws[modeloRef]) {
      const valor = String(ws[modeloRef].v || '').toUpperCase();
      const esSinModelo = valor.includes('SIN MODELO') || valor === 'SINMODELO';
      ws[modeloRef].s = {
        alignment: { horizontal: 'center' },
        font: esSinModelo
          ? { bold: true, color: { rgb: 'FFFFFF' } }
          : { bold: false, color: { rgb: '333333' } },
        fill: esSinModelo
          ? { fgColor: { rgb: 'E05555' } }   // rojo vivo
          : undefined,
      };
    }

    // Precio CVA (col G = index 6) — moneda
    const precioRef = XLSX.utils.encode_cell({ r, c: 6 });
    if (ws[precioRef]) {
      ws[precioRef].z = moneyFmt;
      ws[precioRef].s = { numFmt: moneyFmt, alignment: { horizontal: 'right' } };
    }

    // % Gan (col H = index 7) — editable con fondo verde tenue
    const ganRef = XLSX.utils.encode_cell({ r, c: 7 });
    if (ws[ganRef]) {
      ws[ganRef].s = {
        alignment: { horizontal: 'center' },
        font: { bold: true, color: { rgb: '00665E' } },
        fill: { fgColor: { rgb: 'F0F7F6' } },
      };
    }

    // Precio MELI (col I = index 8) — FÓRMULA viva (G=Precio CVA, H=%Gan)
    const meliRef = XLSX.utils.encode_cell({ r, c: 8 });
    ws[meliRef] = {
      t: 'n',
      f: `IF(G${excelRow}<=298, G${excelRow}*(1+${comision})+33, G${excelRow}*(1+${comision})+${envio}) * (1+H${excelRow}/100)`,
      z: moneyFmt,
      s: {
        numFmt: moneyFmt,
        alignment: { horizontal: 'right' },
        font: { bold: true, color: { rgb: '00665E' } },
        fill: { fgColor: { rgb: 'E8F5F4' } },
      },
    };

    // Unidades Solicitadas (col J = index 9) — editable
    const uniRef = XLSX.utils.encode_cell({ r, c: 9 });
    if (ws[uniRef]) {
      ws[uniRef].s = {
        alignment: { horizontal: 'center' },
        font: { bold: true, color: { rgb: '00665E' } },
        fill: { fgColor: { rgb: 'F0F7F6' } },
      };
    }

    // Total Pedido CVA (col K = index 10) — FÓRMULA Precio CVA × Unidades (G * J)
    const totalRef = XLSX.utils.encode_cell({ r, c: 10 });
    ws[totalRef] = {
      t: 'n',
      f: `G${excelRow}*J${excelRow}`,
      z: moneyFmt,
      s: { numFmt: moneyFmt, alignment: { horizontal: 'right' }, font: { bold: true } },
    };

    // Stock Hoy (col F = index 5)
    const stockRef = XLSX.utils.encode_cell({ r, c: 5 });
    if (ws[stockRef]) {
      ws[stockRef].z = '#,##0';
      ws[stockRef].s = { numFmt: '#,##0', alignment: { horizontal: 'right' } };
    }

    // UPC (col L = index 11)
    const upcRef = XLSX.utils.encode_cell({ r, c: 11 });
    if (ws[upcRef]) {
      ws[upcRef].s = {
        font: { name: 'Courier New', sz: 10 },
        alignment: { horizontal: 'center' },
      };
    }

    // Zebra striping
    if (i % 2 === 1) {
      ['A','B','C','D','E','F','G','H','I','J','K','L'].forEach(col => {
        const ref = col + excelRow;
        if (!ws[ref]) return;
        const existing = ws[ref].s || {};
        // No sobrescribir fill rojo del modelo si ya está
        if (col === 'D' && existing.fill && existing.fill.fgColor && existing.fill.fgColor.rgb === 'E05555') return;
        ws[ref].s = {
          ...existing,
          fill: existing.fill || { fgColor: { rgb: 'FAFAFA' } },
        };
      });
    }
  });

  // ── Fila de totales generales al final ──
  const totalRowIdx = headerRowIdx + 1 + productosFlat.length;
  const firstDataExcelRow = headerRowIdx + 2;
  const lastDataExcelRow  = totalRowIdx;

  // "TOTAL GENERAL:" en col J = index 9
  ws[XLSX.utils.encode_cell({ r: totalRowIdx, c: 9 })] = {
    t: 's', v: 'TOTAL GENERAL:',
    s: { font: { bold: true, color: { rgb: '00665E' } }, alignment: { horizontal: 'right' } },
  };
  // Suma del Total Pedido CVA en col K = index 10
  ws[XLSX.utils.encode_cell({ r: totalRowIdx, c: 10 })] = {
    t: 'n',
    f: `SUM(K${firstDataExcelRow}:K${lastDataExcelRow})`,
    z: moneyFmt,
    s: {
      numFmt: moneyFmt,
      font: { bold: true, sz: 12, color: { rgb: '00665E' } },
      fill: { fgColor: { rgb: 'F0F7F6' } },
      alignment: { horizontal: 'right' },
      border: { top: { style: 'medium', color: { rgb: '00665E' } } },
    },
  };

  // ── Auto-filter ──
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIdx, c: 0 },
      e: { r: headerRowIdx + productosFlat.length, c: lastHeaderCol },
    }),
  };

  // ── Congelar header de tabla ──
  ws['!freeze'] = { xSplit: 0, ySplit: headerRowIdx + 1 };

  // ── Anchos de columna ──
  ws['!cols'] = [
    { wch: 14 },   // Clave
    { wch: 55 },   // Descripción
    { wch: 18 },   // Marca
    { wch: 16 },   // Modelo (nuevo)
    { wch: 22 },   // Grupo
    { wch: 11 },   // Stock
    { wch: 13 },   // Precio CVA
    { wch: 9 },    // % Gan
    { wch: 15 },   // Precio MELI
    { wch: 13 },   // Unidades
    { wch: 16 },   // Total
    { wch: 16 },   // UPC
  ];

  // ── Actualizar rango total del sheet ──
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRowIdx, c: lastHeaderCol },
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Top 20');
  XLSX.writeFile(wb, `CVA_Top20_${_top20Filtros.modo}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function anTop20PDF() {
  const secciones = _calcularReporteTop20_();
  const totalProds = secciones.reduce((s, sec) => s + sec.productos.length, 0);
  if (totalProds === 0) {
    alert('Ningún producto cumple los filtros del reporte.');
    return;
  }

  const w = window.open('', '_blank');
  if (!w) { alert('Permite popups para exportar PDF'); return; }
  const periodo = (_analisisData && _analisisData.periodo) || {};
  const fechaGen = new Date().toLocaleString('es-MX');
  const fmtMXN = (n) => '$' + (Math.round(n || 0)).toLocaleString('es-MX');
  const modoTxt = _top20Filtros.modo === 'global' ? 'Global'
                : _top20Filtros.modo === 'marca'  ? 'Por Marca'
                : 'Por Grupo';

  const seccionesHtml = secciones.map(sec => `
    <div class="seccion">
      <div class="sec-titulo">${sec.titulo}</div>
      ${sec.subtitulo ? `<div class="sec-sub">${sec.subtitulo}</div>` : ''}
      <table>
        <thead><tr>
          <th>Clave</th>
          <th>Descripción</th>
          <th>Marca</th>
          <th>Modelo</th>
          <th>Grupo</th>
          <th class="r">Stock</th>
          <th class="r">Movido</th>
          <th class="r">Precio CVA</th>
          <th class="r">Valor Mov.</th>
        </tr></thead>
        <tbody>${
          sec.productos.map(p => {
            const _m = _modeloDeProducto_(p);
            const esSinModelo = _m.vacio === true;
            return `
            <tr>
              <td class="mono">${p.clave || ''}</td>
              <td>${(p.desc || '').substring(0, 70)}</td>
              <td>${p.marca || ''}</td>
              <td class="${esSinModelo ? 'sinmodelo' : ''}">${_m.texto}</td>
              <td>${p.grupo || ''}</td>
              <td class="r">${(p.total || 0).toLocaleString('es-MX')}</td>
              <td class="r mov">${(p.movido || 0).toLocaleString('es-MX')}</td>
              <td class="r">${fmtMXN(p.precio)}</td>
              <td class="r">${fmtMXN(p.valor_movido)}</td>
            </tr>
          `;}).join('')
        }</tbody>
      </table>
    </div>
  `).join('');

  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Top 20 ${modoTxt} · CVA</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px 28px; font-size: 11px; color: #222; }
      .header-block { border-bottom: 2px solid #00665e; padding-bottom: 14px; margin-bottom: 22px; }
      h1 { color: #00665e; font-size: 22px; margin: 0 0 4px; font-weight: 500; letter-spacing: 1px; }
      h1 .modo { color: #666; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin-left: 8px; }
      .empresa { font-size: 11px; color: #555; margin-bottom: 8px; }
      .meta { font-size: 10px; color: #888; line-height: 1.6; }
      .meta b { color: #444; font-weight: 500; }
      .seccion { margin-bottom: 28px; page-break-inside: avoid; }
      .sec-titulo { background: #00665e; color: #fff; padding: 8px 14px; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 500; }
      .sec-sub { background: #f0f7f6; padding: 6px 14px; font-size: 10px; color: #666; font-style: italic; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 0; }
      th { background: #2d5a57; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; }
      th.r { text-align: right; }
      td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
      td.r { text-align: right; font-variant-numeric: tabular-nums; }
      td.mono { font-family: 'Courier New', monospace; color: #00665e; font-weight: 500; }
      td.mov { color: #00665e; font-weight: 600; }
      td.sinmodelo { background: #e05555 !important; color: #fff !important; font-weight: 700; text-align: center; }
      tr:nth-child(even) { background: #fafafa; }
      .footer { margin-top: 30px; padding-top: 14px; border-top: 1px solid #eee; font-size: 9px; color: #888; text-align: center; letter-spacing: 1px; }
      @media print {
        @page { size: landscape; margin: 1cm; }
        .seccion { page-break-inside: avoid; }
      }
    </style></head><body>
    <div class="header-block">
      <h1>Reporte Top 20 <span class="modo">· ${modoTxt}</span></h1>
      <div class="empresa">Electronics México · LEONGEM COMERCIALIZADORA · Cuenta CVA 2395390</div>
      <div class="meta">
        <b>Periodo:</b> ${periodo.fecha_inicio || '—'} → ${periodo.fecha_fin || '—'} (${periodo.dias || 0} días) ·
        <b>Filtros:</b> ${_top20FiltrosTxt_()} ·
        <b>Generado:</b> ${fechaGen}
      </div>
    </div>
    ${seccionesHtml}
    <div class="footer">Documento generado automáticamente desde el panel de Análisis CVA · Electronics México</div>
    <script>setTimeout(()=>window.print(), 500);</script>
  </body></html>`);
  w.document.close();
}

// Exponer al window
Object.assign(window, {
  anTop20SetModo, anTop20SetFiltro, anTop20Excel, anTop20PDF,
});

Object.assign(window, {
  anEditarMD, anCambiarGananciaGlobal, anSetModoVista,
  anExportXLSX, anExportCVAUPCs,
});

Object.assign(window, {
  toggleSidebar, openSidebar, closeSidebar, showPage,
  buscarCVA, buscarTodo, verProducto, volverATabla, limpiarBusqueda, buscarMeli, buscarMeliFila,
  filtrarPorMarca, filtrarPorGrupo, sortBuscar, fmtFecha, fmt,
  agregarClave, agregarAlCarrito, pvQtyChange, setQty,
  cambiarQty, quitarItem, renderCarrito,
  enviarOrden, enviarOrdenTest, toggleFleteFields, onEstadoChange, poblarSelectEstados,
  cargarPedidos, cargarSaldo, filtrarPedidos, abrirModalPedido, cerrarModal,
  handleFileSelect, handleDrop, handleGuiaFileSelect, handleGuiaDrop, registrarPedido, enviarGuiaCVA,
  ejecutarSync, resetearSync, cargarEstadoSync, instalarTriggers, instalarTriggersUI,
  cargarVentasOdoo, cargarPickingsOdoo, abrirVentaOdoo, odooTab,
  buscarEnOdoo, ejecutarDebug,
  exportBuscarCSV, exportBuscarPDF, exportProductoCSV, exportProductoPDF,
  exportarTodoCSV, exportarTodoPDF, exportCarritoCSV, exportCarritoPDF,
  limpiarLog, cargarSucursalesSelect, iniciarPaginaOrden, sugerirSucursalPorStock, recargarSucursales, cargarAnalisis,
  iniciarCarruselMarcas, _renderCarruselMarcas,
  cargarAnalisis, renderAnalisisDashboard, renderAnalisisTab, anFiltrar, anTab, anSort, anLimpiarFiltros, anExportCSV, anExportPDF, anCambiarPeriodo,
});
// ════════════════════════════════════════════════════════════════
//  INVENTARIO ODOO — control de exposición de stock a marketplaces
//
//  Lista de claves CVA que quieres publicar en Odoo. Para cada una:
//   - Stock CVA real (suc + cedis) actualizado
//   - % a aplicar (global del módulo o override por fila)
//   - Stock para Odoo = stock × % redondeado abajo
//
//  Los datos viven en la hoja INVENTARIO_ODOO del Sheet. Otro sheet
//  externo lee con IMPORTRANGE y alimenta Odoo. Trigger cada 10 min
//  fuerza recálculo de las fórmulas para datos frescos.
// ════════════════════════════════════════════════════════════════

let _invOdooData = { items: [], pct_global: 20 };
let _invOdooFiltro = '';

async function cargarInvOdoo() {
  const cont = document.getElementById('invodoo-content');
  if (!cont) return;

  cont.innerHTML = '<div style="padding:60px;text-align:center;color:var(--muted);font-size:11px;letter-spacing:2px;text-transform:uppercase"><span class="spin"></span>Consultando inventario…</div>';

  const data = await api('inv_odoo_list');
  if (!data.ok) {
    cont.innerHTML = `
      <div style="padding:40px;text-align:center">
        <div style="color:#e05555;font-size:13px;margin-bottom:14px">⚠ ${data.error || 'Error'}</div>
        <div style="color:var(--muted);font-size:11px;letter-spacing:1.5px;line-height:1.8">
          Crea primero la hoja desde el editor del Sheet:<br>
          <span style="color:var(--green-lt)">🛠 MIS HERRAMIENTAS → 📦 Crear hoja INVENTARIO_ODOO</span>
        </div>
      </div>`;
    return;
  }

  _invOdooData = data;
  renderInvOdoo();
}

function renderInvOdoo() {
  const cont = document.getElementById('invodoo-content');
  if (!cont) return;
  const d = _invOdooData;
  const items = d.items || [];

  // Filtro de búsqueda en cliente
  const f = (_invOdooFiltro || '').trim().toUpperCase();
  const itemsFil = f
    ? items.filter(it => (it.clave || '').toUpperCase().includes(f)
        || (it.nombre || '').toUpperCase().includes(f)
        || (it.marca || '').toUpperCase().includes(f)
        || (it.sku || '').toUpperCase().includes(f))
    : items;

  // KPIs
  const totalProductos = items.length;
  const totalStockCVA  = items.reduce((s, it) => s + (it.stock_cva || 0), 0);
  const totalStockOdoo = items.reduce((s, it) => s + (it.stock_odoo || 0), 0);

  cont.innerHTML = `
    <!-- KPIs estilo cockpit -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0;margin-bottom:24px;padding:18px 0;border-top:1px solid rgba(238,240,240,0.06);border-bottom:1px solid rgba(238,240,240,0.06)">
      <div style="padding:6px 24px;border-right:1px solid rgba(238,240,240,0.06)">
        <div style="font-size:9px;color:var(--muted);letter-spacing:2.5px;text-transform:uppercase;margin-bottom:6px">Productos</div>
        <div style="font-family:Barlow Condensed,sans-serif;font-size:32px;font-weight:500;color:var(--text);line-height:1">${totalProductos}</div>
        <div style="font-size:9px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-top:4px;opacity:0.7">en SKU_INVENTARIO</div>
      </div>
      <div style="padding:6px 24px;border-right:1px solid rgba(238,240,240,0.06)">
        <div style="font-size:9px;color:var(--muted);letter-spacing:2.5px;text-transform:uppercase;margin-bottom:6px">Stock CVA total</div>
        <div style="font-family:Barlow Condensed,sans-serif;font-size:32px;font-weight:500;color:var(--text);line-height:1">${totalStockCVA.toLocaleString('es-MX')}</div>
        <div style="font-size:9px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-top:4px;opacity:0.7">unidades reales</div>
      </div>
      <div style="padding:6px 24px;border-right:1px solid rgba(238,240,240,0.06)">
        <div style="font-size:9px;color:var(--muted);letter-spacing:2.5px;text-transform:uppercase;margin-bottom:6px">Stock Odoo expuesto</div>
        <div style="font-family:Barlow Condensed,sans-serif;font-size:32px;font-weight:500;color:var(--green-lt);line-height:1">${totalStockOdoo.toLocaleString('es-MX')}</div>
        <div style="font-size:9px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-top:4px;opacity:0.7">a publicar</div>
      </div>
      <div style="padding:6px 24px">
        <div style="font-size:9px;color:var(--muted);letter-spacing:2.5px;text-transform:uppercase;margin-bottom:6px">% Global</div>
        <div style="display:flex;align-items:baseline;gap:6px">
          <input type="number" min="0" max="100" step="1" value="${d.pct_global}" id="invodoo-pct-global"
            onchange="anInvOdooSetGlobalPct(this.value)"
            style="background:rgba(0,102,94,0.18);border:1px solid var(--green-lt);color:var(--green-lt);padding:4px 8px;font-size:30px;width:90px;outline:none;font-weight:500;text-align:right;font-family:Barlow Condensed,sans-serif">
          <span style="font-family:Barlow Condensed,sans-serif;font-size:24px;color:var(--green-lt);font-weight:500">%</span>
        </div>
        <div style="font-size:9px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-top:4px;opacity:0.7">aplicado a todos</div>
      </div>
    </div>

    <!-- Acciones -->
    <div style="background:rgba(0,0,0,0.22);border:1px solid rgba(238,240,240,0.06);padding:16px 20px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div>
          <label style="display:block;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">Buscar</label>
          <input type="text" placeholder="Clave, descripción, marca, SKU…" value="${_invOdooFiltro}" oninput="_invOdooFiltro=this.value;renderInvOdoo()" style="background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:9px 12px;font-size:12px;width:340px;outline:none;font-family:inherit">
        </div>
        <div style="flex:1"></div>
        <button onclick="anInvOdooRefrescar()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(238,240,240,0.15);color:var(--text);padding:9px 18px;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all 0.18s ease" onmouseover="this.style.borderColor='var(--green-lt)';this.style.color='var(--green-lt)'" onmouseout="this.style.borderColor='rgba(238,240,240,0.15)';this.style.color='var(--text)'">↻ Refrescar stock</button>
      </div>
    </div>

    <!-- Info -->
    <div style="background:linear-gradient(135deg, rgba(0,102,94,0.08) 0%, rgba(0,0,0,0.22) 100%);border:1px solid rgba(103,184,175,0.18);padding:18px 22px;margin-bottom:16px">
      <div style="font-size:10px;color:var(--green-lt);letter-spacing:2.5px;text-transform:uppercase;margin-bottom:8px;font-weight:500">ℹ Hoja unificada SKU_INVENTARIO</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.7">
        Los productos vienen de la hoja <strong style="color:var(--text)">SKU_INVENTARIO</strong> (se llena al importar UPCs). El <strong style="color:var(--green-lt)">Precio MELI</strong> usa <strong style="color:var(--text)">CONFIG_MELI</strong> y se recalcula al instante. El <strong style="color:var(--green-lt)">% Global</strong> de arriba aplica a todos los productos y determina cuánto stock expones en Odoo.
      </div>
    </div>

    <!-- Tabla -->
    <div style="font-size:10px;color:var(--muted);margin-bottom:14px;letter-spacing:2px;text-transform:uppercase">
      <span style="font-family:Barlow Condensed,sans-serif;font-size:14px;color:var(--text);letter-spacing:0;font-weight:500">${itemsFil.length}</span>
      <span style="opacity:0.6;margin:0 6px">${itemsFil.length === items.length ? 'productos' : `de ${items.length} productos`}</span>
    </div>
    <div style="overflow-x:auto;border-top:1px solid rgba(238,240,240,0.04);border-bottom:1px solid rgba(238,240,240,0.04)">
      <table style="width:100%;border-collapse:collapse;min-width:1600px">
        <thead><tr>
          ${[
            ['Clave', '90px', 'left'],
            ['UPC', '130px', 'center'],
            ['Marca', '100px', 'left'],
            ['Descripción', 'auto', 'left'],
            ['SKU', '180px', 'left'],
            ['Precio CVA', '100px', 'right'],
            ['Precio MELI', '110px', 'right'],
            ['Stock CVA', '90px', 'right'],
            ['Stock Odoo', '100px', 'right'],
          ].map(([l,w,a]) => `<th style="width:${w};padding:12px 10px;text-align:${a};background:transparent;border-bottom:1px solid rgba(238,240,240,0.1);font-size:9px;color:rgba(238,240,240,0.5);font-weight:500;letter-spacing:2px;text-transform:uppercase;white-space:nowrap">${l}</th>`).join('')}
        </tr></thead>
        <tbody>${
          itemsFil.length === 0
            ? `<tr><td colspan="9" style="padding:40px;text-align:center;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;font-size:10px">${items.length === 0 ? 'SKU_INVENTARIO vacío. Importa UPCs desde la hoja UPC_IMPORT.' : 'Sin resultados para este filtro'}</td></tr>`
            : itemsFil.map(it => {
                const upcVacio = !it.upc;
                const precioCva = it.precio_cva || 0;
                const precioMeli = it.precio_meli || 0;
                return `
                <tr class="cva-row" style="border-bottom:1px solid rgba(238,240,240,0.04)">
                  <td style="padding:10px;font-family:monospace;font-size:11px;color:var(--green-lt);font-weight:500">${it.clave}</td>
                  <td style="padding:10px;text-align:center;font-family:monospace;font-size:11px;color:${upcVacio ? '#e05555' : 'var(--text)'};${upcVacio ? 'font-style:italic' : ''}">${it.upc || 'sin UPC'}</td>
                  <td style="padding:10px;font-size:11px;color:var(--muted)">${it.marca || '—'}</td>
                  <td style="padding:10px;font-size:11px;color:var(--text)">${it.nombre || '<span style="color:#e05555;font-style:italic">⚠ no encontrado</span>'}</td>
                  <td style="padding:10px;font-family:monospace;font-size:10px;color:var(--text)">${it.sku || '—'}</td>
                  <td style="padding:10px;text-align:right;font-family:Barlow Condensed,sans-serif;font-size:14px;color:var(--muted)">$${precioCva.toFixed(2)}</td>
                  <td style="padding:10px;text-align:right;font-family:Barlow Condensed,sans-serif;font-size:15px;color:#f0c040;font-weight:500">$${Math.round(precioMeli).toLocaleString('es-MX')}</td>
                  <td style="padding:10px;text-align:right;font-family:Barlow Condensed,sans-serif;font-size:15px;color:var(--text);font-weight:500">${(it.stock_cva || 0).toLocaleString('es-MX')}</td>
                  <td style="padding:10px;text-align:right;font-family:Barlow Condensed,sans-serif;font-size:17px;color:var(--green-lt);font-weight:500;background:rgba(0,102,94,0.04)">${(it.stock_odoo || 0).toLocaleString('es-MX')}</td>
                </tr>`;
              }).join('')
        }</tbody>
      </table>
    </div>

    <!-- Tip -->
    <div style="margin-top:24px;padding:18px 22px;background:rgba(0,0,0,0.18);border-left:2px solid var(--green-lt);font-size:11px;color:var(--muted);line-height:1.8">
      <div style="color:var(--green-lt);font-weight:500;letter-spacing:1.5px;text-transform:uppercase;font-size:10px;margin-bottom:8px">🔗 Conectar este inventario a Odoo</div>
      Desde el sheet que alimenta Odoo, usa esta fórmula:<br>
      <code style="display:inline-block;margin-top:6px;background:rgba(0,0,0,0.4);padding:6px 10px;font-family:monospace;font-size:11px;color:var(--text)">=IMPORTRANGE("URL_de_tu_sheet_principal";"SKU_INVENTARIO!A:K")</code><br>
      <span style="opacity:0.7">El sheet se refresca cada 10 min si activaste el trigger desde el menú.</span>
    </div>
  `;
}


async function anInvOdooAgregar() {
  const ta = document.getElementById('invodoo-textarea');
  if (!ta) return;
  const claves = ta.value.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean);
  if (claves.length === 0) {
    alert('Pega al menos una clave CVA.');
    return;
  }
  const r = await api('inv_odoo_add', { claves: claves.join(',') });
  if (!r.ok) { alert('Error: ' + (r.error || 'desconocido')); return; }
  ta.value = '';
  let msg = `✅ Agregadas: ${r.agregadas}`;
  if (r.duplicadas > 0) msg += `\n⚠ Ya estaban: ${r.duplicadas}`;
  addLog('ok', 'Inventario Odoo', msg);
  await cargarInvOdoo();
}

async function anInvOdooRemover(clave) {
  if (!confirm(`Eliminar ${clave} del inventario?`)) return;
  const r = await api('inv_odoo_remove', { clave });
  if (!r.ok) { alert('Error: ' + (r.error || 'desconocido')); return; }
  addLog('ok', 'Inventario Odoo', 'Eliminado: ' + clave);
  await cargarInvOdoo();
}

async function anInvOdooSetPct(clave, pct) {
  const valor = pct === '' ? '' : parseFloat(pct);
  if (pct !== '' && (isNaN(valor) || valor < 0 || valor > 100)) {
    alert('Valor inválido — debe estar entre 0 y 100');
    cargarInvOdoo();
    return;
  }
  const r = await api('inv_odoo_set_pct', { clave, pct: pct === '' ? '' : valor });
  if (!r.ok) { alert('Error: ' + (r.error || 'desconocido')); return; }
  // Esperar a que las fórmulas recalculen + recargar
  setTimeout(() => cargarInvOdoo(), 600);
}

async function anInvOdooSetGlobalPct(pct) {
  const n = parseFloat(pct);
  if (isNaN(n) || n < 0 || n > 100) {
    alert('Valor inválido — debe estar entre 0 y 100');
    cargarInvOdoo();
    return;
  }
  const r = await api('inv_odoo_set_global_pct', { pct: n });
  if (!r.ok) { alert('Error: ' + (r.error || 'desconocido')); return; }
  setTimeout(() => cargarInvOdoo(), 600);
}

async function anInvOdooRefrescar() {
  const r = await api('inv_odoo_refresh');
  if (!r.ok) { alert('Error: ' + (r.error || 'desconocido')); return; }
  addLog('ok', 'Inventario Odoo', 'Refrescado');
  await cargarInvOdoo();
}

Object.assign(window, {
  cargarInvOdoo, renderInvOdoo,
  anInvOdooAgregar, anInvOdooRemover,
  anInvOdooSetPct, anInvOdooSetGlobalPct, anInvOdooRefrescar,
});

// ════════════════════════════════════════════════════════════════
//  EXPORTAR DATOS
//
//  Pegas claves CVA en un textarea, las parseo, busco cada producto,
//  muestro preview en tabla y exportas Excel/PDF con el mismo formato
//  del Top 20 (incluyendo columna Modelo, rojo si dice "SIN MODELO").
//
//  Reusa las funciones del Top 20 — solo cambia el dataset de entrada.
// ════════════════════════════════════════════════════════════════
let _exportarProductos = [];   // los productos cargados desde CVA
let _exportarGanancia = 15;    // % default

// Devuelve el modelo de un producto:
//   1) si hay metadata guardada (PWA/Sheet), usa esa
//   2) si no, intenta extraerlo heurísticamente de la descripción
//   3) si nada funciona, "SIN MODELO" en rojo
function _modeloDeProducto_(p) {
  const md = _getMD_({ clave: p.clave, marca: p.marca });
  if (md && md.modelo) return { texto: String(md.modelo).toUpperCase(), auto: false };
  // Fallback: heurística
  try {
    const auto = _extraerModelo_(p.descripcion || '', p.marca || '');
    if (auto) return { texto: auto, auto: true };
  } catch(e) {}
  return { texto: 'SIN MODELO', auto: false, vacio: true };
}

function cargarExportar() {
  const cont = document.getElementById('exportar-content');
  if (!cont) return;
  cont.innerHTML = `
    <div style="max-width:1100px;margin:0 auto">
      <!-- ── Input area ── -->
      <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(238,240,240,0.08);padding:22px;margin-bottom:18px">
        <div style="font-size:11px;letter-spacing:2px;color:var(--text-2);text-transform:uppercase;margin-bottom:10px">Claves CVA</div>
        <div style="font-size:11.5px;color:var(--text-3);margin-bottom:12px;line-height:1.5">
          Pega las claves CVA (una por línea, separadas por coma, espacio o tab).<br>
          Ej: <span style="color:var(--green-lt);font-family:monospace">RAM-4626 RAM-4681 SSD-1234</span>
        </div>
        <textarea id="export-claves" rows="6"
          placeholder="RAM-4626&#10;RAM-4681&#10;SSD-1234&#10;..."
          style="width:100%;background:rgba(0,0,0,0.4);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:12px 14px;font-family:'Courier New',monospace;font-size:13px;letter-spacing:1px;line-height:1.5;outline:none;resize:vertical;box-sizing:border-box"></textarea>

        <div style="display:flex;align-items:center;gap:14px;margin-top:14px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:10px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">% Ganancia</span>
            <input type="number" id="export-gan" value="${_exportarGanancia}" min="0" step="0.5"
              style="background:rgba(0,102,94,0.18);border:1px solid var(--green-lt);color:var(--green-lt);padding:6px 10px;font-size:13px;width:80px;outline:none;font-family:'Barlow Condensed',sans-serif;text-align:right;font-weight:500">
          </div>
          <button onclick="exportarBuscar()" class="btn"
            style="background:var(--green);color:#fff;border:1px solid var(--green-lt);padding:9px 22px;font-size:11px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;font-family:inherit;font-weight:500;border-radius:3px">
            Buscar productos
          </button>
          <button onclick="exportarLimpiar()" class="btn btn-ghost"
            style="padding:9px 18px;font-size:11px;letter-spacing:2px;text-transform:uppercase">
            Limpiar
          </button>
        </div>
      </div>

      <!-- ── Resultado ── -->
      <div id="export-resultado"></div>
    </div>
  `;
}

function _parseClaves_(texto) {
  // Acepta separadores: salto de línea, coma, espacio, tab, punto y coma
  return (texto || '')
    .split(/[\s,;]+/)
    .map(c => c.trim().toUpperCase())
    .filter(c => c.length > 0 && c.length < 30);
}

async function exportarBuscar() {
  const ta = document.getElementById('export-claves');
  const cont = document.getElementById('export-resultado');
  if (!ta || !cont) return;
  const claves = _parseClaves_(ta.value);
  if (claves.length === 0) {
    cont.innerHTML = `<div class="alert alert-warn" style="padding:14px;margin:8px 0">Pega al menos una clave CVA.</div>`;
    return;
  }
  // Tomar % ganancia
  const ganInput = document.getElementById('export-gan');
  _exportarGanancia = parseFloat(ganInput?.value) || 15;

  // Deduplicar
  const unicas = [...new Set(claves)];
  cont.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:11px;letter-spacing:1.5px;text-transform:uppercase"><span class="spin"></span> Buscando ${unicas.length} producto${unicas.length === 1 ? '' : 's'}…</div>`;

  // Llamar a cva_producto por cada clave (en paralelo, throttled a 3)
  const productos = [];
  const errores = [];
  const _MAX = 3;
  let idx = 0;

  async function _worker() {
    while (idx < unicas.length) {
      const i = idx++;
      const clave = unicas[i];
      try {
        const data = await api('cva_producto', { clave });
        if (data && data.ok && data.producto) {
          productos.push(data.producto);
        } else {
          errores.push({ clave, error: data?.error || 'no encontrado' });
        }
      } catch(e) {
        errores.push({ clave, error: e.message });
      }
      // Update progress
      const done = i + 1;
      const cont = document.getElementById('export-resultado');
      if (cont && cont.querySelector('.spin')) {
        cont.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:11px;letter-spacing:1.5px;text-transform:uppercase"><span class="spin"></span> Buscando ${done}/${unicas.length}…</div>`;
      }
    }
  }
  await Promise.all(Array.from({length: Math.min(_MAX, unicas.length)}, _worker));

  _exportarProductos = productos;

  // Render resultado
  _renderExportResultado_(productos, errores);
}

function _renderExportResultado_(productos, errores) {
  const cont = document.getElementById('export-resultado');
  if (!cont) return;
  if (productos.length === 0) {
    cont.innerHTML = `
      <div class="alert alert-warn" style="padding:16px;margin:8px 0">
        Ninguno de los productos pudo cargarse. Verifica las claves.
        ${errores.length ? `<div style="margin-top:10px;font-size:10px;font-family:monospace;color:var(--muted)">${errores.slice(0,10).map(e => e.clave + ': ' + e.error).join('<br>')}</div>` : ''}
      </div>`;
    return;
  }

  cont.innerHTML = `
    <div style="background:rgba(0,102,94,0.08);border:1px solid rgba(103,184,175,0.2);padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:22px;color:var(--green-lt);font-weight:500">${productos.length}</span>
        <span style="font-size:11px;color:var(--text-2);letter-spacing:1px;text-transform:uppercase;margin-left:6px">producto${productos.length===1?'':'s'} encontrado${productos.length===1?'':'s'}</span>
        ${errores.length ? `<span style="font-size:11px;color:rgba(255,180,0,0.8);letter-spacing:1px;text-transform:uppercase;margin-left:12px">⚠ ${errores.length} no encontrado${errores.length===1?'':'s'}</span>` : ''}
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="exportarExcel()" class="btn"
          style="background:var(--green);color:#fff;border:1px solid var(--green-lt);padding:8px 16px;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;font-family:inherit;font-weight:500;border-radius:3px;display:inline-flex;align-items:center;gap:6px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Excel
        </button>
        <button onclick="exportarPDF()" class="btn btn-ghost"
          style="padding:8px 16px;font-size:10px;letter-spacing:2px;text-transform:uppercase;display:inline-flex;align-items:center;gap:6px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          PDF
        </button>
      </div>
    </div>

    <div style="overflow-x:auto;border:1px solid rgba(238,240,240,0.06)">
      <table style="width:100%;border-collapse:collapse;min-width:900px">
        <thead><tr style="background:rgba(0,102,94,0.18)">
          <th style="padding:9px 12px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);text-align:left">Clave</th>
          <th style="padding:9px 12px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);text-align:left">Descripción</th>
          <th style="padding:9px 12px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);text-align:left">Marca</th>
          <th style="padding:9px 12px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);text-align:center">Modelo</th>
          <th style="padding:9px 12px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);text-align:right">Stock</th>
          <th style="padding:9px 12px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);text-align:right">Precio CVA</th>
        </tr></thead>
        <tbody>${productos.map(p => {
          // _modeloDeProducto_ acepta p con clave/marca/descripcion — usa
          // METADATA primero, luego heurística, luego "SIN MODELO".
          const _m = _modeloDeProducto_({ clave: p.clave, marca: p.marca, desc: p.descripcion, descripcion: p.descripcion });
          const esSinModelo = _m.vacio === true;
          const stock = (p.disponible || 0) + (p.disponibleCD || 0);
          const precio = p.moneda === 'Dolares' ? (p.precio * (p.tipo_cambio || 17.5)) : p.precio;
          return `<tr style="border-bottom:1px solid rgba(238,240,240,0.04)">
            <td style="padding:8px 12px;font-family:monospace;color:var(--green-lt);font-size:11px">${p.clave}</td>
            <td style="padding:8px 12px;font-size:11.5px">${(p.descripcion || '').substring(0,60)}${(p.descripcion||'').length>60?'…':''}</td>
            <td style="padding:8px 12px;font-size:11px;color:var(--text-2)">${p.marca || ''}</td>
            <td style="padding:8px 12px;font-size:11px;text-align:center;${esSinModelo?'background:#e05555;color:#fff;font-weight:700':_m.auto?'color:#aab8b3;font-style:italic':''}" title="${_m.auto?'Modelo extraído automáticamente de la descripción':''}">${_m.texto}</td>
            <td style="padding:8px 12px;font-size:13px;text-align:right;font-family:'Barlow Condensed',sans-serif">${stock.toLocaleString('es-MX')}</td>
            <td style="padding:8px 12px;font-size:12px;text-align:right;color:var(--green-lt);font-family:'Barlow Condensed',sans-serif">$${Math.round(precio).toLocaleString('es-MX')}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>

    ${errores.length ? `
      <details style="margin-top:14px;background:rgba(255,180,0,0.06);border:1px solid rgba(255,180,0,0.18);padding:10px 14px">
        <summary style="cursor:pointer;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:rgba(255,180,0,0.9)">⚠ ${errores.length} clave${errores.length===1?'':'s'} no encontrada${errores.length===1?'':'s'}</summary>
        <div style="margin-top:8px;font-size:10px;font-family:monospace;color:var(--text-2);max-height:120px;overflow-y:auto">${errores.map(e => `${e.clave} — ${e.error}`).join('<br>')}</div>
      </details>` : ''}
  `;
}

function exportarLimpiar() {
  const ta = document.getElementById('export-claves');
  if (ta) ta.value = '';
  const cont = document.getElementById('export-resultado');
  if (cont) cont.innerHTML = '';
  _exportarProductos = [];
}

// ─── EXCEL ───
async function exportarExcel() {
  if (_exportarProductos.length === 0) { alert('Primero busca los productos.'); return; }
  if (typeof XLSX === 'undefined') {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    }).catch(() => alert('No se pudo cargar SheetJS'));
  }
  if (typeof XLSX === 'undefined') return;

  const productos = _exportarProductos;
  const gananciaUsar = _exportarGanancia;
  const fechaGen = new Date().toLocaleString('es-MX');

  // Header del documento — mismo estilo que Top 20
  const aoa = [
    ['Reporte de Productos — Export Datos'],
    ['Electronics México · LEONGEM COMERCIALIZADORA · Cuenta CVA 2395390'],
    [`Generado:  ${fechaGen}`],
    [`Total productos:  ${productos.length}  ·  % Ganancia aplicado:  ${gananciaUsar}%`],
    [],
  ];

  const headersTabla = [
    'Clave CVA', 'Descripción', 'Marca', 'Modelo', 'Grupo',
    'Stock Hoy', 'Precio CVA', '% Gan', 'Precio MELI Clás.',
    'Unidades Solicitadas', 'Total Pedido CVA', 'UPC'
  ];
  const headerRowIdx = aoa.length;
  aoa.push(headersTabla);

  // Filas de productos
  productos.forEach(p => {
    const md = _getMD_({ clave: p.clave, marca: p.marca });
    const upc = _upc12_(md && md.upc);
    const _m = _modeloDeProducto_({ clave: p.clave, marca: p.marca, desc: p.descripcion, descripcion: p.descripcion });
    const stock = (p.disponible || 0) + (p.disponibleCD || 0);
    const precioMXN = p.moneda === 'Dolares' ? (p.precio * (p.tipo_cambio || 17.5)) : p.precio;
    aoa.push([
      p.clave || '',
      p.descripcion || '',
      p.marca || '',
      _m.texto,
      p.grupo || '',
      stock,
      precioMXN,
      gananciaUsar,
      null, 1, null,
      upc,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const moneyFmt = '"$"#,##0.00';
  const lastHeaderCol = 11;

  // Estilo del título
  ws['!merges'] = ws['!merges'] || [];
  for (let r = 0; r < headerRowIdx; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[ref]) ws[ref].s = { font:{ sz: r===0?14:11, bold: r===0, color:{rgb: r===0?'00665E':'333333'} }};
    ws['!merges'].push({ s:{r,c:0}, e:{r,c:lastHeaderCol} });
  }
  // Header tabla
  for (let c = 0; c < headersTabla.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    if (ws[ref]) ws[ref].s = { fill:{fgColor:{rgb:'00665E'}}, font:{color:{rgb:'FFFFFF'},bold:true,sz:10}, alignment:{horizontal:'center'} };
  }

  // Por cada producto: comisión, envío, fórmulas
  productos.forEach((p, i) => {
    const r = headerRowIdx + 1 + i;
    const excelRow = r + 1;
    const e = _enriquecerProducto_({ ...p, total: (p.disponible||0)+(p.disponibleCD||0) });
    const comision = _comisionMELI_(e._cat_meli);
    const envio    = _envioMELIporPeso_(e._peso);

    // Modelo (col D = index 3) — rojo si SIN MODELO
    const modeloRef = XLSX.utils.encode_cell({ r, c: 3 });
    if (ws[modeloRef]) {
      const v = String(ws[modeloRef].v || '').toUpperCase();
      const esSinModelo = v.includes('SIN MODELO');
      ws[modeloRef].s = {
        alignment:{horizontal:'center'},
        font: esSinModelo ? {bold:true,color:{rgb:'FFFFFF'}} : {color:{rgb:'333333'}},
        fill: esSinModelo ? {fgColor:{rgb:'E05555'}} : undefined,
      };
    }
    // Precio CVA (col G = 6)
    const precioRef = XLSX.utils.encode_cell({ r, c: 6 });
    if (ws[precioRef]) { ws[precioRef].z = moneyFmt; ws[precioRef].s = {numFmt:moneyFmt,alignment:{horizontal:'right'}}; }
    // % Gan (col H = 7)
    const ganRef = XLSX.utils.encode_cell({ r, c: 7 });
    if (ws[ganRef]) ws[ganRef].s = {alignment:{horizontal:'center'},font:{bold:true,color:{rgb:'00665E'}},fill:{fgColor:{rgb:'F0F7F6'}}};
    // Precio MELI (col I = 8) — fórmula
    const meliRef = XLSX.utils.encode_cell({ r, c: 8 });
    ws[meliRef] = {
      t:'n',
      f:`IF(G${excelRow}<=298, G${excelRow}*(1+${comision})+33, G${excelRow}*(1+${comision})+${envio}) * (1+H${excelRow}/100)`,
      z:moneyFmt,
      s:{numFmt:moneyFmt,alignment:{horizontal:'right'},font:{bold:true,color:{rgb:'00665E'}},fill:{fgColor:{rgb:'E8F5F4'}}},
    };
    // Unidades (col J = 9)
    const uniRef = XLSX.utils.encode_cell({ r, c: 9 });
    if (ws[uniRef]) ws[uniRef].s = {alignment:{horizontal:'center'},font:{bold:true,color:{rgb:'00665E'}},fill:{fgColor:{rgb:'F0F7F6'}}};
    // Total (col K = 10) — fórmula G*J
    const totalRef = XLSX.utils.encode_cell({ r, c: 10 });
    ws[totalRef] = {
      t:'n', f:`G${excelRow}*J${excelRow}`, z:moneyFmt,
      s:{numFmt:moneyFmt,alignment:{horizontal:'right'},font:{bold:true}},
    };
    // Stock (col F = 5)
    const stockRef = XLSX.utils.encode_cell({ r, c: 5 });
    if (ws[stockRef]) { ws[stockRef].z = '#,##0'; ws[stockRef].s = {numFmt:'#,##0',alignment:{horizontal:'right'}}; }
    // UPC (col L = 11)
    const upcRef = XLSX.utils.encode_cell({ r, c: 11 });
    if (ws[upcRef]) ws[upcRef].s = {font:{name:'Courier New',sz:10},alignment:{horizontal:'center'}};
  });

  // Total general
  const totalRowIdx = headerRowIdx + 1 + productos.length;
  ws[XLSX.utils.encode_cell({r:totalRowIdx,c:9})] = {
    t:'s', v:'TOTAL GENERAL:',
    s:{font:{bold:true,color:{rgb:'00665E'}},alignment:{horizontal:'right'}},
  };
  ws[XLSX.utils.encode_cell({r:totalRowIdx,c:10})] = {
    t:'n', f:`SUM(K${headerRowIdx+2}:K${totalRowIdx})`, z:moneyFmt,
    s:{numFmt:moneyFmt,font:{bold:true,sz:12,color:{rgb:'00665E'}},fill:{fgColor:{rgb:'F0F7F6'}},alignment:{horizontal:'right'},border:{top:{style:'medium',color:{rgb:'00665E'}}}},
  };

  ws['!autofilter'] = { ref: XLSX.utils.encode_range({s:{r:headerRowIdx,c:0},e:{r:headerRowIdx+productos.length,c:lastHeaderCol}}) };
  ws['!freeze'] = { xSplit:0, ySplit: headerRowIdx+1 };
  ws['!cols'] = [
    {wch:14},{wch:55},{wch:18},{wch:16},{wch:22},{wch:11},{wch:13},{wch:9},{wch:15},{wch:13},{wch:16},{wch:16},
  ];
  ws['!ref'] = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:totalRowIdx,c:lastHeaderCol}});

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export Datos');
  XLSX.writeFile(wb, `CVA_ExportDatos_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ─── PDF ───
function exportarPDF() {
  if (_exportarProductos.length === 0) { alert('Primero busca los productos.'); return; }
  const productos = _exportarProductos;
  const fechaGen = new Date().toLocaleString('es-MX');
  const fmtMXN = (n) => '$' + Math.round(n||0).toLocaleString('es-MX');

  const w = window.open('', '_blank');
  if (!w) { alert('Permite popups para exportar PDF'); return; }

  const filasHtml = productos.map(p => {
    const _m = _modeloDeProducto_({ clave: p.clave, marca: p.marca, desc: p.descripcion, descripcion: p.descripcion });
    const esSinModelo = _m.vacio === true;
    const stock = (p.disponible || 0) + (p.disponibleCD || 0);
    const precioMXN = p.moneda === 'Dolares' ? (p.precio * (p.tipo_cambio || 17.5)) : p.precio;
    return `<tr>
      <td class="mono">${p.clave || ''}</td>
      <td>${(p.descripcion || '').substring(0, 70)}</td>
      <td>${p.marca || ''}</td>
      <td class="${esSinModelo ? 'sinmodelo' : _m.auto ? 'auto' : ''}">${_m.texto}</td>
      <td>${p.grupo || ''}</td>
      <td class="r">${stock.toLocaleString('es-MX')}</td>
      <td class="r">${fmtMXN(precioMXN)}</td>
    </tr>`;
  }).join('');

  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Export Datos · CVA</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px 28px; font-size: 11px; color: #222; }
      .header-block { border-bottom: 2px solid #00665e; padding-bottom: 14px; margin-bottom: 22px; }
      h1 { color: #00665e; font-size: 22px; margin: 0 0 4px; font-weight: 500; letter-spacing: 1px; }
      .empresa { font-size: 11px; color: #555; margin-bottom: 8px; }
      .meta { font-size: 10px; color: #888; line-height: 1.6; }
      .meta b { color: #444; font-weight: 500; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th { background: #2d5a57; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; }
      th.r { text-align: right; }
      td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
      td.r { text-align: right; font-variant-numeric: tabular-nums; }
      td.mono { font-family: 'Courier New', monospace; color: #00665e; font-weight: 500; }
      td.sinmodelo { background: #e05555 !important; color: #fff !important; font-weight: 700; text-align: center; }
      td.auto { color: #888; font-style: italic; }
      tr:nth-child(even) { background: #fafafa; }
      .footer { margin-top: 30px; padding-top: 14px; border-top: 1px solid #eee; font-size: 9px; color: #888; text-align: center; letter-spacing: 1px; }
      @media print { @page { size: landscape; margin: 1cm; } }
    </style></head><body>
    <div class="header-block">
      <h1>Reporte de Productos · Export Datos</h1>
      <div class="empresa">Electronics México · LEONGEM COMERCIALIZADORA · Cuenta CVA 2395390</div>
      <div class="meta">
        <b>Total productos:</b> ${productos.length}  ·
        <b>Generado:</b> ${fechaGen}
      </div>
    </div>
    <table>
      <thead><tr>
        <th>Clave</th><th>Descripción</th><th>Marca</th><th>Modelo</th>
        <th>Grupo</th><th class="r">Stock</th><th class="r">Precio CVA</th>
      </tr></thead>
      <tbody>${filasHtml}</tbody>
    </table>
    <div class="footer">Documento generado desde Exportar Datos · Electronics México</div>
    <script>setTimeout(()=>window.print(), 500);</script>
  </body></html>`);
  w.document.close();
}

Object.assign(window, { cargarExportar, exportarBuscar, exportarLimpiar, exportarExcel, exportarPDF });

// ════════════════════════════════════════════════════════════════
//  TABLERO — animación de fondo: red de puntos sutil
//  Solo corre cuando estás en page-tablero; se pausa al salir para
//  no gastar CPU.
// ════════════════════════════════════════════════════════════════
(function() {
  let _tabAnimRAF = null;
  let _tabAnimPoints = [];
  let _tabAnimCanvas = null;
  let _tabAnimCtx = null;
  let _tabAnimW = 0, _tabAnimH = 0;

  function tabAnimInit() {
    _tabAnimCanvas = document.getElementById('tab-bg-canvas');
    if (!_tabAnimCanvas) return;
    _tabAnimCtx = _tabAnimCanvas.getContext('2d');
    tabAnimResize();
    // Más puntos para una red más densa y visible
    const N = Math.max(60, Math.floor(_tabAnimW / 22));
    _tabAnimPoints = [];
    for (let i = 0; i < N; i++) {
      _tabAnimPoints.push({
        x: Math.random() * _tabAnimW,
        y: Math.random() * _tabAnimH,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.8 + 1.2,   // puntos más grandes (1.2 - 3.0)
      });
    }
    tabAnimLoop();
  }

  function tabAnimResize() {
    if (!_tabAnimCanvas) return;
    const rect = _tabAnimCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    _tabAnimW = rect.width;
    _tabAnimH = rect.height;
    _tabAnimCanvas.width  = _tabAnimW * dpr;
    _tabAnimCanvas.height = _tabAnimH * dpr;
    _tabAnimCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function tabAnimLoop() {
    if (!_tabAnimCtx || !_tabAnimCanvas) return;
    // Si el tablero ya no está activo, pausamos
    const isActive = document.body.classList.contains('in-tablero');
    if (!isActive) {
      _tabAnimRAF = null;
      return;
    }
    _tabAnimCtx.clearRect(0, 0, _tabAnimW, _tabAnimH);

    // Mover puntos
    _tabAnimPoints.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > _tabAnimW) p.vx *= -1;
      if (p.y < 0 || p.y > _tabAnimH) p.vy *= -1;
    });

    // Líneas entre puntos cercanos (entramado más visible)
    for (let i = 0; i < _tabAnimPoints.length; i++) {
      for (let j = i + 1; j < _tabAnimPoints.length; j++) {
        const a = _tabAnimPoints[i], b = _tabAnimPoints[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < 22000) {
          const opacity = (1 - d2 / 22000) * 0.75;
          _tabAnimCtx.strokeStyle = 'rgba(103,184,175,' + opacity + ')';
          _tabAnimCtx.lineWidth = 1.0;
          _tabAnimCtx.beginPath();
          _tabAnimCtx.moveTo(a.x, a.y);
          _tabAnimCtx.lineTo(b.x, b.y);
          _tabAnimCtx.stroke();
        }
      }
    }

    // Dibujar puntos (más brillantes, con glow)
    _tabAnimPoints.forEach(p => {
      // Glow exterior
      _tabAnimCtx.fillStyle = 'rgba(103,184,175,0.25)';
      _tabAnimCtx.beginPath();
      _tabAnimCtx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
      _tabAnimCtx.fill();
      // Punto central brillante
      _tabAnimCtx.fillStyle = 'rgba(180,230,220,0.95)';
      _tabAnimCtx.beginPath();
      _tabAnimCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      _tabAnimCtx.fill();
    });

    _tabAnimRAF = requestAnimationFrame(tabAnimLoop);
  }

  function tabAnimStart() {
    if (_tabAnimRAF) return;  // ya está corriendo
    if (!_tabAnimCanvas) tabAnimInit();
    else { tabAnimResize(); tabAnimLoop(); }
  }

  // Re-inicializar al cambiar tamaño de ventana
  window.addEventListener('resize', () => {
    if (document.body.classList.contains('in-tablero')) {
      tabAnimResize();
    }
  });

  // Hook al showPage: cuando vamos al tablero, arranca; cuando salimos, se pausa solo
  const _origShowPage = window.showPage;
  if (typeof _origShowPage === 'function') {
    window.showPage = function(id) {
      _origShowPage(id);
      if (id === 'tablero') {
        setTimeout(tabAnimStart, 50);
      }
    };
  }

  // Inicio al cargar (cuando ya está el DOM)
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (document.body.classList.contains('in-tablero')) tabAnimStart();
    }, 100);
  });
})();

// ════════════════════════════════════════════════════════════════
//  TABLERO — auto-hover aleatorio entre las cards.
//  Cada ~1.8s ilumina una card al azar (solo una a la vez), el efecto
//  visual es el mismo que el hover real. Se pausa cuando sales del
//  tablero. El hover manual del mouse sigue funcionando normal.
// ════════════════════════════════════════════════════════════════
(function() {
  let _autoHoverInterval = null;
  let _activeCard = null;

  function _autoHoverTick() {
    // Si ya no estamos en el tablero, detener
    if (!document.body.classList.contains('in-tablero')) {
      _autoHoverStop();
      return;
    }
    const cards = document.querySelectorAll('#page-tablero .tab-card');
    if (cards.length === 0) return;

    // Apagar la card actual
    if (_activeCard) _activeCard.classList.remove('auto-hover');

    // Elegir una nueva (distinta de la anterior)
    let next;
    let attempts = 0;
    do {
      next = cards[Math.floor(Math.random() * cards.length)];
      attempts++;
    } while (next === _activeCard && cards.length > 1 && attempts < 6);

    _activeCard = next;
    _activeCard.classList.add('auto-hover');
  }

  function _autoHoverStart() {
    if (_autoHoverInterval) return;
    // Pequeña espera para que las cards terminen su entrada (fade-in stagger)
    setTimeout(_autoHoverTick, 600);
    _autoHoverInterval = setInterval(_autoHoverTick, 1800);
  }

  function _autoHoverStop() {
    if (_autoHoverInterval) {
      clearInterval(_autoHoverInterval);
      _autoHoverInterval = null;
    }
    if (_activeCard) {
      _activeCard.classList.remove('auto-hover');
      _activeCard = null;
    }
  }

  // Hook al showPage: arrancar al entrar al tablero, parar al salir
  const _origShowPage2 = window.showPage;
  if (typeof _origShowPage2 === 'function') {
    window.showPage = function(id) {
      _origShowPage2(id);
      if (id === 'tablero') setTimeout(_autoHoverStart, 200);
      else _autoHoverStop();
    };
  }

  // Arrancar al cargar la página por primera vez
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (document.body.classList.contains('in-tablero')) _autoHoverStart();
    }, 800);
  });

  // Si el usuario pasa el mouse sobre una card, pausar el auto-hover unos segundos
  // (para que no compita visualmente con su intención)
  document.addEventListener('mouseover', (e) => {
    const card = e.target.closest('#page-tablero .tab-card');
    if (card && _autoHoverInterval) {
      _autoHoverStop();
      // Reanudar después de 4s de inactividad
      setTimeout(() => {
        if (document.body.classList.contains('in-tablero')) _autoHoverStart();
      }, 4000);
    }
  });
})();

// ════════════════════════════════════════════════════════════════
//  LAZY LOAD de miniaturas en Análisis
//  Las imágenes se cargan solo cuando entran al viewport, con cache
//  para no repetir llamadas a CVA por la misma clave.
// ════════════════════════════════════════════════════════════════
(function() {
  const _imgCache = new Map();   // clave → url || 'none'
  const _imgInFlight = new Set(); // claves siendo consultadas
  let _imgObserver = null;
  let _imgConcurrent = 0;
  const _MAX_CONCURRENT = 3;
  const _imgPending = []; // cola: [{clave, el}]

  function _processQueue() {
    while (_imgConcurrent < _MAX_CONCURRENT && _imgPending.length) {
      const next = _imgPending.shift();
      _loadOne(next.clave, next.el);
    }
  }

  async function _loadOne(clave, el) {
    if (!clave || !el) { _processQueue(); return; }
    // Cache hit
    if (_imgCache.has(clave)) {
      _renderThumb(el, _imgCache.get(clave));
      _processQueue();
      return;
    }
    if (_imgInFlight.has(clave)) {
      // Reintentar después
      setTimeout(() => { if (_imgCache.has(clave)) _renderThumb(el, _imgCache.get(clave)); }, 400);
      _processQueue();
      return;
    }
    _imgInFlight.add(clave);
    _imgConcurrent++;
    try {
      const data = await api('cva_imagenes', { clave });
      const imgs = (data && (data.imagenes || data.fotos)) || [];
      let url = '';
      if (imgs.length) {
        const first = imgs[0];
        url = typeof first === 'string' ? first : (first.url || first.imagen || '');
      }
      _imgCache.set(clave, url || 'none');
      _renderThumb(el, url || 'none');
    } catch(e) {
      _imgCache.set(clave, 'none');
      _renderThumb(el, 'none');
    } finally {
      _imgInFlight.delete(clave);
      _imgConcurrent--;
      _processQueue();
    }
  }

  function _renderThumb(el, url) {
    if (!el || el.dataset.loaded === '1') return;
    el.dataset.loaded = '1';
    if (url && url !== 'none') {
      el.innerHTML = `<img src="${url}" alt="" onerror="this.parentNode.classList.add('an-thumb-empty')">`;
      el.classList.add('an-thumb-img');
    } else {
      el.classList.add('an-thumb-empty');
    }
  }

  function initThumbLoader_() {
    // Crear observer una sola vez
    if (!_imgObserver) {
      _imgObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const clave = el.dataset.clave;
            if (clave && el.dataset.loaded !== '1') {
              _imgPending.push({ clave, el });
              _processQueue();
              _imgObserver.unobserve(el);
            }
          }
        });
      }, { rootMargin: '200px' });
    }
    // Observar todas las miniaturas pendientes
    document.querySelectorAll('.an-thumb[data-loaded="0"]').forEach(el => {
      _imgObserver.observe(el);
    });
  }

  window.initThumbLoader_ = initThumbLoader_;
})();

// ════════════════════════════════════════════════════════════════
//  Botón ↻ en header — recarga datos sin recargar la página.
//
//  Específicamente: refetches metadata del Sheet (que ya tiene los
//  modelos correctos), PISA la cache local, y re-renderiza la página
//  actual. La función _modeloDeProducto_ ya prioriza METADATA sobre
//  la heurística — el bug era que la cache no se actualizaba.
// ════════════════════════════════════════════════════════════════
async function recargarTodo() {
  const btn = document.getElementById('badge-refresh');
  const icon = document.getElementById('badge-refresh-icon');
  if (btn) btn.disabled = true;
  if (icon) icon.style.animation = 'spin 0.8s linear infinite';

  let mdAntes = 0, mdDespues = 0;

  try {
    // 1) Limpiar la cache local de metadata (variable + localStorage)
    try {
      mdAntes = Object.keys(_metadataProductos || {}).length;
      _metadataProductos = {};
      localStorage.removeItem(LS_KEY_MD);
    } catch(e) { console.warn('limpiar md:', e); }

    // 2) Fetch fresco desde el Sheet (METADATA_PRODUCTOS) — pisa la cache
    if (typeof _loadMetadataFromSheet_ === 'function') {
      try {
        mdDespues = await _loadMetadataFromSheet_();
      } catch(e) { console.warn('load md sheet:', e); }
    }

    // 3) Refrescar saldo CVA
    if (typeof cargarSaldo === 'function') {
      try { await cargarSaldo(); } catch(e) {}
    }

    // 4) Re-renderizar la página actual con los datos frescos
    const page = currentPage || 'tablero';
    try {
      if (page === 'analisis'   && typeof cargarAnalisis === 'function')   await cargarAnalisis();
      if (page === 'pedidos'    && typeof cargarPedidos === 'function')    await cargarPedidos();
      if (page === 'sync'       && typeof cargarEstadoSync === 'function') await cargarEstadoSync();
      if (page === 'invodoo'    && typeof cargarInvOdoo === 'function')    await cargarInvOdoo();
      if (page === 'exportar' && typeof _exportarProductos !== 'undefined' &&
          _exportarProductos && _exportarProductos.length) {
        // Re-render preview con metadatos frescos
        _renderExportResultado_(_exportarProductos, []);
      }
      if (page === 'buscar' && typeof _lastTablaHTML !== 'undefined' && _lastTablaHTML) {
        const el = document.getElementById('tabla');
        if (el) el.innerHTML = _lastTablaHTML;
      }
    } catch(e) { console.warn('re-render página:', e); }

    // Feedback visual breve
    console.log(`[recargarTodo] Metadata: ${mdAntes} → ${mdDespues} productos`);
    if (btn) {
      btn.style.background = 'rgba(0,200,120,0.25)';
      btn.style.borderColor = 'rgba(0,200,120,0.8)';
      btn.style.color = '#fff';
      const orig = btn.innerHTML;
      btn.innerHTML = '<span style="font-size:10px;letter-spacing:1px;padding:0 2px">' + mdDespues + ' MD</span>';
      setTimeout(() => {
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
        btn.innerHTML = orig;
      }, 1400);
    }
  } catch(e) {
    console.error('recargarTodo error:', e);
  } finally {
    if (icon) icon.style.animation = '';
    if (btn) btn.disabled = false;
  }
}
window.recargarTodo = recargarTodo;
