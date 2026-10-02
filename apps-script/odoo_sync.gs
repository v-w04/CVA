// ============================================================
//  odoo_sync.gs · Sync SKU_INVENTARIO.Stock_para_Odoo → Odoo
//
//  Detecta cambios en col K (Stock para Odoo) — el stock calculado
//  con el % de exposición (típicamente 20% del stock total CVA) —
//  y los manda a Odoo via cola persistente con reintentos.
//
//  Mapeo:
//    SKU_INVENTARIO col K (Stock para Odoo)
//      → product.template.x_stock_cva   (campo custom de Odoo)
//
//  Para que funcione: en Odoo → Studio → product.template, crear
//  un campo Float llamado "x_stock_cva". Si no existe, el sync se
//  marca como FAILED con mensaje claro.
//
//  NO sincroniza precio. El precio MELI lo gestionas en cada
//  marketplace por separado, no en Odoo.
// ============================================================

const ODOO_SYNC_QUEUE        = "ODOO_SYNC_QUEUE";
const ODOO_SYNC_CACHE        = "_ODOO_SYNC_CACHE";
const ODOO_SYNC_MAX_INTENTOS = 3;
const ODOO_SYNC_BATCH        = 50;
const ODOO_SYNC_TOLERANCIA   = 0.5;  // diferencias < 0.5 unidades = sin cambio

function _colaHeaders_() {
  return [
    "timestamp", "clave_cva", "tipo",
    "valor_anterior", "valor_nuevo",
    "estado", "intentos", "last_attempt", "error_msg", "odoo_id"
  ];
}

function _cacheHeaders_() {
  return ["clave_cva", "stock_odoo", "last_check"];
}

function _obtenerHojaCola_() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  let sh = ss.getSheetByName(ODOO_SYNC_QUEUE);
  if (!sh) {
    sh = ss.insertSheet(ODOO_SYNC_QUEUE);
    sh.appendRow(_colaHeaders_());
    sh.getRange(1, 1, 1, _colaHeaders_().length)
      .setFontWeight("bold").setBackground("#00665e").setFontColor("#fff");
    sh.setFrozenRows(1);
  }
  return sh;
}

function _obtenerHojaCache_() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  let sh = ss.getSheetByName(ODOO_SYNC_CACHE);
  if (!sh) {
    sh = ss.insertSheet(ODOO_SYNC_CACHE);
    sh.appendRow(_cacheHeaders_());
    sh.getRange(1, 1, 1, _cacheHeaders_().length)
      .setFontWeight("bold").setBackground("#444").setFontColor("#fff");
    sh.setFrozenRows(1);
    sh.hideSheet();
  }
  return sh;
}

// ════════════════════════════════════════════════════════════════
//  DETECCIÓN — compara SKU_INVENTARIO col K vs cache, encola deltas
// ════════════════════════════════════════════════════════════════
function detectarCambiosYEncolar() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const shSKU = ss.getSheetByName("SKU_INVENTARIO");
  if (!shSKU) return { ok: false, error: "SKU_INVENTARIO no existe" };

  const shCache = _obtenerHojaCache_();
  const shCola  = _obtenerHojaCola_();

  // 1) Leer SKU: cols H (clave) y K (Stock para Odoo = calculado con %)
  const lastSku = _ultimaFilaSKUInventario_(shSKU);
  if (lastSku < 2) return { ok: true, cambios_detectados: 0, mensaje: "SKU_INVENTARIO vacío" };

  const sku = {};
  const skuData = shSKU.getRange(2, 8, lastSku - 1, 4).getValues(); // H, I, J, K
  skuData.forEach(r => {
    const clave = String(r[0] || "").trim();
    if (!clave) return;
    sku[clave] = { stock_odoo: parseFloat(r[3]) || 0 };  // col K
  });

  // 2) Leer cache
  const cache = {};
  const cacheLast = shCache.getLastRow();
  if (cacheLast >= 2) {
    const cacheData = shCache.getRange(2, 1, cacheLast - 1, 3).getValues();
    cacheData.forEach(r => {
      const clave = String(r[0] || "").trim();
      if (clave) cache[clave] = { stock_odoo: parseFloat(r[1]) || 0 };
    });
  }

  // 3) Detectar cambios
  const ahora = new Date();
  const aEncolar = [];
  const cacheActualizado = [];
  let primerasVeces = 0;

  Object.keys(sku).forEach(clave => {
    const actual = sku[clave];
    const previo = cache[clave];

    if (!previo) {
      primerasVeces++;
      cacheActualizado.push([clave, actual.stock_odoo, ahora]);
      return;
    }

    if (Math.abs(actual.stock_odoo - previo.stock_odoo) >= ODOO_SYNC_TOLERANCIA) {
      aEncolar.push([
        ahora, clave, "STOCK",
        previo.stock_odoo, actual.stock_odoo,
        "PENDIENTE", 0, "", "", "",
      ]);
    }
    cacheActualizado.push([clave, actual.stock_odoo, ahora]);
  });

  // 4) Reescribir cache
  if (cacheActualizado.length > 0) {
    if (cacheLast >= 2) shCache.getRange(2, 1, cacheLast - 1, 3).clearContent();
    shCache.getRange(2, 1, cacheActualizado.length, 3).setValues(cacheActualizado);
  }

  // 5) Encolar deltas
  if (aEncolar.length > 0) {
    const fila = shCola.getLastRow() + 1;
    shCola.getRange(fila, 1, aEncolar.length, 10).setValues(aEncolar);
  }

  SpreadsheetApp.flush();

  return {
    ok: true,
    cambios_detectados: aEncolar.length,
    primeras_veces: primerasVeces,
    productos_en_sku: Object.keys(sku).length,
    productos_en_cache: Object.keys(cache).length,
  };
}

