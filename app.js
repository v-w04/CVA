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
  // scroll al tope
  const sw = document.querySelector('.scroll-wrap');
  if (sw) sw.scrollTop = 0;
  // Cargar estado cuando se entra a sync
  if (id === 'sync') setTimeout(() => { try { cargarEstadoSync(); } catch(e) {} }, 100);
}

window.addEventListener('popstate', e => {
  if (!e.state) return;
  const { page, sub } = e.state;
  if (!page) return;

  // Si venimos de un producto y hay tabla guardada, mostrarla
  if (page === 'buscar' && !sub && _lastTablaHTML) {
    const el = document.getElementById('buscar-result');
    if (el) {
      window._buscarPag = _lastTablaPag;
      el.innerHTML = _lastTablaHTML;
      _lastTablaHTML = null;
    }
    // Asegurar que la página buscar esté activa
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pg = document.getElementById('page-buscar');
    if (pg) pg.classList.add('active');
    return;
  }

  // Navegación normal entre páginas
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
// URL del Web App de Google Apps Script
const GAS_URL = 'https://script.google.com/macros/s/AKfycby9biqEbiv4syc3St3TuPKXkG9rI5A4YsmtNta3OEJ4mD0i8sg0PPg9OhfrPDZJuO_L/exec';

async function api(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  let res;
  try {
    res = await fetch(`${GAS_URL}?${qs}`, { method: 'GET', redirect: 'follow' });
  } catch(e) {
    // CORS/red/preview — dar mensaje útil
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
// Celda de stock estilo AM — dot + número
function stockCellAM(qty, label) {
  if (!qty || qty === 0) {
    return `<div class="stock-cell"><div class="stock-dot none"></div><span class="stock-none-txt">—</span></div>`;
  }
  const cls = qty < 5 ? 'low' : 'ok';
  return `<div class="stock-cell"><div class="stock-dot ${cls}"></div><span class="stock-num">${qty}</span></div>`;
}

// ── BUSCAR ────────────────────────────────────────────────
let _buscarPage = 1;
let _buscarArts  = [];   // cache de artículos actuales para sort/export
let _sortCol     = null; // columna activa
let _sortDir     = 1;    // 1 = asc, -1 = desc

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
  if (params.clave && data.producto) { el.innerHTML = renderProducto(data.producto); return; }
  const arts = data.articulos || [];
  if (arts.length === 0) { alert_(el, 'Sin resultados para la búsqueda', 'warn'); return; }
  _buscarArts = arts;
  const pag = data.paginacion || {};
  const totalPags = pag.total_paginas || 1;
  const pagActual = pag.pagina || _buscarPage;
  // Guardar paginación para el toolbar
  window._buscarPag = { totalPags, pagActual };
  renderTablaBusqueda(arts);
}

function renderTablaBusqueda(arts) {
  const el = document.getElementById('buscar-result');
  const { totalPags = 1, pagActual = 1 } = window._buscarPag || {};
  el.innerHTML = `
    <!-- Toolbar: info + paginación + exports -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="color:var(--muted);font-size:10px;letter-spacing:2px;text-transform:uppercase">
        ${arts.length} resultados${totalPags > 1 ? ` — Página ${pagActual} de ${totalPags}` : ''}
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        ${totalPags > 1 ? `
          <button class="btn btn-ghost" style="padding:4px 10px;font-size:10px"
            onclick="buscarCVA(${pagActual-1})" ${pagActual<=1?'disabled':''}>← Ant</button>
          <span style="font-size:11px;color:var(--muted);padding:0 2px">${pagActual}/${totalPags}</span>
          <button class="btn btn-ghost" style="padding:4px 10px;font-size:10px"
            onclick="buscarCVA(${pagActual+1})" ${pagActual>=totalPags?'disabled':''}>Sig →</button>` : ''}
        <button class="btn btn-ghost" style="padding:4px 12px;font-size:10px;display:flex;align-items:center;gap:5px"
          onclick="exportBuscarCSV()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          CSV
        </button>
        <button class="btn btn-ghost" style="padding:4px 12px;font-size:10px;display:flex;align-items:center;gap:5px"
          onclick="exportBuscarPDF()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          PDF
        </button>
      </div>
    </div>
    <!-- Tabla con headers clickeables para ordenar -->
    <div class="table-wrap">
      <table id="buscar-table">
        <thead><tr>
          <th onclick="sortBuscar('clave')"       style="cursor:pointer;user-select:none;white-space:nowrap">Clave${sortIcon('clave')}</th>
          <th onclick="sortBuscar('descripcion')" style="cursor:pointer;user-select:none">Descripción${sortIcon('descripcion')}</th>
          <th onclick="sortBuscar('marca')"       style="cursor:pointer;user-select:none">Marca${sortIcon('marca')}</th>
          <th onclick="sortBuscar('precio')"      style="cursor:pointer;user-select:none;white-space:nowrap">Precio${sortIcon('precio')}</th>
          <th onclick="sortBuscar('disponible')"  style="cursor:pointer;user-select:none;white-space:nowrap">Suc.${sortIcon('disponible')}</th>
          <th onclick="sortBuscar('disponibleCD')"style="cursor:pointer;user-select:none;white-space:nowrap">CEDIS${sortIcon('disponibleCD')}</th>
          <th></th>
        </tr></thead>
        <tbody>${arts.map(a => `
          <tr>
            <td class="mono">${a.clave}</td>
            <td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.descripcion}</td>
            <td style="color:var(--muted);font-size:12px">${a.marca || '—'}</td>
            <td class="td-price">${fmt(a.precio, a.moneda)}</td>
            <td>${stockCellAM(a.disponible,'')}</td>
            <td>${stockCellAM(a.disponibleCD,'')}</td>
            <td style="display:flex;gap:5px">
              <button class="btn btn-ghost" style="padding:4px 9px;font-size:10px" onclick="verProducto('${a.clave}')">Ver</button>
              <button class="btn btn-primary" style="padding:4px 9px;font-size:10px" onclick="agregarClave('${a.clave}',1)">+ Orden</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// Guardar últimos resultados de tabla para poder volver
let _lastTablaHTML = null;
let _lastTablaPag  = { totalPags: 1, pagActual: 1 };

async function verProducto(clave) {
  const el = document.getElementById('buscar-result');
  // Guardar la tabla actual antes de mostrar el producto
  if (el.querySelector('table')) {
    _lastTablaHTML = el.innerHTML;
    _lastTablaPag  = window._buscarPag || { totalPags: 1, pagActual: 1 };
  }
  // Pushear estado para que el botón atrás vuelva al producto/tabla
  try { history.pushState({ page: 'buscar', sub: 'producto', clave }, '', ''); } catch(e) {}
  loading(el);
  const data = await api('cva_producto', { clave });
  if (!data.ok) { alert_(el, '✖ ' + data.error, 'error'); return; }
  el.innerHTML = renderProducto(data.producto);
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
  const promo       = p.promociones;
  const sucursales  = p.disponibilidad_sucursales || [];
  const dim         = p.dimensiones;

  // Stock helpers
  const sdot = (qty) => {
    const cls = !qty ? 'none' : qty < 5 ? 'low' : 'ok';
    return `<div class="pv-stock-dot ${cls}"></div>`;
  };
  const sval = (qty) => qty ? `${qty} uds` : '—';

  // Arrow SVG
  const arrow = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;

  // Items del panel derecho — estilo "Paint / Satin Xenon Grey"
  const items = [
    { label: 'Precio',    value: `${fmt(p.precio, p.moneda)}${p.tipo_cambio ? ` · TC $${p.tipo_cambio}` : ''}`, right: '' },
    { label: 'Stock Sucursal',  value: sval(p.disponible),   right: sdot(p.disponible)  },
    { label: 'Stock CEDIS',     value: sval(p.disponibleCD), right: sdot(p.disponibleCD) },
    p.en_transito ? { label: 'En Tránsito', value: `${p.en_transito} uds`, right: '' } : null,
    p.garantia    ? { label: 'Garantía',    value: p.garantia, right: '' } : null,
    dim ? { label: 'Dimensiones', value: `${dim.alto}m × ${dim.ancho}m × ${dim.profundidad}m · ${dim.peso} ${dim.unidad_peso}`, right: '' } : null,
    p.tipo_producto?.tipo ? { label: 'Tipo', value: p.tipo_producto.tipo, right: '' } : null,
  ].filter(Boolean);

  return `
    <div class="pv-wrap">

      <!-- Columna izquierda: imagen hero -->
      <div>
        <div class="pv-hero">
          ${p.imagen
            ? `<img src="${p.imagen}" alt="${p.clave}" onerror="this.parentElement.innerHTML='<div class=pv-hero-placeholder><svg width=64 height=64 viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'1\'><rect x=\'3\' y=\'3\' width=\'18\' height=\'18\'/><circle cx=\'8.5\' cy=\'8.5\' r=\'1.5\'/><polyline points=\'21 15 16 10 5 21\'/></svg></div>'">`
            : `<div class="pv-hero-placeholder">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                  <rect x="3" y="3" width="18" height="18"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
               </div>`
          }
          <div class="pv-hero-badge">${p.clave}</div>
        </div>

        ${promo ? `<div class="pv-promo" style="margin:12px 0 0">
          <strong>Promoción activa:</strong> ${promo.descripcion_promocion}<br>
          ${fmt(promo.precio_descuento, promo.moneda_precio_descuento)} · Vence: ${promo.promocion_vencimiento}
        </div>` : ''}

        ${sucursales.length > 0 ? `
        <div class="pv-sucursales">
          <div class="pv-suc-title">Disponibilidad por Sucursal</div>
          <div class="pv-suc-grid">
            ${sucursales.map(s => `
              <div class="pv-suc-item">
                <div class="pv-suc-nombre">${s.nombre}</div>
                <div class="pv-suc-qty ${s.disponible === 0 ? 'zero' : ''}">${s.disponible}</div>
              </div>`).join('')}
          </div>
        </div>` : ''}
      </div>

      <!-- Columna derecha: panel AM -->
      <div class="pv-panel">

        <!-- Cabecera -->
        <div class="pv-panel-head">
          <div class="pv-panel-marca">${p.marca || 'CVA'}</div>
          <div class="pv-panel-nombre">${p.descripcion}</div>
          <div class="pv-panel-grupo">${p.grupo || ''}</div>
        </div>

        <!-- Precio principal -->
        <div class="pv-price-block">
          <div class="pv-price">${fmt(p.precio, p.moneda)}</div>
          <div class="pv-price-moneda">${p.moneda === 'Dolares' ? 'USD' : 'MXN'}</div>
          ${promo ? `<div class="pv-price-promo">Promo disponible ↓</div>` : ''}
        </div>

        <!-- Items detalle -->
        <div class="pv-items">
          ${items.map(it => `
            <div class="pv-item">
              <div class="pv-item-left">
                <div class="pv-item-label">${it.label}</div>
                <div class="pv-item-value">${it.value}</div>
              </div>
              <div class="pv-item-right">
                ${it.right}
                <span class="pv-item-arrow">${arrow}</span>
              </div>
            </div>`).join('')}
        </div>

        <!-- CTA con cantidad — igual al "View your DBX S" -->
        <div style="display:flex;border-top:1px solid rgba(238,240,240,0.08)">
          <!-- Input qty -->
          <div style="display:flex;align-items:center;background:rgba(0,0,0,0.2);border-right:1px solid rgba(238,240,240,0.1);padding:0 4px;gap:0">
            <button onclick="pvQtyChange(-1)"
              style="width:36px;height:56px;background:none;border:none;color:rgba(238,240,240,0.5);font-size:20px;cursor:pointer;line-height:1;transition:color .15s"
              onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(238,240,240,0.5)'">−</button>
            <input id="pv-qty" type="number" value="1" min="1" max="999"
              style="width:44px;height:56px;background:none;border:none;color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:300;text-align:center;outline:none;-moz-appearance:textfield">
            <button onclick="pvQtyChange(1)"
              style="width:36px;height:56px;background:none;border:none;color:rgba(238,240,240,0.5);font-size:20px;cursor:pointer;line-height:1;transition:color .15s"
              onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(238,240,240,0.5)'">+</button>
          </div>
          <!-- Botón principal -->
          <button class="pv-cta" style="flex:1;border-top:none"
            onclick="agregarClave('${p.clave}', parseInt(document.getElementById('pv-qty').value)||1)">
            Agregar a Orden
          </button>
        </div>

      </div><!-- /pv-panel -->
    </div><!-- /pv-wrap -->
  `;
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
  try { localStorage.setItem('cva_carrito', JSON.stringify(carrito)); }
  catch(_) {}
}

function pvQtyChange(delta) {
  const el = document.getElementById('pv-qty');
  if (!el) return;
  el.value = Math.max(1, Math.min(999, (parseInt(el.value) || 1) + delta));
}
function agregarClave(clave, qty = 1) {
  showPage('orden');
  document.getElementById('cart-clave').value = clave;
  document.getElementById('cart-qty').value = qty;
  agregarAlCarrito();
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
    // Traer imagen del producto para mostrar en carrito
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
  // badges
  const hb = document.getElementById('cart-badge');
  const sb = document.getElementById('cart-sb-badge');
  if (qty > 0) {
    hb.style.display = 'inline'; hb.textContent = 'Cart ' + qty;
    sb.style.display = 'inline'; sb.textContent = qty;
  } else {
    hb.style.display = 'none';
    sb.style.display = 'none';
  }
  if (carrito.length === 0) {
    el.innerHTML = '<div class="alert alert-info">El carrito está vacío</div>';
    tot.style.display = 'none';
    return;
  }
  const totalMXN = carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  el.innerHTML = carrito.map((item, idx) => `
    <div class="cart-item">
      <!-- Imagen -->
      <div class="cart-item-thumb">
        ${item.imagen
          ? `<img src="${item.imagen}" alt="${item.clave}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <div class="cart-item-thumb-ph" style="${item.imagen ? 'display:none' : ''}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.2">
            <rect x="3" y="3" width="18" height="18"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
      </div>
      <!-- Nombre + clave + precio unitario -->
      <div class="cart-item-info">
        <div class="cart-item-name">${item.desc}</div>
        <div class="cart-item-meta">
          <span class="cart-item-clave">${item.clave}</span>
          ${item.marca ? `<span class="cart-item-marca">${item.marca}</span>` : ''}
        </div>
        <div class="cart-item-price-unit">${fmt(item.precio, item.moneda)} por unidad</div>
      </div>
      <!-- Controles cantidad -->
      <div class="cart-item-qty">
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="cambiarQty(${idx},-1)">−</button>
          <input class="qty-num" type="number" value="${item.qty}" min="1" max="999"
            onchange="setQty(${idx}, this.value)"
            onblur="setQty(${idx}, this.value)">
          <button class="qty-btn" onclick="cambiarQty(${idx},1)">+</button>
        </div>
      </div>
      <!-- Precio total + Eliminar -->
      <div class="cart-item-total">
        <div class="cart-item-total-price">${fmt(item.precio * item.qty, item.moneda)}</div>
        <button class="cart-item-remove" onclick="quitarItem(${idx})">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          Eliminar
        </button>
      </div>
    </div>`).join('');
  tot.style.display = 'block';
  document.getElementById('carrito-total').textContent = fmt(totalMXN, 'Pesos');
}

function cambiarQty(idx, delta) { carrito[idx].qty = Math.max(1, carrito[idx].qty + delta); guardarCarrito(); renderCarrito(); }
function setQty(idx, val) { const q = parseInt(val); if (q > 0) { carrito[idx].qty = q; guardarCarrito(); renderCarrito(); } }
function quitarItem(idx) { carrito.splice(idx, 1); guardarCarrito(); renderCarrito(); }

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
    paqueteria_id: 4,
  };
  const body = {
    action: 'cva_crear_orden',
    productos: carrito.map(i => ({ clave: i.clave, cantidad: i.qty, precio: i.precio, descripcion: i.desc })),
    num_oc: document.getElementById('num-oc').value,
    observaciones: document.getElementById('observaciones').value,
    tipo_flete, direccion, test: test ? 1 : 0,
  };
  const data = await apiPost('cva_crear_orden', body);
  if (!data.ok) { alert_(el, '✖ ' + data.error, 'error'); return; }
  el.innerHTML = `<div class="alert alert-success">
    ${test ? 'Test — ' : ''}Pedido creado: <strong>${data.pedido}</strong><br>
    Total: ${fmt(data.total, data.moneda)}
    ${data.flete ? ` · Flete: ${fmt(data.flete.montoTotal, 'Pesos')} MXN` : ''}
  </div>`;
  if (!test) { carrito = []; guardarCarrito(); renderCarrito(); }
}
function enviarOrdenTest() { enviarOrden(true); }

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
      <tr>
        <th>Nuestra Orden</th><th>No Orden CVA</th><th>Tienda</th>
        <th>Carrier</th><th>No Guía</th><th>Guía Enviada</th><th>Fecha</th><th>Estatus</th><th></th>
      </tr>
      ${lista.map((p, i) => `
        <tr>
          <td class="mono" style="font-size:11px">${p.nuestra_orden || '—'}</td>
          <td class="mono">${p.Numero || p.orden_cva || '—'}</td>
          <td style="color:var(--muted);font-size:12px">${p.tienda || '—'}</td>
          <td style="color:var(--muted);font-size:12px">${p.carrier || '—'}</td>
          <td class="mono" style="font-size:11px">${p.no_guia || '—'}</td>
          <td style="text-align:center;font-size:16px">${p.guia_enviada ? '✓' : '○'}</td>
          <td style="font-size:11px;color:var(--muted)">${p.FechaAsignado || p.fecha || '—'}</td>
          <td><span class="status-${(p.Asignado||'pendiente').toLowerCase()}">${p.Asignado || '—'}</span></td>
          <td><button class="btn btn-ghost" style="padding:4px 12px;font-size:10px" onclick="abrirModalPedido(${i})">Editar</button></td>
        </tr>`).join('')}
    </table></div>`;
}

function filtrarPedidos() { renderTablaPedidos(); }

function abrirModalPedido(idx) {
  editandoIdx = idx; pdfBase64 = null; pdfNombre = null;
  const p = idx !== null ? pedidosData[idx] : {};
  document.getElementById('m-nuestra-orden').value  = p.nuestra_orden || '';
  document.getElementById('m-orden-cva').value      = p.Numero || p.orden_cva || '';
  document.getElementById('m-tienda').value         = p.tienda   || 'ML SV';
  document.getElementById('m-carrier').value        = p.carrier  || 'DHL';
  document.getElementById('m-guia').value           = p.no_guia  || '';
  document.getElementById('m-obs').value            = p.observaciones || 'CVA CEDIS GDL';
  document.getElementById('m-guia-enviada').checked = !!p.guia_enviada;
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
// Cargar estado del sync al entrar a la sección
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
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${data.fecha_inicio_historial ? 'desde ' + data.fecha_inicio_historial : 'sin datos aún'}</div>
      </div>
    </div>
    ${data.ultimo_sync_log ? `<div style="font-size:11px;color:var(--muted);padding:8px 12px;background:rgba(238,240,240,0.03);border-left:2px solid rgba(238,240,240,0.1)">Último sync: ${data.ultimo_sync_log}</div>` : ''}
  `;
  // Actualizar KPIs de la página
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
  alert_(el, `✓ Sync · ${data.articulos_procesados} artículos · Siguiente: pág ${data.next_page} de ${data.total_paginas || '?'}`, 'success');
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
    ${ventas.map(v => `<tr>
      <td class="mono">${v.name}</td>
      <td>${Array.isArray(v.partner_id) ? v.partner_id[1] : v.partner_id}</td>
      <td>${fmt(v.amount_total, 'Pesos')}</td>
      <td><span style="letter-spacing:1px;font-size:10px;text-transform:uppercase;color:var(--muted)">${v.state}</span></td>
      <td style="font-size:11px;color:var(--muted)">${v.date_order ? v.date_order.substring(0,10) : '—'}</td>
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
  el.innerHTML = `<div class="card" style="max-width:480px">
    <table>
      <tr><td style="color:var(--muted);width:160px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 0">ID Odoo</td><td>${p.id}</td></tr>
      <tr><td style="color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 0">Nombre</td><td>${p.name}</td></tr>
      <tr><td style="color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 0">Referencia</td><td class="mono">${p.default_code}</td></tr>
      <tr><td style="color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 0">Precio Lista</td><td>${fmt(p.list_price,'Pesos')}</td></tr>
      <tr><td style="color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 0">Stock</td><td>${p.qty_available}</td></tr>
      <tr><td style="color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 0">Stock Virtual</td><td>${p.virtual_available}</td></tr>
    </table>
  </div>`;
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
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">Error: ${e.message}</div>`;
  }
}

function renderDebugResult(action, data) {
  if (!data.ok) return `<div class="alert alert-error" style="margin:0">❌ ${data.error || JSON.stringify(data)}</div>`;

  // Helper: tabla genérica de campos clave-valor
  function infoTable(rows) {
    return `<div class="table-wrap"><table><tbody>
      ${rows.filter(Boolean).map(([k,v]) => `<tr>
        <td style="color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;width:160px;white-space:nowrap">${k}</td>
        <td style="font-size:13px">${v ?? '—'}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
  }

  // ── MARCAS: grid de logos ─────────────────────────────────────
  if (action === 'cva_marcas' && data.marcas) {
    const items = data.marcas;
    return `
      <div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${items.length} marcas</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
        ${items.map(m => `
          <div onclick="filtrarPorMarca('${m.marca}')" style="background:rgba(38,41,48,0.8);border:1px solid rgba(238,240,240,0.1);padding:18px 14px;display:flex;flex-direction:column;align-items:center;gap:12px;min-height:90px;justify-content:center;cursor:pointer;transition:border-color .18s,background .18s" onmouseover="this.style.borderColor='var(--green-lt)'" onmouseout="this.style.borderColor='rgba(238,240,240,0.1)'">
            ${m.logo ? `<img src="${m.logo}" style="height:44px;width:auto;max-width:120px;object-fit:contain;filter:brightness(0) invert(1);opacity:0.8" onerror="this.style.display='none'">` : ''}
            <span style="font-size:12px;letter-spacing:1.5px;color:rgba(238,240,240,0.7);text-align:center;text-transform:uppercase;font-weight:500">${m.marca}</span>
            <span style="font-size:9px;letter-spacing:1px;color:var(--green-lt);text-transform:uppercase;opacity:0.7">Buscar →</span>
          </div>`).join('')}
      </div>`;
  }

  // ── GRUPOS: lista ─────────────────────────────────────────────
  if (action === 'cva_grupos' && data.grupos) {
    const items = data.grupos;
    return `
      <div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${items.length} grupos</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px">
        ${items.map(g => `
          <div onclick="filtrarPorGrupo('${g.nombre||g.grupo||g}')" style="padding:10px 14px;background:rgba(238,240,240,0.03);border:1px solid rgba(238,240,240,0.07);font-size:13px;color:var(--text-2);cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background .15s" onmouseover="this.style.background='rgba(0,102,94,0.1)'" onmouseout="this.style.background='rgba(238,240,240,0.03)'"><span>${g.nombre || g.grupo || g}</span><span style="font-size:9px;color:var(--green-lt);letter-spacing:1px">BUSCAR →</span></div>`).join('')}
      </div>`;
  }

  // ── SUCURSALES: cards ─────────────────────────────────────────
  if (action === 'cva_sucursales' && data.sucursales) {
    return `
      <div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${data.sucursales.length} sucursales</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
        ${data.sucursales.map(s => `
          <div style="padding:14px 16px;background:rgba(38,41,48,0.8);border:1px solid rgba(238,240,240,0.08)">
            <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:3px">${s.nombre}</div>
            <div style="font-size:10px;color:var(--muted);letter-spacing:1px">${[s.estado,s.ciudad].filter(Boolean).join(' · ') || ''}</div>
          </div>`).join('')}
      </div>`;
  }

  // ── PRODUCTO INDIVIDUAL (cva_producto) ────────────────────────
  if (action === 'cva_producto' && data.producto) {
    return renderProducto(data.producto);
  }

  // ── PRECIO Y STOCK (cva_precio_stock) — lista o individual ───
  if (action === 'cva_precio_stock') {
    if (data.articulos && data.articulos.length > 0) {
      const arts = data.articulos;
      return `
        <div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${arts.length} artículos</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Clave</th><th>Descripción</th><th>Precio</th><th>Suc</th><th>CEDIS</th></tr></thead>
          <tbody>${arts.map(a => `<tr>
            <td class="mono">${a.clave}</td>
            <td style="font-size:12px;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.descripcion||a.codigo||''}</td>
            <td class="td-price">${fmt(a.precio,a.moneda)}</td>
            <td>${stockCellAM(a.disponible,'')}</td>
            <td>${stockCellAM(a.disponibleCD,'')}</td>
          </tr>`).join('')}</tbody>
        </table></div>`;
    }
    if (data.clave) {
      return infoTable([
        ['Clave', `<span class="mono">${data.clave}</span>`],
        ['Descripción', data.descripcion || data.codigo],
        ['Precio', fmt(data.precio, data.moneda)],
        ['Stock Sucursal', data.disponible ?? '—'],
        ['Stock CEDIS', data.disponibleCD ?? '—'],
        ['Tipo de Cambio', data.tipo_cambio ? `$${data.tipo_cambio}` : null],
      ]);
    }
  }

  // ── IMÁGENES HD (cva_imagenes) ────────────────────────────────
  if (action === 'cva_imagenes') {
    const imgs = data.imagenes || data.fotos || [];
    if (!imgs.length) return `<div class="alert alert-warn">Sin imágenes para esta clave</div>`;
    return `
      <div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${imgs.length} imágenes</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        ${imgs.map(img => {
          const url = typeof img === 'string' ? img : (img.url || img.imagen || '');
          return url ? `<div style="background:rgba(38,41,48,0.8);border:1px solid rgba(238,240,240,0.08);padding:8px">
            <img src="${url}" style="height:120px;width:auto;max-width:180px;object-fit:contain;display:block">
          </div>` : '';
        }).join('')}
      </div>`;
  }

  // ── INFO TÉCNICA (cva_info_tecnica) ───────────────────────────
  if (action === 'cva_info_tecnica') {
    const specs = data.especificaciones || data.specs || data.informacion || [];
    if (Array.isArray(specs) && specs.length) {
      return `
        <div class="table-wrap"><table>
          <thead><tr><th>Característica</th><th>Valor</th></tr></thead>
          <tbody>${specs.map(s => `<tr>
            <td style="color:var(--muted);font-size:12px">${s.nombre||s.caracteristica||s.key||Object.keys(s)[0]}</td>
            <td style="font-size:13px">${s.valor||s.value||Object.values(s)[0]}</td>
          </tr>`).join('')}</tbody>
        </table></div>`;
    }
    // Si vino como objeto plano de pares
    const keys = Object.keys(data).filter(k => k !== 'ok');
    if (keys.length) return infoTable(keys.map(k => [k, data[k]]));
    return `<div class="alert alert-warn">Sin especificaciones técnicas para esta clave</div>`;
  }

  // ── CONSULTAR PEDIDO CVA (cva_consultar_pedido) ───────────────
  if (action === 'cva_consultar_pedido') {
    const p = data.pedido || data;
    const productos = p.productos || data.productos || [];
    return `
      <div style="margin-bottom:16px">
        ${infoTable([
          ['No Pedido',  p.Numero || p.numero],
          ['Fecha',      p.FechaAsignado || p.fecha],
          ['Estatus',    `<span style="color:var(--green-lt);font-size:11px;letter-spacing:1.5px;text-transform:uppercase">${p.Asignado||p.estatus||'—'}</span>`],
          ['Total',      p.Total ? fmt(p.Total,'Pesos') : null],
          ['Tipo Flete', p.tipo_flete || p.TipoFlete],
        ])}
      </div>
      ${productos.length ? `
        <div style="margin-bottom:8px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${productos.length} productos</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Clave</th><th>Descripción</th><th>Cantidad</th><th>Precio</th></tr></thead>
          <tbody>${productos.map(pr => `<tr>
            <td class="mono">${pr.clave||pr.Clave||'—'}</td>
            <td style="font-size:12px">${pr.descripcion||pr.Descripcion||'—'}</td>
            <td style="text-align:center">${pr.cantidad||pr.Cantidad||'—'}</td>
            <td class="td-price">${pr.precio||pr.Precio ? fmt(pr.precio||pr.Precio,'Pesos') : '—'}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : ''}`;
  }

  // ── CONSULTAR GUÍA CVA (cva_consultar_guia) ───────────────────
  // Respuesta: { order_number, date, waybills, printed, delivered }
  if (action === 'cva_consultar_guia') {
    return infoTable([
      ['No Orden CVA', `<span class="mono">${data.order_number||'—'}</span>`],
      ['Fecha',        data.date],
      ['No Guía',      `<span class="mono">${data.waybills||'—'}</span>`],
      ['Impresa',      data.printed  ? '✓ Sí' : '✗ No'],
      ['Entregada',    data.delivered ? '✓ Sí' : '✗ No'],
    ]);
  }

  // ── PEDIDOS LISTA (cva_pedidos) ───────────────────────────────
  if (data.pedidos) {
    const lista = data.pedidos;
    if (!lista.length) return `<div class="alert alert-info">Sin pedidos registrados</div>`;
    return `
      <div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${lista.length} pedidos</div>
      <div class="table-wrap"><table>
        <thead><tr><th>No Pedido</th><th>Fecha</th><th>Total</th><th>Flete</th><th>Estatus</th></tr></thead>
        <tbody>${lista.map(p => `<tr>
          <td class="mono">${p.Numero||p.numero||'—'}</td>
          <td style="color:var(--muted);font-size:11px">${p.FechaAsignado||p.fecha||'—'}</td>
          <td class="td-price">${p.Total ? fmt(p.Total,'Pesos') : '—'}</td>
          <td style="font-size:11px;color:var(--muted)">${p.TipoFlete||p.tipo_flete||'—'}</td>
          <td><span style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:var(--green-lt)">${p.Asignado||'—'}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>`;
  }

  // ── BUSCAR PRODUCTOS (cva_buscar) ─────────────────────────────
  if (data.articulos && data.articulos.length > 0) {
    const arts = data.articulos;
    return `
      <div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${arts.length} artículos${data.paginacion ? ` — pág ${data.paginacion.pagina} de ${data.paginacion.total_paginas}` : ''}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Clave</th><th>Descripción</th><th>Marca</th><th>Precio</th><th>Suc</th><th>CEDIS</th></tr></thead>
        <tbody>${arts.map(a => `<tr>
          <td class="mono">${a.clave}</td>
          <td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px">${a.descripcion||''}</td>
          <td style="color:var(--muted);font-size:11px">${a.marca||'—'}</td>
          <td class="td-price">${fmt(a.precio,a.moneda)}</td>
          <td>${stockCellAM(a.disponible,'')}</td>
          <td>${stockCellAM(a.disponibleCD,'')}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
  }

  // ── ODOO: BUSCAR PRODUCTO ──────────────────────────────────────
  if (action === 'odoo_buscar_producto') {
    if (!data.encontrado) return `<div class="alert alert-warn">Producto no encontrado en Odoo</div>`;
    const p = data.producto;
    return infoTable([
      ['ID Odoo',         p.id],
      ['Nombre',          p.name],
      ['Referencia',      `<span class="mono">${p.default_code||'—'}</span>`],
      ['Precio lista',    fmt(p.list_price,'Pesos')],
      ['Costo estándar',  p.standard_price ? fmt(p.standard_price,'Pesos') : null],
      ['Stock disponible',p.qty_available],
      ['Stock virtual',   p.virtual_available],
      ['UoM',             Array.isArray(p.uom_id) ? p.uom_id[1] : p.uom_id],
    ]);
  }

  // ── ODOO: STOCK ────────────────────────────────────────────────
  if (action === 'odoo_stock') {
    if (!data.encontrado) return `<div class="alert alert-warn">Producto no encontrado en Odoo</div>`;
    return infoTable([
      ['Producto ID',    data.producto_id || data.id],
      ['Nombre',         data.name || data.display_name],
      ['Stock disponible', data.qty_available ?? data.qty],
      ['Stock virtual',  data.virtual_available],
    ]);
  }

  // ── ODOO: STOCK BODEGA CVA ─────────────────────────────────────
  if (action === 'odoo_stock_cva') {
    if (!data.encontrado) return `<div class="alert alert-warn">Producto no encontrado en bodega CVA (location 194)</div>`;
    return infoTable([
      ['Producto ID', data.producto_id],
      ['Stock en CVA', `<strong style="color:var(--green-lt);font-size:18px;font-family:\'Barlow Condensed\',sans-serif">${data.qty}</strong>`],
    ]);
  }

  // ── PING ───────────────────────────────────────────────────────
  if (action === 'ping') {
    return `<div class="alert alert-success">✓ Conexión activa · ${data.version || 'GAS Online'}</div>`;
  }

  // ── VENTAS ODOO ────────────────────────────────────────────────
  if (data.ventas) {
    const vs = data.ventas;
    if (!vs.length) return `<div class="alert alert-info">Sin ventas encontradas</div>`;
    return `
      <div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${vs.length} ventas</div>
      <div class="table-wrap"><table>
        <thead><tr><th>SO</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
        <tbody>${vs.map(v => `<tr>
          <td class="mono">${v.name}</td>
          <td style="font-size:12px">${Array.isArray(v.partner_id)?v.partner_id[1]:v.partner_id}</td>
          <td class="td-price">${fmt(v.amount_total,'Pesos')}</td>
          <td style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">${v.state}</td>
          <td style="font-size:11px;color:var(--muted)">${v.date_order?v.date_order.substring(0,10):'—'}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
  }

  // ── FALLBACK: datos desconocidos — mostrar tabla de campos ──────
  const keys = Object.keys(data).filter(k => k !== 'ok');
  if (!keys.length) return `<div class="alert alert-success">✓ Operación completada</div>`;
  return `
    <div style="margin-bottom:10px;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">Respuesta — ${keys.length} campos</div>
    ${infoTable(keys.map(k => {
      const v = data[k];
      const disp = typeof v === 'object' ? `<code style="font-size:10px;color:var(--green-lt)">${JSON.stringify(v).substring(0,120)}${JSON.stringify(v).length>120?'…':''}</code>` : String(v);
      return [k, disp];
    }))}`;
}



// ── LOG DE ACTIVIDAD ──────────────────────────────────────────
let _logEntries = [];

function addLog(tipo, msg, detalle) {
  const ts = new Date().toLocaleTimeString('es-MX');
  _logEntries.unshift({ ts, tipo, msg, detalle: detalle || '' });
  if (_logEntries.length > 100) _logEntries.pop();
  // Actualizar sublabel en sidebar
  const sub = document.getElementById('log-sb-sub');
  if (sub) sub.textContent = ts + ' — ' + msg;
  renderLog();
}

function renderLog() {
  const el = document.getElementById('log-entries');
  if (!el) return;
  if (!_logEntries.length) {
    el.innerHTML = '<div class="alert alert-info">Sin actividad registrada aún.</div>';
    return;
  }
  const colors = { ok: 'var(--green-lt)', error: '#e05555', warn: 'var(--orange)', info: 'rgba(238,240,240,0.4)' };
  el.innerHTML = _logEntries.map(e => `
    <div style="display:flex;gap:14px;padding:12px 16px;border-bottom:1px solid rgba(238,240,240,0.06);align-items:flex-start">
      <div style="font-size:10px;color:rgba(238,240,240,0.3);white-space:nowrap;padding-top:2px;font-family:monospace">${e.ts}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;color:${colors[e.tipo]||colors.info}">${e.msg}</div>
        ${e.detalle ? `<div style="font-size:11px;color:rgba(238,240,240,0.3);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.detalle}</div>` : ''}
      </div>
      <div style="width:6px;height:6px;border-radius:50%;background:${colors[e.tipo]||colors.info};flex-shrink:0;margin-top:5px"></div>
    </div>`).join('');
}

function limpiarLog() { _logEntries = []; renderLog(); }

// ── INSTALAR TRIGGERS DESDE UI ────────────────────────────────
async function instalarTriggersUI() {
  closeSidebar();
  addLog('info', 'Instalando triggers en GAS...', 'sync cada 60min + polling pedidos cada 15min');
  try {
    const data = await api('instalar_triggers');
    if (data.ok) {
      addLog('ok', 'Triggers instalados correctamente', 'Sync 60min · Polling 15min');
      showPage('log');
    } else {
      addLog('error', 'Error instalando triggers', data.error);
      alert('Los triggers se instalan ejecutando instalarTriggers() desde el editor de GAS.');
    }
  } catch(e) {
    addLog('warn', 'Instala manualmente: abre GAS → ejecuta instalarTriggers()', e.message);
    alert('Los triggers se instalan ejecutando instalarTriggers() desde el editor de GAS.');
  }
}


// ── EXPORTS ───────────────────────────────────────────────

function exportBuscarCSV() {
  if (!_buscarArts.length) return;
  const rows = [['Clave','Descripción','Marca','Precio','Moneda','Stock Suc.','Stock CEDIS']];
  _buscarArts.forEach(a => rows.push([
    a.clave, a.descripcion, a.marca||'', a.precio||'', a.moneda||'MXN',
    a.disponible||0, a.disponibleCD||0
  ]));
  downloadCSV(rows, 'CVA_Busqueda_' + new Date().toISOString().substring(0,10) + '.csv');
}

function exportBuscarPDF() {
  if (!_buscarArts.length) return;
  const rows = _buscarArts.map(a => [a.clave, a.descripcion, a.marca||'—', fmt(a.precio,a.moneda), a.disponible||0, a.disponibleCD||0]);
  printPDF('Búsqueda CVA', ['Clave','Descripción','Marca','Precio','Suc.','CEDIS'], rows);
}

function exportCarritoCSV() {
  if (!carrito.length) return;
  const rows = [['Clave','Descripción','Marca','Precio Unit.','Cantidad','Total']];
  carrito.forEach(i => rows.push([
    i.clave, i.desc, i.marca||'', i.precio, i.qty,
    (i.precio * i.qty).toFixed(2)
  ]));
  downloadCSV(rows, 'CVA_Carrito_' + new Date().toISOString().substring(0,10) + '.csv');
}

function exportCarritoPDF() {
  if (!carrito.length) return;
  const rows = carrito.map(i => [i.clave, i.desc, i.marca||'—', fmt(i.precio,i.moneda), i.qty, fmt(i.precio*i.qty,i.moneda)]);
  const total = carrito.reduce((s,i) => s + i.precio*i.qty, 0);
  printPDF('Carrito CVA — Electronics México',
    ['Clave','Descripción','Marca','Precio c/u','Qty','Total'],
    rows,
    'TOTAL: ' + fmt(total,'Pesos')
  );
}

function downloadCSV(rows, filename) {
  const NL = '\n';
  const csv = rows.map(r => r.map(c => {
    const s = String(c === null || c === undefined ? '' : c).replace(/"/g, '""');
    return (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) ? '"' + s + '"' : s;
  }).join(',')).join(NL);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function printPDF(title, headers, rows, footer) {
  const w = window.open('', '_blank', 'width=900,height=700');
  const colW = Math.floor(100 / headers.length);
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; font-size: 11px; color: #1e2025; padding: 28px; }
    h1 { font-size: 16px; font-weight: 600; margin-bottom: 4px; letter-spacing: 1px; text-transform: uppercase; }
    .meta { font-size: 10px; color: #666; margin-bottom: 18px; letter-spacing: 1px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1e2025; color: #fff; padding: 8px 10px; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; text-align: left; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
    tr:nth-child(even) td { background: #f8f8f8; }
    .footer { margin-top: 14px; text-align: right; font-size: 13px; font-weight: 600; border-top: 2px solid #00665e; padding-top: 8px; color: #00665e; }
    @media print { body { padding: 12px; } }
  </style>
  </head><body>
  <h1>${title}</h1>
  <div class="meta">Generado: ${new Date().toLocaleString('es-MX')} · Electronics México</div>
  <table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
  ${footer ? `<div class="footer">${footer}</div>` : ''}
  </body></html>`);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

// ── INIT ──────────────────────────────────────────────────
window.onload = () => {
  // ── SPLASH SCREEN AM ──────────────────────────────────────
  const splash      = document.getElementById('splash');
  const splashLogo  = document.getElementById('splash-logo');
  const wordmark    = document.getElementById('splash-wordmark');
  const shell       = document.querySelector('.shell');

  // Pausa de 550ms con fondo verde vacío → luego logo + wordmark aparecen juntos
  setTimeout(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        splash.classList.add('phase-1');
      });
    });
  }, 900);

  // Fase 2: logo visible ~1.5s antes de salir
  setTimeout(() => {
    splash.classList.add('phase-2');
    setTimeout(() => { shell.classList.add('visible'); }, 150);
    setTimeout(() => { splash.remove(); }, 800);
  }, 3000);

  // ─────────────────────────────────────────────────────────
  // Inicializar página activa explicitamente
  try {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pg = document.getElementById('page-buscar');
    if (pg) pg.classList.add('active');
    const nav = document.getElementById('nav-buscar');
    if (nav) nav.classList.add('active');
    // Asegurar filtro por defecto
    const exist = document.getElementById('s-exist');
    if (exist && !exist.value) exist.value = '3';
  } catch(e) {}

  try { history.replaceState({ page: 'buscar' }, '', ''); } catch(e) {}
  try { toggleFleteFields(); } catch(e) {}
  try { renderCarrito(); } catch(e) {}
  try { renderLog(); } catch(e) {}

  api('ping').then(d => {
    if (d.ok) { const b = document.getElementById('badge-cva'); if(b) b.textContent = 'CVA ✓'; }
  }).catch(() => {});
};
// ── EXPONER FUNCIONES AL SCOPE GLOBAL (necesario con script externo) ──────────
// Las funciones llamadas desde onclick="" en el HTML necesitan estar en window
Object.assign(window, {
  toggleSidebar, openSidebar, closeSidebar, showPage,
  buscarCVA, verProducto, volverATabla, limpiarBusqueda,
  filtrarPorMarca, filtrarPorGrupo, sortBuscar,
  agregarClave, agregarAlCarrito, pvQtyChange, setQty,
  cambiarQty, quitarItem, renderCarrito,
  enviarOrden, enviarOrdenTest, toggleFleteFields,
  cargarPedidos, filtrarPedidos, abrirModalPedido, cerrarModal,
  handleFileSelect, handleDrop, registrarPedido, enviarGuiaCVA,
  ejecutarSync, resetearSync, cargarEstadoSync, instalarTriggers, instalarTriggersUI,
  cargarVentasOdoo, buscarEnOdoo, ejecutarDebug,
  exportBuscarCSV, exportBuscarPDF, exportCarritoCSV, exportCarritoPDF,
  limpiarLog,
});
