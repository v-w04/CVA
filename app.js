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
  if (id === 'sync')  setTimeout(() => { try { cargarEstadoSync();   } catch(e) {} }, 100);
  if (id === 'orden') setTimeout(() => { try { iniciarPaginaOrden(); } catch(e) {} }, 100);
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
  const sorted = [..._buscarArts].sort((a, b) => {
    let va = a[col], vb = b[col];
    if (col === 'precio') { va = parseFloat(va)||0; vb = parseFloat(vb)||0; }
    else if (col === 'disponible' || col === 'disponibleCD') { va = parseInt(va)||0; vb = parseInt(vb)||0; }
    else { va = String(va||'').toLowerCase(); vb = String(vb||'').toLowerCase(); }
    return va < vb ? -_sortDir : va > vb ? _sortDir : 0;
  });
  renderTablaBusqueda(sorted);
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
    page : _buscarPage,
  };
  const action = params.clave ? 'cva_producto' : 'cva_buscar';
  const data = await api(action, params);
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
  const data = await api('cva_producto', { clave });
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
  document.getElementById('cart-clave').value = clave;
  document.getElementById('cart-qty').value = qty;
  agregarAlCarrito().then(() => showPage('orden'));
}

async function agregarAlCarrito() {
  const clave = document.getElementById('cart-clave').value.trim();
  const qty   = parseInt(document.getElementById('cart-qty').value) || 1;
  if (!clave) return;
  const data = await api('cva_precio_stock', { clave });
  const art  = data.articulos ? data.articulos[0] : data;
  if (!art || !art.clave) { alert('Producto no encontrado: ' + clave); return; }
  const exist = carrito.findIndex(i => i.clave === clave);
  if (exist >= 0) { carrito[exist].qty += qty; }
  else {
    let imagen = null;
    try {
      const pd = await api('cva_producto', { clave: art.clave });
      imagen = pd.producto?.imagen || null;
    } catch(_) {}
    carrito.push({
      clave: art.clave,
      desc: art.descripcion || art.codigo || clave,
      precio: parseFloat(art.precio) || 0,
      moneda: art.moneda,
      marca: art.marca || '',
      qty,
      imagen,
      stock_cedis: (art.inventario || []).find(x => x.nombre==='TOTAL')?.disponible || 0,
    });
  }
  document.getElementById('cart-clave').value = '';
  addLog('ok', 'Agregado al carrito: ' + clave, 'Qty: ' + qty);
  guardarCarrito();
  renderCarrito();
}

function renderCarrito() {
  const el  = document.getElementById('carrito-items');
  const tot = document.getElementById('carrito-totales');
  const qty = carrito.reduce((s,i) => s + i.qty, 0);
  const hb = document.getElementById('cart-badge');
  const sb = document.getElementById('cart-sb-badge');
  if (qty > 0) { hb.style.display='inline'; hb.textContent='Cart '+qty; sb.style.display='inline'; sb.textContent=qty; }
  else { hb.style.display='none'; sb.style.display='none'; }
  if (carrito.length === 0) {
    el.innerHTML = '<div class="alert alert-info">El carrito está vacío</div>';
    tot.style.display = 'none';
    return;
  }
  const totalMXN = carrito.reduce((s,i) => s + i.precio * i.qty, 0);
  el.innerHTML = carrito.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-thumb">
        ${item.imagen?`<img src="${item.imagen}" alt="${item.clave}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <div class="cart-item-thumb-ph" style="${item.imagen?'display:none':''}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.2"><rect x="3" y="3" width="18" height="18"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </div>
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.desc}</div>
        <div class="cart-item-meta">
          <span class="cart-item-clave">${item.clave}</span>
          ${item.marca?`<span class="cart-item-marca">${item.marca}</span>`:''}
        </div>
        <div class="cart-item-price-unit">${fmt(item.precio,item.moneda)} por unidad</div>
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
        <div class="cart-item-total-price">${fmt(item.precio*item.qty,item.moneda)}</div>
        <button class="cart-item-remove" onclick="quitarItem(${idx})">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Eliminar
        </button>
      </div>
    </div>`).join('');
  tot.style.display = 'block';
  document.getElementById('carrito-total').textContent = fmt(totalMXN, 'Pesos');
}