// ════════════════════════════════════════════════════════════════
//  PROCESAMIENTO — toma N pendientes, escribe x_stock_cva en Odoo
// ════════════════════════════════════════════════════════════════
function procesarColaOdooSync(maxBatch) {
  const max = parseInt(maxBatch) || ODOO_SYNC_BATCH;
  const shCola = _obtenerHojaCola_();
  const lastRow = shCola.getLastRow();
  if (lastRow < 2) return { ok: true, procesados: 0, mensaje: "Cola vacía" };

  const data = shCola.getRange(2, 1, lastRow - 1, 10).getValues();
  const procesables = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const estado = String(r[5] || "");
    const intentos = parseInt(r[6]) || 0;
    if (estado === "PENDIENTE" || (estado === "ERROR" && intentos < ODOO_SYNC_MAX_INTENTOS)) {
      procesables.push({
        fila: i + 2,
        clave: String(r[1] || "").trim(),
        tipo: String(r[2] || ""),
        valor_nuevo: r[4],
        intentos: intentos,
      });
      if (procesables.length >= max) break;
    }
  }

  if (procesables.length === 0) return { ok: true, procesados: 0, mensaje: "Sin items pendientes" };

  // Autenticar Odoo
  let uid;
  try { uid = autenticarXMLRPC_(); }
  catch(e) { return { ok: false, error: "Autenticación Odoo falló: " + e.message }; }

  // Resolver productos -CVA (batch)
  const clavesUnicas = Array.from(new Set(procesables.map(p => p.clave)));
  const skusCVA = clavesUnicas.map(c => c + "-CVA");
  let prodsMap = {};
  try {
    const found = odooExec_(uid, "product.product", "search_read", [[
      ["default_code", "in", skusCVA]
    ]], { fields: ["id", "default_code", "product_tmpl_id"], limit: skusCVA.length });
    if (found) {
      found.forEach(p => {
        const claveSinCva = String(p.default_code || "").replace(/-CVA$/, "");
        prodsMap[claveSinCva] = {
          id: p.id,
          tmpl_id: Array.isArray(p.product_tmpl_id) ? p.product_tmpl_id[0] : p.product_tmpl_id,
        };
      });
    }
  } catch(e) {
    return { ok: false, error: "Búsqueda en Odoo falló: " + e.message };
  }

  // Procesar
  let ok = 0, error = 0;
  const ahora = new Date();
  const updates = [];

  procesables.forEach(p => {
    const odooInfo = prodsMap[p.clave];
    if (!odooInfo) {
      const nuevoIntentos = p.intentos + 1;
      updates.push({
        fila: p.fila,
        estado: nuevoIntentos >= ODOO_SYNC_MAX_INTENTOS ? "FAILED" : "ERROR",
        intentos: nuevoIntentos,
        error_msg: "Producto " + p.clave + "-CVA no existe en Odoo",
        odoo_id: "",
      });
      error++;
      return;
    }

    try {
      odooExec_(uid, "product.template", "write",
        [[odooInfo.tmpl_id], { x_stock_cva: parseFloat(p.valor_nuevo) || 0 }]
      );
      updates.push({
        fila: p.fila,
        estado: "COMPLETADO",
        intentos: p.intentos + 1,
        error_msg: "",
        odoo_id: odooInfo.id,
      });
      ok++;
    } catch(e) {
      const msg = String(e.message || e).substring(0, 250);
      let errFinal = msg;
      if (msg.indexOf("x_stock_cva") >= 0 || msg.indexOf("Invalid field") >= 0) {
        errFinal = "⚠ Campo x_stock_cva no existe en Odoo. Créalo en Studio (product.template, Float).";
      }
      const nuevoIntentos = p.intentos + 1;
      updates.push({
        fila: p.fila,
        estado: nuevoIntentos >= ODOO_SYNC_MAX_INTENTOS ? "FAILED" : "ERROR",
        intentos: nuevoIntentos,
        error_msg: errFinal,
        odoo_id: odooInfo.id,
      });
      error++;
    }
  });

  updates.forEach(u => {
    shCola.getRange(u.fila, 6, 1, 5).setValues([[
      u.estado, u.intentos, ahora, u.error_msg, u.odoo_id
    ]]);
  });
  SpreadsheetApp.flush();

  return {
    ok: true,
    procesados: procesables.length,
    completados: ok,
    errores: error,
  };
}

