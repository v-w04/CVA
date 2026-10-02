// ============================================================
//  DROPSHIPPING CVA — Electronics México
//  Code.gs · Router principal + Config + Token CVA
// ============================================================

// ── CONFIGURACIÓN (no sensible — puede estar en GitHub) ──────
const CFG = {
  // Odoo — URL y DB no son secretos
  ODOO_URL : "https://electronicsmexico.odoo.com",
  ODOO_DB  : "electronicsmexico",

  // Odoo — Bodega CVA Dropshipping
  // location_id = 216 corresponde a "Almacén/Existencias/CVA"
  ODOO_BODEGA_CVA_ID  : 216,
  ODOO_BODEGA_CVA_NAME: "Almacén/Existencias/CVA",

  // CVA — URLs no son secretos
  CVA_BASE    : "https://apicvaservices.grupocva.com/api/v2",
  CVA_GUIAS_URL: "https://apicvaservices.grupocva.com/api/v2/waybill",

  // Sucursal CVA asignada a Electronics México
  CVA_SUCURSAL: 1,

  // Margen default
  MARGEN_DEFAULT: 16,

  // Sheet ID
  SHEET_ID: "1X_Tsi3m9dboLxxZksozRHsBGpwO1BUuHFLvkoRbgSY4",
};

// ── CREDENCIALES — se leen de Script Properties (nunca en GitHub) ──
// Para configurarlas: ejecuta setupCredenciales() UNA VEZ desde el editor de GAS
function getCreds_() {
  const p = PropertiesService.getScriptProperties();
  return {
    CVA_USER        : p.getProperty("CVA_USER")         || "",
    CVA_PASS        : p.getProperty("CVA_PASS")         || "",
    CVA_GUIAS_TOKEN : p.getProperty("CVA_GUIAS_TOKEN")  || "",
    ODOO_USER       : p.getProperty("ODOO_USER")        || "",
    ODOO_KEY        : p.getProperty("ODOO_KEY")         || "",
  };
}

// Ejecuta esta función UNA VEZ desde el editor para guardar las credenciales
function setupCredenciales() {
  // Las credenciales YA estan en Script Properties. Para cambiarlas, pon los
  // valores aqui SOLO en el editor, corre y vuelve a dejar PON_AQUI. Nunca subir.
  const p = PropertiesService.getScriptProperties();
  const _v = {
    CVA_USER        : "PON_AQUI",
    CVA_PASS        : "PON_AQUI",
    CVA_GUIAS_TOKEN : "PON_AQUI",
    ODOO_USER       : "PON_AQUI",
    ODOO_KEY        : "PON_AQUI",
  };
  if (Object.keys(_v).some(k => _v[k] === "PON_AQUI")) {
    throw new Error("Pon los valores reales en el editor (sin subirlos) antes de correr esto.");
  }
  p.setProperties(_v);
  // Limpiar token CVA cacheado para que se regenere con el password nuevo
  p.deleteProperty("CVA_TOKEN");
  p.deleteProperty("CVA_TOKEN_EXP");
  Logger.log("✅ Credenciales guardadas y token CVA reseteado");
}

// ── TOKEN CVA — auto-refresh cada 11h ────────────────────────
function getCVAToken() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("CVA_TOKEN");
  const exp   = parseInt(props.getProperty("CVA_TOKEN_EXP") || "0");

  if (token && Date.now() < exp) return token;

  const creds = getCreds_();
  if (!creds.CVA_USER || !creds.CVA_PASS) {
    throw new Error("❌ Credenciales CVA no configuradas. Ejecuta setupCredenciales() en GAS.");
  }

  const res = UrlFetchApp.fetch(CFG.CVA_BASE + "/user/login", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ user: creds.CVA_USER, password: creds.CVA_PASS }),
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() !== 200) {
    throw new Error("❌ CVA login falló: " + res.getContentText());
  }

  const data = JSON.parse(res.getContentText());
  if (!data.token) throw new Error("❌ CVA no devolvió token: " + JSON.stringify(data));

  props.setProperty("CVA_TOKEN", data.token);
  props.setProperty("CVA_TOKEN_EXP", String(Date.now() + 11 * 3600 * 1000));
  Logger.log("✅ Token CVA renovado");
  return data.token;
}

function setupCVACredentials() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("CVA_USER", "TU_USUARIO_CVA");
  props.setProperty("CVA_PASS", "TU_PASSWORD_CVA");
  Logger.log("✅ Credenciales CVA guardadas en PropertiesService");
}

