// ── SIDEBAR ──────────────────────────────────────────────
let sidebarOpen = false;

function toggleSidebar() {
  sidebarOpen ? closeSidebar() : openSidebar();
}
function openSidebar() {
  sidebarOpen = true;
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sb-overlay').classList.add('open');
  document.getElementById('ham-svg-menu').style.display  = 'none';
  document.getElementById('ham-svg-close').style.display = 'block';
}
function closeSidebar() {
  sidebarOpen = false;
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-overlay').classList.remove('open');
  document.getElementById('ham-svg-menu').style.display  = 'block';
  document.getElementById('ham-svg-close').style.display = 'none';
}

// ── NAV ───────────────────────────────────────────────────
let currentPage = 'buscar';

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(t => t.classList.remove('active'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');
  const nav = document.getElementById('nav-' + id);
  if (nav) nav.classList.add('active');
  currentPage = id;
  try { closeSidebar(); } catch(e) {}
  try { history.pushState({ page: id }, '', ''); } catch(e) {}
  const sw = document.querySelector('.scroll-wrap');
  if (sw) sw.scrollTop = 0;
  if (id === 'sync')    setTimeout(() => { try { cargarEstadoSync();   } catch(e) {} }, 100);
  if (id === 'pedidos') setTimeout(() => { try { cargarPedidos();      } catch(e) {} }, 100);
  if (id === 'orden')   setTimeout(() => { try { iniciarPaginaOrden(); } catch(e) {} }, 100);
  if (id === 'analisis') setTimeout(() => { try { cargarAnalisis();    } catch(e) {} }, 100);
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

  const sdot = (qty) => {
    const cls = !qty ? 'none' : qty < 5 ? 'low' : 'ok';
    return `<div class="pv-stock-dot ${cls}"></div>`;
  };
  const sval = (qty) => qty ? `${qty.toLocaleString()} uds` : 'Sin stock';
  const arrow = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;

  const items = [
    { label: 'Precio unitario',   value: `${fmt(p.precio, p.moneda)}${p.tipo_cambio ? `  ·  TC $${p.tipo_cambio}` : ''}`, dot: '' },
    { label: 'Stock Sucursal',    value: sval(p.disponible),   dot: sdot(p.disponible)   },
    { label: 'Stock CEDIS',       value: sval(p.disponibleCD), dot: sdot(p.disponibleCD) },
    p.en_transito  ? { label: 'En Tránsito',  value: `${p.en_transito.toLocaleString()} uds`, dot: '' } : null,
    p.garantia     ? { label: 'Garantía',     value: p.garantia, dot: '' } : null,
    dim            ? { label: 'Dimensiones',  value: `${dim.alto}m × ${dim.ancho}m × ${dim.profundidad}m · ${dim.peso} ${dim.unidad_peso}`, dot: '' } : null,
    p.tipo_producto?.tipo ? { label: 'Categoría', value: p.tipo_producto.tipo, dot: '' } : null,
    p.codigo       ? { label: 'Código UPC',   value: p.codigo, dot: '' } : null,
  ].filter(Boolean);

  return `
    <div class="pv-wrap">
      <div class="pv-left">
        <div class="pv-bg"></div>
        <div class="pv-hero">
          <div class="pv-hero-badge">${p.clave}</div>
          <button class="pv-back" onclick="volverATabla()">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Volver
          </button>
          ${p.imagen
            ? `<img src="${p.imagen}" alt="${p.descripcion}" onerror="this.style.display='none'">`
            : `<div class="pv-hero-placeholder">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.4"><rect x="3" y="3" width="18" height="18"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(238,240,240,0.15)">Sin imagen disponible</div>
               </div>`}
          ${p.marca ? `<div class="pv-hero-marca">${p.marca}</div>` : ''}
        </div>
        ${promo ? `
        <div class="pv-promo">
          <strong style="color:#fff;font-weight:600">Promoción activa:</strong> ${promo.descripcion_promocion}<br>
          <span style="opacity:.8">${fmt(promo.precio_descuento, promo.moneda_precio_descuento)} · Vence: ${promo.promocion_vencimiento}</span>
        </div>` : ''}
        ${sucursales.length > 0 ? `
        <div class="pv-sucursales">
          <div class="pv-suc-title">Disponibilidad por sucursal</div>
          <div class="pv-suc-grid">
            ${sucursales.map(s => `
              <div class="pv-suc-item">
                <div class="pv-suc-nombre">${s.nombre.replace('VENTAS ', '').replace('CENTRO DE DIST.', 'CDIST')}</div>
                <div class="pv-suc-qty ${s.disponible === 0 ? 'zero' : ''}">${s.disponible}</div>
              </div>`).join('')}
          </div>
        </div>` : ''}
      </div>

      <div class="pv-panel">
        <div class="pv-panel-head">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="min-width:0">
              <div class="pv-panel-marca">${p.marca || 'CVA'}</div>
              <div class="pv-panel-nombre">${p.descripcion}</div>
              ${p.grupo ? `<div class="pv-panel-grupo">${p.grupo}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;margin-top:2px">
              <button class="btn btn-ghost" style="padding:5px 10px;font-size:10px;letter-spacing:1px;display:flex;align-items:center;gap:5px" onclick="exportProductoCSV()">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>CSV
              </button>
              <button class="btn btn-ghost" style="padding:5px 10px;font-size:10px;letter-spacing:1px;display:flex;align-items:center;gap:5px" onclick="exportProductoPDF()">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>PDF
              </button>
            </div>
          </div>
        </div>

        <div class="pv-price-block">
          <div class="pv-price">${fmt(p.precio, p.moneda)}</div>
          <div class="pv-price-moneda">${monedaStr}</div>
          ${promo ? `<div class="pv-price-promo">Promo activa</div>` : ''}
        </div>

        <div class="pv-meli-block" id="pv-meli-block">
          <div class="pv-meli-logo">ML</div>
          <div class="pv-meli-content">
            <div class="pv-meli-loading" id="pv-meli-loading">Buscando en MercadoLibre…</div>
          </div>
        </div>

        <div class="pv-items">
          ${items.map(it => `
            <div class="pv-item">
              <div style="min-width:0">
                <div class="pv-item-label">${it.label}</div>
                <div class="pv-item-value">${it.value}</div>
              </div>
              <div class="pv-item-right">
                ${it.dot}
                <span class="pv-item-arrow">${arrow}</span>
              </div>
            </div>`).join('')}
        </div>

        <div class="pv-cta-bar">
          <div class="pv-qty-ctrl">
            <button class="pv-qty-btn" onclick="pvQtyChange(-1)">−</button>
            <input class="pv-qty-input" id="pv-qty" type="number" value="1" min="1" max="999">
            <button class="pv-qty-btn" onclick="pvQtyChange(1)">+</button>
          </div>
          <button class="pv-cta"
            onclick="agregarClave('${p.clave}', parseInt(document.getElementById('pv-qty').value)||1)">
            Agregar a Orden
          </button>
        </div>
      </div>
    </div>`;
}

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
async function cargarVentasOdoo() {
  const el = document.getElementById('odoo-result');
  loading(el);
  const data = await api('odoo_ventas_pendientes', { limit: 50 });
  if (!data.ok) { alert_(el, '✖ ' + data.error, 'error'); return; }
  const ventas = data.ventas || [];
  if (ventas.length === 0) { alert_(el, '✓ Sin ventas pendientes de dropship', 'success'); return; }
  el.innerHTML = `<div class="table-wrap"><table>
    <tr><th>SO</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr>
    ${ventas.map(v=>`<tr>
      <td class="mono">${v.name}</td>
      <td>${Array.isArray(v.partner_id)?v.partner_id[1]:v.partner_id}</td>
      <td>${fmt(v.amount_total,'Pesos')}</td>
      <td><span style="letter-spacing:1px;font-size:10px;text-transform:uppercase;color:var(--muted)">${v.state}</span></td>
      <td style="font-size:11px;color:var(--muted)">${v.date_order?v.date_order.substring(0,10):'—'}</td>
    </tr>`).join('')}
  </table></div>`;
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
  tab: "movidos",     // movidos | agotados | sin_movimiento | todos | marcas | grupos
  busqueda: "",
  marca: "",
  grupo: "",
  precioMin: null,
  precioMax: null,
  soloMovimiento: false,
  pagina: 1,
  porPagina: 20,
  sortCol: "movido",
  sortDir: -1,        // 1 asc, -1 desc
};

async function cargarAnalisis() {
  const cont = document.getElementById('analisis-content') || document.getElementById('analisis-top-movidos');
  if (cont) cont.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);font-size:11px;letter-spacing:2px;text-transform:uppercase"><span class="spin"></span>Calculando análisis…</div>';

  const data = await api('analisis_movimiento');
  if (!data.ok) {
    if (cont) alert_(cont, '✖ ' + (data.error || 'Error'), 'error');
    return;
  }

  _analisisData = data;
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
    // Buscar el contenedor de kpis
    const kpiGrid = page.querySelector('.grid-3');
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
    <!-- Periodo -->
    <div style="padding:14px 18px;background:rgba(0,102,94,0.05);border-left:2px solid var(--green);margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div style="font-size:11px;color:var(--muted);letter-spacing:1px">
        Periodo: <strong style="color:var(--text)">${p.fecha_inicio || '—'}</strong> → <strong style="color:var(--text)">${p.fecha_fin || '—'}</strong>
        <span style="opacity:0.5"> · ${p.dias} días · ${p.snapshots_validos} snapshots</span>
      </div>
      <div style="font-size:10px;color:var(--green-lt);letter-spacing:1.5px">
        ${fmtN(k.unidades_movidas)} unidades movidas · ${fmtMXN(k.valor_movido_mxn)} valor estimado
      </div>
    </div>

    <!-- Filtros -->
    <div style="background:rgba(0,0,0,0.18);padding:14px;margin-bottom:18px;border:1px solid rgba(238,240,240,0.06)">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:10px">
        <input id="anal-busqueda" placeholder="Buscar clave, descripción…" value="${_analisisFiltros.busqueda}" oninput="anFiltrar('busqueda',this.value)" style="background:rgba(0,0,0,0.3);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:8px 12px;font-size:12px;outline:none">
        <select id="anal-marca" onchange="anFiltrar('marca',this.value)" style="background:rgba(0,0,0,0.3);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:8px 12px;font-size:12px;outline:none">
          <option value="">Todas las marcas</option>
          ${marcas.slice(0,80).map(m => `<option value="${m.marca}" ${_analisisFiltros.marca===m.marca?'selected':''}>${m.marca} (${m.productos})</option>`).join('')}
        </select>
        <select id="anal-grupo" onchange="anFiltrar('grupo',this.value)" style="background:rgba(0,0,0,0.3);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:8px 12px;font-size:12px;outline:none">
          <option value="">Todos los grupos</option>
          ${grupos.slice(0,80).map(g => `<option value="${g.grupo}" ${_analisisFiltros.grupo===g.grupo?'selected':''}>${g.grupo} (${g.productos})</option>`).join('')}
        </select>
        <select id="anal-porpag" onchange="anFiltrar('porPagina',parseInt(this.value))" style="background:rgba(0,0,0,0.3);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:8px 12px;font-size:12px;outline:none">
          ${[10,20,50,100,250,500,1000,9999].map(n => `<option value="${n}" ${_analisisFiltros.porPagina===n?'selected':''}>${n>=9999?'Todos':n+' / pág'}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="number" placeholder="Precio mín" value="${_analisisFiltros.precioMin||''}" oninput="anFiltrar('precioMin',this.value?parseFloat(this.value):null)" style="background:rgba(0,0,0,0.3);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:6px 10px;font-size:11px;width:110px;outline:none">
        <input type="number" placeholder="Precio máx" value="${_analisisFiltros.precioMax||''}" oninput="anFiltrar('precioMax',this.value?parseFloat(this.value):null)" style="background:rgba(0,0,0,0.3);border:1px solid rgba(238,240,240,0.1);color:var(--text);padding:6px 10px;font-size:11px;width:110px;outline:none">
        <label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" ${_analisisFiltros.soloMovimiento?'checked':''} onchange="anFiltrar('soloMovimiento',this.checked)"> Solo con movimiento
        </label>
        <div style="flex:1"></div>
        <button class="btn btn-ghost" style="padding:6px 14px;font-size:10px" onclick="anExportCSV()">CSV</button>
        <button class="btn btn-ghost" style="padding:6px 14px;font-size:10px" onclick="anExportPDF()">PDF</button>
        <button class="btn btn-ghost" style="padding:6px 14px;font-size:10px" onclick="anLimpiarFiltros()">Limpiar</button>
      </div>
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:0;margin-bottom:0;border-bottom:1px solid rgba(238,240,240,0.08);overflow-x:auto">
      ${[
        ['movidos','▼ Más movidos', productos.filter(p=>p.tiene_movimiento).length],
        ['agotados','✖ Agotados', productos.filter(p=>p.agotado_recientemente).length],
        ['sin_movimiento','• Sin movimiento', productos.filter(p=>!p.tiene_movimiento && p.total>0).length],
        ['todos','◯ Todos', productos.length],
        ['marcas','📊 Por marca', marcas.length],
        ['grupos','📦 Por grupo', grupos.length],
      ].map(([id,label,count]) => `
        <button onclick="anTab('${id}')" style="background:${_analisisFiltros.tab===id?'rgba(0,102,94,0.15)':'transparent'};border:none;border-bottom:2px solid ${_analisisFiltros.tab===id?'var(--green-lt)':'transparent'};color:${_analisisFiltros.tab===id?'var(--green-lt)':'var(--muted)'};padding:12px 18px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;white-space:nowrap;font-family:inherit">
          ${label} <span style="opacity:0.5;font-size:10px">${count}</span>
        </button>
      `).join('')}
    </div>

    <!-- Contenido del tab -->
    <div id="anal-tab-content" style="padding-top:16px"></div>
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

function anLimpiarFiltros() {
  _analisisFiltros.busqueda = "";
  _analisisFiltros.marca = "";
  _analisisFiltros.grupo = "";
  _analisisFiltros.precioMin = null;
  _analisisFiltros.precioMax = null;
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

  const cols = [
    {k:'clave',     l:'Clave',       t:'mono', w:'90px'},
    {k:'desc',      l:'Descripción', t:'desc'},
    {k:'marca',     l:'Marca',       t:'small'},
    {k:'stock_base',l:`Stock ${(_analisisData.periodo && _analisisData.periodo.fecha_inicio) || ''}`, t:'num'},
    {k:'total',     l:'Stock Hoy',   t:'num'},
    {k:'movido',    l:'▼ Movido',    t:'mov', hi:true},
    {k:'prom_diario',l:'Prom/día',   t:'num'},
    {k:'prom_semanal',l:'Prom/sem',  t:'num'},
    {k:'prom_mensual',l:'Prom/mes',  t:'num'},
    {k:'dias_restantes',l:'Días stock', t:'dias'},
    {k:'precio',    l:'Precio',      t:'mxn'},
    {k:'valor_movido',l:'Valor mov', t:'mxn'},
  ];

  const headerHtml = cols.map(c => {
    const isSort = f.sortCol === c.k;
    const arrow = isSort ? (f.sortDir > 0 ? ' ↑' : ' ↓') : '';
    return `<th onclick="anSort('${c.k}')" style="cursor:pointer;user-select:none;${c.hi?'color:var(--green-lt);':''}${c.w?'width:'+c.w+';':''}padding:8px 10px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${isSort?'var(--green-lt)':'var(--muted)'};text-align:${['num','mov','mxn','dias'].includes(c.t)?'right':'left'};border-bottom:1px solid rgba(238,240,240,0.1)">${c.l}${arrow}</th>`;
  }).join('');

  const rowsHtml = pag.map(p => {
    return '<tr style="border-bottom:1px solid rgba(238,240,240,0.04)">' + cols.map(c => {
      const v = p[c.k];
      let cell = '—';
      let extra = '';
      if (c.t === 'mono')  cell = `<span style="font-family:monospace;color:var(--green-lt);font-size:11px">${v||'—'}</span>`;
      else if (c.t === 'desc') cell = `<span title="${(v||'').replace(/"/g,'&quot;')}" style="font-size:12px">${(v||'—').substring(0,60)}${v && v.length>60?'…':''}</span>`;
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
      return `<td style="padding:6px 10px;${extra}">${cell}</td>`;
    }).join('') + '</tr>';
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
    <div style="font-size:11px;color:var(--muted);margin-bottom:10px;letter-spacing:1px">
      ${total.toLocaleString('es-MX')} productos · Mostrando ${inicio + 1}–${Math.min(inicio + f.porPagina, total)}
    </div>
    <div style="overflow-x:auto;border:1px solid rgba(238,240,240,0.06)">
      <table style="width:100%;border-collapse:collapse;min-width:1100px">
        <thead style="background:rgba(0,0,0,0.3)"><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="'+cols.length+'" style="padding:30px;text-align:center;color:var(--muted)">Sin productos con estos filtros</td></tr>'}</tbody>
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
}

function renderTablaSimple(items, cols) {
  const fmtMXN = (n) => '$' + (Math.round(n||0)).toLocaleString('es-MX');
  const f = _analisisFiltros;
  const headerHtml = cols.map(c => {
    const isSort = f.sortCol === c.k;
    return `<th onclick="anSort('${c.k}')" style="cursor:pointer;padding:8px 10px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${isSort?'var(--green-lt)':'var(--muted)'};text-align:${c.t==='text'?'left':'right'};border-bottom:1px solid rgba(238,240,240,0.1)${c.hi?';color:var(--green-lt)':''}">${c.l}${isSort?(f.sortDir>0?' ↑':' ↓'):''}</th>`;
  }).join('');
  const rowsHtml = items.map(it => '<tr style="border-bottom:1px solid rgba(238,240,240,0.04)">' + cols.map(c => {
    const v = it[c.k];
    let cell = '—'; let extra = '';
    if (c.t === 'text') { cell = v || '—'; extra = 'font-size:12px'; }
    else if (c.t === 'num') { cell = (v||0).toLocaleString('es-MX'); extra = 'text-align:right;font-family:Barlow Condensed,sans-serif;font-size:14px' + (c.hi?';color:var(--green-lt);font-weight:500':''); }
    else if (c.t === 'mxn') { cell = fmtMXN(v); extra = 'text-align:right;font-family:Barlow Condensed,sans-serif;color:var(--muted);font-size:12px'; }
    return `<td style="padding:8px 10px;${extra}">${cell}</td>`;
  }).join('') + '</tr>').join('');
  return `<div style="overflow-x:auto;border:1px solid rgba(238,240,240,0.06)"><table style="width:100%;border-collapse:collapse">
    <thead style="background:rgba(0,0,0,0.3)"><tr>${headerHtml}</tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="'+cols.length+'" style="padding:30px;text-align:center;color:var(--muted)">Sin datos</td></tr>'}</tbody>
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

  try { document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); const pg=document.getElementById('page-buscar'); if(pg) pg.classList.add('active'); const nav=document.getElementById('nav-buscar'); if(nav) nav.classList.add('active'); const exist=document.getElementById('s-exist'); if(exist&&!exist.value) exist.value='3'; } catch(e) {}
  try { history.replaceState({page:'buscar'},'',''); } catch(e) {}
  try { toggleFleteFields(); } catch(e) {}
  try { poblarSelectEstados(); } catch(e) {}
  try { renderCarrito(); } catch(e) {}
  try { iniciarCarruselMarcas(); } catch(e) {}
  try { renderLog(); } catch(e) {}
  // Pre-cargar sucursales en background para que ya estén listas al entrar a Orden
  try { cargarSucursalesSelect(); } catch(e) {}
  // Cargar saldo CVA en background
  try { cargarSaldo(); } catch(e) {}

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
  cargarVentasOdoo, buscarEnOdoo, ejecutarDebug,
  exportBuscarCSV, exportBuscarPDF, exportProductoCSV, exportProductoPDF,
  exportarTodoCSV, exportarTodoPDF, exportCarritoCSV, exportCarritoPDF,
  limpiarLog, cargarSucursalesSelect, iniciarPaginaOrden, sugerirSucursalPorStock, recargarSucursales, cargarAnalisis,
  iniciarCarruselMarcas, _renderCarruselMarcas,
  cargarAnalisis, renderAnalisisDashboard, renderAnalisisTab, anFiltrar, anTab, anSort, anLimpiarFiltros, anExportCSV, anExportPDF,
});