function cambiarQty(idx,delta){ carrito[idx].qty=Math.max(1,carrito[idx].qty+delta); guardarCarrito(); renderCarrito(); }
function setQty(idx,val){ const q=parseInt(val); if(q>0){ carrito[idx].qty=q; guardarCarrito(); renderCarrito(); } }
function quitarItem(idx){ carrito.splice(idx,1); guardarCarrito(); renderCarrito(); }

async function enviarOrden(test = false) {
  if (carrito.length === 0) { alert('El carrito está vacío'); return; }
  const el = document.getElementById('orden-result');
  loading(el);
  const tipo_flete = document.getElementById('tipo-flete').value;
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
  const data = await apiPost('cva_crear_orden', body);
  if (!data.ok) { alert_(el, '✖ ' + data.error, 'error'); return; }
  el.innerHTML = `<div class="alert alert-success">
    ${test?'Test — ':''}Pedido creado: <strong>${data.pedido}</strong><br>
    Total: ${fmt(data.total,data.moneda)}
    ${data.flete?` · Flete: ${fmt(data.flete.montoTotal,'Pesos')} MXN`:''}
  </div>`;
  if (!test) { carrito=[]; guardarCarrito(); renderCarrito(); }
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
    const data = await api('cva_sucursales');
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
 * Al entrar a la página de Orden: carga sucursales y luego sugiere
 * automáticamente la que tiene mayor stock para los productos del carrito.
 * 
 * LÓGICA DE SUGERENCIA:
 * - Consulta cva_producto (con sucursales=true) para cada clave del carrito
 * - La respuesta trae disponibilidad_sucursales: [{ nombre, disponible }]
 *   donde "nombre" puede ser "VENTAS GUADALAJARA", "CEDIS GUADALAJARA", etc.
 * - Se suman los stocks de todas las claves por cada nombre de almacén
 *   (sucursales Y CEDIS por igual — ambos son válidos para levantar pedido)
 * - Se selecciona el almacén con mayor stock total
 * - Se busca ese nombre en el catálogo de sucursales para obtener la clave numérica
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

  hint.textContent = '⟳ Analizando disponibilidad por almacén…';

  // Acumular: { "VENTAS GUADALAJARA": 12, "CEDIS GUADALAJARA": 45, ... }
  const stockPorAlmacen = {};

  try {
    // Claves únicas del carrito, en lotes de 4 para no saturar GAS
    const claves = [...new Set(carrito.map(i => i.clave))];
    for (let i = 0; i < claves.length; i += 4) {
      const chunk = claves.slice(i, i + 4);
      await Promise.all(chunk.map(async (clave) => {
        try {
          const data = await api('cva_producto', { clave, sucursales: 'true' });
          const suc = data.producto?.disponibilidad_sucursales || [];
          suc.forEach(s => {
            // Ignorar la fila TOTAL — es suma, no un almacén real
            if (!s.nombre || s.nombre === 'TOTAL') return;
            const qty = parseInt(s.disponible) || 0;
            stockPorAlmacen[s.nombre] = (stockPorAlmacen[s.nombre] || 0) + qty;
          });
        } catch(_) { /* producto falla individualmente — continuar */ }
      }));
    }
  } catch(e) {
    hint.textContent = '';
    return;
  }

  // Filtrar solo almacenes con stock > 0
  const conStock = Object.entries(stockPorAlmacen).filter(([, qty]) => qty > 0);

  if (conStock.length === 0) {
    // No hay stock en ningún almacén para este carrito
    hint.innerHTML = '<span style="color:var(--orange)">⚠ Sin stock disponible en ningún almacén para los productos del carrito</span>';
    return;
  }

  // Ordenar por stock descendente y tomar el mejor
  conStock.sort((a, b) => b[1] - a[1]);
  const [nombreGanador, stockGanador] = conStock[0];

  // Log de los top almacenes para debug
  addLog('info', 'Stock por almacén (carrito)',
    conStock.slice(0, 3).map(([n, q]) => `${n.replace('VENTAS ','')}: ${q}`).join(' · ')
  );

  // Mapear nombre de la respuesta CVA → clave numérica del catálogo de sucursales
  // La API de sucursales devuelve: { clave: "1", nombre: "GUADALAJARA" }
  // La API de producto devuelve:   { nombre: "VENTAS GUADALAJARA", disponible: 5 }
  // También puede ser:             { nombre: "CEDIS GUADALAJARA", disponible: 45 }
  // Estrategia: normalizar ambos y buscar coincidencia parcial
  if (!_sucursalesCache) { hint.textContent = ''; return; }

  const normalizar = s => s.toUpperCase()
    .replace('VENTAS ', '')
    .replace('CENTRO DE DISTRIBUCION', 'CEDIS')
    .replace('CEDIS ', '')
    .trim();

  const nombreNorm = normalizar(nombreGanador);

  // Buscar la mejor coincidencia en el catálogo de sucursales
  let sucEncontrada = null;

  // Intento 1: coincidencia exacta normalizada
  sucEncontrada = _sucursalesCache.find(s => normalizar(s.nombre) === nombreNorm);

  // Intento 2: el nombre del catálogo está contenido en el nombre de la respuesta
  if (!sucEncontrada) {
    sucEncontrada = _sucursalesCache.find(s =>
      nombreGanador.includes(s.nombre) || s.nombre.includes(nombreNorm)
    );
  }

  // Intento 3: coincidencia por palabras clave (toma la primera palabra significativa)
  if (!sucEncontrada) {
    const palabraClave = nombreNorm.split(' ')[0];
    sucEncontrada = _sucursalesCache.find(s =>
      normalizar(s.nombre).startsWith(palabraClave)
    );
  }

  if (!sucEncontrada) {
    hint.textContent = '';
    return;
  }

  // Seleccionar en el dropdown
  const opts = sel.options;
  for (let i = 0; i < opts.length; i++) {
    if (String(opts[i].value) === String(sucEncontrada.clave)) {
      sel.selectedIndex = i;
      break;
    }
  }

  // Highlight temporal verde en el select
  sel.classList.add('sucursal-sugerida');
  setTimeout(() => sel.classList.remove('sucursal-sugerida'), 3500);

  // Indicar si es CEDIS o sucursal normal y el stock total
  const esCedis = nombreGanador.toUpperCase().includes('CEDIS') ||
                  nombreGanador.toUpperCase().includes('CENTRO DE DIST');
  const tipoLabel = esCedis
    ? '<span style="color:var(--orange);font-size:9px;letter-spacing:1px">CEDIS</span>'
    : '<span style="color:var(--green-lt);font-size:9px;letter-spacing:1px">SUCURSAL</span>';

  hint.innerHTML = `✓ Sugerido: <strong>${sucEncontrada.nombre}</strong> ${tipoLabel} — ${stockGanador} uds disponibles para tu carrito`;

  addLog('ok',
    `Almacén sugerido: ${sucEncontrada.nombre} (clave ${sucEncontrada.clave})`,
    `${stockGanador} uds · ${esCedis ? 'CEDIS' : 'Sucursal'}`
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
  document.getElementById('flete-fields').style.display =
    document.getElementById('tipo-flete').value === 'SF' ? 'none' : 'block';
}

// ── PEDIDOS ───────────────────────────────────────────────
let pedidosData = [];
let pdfBase64 = null, pdfNombre = null, editandoIdx = null;

async function cargarPedidos() {
  const el = document.getElementById('pedidos-result');
  loading(el);
  const data = await api('cva_pedidos');
  if (!data.ok) { alert_(el, '✖ ' + data.error, 'error'); return; }
  const cvaList = data.pedidos || [];
  const locales = await api('pedidos_locales');
  const locMap  = {};
  (locales.pedidos || []).forEach(p => { locMap[p.orden_cva] = p; });
  pedidosData = cvaList.map(p => ({ ...p, ...(locMap[p.Numero] || {}), _cva: p }));
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
      ${lista.map((p,i) => `<tr>
        <td class="mono" style="font-size:11px">${p.nuestra_orden||'—'}</td>
        <td class="mono">${p.Numero||p.orden_cva||'—'}</td>
        <td style="color:var(--muted);font-size:12px">${p.tienda||'—'}</td>
        <td style="color:var(--muted);font-size:12px">${p.carrier||'—'}</td>
        <td class="mono" style="font-size:11px">${p.no_guia||'—'}</td>
        <td style="text-align:center;font-size:16px">${p.guia_enviada?'✓':'○'}</td>
        <td style="font-size:11px;color:var(--muted)">${p.FechaAsignado||p.fecha||'—'}</td>
        <td><span class="status-${(p.Asignado||'pendiente').toLowerCase()}">${p.Asignado||'—'}</span></td>
        <td><button class="btn btn-ghost" style="padding:4px 12px;font-size:10px" onclick="abrirModalPedido(${i})">Editar</button></td>
      </tr>`).join('')}
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
  document.getElementById('m-obs').value             = p.observaciones || 'CVA CEDIS GDL';
  document.getElementById('m-guia-enviada').checked  = !!p.guia_enviada;
  document.getElementById('m-pdf-label').textContent = 'Browse — Or drop PDF here';
  document.getElementById('m-pdf-info').textContent  = p.pdf_nombre ? '✓ ' + p.pdf_nombre : '';
  document.getElementById('modal-result').innerHTML  = '';
  document.getElementById('modal-overlay').style.display = 'flex';
}
function cerrarModal() { document.getElementById('modal-overlay').style.display = 'none'; }
function handleFileSelect(e) { const file = e.target.files[0]; if (file) procesarPDF(file); }
function handleDrop(e) {
  e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
  const file = e.dataTransfer.files[0]; if (file) procesarPDF(file);
}
function procesarPDF(file) {
  pdfNombre = file.name;
  document.getElementById('m-pdf-label').textContent = file.name;
  document.getElementById('m-pdf-info').textContent  = (file.size/1024).toFixed(1) + ' KB — Cargado';
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
  document.getElementById('sync-total').textContent = '—';
}

async function ejecutarSync() {
  const el = document.getElementById('sync-result');
  loading(el);
  const data = await apiPost('sync_precios', {
    batch  : document.getElementById('sync-batch').value,
    paginas: parseInt(document.getElementById('sync-paginas').value) || 3,
    exist  : document.getElementById('sync-exist')?.value ?? '3',
  });
  if (!data.ok) { alert_(el, '✖ ' + data.error, 'error'); return; }
  document.getElementById('sync-art').textContent   = data.articulos_procesados;
  document.getElementById('sync-page').textContent  = data.next_page;
  document.getElementById('sync-total').textContent = data.total_paginas || '—';
  alert_(el, `✓ Sync · ${data.articulos_procesados} artículos · Siguiente: pág ${data.next_page} de ${data.total_paginas||'?'}`, 'success');
  addLog('ok', 'Sync ejecutado', `${data.articulos_procesados} artículos · pág ${data.next_page}`);
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
      ['No Pedido',p.Numero||p.numero],['Fecha',p.FechaAsignado||p.fecha],
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
    const [rM, rG] = await Promise.allSettled([api('cva_marcas'), api('cva_grupos')]);
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

  api('ping').then(d=>{ if(d.ok){const b=document.getElementById('badge-cva');if(b) b.textContent='CVA ✓';} }).catch(()=>{});
};

// ── EXPONER AL SCOPE GLOBAL ───────────────────────────────
Object.assign(window, {
  toggleSidebar, openSidebar, closeSidebar, showPage,
  buscarCVA, verProducto, volverATabla, limpiarBusqueda, buscarMeli, buscarMeliFila,
  filtrarPorMarca, filtrarPorGrupo, sortBuscar,
  agregarClave, agregarAlCarrito, pvQtyChange, setQty,
  cambiarQty, quitarItem, renderCarrito,
  enviarOrden, enviarOrdenTest, toggleFleteFields, onEstadoChange, poblarSelectEstados,
  cargarPedidos, filtrarPedidos, abrirModalPedido, cerrarModal,
  handleFileSelect, handleDrop, registrarPedido, enviarGuiaCVA,
  ejecutarSync, resetearSync, cargarEstadoSync, instalarTriggers, instalarTriggersUI,
  cargarVentasOdoo, buscarEnOdoo, ejecutarDebug,
  exportBuscarCSV, exportBuscarPDF, exportProductoCSV, exportProductoPDF,
  exportarTodoCSV, exportarTodoPDF, exportCarritoCSV, exportCarritoPDF,
  limpiarLog, cargarSucursalesSelect, iniciarPaginaOrden, sugerirSucursalPorStock,
  iniciarCarruselMarcas, _renderCarruselMarcas,
});