// ── ROUTER PRINCIPAL ─────────────────────────────────────────
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  // Buscador de imágenes embebido en la PWA (iframe) y acceso directo por URL
  if (e && e.parameter && e.parameter.page === "imagenes") {
    return HtmlService.createTemplateFromFile("imagenesUI").evaluate()
      .setTitle("Imágenes por UPC")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  if (e && e.parameter && e.parameter.page === "pedido_cva") {
    return HtmlService.createTemplateFromFile("pedidoCvaUI").evaluate()
      .setTitle("Pedido CVA")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  if (e && e.parameter && e.parameter.page === "historial_cva") {
    return HtmlService.createTemplateFromFile("historialCvaUI").evaluate()
      .setTitle("Historial CVA")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  if (e && e.parameter && e.parameter.page === "ventas_masivo") {
    return HtmlService.createTemplateFromFile("ventasMasivoUI").evaluate()
      .setTitle("Todos los pedidos")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  if (!action) {
    return HtmlService.createTemplateFromFile("index").evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setTitle("CVA Dropshipping · Electronics México");
  }

  try {
    const result = routeGet_(action, e.parameter);
    return jsonResponse_(result);
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  let body = {};
  try {
    const raw = e.postData ? e.postData.contents : "{}";
    body = JSON.parse(raw || "{}");
  } catch (_) {
    body = e.parameter || {};
  }

  try {
    const result = routePost_(body.action, body);
    return jsonResponse_(result);
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function routeGet_(action, p) {
  switch (action) {

    case "cva_producto":
      return cvaGetProducto(p.clave, p);

    case "cva_buscar":
      return cvaSearch(p);

    case "cva_precio_stock":
      return cvaPrecioStock(p.clave, p);

    case "cva_tc":
      return cvaTipoCambio();

    case "cva_marcas":
      return getMarcasConStock();

    case "cva_grupos":
      return getGruposConStock();

    case "ml_precio":
      return mlBuscarPrecio(p.q);

    case "cva_sucursales":
      return cvaCatalogo("sucursales");

    case "cva_imagenes":
      return cvaImagenes(p.clave);

    case "cva_info_tecnica":
      return cvaInfoTecnica(p.clave);

    case "enriquecer_pesos":
      return enriquecerPesosDesdeCVA(p.forzar === "true");

    case "recalcular_dimensiones":
      return recalcularDimensionesEnSKU(p.forzar === "true");

    case "metadata_get":
      return metadataGet();

    case "metadata_set":
      return metadataSet(p);

    case "cva_pedidos":
      return cvaListaPedidos();

    case "cva_saldo":
      return cvaSaldo();

    case "saldo_ventas":
      return leerSaldoVentas();

    case "cva_consultar_pedido":
      return cvaConsultarPedido(p.pedido);

    case "cva_consultar_guia":
      return cvaConsultarGuia(p.order_number);

    case "pedidos_locales":
      return getPedidosLocales();

    case "odoo_ventas_pendientes":
      return odooVentasPendientes(p);

    case "odoo_ventas_dropship":
      return odooVentasPendientesDropship(p);

    case "odoo_pickings":
      return odooPickingsPendientes(p);

    case "odoo_locations":
      return odooListarLocations();

    // Las funciones de estas dos rutas no existen en el proyecto (se perdieron).
    // Las ventas -CVA ya las junta Venta Diaria Odoo en su hoja PEDIDOS CVA.
    case "ventas_cva_historial":
      if (typeof getVentasHistorial !== "function") return { ok: false, error: "Historial de ventas CVA no disponible: revisa la hoja PEDIDOS CVA de Venta Diaria Odoo" };
      return getVentasHistorial(p);

    case "ventas_cva_sync":
      if (typeof sincronizarVentasCVA !== "function") return { ok: false, error: "Sync de ventas CVA no disponible en este proyecto" };
      return sincronizarVentasCVA(p);

    case "odoo_sync_estado":
      return getEstadoColaOdooSync();

    case "odoo_sync_procesar":
      return procesarColaOdooSync(parseInt(p.batch) || 50);

    case "odoo_sync_detectar":
      return detectarCambiosYEncolar();

    case "odoo_sync_limpiar":
      return limpiarColaCompletados(parseInt(p.dias) || 7);

    case "odoo_sync_reset_cache":
      return resetearCacheOdooSync();

    case "odoo_buscar_producto":
      return oodooBuscarProducto(p.clave);

    case "odoo_stock":
      return odooStock(p.clave);

    case "odoo_stock_cva":
      return odooStockBodegaCVA(p.clave);

    case "ping":
      return { ok: true, ts: new Date().toISOString() };

    case "analisis_movimiento":
      return getAnalisisMovimiento(p);

    case "instalar_triggers":
      try { instalarTriggers(); return { ok: true, mensaje: "Triggers instalados" }; }
      catch(e) { return { ok: false, error: e.message }; }

    case "sync_status": {
      const props = PropertiesService.getScriptProperties();
      const page  = parseInt(props.getProperty("SYNC_PAGE") || "1");
      const ss    = SpreadsheetApp.openById(CFG.SHEET_ID);
      const shS   = ss.getSheetByName("SYNC_CVA");
      const shH   = ss.getSheetByName("HISTORIAL_STOCK");
      const shL   = ss.getSheetByName("SYNC_LOG");
      let ultimoSync = null;
      if (shL && shL.getLastRow() > 1) {
        const lastRow = shL.getRange(shL.getLastRow(), 1, 1, shL.getLastColumn()).getValues()[0];
        ultimoSync = lastRow.join(" | ");
      }
      const fechaInicioH = shH && shH.getLastRow() > 1 ? String(shH.getRange(2,1).getValue()).substring(0,10) : null;
      let diasHistorial = 0;
      if (shH && shH.getLastRow() > 1) {
        const fechas = new Set();
        const hRows = Math.min(shH.getLastRow() - 1, 5000);
        shH.getRange(2, 1, hRows, 1).getValues().forEach(r => {
          const f = r[0] ? String(r[0]).substring(0,10) : null;
          if (f) fechas.add(f);
        });
        diasHistorial = fechas.size;
      }
      return {
        ok: true,
        pagina_actual: page,
        registros_sync_cva: shS ? shS.getLastRow() - 1 : 0,
        registros_historial: shH ? shH.getLastRow() - 1 : 0,
        fecha_inicio_historial: fechaInicioH,
        dias_historial: diasHistorial,
        ultimo_sync_log: ultimoSync,
      };
    }

    case "reset_sync": {
      const props2 = PropertiesService.getScriptProperties();
      props2.setProperty("SYNC_PAGE", "1");
      props2.setProperty("SYNC_RESET_FLAG", "true");
      if (p.limpiar === "true") {
        const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
        const sh = ss.getSheetByName("SYNC_CVA");
        if (sh && sh.getLastRow() > 1) {
          sh.deleteRows(2, sh.getLastRow() - 1);
        }
      }
      return { ok: true, mensaje: "Checkpoint de sync reseteado a página 1" + (p.limpiar === "true" ? " y SYNC_CVA limpiado" : "") };
    }

    case "inv_odoo_list":
      return invOdooList();

    case "inv_odoo_add":
      return invOdooAdd((p.claves || "").split(",").filter(Boolean));

    case "inv_odoo_remove":
      return invOdooRemove(p.clave || "");

    case "inv_odoo_set_pct":
      return invOdooSetPct(p.clave || "", p.pct);

    case "inv_odoo_set_global_pct":
      return invOdooSetGlobalPct(p.pct);

    case "inv_odoo_set_global_tc":
      return invOdooSetGlobalTC(p.tc);

    case "inv_odoo_refresh":
      try {
        if (typeof refrescarInventarioOdoo === "function") refrescarInventarioOdoo();
        return { ok: true };
      } catch(e) { return { ok: false, error: e.message }; }

    default:
      throw new Error("Acción desconocida: " + action);
  }
}

function routePost_(action, body) {
  switch (action) {

    case "cva_crear_orden":
      return cvaCrearOrden(body || {});

    case "odoo_recibir_bodega_cva":
      return odooRecibirEnBodegaCVA(body.po_id);

    case "odoo_actualizar_precio":
      return odooActualizarPrecio(body.clave, body.precio, body.moneda);

    case "cva_enviar_guia":
      return cvaEnviarGuia(body);

    case "registrar_pedido":
      return registrarPedidoLocal(body);

    case "odoo_confirmar_po":
      return odooConfirmarPO(body);

    case "odoo_crear_po":
      return odooCrearPO(body);

    case "sync_precios":
      return syncPreciosCVAOdoo(body);

    case "sync_historial":
      return syncHistorialCVA();

    case "analisis_movimiento":
      return getAnalisisMovimiento(body);

    case "enviar_confirmacion_pedido":
      return enviarConfirmacionPedido(body);

    default:
      throw new Error("Acción POST desconocida: " + action);
  }
}

// ── HELPERS ───────────────────────────────────────────────────
function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function cvaFetch_(path, params) {
  const token = getCVAToken();
  const qs = params
    ? "?" + Object.entries(params)
        .filter(([, v]) => v !== "" && v !== null && v !== undefined)
        // MonedaPesos=false se OMITE: por si CVA toma cualquier valor como true.
        // Sin el parametro, CVA devuelve el precio en su moneda original.
        .filter(([k, v]) => !(k === "MonedaPesos" && String(v) === "false"))
        .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
        .join("&")
    : "";

  const url = CFG.CVA_BASE + path + qs;
  Logger.log("CVA GET: " + url);

  let res;
  try {
    res = UrlFetchApp.fetch(url, {
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true,
      deadline: 50,
    });
  } catch (e) {
    throw new Error("Tiempo de espera agotado — intenta con filtros más específicos");
  }

  const code = res.getResponseCode();
  if (code !== 200) {
    throw new Error("CVA HTTP " + code + ": " + res.getContentText().substring(0, 200));
  }

  return JSON.parse(res.getContentText());
}

function cvaPost_(path, bodyObj) {
  const token = getCVAToken();
  const url = CFG.CVA_BASE + path;
  Logger.log("CVA POST: " + url);

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify(bodyObj),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  if (code !== 200) {
    const body = res.getContentText();
    Logger.log("CVA POST ERROR " + code + ": " + body);
    throw new Error("CVA " + code + " | " + body);
  }

  return JSON.parse(res.getContentText());
}

// ── TRIGGERS — UN SOLO INSTALADOR ─────────────────────────────
// Antes habia dos instaladores (este y el del menu del Sheet). Los dos
// borraban TODOS los triggers del proyecto, asi que el ultimo en correr
// tumbaba al otro, y uno apuntaba a una funcion que no existe
// (triggerSincronizarVentas). Ahora la lista vive aqui y solo aqui; el
// menu y el endpoint "instalar_triggers" llaman a esta misma funcion.
//
// Fuera para siempre: triggerOdooSync (Odoo ya trae el stock de CVA por
// su cuenta), triggerSincronizarVentas (no existia), triggerSyncViaWebApp
// (duplicaba el sync), triggerKPIs (solo escribia la fecha),
// refrescarInventarioOdoo cada 10 min (solo forzaba formulas).
//
// cada: "min" -> cada n minutos (1,5,10,15,30) | "hora" -> cada n horas
//       "dia" -> diario a la hora n
const TRIGGERS_CVA = [
  { fn: "triggerSyncDiario",     cada: "hora", n: 1,  txt: "Sync catalogo CVA + historial del dia" },
  { fn: "triggerPollingPedidos", cada: "min",  n: 30, txt: "Pedidos CVA pendientes" },
  { fn: "triggerAnalisis",       cada: "dia",  n: 7,  txt: "Hoja ANALISIS_MOVIMIENTO" },
  { fn: "triggerMonitorSalud",   cada: "dia",  n: 8,  txt: "Monitor de salud (email solo si algo critico)" },
];

function _textoFrecuencia_(t) {
  if (t.cada === "min")  return "cada " + t.n + " min";
  if (t.cada === "hora") return t.n === 1 ? "cada hora" : "cada " + t.n + " h";
  return "diario " + t.n + ":00";
}

function resumenTriggers_() {
  return TRIGGERS_CVA.map(t => "• " + t.txt + ": " + _textoFrecuencia_(t)).join("\n");
}

function instalarTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // onOpen instalable para el menu del Sheet
  ScriptApp.newTrigger("onOpen")
    .forSpreadsheet(SpreadsheetApp.openById(CFG.SHEET_ID))
    .onOpen().create();

  TRIGGERS_CVA.forEach(t => {
    const b = ScriptApp.newTrigger(t.fn).timeBased();
    if (t.cada === "min")       b.everyMinutes(t.n);
    else if (t.cada === "hora") b.everyHours(t.n);
    else                        b.atHour(t.n).everyDays(1);
    b.create();
  });

  logSheet_("SYNC_LOG", ["INSTALAR_TRIGGERS", TRIGGERS_CVA.length,
                          TRIGGERS_CVA.map(t => t.fn + " " + _textoFrecuencia_(t)).join(" | ")]);
  Logger.log("✅ Triggers instalados:\n" + resumenTriggers_());
  return { ok: true, triggers: TRIGGERS_CVA.length, resumen: resumenTriggers_() };
}

// Sync diario completo — descarga TODO el catálogo CVA con stock y guarda historial
// Este corre directo en GAS como trigger, no pasa por el Web App
function triggerSyncDiario() {
  try {
    Logger.log("🔄 Iniciando sync diario CVA...");
    const resultado = syncHistorialCVA();
    Logger.log("✅ Sync diario: " + resultado.articulos + " artículos, " + resultado.paginas + " páginas");
  } catch (e) {
    Logger.log("❌ triggerSyncDiario: " + e.message);
  }
}

// Mantener por compatibilidad con llamadas manuales
function triggerSyncPrecios() {
  try {
    syncPreciosCVAOdoo({ batch: "XL", paginas: 999 });
  } catch (e) {
    Logger.log("❌ triggerSyncPrecios: " + e.message);
  }
}

function triggerPollingPedidos() {
  try {
    pollingPedidosCVA();
  } catch (e) {
    Logger.log("❌ triggerPollingPedidos: " + e.message);
  }
}

// ── HANDLERS google.script.run ────────────────────────────────
function apiHandler(action, params) {
  try {
    return routeGet_(action, params || {});
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function apiHandlerPost(action, body) {
  try {
    return routePost_(action, body || {});
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── LOG A SHEETS ──────────────────────────────────────────────
function logSheet_(hoja, datos) {
  try {
    const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
    let sh = ss.getSheetByName(hoja);
    if (!sh) sh = ss.insertSheet(hoja);
    sh.appendRow([new Date(), ...datos]);
  } catch (e) {
    Logger.log("logSheet_ error: " + e.message);
  }
}

// ── PEDIDOS LOCALES ───────────────────────────────────────────
const COLS_PEDIDOS = ["fecha","nuestra_orden","orden_cva","tienda","carrier","no_guia","observaciones","guia_enviada","pdf_nombre","pdf_base64"];

function getPedidosLocales() {
  try {
    const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
    let sh = ss.getSheetByName("PEDIDOS_GUIAS");
    if (!sh) return { ok: true, pedidos: [] };

    const data = sh.getDataRange().getValues();
    if (data.length < 2) return { ok: true, pedidos: [] };

    const headers = data[0];
    const pedidos = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

    return { ok: true, pedidos };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function registrarPedidoLocal(body) {
  try {
    const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
    let sh = ss.getSheetByName("PEDIDOS_GUIAS");

    if (!sh) {
      sh = ss.insertSheet("PEDIDOS_GUIAS");
      sh.appendRow(COLS_PEDIDOS);
      sh.getRange(1, 1, 1, COLS_PEDIDOS.length)
        .setFontWeight("bold")
        .setBackground("#1f6feb")
        .setFontColor("#ffffff");
      sh.setFrozenRows(1);
    }

    const data = sh.getDataRange().getValues();
    const headers = data[0];

    let filaExistente = -1;
    for (let i = 1; i < data.length; i++) {
      const idxOC = headers.indexOf("orden_cva");
      if (String(data[i][idxOC]) === String(body.orden_cva)) {
        filaExistente = i + 1;
        break;
      }
    }

    const rowData = COLS_PEDIDOS.map(col => {
      if (col === "fecha") return body.fecha || new Date().toLocaleDateString("es-MX");
      if (col === "guia_enviada") return body.guia_enviada ? "SI" : "NO";
      return body[col] || "";
    });

    if (filaExistente > 0) {
      sh.getRange(filaExistente, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sh.appendRow(rowData);
    }

    if (body.pdf_base64 && body.pdf_nombre) {
      try {
        const folder = obtenerCarpetaGuias_();
        const blob   = Utilities.newBlob(
          Utilities.base64Decode(body.pdf_base64),
          "application/pdf",
          body.pdf_nombre
        );
        const file = folder.createFile(blob);
        Logger.log("✅ PDF guardado: " + file.getUrl());
      } catch (pdfErr) {
        Logger.log("⚠️ PDF no guardado: " + pdfErr.message);
      }
    }

    return { ok: true, mensaje: "Pedido registrado" };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function obtenerCarpetaGuias_() {
  const nombre = "CVA Dropship — Guías PDF";
  const carpetas = DriveApp.getFoldersByName(nombre);
  if (carpetas.hasNext()) return carpetas.next();
  return DriveApp.createFolder(nombre);
}

// ── MARCAS Y GRUPOS CON STOCK (desde SYNC_CVA) ───────────────
function getMarcasConStock() {
  try {
    const sh = SpreadsheetApp.openById(CFG.SHEET_ID).getSheetByName("SYNC_CVA");
    if (!sh || sh.getLastRow() < 2) return cvaCatalogo("marcas");
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
    const marcaSet = {};
    data.forEach(row => {
      const marca    = (row[2] || "").toString().trim();
      const stockSuc = parseFloat(row[6]) || 0;
      const stockCD  = parseFloat(row[7]) || 0;
      if (marca && (stockSuc > 0 || stockCD > 0)) {
        marcaSet[marca] = (marcaSet[marca] || 0) + stockSuc + stockCD;
      }
    });
    const marcas = Object.keys(marcaSet)
      .sort((a, b) => marcaSet[b] - marcaSet[a])
      .map(m => ({ marca: m, logo: "" }));
    return { ok: true, marcas };
  } catch(e) {
    return cvaCatalogo("marcas");
  }
}

function getGruposConStock() {
  try {
    const sh = SpreadsheetApp.openById(CFG.SHEET_ID).getSheetByName("SYNC_CVA");
    if (!sh || sh.getLastRow() < 2) return cvaCatalogo("grupos");
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
    const grupoSet = {};
    data.forEach(row => {
      const grupo    = (row[3] || "").toString().trim();
      const stockSuc = parseFloat(row[6]) || 0;
      const stockCD  = parseFloat(row[7]) || 0;
      if (grupo && (stockSuc > 0 || stockCD > 0)) {
        grupoSet[grupo] = (grupoSet[grupo] || 0) + stockSuc + stockCD;
      }
    });
    const grupos = Object.keys(grupoSet)
      .sort((a, b) => grupoSet[b] - grupoSet[a])
      .map(g => ({ nombre: g, grupo: g }));
    return { ok: true, grupos };
  } catch(e) {
    return cvaCatalogo("grupos");
  }
}

// ── MERCADOLIBRE PRECIO PROXY ─────────────────────────────────
function mlBuscarPrecio(q) {
  if (!q) return { ok: false, error: "Se requiere query" };
  try {
    const url = "https://api.mercadolibre.com/sites/MLM/search?q="
      + encodeURIComponent(q) + "&limit=12&condition=new";
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { "Accept": "application/json" }
    });
    const code = res.getResponseCode();
    if (code !== 200) {
      const res2 = UrlFetchApp.fetch(
        "https://api.mercadolibre.com/sites/MLM/search?q=" + encodeURIComponent(q) + "&limit=12",
        { muteHttpExceptions: true, headers: { "Accept": "application/json" } }
      );
      if (res2.getResponseCode() !== 200) return { ok: false, error: "ML " + code };
      const d2 = JSON.parse(res2.getContentText());
      return { ok: true, results: d2.results || [], total: d2.paging?.total || 0 };
    }
    const data = JSON.parse(res.getContentText());
    return { ok: true, results: data.results || [], total: data.paging?.total || 0 };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}


// ── CONFIRMACIÓN DE PEDIDO POR EMAIL ─────────────────────────
function enviarConfirmacionPedido(body) {
  try {
    const {
      pedido, subtotal, iva, total_prod,
      flete_sub, flete_iva, flete_total, cajas,
      grand_total, tc, moneda,
      email_agente, email_almacen,
      correos, productos, num_oc, sucursal
    } = body;

    // Destinatarios: los que mandó el usuario + siempre victor.walmart.04@gmail.com
    const defaultEmail = "victor.walmart.04@gmail.com";
    const destinatarios = [...new Set([
      defaultEmail,
      ...(correos || []).filter(c => c && c.includes("@"))
    ])];

    const fmtMXN = (n) => "$" + parseFloat(n || 0).toLocaleString("es-MX", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }) + " MXN";

    const productosHTML = (productos || []).map(p =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;font-family:monospace">${p.clave}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px">${p.desc || ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:center">${p.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right">${fmtMXN(p.precio)}</td>
      </tr>`
    ).join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

  <!-- Header -->
  <tr>
    <td style="background:#00665e;padding:28px 32px">
      <div style="font-family:sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:8px">Electronics México · CVA Dropshipping</div>
      <div style="font-family:sans-serif;font-size:28px;font-weight:300;color:#fff;letter-spacing:1px">Pedido Confirmado</div>
      <div style="font-family:monospace;font-size:20px;color:#67b8af;margin-top:6px;letter-spacing:2px">${pedido}</div>
      ${num_oc ? `<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:4px">OC: ${num_oc}</div>` : ""}
    </td>
  </tr>

  <!-- Info sucursal -->
  ${sucursal ? `<tr><td style="padding:12px 32px;background:#f0f7f6;font-size:11px;color:#555;border-bottom:1px solid #e0e0e0">
    Sucursal CVA: <strong>${sucursal}</strong>
    ${email_agente ? ` &nbsp;·&nbsp; Agente: ${email_agente}` : ""}
    ${email_almacen ? ` &nbsp;·&nbsp; Almacén: ${email_almacen}` : ""}
  </td></tr>` : ""}

  <!-- Productos -->
  <tr><td style="padding:24px 32px 0">
    <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:12px">Productos</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:2px">
      <thead>
        <tr style="background:#f8f8f8">
          <th style="padding:8px 12px;text-align:left;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#666">Clave</th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#666">Descripción</th>
          <th style="padding:8px 12px;text-align:center;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#666">Qty</th>
          <th style="padding:8px 12px;text-align:right;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#666">Precio</th>
        </tr>
      </thead>
      <tbody>${productosHTML}</tbody>
    </table>
  </td></tr>

  <!-- Desglose de totales -->
  <tr><td style="padding:20px 32px">
    <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:12px">Desglose</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:7px 0;color:#888;font-size:13px">Subtotal productos</td>
        <td style="padding:7px 0;text-align:right;font-size:13px;font-weight:500">${fmtMXN(subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;color:#888;font-size:13px">IVA (16%)</td>
        <td style="padding:7px 0;text-align:right;font-size:13px">${fmtMXN(iva)}</td>
      </tr>
      <tr style="border-top:1px solid #eee">
        <td style="padding:8px 0;color:#555;font-size:13px;font-weight:600">Subtotal con IVA</td>
        <td style="padding:8px 0;text-align:right;font-size:13px;font-weight:600">${fmtMXN(total_prod)}</td>
      </tr>
      ${flete_total > 0 ? `
      <tr style="border-top:1px solid #f0f0f0">
        <td style="padding:7px 0;color:#888;font-size:13px">Flete (${cajas || 1} caja${cajas !== 1 ? "s" : ""}) — Paquetexpress</td>
        <td style="padding:7px 0;text-align:right;font-size:13px">${fmtMXN(flete_sub)}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;color:#888;font-size:13px">IVA flete</td>
        <td style="padding:7px 0;text-align:right;font-size:13px">${fmtMXN(flete_iva)}</td>
      </tr>` : ""}
      <tr style="border-top:2px solid #00665e">
        <td style="padding:12px 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#00665e">TOTAL A PAGAR</td>
        <td style="padding:12px 0 8px;text-align:right;font-size:24px;font-weight:600;color:#00665e">${fmtMXN(grand_total)}</td>
      </tr>
      ${tc ? `<tr><td colspan="2" style="text-align:right;font-size:10px;color:#aaa;padding-bottom:8px">Tipo de cambio: $${tc} MXN/USD</td></tr>` : ""}
    </table>
  </td></tr>

  <!-- Footer -->
  <tr>
    <td style="padding:16px 32px;background:#f8f8f8;border-top:1px solid #eee;font-size:10px;color:#aaa;text-align:center;letter-spacing:1px">
      Electronics México · CVA Dropshipping · ${new Date().toLocaleString("es-MX")}
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const asunto = `Pedido CVA ${pedido}${num_oc ? " · OC: " + num_oc : ""} — ${fmtMXN(grand_total)}`;

    destinatarios.forEach(correo => {
      try {
        MailApp.sendEmail({
          to     : correo,
          subject: asunto,
          htmlBody: html,
        });
        Logger.log("✅ Email enviado a: " + correo);
      } catch(mailErr) {
        Logger.log("⚠️ Email a " + correo + " falló: " + mailErr.message);
      }
    });

    logSheet_("SYNC_LOG", ["EMAIL_CONFIRMACION", pedido, destinatarios.join(", ")]);
    return { ok: true, enviado_a: destinatarios };

  } catch(e) {
    Logger.log("❌ enviarConfirmacionPedido: " + e.message);
    return { ok: false, error: e.message };
  }
}

// ── SYNC DIARIO COMPLETO CVA → HISTORIAL_STOCK ───────────────
// Diseñado para correr como trigger directo en GAS (no via Web App).
// Descarga TODO el catálogo CVA página por página y guarda un snapshot
// diario en HISTORIAL_STOCK. No actualiza SYNC_CVA para no interferir
// con el sync parcial existente.
//
// Estrategia:
// - batch=LG (500 por página) para minimizar número de páginas
// - Solo parámetros esenciales: precio, stock suc, stock cedis
// - Sin sucursales/dimen/dt/dc/upc — esos triplican el tiempo por producto
// - Guarda snapshot con fecha del día: si ya existe el de hoy, no repite
function syncHistorialCVA() {
  // Baja el catalogo CVA con stock, actualiza SYNC_CVA y agrega el snapshot
  // del dia a HISTORIAL_STOCK.
  //
  // Corrige lo que dejaba los snapshots al ~55%:
  //   1. Antes escribia SYNC_CVA renglon por renglon (miles de escrituras),
  //      se acababa el tiempo y AUN ASI marcaba el dia como hecho. Ahora
  //      escribe en bloque y solo marca el dia cuando llego a la ultima pagina.
  //   2. Si se acaba el tiempo, guarda en que pagina iba y la siguiente
  //      corrida (cada hora) sigue desde ahi.
  //   3. Al cerrar el dia, lo que CVA ya no mando (se agoto) queda con stock
  //      0 en SYNC_CVA. Antes se quedaba con el stock viejo para siempre y el
  //      analisis nunca veia que se habia vendido.
  //   4. En HISTORIAL_STOCK ya no se repiten descripcion ni marca (viven en
  //      SYNC_CVA): era el 60% del peso del archivo y el analisis no las usa.
  const START_MS = Date.now();
  const MAX_MS   = 4.5 * 60 * 1000;
  const props    = PropertiesService.getScriptProperties();
  const hoy      = Utilities.formatDate(new Date(), "America/Mexico_City", "yyyy-MM-dd");
  const existFilter = "3"; // solo con stock (suc o cedis)

  if (props.getProperty("HISTORIAL_ULTIMO_DIA") === hoy) {
    return { ok: true, articulos: 0, paginas: 0, fecha: hoy, mensaje: "Ya sincronizado hoy" };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return { ok: true, articulos: 0, paginas: 0, fecha: hoy, mensaje: "Otro sync en curso" };
  }

  try {
    let estado = {};
    try { estado = JSON.parse(props.getProperty("HIST_SYNC_ESTADO") || "{}"); } catch (e) { estado = {}; }
    if (estado.fecha !== hoy) {
      estado = { fecha: hoy, pagina: 1, totalPaginas: 0, articulos: 0, inicio: new Date().toISOString() };
    }

    const ss = SpreadsheetApp.openById(CFG.SHEET_ID);

    let shH = ss.getSheetByName("HISTORIAL_STOCK");
    if (!shH) {
      shH = ss.insertSheet("HISTORIAL_STOCK");
      shH.appendRow(["fecha","clave","descripcion","marca","grupo",
                     "precio","moneda","stock_suc","stock_cedis","en_transito"]);
      shH.setFrozenRows(1);
    }

    let shS = ss.getSheetByName("SYNC_CVA");
    if (!shS) {
      shS = ss.insertSheet("SYNC_CVA");
      shS.appendRow(["clave","descripcion","marca","grupo","precio","moneda",
                     "stock_suc","stock_cedis","en_transito","garantia",
                     "promo_precio","promo_vence","tipo_cambio","ts"]);
      shS.setFrozenRows(1);
    }

    // SYNC_CVA completo en memoria
    const lastRowS = shS.getLastRow();
    const filasOrig = lastRowS > 1 ? lastRowS - 1 : 0;
    const datos = filasOrig ? shS.getRange(2, 1, filasOrig, 14).getValues() : [];
    const indice = {};
    datos.forEach((r, i) => { if (r[0]) indice[String(r[0])] = i; });

    const historialRows = [];
    let fin = false;
    let paginasCorrida = 0;

    while (!fin) {
      if (Date.now() - START_MS > MAX_MS) break;
      if (estado.totalPaginas && estado.pagina > estado.totalPaginas) { fin = true; break; }

      let data;
      try {
        data = cvaFetch_("/catalogo_clientes/lista_precios", {
          batch      : "LG",          // 500 por pagina
          page       : estado.pagina,
          MonedaPesos: "true",
          porcentaje : CFG.MARGEN_DEFAULT, // 16 = IVA
          tc         : "true",
          exist      : existFilter,
        });
      } catch (e) {
        const msg = e.message || "";
        if (msg.indexOf("404") >= 0 || msg.indexOf("No se encontraron") >= 0) { fin = true; break; }
        // Error real: NO se salta la pagina. La siguiente corrida la reintenta.
        logSheet_("SYNC_LOG", ["SYNC_ERROR", estado.articulos, "pag " + estado.pagina + ": " + msg.substring(0, 150)]);
        break;
      }

      if (!data || data.message === "No se encontraron productos.") { fin = true; break; }
      if (data.paginacion && data.paginacion.total_paginas) estado.totalPaginas = data.paginacion.total_paginas;

      const ts = new Date().toISOString();
      (data.articulos || []).forEach(a => {
        const suc = parseFloat(a.disponible) || 0;
        const ced = parseFloat(a.disponibleCD) || 0;
        if (suc <= 0 && ced <= 0) return;
        const clave = String(a.clave || "");
        if (!clave) return;

        const idx = indice[clave];
        // Ya visto en este ciclo (la paginacion de CVA se recorre entre corridas)
        if (idx !== undefined && String(datos[idx][13] || "") >= estado.inicio) return;

        const promo = a.promociones || null;
        const fila = [
          clave, a.descripcion || "", a.marca || "", a.grupo || "",
          a.precio || 0, a.moneda || "Pesos",
          suc, ced, a.en_transito || 0,
          a.garantia || "",
          promo ? (promo.precio_descuento || "") : "",
          promo ? (promo.promocion_vencimiento || "") : "",
          a.tipo_cambio || "", ts,
        ];
        if (idx !== undefined) datos[idx] = fila;
        else { indice[clave] = datos.length; datos.push(fila); }

        historialRows.push([hoy, clave, "", "", a.grupo || "",
                            a.precio || 0, a.moneda || "Pesos",
                            suc, ced, a.en_transito || 0]);
        estado.articulos++;
      });

      estado.pagina++;
      paginasCorrida++;
      if (estado.totalPaginas && estado.pagina > estado.totalPaginas) fin = true;
    }

    // Cierre del dia: lo que CVA no mando en todo el ciclo se agoto
    let agotados = 0;
    if (fin) {
      datos.forEach(r => {
        if (!r[0]) return;
        const visto = String(r[13] || "") >= estado.inicio;
        if (!visto && ((parseFloat(r[6]) || 0) > 0 || (parseFloat(r[7]) || 0) > 0)) {
          r[6] = 0; r[7] = 0; r[8] = 0;
          agotados++;
        }
      });
    }

    // Escrituras en bloque: primero los datos, al final el estado
    if (datos.length) shS.getRange(2, 1, datos.length, 14).setValues(datos);
    if (historialRows.length) {
      shH.getRange(shH.getLastRow() + 1, 1, historialRows.length, 10).setValues(historialRows);
    }
    SpreadsheetApp.flush();

    if (fin) {
      props.setProperty("HISTORIAL_ULTIMO_DIA", hoy);
      props.deleteProperty("HIST_SYNC_ESTADO");
      logSheet_("SYNC_LOG", ["SYNC_DIARIO_COMPLETO", estado.articulos,
                              "paginas:" + (estado.totalPaginas || estado.pagina - 1),
                              "fecha:" + hoy + " agotados:" + agotados]);
      try { _actualizarControlSync_(props, 1, estado.articulos, "DIARIO_OK"); } catch (e) {}
    } else {
      props.setProperty("HIST_SYNC_ESTADO", JSON.stringify(estado));
      logSheet_("SYNC_LOG", ["SYNC_DIARIO_PARCIAL", estado.articulos,
                              "sigue en pag " + estado.pagina + " de " + (estado.totalPaginas || "?"),
                              "fecha:" + hoy]);
    }

    return {
      ok: true, completo: fin, articulos: estado.articulos,
      paginas: estado.totalPaginas || 0, paginas_corrida: paginasCorrida,
      agotados: agotados, fecha: hoy,
      mensaje: fin ? "Snapshot del dia completo" : "Parcial: continua en la siguiente corrida (pag " + estado.pagina + ")",
    };
  } finally {
    lock.releaseLock();
  }
}

// ── ANÁLISIS DE MOVIMIENTO DE STOCK ──────────────────────────
// ── ANÁLISIS COMPLETO DE MOVIMIENTO ──────────────────────────
// Devuelve TODOS los productos con métricas ricas:
// - Stock actual vs cada snapshot histórico
// - Movimiento total entre snapshot inicial y hoy
// - Promedio diario, semanal, mensual
// - Días en el periodo de análisis
// - Tendencia (creciente/decreciente/estable)
// El frontend filtra, ordena y pagina; el backend solo entrega data limpia.
// Calcula movimiento dentro de un periodo configurable
// opts = { dias_atras: 30, fecha_desde: "YYYY-MM-DD", fecha_hasta: "YYYY-MM-DD" }
// Si no se pasa nada, usa los últimos 30 días por default
// Encuentra el snapshot disponible más cercano a una fecha objetivo
// Prefiere el más antiguo (anterior o igual a target) para ver "stock hace X días"
function _encontrarSnapshotCercano(fechasOrdenadas, target) {
  if (!fechasOrdenadas || fechasOrdenadas.length === 0) return null;
  const targetDate = new Date(target);

  // Buscar el más reciente ANTES o IGUAL a target
  let mejor = null;
  for (let i = 0; i < fechasOrdenadas.length; i++) {
    const f = fechasOrdenadas[i];
    const d = new Date(f);
    if (d <= targetDate) mejor = f;
    else break;
  }
  // Si no hay ninguno antes, usar el más antiguo disponible
  if (!mejor) mejor = fechasOrdenadas[0];
  return mejor;
}

function _fechaTxt_(v) {
  if (!v) return "";
  if (v instanceof Date) return Utilities.formatDate(v, "America/Mexico_City", "yyyy-MM-dd");
  const t = String(v).substring(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(v);
  return isNaN(d) ? "" : Utilities.formatDate(d, "America/Mexico_City", "yyyy-MM-dd");
}

// Primera fila (numero de fila de la hoja) del historial que hay que leer
function _filaInicioHistorial_(shH, nFil, opts) {
  const o = opts || {};
  let base;
  if (o.fecha_desde) base = new Date(o.fecha_desde);
  else { base = new Date(); base.setDate(base.getDate() - (parseInt(o.dias_atras) || 30)); }
  base.setDate(base.getDate() - 10);
  const corte = Utilities.formatDate(base, "America/Mexico_City", "yyyy-MM-dd");
  const colA = shH.getRange(2, 1, nFil, 1).getValues();
  for (let i = 0; i < colA.length; i++) {
    const f = _fechaTxt_(colA[i][0]);
    if (f && f >= corte) return i + 2;
  }
  return 2;
}

function getAnalisisMovimiento(opts) {
  try {
    const ss   = SpreadsheetApp.openById(CFG.SHEET_ID);
    const shH  = ss.getSheetByName("HISTORIAL_STOCK");
    const shS  = ss.getSheetByName("SYNC_CVA");

    if (!shS || shS.getLastRow() < 2) {
      return { ok: true, sin_datos: true, mensaje: "SYNC_CVA vacío" };
    }

    // ── Stock actual desde SYNC_CVA ─────────────────────────
    const syncData = shS.getRange(2, 1, shS.getLastRow() - 1, 14).getValues();
    const stockActual = {};
    syncData.forEach(r => {
      if (!r[0]) return;
      stockActual[r[0]] = {
        clave : r[0], desc: r[1], marca: r[2], grupo: r[3],
        precio: parseFloat(r[4]) || 0, moneda: r[5] || "Pesos",
        suc   : parseFloat(r[6]) || 0, cedis: parseFloat(r[7]) || 0,
        en_transito: parseFloat(r[8]) || 0,
        total : (parseFloat(r[6]) || 0) + (parseFloat(r[7]) || 0),
      };
    });

    // ── Snapshots históricos por fecha ──────────────────────
    const porFecha = {};            // { fecha: { clave: stock_total } }
    const productosPorFecha = {};   // { fecha: count } — para detectar snapshots rotos

    if (shH && shH.getLastRow() > 1) {
      const numCols = shH.getLastColumn();
      // Solo el tramo que sirve: desde ~10 dias antes del inicio del periodo.
      // El historial se escribe en orden de fecha, asi que se busca la primera
      // fila con fecha >= corte leyendo solo la columna A.
      const nFil = shH.getLastRow() - 1;
      const filaIni = _filaInicioHistorial_(shH, nFil, opts);
      const histData = shH.getRange(filaIni, 1, nFil - filaIni + 2, Math.min(numCols, 10)).getValues();
      histData.forEach(r => {
        let fecha = null;
        if (r[0]) {
          if (r[0] instanceof Date) {
            fecha = Utilities.formatDate(r[0], "America/Mexico_City", "yyyy-MM-dd");
          } else {
            fecha = String(r[0]).substring(0, 10);
            // Validar formato ISO yyyy-MM-dd, si no, intentar parsear
            if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
              const d = new Date(r[0]);
              if (!isNaN(d)) fecha = Utilities.formatDate(d, "America/Mexico_City", "yyyy-MM-dd");
            }
          }
        }
        const clave = r[1];
        if (!fecha || !clave) return;
        if (!porFecha[fecha]) porFecha[fecha] = {};
        const tieneGrupo = typeof r[4] === "string" && isNaN(parseFloat(r[4]));
        const stockSuc  = tieneGrupo ? (parseFloat(r[7]) || 0) : (parseFloat(r[6]) || 0);
        const stockCedis = tieneGrupo ? (parseFloat(r[8]) || 0) : (parseFloat(r[7]) || 0);
        porFecha[fecha][clave] = stockSuc + stockCedis;
        productosPorFecha[fecha] = (productosPorFecha[fecha] || 0) + 1;
      });
    }

    // Filtrar solo snapshots VÁLIDOS (>1000 productos)
    const fechasValidas = Object.keys(porFecha)
      .filter(f => productosPorFecha[f] >= 1000)
      .sort(); // ascendente: más antiguo primero

    // ── Selección de periodo de comparación ──────────────────
    // opts puede traer:
    //   dias_atras: número (7, 30, 90, 365)
    //   fecha_desde: "YYYY-MM-DD" (override exacto)
    //   fecha_hasta: "YYYY-MM-DD" (default = hoy)
    const o = opts || {};
    const diasAtras = parseInt(o.dias_atras) || 30; // default 30 días

    let diasPeriodo = 0;
    let fechaInicio = null;
    let fechaFin    = Utilities.formatDate(new Date(), "America/Mexico_City", "yyyy-MM-dd");
    if (o.fecha_hasta) fechaFin = o.fecha_hasta;

    if (fechasValidas.length > 0) {
      if (o.fecha_desde) {
        // Buscar el snapshot más cercano a fecha_desde
        fechaInicio = _encontrarSnapshotCercano(fechasValidas, o.fecha_desde);
      } else {
        // Buscar el snapshot más cercano a (hoy - diasAtras)
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - diasAtras);
        const target = Utilities.formatDate(targetDate, "America/Mexico_City", "yyyy-MM-dd");
        fechaInicio = _encontrarSnapshotCercano(fechasValidas, target);
      }
      const d1 = new Date(fechaInicio);
      const d2 = new Date(fechaFin);
      diasPeriodo = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
    }

    const stockHistorialBase = fechaInicio ? porFecha[fechaInicio] : {};

    // ── Construir productos con métricas ricas ──────────────
    const productos = [];
    Object.values(stockActual).forEach(p => {
      const stockBase = stockHistorialBase[p.clave];
      const tieneBase = stockBase !== undefined;
      const movido = tieneBase ? Math.max(0, stockBase - p.total) : null;

      // Movimiento por cada snapshot — para ver tendencia
      const trazas = [];
      fechasValidas.forEach(f => {
        if (porFecha[f] && porFecha[f][p.clave] !== undefined) {
          trazas.push({ fecha: f, stock: porFecha[f][p.clave] });
        }
      });
      trazas.push({ fecha: fechaFin, stock: p.total });

      // Promedios
      const promDiario   = movido && diasPeriodo > 0 ? +(movido / diasPeriodo).toFixed(2) : 0;
      const promSemanal  = +(promDiario * 7).toFixed(1);
      const promMensual  = +(promDiario * 30).toFixed(1);

      // Días que durará el stock actual al ritmo de venta promedio
      const diasRestantes = promDiario > 0 ? Math.floor(p.total / promDiario) : null;

      productos.push({
        clave: p.clave,
        desc : p.desc,
        marca: p.marca,
        grupo: p.grupo,
        precio: p.precio,
        moneda: p.moneda,
        suc   : p.suc,
        cedis : p.cedis,
        en_transito: p.en_transito,
        total : p.total,
        stock_base : tieneBase ? stockBase : null,
        movido     : movido,
        prom_diario : promDiario,
        prom_semanal: promSemanal,
        prom_mensual: promMensual,
        dias_restantes: diasRestantes,
        valor_movido  : movido !== null ? +(movido * p.precio).toFixed(2) : null,
        valor_inventario: +(p.total * p.precio).toFixed(2),
        trazas: trazas,
        tiene_movimiento: movido !== null && movido > 0,
        agotado: p.total === 0,
        agotado_recientemente: p.total === 0 && tieneBase && stockBase > 0,
      });
    });

    // ── Productos del historial que YA NO están en SYNC_CVA (descatalogados/agotados) ──
    Object.keys(stockHistorialBase).forEach(clave => {
      if (stockActual[clave]) return; // ya está
      const stockAntes = stockHistorialBase[clave];
      if (stockAntes <= 0) return;
      productos.push({
        clave, desc: "(producto descontinuado)", marca: "", grupo: "",
        precio: 0, moneda: "Pesos",
        suc: 0, cedis: 0, en_transito: 0, total: 0,
        stock_base: stockAntes, movido: stockAntes,
        prom_diario : +(stockAntes / diasPeriodo).toFixed(2),
        prom_semanal: +(stockAntes * 7 / diasPeriodo).toFixed(1),
        prom_mensual: +(stockAntes * 30 / diasPeriodo).toFixed(1),
        dias_restantes: 0, valor_movido: 0, valor_inventario: 0,
        trazas: [{ fecha: fechaInicio, stock: stockAntes }, { fecha: fechaFin, stock: 0 }],
        tiene_movimiento: true, agotado: true, agotado_recientemente: true,
      });
    });

    // ── Agregaciones por marca/grupo ────────────────────────
    const porMarca = {};
    const porGrupo = {};
    productos.forEach(p => {
      if (p.marca) {
        if (!porMarca[p.marca]) porMarca[p.marca] = {
          marca: p.marca, movido: 0, productos: 0, stock_total: 0, valor_movido: 0
        };
        porMarca[p.marca].movido      += (p.movido || 0);
        porMarca[p.marca].productos   += 1;
        porMarca[p.marca].stock_total += p.total;
        porMarca[p.marca].valor_movido += (p.valor_movido || 0);
      }
      if (p.grupo) {
        if (!porGrupo[p.grupo]) porGrupo[p.grupo] = {
          grupo: p.grupo, movido: 0, productos: 0, stock_total: 0, valor_movido: 0
        };
        porGrupo[p.grupo].movido      += (p.movido || 0);
        porGrupo[p.grupo].productos   += 1;
        porGrupo[p.grupo].stock_total += p.total;
        porGrupo[p.grupo].valor_movido += (p.valor_movido || 0);
      }
    });

    // ── KPIs ────────────────────────────────────────────────
    const conMovimiento  = productos.filter(p => p.tiene_movimiento);
    const sinMovimiento  = productos.filter(p => !p.tiene_movimiento && p.total > 0);
    const agotadosRec    = productos.filter(p => p.agotado_recientemente);
    const totalMovido    = conMovimiento.reduce((s, p) => s + (p.movido || 0), 0);
    const valorTotalMov  = conMovimiento.reduce((s, p) => s + (p.valor_movido || 0), 0);
    const valorInventario = productos.reduce((s, p) => s + (p.valor_inventario || 0), 0);

    return {
      ok: true,
      periodo: {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        dias: diasPeriodo,
        snapshots_validos: fechasValidas.length,
        fechas_disponibles: fechasValidas,
      },
      kpis: {
        total_productos      : productos.length,
        productos_activos    : productos.filter(p => p.total > 0).length,
        con_movimiento       : conMovimiento.length,
        sin_movimiento       : sinMovimiento.length,
        agotados_recientes   : agotadosRec.length,
        unidades_movidas     : totalMovido,
        valor_movido_mxn     : +valorTotalMov.toFixed(2),
        valor_inventario_mxn : +valorInventario.toFixed(2),
        promedio_diario_total: +(totalMovido / diasPeriodo).toFixed(1),
        marcas_activas       : Object.keys(porMarca).length,
        grupos_activos       : Object.keys(porGrupo).length,
      },
      productos: productos,
      marcas: Object.values(porMarca).sort((a, b) => b.movido - a.movido),
      grupos: Object.values(porGrupo).sort((a, b) => b.movido - a.movido),
    };

  } catch(e) {
    return { ok: false, error: e.message };
  }
}


// ════════════════════════════════════════════════════════════════
//  SKU_INVENTARIO — endpoints para la sección de la PWA
//
//  La hoja la maneja sheets_menu.gs (se crea automáticamente al
//  importar UPCs). Estas funciones permiten que la PWA lea/escriba.
//
//  Estructura de la hoja:
//   A=UPC  B=Categoría  C=Marca  D=Nombre completo
//   E=Modelo  F=Color  G=SKU  H=Clave CVA  I=Precio MELI
//   J=Stock CVA  K=Stock para Odoo
//   N2 = % Global
// ════════════════════════════════════════════════════════════════

function invOdooSheet_() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  return ss.getSheetByName("SKU_INVENTARIO");
}

function invOdooList() {
  const sh = invOdooSheet_();
  if (!sh) return { ok: false, error: "Hoja SKU_INVENTARIO no existe. Importa UPCs primero desde el menú del sheet." };
  const last = _ultimaFilaSKUInventario_(sh);
  // Config global: W2 = % global, W3 = TC USD→MXN
  const pctGlobal = parseFloat(sh.getRange("W2").getValue()) || 20;
  let tcGlobal    = parseFloat(sh.getRange("W3").getValue()) || 0;
  // Si W3 no tiene valor (instalación antigua), auto-crearlo
  if (tcGlobal < 1) {
    sh.getRange("W3").setValue(17.50).setNumberFormat("$0.00");
    tcGlobal = 17.50;
  }
  const items = [];
  if (last >= 2) {
    const data = sh.getRange(2, 1, last - 1, 20).getValues();
    data.forEach((r, i) => {
      const clave = String(r[7] || "").trim();
      if (!clave) return;
      items.push({
        fila:           i + 2,
        upc:            String(r[0] || "").trim(),
        categoria:      String(r[1] || "").trim(),
        marca:          String(r[2] || "").trim(),
        nombre:         String(r[3] || "").trim(),
        modelo:         String(r[4] || "").trim(),
        color:          String(r[5] || "").trim(),
        sku:            String(r[6] || "").trim(),
        clave:          clave,
        precio_cva:     parseFloat(r[8])  || 0,
        precio_meli:    parseFloat(r[9])  || 0,
        stock_cva:      parseFloat(r[10]) || 0,
        stock_odoo:     parseFloat(r[11]) || 0,
        peso_kg:        parseFloat(r[12]) || 0,
        alto_cm:        parseFloat(r[13]) || 0,
        ancho_cm:       parseFloat(r[14]) || 0,
        profundidad_cm: parseFloat(r[15]) || 0,
        emp_alto_cm:    parseFloat(r[16]) || 0,
        emp_ancho_cm:   parseFloat(r[17]) || 0,
        emp_prof_cm:    parseFloat(r[18]) || 0,
        emp_peso_kg:    parseFloat(r[19]) || 0,
      });
    });
  }
  return { ok: true, pct_global: pctGlobal, tc_global: tcGlobal, items: items, total: items.length };
}

// Helper: última fila con clave real en SKU_INVENTARIO (col H).
// getLastRow se infla a 1000 por las ARRAYFORMULAS — esta función lo evita.
function _ultimaFilaSKUInventario_(sh) {
  const colH = sh.getRange("H2:H").getValues();
  for (let i = colH.length - 1; i >= 0; i--) {
    const v = colH[i][0];
    if (v !== "" && v !== null && v !== undefined) {
      return i + 2;
    }
  }
  return 1;
}

function invOdooAdd(claves) {
  return {
    ok: false,
    error: "El inventario se llena automáticamente desde SKU_INVENTARIO.\n\nPara agregar productos: importa sus UPCs vía la hoja UPC_IMPORT."
  };
}

function invOdooRemove(clave) {
  return {
    ok: false,
    error: "El inventario se llena automáticamente desde SKU_INVENTARIO.\n\nPara quitar un producto: bórralo de la hoja SKU_INVENTARIO."
  };
}

function invOdooSetPct(clave, pct) {
  return {
    ok: false,
    error: "El % override individual fue eliminado en el rediseño. Ahora solo se usa el % Global (afecta a todos)."
  };
}

function invOdooSetGlobalPct(pct) {
  const sh = invOdooSheet_();
  if (!sh) return { ok: false, error: "Hoja no existe" };
  const n = parseFloat(pct);
  if (isNaN(n) || n < 0 || n > 100) return { ok: false, error: "% inválido (0-100)" };
  sh.getRange("W2").setValue(n);
  SpreadsheetApp.flush();
  return { ok: true, pct_global: n };
}

// TC global USD→MXN (configurable). Default 17.50.
function invOdooSetGlobalTC(tc) {
  const sh = invOdooSheet_();
  if (!sh) return { ok: false, error: "Hoja no existe" };
  const n = parseFloat(tc);
  if (isNaN(n) || n < 1 || n > 100) return { ok: false, error: "TC inválido (1-100)" };
  sh.getRange("W3").setValue(n).setNumberFormat("$0.00");
  SpreadsheetApp.flush();
  return { ok: true, tc_global: n };
}

// ════════════════════════════════════════════════════════════════
//  ENRIQUECER PESOS DESDE CVA
//
//  Recorre SKU_INVENTARIO, para cada producto consulta el endpoint
//  /catalogo_clientes/informacion_tecnica de CVA, extrae las
//  dimensiones (peso en KG), mapea al rango MELI ("Hasta 0.5 Kg" etc.)
//  y guarda en METADATA_PRODUCTOS col H (peso).
//
//  La fórmula del Precio MELI ya lee METADATA.peso vía VLOOKUP, así
//  que después de ejecutar esto, todos los precios MELI se recalculan
//  con el costo de envío correcto.
//
//  Parámetro:
//   forzar = true → consultar TODOS, incluso los que ya tienen peso
//   forzar = false → solo los que tienen peso vacío en METADATA
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
//  enriquecerPesosDesdeCVA — VERSIÓN PAGINACIÓN MASIVA (rápida)
//
//  En vez de consultar producto por producto (lento, ~30 min para 800
//  productos), recorre el catálogo CVA en lotes de 500 con dimen=true.
//  Termina en ~15-30 segundos para todo el catálogo.
//
//  Solo escribe en METADATA_PRODUCTOS — las cols M-P de SKU_INVENTARIO
//  son ARRAYFORMULA que leen METADATA dinámicamente.
//
//  Parámetro:
//    forzar = true → procesa TODOS, incluso los que ya tienen peso
//    forzar = false → solo los que no tienen peso_kg + alto
// ════════════════════════════════════════════════════════════════
function enriquecerPesosDesdeCVA(forzar) {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const shSKU = ss.getSheetByName("SKU_INVENTARIO");
  const shMD  = ss.getSheetByName("METADATA_PRODUCTOS");
  if (!shSKU) return { ok: false, error: "Hoja SKU_INVENTARIO no existe" };
  if (!shMD)  return { ok: false, error: "Hoja METADATA_PRODUCTOS no existe" };

  // Asegurar que METADATA tenga 13 columnas
  let lastColMD = shMD.getLastColumn();
  if (lastColMD < 13) {
    const headersExtra = ["peso_kg", "alto_cm", "ancho_cm", "profundidad_cm"];
    const faltan = 13 - lastColMD;
    shMD.getRange(1, lastColMD + 1, 1, faltan)
      .setValues([headersExtra.slice(0, faltan)])
      .setFontWeight("bold").setBackground("#00665e").setFontColor("#ffffff");
    lastColMD = 13;
  }

  // 1) Leer claves activas en SKU_INVENTARIO (col H)
  const skuLast = _ultimaFilaSKUInventario_(shSKU);
  if (skuLast < 2) return { ok: false, error: "SKU_INVENTARIO no tiene productos" };
  const colH = shSKU.getRange(2, 8, skuLast - 1, 1).getValues();
  const clavesNecesarias = new Set();
  colH.forEach(r => {
    const v = String(r[0] || "").trim();
    if (v) clavesNecesarias.add(v);
  });
  if (clavesNecesarias.size === 0) return { ok: false, error: "Sin claves" };

  // 2) Leer METADATA — índice + datos actuales
  const mdLast = shMD.getLastRow();
  if (mdLast < 2) return { ok: false, error: "METADATA_PRODUCTOS vacío" };
  const mdData = shMD.getRange(2, 1, mdLast - 1, 13).getValues();
  const mdIdx = {};
  const yaTieneDatos = new Set();
  mdData.forEach((r, i) => {
    const k = String(r[0] || "").trim();
    if (k) {
      mdIdx[k] = i + 2;
      const pesoKg = r[9];
      const alto   = r[10];
      if (pesoKg && alto) yaTieneDatos.add(k);
    }
  });

  // 3) Recorrer catálogo CVA en lotes de 500 con dimen=true
  const START_MS = Date.now();
  const MAX_MS = 3.5 * 60 * 1000;   // 3.5 min — GAS HTTP fetch timeout es ~5 min
  let pagina = 1;
  let totalPaginas = 999;
  let okCount = 0, sinDim = 0;
  const encontrados = new Set();
  const noNecesitaban = new Set();   // ya tenían datos y no forzamos
  const updates = [];   // [{fila, valores}]

  while (pagina <= totalPaginas) {
    if (Date.now() - START_MS > MAX_MS) {
      Logger.log("[ENRIQUECER MASIVO] Tiempo agotado en pág " + pagina);
      break;
    }

    let data;
    try {
      data = cvaFetch_("/catalogo_clientes/lista_precios", {
        batch: "LG", page: pagina,
        dimen: "true", MonedaPesos: "true",
      });
    } catch(e) {
      const msg = String(e.message || "");
      if (msg.indexOf("404") >= 0 || msg.indexOf("No se encontraron") >= 0) break;
      Logger.log("[ENRIQUECER MASIVO] Error pág " + pagina + ": " + msg);
      pagina++;
      continue;
    }

    if (!data || data.message === "No se encontraron productos.") break;
    if (data.paginacion) totalPaginas = data.paginacion.total_paginas;
    const articulos = data.articulos || [];
    if (articulos.length === 0) break;

    articulos.forEach(prod => {
      const clave = String(prod.clave || "").trim();
      if (!clave || !clavesNecesarias.has(clave)) return;
      encontrados.add(clave);

      // Si ya tiene datos y no forzamos, saltar
      if (!forzar && yaTieneDatos.has(clave)) {
        noNecesitaban.add(clave);
        return;
      }

      const dim = prod.dimensiones || prod.dimensions || {};
      let pesoNum = parseFloat(dim.peso || dim.weight || 0);
      const unidad = String(dim.unidad_peso || dim.weight_unit || "KG").toUpperCase().trim();
      if (unidad === "G" || unidad === "GR" || unidad === "GRS") pesoNum = pesoNum / 1000;
      if (unidad === "LB" || unidad === "LBS") pesoNum = pesoNum * 0.453592;

      let altoM   = parseFloat(dim.alto || dim.height || 0);
      let anchoM  = parseFloat(dim.ancho || dim.width  || 0);
      let profM   = parseFloat(dim.profundidad || dim.depth || dim.deep || 0);

      const maxDim = Math.max(altoM, anchoM, profM);
      const factor = (maxDim > 0 && maxDim < 5) ? 100 : 1;
      const altoCm  = +(altoM  * factor).toFixed(2);
      const anchoCm = +(anchoM * factor).toFixed(2);
      const profCm  = +(profM  * factor).toFixed(2);
      const pesoKg  = +pesoNum.toFixed(4);

      if (pesoNum <= 0 && altoM <= 0 && anchoM <= 0 && profM <= 0) {
        sinDim++;
        return;
      }

      const rangoMELI = _mapearPesoKgARangoMELI_(pesoNum);
      const filaMD = mdIdx[clave];
      if (filaMD) {
        updates.push({
          fila: filaMD,
          valores: [rangoMELI, new Date(), pesoKg, altoCm, anchoCm, profCm],
        });
        okCount++;
      }
    });

    Logger.log("[ENRIQUECER MASIVO] Pág " + pagina + "/" + totalPaginas +
               " · encontrados=" + encontrados.size + "/" + clavesNecesarias.size +
               " · actualizados=" + okCount);
    pagina++;
  }

  // 4) Aplicar updates a METADATA en batch
  updates.forEach(u => {
    shMD.getRange(u.fila, 8, 1, 6).setValues([u.valores]);  // H-M
  });
  SpreadsheetApp.flush();

  const duracion = Math.round((Date.now() - START_MS) / 1000);
  Logger.log("[ENRIQUECER MASIVO] OK en " + duracion + "s · " + okCount + " actualizados");

  return {
    ok: true,
    total_productos:   clavesNecesarias.size,
    consultadas:       encontrados.size,
    actualizadas:      okCount,
    saltadas:          noNecesitaban.size,
    sin_dimensiones:   sinDim,
    no_encontradas:    clavesNecesarias.size - encontrados.size,
    paginas:           pagina - 1,
    duracion_seg:      duracion,
    errores:           0,
    sku_propagadas:    0,    // SKU se llena vía ARRAYFORMULA, no propagación directa
    detalle_errores:   [],
  };
}

// ════════════════════════════════════════════════════════════════
//  recalcularDimensionesEnSKU — copia METADATA → SKU_INVENTARIO
//
//  Útil cuando ya tienes datos en METADATA pero SKU_INVENTARIO está
//  vacío en cols M-P. No llama a CVA, no borra nada — solo copia
//  donde SKU está vacío.
//
//  Es la operación que ejecutas DESPUÉS de "Enriquecer pesos" si
//  necesitas re-propagar a SKU sin volver a consultar CVA.
// ════════════════════════════════════════════════════════════════
function recalcularDimensionesEnSKU(forzar) {
  // NOTA: las cols M, N, O, P de SKU_INVENTARIO ahora son ARRAYFORMULA
  // que leen METADATA dinámicamente. Esta función ya NO escribe valores
  // estáticos. Solo valida que las ARRAYFORMULA estén aplicadas y reporta
  // cuántos productos tienen dimensiones en METADATA.
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const shSKU = ss.getSheetByName("SKU_INVENTARIO");
  const shMD  = ss.getSheetByName("METADATA_PRODUCTOS");
  if (!shSKU) return { ok: false, error: "Hoja SKU_INVENTARIO no existe" };
  if (!shMD)  return { ok: false, error: "Hoja METADATA_PRODUCTOS no existe" };

  // Verificar que las ARRAYFORMULA de M-P estén aplicadas
  const formulasARequerir = {
    M2: '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,10,FALSE),"")))',
    N2: '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,11,FALSE),"")))',
    O2: '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,12,FALSE),"")))',
    P2: '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,13,FALSE),"")))',
  };
  let reaplicadas = 0;
  Object.keys(formulasARequerir).forEach(celda => {
    const f = shSKU.getRange(celda).getFormula();
    if (!f || f.indexOf("ARRAYFORMULA") < 0) {
      shSKU.getRange(celda).setFormula(formulasARequerir[celda]);
      reaplicadas++;
    }
  });

  // Contar cuántos productos tienen dimensiones en METADATA
  const mdLast = shMD.getLastRow();
  let conDims = 0, sinDims = 0;
  if (mdLast >= 2) {
    const mdData = shMD.getRange(2, 10, mdLast - 1, 4).getValues(); // J,K,L,M
    mdData.forEach(r => {
      if (r[0] || r[1] || r[2] || r[3]) conDims++;
      else sinDims++;
    });
  }

  SpreadsheetApp.flush();

  return {
    ok: true,
    arrayformulas_reaplicadas: reaplicadas,
    productos_con_dimensiones_md: conDims,
    productos_sin_dimensiones_md: sinDims,
    nota: "M-P son ARRAYFORMULA que leen METADATA automáticamente. Para actualizar valores: ejecuta 'Re-enriquecer pesos LOCAL' o edita METADATA directamente.",
  };
}
// Mapea peso en KG → string del rango MELI EXACTO (debe coincidir con CONFIG_MELI)
function _mapearPesoKgARangoMELI_(kg) {
  if (kg <= 0)    return "";
  if (kg <= 0.5)  return "Hasta 0.5 Kg";
  if (kg <= 1)    return "0.5 a 1 Kg";
  if (kg <= 2)    return "1 a 2 kg";
  if (kg <= 3)    return "2 a 3 kg";
  if (kg <= 5)    return "3 a 5 kg";
  if (kg <= 7)    return "5 a 7 kg";
  if (kg <= 9)    return "7 a 9 kg";
  if (kg <= 12)   return "9 a 12 kg";
  if (kg <= 15)   return "12 a 15 kg";
  if (kg <= 20)   return "15 a 20 kg";
  if (kg <= 30)   return "20 a 30 kg";
  if (kg <= 40)   return "30 a 40 kg";
  if (kg <= 50)   return "40 a 50 kg";
  return "50 a 60 kg";
}

// ════════════════════════════════════════════════════════════════
//  METADATA endpoints — leer/escribir METADATA_PRODUCTOS desde la PWA
//
//  Estructura METADATA_PRODUCTOS:
//    A clave_cva, B marca, C modelo, D color, E upc, F ganancia,
//    G cat_meli, H peso (rango), I editado_at,
//    J peso_kg, K alto_cm, L ancho_cm, M profundidad_cm
//
//  Key usada por la PWA: "MARCA-CLAVE" en mayúsculas.
//  ════════════════════════════════════════════════════════════════

function metadataGet() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const sh = ss.getSheetByName("METADATA_PRODUCTOS");
  if (!sh) return { ok: true, metadata: {}, total: 0 };
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, metadata: {}, total: 0 };

  const data = sh.getRange(2, 1, last - 1, 13).getValues();
  const metadata = {};
  data.forEach(r => {
    const clave = String(r[0] || "").trim();
    const marca = String(r[1] || "").trim().toUpperCase();
    if (!clave) return;
    const key = marca + "-" + clave;
    metadata[key] = {
      clave:        clave,
      marca:        r[1] || "",
      modelo:       r[2] || "",
      color:        r[3] || "",
      upc:          r[4] ? String(r[4]) : "",
      ganancia:     r[5] !== "" && r[5] != null ? parseFloat(r[5]) : null,
      cat_meli:     r[6] || "",
      peso:         r[7] || "",
      editado_at:   r[8] ? (r[8] instanceof Date ? r[8].toISOString() : String(r[8])) : "",
      peso_kg:      r[9]  !== "" && r[9]  != null ? parseFloat(r[9])  : null,
      alto_cm:      r[10] !== "" && r[10] != null ? parseFloat(r[10]) : null,
      ancho_cm:     r[11] !== "" && r[11] != null ? parseFloat(r[11]) : null,
      profundidad_cm: r[12] !== "" && r[12] != null ? parseFloat(r[12]) : null,
    };
  });
  return { ok: true, metadata: metadata, total: Object.keys(metadata).length };
}

// Guarda uno o varios cambios. Acepta dos formatos:
//   Formato A (un update): { clave, marca, modelo, color, upc, ganancia, cat_meli, peso }
//   Formato B (batch):     { updates: [ {clave, marca, ...}, ... ] }
function metadataSet(params) {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const sh = ss.getSheetByName("METADATA_PRODUCTOS");
  if (!sh) {
    return { ok: false, error: "Hoja METADATA_PRODUCTOS no existe. Crea las hojas desde el menú del Sheet." };
  }

  // Normalizar a array de updates
  let updates = [];
  if (params.updates) {
    try { updates = typeof params.updates === "string" ? JSON.parse(params.updates) : params.updates; }
    catch(e) { return { ok: false, error: "updates inválido: " + e.message }; }
  } else {
    updates = [params];
  }
  if (!Array.isArray(updates) || updates.length === 0) {
    return { ok: false, error: "Sin updates" };
  }

  // Leer estado actual de METADATA
  const lastRow = sh.getLastRow();
  let mdData = [];
  const mdIdx = {};   // "MARCA-CLAVE" → fila (1-indexed)
  if (lastRow >= 2) {
    mdData = sh.getRange(2, 1, lastRow - 1, 13).getValues();
    mdData.forEach((r, i) => {
      const cl = String(r[0] || "").trim();
      const ma = String(r[1] || "").trim().toUpperCase();
      if (cl) mdIdx[ma + "-" + cl] = i + 2;
    });
  }

  // SKU_INVENTARIO — para sincronización opcional (si el producto está ahí, lo actualizamos)
  const shSKU = ss.getSheetByName("SKU_INVENTARIO");
  const skuIdx = {};   // clave → fila
  if (shSKU) {
    const skuLast = _ultimaFilaSKUInventario_ ? _ultimaFilaSKUInventario_(shSKU) : shSKU.getLastRow();
    if (skuLast >= 2) {
      const skuClaves = shSKU.getRange(2, 8, skuLast - 1, 1).getValues();  // col H
      skuClaves.forEach((r, i) => {
        const cl = String(r[0] || "").trim();
        if (cl) skuIdx[cl] = i + 2;
      });
    }
  }

  let actualizadas = 0;
  let insertadas = 0;
  let skuPropagadas = 0;
  const ahora = new Date();
  const aAgregar = [];

  updates.forEach(u => {
    const clave = String(u.clave || "").trim();
    const marca = String(u.marca || "").trim();
    if (!clave) return;
    const key = marca.toUpperCase() + "-" + clave;
    const fila = mdIdx[key];

    if (fila) {
      // UPDATE — solo los campos que vinieron
      const colsMap = {
        modelo:        3,
        color:         4,
        upc:           5,
        ganancia:      6,
        cat_meli:      7,
        peso:          8,
      };
      Object.keys(colsMap).forEach(campo => {
        if (Object.prototype.hasOwnProperty.call(u, campo)) {
          const valor = u[campo] === null || u[campo] === undefined ? "" : u[campo];
          sh.getRange(fila, colsMap[campo]).setValue(valor);
        }
      });
      sh.getRange(fila, 9).setValue(ahora);  // editado_at
      actualizadas++;

      // PROPAGAR a SKU_INVENTARIO si el producto vive ahí
      if (shSKU && skuIdx[clave]) {
        const skuRow = skuIdx[clave];
        if (Object.prototype.hasOwnProperty.call(u, "modelo")) {
          const modelo = String(u.modelo || "").trim().toUpperCase() || "SIN MODELO";
          shSKU.getRange(skuRow, 5).setValue(modelo);   // col E
        }
        if (Object.prototype.hasOwnProperty.call(u, "color")) {
          const color = String(u.color || "").trim().toUpperCase() || "NEGRO";
          shSKU.getRange(skuRow, 6).setValue(color);    // col F
        }
        skuPropagadas++;
      }
    } else {
      // INSERT — fila nueva en METADATA
      aAgregar.push([
        clave,
        marca,
        u.modelo || "",
        u.color  || "",
        u.upc    ? String(u.upc) : "",
        u.ganancia !== undefined && u.ganancia !== null ? u.ganancia : "",
        u.cat_meli || "",
        u.peso     || "",
        ahora,
        "", "", "", "",   // peso_kg, alto, ancho, profundidad (vacíos)
      ]);
      insertadas++;
    }
  });

  if (aAgregar.length > 0) {
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, aAgregar.length, 13).setValues(aAgregar);
  }

  SpreadsheetApp.flush();
  return {
    ok: true,
    actualizadas:     actualizadas,
    insertadas:       insertadas,
    sku_propagadas:   skuPropagadas,
  };
}

// ════════════════════════════════════════════════════════════════
//  Trigger onEdit — sincronización SKU_INVENTARIO → METADATA
//
//  Cuando el usuario edita las cols E (Modelo) o F (Color) de
//  SKU_INVENTARIO, este trigger lee la Clave CVA (col H) de esa fila
//  y actualiza la columna correspondiente en METADATA_PRODUCTOS.
//  Marca editado_at con la fecha actual.
// ════════════════════════════════════════════════════════════════
function onEditSKUInventario(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== "SKU_INVENTARIO") return;

  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row < 2) return;
  if (col !== 5 && col !== 6) return;   // Modelo (E) o Color (F)

  const ss = sh.getParent();
  const clave = String(sh.getRange(row, 8).getValue() || "").trim();
  if (!clave) return;
  const marca = String(sh.getRange(row, 3).getValue() || "").trim();
  if (!marca) return;

  const shMD = ss.getSheetByName("METADATA_PRODUCTOS");
  if (!shMD) return;

  // Buscar fila en METADATA por clave + marca
  const last = shMD.getLastRow();
  if (last < 2) return;
  const mdData = shMD.getRange(2, 1, last - 1, 2).getValues();
  let mdRow = null;
  for (let i = 0; i < mdData.length; i++) {
    if (String(mdData[i][0] || "").trim() === clave &&
        String(mdData[i][1] || "").trim().toUpperCase() === marca.toUpperCase()) {
      mdRow = i + 2;
      break;
    }
  }
  if (!mdRow) return;

  const valor = e.value !== undefined ? String(e.value).toUpperCase() : "";
  const targetCol = col === 5 ? 3 : 4;   // METADATA C (modelo) o D (color)
  shMD.getRange(mdRow, targetCol).setValue(valor);
  shMD.getRange(mdRow, 9).setValue(new Date());
}

function testDiagnosticoOdoo() {
  const props = PropertiesService.getScriptProperties();
  Logger.log('=== SCRIPT PROPERTIES ===');
  Logger.log('ODOO_USER: ' + JSON.stringify(props.getProperty('ODOO_USER')));
  Logger.log('ODOO_KEY: ' + JSON.stringify(props.getProperty('ODOO_KEY')));
  Logger.log('CFG.ODOO_DB: ' + CFG.ODOO_DB);
  Logger.log('CFG.ODOO_URL: ' + CFG.ODOO_URL);
  
  Logger.log('=== TEST AUTH ===');
  try {
    const uid = autenticarXMLRPC_();
    Logger.log('✅ UID: ' + uid);
    
    Logger.log('=== TEST BUSCAR VENTAS ===');
    const r = odooVentasPendientes({ limit: 5 });
    Logger.log('Ventas encontradas: ' + (r.ventas ? r.ventas.length : 0));
    if (r.ventas && r.ventas.length > 0) {
      Logger.log('Primera venta: ' + JSON.stringify(r.ventas[0]));
    }
    
    Logger.log('=== TEST BUSCAR PRODUCTO -CVA ===');
    const uid2 = autenticarXMLRPC_();
    const prods = odooExec_(uid2, 'product.product', 'search_read', 
      [[['default_code', '=like', '%-CVA']]], 
      { fields: ['default_code', 'name'], limit: 5 });
    Logger.log('Productos -CVA encontrados: ' + (prods ? prods.length : 0));
    if (prods && prods.length > 0) {
      Logger.log('Primer producto: ' + JSON.stringify(prods[0]));
    }
  } catch(e) {
    Logger.log('❌ ERROR: ' + e.message);
    Logger.log('Stack: ' + e.stack);
  }
}

function testDropshipDetalle() {
  const uid = autenticarXMLRPC_();
  Logger.log('UID: ' + uid);

  // 1. Productos -CVA
  const prodIds = odooExec_(uid, "product.product", "search", 
    [[["default_code", "=like", "%-CVA"]]], { limit: 5000 });
  Logger.log('1) Productos -CVA: ' + (prodIds ? prodIds.length : 0));

  // 2a. Líneas SIN filtro de estado (solo por producto)
  const lineIdsSinEstado = odooExec_(uid, "sale.order.line", "search",
    [[["product_id", "in", prodIds]]], { limit: 100 });
  Logger.log('2a) Lineas con esos productos (SIN filtro estado): ' + (lineIdsSinEstado ? lineIdsSinEstado.length : 0));

  // 2b. Líneas CON filtro de estado sale/done
  const lineIdsConEstado = odooExec_(uid, "sale.order.line", "search",
    [[["product_id", "in", prodIds], ["state", "in", ["sale", "done"]]]], { limit: 100 });
  Logger.log('2b) Lineas CON filtro estado sale/done: ' + (lineIdsConEstado ? lineIdsConEstado.length : 0));

  // 3. Si hay líneas sin estado, leer una para ver su estructura
  if (lineIdsSinEstado && lineIdsSinEstado.length > 0) {
    const linea = odooExec_(uid, "sale.order.line", "read", [[lineIdsSinEstado[0]]],
      { fields: ["order_id", "product_id", "state", "product_uom_qty"] });
    Logger.log('3) Ejemplo de linea: ' + JSON.stringify(linea[0]));
    
    const ordId = linea[0].order_id[0];
    const orden = odooExec_(uid, "sale.order", "read", [[ordId]],
      { fields: ["name", "state", "date_order"] });
    Logger.log('4) Orden padre: ' + JSON.stringify(orden[0]));
  }
}