// ════════════════════════════════════════════════════════════════
//  ESTADO DE LA COLA
// ════════════════════════════════════════════════════════════════
function getEstadoColaOdooSync() {
  const shCola = _obtenerHojaCola_();
  const lastRow = shCola.getLastRow();
  if (lastRow < 2) return { ok: true, total: 0, contadores: {}, ultimos: [] };

  const data = shCola.getRange(2, 1, lastRow - 1, 10).getValues();
  const cont = { PENDIENTE: 0, COMPLETADO: 0, ERROR: 0, FAILED: 0, PROCESANDO: 0 };

  data.forEach(r => {
    const estado = String(r[5] || "");
    if (cont[estado] !== undefined) cont[estado]++;
  });

  const ultimos = [];
  for (let i = data.length - 1; i >= 0 && ultimos.length < 50; i--) {
    const r = data[i];
    ultimos.push({
      timestamp:      r[0] ? (r[0] instanceof Date ? r[0].toISOString() : String(r[0])) : "",
      clave:          r[1] || "",
      tipo:           r[2] || "",
      valor_anterior: r[3],
      valor_nuevo:    r[4],
      estado:         String(r[5] || ""),
      intentos:       r[6] || 0,
      last_attempt:   r[7] ? (r[7] instanceof Date ? r[7].toISOString() : String(r[7])) : "",
      error_msg:      r[8] || "",
    });
  }

  return { ok: true, total: data.length, contadores: cont, ultimos: ultimos };
}

// ════════════════════════════════════════════════════════════════
//  LIMPIAR COMPLETADOS (housekeeping)
// ════════════════════════════════════════════════════════════════
function limpiarColaCompletados(diasAtras) {
  const dias = parseInt(diasAtras) || 7;
  const corte = new Date();
  corte.setDate(corte.getDate() - dias);

  const shCola = _obtenerHojaCola_();
  const lastRow = shCola.getLastRow();
  if (lastRow < 2) return { ok: true, eliminados: 0 };

  const data = shCola.getRange(2, 1, lastRow - 1, 10).getValues();
  const filasAEliminar = [];
  for (let i = data.length - 1; i >= 0; i--) {
    const estado = String(data[i][5] || "");
    const ts = data[i][0] instanceof Date ? data[i][0] : new Date(data[i][0]);
    if (estado === "COMPLETADO" && ts < corte) {
      filasAEliminar.push(i + 2);
    }
  }

  filasAEliminar.forEach(f => shCola.deleteRow(f));
  return { ok: true, eliminados: filasAEliminar.length };
}

// ════════════════════════════════════════════════════════════════
//  TRIGGER COMBINADO — detecta + procesa (corre cada 15 min)
// ════════════════════════════════════════════════════════════════
function triggerOdooSync() {
  try {
    const det = detectarCambiosYEncolar();
    Logger.log("📋 OdooSync detectados: " + det.cambios_detectados + " · primeras_veces: " + det.primeras_veces);

    const proc = procesarColaOdooSync(ODOO_SYNC_BATCH);
    Logger.log("✅ OdooSync procesados: " + proc.procesados + " (ok=" + proc.completados + ", err=" + proc.errores + ")");

    logSheet_("SYNC_LOG", [
      "ODOO_SYNC",
      "detect:" + det.cambios_detectados,
      "proc:" + proc.procesados,
      "ok:" + proc.completados,
      "err:" + proc.errores,
    ]);
  } catch(e) {
    Logger.log("❌ triggerOdooSync: " + e.message);
    logSheet_("SYNC_LOG", ["ODOO_SYNC", "ERROR", e.message]);
  }
}

// ════════════════════════════════════════════════════════════════
//  RESETEAR CACHE — útil si quieres re-sincronizar todo desde 0
// ════════════════════════════════════════════════════════════════
function resetearCacheOdooSync() {
  const shCache = _obtenerHojaCache_();
  const last = shCache.getLastRow();
  if (last >= 2) shCache.getRange(2, 1, last - 1, 3).clearContent();
  return { ok: true };
}