// ============================================================
//  sheets_menu.gs
//  INSTRUCCIONES: Este archivo va en un script SEPARADO
//  vinculado al Google Sheet (no al Web App).
//
//  Cómo instalarlo:
//  1. Abre el Sheet en Google Sheets
//  2. Extensiones → Apps Script
//  3. Pega TODO este código en Code.gs de ese proyecto
//  4. Guarda y ejecuta "instalarTodo" una vez
//  5. Acepta los permisos
// ============================================================

// ── URL DEL WEB APP DE DROPSHIPPING ──────────────────────────
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby9biqEbiv4syc3St3TuPKXkG9rI5A4YsmtNta3OEJ4mD0i8sg0PPg9OhfrPDZJuO_L/exec";
const SHEET_ID_   = SpreadsheetApp.getActiveSpreadsheet().getId();

// ── MENÚ PRINCIPAL ────────────────────────────────────────────
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // ── Submenú: Productos / UPCs ──
  const subProductos = ui.createMenu("📥 Productos");
  subProductos
    .addItem("🏷 Crear hoja UPC_IMPORT",          "crearHojaUPCImport")
    .addItem("📂 Importar UPCs desde Drive",       "importarUPCsDesdeDrive")
    .addItem("📥 Procesar UPC_IMPORT → SKU",       "importarUPCsDesdeHoja");

  // ── Submenú: Sync CVA ──
  const subSync = ui.createMenu("⚡ Sync CVA");
  subSync
    .addItem("⚡ Sync AHORA (catálogo completo)",  "ejecutarSyncDiarioAhora")
    .addItem("🔄 Refrescar SKU_INVENTARIO",        "refrescarInventarioOdoo")
    .addSeparator()
    .addItem("📤 Exportar snapshot para cotizar",  "exportarSnapshotMenu")
    .addItem("📋 Ver Control de Sync",             "irAControlSync")
    .addItem("📊 Ver Análisis de Movimiento",      "irAAnalisis");

  // ── Submenú: Configuración (triggers, inicialización) ──
  const subConfig = ui.createMenu("⚙ Configuración");
  subConfig
    .addItem("⚙️ Instalar triggers automáticos",     "instalarTodosLosTriggers")
    .addItem("🔍 Ver triggers activos",              "verEstadoTriggers")
    .addSeparator()
    .addItem("💱 Asegurar Config Global (% + TC)",   "asegurarConfigGlobalMenu")
    .addItem("📋 Asegurar hoja CAT_ELECTRONICS",     "asegurarHojaCATElectronicsMenu")
    .addItem("⚡ Migrar a ARRAYFORMULA",              "migrarAARRAYFORMULA")
    .addItem("🔍 Diagnosticar fórmulas SKU",         "diagnosticarFormulasSKU")
    .addItem("🧹 Normalizar modelos (col E)",        "normalizarTodosLosModelosMenu")
    .addItem("🎨 Sincronizar SKU → METADATA",        "sincronizarSKUaMetadata")
    .addItem("🔄 Inicializar hojas de control",      "instalarTodo")
    .addItem("📈 Recalcular Análisis movimiento",    "recalcularAnalisis");

  // ── Submenú: Avanzado (debug, peligroso, raro) ──
  const subAdv = ui.createMenu("⚠ Avanzado");
  subAdv
    .addItem("🔍 Diagnosticar hojas",              "diagnosticarEstado")
    .addItem("🔬 Re-enriquecer pesos (CVA)",       "enriquecerPesosLocalMenu")
    .addItem("🔄 Sincronizar dimensiones → SKU",   "recalcularDimensionesMenu")
    .addItem("🔁 Regenerar hoja ANÁLISIS",         "regenerarHojaAnalisis")
    .addSeparator()
    .addItem("📋 Ver triggers activos",            "verTriggersDetalladoMenu")
    .addItem("🛑 Cancelar enriquecimiento async",  "cancelarEnriquecimientoAsync")
    .addItem("🚀 Re-disparar enriquecimiento async", "reDispararEnriquecimientoAsync")
    .addSeparator()
    .addItem("🧽 LIMPIEZA del Sheet (con respaldo)", "limpiezaSheetMenu")
    .addItem("🧹 Adelgazar HISTORIAL (quitar descripción/marca)", "adelgazarHistorialMenu")
    .addItem("⏹ Resetear checkpoint sync",         "resetearSyncManual")
    .addItem("🗑 Limpiar SYNC_CVA",                "resetearYLimpiar")
    .addItem("❌ Eliminar TODOS los triggers",      "eliminarTriggers_")
    .addSeparator()
    .addItem("🔍 DIAGNÓSTICO endpoint CVA",        "diagnosticarPesosCVAMenu")
    .addItem("🧪 Probar alerta por email",         "probarAlertaEmail")
    .addItem("🔍 Verificar salud del sync",        "verificarSaludAhora");

  // ── Submenú: Imágenes ──
  const subImagenes = ui.createMenu("🖼 Imágenes");
  subImagenes
    .addItem("🖼 Buscar imágenes por UPC", "abrirBuscadorImagenes")
    .addItem("📋 Abrir hoja de captura",    "irABusquedaImagenes")
    .addItem("🔍 Diagnóstico imágenes",     "diagnosticarImagenes_");

  // ── Submenú: Pedidos CVA ──
  const subPedidos = ui.createMenu("📦 Pedidos CVA");
  subPedidos
    .addItem("📦 Nuevo pedido CVA",           "abrirPedidoCVA")
    .addItem("📜 Historial CVA",              "abrirHistorialCVA")
    .addSeparator()
    .addItem("⚡ Todos los pedidos (masivo)",  "abrirVentasMasivo")
    .addItem("🔍 Buscar guías en Drive",       "menuBuscarGuiasDrive")
    .addSeparator()
    .addItem("📁 Setup carpeta GUIAS_ODOO",    "menuSetupGuiasFolder")
    .addItem("🎯 Aplicar dropdowns a VENTAS_ODOO", "menuAplicarValidaciones")
    .addItem("🔑 Setup credenciales Twilio",   "setupCredencialesTwilio");

  // ── Menú principal ──
  ui.createMenu("🛠 MIS HERRAMIENTAS")
    .addItem("🚀 SETUP COMPLETO (desde cero)",   "setupCompleto")
    .addItem("🔑 Configurar credenciales CVA",   "setupCredencialesBound")
    .addSeparator()
    .addSubMenu(subProductos)
    .addSubMenu(subSync)
    .addSubMenu(subImagenes)
    .addSubMenu(subPedidos)
    .addSubMenu(subConfig)
    .addSubMenu(subAdv)
    .addToUi();
}

// ── Acción de menú: regenerar hoja análisis (layout + datos) ──
// Pública (sin guión bajo) para que aparezca en el dropdown del editor
// y se pueda llamar desde el menú del Sheet sin hacer trucos.
function regenerarHojaAnalisis() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("🔁 Regenerar hoja ANÁLISIS_MOVIMIENTO",
    "Esto va a:\n" +
    "1. Borrar la hoja y reconstruir el layout limpio\n" +
    "2. Llamar al backend para traer los datos frescos\n" +
    "3. Rellenar con productos, marcas, agotados y KPIs\n\n" +
    "Tarda ~30 segundos. ¿Continuar?", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  try {
    crearHojaAnalisis_();        // 1. Layout limpio
    const r = recalcularAnalisis(); // 2. Rellenar con datos
    if (r && r.ok) {
      ui.alert("✅ Hoja regenerada\n\n" +
        "• " + r.productos + " productos analizados\n" +
        "• " + r.top + " en TOP 20\n" +
        "• Periodo: " + r.dias + " días\n\n" +
        "Ve a la hoja ANALISIS_MOVIMIENTO para verlos.");
    } else {
      ui.alert("⚠️ Layout regenerado, pero falló traer datos:\n\n" + (r ? r.error : "error desconocido") +
        "\n\nVerifica que el Web App esté desplegado.");
    }
  } catch(e) {
    ui.alert("❌ Error: " + e.message);
  }
}

// ── INSTALACIÓN COMPLETA (ejecutar una sola vez) ──────────────
function instalarTodo() {
  crearHojaControlSync_();
  crearHojaAnalisis_();
  instalarTriggers_();
  SpreadsheetApp.getUi().alert("✅ Todo instalado correctamente.\n\n" +
    "• Hoja CONTROL_SYNC creada\n" +
    "• Hoja ANALISIS_MOVIMIENTO creada\n" +
    "• Triggers automáticos instalados\n\n" +
    "El sync iniciará en los próximos 10 minutos.");
}

// ── HOJA CONTROL_SYNC ─────────────────────────────────────────
function crearHojaControlSync_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("CONTROL_SYNC");
  if (sh) ss.deleteSheet(sh);

  sh = ss.insertSheet("CONTROL_SYNC");
  ss.setActiveSheet(sh);
  ss.moveActiveSheet(1); // primera hoja

  // Título
  sh.setColumnWidth(1, 220);
  sh.setColumnWidth(2, 280);
  sh.setColumnWidth(3, 160);
  sh.setColumnWidth(4, 160);

  const headerRange = sh.getRange("A1:D1");
  headerRange.merge();
  headerRange.setValue("🔄 CONTROL DE SINCRONIZACIÓN CVA");
  headerRange.setBackground("#00665e");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontSize(14);
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sh.setRowHeight(1, 40);

  // Estado del sync
  const etiquetas = [
    ["Última ejecución",     "—"],
    ["Estado",               "—"],
    ["Próxima página",       "—"],
    ["Total páginas CVA",    "—"],
    ["Artículos procesados (run)", "—"],
    ["Total en SYNC_CVA",   "—"],
  ];

  etiquetas.forEach(([label, val], i) => {
    const row = i + 2;
    sh.getRange(row, 1).setValue(label).setFontWeight("bold")
      .setBackground(i % 2 === 0 ? "#f0f7f6" : "#ffffff");
    sh.getRange(row, 2).setValue(val)
      .setBackground(i % 2 === 0 ? "#f0f7f6" : "#ffffff");
    sh.setRowHeight(row, 30);
  });

  // Separador
  sh.getRange("A8:D8").setBackground("#00665e");
  sh.setRowHeight(8, 6);

  // Botones de acción (como notas — GAS Sheets no tiene botones reales,
  // usamos celdas con instrucciones y fórmulas de link)
  sh.getRange("A9:D9").merge().setValue("⚡ ACCIONES RÁPIDAS")
    .setBackground("#1a1a2e").setFontColor("#67b8af")
    .setFontSize(11).setFontWeight("bold").setHorizontalAlignment("center");
  sh.setRowHeight(9, 32);

  const acciones = [
    ["▶ Sync Manual",     "Menú → MIS HERRAMIENTAS → Ejecutar Sync AHORA"],
    ["⏹ Reset checkpoint","Menú → MIS HERRAMIENTAS → Resetear checkpoint sync"],
    ["🗑 Reset + limpiar", "Menú → MIS HERRAMIENTAS → Resetear + limpiar SYNC_CVA"],
    ["⚙️ Instalar triggers","Menú → MIS HERRAMIENTAS → Instalar triggers automáticos"],
    ["🔍 Ver triggers",   "Menú → MIS HERRAMIENTAS → Ver estado de triggers"],
  ];

  acciones.forEach(([accion, instruccion], i) => {
    const row = i + 10;
    sh.getRange(row, 1).setValue(accion).setFontWeight("bold")
      .setBackground(i % 2 === 0 ? "#e8f5f4" : "#f8fdfd");
    sh.getRange(row, 2, 1, 3).merge().setValue(instruccion)
      .setBackground(i % 2 === 0 ? "#e8f5f4" : "#f8fdfd")
      .setFontColor("#555555").setFontSize(10);
    sh.setRowHeight(row, 28);
  });

  // Separador
  sh.getRange("A15:D15").setBackground("#00665e");
  sh.setRowHeight(15, 6);

  // Log de últimas ejecuciones — título
  sh.getRange("A16:D16").merge().setValue("📋 LOG DE ÚLTIMAS EJECUCIONES (auto-actualiza)")
    .setBackground("#1a1a2e").setFontColor("#67b8af")
    .setFontSize(11).setFontWeight("bold").setHorizontalAlignment("center");
  sh.setRowHeight(16, 32);

  // Headers del log
  const logHeaders = ["Fecha/Hora", "Evento", "Artículos", "Detalle"];
  logHeaders.forEach((h, i) => {
    sh.getRange(17, i + 1).setValue(h).setFontWeight("bold")
      .setBackground("#2d5a57").setFontColor("#ffffff")
      .setHorizontalAlignment("center");
  });
  sh.setRowHeight(17, 28);

  // Fórmula que jala los últimos 20 registros de SYNC_LOG (si existe)
  // Usa QUERY para mostrar las últimas filas ordenadas desc
  sh.getRange("A18").setFormula(
    "=IFERROR(QUERY(SYNC_LOG!A:E,\"SELECT A,B,C,D ORDER BY A DESC LIMIT 20\",0),\"Sin datos en SYNC_LOG aún\")"
  );

  // Formato condicional para la columna de estado
  const estadoRange = sh.getRange("B3");
  const rules = sh.getConditionalFormatRules();

  const ruleOk = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("OK")
    .setBackground("#e8f5e9").setFontColor("#2e7d32")
    .setRanges([estadoRange]).build();

  const ruleError = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("ERROR")
    .setBackground("#ffebee").setFontColor("#c62828")
    .setRanges([estadoRange]).build();

  const ruleReset = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("RESET")
    .setBackground("#fff8e1").setFontColor("#f57f17")
    .setRanges([estadoRange]).build();

  rules.push(ruleOk, ruleError, ruleReset);
  sh.setConditionalFormatRules(rules);

  sh.setFrozenRows(1);
  Logger.log("✅ Hoja CONTROL_SYNC creada");
}

// ── HOJA ANÁLISIS DE VENTAS ───────────────────────────────────
// IMPORTANTE: esta función SOLO crea el layout (títulos, headers, formato).
// Los DATOS los rellena recalcularAnalisis() llamando al endpoint del backend.
// Antes usábamos fórmulas QUERY anidadas que se rompían silenciosamente
// porque dependían de auto-typing de columnas (string vs date) de Google
// Sheets. Ahora todo es valor estático calculado por el backend (mismo
// código que usa la PWA — consistencia garantizada).
function crearHojaAnalisis_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("ANALISIS_MOVIMIENTO");
  if (!sh) sh = ss.insertSheet("ANALISIS_MOVIMIENTO");
  sh.clear();
  sh.clearConditionalFormatRules();

  // Anchos de columna
  [1,2,3,4,5,6,7,8].forEach((c, i) => {
    sh.setColumnWidth(c, [180,260,130,150,90,90,90,90][i]);
  });

  // ── TÍTULO ──
  sh.getRange("A1:H1").merge()
    .setValue("📊 ANÁLISIS DE MOVIMIENTO DE STOCK — CVA")
    .setBackground("#00665e").setFontColor("#ffffff")
    .setFontSize(14).setFontWeight("bold").setHorizontalAlignment("center");
  sh.setRowHeight(1, 42);

  sh.getRange("A2").setValue("Última actualización:").setFontWeight("bold");
  sh.getRange("B2").setValue("(pendiente)").setNumberFormat("dd/mm/yyyy hh:mm");
  sh.getRange("C2").setValue("Periodo:").setFontWeight("bold");
  sh.getRange("D2:H2").merge().setValue("(pendiente — ejecuta Recalcular Análisis)")
    .setFontColor("#888888").setFontSize(10);

  // ── SECCIÓN 1: TOP 20 PRODUCTOS QUE MÁS SE MUEVEN ──
  _seccion_(sh, 4, "🏆 TOP 20 PRODUCTOS QUE MÁS SE MUEVEN (mayor bajada de stock en el periodo)", "#00665e");
  _headers_(sh, 5, ["Clave","Descripción","Marca","Grupo","Stock Hoy","Stock Inicial","Movido","Precio MXN"]);

  // ── SECCIÓN 2: RANKING POR MARCA ──
  _seccion_(sh, 28, "🏷 ROTACIÓN POR MARCA (marcas con mayor unidades movidas)", "#1a5276");
  _headers_(sh, 29, ["Marca","Productos","Stock Total","Unidades Movidas","Valor Movido MXN","","",""]);

  // ── SECCIÓN 3: RANKING POR GRUPO ──
  _seccion_(sh, 52, "📦 ROTACIÓN POR GRUPO / CATEGORÍA", "#1a5276");
  _headers_(sh, 53, ["Grupo","Productos","Stock Total","Unidades Movidas","Valor Movido MXN","","",""]);

  // ── SECCIÓN 4: PRODUCTOS QUE SE AGOTARON ──
  _seccion_(sh, 76, "🚨 PRODUCTOS QUE SE AGOTARON RECIENTEMENTE (tenían stock, hoy en 0)", "#c62828");
  _headers_(sh, 77, ["Clave","Descripción","Marca","Grupo","Stock Hoy","Stock Inicial","Diferencia","Precio MXN"], "#7f1d1d");

  // ── SECCIÓN 5: EVOLUCIÓN DIARIA ──
  _seccion_(sh, 110, "📈 EVOLUCIÓN DE STOCK TOTAL (últimos snapshots disponibles)", "#00665e");
  _headers_(sh, 111, ["Fecha","Total Stock Suc.","Total Stock CEDIS","Stock Total","Productos","","",""]);

  // ── KPIs LATERAL ──
  sh.setColumnWidth(10, 220);
  sh.setColumnWidth(11, 130);

  sh.getRange("J1:K1").merge().setValue("📌 INDICADORES")
    .setBackground("#1a1a2e").setFontColor("#67b8af")
    .setFontSize(12).setFontWeight("bold").setHorizontalAlignment("center");

  // Las etiquetas se ponen aquí; los valores los llena recalcularAnalisis()
  const kpiLabels = [
    "Total productos catálogo",
    "Productos con stock hoy",
    "Productos con movimiento",
    "Productos sin movimiento",
    "Agotados recientemente",
    "Unidades movidas",
    "Valor movido MXN",
    "Valor inventario MXN",
    "Promedio diario",
    "Marcas activas",
    "Grupos activos",
    "Días de historial",
    "Último snapshot",
  ];

  kpiLabels.forEach((label, i) => {
    const row = i + 2;
    sh.getRange(row, 10).setValue(label).setFontWeight("bold")
      .setBackground(i % 2 === 0 ? "#e8f5f4" : "#f8fdfd").setFontSize(10);
    sh.getRange(row, 11).setValue("—")
      .setBackground(i % 2 === 0 ? "#e8f5f4" : "#f8fdfd")
      .setFontWeight("bold").setFontSize(12).setHorizontalAlignment("center");
    sh.setRowHeight(row, 30);
  });

  // Formato condicional para resaltar agotados
  const alertaRange = sh.getRange("A78:H107");
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied("=AND($E78=0,$F78>0)")
    .setBackground("#fff3f3").setFontColor("#c62828")
    .setRanges([alertaRange]).build();
  sh.setConditionalFormatRules([rule]);

  sh.setFrozenRows(2);
  Logger.log("✅ Hoja ANALISIS_MOVIMIENTO (layout) creada");
}

// Helpers para crear secciones y headers
function _seccion_(sh, row, titulo, color) {
  sh.getRange(row, 1, 1, 8).merge()
    .setValue(titulo)
    .setBackground(color || "#00665e").setFontColor("#ffffff")
    .setFontSize(11).setFontWeight("bold").setHorizontalAlignment("center");
  sh.setRowHeight(row, 32);
}

function _headers_(sh, row, headers, bg) {
  headers.forEach((h, i) => {
    sh.getRange(row, i + 1).setValue(h).setFontWeight("bold")
      .setBackground(bg || "#2d5a57").setFontColor("#ffffff")
      .setHorizontalAlignment("center");
  });
  sh.setRowHeight(row, 26);
}

function instalarTriggers_() {
  // Un solo instalador para todo el proyecto: instalarTriggers() en Code.gs
  instalarTriggers();
  try { actualizarEstadoTriggers_(); } catch (e) {}
  try {
    SpreadsheetApp.getUi().alert("✅ Triggers instalados:\n\n" + resumenTriggers_() +
      "\n\nApagados: cola Odoo, ventas CVA, sync via Web App, KPIs.");
  } catch (e) {}
}

function eliminarTriggers_() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("¿Eliminar todos los triggers?",
    "El sync automático se detendrá.", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  actualizarEstadoTriggers_();
  ui.alert("❌ Todos los triggers eliminados.");
}

function verEstadoTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  if (triggers.length === 0) {
    SpreadsheetApp.getUi().alert(
      "⚠️ No hay triggers activos.\n\n" +
      "Ve a Menú → MIS HERRAMIENTAS → Instalar triggers automáticos"
    );
    return;
  }

  let msg = "✅ Triggers activos (" + triggers.length + "):\n\n";
  triggers.forEach(t => {
    const freq = t.getTriggerSourceId ? "" : "";
    msg += "• " + t.getHandlerFunction() + " — " + t.getEventType() + "\n";
  });
  SpreadsheetApp.getUi().alert(msg);
  actualizarEstadoTriggers_();
}

function actualizarEstadoTriggers_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("CONTROL_SYNC");
    if (!sh) return;
    const triggers  = ScriptApp.getProjectTriggers();
    const activoStr = triggers.length > 0
      ? "✅ " + triggers.length + " trigger(s) activo(s)"
      : "❌ Sin triggers — sync manual solamente";
    // Escribir en B8 si existe
    if (sh.getLastRow() >= 8) {
      sh.getRange("A8").setValue("Triggers");
      sh.getRange("B8").setValue(activoStr);
    }
  } catch(e) {}
}

// ── TRIGGERS AUTOMÁTICOS (funciones que llama el tiempo) ──────
function triggerSyncViaWebApp() {
  // Llama al Web App de GAS para ejecutar el sync
  // Esto es necesario porque el sync necesita credenciales del Web App
  try {
    const res = UrlFetchApp.fetch(WEB_APP_URL, {
      method: "post",
      contentType: "text/plain",
      payload: JSON.stringify({
        action : "sync_precios",
        batch  : "XL",
        paginas: 999,
        exist  : "3",
      }),
      muteHttpExceptions: true,
      followRedirects: true,
    });

    const code = res.getResponseCode();
    const text = res.getContentText();

    if (code === 200) {
      try {
        const data = JSON.parse(text);
        _registrarLogSync_(data);
        Logger.log("✅ Sync via WebApp: " + data.articulos_procesados + " artículos, pág " + data.next_page);
      } catch(e) {
        Logger.log("⚠️ Sync respuesta no JSON: " + text.substring(0, 200));
      }
    } else {
      Logger.log("❌ Sync WebApp HTTP " + code);
      _registrarLogError_("HTTP " + code);
    }
  } catch(e) {
    Logger.log("❌ triggerSyncViaWebApp: " + e.message);
    _registrarLogError_(e.message.substring(0, 100));
  }
}

function triggerAnalisis() {
  try {
    recalcularAnalisis();
    Logger.log("✅ Análisis recalculado");
  } catch(e) {
    Logger.log("❌ triggerAnalisis: " + e.message);
  }
}

function triggerKPIs() {
  try {
    // Forzar recálculo de fórmulas en ANALISIS_VENTAS
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("ANALISIS_MOVIMIENTO");
    if (sh) {
      sh.getRange("B2").setValue(new Date()); // actualiza timestamp
      SpreadsheetApp.flush();
    }
    Logger.log("✅ KPIs actualizados");
  } catch(e) {
    Logger.log("❌ triggerKPIs: " + e.message);
  }
}

// ── ACCIONES MANUALES DESDE MENÚ ─────────────────────────────
// ── NUEVAS ACCIONES — Llaman al Web App de GAS ───────────────

// Ejecuta el sync diario completo (mismo que el trigger de las 2am)
function ejecutarSyncDiarioAhora() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("⚡ Ejecutar Sync Diario completo",
    "Esto descarga TODO el catálogo CVA con stock (~3,900 artículos) y genera el snapshot del día.\n\n" +
    "Tarda hasta 5 minutos. ¿Continuar?",
    ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  try {
    const data = syncHistorialCVA();
    if (data.ok) {
      _registrarLogManual_("SYNC_DIARIO_MANUAL");
      ui.alert("✅ Sync diario completado\n\n" +
        "Artículos: " + (data.articulos || 0) + "\n" +
        "Páginas: " + (data.paginas || 0) + "\n" +
        "Fecha snapshot: " + (data.fecha || "—") +
        (data.mensaje ? "\n\n" + data.mensaje : ""));
    } else {
      ui.alert("❌ Error: " + (data.error || JSON.stringify(data)));
    }
  } catch(e) {
    ui.alert("❌ " + e.message);
  }
}

// Instala TODOS los triggers — del Sheet y del Web App
function instalarTodosLosTriggers() {
  // Antes instalaba los del Sheet y luego llamaba al Web App, que volvia a
  // borrar todo. Es el mismo proyecto: un solo instalador basta.
  instalarTriggers_();
}

function ejecutarSyncManual() {
  const ui = SpreadsheetApp.getUi();
  ui.alert("⟳ Ejecutando sync...\n\nEsto puede tardar hasta 60 segundos.");

  try {
    const res = UrlFetchApp.fetch(WEB_APP_URL, {
      method: "post",
      contentType: "text/plain",
      payload: JSON.stringify({
        action : "sync_precios",
        batch  : "MD",   // MD en manual para ser más rápido
        paginas: 5,
        exist  : "3",
      }),
      muteHttpExceptions: true,
      followRedirects: true,
    });

    const data = JSON.parse(res.getContentText());
    if (data.ok) {
      _registrarLogSync_(data);
      ui.alert("✅ Sync completado\n\n" +
        "Artículos procesados: " + data.articulos_procesados + "\n" +
        "Próxima página: " + data.next_page + " de " + (data.total_paginas || "?") +
        (data.auto_reset ? "\n\n⚠️ Se detectó fin del catálogo — checkpoint reiniciado a pág 1" : ""));
    } else {
      ui.alert("❌ Error en sync: " + (data.error || JSON.stringify(data)));
    }
  } catch(e) {
    ui.alert("❌ Error: " + e.message);
  }
}

function resetearSyncManual() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("¿Resetear checkpoint?",
    "El sync volverá a empezar desde la página 1.\nNo se borra ningún dato.", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  try {
    const res = UrlFetchApp.fetch(WEB_APP_URL + "?action=reset_sync", {
      muteHttpExceptions: true, followRedirects: true,
    });
    const data = JSON.parse(res.getContentText());
    ui.alert(data.ok ? "✅ " + data.mensaje : "❌ " + data.error);
    _registrarLogManual_("RESET_CHECKPOINT");
  } catch(e) {
    ui.alert("❌ " + e.message);
  }
}

function resetearYLimpiar() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("⚠️ ¿Resetear Y limpiar SYNC_CVA?",
    "Se borrarán TODOS los artículos de SYNC_CVA y el sync empezará desde cero.\n\n" +
    "El HISTORIAL_STOCK NO se borra.", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  try {
    const res = UrlFetchApp.fetch(WEB_APP_URL + "?action=reset_sync&limpiar=true", {
      muteHttpExceptions: true, followRedirects: true,
    });
    const data = JSON.parse(res.getContentText());
    ui.alert(data.ok ? "✅ " + data.mensaje : "❌ " + data.error);
    _registrarLogManual_("RESET_Y_LIMPIAR");
  } catch(e) {
    ui.alert("❌ " + e.message);
  }
}

// ── RECÁLCULO DE ANÁLISIS — llama al backend y rellena la hoja ──
// El endpoint `analisis_movimiento` del Web App devuelve productos, marcas,
// grupos y KPIs ya calculados (es el mismo cómputo que usa la PWA, así que
// los números coinciden entre las dos vistas).
//
// Por default analiza los últimos 7 días. Se puede llamar con
// recalcularAnalisis(30) para otro periodo.
function recalcularAnalisis(diasAtras) {
  diasAtras = diasAtras || 7;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Sanity check: que haya datos para analizar
  const syncCVA = ss.getSheetByName("SYNC_CVA");
  if (!syncCVA || syncCVA.getLastRow() < 2) {
    Logger.log("⚠ SYNC_CVA vacía — no hay datos");
    return { ok: false, error: "SYNC_CVA vacía" };
  }

  let sh = ss.getSheetByName("ANALISIS_MOVIMIENTO");
  if (!sh) { crearHojaAnalisis_(); sh = ss.getSheetByName("ANALISIS_MOVIMIENTO"); }

  // ── 1. Calcular (directo: antes se llamaba al propio Web App por HTTP) ──
  let data;
  try {
    data = getAnalisisMovimiento({ dias_atras: diasAtras });
    if (!data || !data.ok) {
      Logger.log("❌ recalcularAnalisis: " + ((data && data.error) || "error desconocido"));
      return { ok: false, error: data && data.error };
    }
  } catch(e) {
    Logger.log("❌ recalcularAnalisis: " + e.message);
    return { ok: false, error: e.message };
  }

  const k = data.kpis    || {};
  const p = data.periodo || {};

  // ── 2. Header: timestamp + periodo ──
  sh.getRange("B2").setValue(new Date()).setNumberFormat("dd/mm/yyyy hh:mm");
  sh.getRange("D2:H2").merge().setValue(
    `${p.fecha_inicio || "—"} → ${p.fecha_fin || "—"} (${p.dias || 0} días) · ${p.snapshots_validos || 0} snapshots válidos`
  ).setFontColor("#444444").setFontSize(10);

  // ── 3. TOP 20 productos con más movimiento ──
  // Limpiar área de datos (filas 6 a 25)
  sh.getRange(6, 1, 22, 8).clearContent().setBackground(null);

  const productos = data.productos || [];
  const top20 = productos
    .filter(pr => pr.tiene_movimiento && pr.movido > 0)
    .sort((a, b) => (b.movido || 0) - (a.movido || 0))
    .slice(0, 20);

  if (top20.length > 0) {
    const rows = top20.map(pr => [
      pr.clave || "",
      (pr.desc || "").substring(0, 80),
      pr.marca || "",
      pr.grupo || "",
      pr.total || 0,
      pr.stock_base != null ? pr.stock_base : 0,
      pr.movido || 0,
      pr.precio || 0,
    ]);
    sh.getRange(6, 1, rows.length, 8).setValues(rows);
    // Formato de columna Precio MXN
    sh.getRange(6, 8, rows.length, 1).setNumberFormat("$#,##0.00");
    // Resaltar columna Movido
    sh.getRange(6, 7, rows.length, 1).setFontWeight("bold").setFontColor("#00665e");
    // Zebra
    for (let i = 0; i < rows.length; i++) {
      if (i % 2 === 0) sh.getRange(6+i, 1, 1, 8).setBackground("#f8fdfd");
    }
  } else {
    sh.getRange("A6:H6").merge().setValue("Sin movimiento detectado en el periodo").setFontColor("#888");
  }

  // ── 4. Rotación POR MARCA (top 20) ──
  sh.getRange(30, 1, 22, 8).clearContent().setBackground(null);
  const marcas = (data.marcas || []).slice(0, 20);
  if (marcas.length > 0) {
    const rows = marcas.map(m => [
      m.marca || "", m.productos || 0, m.stock_total || 0,
      m.movido || 0, m.valor_movido || 0, "", "", ""
    ]);
    sh.getRange(30, 1, rows.length, 8).setValues(rows);
    sh.getRange(30, 5, rows.length, 1).setNumberFormat("$#,##0.00");
    sh.getRange(30, 4, rows.length, 1).setFontWeight("bold").setFontColor("#1a5276");
    for (let i = 0; i < rows.length; i++) {
      if (i % 2 === 0) sh.getRange(30+i, 1, 1, 8).setBackground("#f4f8fb");
    }
  }

  // ── 5. Rotación POR GRUPO (top 20) ──
  sh.getRange(54, 1, 22, 8).clearContent().setBackground(null);
  const grupos = (data.grupos || []).slice(0, 20);
  if (grupos.length > 0) {
    const rows = grupos.map(g => [
      g.grupo || "", g.productos || 0, g.stock_total || 0,
      g.movido || 0, g.valor_movido || 0, "", "", ""
    ]);
    sh.getRange(54, 1, rows.length, 8).setValues(rows);
    sh.getRange(54, 5, rows.length, 1).setNumberFormat("$#,##0.00");
    sh.getRange(54, 4, rows.length, 1).setFontWeight("bold").setFontColor("#1a5276");
    for (let i = 0; i < rows.length; i++) {
      if (i % 2 === 0) sh.getRange(54+i, 1, 1, 8).setBackground("#f4f8fb");
    }
  }

  // ── 6. Productos agotados recientemente ──
  sh.getRange(78, 1, 30, 8).clearContent().setBackground(null);
  const agotados = productos.filter(pr => pr.agotado_recientemente).slice(0, 30);
  if (agotados.length > 0) {
    const rows = agotados.map(pr => [
      pr.clave || "", (pr.desc || "").substring(0, 80),
      pr.marca || "", pr.grupo || "",
      pr.total || 0, pr.stock_base != null ? pr.stock_base : 0,
      (pr.stock_base || 0) - (pr.total || 0),
      pr.precio || 0,
    ]);
    sh.getRange(78, 1, rows.length, 8).setValues(rows);
    sh.getRange(78, 8, rows.length, 1).setNumberFormat("$#,##0.00");
  } else {
    sh.getRange("A78:H78").merge().setValue("Sin agotados recientes — bien!").setFontColor("#2e7d32").setFontWeight("bold");
  }

  // ── 7. Evolución de stock (últimos snapshots) ──
  // Usamos data.evolucion_diaria del backend (que ya suma TODAS las
  // particiones de HISTORIAL_STOCK). Antes usábamos SUMIFS hardcoded
  // a HISTORIAL_STOCK!H:H, pero eso ignoraba HISTORIAL_STOCK_2/3/...
  sh.getRange(112, 1, 30, 8).clearContent().setBackground(null);
  const evolucion = (data.evolucion_diaria || []).slice(0, 14);
  if (evolucion.length > 0) {
    const evRows = evolucion.map(ev => [
      ev.fecha,
      ev.stock_suc   || 0,
      ev.stock_cedis || 0,
      ev.stock_total || 0,
      ev.productos   || 0,
      "", "", ""
    ]);
    sh.getRange(112, 1, evRows.length, 8).setValues(evRows);
    sh.getRange(112, 2, evRows.length, 4).setNumberFormat("#,##0");
    for (let i = 0; i < evRows.length; i++) {
      if (i % 2 === 0) sh.getRange(112+i, 1, 1, 8).setBackground("#f8fdfd");
    }
  }

  // ── 8. KPIs laterales (col K) ──
  // El orden debe coincidir con el de crearHojaAnalisis_()
  const valores = [
    k.total_productos      || 0,
    k.productos_activos    || 0,
    k.con_movimiento       || 0,
    k.sin_movimiento       || 0,
    k.agotados_recientes   || 0,
    k.unidades_movidas     || 0,
    k.valor_movido_mxn     || 0,
    k.valor_inventario_mxn || 0,
    k.promedio_diario_total|| 0,
    k.marcas_activas       || 0,
    k.grupos_activos       || 0,
    p.snapshots_validos    || 0,
    p.fecha_fin            || "—",
  ];
  valores.forEach((v, i) => {
    const row = i + 2;
    const cell = sh.getRange(row, 11);
    cell.setValue(v);
    // Formato según índice — Valor movido (6), Valor inventario (7) son moneda
    if (i === 6 || i === 7) cell.setNumberFormat("$#,##0.00");
    else if (typeof v === "number") cell.setNumberFormat("#,##0.##");
  });

  SpreadsheetApp.flush();
  _registrarLogManual_("ANALISIS_RECALCULADO");
  Logger.log("✅ Análisis recalculado: " + productos.length + " productos, " +
             top20.length + " en TOP, " + agotados.length + " agotados, periodo " +
             p.dias + " días");
  return { ok: true, productos: productos.length, top: top20.length, dias: p.dias };
}

function irAControlSync() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("CONTROL_SYNC");
  if (!sh) { crearHojaControlSync_(); sh = ss.getSheetByName("CONTROL_SYNC"); }
  ss.setActiveSheet(sh);
}

function irAAnalisis() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("ANALISIS_MOVIMIENTO");
  if (!sh) { crearHojaAnalisis_(); sh = ss.getSheetByName("ANALISIS_MOVIMIENTO"); }
  ss.setActiveSheet(sh);
}

// ── HELPERS INTERNOS ──────────────────────────────────────────
function _registrarLogSync_(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("CONTROL_SYNC");
    if (!sh) return;
    sh.getRange("B2").setValue(new Date());
    sh.getRange("B3").setValue(data.auto_reset ? "AUTO-RESET" : "OK");
    sh.getRange("B4").setValue(data.next_page || "—");
    sh.getRange("B5").setValue(data.total_paginas || "—");
    sh.getRange("B6").setValue(data.articulos_procesados || 0);
    const syncCVA = ss.getSheetByName("SYNC_CVA");
    if (syncCVA) sh.getRange("B7").setValue(syncCVA.getLastRow() - 1);
  } catch(e) {}
}

function _registrarLogManual_(evento) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let shL = ss.getSheetByName("SYNC_LOG");
    if (!shL) shL = ss.insertSheet("SYNC_LOG");
    shL.appendRow([new Date(), evento, "—", "Acción manual desde Sheets"]);
  } catch(e) {}
}

function _registrarLogError_(msg) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("CONTROL_SYNC");
    if (sh) {
      sh.getRange("B2").setValue(new Date());
      sh.getRange("B3").setValue("ERROR: " + msg.substring(0, 60));
    }
    let shL = ss.getSheetByName("SYNC_LOG");
    if (!shL) shL = ss.insertSheet("SYNC_LOG");
    shL.appendRow([new Date(), "SYNC_ERROR", 0, msg]);
  } catch(e) {}
}

// ════════════════════════════════════════════════════════════════
//  MONITOR DE SALUD + ALERTAS POR EMAIL
//  Diseñado para detectar:
//   1. Errores consecutivos (≥5) en SYNC_LOG → "el sync está roto AHORA"
//   2. Sin SYNC_DIARIO_COMPLETO en >36h → "el sync lleva días caído"
//   3. Cuota de UrlFetch agotada → "Google bloqueó las llamadas hoy"
//  Antispam: una alerta del mismo tipo no se reenvía antes de 2h.
//  Configurable: cambiar ALERT_EMAIL para usar otra dirección.
// ════════════════════════════════════════════════════════════════

const ALERT_EMAIL     = "victor.walmart.04@gmail.com";
const ALERT_COOLDOWN_H = 12;  // horas entre alertas del mismo tipo (12h = max 2 emails/día por tipo)
const ERROR_THRESHOLD  = 15;  // errores consecutivos para disparar — alto a propósito para evitar ruido
const STALE_HOURS      = 48;  // 48h sin sync exitoso = sistema realmente caído

function triggerMonitorSalud() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shL = ss.getSheetByName("SYNC_LOG");
    if (!shL) return;

    const lastRow = shL.getLastRow();
    if (lastRow < 2) return;

    // Leer las últimas 50 entradas para análisis
    const start = Math.max(2, lastRow - 49);
    const data = shL.getRange(start, 1, lastRow - start + 1, 4).getValues();

    // ── 1. Detectar errores consecutivos desde el final ──
    let consecutivosError = 0;
    let mensajesError = [];
    for (let i = data.length - 1; i >= 0; i--) {
      const evento = String(data[i][1] || "");
      if (evento === "SYNC_ERROR") {
        consecutivosError++;
        if (mensajesError.length < 3) {
          mensajesError.push(String(data[i][3] || "").substring(0, 120));
        }
      } else if (evento.startsWith("SYNC_") || evento === "ANALISIS_RECALCULADO") {
        // cualquier otro evento corta la racha de errores
        break;
      }
    }

    // ── 2. Tiempo desde último sync exitoso ──
    let ultimoExitoso = null;
    for (let i = data.length - 1; i >= 0; i--) {
      const evento = String(data[i][1] || "");
      if (evento === "SYNC_DIARIO_COMPLETO" || evento === "SYNC_COMPLETO") {
        const articulos = parseInt(data[i][2]) || 0;
        if (articulos > 0) {
          ultimoExitoso = new Date(data[i][0]);
          break;
        }
      }
    }
    const horasDesdeExitoso = ultimoExitoso
      ? (new Date() - ultimoExitoso) / (1000 * 60 * 60)
      : 9999;

    // ── 3. Clasificar el tipo de error consecutivo ──
    const tipoError = consecutivosError > 0 ? _clasificarError_(mensajesError[0]) : "";

    // ── 4. Decidir si la alerta amerita email ──
    // FILOSOFÍA: solo notificar problemas que requieren intervención humana.
    // Los errores transitorios (timeout, HTTP 500, cuota que se renueva sola)
    // NO disparan email — el sistema se recupera solo en el siguiente ciclo.
    //
    // Tipos críticos (SÍ envían email):
    //   - CREDENCIALES: solo tú puedes ir a Script Properties a cambiarla
    //   - HTTP_404: el endpoint cambió, requiere actualizar el código
    //   - PROBE_FAIL persistente: la API CVA no responde correctamente
    //
    // Tipos no críticos (NO envían — se ignoran):
    //   - TIMEOUT, CVA_DOWN, CUOTA, OTRO: transitorios, se recuperan solos

    const props = PropertiesService.getScriptProperties();
    const now = new Date();
    const TIPOS_CRITICOS = ["CREDENCIALES", "HTTP_404", "PROBE_FAIL"];

    // ALERTA A: errores consecutivos de tipo crítico
    if (consecutivosError >= ERROR_THRESHOLD && TIPOS_CRITICOS.indexOf(tipoError) >= 0) {
      const alertKey = "ALERT_LAST_ERRORES_" + tipoError;
      if (_puedeEnviarAlerta_(props, alertKey, now)) {
        _enviarEmailAlerta_({
          tipo: "ERRORES_CONSECUTIVOS",
          asunto: `🚨 CVA Sync: ${consecutivosError} errores · ${tipoError} (requiere acción)`,
          consecutivos: consecutivosError,
          tipoError: tipoError,
          mensajes: mensajesError,
          horasDesdeExitoso: horasDesdeExitoso,
        });
        props.setProperty(alertKey, now.toISOString());
      }
    }

    // ALERTA B: sync stale prolongado (sistema realmente caído)
    if (horasDesdeExitoso > STALE_HOURS) {
      const alertKey = "ALERT_LAST_STALE";
      if (_puedeEnviarAlerta_(props, alertKey, now)) {
        _enviarEmailAlerta_({
          tipo: "SYNC_STALE",
          asunto: `⚠️ CVA Sync caído hace ${Math.round(horasDesdeExitoso)}h (requiere acción)`,
          horasDesdeExitoso: horasDesdeExitoso,
          ultimoExitoso: ultimoExitoso,
          consecutivos: consecutivosError,
          tipoError: tipoError,
          mensajes: mensajesError,
        });
        props.setProperty(alertKey, now.toISOString());
      }
    }

    // Errores transitorios: solo registrar al log de Apps Script, sin email
    Logger.log("Monitor salud: consec=" + consecutivosError + " (tipo=" + (tipoError || "—") +
               "), horas_desde_exito=" + horasDesdeExitoso.toFixed(1) +
               " — " + (consecutivosError >= ERROR_THRESHOLD && TIPOS_CRITICOS.indexOf(tipoError) >= 0
                 ? "ALERTA CRÍTICA"
                 : horasDesdeExitoso > STALE_HOURS
                 ? "STALE"
                 : "OK (sin alerta)"));
  } catch(e) {
    Logger.log("❌ triggerMonitorSalud: " + e.message);
  }
}

function _clasificarError_(mensaje) {
  const m = (mensaje || "").toLowerCase();
  if (m.includes("credenciales")) return "CREDENCIALES";
  if (m.includes("urlfetch") || m.includes("demasiadas veces")) return "CUOTA";
  if (m.includes("timeout") || m.includes("tiempo de espera")) return "TIMEOUT";
  if (m.includes("404")) return "HTTP_404";
  if (m.includes("500") || m.includes("502") || m.includes("503")) return "CVA_DOWN";
  if (m.includes("probe")) return "PROBE_FAIL";
  return "OTRO";
}

function _puedeEnviarAlerta_(props, key, now) {
  const last = props.getProperty(key);
  if (!last) return true;
  const horas = (now - new Date(last)) / (1000 * 60 * 60);
  return horas >= ALERT_COOLDOWN_H;
}

function _enviarEmailAlerta_(info) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetUrl = ss.getUrl();
    const stamp = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

    // Cuerpo HTML — formato consistente con otros emails del sistema
    let html = `<div style="font-family:Arial,sans-serif;max-width:600px;color:#222">`;
    html += `<div style="background:#7d1414;color:#fff;padding:14px 18px">`;
    html += `<div style="font-size:11px;opacity:.7;letter-spacing:1px">ALERTA · CVA SYNC</div>`;
    html += `<div style="font-size:18px;margin-top:4px">${info.asunto}</div></div>`;
    html += `<div style="padding:18px;background:#f8f8f8">`;
    html += `<table style="font-size:13px;border-collapse:collapse;width:100%">`;
    html += `<tr><td style="padding:4px 8px;color:#888">Detectado</td><td style="padding:4px 8px"><b>${stamp}</b></td></tr>`;
    html += `<tr><td style="padding:4px 8px;color:#888">Tipo</td><td style="padding:4px 8px">${info.tipo}</td></tr>`;
    if (info.consecutivos)
      html += `<tr><td style="padding:4px 8px;color:#888">Errores consecutivos</td><td style="padding:4px 8px"><b>${info.consecutivos}</b></td></tr>`;
    if (info.tipoError)
      html += `<tr><td style="padding:4px 8px;color:#888">Clasificación</td><td style="padding:4px 8px">${info.tipoError}</td></tr>`;
    if (info.horasDesdeExitoso !== undefined && info.horasDesdeExitoso < 9999)
      html += `<tr><td style="padding:4px 8px;color:#888">Horas sin sync exitoso</td><td style="padding:4px 8px"><b>${info.horasDesdeExitoso.toFixed(1)}h</b></td></tr>`;
    if (info.ultimoExitoso)
      html += `<tr><td style="padding:4px 8px;color:#888">Último sync exitoso</td><td style="padding:4px 8px">${info.ultimoExitoso.toLocaleString("es-MX")}</td></tr>`;
    html += `</table>`;

    if (info.mensajes && info.mensajes.length) {
      html += `<div style="margin-top:14px;font-size:11px;color:#888;letter-spacing:.5px">ÚLTIMOS MENSAJES DEL LOG</div>`;
      html += `<div style="background:#fff;padding:10px;font-family:monospace;font-size:11px;color:#7d1414;border-left:3px solid #7d1414;margin-top:4px;white-space:pre-wrap">`;
      html += info.mensajes.map((m, i) => (i + 1) + ". " + _escapeHtml_(m)).join("\n");
      html += `</div>`;
    }

    // Acciones sugeridas según el tipo
    html += `<div style="margin-top:18px;font-size:11px;color:#888;letter-spacing:.5px">ACCIONES SUGERIDAS</div>`;
    html += `<ul style="font-size:13px;padding-left:20px;margin-top:4px">`;
    if (info.tipoError === "CREDENCIALES" || (info.mensajes && info.mensajes[0] && info.mensajes[0].toLowerCase().includes("credenciales"))) {
      html += `<li>Verifica la password de CVA en Script Properties del Web App de GAS</li>`;
      html += `<li>Confirma que <b>LEONGEM COMERCIALIZADORA</b> sigue activo en CVA</li>`;
    }
    if (info.tipo === "CUOTA_AGOTADA") {
      html += `<li>La cuota se renueva al día siguiente a medianoche</li>`;
      html += `<li>Considera deshabilitar temporalmente el trigger de polling</li>`;
    }
    if (info.tipo === "SYNC_STALE") {
      html += `<li>Ejecuta manualmente: Menú → MIS HERRAMIENTAS → Sync Diario AHORA</li>`;
      html += `<li>Revisa los últimos eventos en la hoja SYNC_LOG</li>`;
    }
    html += `<li><a href="${sheetUrl}" style="color:#00665e">Abrir el Sheet</a> para investigar</li>`;
    html += `</ul></div></div>`;

    // El envío va FUERA del try grande para que cualquier error de permisos
    // o cuota se propague hacia arriba — antes lo tragábamos en silencio.
    MailApp.sendEmail({
      to: ALERT_EMAIL,
      subject: info.asunto,
      htmlBody: html,
    });

    // Registrar el envío para auditoría
    const shL = ss.getSheetByName("SYNC_LOG");
    if (shL) shL.appendRow([new Date(), "ALERTA_EMAIL", info.consecutivos || 0,
      info.tipo + " → " + ALERT_EMAIL]);
    Logger.log("📧 Alerta enviada: " + info.tipo);
    return { ok: true };
  } catch(e) {
    // NO tragar el error — propagarlo con contexto útil para diagnóstico
    Logger.log("❌ _enviarEmailAlerta_ FALLÓ: " + e.message + "\n" + (e.stack || ""));
    return {
      ok: false,
      error: e.message,
      tipo_error: _clasificarErrorEmail_(e.message),
    };
  }
}

function _clasificarErrorEmail_(msg) {
  const m = (msg || "").toLowerCase();
  if (m.includes("authorization") || m.includes("autorización") || m.includes("permission"))
    return "AUTORIZACION_FALTANTE";
  if (m.includes("quota") || m.includes("cuota") || m.includes("limit"))
    return "CUOTA_AGOTADA";
  if (m.includes("invalid") && m.includes("email"))
    return "EMAIL_INVALIDO";
  return "OTRO";
}

function _escapeHtml_(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── Función de menú para probar el sistema de alertas ─────────
function probarAlertaEmail() {
  try {
    const r = _enviarEmailAlerta_({
      tipo: "PRUEBA",
      asunto: "🧪 CVA Sync: Prueba del sistema de alertas",
      consecutivos: 0,
      tipoError: "PRUEBA",
      mensajes: ["Este es un email de prueba — el sistema de alertas funciona correctamente.",
                 "Si recibes este mensaje, las alertas reales también llegarán."],
    });

    if (r && r.ok) {
      SpreadsheetApp.getUi().alert(
        "✅ Email de prueba enviado a:\n\n" + ALERT_EMAIL +
        "\n\nSi no lo recibes en 1-2 minutos, revisa Spam."
      );
    } else if (r && r.tipo_error === "AUTORIZACION_FALTANTE") {
      SpreadsheetApp.getUi().alert(
        "❌ FALTAN PERMISOS DE EMAIL\n\n" +
        "MailApp no está autorizado. Solución:\n\n" +
        "1. Abre el editor de Apps Script (Extensiones → Apps Script)\n" +
        "2. En el dropdown de funciones (arriba), selecciona\n" +
        "   FORZARAUTORIZACION\n" +
        "3. Click el botón ▶ Ejecutar\n" +
        "4. Acepta TODOS los permisos en el diálogo\n" +
        "5. Vuelve aquí y prueba de nuevo\n\n" +
        "Detalle: " + r.error
      );
    } else {
      SpreadsheetApp.getUi().alert("❌ Error: " + (r ? r.error : "desconocido"));
    }
  } catch(e) {
    SpreadsheetApp.getUi().alert("❌ Error inesperado: " + e.message);
  }
}

// ════════════════════════════════════════════════════════════════
//  FORZAR AUTORIZACIÓN — ejecutar UNA VEZ desde el editor
//  Toca cada servicio sensible para disparar el diálogo de OAuth.
//  Sin esto, MailApp.sendEmail desde menú/trigger falla con
//  "You do not have permission to call MailApp.sendEmail".
// ════════════════════════════════════════════════════════════════
function forzarAutorizacion() {
  Logger.log("════ Forzando autorización de scopes ════");

  // 1. SpreadsheetApp — leer hojas
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("✓ SpreadsheetApp — sheet: " + ss.getName());

  // 2. ScriptApp — gestionar triggers
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log("✓ ScriptApp — " + triggers.length + " trigger(s) instalado(s)");

  // 3. UrlFetchApp — llamar al Web App
  try {
    const probe = UrlFetchApp.fetch("https://www.google.com", { muteHttpExceptions: true });
    Logger.log("✓ UrlFetchApp — HTTP " + probe.getResponseCode());
  } catch(e) { Logger.log("⚠ UrlFetchApp: " + e.message); }

  // 4. PropertiesService — leer/escribir Script Properties
  PropertiesService.getScriptProperties().getProperty("_forzar_auth_probe");
  Logger.log("✓ PropertiesService");

  // 5. MailApp — el más sensible, el que estaba fallando
  const cuota = MailApp.getRemainingDailyQuota();
  Logger.log("✓ MailApp — cuota restante hoy: " + cuota + " emails");

  // Mandar email de confirmación con el flujo ya autorizado
  MailApp.sendEmail({
    to: ALERT_EMAIL,
    subject: "✅ Autorización completada — CVA Sync",
    htmlBody:
      "<div style='font-family:Arial;max-width:500px'>" +
      "<div style='background:#00665e;color:#fff;padding:14px 18px'>" +
      "<div style='font-size:11px;opacity:.7;letter-spacing:1px'>AUTORIZACIÓN</div>" +
      "<div style='font-size:18px;margin-top:4px'>Permisos confirmados</div></div>" +
      "<div style='padding:18px;background:#f8f8f8'>" +
      "<p>Si estás leyendo esto, MailApp ya está autorizado y las alertas de CVA Sync funcionarán correctamente.</p>" +
      "<table style='font-size:13px;border-collapse:collapse'>" +
      "<tr><td style='padding:4px 8px;color:#888'>Cuota restante hoy</td><td style='padding:4px 8px'><b>" + cuota + " emails</b></td></tr>" +
      "<tr><td style='padding:4px 8px;color:#888'>Triggers instalados</td><td style='padding:4px 8px'><b>" + triggers.length + "</b></td></tr>" +
      "<tr><td style='padding:4px 8px;color:#888'>Sheet</td><td style='padding:4px 8px'>" + ss.getName() + "</td></tr>" +
      "</table>" +
      "<p style='margin-top:14px;color:#666;font-size:12px'>Ahora puedes usar las opciones del menú normalmente.</p>" +
      "</div></div>"
  });

  Logger.log("📧 Email de confirmación enviado a: " + ALERT_EMAIL);
  Logger.log("════ Autorización OK ════");
  return { ok: true, cuotaRestante: cuota, triggers: triggers.length };
}

// ── Función de menú para forzar verificación inmediata ────────
function verificarSaludAhora() {
  try {
    triggerMonitorSalud();
    SpreadsheetApp.getUi().alert(
      "✅ Verificación ejecutada.\n\n" +
      "Si había algo que reportar, ya se mandó un email a " + ALERT_EMAIL + ".\n\n" +
      "Si todo está OK, no recibirás nada (es lo esperado)."
    );
  } catch(e) {
    SpreadsheetApp.getUi().alert("❌ Error: " + e.message);
  }
}

// ════════════════════════════════════════════════════════════════
//  IMPORTACIÓN DE UPCs DESDE LISTA DE CVA
//
//  Flujo de uso (una sola vez por lote recibido de CVA):
//   1. Ejecutar "Crear hoja UPC_IMPORT" desde el menú
//   2. Pegar la lista de CVA en esa hoja (mínimo: clave + UPC)
//   3. Ejecutar "Importar UPCs a METADATA_PRODUCTOS"
//   4. Los UPCs quedan disponibles automáticamente en la PWA al
//      cargar Análisis (sin tener que editarlos uno por uno).
//
//  Comportamiento del UPSERT:
//   - Si el producto ya existe en METADATA_PRODUCTOS: solo se
//     actualiza el campo UPC (modelo/color/ganancia/cat_meli/peso
//     que ya tuvieras quedan intactos)
//   - Si no existe: se crea fila nueva con clave+marca+upc
// ════════════════════════════════════════════════════════════════

// Crea la hoja UPC_IMPORT con cabeceras claras y formato
function crearHojaUPCImport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  let sh = ss.getSheetByName("UPC_IMPORT");
  if (sh) {
    const resp = ui.alert("⚠️ La hoja UPC_IMPORT ya existe",
      "¿Quieres BORRAR su contenido actual y empezar de cero?\n\n" +
      "Si solo vas a agregar más UPCs, cancela y agrégalos al final.",
      ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return;
    ss.deleteSheet(sh);
  }
  sh = ss.insertSheet("UPC_IMPORT");

  // Cabeceras
  sh.getRange("A1:C1").setValues([["Clave CVA", "UPC", "Modelo"]])
    .setFontWeight("bold").setBackground("#00665e").setFontColor("#ffffff")
    .setHorizontalAlignment("center");
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 130);
  sh.setColumnWidth(2, 180);
  sh.setColumnWidth(3, 200);

  // Formato de la columna UPC: mínimo 12 dígitos con ceros a la izquierda
  sh.getRange("B:B").setNumberFormat("000000000000").setHorizontalAlignment("center");

  // Instrucciones
  sh.getRange("A3:C3").merge().setValue("✏ Cómo usar esta hoja:")
    .setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#67b8af")
    .setFontSize(11).setHorizontalAlignment("left");
  sh.getRange("A4:C4").merge()
    .setValue("1. Pega tu lista: Clave CVA (col A), UPC (col B), Modelo (col C) desde la fila 10.")
    .setBackground("#0a1f1d").setFontColor("#ddd").setFontSize(10);
  sh.getRange("A5:C5").merge()
    .setValue("2. El MODELO es importante — si lo dejas vacío, en SKU_INVENTARIO saldrá 'SIN MODELO' marcado en rojo.")
    .setBackground("#0a1f1d").setFontColor("#ddd").setFontSize(10);
  sh.getRange("A6:C6").merge()
    .setValue("3. Cuando termines: menú → 📥 Importar UPCs a METADATA_PRODUCTOS")
    .setBackground("#0a1f1d").setFontColor("#ddd").setFontSize(10);
  sh.getRange("A7:C7").merge()
    .setValue("4. El import enriquece automáticamente pesos y dimensiones desde CVA.")
    .setBackground("#0a1f1d").setFontColor("#ddd").setFontSize(10);

  sh.getRange("A8:C8").setBackground("#00665e");
  sh.setRowHeight(8, 4);

  sh.getRange("A9:C9").setValues([["(Clave CVA ↓)", "(UPC ↓)", "(Modelo ↓)"]])
    .setFontStyle("italic").setFontColor("#888888").setBackground("#f0f0f0")
    .setFontSize(10);

  ss.setActiveSheet(sh);
  ss.setActiveRange(sh.getRange("A10"));

  ui.alert("✅ Hoja UPC_IMPORT creada\n\n" +
    "Listo. Pega tu lista desde la fila 10:\n" +
    "  • Col A: Clave CVA\n" +
    "  • Col B: UPC\n" +
    "  • Col C: Modelo  ← IMPORTANTE para no tener 'SIN MODELO' después\n\n" +
    "Cuando termines: menú → 📥 Importar UPCs a METADATA_PRODUCTOS");
}

// Importa los UPCs de la hoja UPC_IMPORT a METADATA_PRODUCTOS
// Hace UPSERT por marca+clave: si ya existe, solo actualiza el UPC.
function importarUPCsDesdeHoja() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const shImp = ss.getSheetByName("UPC_IMPORT");
  if (!shImp) {
    ui.alert("⚠️ No existe la hoja UPC_IMPORT\n\n" +
      "Primero crea la hoja con: 🛠 MIS HERRAMIENTAS → 🏷 Crear hoja UPC_IMPORT");
    return;
  }

  // Datos a partir de la fila 10 (donde el usuario pegó)
  const lastRow = shImp.getLastRow();
  if (lastRow < 10) {
    ui.alert("⚠️ La hoja UPC_IMPORT está vacía\n\n" +
      "Pega la lista de UPCs de CVA en las columnas A y B a partir de la fila 10.");
    return;
  }

  const datosImp = shImp.getRange(10, 1, lastRow - 9, 3).getValues();

  // Confirmar antes de proceder
  const resp = ui.alert("📥 Importar UPCs",
    "Voy a procesar " + datosImp.length + " filas de UPC_IMPORT y " +
    "mergearlas a METADATA_PRODUCTOS.\n\n" +
    "Para productos que ya están en METADATA_PRODUCTOS: solo actualizo el UPC " +
    "(modelo, color, ganancia, etc. que ya tengas quedan intactos).\n\n" +
    "Para productos nuevos: creo fila nueva.\n\n" +
    "¿Continuar?",
    ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  // Cargar SYNC_CVA para obtener la marca de cada clave
  // Layout SYNC_CVA: A=clave, B=descripcion, C=marca
  const shSync = ss.getSheetByName("SYNC_CVA");
  const marcaPorClave = {};
  const descPorClave = {};
  if (shSync && shSync.getLastRow() > 1) {
    const syncData = shSync.getRange(2, 1, shSync.getLastRow() - 1, 3).getValues();
    syncData.forEach(r => {
      const k = String(r[0] || "").trim();
      if (k) {
        marcaPorClave[k] = String(r[2] || "").trim();
        descPorClave[k]  = String(r[1] || "").trim();
      }
    });
  }

  // Cargar o crear METADATA_PRODUCTOS
  let shMD = ss.getSheetByName("METADATA_PRODUCTOS");
  if (!shMD) {
    shMD = ss.insertSheet("METADATA_PRODUCTOS");
    shMD.appendRow(["clave_cva","marca","modelo","color","upc",
                    "ganancia","cat_meli","peso","editado_at",
                    "peso_kg","alto_cm","ancho_cm","profundidad_cm"]);
    shMD.getRange(1, 1, 1, 13).setFontWeight("bold")
      .setBackground("#00665e").setFontColor("#ffffff");
    shMD.setFrozenRows(1);
  } else {
    // Hoja ya existe — verificar que tenga las 4 cols nuevas, agregarlas si no
    const lastCol = shMD.getLastColumn();
    if (lastCol < 13) {
      const headersExtra = ["peso_kg","alto_cm","ancho_cm","profundidad_cm"];
      shMD.getRange(1, lastCol + 1, 1, 13 - lastCol).setValues([headersExtra.slice(0, 13 - lastCol)]);
      shMD.getRange(1, lastCol + 1, 1, 13 - lastCol).setFontWeight("bold")
        .setBackground("#00665e").setFontColor("#ffffff");
    }
  }

  // Construir índice marca+clave → row de METADATA_PRODUCTOS
  const mdLastRow = shMD.getLastRow();
  const idx = {};
  if (mdLastRow > 1) {
    const mdData = shMD.getRange(2, 1, mdLastRow - 1, 2).getValues();
    mdData.forEach((r, i) => {
      const k = String(r[0] || "").trim();
      const m = String(r[1] || "").trim().toUpperCase();
      if (k) idx[m + "-" + k] = i + 2;
    });
  }

  let actualizados = 0;
  let insertados = 0;
  let sinClaveEnSync = 0;
  let vacios = 0;
  const aAgregar = [];
  const sinSync = []; // claves no encontradas en SYNC_CVA (para reporte)
  const now = new Date();

  datosImp.forEach(row => {
    const clave = String(row[0] || "").trim();
    let upc = String(row[1] || "").trim();
    let modeloUsuario = String(row[2] || "").trim().toUpperCase();
    if (!clave || !upc) { vacios++; return; }

    // Limpiar UPC: solo dígitos
    upc = upc.replace(/\D/g, "");
    if (!upc) { vacios++; return; }
    if (upc.length < 12) upc = upc.padStart(12, "0");

    const marca = marcaPorClave[clave] || "";
    if (!marca) {
      sinClaveEnSync++;
      sinSync.push(clave);
    }

    const key = marca.toUpperCase() + "-" + clave;
    const existingRow = idx[key];

    if (existingRow) {
      // UPDATE: UPC (col E=5), editado_at (col I=9), y modelo (col C=3) si el usuario
      // lo proporcionó esta vez. Si está vacío en UPC_IMPORT, conservamos el de antes.
      shMD.getRange(existingRow, 5).setValue(upc);
      shMD.getRange(existingRow, 9).setValue(now);
      if (modeloUsuario) {
        shMD.getRange(existingRow, 3).setValue(modeloUsuario);
      }
      actualizados++;
    } else {
      // INSERT: nueva fila con el modelo del usuario (si lo dio)
      aAgregar.push([
        clave, marca,
        modeloUsuario, "",   // ← modelo desde UPC_IMPORT col C
        upc,
        "",                  // ganancia (default global)
        "", "",              // cat_meli, peso
        now
      ]);
      idx[key] = mdLastRow + aAgregar.length;
      insertados++;
    }
  });

  if (aAgregar.length > 0) {
    shMD.getRange(shMD.getLastRow() + 1, 1, aAgregar.length, 9).setValues(aAgregar);
  }

  // Flush para asegurar que los INSERTs sean visibles antes de releer
  SpreadsheetApp.flush();

  // ── PASO 2: poblar/actualizar la hoja SKU ──
  // La hoja SKU concentra todos los productos que ya tienen UPC, con la
  // fórmula que genera el código SKU final. Estructura:
  //   A=UPC  B=Categoría  C=Marca  D=Nombre completo
  //   E=Modelo  F=Color  G=SKU (fórmula)
  // El orden de C, E, F coincide con la fórmula original del usuario.
  // La fórmula toma los últimos 4 dígitos del UPC (col A) + sufijo "-CVA":
  //   =SUSTITUIR(MAYUSC(IZQUIERDA(C;3)&"-"&E&"-"&IZQUIERDA(F;3)&"-"&DERECHA(A;4)&"-CVA");" ";"")
  // La hoja fusionada SKU_INVENTARIO incluye también Stock CVA y Stock para Odoo
  // (lo que antes vivía en una hoja INVENTARIO_ODOO separada).
  let shSKU = ss.getSheetByName("SKU_INVENTARIO");
  if (!shSKU) {
    // Asegurar que CONFIG_MELI existe — las fórmulas de Precio MELI la necesitan
    _crearHojaConfigMeli_();

    shSKU = ss.insertSheet("SKU_INVENTARIO");
    shSKU.getRange("A1:T1").setValues([[
      "UPC", "Categoría", "Marca", "Nombre completo",
      "Modelo", "Color", "SKU", "Clave CVA",
      "Precio CVA", "Precio MELI",
      "Stock CVA", "Stock para Odoo",
      "Peso kg", "Alto cm", "Ancho cm", "Profundidad cm",
      "Emp Alto", "Emp Ancho", "Emp Prof", "Emp Peso kg"
    ]]);
    shSKU.getRange("A1:T1").setFontWeight("bold")
      .setBackground("#00665e").setFontColor("#ffffff")
      .setHorizontalAlignment("center");
    shSKU.setFrozenRows(1);
    shSKU.setRowHeight(1, 36);
    shSKU.setColumnWidth(1, 130);  // UPC
    shSKU.setColumnWidth(2, 180);  // Categoría
    shSKU.setColumnWidth(3, 130);  // Marca
    shSKU.setColumnWidth(4, 380);  // Nombre completo
    shSKU.setColumnWidth(5, 140);  // Modelo
    shSKU.setColumnWidth(6, 90);   // Color
    shSKU.setColumnWidth(7, 220);  // SKU
    shSKU.setColumnWidth(8, 120);  // Clave CVA
    shSKU.setColumnWidth(9, 110);  // Precio CVA
    shSKU.setColumnWidth(10, 130); // Precio MELI
    shSKU.setColumnWidth(11, 100); // Stock CVA
    shSKU.setColumnWidth(12, 130); // Stock para Odoo
    shSKU.setColumnWidth(13, 90);  // Peso kg
    shSKU.setColumnWidth(14, 80);  // Alto cm
    shSKU.setColumnWidth(15, 80);  // Ancho cm
    shSKU.setColumnWidth(16, 100); // Profundidad cm
    shSKU.setColumnWidth(17, 80);  // Emp Alto
    shSKU.setColumnWidth(18, 80);  // Emp Ancho
    shSKU.setColumnWidth(19, 80);  // Emp Prof
    shSKU.setColumnWidth(20, 100); // Emp Peso kg

    // Formato UPC: mínimo 12 dígitos con ceros a la izquierda
    shSKU.getRange("A:A").setNumberFormat("000000000000").setHorizontalAlignment("center");
    // Precio CVA (col I): moneda, fondo gris muy tenue (es informativo)
    shSKU.getRange("I:I").setNumberFormat("$#,##0.00").setHorizontalAlignment("right");
    shSKU.getRange("I2:I").setBackground("#f5f5f5").setFontColor("#666");
    // Precio MELI (col J): moneda sin centavos (siempre redondeado a 9)
    shSKU.getRange("J:J").setNumberFormat("$#,##0").setHorizontalAlignment("right");
    shSKU.getRange("J2:J").setBackground("#e8f5f4").setFontWeight("bold");
    // Stock CVA (col K)
    shSKU.getRange("K:K").setNumberFormat("#,##0").setHorizontalAlignment("right");
    // Stock para Odoo (col L)
    shSKU.getRange("L:L").setNumberFormat("#,##0").setHorizontalAlignment("right");
    shSKU.getRange("L2:L").setBackground("#d4f0ed").setFontWeight("bold");
    // Peso producto (col M)
    shSKU.getRange("M:M").setNumberFormat("0.0000").setHorizontalAlignment("right");
    shSKU.getRange("M2:M").setBackground("#fafafa").setFontColor("#555");
    // Dimensiones producto (N, O, P)
    shSKU.getRange("N:P").setNumberFormat("0.0").setHorizontalAlignment("right");
    shSKU.getRange("N2:P").setBackground("#fafafa").setFontColor("#555");
    // Empaque dimensiones (Q, R, S) — números cerrados, fondo amarillo tenue
    shSKU.getRange("Q:S").setNumberFormat("0").setHorizontalAlignment("right");
    shSKU.getRange("Q2:S").setBackground("#fff8e1").setFontWeight("bold");
    // Empaque peso (T)
    shSKU.getRange("T:T").setNumberFormat("0").setHorizontalAlignment("right");
    shSKU.getRange("T2:T").setBackground("#fff8e1").setFontWeight("bold");

    // ── Panel de configuración global (V:W) ──
    shSKU.getRange("V1:W1").merge().setValue("⚙ CONFIG ODOO")
      .setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#67b8af")
      .setHorizontalAlignment("center").setFontSize(11);
    shSKU.setRowHeight(2, 40);
    shSKU.getRange("V2").setValue("% Global:")
      .setBackground("#0a1f1d").setFontColor("#ddd").setHorizontalAlignment("right")
      .setVerticalAlignment("middle").setFontWeight("bold");
    shSKU.getRange("W2").setValue(20)
      .setBackground("#fff8e1").setFontWeight("bold").setFontSize(16)
      .setHorizontalAlignment("center").setVerticalAlignment("middle")
      .setNumberFormat("0\"%\"");
    const rulePct = SpreadsheetApp.newDataValidation()
      .requireNumberBetween(0, 100).setAllowInvalid(false).build();
    shSKU.getRange("W2").setDataValidation(rulePct);

    // Tipo de cambio configurable (default 17.50)
    shSKU.setRowHeight(3, 40);
    shSKU.getRange("V3").setValue("TC USD→MXN:")
      .setBackground("#0a1f1d").setFontColor("#ddd").setHorizontalAlignment("right")
      .setVerticalAlignment("middle").setFontWeight("bold");
    shSKU.getRange("W3").setValue(17.50)
      .setBackground("#e8f0fe").setFontWeight("bold").setFontSize(16)
      .setHorizontalAlignment("center").setVerticalAlignment("middle")
      .setNumberFormat("$0.00");
    const ruleTC = SpreadsheetApp.newDataValidation()
      .requireNumberBetween(1, 100).setAllowInvalid(false).build();
    shSKU.getRange("W3").setDataValidation(ruleTC);

    shSKU.getRange("V4:W4").merge().setValue("ℹ % Global ajusta Stock para Odoo (L)")
      .setBackground("#0a1f1d").setFontColor("#bbb").setFontSize(10).setFontStyle("italic");
    shSKU.getRange("V5:W5").merge().setValue("ℹ TC convierte productos USD a MXN")
      .setBackground("#0a1f1d").setFontColor("#bbb").setFontSize(10).setFontStyle("italic");
    shSKU.getRange("V6:W6").merge().setValue("ℹ Cols M-P: dimensiones del producto (CVA)")
      .setBackground("#0a1f1d").setFontColor("#bbb").setFontSize(10).setFontStyle("italic");
    shSKU.getRange("V7:W7").merge().setValue("ℹ Cols Q-T: empaque (calculado en CONFIG_MELI G:K)")
      .setBackground("#0a1f1d").setFontColor("#bbb").setFontSize(10).setFontStyle("italic");
    shSKU.getRange("V8:W8").merge().setValue("ℹ Mínimo: 20×20×20 cm · 1 kg")
      .setBackground("#0a1f1d").setFontColor("#bbb").setFontSize(10).setFontStyle("italic");

    shSKU.setColumnWidth(22, 240);  // V
    shSKU.setColumnWidth(23, 90);   // W

    // ── ARRAYFORMULAS vivas ──
    // Precio CVA (I): aplica el TC global (W3) como FACTOR MULTIPLICADOR a
    // TODOS los productos, tomando 17.50 como TC base de referencia.
    //   precio_final = precio_cva × (W3 / 17.50)
    //
    // Default W3 = 17.50  →  factor = 1.0  →  precios sin cambio
    // Si W3 = 18.50       →  factor = 1.057 → todos suben ~5.7%
    // Si W3 = 17.00       →  factor = 0.971 → todos bajan ~3%
    //
    // Esto te permite controlar el TC y ver el efecto inmediato en TODOS
    // los precios, sin importar si el producto vino originalmente en USD
    // o en Pesos. Es un ajuste proporcional global.
    shSKU.getRange("I2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",' +
        'IFERROR(VLOOKUP(H2:H,SYNC_CVA!$A:$E,5,FALSE),0) * ($W$3 / 17.5)' +
      '))'
    );
    // Stock CVA (K)
    shSKU.getRange("K2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",' +
      'IFERROR(VLOOKUP(H2:H,SYNC_CVA!$A:$H,7,FALSE),0)+' +
      'IFERROR(VLOOKUP(H2:H,SYNC_CVA!$A:$H,8,FALSE),0)))'
    );
    // Stock para Odoo (L) — ahora referencia $W$2 (panel se movió de S a W)
    shSKU.getRange("L2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",ROUNDDOWN(K2:K * $W$2 / 100, 0)))'
    );
    // Peso kg (M) — METADATA col J
    shSKU.getRange("M2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,10,FALSE),"")))'
    );
    // Alto / Ancho / Profundidad cm producto (N, O, P) — METADATA cols K, L, M
    shSKU.getRange("N2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,11,FALSE),"")))'
    );
    shSKU.getRange("O2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,12,FALSE),"")))'
    );
    shSKU.getRange("P2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,13,FALSE),"")))'
    );
    // ── Empaque (Q, R, S, T) ──
    // Usa LOOKUP a CONFIG_MELI!G:K para encontrar el empaque cuya dim máx ≥ dim máx del producto.
    // dim_max_producto = MAX(N, O, P)
    // CONFIG_MELI!G:G = umbral (Dim máx producto cm ≤)
    // CONFIG_MELI!H/I/J = Alto/Ancho/Prof del empaque
    // CONFIG_MELI!K = Peso kg del empaque
    //
    // LOOKUP requiere que el rango esté ORDENADO. La tabla en CONFIG_MELI lo está.
    // Si dim_max está por encima del último umbral (999), devuelve el último valor.
    //
    // SKU (G), Precio MELI (J), Empaque (Q,R,S,T) — TODAS ARRAYFORMULA
    shSKU.getRange("G2").setFormula(_formulaSKUArray_());
    shSKU.getRange("J2").setFormula(_formulaPrecioMELIArray_());
    shSKU.getRange("Q2").setFormula(_formulaEmpaqueAltoArray_());
    shSKU.getRange("R2").setFormula(_formulaEmpaqueAnchoArray_());
    shSKU.getRange("S2").setFormula(_formulaEmpaqueProfArray_());
    shSKU.getRange("T2").setFormula(_formulaEmpaquePesoArray_());

    SpreadsheetApp.flush();
  }

  // Asegurar SIEMPRE las ARRAYFORMULAS (aunque la hoja ya existiera).
  {
    const formulasVivas = {
      "G2":  _formulaSKUArray_(),
      "I2":  '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,SYNC_CVA!$A:$E,5,FALSE),0) * ($W$3 / 17.5)))',
      "J2":  _formulaPrecioMELIArray_(),
      "K2":  '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,SYNC_CVA!$A:$H,7,FALSE),0)+IFERROR(VLOOKUP(H2:H,SYNC_CVA!$A:$H,8,FALSE),0)))',
      "L2":  '=ARRAYFORMULA(IF(H2:H="","",ROUNDDOWN(K2:K * $W$2 / 100, 0)))',
      "M2":  '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,10,FALSE),"")))',
      "N2":  '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,11,FALSE),"")))',
      "O2":  '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,12,FALSE),"")))',
      "P2":  '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,13,FALSE),"")))',
      "Q2":  _formulaEmpaqueAltoArray_(),
      "R2":  _formulaEmpaqueAnchoArray_(),
      "S2":  _formulaEmpaqueProfArray_(),
      "T2":  _formulaEmpaquePesoArray_(),
    };
    // Forzar SIEMPRE re-set (no condicional) — así si había una fórmula vieja, se actualiza
    Object.keys(formulasVivas).forEach(celda => {
      shSKU.getRange(celda).setFormula(formulasVivas[celda]);
    });
    // % global default en W2
    const w2 = shSKU.getRange("W2").getValue();
    if (w2 === "" || w2 == null || isNaN(parseFloat(w2))) {
      shSKU.getRange("W2").setValue(20);
    }
    // Formato condicional para "SINMODELO"
    _aplicarFormatoCondicionalSKU_(shSKU);
  }

  // Recargar METADATA_PRODUCTOS (ya tiene los UPCs recién importados)
  // para sacar modelo/color (si existen) de los productos
  const mdData = shMD.getRange(2, 1, shMD.getLastRow() - 1, 5).getValues();
  const mdByClave = {};
  mdData.forEach(r => {
    const k = String(r[0] || "").trim();
    if (k) {
      mdByClave[k] = {
        modelo: String(r[2] || "").trim(),
        color:  String(r[3] || "").trim(),
        upc:    String(r[4] || "").trim(),
      };
    }
  });

  // Re-leer SYNC_CVA con grupo (col D)
  const grupoPorClave = {};
  if (shSync && shSync.getLastRow() > 1) {
    const syncData2 = shSync.getRange(2, 1, shSync.getLastRow() - 1, 4).getValues();
    syncData2.forEach(r => {
      const k = String(r[0] || "").trim();
      if (k) grupoPorClave[k] = String(r[3] || "").trim();
    });
  }

  // Índice por UPC en hoja SKU para UPSERT (el UPC es la llave única visible)
  // Buscamos hasta donde realmente haya datos en col A (UPC), no usamos
  // getLastRow porque las ARRAYFORMULAS J/K lo inflan.
  const colA = shSKU.getRange("A2:A").getValues();
  let skuLastRow = 1;
  for (let i = colA.length - 1; i >= 0; i--) {
    const v = colA[i][0];
    if (v !== "" && v !== null && v !== undefined) {
      skuLastRow = i + 2;
      break;
    }
  }
  const skuIdx = {};
  if (skuLastRow > 1) {
    const skuData = shSKU.getRange(2, 1, skuLastRow - 1, 1).getValues();
    skuData.forEach((r, i) => {
      const u = String(r[0] || "").trim();
      if (u) skuIdx[u] = i + 2;
    });
  }

  let skuAct = 0, skuIns = 0;
  let skuSaltadosSinUpc = 0;  // productos en UPC_IMPORT que no quedaron en METADATA con UPC
  const skuAAgregar = [];

  // Recorremos los datos importados — generar una fila de SKU por cada UPC válido
  datosImp.forEach(row => {
    const claveSKU = String(row[0] || "").trim();
    if (!claveSKU) return;
    const md = mdByClave[claveSKU];
    if (!md || !md.upc) {
      skuSaltadosSinUpc++;
      return;  // sin UPC en metadata = no procesar
    }

    const marcaSKU = marcaPorClave[claveSKU] || "";
    const descSKU  = descPorClave[claveSKU]  || "";
    const grupoCVA = grupoPorClave[claveSKU] || "";

    // Categoría visible: ELECTRONICS (mapeada desde grupo CVA via CAT_ELECTRONICS).
    // Categoría interna (cat_meli): la que va a METADATA_PRODUCTOS col G y se usa
    // para calcular comisión MELI en la fórmula del Precio MELI.
    const categoriaElect = _mapeoCATELECT_(grupoCVA, descSKU);
    const categoriaMELI  = _electToMELI_(categoriaElect, grupoCVA, descSKU);
    // Si no hay match Electronics y existe CAT_ELECTRONICS, dejar vacío para
    // categorización manual. Si CAT_ELECTRONICS no existe, usar MELI como fallback.
    const categoriaB = categoriaElect || categoriaMELI;

    // Modelo y Color: prioridad
    //   1) Lo que ya esté en METADATA_PRODUCTOS (editado desde PWA)
    //   2) Heurística extraída de la descripción
    //   3) Fallback "SIN MODELO" / "NEGRO" para que la fórmula SKU genere algo válido
    // En todos los casos LIMPIAR símbolos (. , : ; _ / -) → espacios.
    const modeloAuto = _limpiarModelo_(md.modelo || _extraerModelo_GS_(descSKU, marcaSKU) || "SIN MODELO");
    const colorAuto  = md.color  || _extraerColor_GS_(descSKU)             || "NEGRO";

    if (skuIdx[md.upc]) {
      // UPDATE por UPC: actualizar categoría Electronics (B), marca, nombre.
      // Modelo/Color solo si la celda actual está vacía (respeta ediciones manuales).
      const r = skuIdx[md.upc];
      shSKU.getRange(r, 2).setValue(categoriaB);     // ← Categoría Electronics
      shSKU.getRange(r, 3).setValue(marcaSKU);
      shSKU.getRange(r, 4).setValue(descSKU);
      const modeloActual = String(shSKU.getRange(r, 5).getValue() || "").trim();
      const colorActual  = String(shSKU.getRange(r, 6).getValue() || "").trim();
      if (!modeloActual) shSKU.getRange(r, 5).setValue(modeloAuto);
      else {
        // Re-limpiar el modelo existente (por si tiene símbolos viejos)
        const limpio = _limpiarModelo_(modeloActual);
        if (limpio !== modeloActual) shSKU.getRange(r, 5).setValue(limpio);
      }
      if (!colorActual)  shSKU.getRange(r, 6).setValue(colorAuto);
      // Clave CVA (col H = 8) — siempre actualizar
      shSKU.getRange(r, 8).setValue(claveSKU);

      // METADATA_PRODUCTOS col G (cat_meli) — actualizar siempre con el MELI calculado
      if (idx[claveSKU]) {
        shMD.getRange(idx[claveSKU], 7).setValue(categoriaMELI);
      }
      skuAct++;
    } else {
      // INSERT — solo cols A-H. Cols G (SKU), I, J (Precio MELI), K, L, M-P, Q-T
      // son ARRAYFORMULA en fila 2, se llenan solas al insertar la clave.
      skuAAgregar.push([
        md.upc, categoriaB, marcaSKU, descSKU,
        modeloAuto, colorAuto,
        "",         // SKU — ARRAYFORMULA lo llena
        claveSKU,   // Clave CVA
      ]);
      skuIdx[md.upc] = skuLastRow + skuAAgregar.length;
      skuIns++;

      // Asegurar cat_meli en METADATA_PRODUCTOS (para la fórmula Precio MELI)
      if (idx[claveSKU]) {
        shMD.getRange(idx[claveSKU], 7).setValue(categoriaMELI);
      }
    }
  });

  // Agregar las filas nuevas y luego inyectar las fórmulas vivas en cada una
  if (skuAAgregar.length > 0) {
    // ⚠ NO usar shSKU.getLastRow() — las ARRAYFORMULAS rellenan las cols con ""
    // hasta el final del sheet. Usamos col H (Clave CVA) directamente.
    const colH = shSKU.getRange("H2:H").getValues();
    let ultimaFilaH = 1;
    for (let i = colH.length - 1; i >= 0; i--) {
      const v = colH[i][0];
      if (v !== "" && v !== null && v !== undefined) {
        ultimaFilaH = i + 2;
        break;
      }
    }
    const firstNewRow = ultimaFilaH + 1;
    Logger.log("[SKU INSERT] firstNewRow=" + firstNewRow + " (ultimaFilaH=" + ultimaFilaH + ")");

    // Solo 8 columnas (A-H) — las cols G, I, J, K, L, M-P, Q-T son ARRAYFORMULA
    // en la fila 2 y se llenan automáticamente al insertar la clave en col H.
    shSKU.getRange(firstNewRow, 1, skuAAgregar.length, 8).setValues(skuAAgregar);
    // No se inyectan fórmulas por fila — todas son ARRAYFORMULA.
  }

  // Flush para asegurar que SKU se materialice antes del reporte final
  SpreadsheetApp.flush();

  // ── PASO 3: limpiar UPC_IMPORT si todo salió bien ──
  // Borramos solo los datos pegados (filas 10+), conservamos cabeceras e
  // instrucciones (filas 1-9). Así la hoja queda lista para el próximo lote.
  if (lastRow >= 10) {
    shImp.getRange(10, 1, lastRow - 9, 3).clearContent();
  }

  // Regenerar la hoja SKU automáticamente — así los SKUs reflejan los UPCs
  // recién importados sin que el usuario tenga que hacer un paso extra.

  // ── Enriquecimiento automático de pesos + dimensiones ──
  // Solo se ejecuta si NO estamos en modo silencioso. setupCompleto programa
  // el enriquecimiento aparte via trigger asíncrono para evitar timeout.
  const silenciosoFlag = PropertiesService.getDocumentProperties().getProperty("UPC_IMPORT_SILENCIOSO") === "true";
  let enriquecimiento = null;
  if (!silenciosoFlag) {
    try {
      enriquecimiento = _enriquecerPesosCore_({ silencioso: true });
    } catch(e) {
      enriquecimiento = { ok: false, error: e.message };
    }
  } else {
    enriquecimiento = { ok: true, skipped: true, mensaje: "Se ejecutará async via trigger" };
  }

  // Reporte final
  let msg = "✅ IMPORTACIÓN COMPLETADA\n\n";
  msg += "📋 METADATA_PRODUCTOS\n";
  msg += "  • Procesados:    " + datosImp.length + "\n";
  msg += "  • Actualizados:  " + actualizados + " (UPC nuevo en producto ya conocido)\n";
  msg += "  • Insertados:    " + insertados + " (producto nuevo)\n";
  if (vacios > 0)
    msg += "  • Filas vacías:  " + vacios + "\n";
  if (sinClaveEnSync > 0)
    msg += "  • Sin marca:     " + sinClaveEnSync + " (clave no está en SYNC_CVA)\n";
  msg += "\n🏷 HOJA SKU_INVENTARIO\n";
  msg += "  • Actualizados:  " + skuAct + "\n";
  msg += "  • Insertados:    " + skuIns + " (con fórmulas SKU y Precio MELI automáticas)\n";
  if (skuSaltadosSinUpc > 0)
    msg += "  • ⚠ Saltados:    " + skuSaltadosSinUpc + " (no quedaron con UPC en METADATA_PRODUCTOS — revisar columna E ahí)\n";

  // Reporte del enriquecimiento
  msg += "\n📏 PESOS + DIMENSIONES desde CVA\n";
  if (enriquecimiento && enriquecimiento.ok) {
    msg += "  • Total productos: " + (enriquecimiento.total || 0) + "\n";
    msg += "  • ✅ Con datos:     " + (enriquecimiento.actualizadas || 0) + "\n";
    if (enriquecimiento.sin_dimensiones)
      msg += "  • ⚠ Sin datos CVA: " + enriquecimiento.sin_dimensiones + "\n";
    if (enriquecimiento.errores)
      msg += "  • ❌ Errores:       " + enriquecimiento.errores + "\n";
    msg += "  • 📋 Detalle en hoja _DIAG_PESOS\n";
  } else {
    msg += "  • ⚠ No se pudo enriquecer\n";
    msg += "  • Error: " + (enriquecimiento ? enriquecimiento.error : "desconocido") + "\n";
    msg += "  • Reintenta: Avanzado → 🔬 Re-enriquecer pesos (CVA)\n";
  }

  msg += "\n🧹 UPC_IMPORT limpiada — lista para el próximo lote.\n";
  if (sinClaveEnSync > 0) {
    if (sinSync.length <= 10) {
      msg += "\nClaves sin marca:\n  " + sinSync.join(", ") + "\n";
    } else {
      msg += "\nClaves sin marca (primeras 10 de " + sinSync.length + "):\n  " + sinSync.slice(0, 10).join(", ") + "...\n";
    }
  }
  msg += "\n📱 Los UPCs ya están disponibles. Recarga la PWA en el dashboard de Análisis " +
         "y los verás en cada producto (sin rojo en la columna UPC).";

  // Suprimir diálogo si se llama desde setupCompleto
  const silencioso = PropertiesService.getDocumentProperties().getProperty("UPC_IMPORT_SILENCIOSO") === "true";
  if (!silencioso) ui.alert(msg);
}

// ════════════════════════════════════════════════════════════════
//  HEURÍSTICAS de extracción de Modelo y Color
//  Portadas desde app.js para usarlas en GAS al poblar la hoja SKU.
//  Misma lógica = mismo resultado que la PWA.
// ════════════════════════════════════════════════════════════════

const _MODELO_EXCLUIDAS_GS = {
  // Specs / unidades
  'GB':1,'TB':1,'MB':1,'KB':1,'RAM':1,'ROM':1,'SSD':1,'HDD':1,'NVME':1,
  'USB':1,'USB2':1,'USB3':1,'HDMI':1,'VGA':1,'DVI':1,'BT':1,'WIFI':1,'LAN':1,
  'RGB':1,'FHD':1,'UHD':1,'QHD':1,'HD':1,'4K':1,'8K':1,'IPS':1,'OLED':1,
  'LED':1,'LCD':1,'AMOLED':1,'MAH':1,'MHZ':1,'GHZ':1,'HZ':1,'WATT':1,
  'W':1,'KG':1,'KW':1,'AMP':1,'MA':1,'V':1,'A':1,
  // Procesadores
  'I3':1,'I5':1,'I7':1,'I9':1,'RYZEN':1,'INTEL':1,'AMD':1,'RTX':1,'GTX':1,
  'NVIDIA':1,'ATHLON':1,'CELERON':1,'PENTIUM':1,
  // OS
  'WIN10':1,'WIN11':1,'WINDOWS':1,'MACOS':1,'LINUX':1,'ANDROID':1,'IOS':1,
  'CHROMEOS':1,'CHROME':1,
  // Genéricas
  'CON':1,'SIN':1,'DE':1,'EL':1,'LA':1,'LOS':1,'LAS':1,'PARA':1,'POR':1,
  'EN':1,'Y':1,'O':1,'AL':1,'UN':1,'UNA':1,
  'INALAMBRICO':1,'INALAMBRICOS':1,'INALAMBRICA':1,'INALAMBRICAS':1,
  'ALAMBRICO':1,'ALAMBRICA':1,'BLUETOOTH':1,'OPTICO':1,'MECANICO':1,
  'GAMING':1,'ESTUCHE':1,'AURICULARES':1,'AUDIFONOS':1,'BOCINA':1,
  'LAPTOP':1,'MONITOR':1,'TABLET':1,'TABLETA':1,'TELEFONO':1,'CELULAR':1,
  'SMARTPHONE':1,'IMPRESORA':1,'TECLADO':1,'MOUSE':1,
  'PULGADAS':1,'PULGADA':1,'APLICA':1,'NUEVO':1,'NUEVA':1,'MODELO':1,
  // Colores
  'NEGRO':1,'BLANCO':1,'AZUL':1,'ROJO':1,'VERDE':1,'ROSA':1,'MORADO':1,
  'AMARILLO':1,'PLATA':1,'PLATEADO':1,'DORADO':1,'ORO':1,'GRIS':1,
  'NARANJA':1,'CAFE':1,'MARRON':1,'TURQUESA':1,'BEIGE':1,'COSMIC':1,
  'BLACK':1,'WHITE':1,'BLUE':1,'RED':1,'GREEN':1,'PINK':1,'PURPLE':1,
  'YELLOW':1,'SILVER':1,'GOLD':1,'GRAY':1,'GREY':1,'ORANGE':1,'BROWN':1,
};

function _extraerModelo_GS_(desc, marca) {
  if (!desc) return null;
  const tokens = desc.toUpperCase().split(/[\s,;:()\/]+/).filter(Boolean);
  const marcaUpper = (marca || '').toUpperCase();

  let best = null, bestScore = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const tBare = t.replace(/[\-\.]/g, '');
    if (tBare.length < 3) continue;
    if (t === marcaUpper) continue;
    if (_MODELO_EXCLUIDAS_GS[t] || _MODELO_EXCLUIDAS_GS[tBare]) continue;
    if (/^\d+(GB|TB|MB|KB|MAH|MHZ|GHZ|W|KG)$/.test(t)) continue;
    if (/^\d+X\d+$/.test(t)) continue;

    const tieneLetras = /[A-Z]/.test(tBare);
    const tieneNumeros = /\d/.test(tBare);

    let score = 0;
    if (tieneLetras && tieneNumeros) score += 20;
    if (tBare.length >= 4 && tBare.length <= 15) score += 5;
    if (/^[A-Z]/.test(tBare)) score += 2;
    if (!/^\d+$/.test(tBare)) score += 5;
    if (i <= 3) score += 3;
    if (tieneLetras && !tieneNumeros) score -= 5;
    if (!tieneLetras && !tieneNumeros) score -= 10;

    if (score > bestScore) { bestScore = score; best = t; }
  }
  // Aplicar limpieza al modelo encontrado (símbolos → espacios, MAYÚSCULAS, sin acentos)
  return bestScore >= 25 ? _limpiarModelo_(best) : null;
}

// Heurística para detectar color desde la descripción del producto.
// Devuelve el NOMBRE COMPLETO en mayúsculas (ej. "NEGRO", "BLANCO").
// Para el SKU se usa LEFT(F,3) en la fórmula, así que la abreviación
// se genera automáticamente al construir el SKU.
const _COLORES_MAP_GS = [
  [/\b(NEGRO|BLACK|NEGRA|NOIR|GRAPHITE)\b/i,         'NEGRO'],
  [/\b(BLANCO|WHITE|BLANCA)\b/i,                     'BLANCO'],
  [/\b(AZUL|BLUE|AZUR|NAVY)\b/i,                     'AZUL'],
  [/\b(ROJO|RED|ROJA|CRIMSON)\b/i,                   'ROJO'],
  [/\b(VERDE|GREEN|MINT|OLIVE)\b/i,                  'VERDE'],
  [/\b(AMARILLO|YELLOW|GOLDEN)\b/i,                  'AMARILLO'],
  [/\b(PLATA|SILVER|PLATEADO)\b/i,                   'PLATA'],
  [/\b(GRIS|GRAY|GREY|TITANIUM)\b/i,                 'GRIS'],
  [/\b(DORADO|GOLD|ORO)\b/i,                         'DORADO'],
  [/\b(ROSA|PINK|ROSADO)\b/i,                        'ROSA'],
  [/\b(MORADO|PURPLE|VIOLETA)\b/i,                   'MORADO'],
  [/\b(NARANJA|ORANGE)\b/i,                          'NARANJA'],
  [/\b(CAFE|BROWN|MARRON)\b/i,                       'CAFE'],
  [/\b(BEIGE|CREAM|CREMA)\b/i,                       'BEIGE'],
  [/\b(TURQUESA|TURQUOISE|TEAL)\b/i,                 'TURQUESA'],
];

function _extraerColor_GS_(desc) {
  if (!desc) return null;
  for (let i = 0; i < _COLORES_MAP_GS.length; i++) {
    const re = _COLORES_MAP_GS[i][0];
    const abrev = _COLORES_MAP_GS[i][1];
    if (re.test(desc)) return abrev;
  }
  return null;
}

// Fuerza recálculo de las ARRAYFORMULAS de SKU_INVENTARIO. SYNC_CVA puede
// cambiar (sync nuevo de CVA) y Sheets no siempre reevalúa al instante.
function refrescarInventarioOdoo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("SKU_INVENTARIO");
  if (!sh) {
    if (typeof SpreadsheetApp.getUi === "function") {
      try {
        SpreadsheetApp.getUi().alert("⚠️ No existe la hoja SKU_INVENTARIO\n\n" +
          "Se crea automáticamente al importar UPCs:\n" +
          "  🛠 MIS HERRAMIENTAS → 📥 Importar UPCs a METADATA_PRODUCTOS");
      } catch(e) {}
    }
    return { ok: false, error: "Hoja SKU_INVENTARIO no existe" };
  }

  // Truco: re-escribir el valor de W2 (% global) sobre sí mismo fuerza recálculo
  // de las fórmulas que lo referencian (Stock para Odoo en col L).
  const w2 = sh.getRange("W2").getValue();
  sh.getRange("W2").setValue(w2);

  // Reescribir las fórmulas raíz (ARRAYFORMULA) para forzar reevaluación:
  //   I=Precio CVA, K=Stock CVA, L=Stock Odoo, M=Peso, N/O/P=dimensiones producto
  //   (Empaque Q-T son por fila, no global)
  ["I2", "K2", "L2", "M2", "N2", "O2", "P2"].forEach(ref => {
    const cell = sh.getRange(ref);
    const formula = cell.getFormula();
    if (formula) {
      cell.setFormula(formula);
    }
  });

  SpreadsheetApp.flush();

  // Solo si está siendo llamado interactivamente desde menú
  if (typeof SpreadsheetApp.getUi === "function") {
    try {
      const lastRow = _ultimaFilaSKUInventario_(sh);
      SpreadsheetApp.getUi().alert("✅ SKU_INVENTARIO refrescado\n\n" +
        "• Filas activas: " + Math.max(0, lastRow - 1) + "\n" +
        "• Stock CVA reevaluado con datos actuales de SYNC_CVA\n" +
        "• Stock para Odoo recalculado con el % global");
    } catch(e) {
      // Llamado desde trigger, no hay UI — silencioso
    }
  }
  return { ok: true, filas: Math.max(0, _ultimaFilaSKUInventario_(sh) - 1) };
}

// Encuentra la última fila con dato real en SKU_INVENTARIO.
// NO uses sh.getLastRow() en esta hoja: las ARRAYFORMULAS de J2 y K2
// rellenan esas columnas con "" hasta el final del sheet, y getLastRow
// las cuenta como contenido (devuelve 1000 en lugar de la fila real).
// Esta función mira solo la columna H (Clave CVA), que es donde vive
// el dato del producto.
function _ultimaFilaSKUInventario_(sh) {
  const colH = sh.getRange("H2:H").getValues();
  for (let i = colH.length - 1; i >= 0; i--) {
    const v = colH[i][0];
    if (v !== "" && v !== null && v !== undefined) {
      return i + 2;  // +2 porque leemos desde fila 2
    }
  }
  return 1;  // solo header
}

function instalarTriggerInventarioOdoo() {
  const ui = SpreadsheetApp.getUi();
  // Borrar triggers viejos del mismo handler para evitar duplicados
  const triggers = ScriptApp.getProjectTriggers();
  let yaExiste = 0;
  triggers.forEach(t => {
    if (t.getHandlerFunction() === "refrescarInventarioOdoo") {
      yaExiste++;
    }
  });
  if (yaExiste > 0) {
    const resp = ui.alert("⚠ El trigger ya está activo",
      "Hay " + yaExiste + " trigger(s) configurado(s) para refrescar inventario " +
      "cada 10 minutos.\n\n" +
      "¿Quieres BORRARLO y reinstalarlo desde cero?",
      ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return;
    triggers.forEach(t => {
      if (t.getHandlerFunction() === "refrescarInventarioOdoo") {
        ScriptApp.deleteTrigger(t);
      }
    });
  }
  ScriptApp.newTrigger("refrescarInventarioOdoo")
    .timeBased().everyMinutes(10).create();
  ui.alert("✅ Trigger instalado\n\n" +
    "refrescarInventarioOdoo se ejecutará cada 10 minutos automáticamente.\n\n" +
    "Para verlo: extensiones → Apps Script → Triggers (⏰ icono lateral)");
}

function desinstalarTriggerInventarioOdoo() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  triggers.forEach(t => {
    if (t.getHandlerFunction() === "refrescarInventarioOdoo") {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  SpreadsheetApp.getUi().alert(removed > 0
    ? "✅ Triggers desinstalados: " + removed + "\n\nEl inventario solo se actualizará cuando refresques manualmente."
    : "ℹ El trigger no estaba instalado.");
}

// ════════════════════════════════════════════════════════════════
//  CONFIG_MELI — tablas de comisiones, envíos y % ganancia global
//
//  Esta hoja la consultan las fórmulas de Precio MELI (en SKU e
//  INVENTARIO_ODOO). Cambia un valor aquí y todos los precios MELI
//  recalculan automáticamente en tiempo real.
// ════════════════════════════════════════════════════════════════

function _crearHojaConfigMeli_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("CONFIG_MELI");
  if (sh) return sh;  // ya existe, no la toco

  sh = ss.insertSheet("CONFIG_MELI");

  // Anchos
  sh.setColumnWidth(1, 280);
  sh.setColumnWidth(2, 100);
  sh.setColumnWidth(3, 30);
  sh.setColumnWidth(4, 240);
  sh.setColumnWidth(5, 110);

  // ── Tabla 1: Comisiones por categoría MELI (Clásica) ──
  // Datos OFICIALES del calculador de Eric. Las categorías deben coincidir
  // EXACTAMENTE con lo que se ponga en SKU_INVENTARIO col B.
  sh.getRange("A1:B1").setValues([["Categoría MELI", "Comisión %"]])
    .setFontWeight("bold").setBackground("#00665e").setFontColor("#ffffff")
    .setHorizontalAlignment("center");

  const comisiones = [
    // Electrónica
    ["Televisores",                          11.0],
    ["Consolas de videojuegos",               9.0],
    ["Computación e impresión",              11.0],
    ["Celulares y smartphones",              11.0],
    ["Audio y video",                        12.5],
    ["Cámaras y drones",                     11.0],
    ["Accesorios electrónicos",              14.0],
    // Automotriz
    ["Productos vehiculares",                14.0],
    // Artículos de consumo
    ["Alimentos y bebidas",                  11.0],
    ["Higiene personal",                     14.0],
    ["Artículos de limpieza",                14.0],
    // Salud y belleza
    ["Salud y equipamiento médico",          14.0],
    ["Belleza",                              14.0],
    // Bebés
    ["Bebés",                                16.0],
    ["Juegos y Juguetes",                    16.0],
    // Deporte
    ["Otros artículos de deportes",          16.0],
    ["Bicicletas y ciclismo",                16.0],
    // Moda
    ["Ropa, calzado, maletas y accesorios",  16.0],
    ["Relojes",                              16.0],
    ["Joyería",                              19.0],
    // Hogar
    ["Grandes electrodomésticos",            16.0],
    ["Pequeños electrodomésticos",           16.0],
    ["Hogar (interior y exterior)",          16.0],
    // Herramientas
    ["Herramientas manuales",                16.0],
    ["Herramientas eléctricas",              14.5],
    ["Materiales construcción",              16.0],
    // Hobbies
    ["Multimedia, libros y otros",           16.0],
    ["Boletas para espectáculos",            16.0],
    ["Videojuegos",                          16.0],
    ["Hobbies, arte y coleccionables",       16.0],
    ["Instrumentos musicales",               16.0],
    // Mascotas
    ["Animales y mascotas",                  14.0],
    ["Alimento para animales",               11.0],
    // Industria
    ["Papelería y Otros",                    11.0],
    ["Industria y oficina",                  13.0],
    // Otros
    ["Biolab",                               15.0],
  ];
  sh.getRange(2, 1, comisiones.length, 2).setValues(comisiones);
  sh.getRange(2, 2, comisiones.length, 1).setNumberFormat("0.0\"%\"").setHorizontalAlignment("right");

  // ── Tabla 2: Envíos por peso (debajo de comisiones) ──
  // Nombres EXACTOS como aparecen en el calculador oficial.
  // Los costos son aproximaciones — si MeLi cambia, edita aquí.
  const startPeso = comisiones.length + 4;  // unas filas debajo
  sh.getRange(startPeso, 1, 1, 2).setValues([["Peso (texto exacto)", "Envío $"]])
    .setFontWeight("bold").setBackground("#00665e").setFontColor("#ffffff")
    .setHorizontalAlignment("center");

  const pesos = [
    ["Hasta 0.5 Kg",   65.50],   // ← dato real del calculador de Eric
    ["0.5 a 1 Kg",     80],
    ["1 a 2 kg",       90],
    ["2 a 3 kg",       95],
    ["3 a 5 kg",      100],       // ← dato real del calculador de Eric
    ["5 a 7 kg",      130],
    ["7 a 9 kg",      160],
    ["9 a 12 kg",     190],
    ["12 a 15 kg",    230],
    ["15 a 20 kg",    280],
    ["20 a 30 kg",    360],
    ["30 a 40 kg",    480],
    ["40 a 50 kg",    600],
    ["50 a 60 kg",    750],
  ];
  sh.getRange(startPeso + 1, 1, pesos.length, 2).setValues(pesos);
  sh.getRange(startPeso + 1, 2, pesos.length, 1).setNumberFormat("$#,##0.00").setHorizontalAlignment("right");

  // ── % Ganancia Global (D1:E2) ──
  sh.getRange("D1:E1").setValues([["⚙ Ganancia Global", "Valor"]])
    .setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#67b8af")
    .setHorizontalAlignment("center");
  sh.getRange("D2").setValue("% Ganancia neta sobre costo CVA");
  sh.getRange("E2").setValue(5)   // 5% neto = la instrucción original
    .setBackground("#fff8e1").setFontWeight("bold").setFontSize(14)
    .setHorizontalAlignment("center").setNumberFormat("0.0\"%\"");

  const rulePct = SpreadsheetApp.newDataValidation()
    .requireNumberBetween(0, 100).setAllowInvalid(false)
    .setHelpText("Entre 0 y 100").build();
  sh.getRange("E2").setDataValidation(rulePct);

  // Notas
  sh.getRange("D5").setValue("ℹ Cambia estos valores cuando quieras")
    .setFontStyle("italic").setFontColor("#888").setFontSize(10);
  sh.getRange("D6").setValue("ℹ Las fórmulas de SKU_INVENTARIO recalculan al instante")
    .setFontStyle("italic").setFontColor("#888").setFontSize(10);
  sh.getRange("D7").setValue("ℹ Si una categoría/peso no está en la tabla,")
    .setFontStyle("italic").setFontColor("#888").setFontSize(10);
  sh.getRange("D8").setValue("    usa fallback: comisión 14%, envío $240")
    .setFontStyle("italic").setFontColor("#888").setFontSize(10);
  sh.getRange("D9").setValue("ℹ Datos del calculador oficial de Eric")
    .setFontStyle("italic").setFontColor("#888").setFontSize(10);

  // ── Tabla 3: Empaques estándar (G:K) ──
  // El empaque se elige por la dimensión MÁXIMA del producto (LOOKUP TRUE).
  // Mínimo absoluto: 20×20×20 cm, 1 kg.
  // Los valores son todos enteros ("números cerrados") y editables.
  sh.getRange("G1:K1").merge().setValue("📦 EMPAQUES ESTÁNDAR (mín. 20×20×20 / 1 kg)")
    .setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#67b8af")
    .setHorizontalAlignment("center").setFontSize(11);
  sh.getRange("G2:K2").setValues([["Dim máx producto cm ≤", "Alto", "Ancho", "Profundidad", "Peso kg"]])
    .setFontWeight("bold").setBackground("#00665e").setFontColor("#ffffff")
    .setHorizontalAlignment("center");

  const empaques = [
    [15,   20,  20,  20,   1],
    [20,   25,  25,  25,   1],
    [25,   30,  30,  30,   2],
    [30,   35,  35,  35,   2],
    [35,   40,  40,  40,   3],
    [45,   50,  50,  50,   4],
    [55,   60,  60,  60,   6],
    [70,   80,  60,  60,   8],
    [90,  100,  70,  70,  12],
    [110, 120,  80,  80,  18],
    [999, 150, 100, 100,  25],
  ];
  sh.getRange(3, 7, empaques.length, 5).setValues(empaques);
  sh.getRange(3, 7, empaques.length, 5).setHorizontalAlignment("right").setNumberFormat("0");

  // Anchos para las nuevas cols
  sh.setColumnWidth(7,  170);  // G
  sh.setColumnWidth(8,   60);  // H
  sh.setColumnWidth(9,   60);  // I (alto)
  sh.setColumnWidth(10,  90);  // J
  sh.setColumnWidth(11,  80);  // K (peso)

  sh.setFrozenRows(1);

  // Guardar metadatos del rango de las tablas
  PropertiesService.getDocumentProperties().setProperties({
    "CONFIG_MELI_COM_RANGE":   "A2:B" + (1 + comisiones.length),
    "CONFIG_MELI_PESO_RANGE":  "A" + (startPeso + 1) + ":B" + (startPeso + pesos.length),
    "CONFIG_MELI_EMP_RANGE":   "G3:K" + (2 + empaques.length),
  });

  return sh;
}

// ════════════════════════════════════════════════════════════════
//  Helpers de fórmulas vivas para hoja SKU
//  Se inyectan por fila (en setFormula), no como ARRAYFORMULA global,
//  porque MAP+LAMBDA sobre rango columna entera puede dar timeout en
//  hojas con muchas filas.
// ════════════════════════════════════════════════════════════════

// Fórmula SKU: MARCA(3) - MODELO - COLOR(3) - últimos 4 del UPC - CVA
// SKU por fila (mantenido por compatibilidad, pero la ARRAY se usa para SKU_INVENTARIO)
function _formulaSKU_(r) {
  return `=SUBSTITUTE(UPPER(LEFT(C${r},3)&"-"&E${r}&"-"&LEFT(F${r},3)&"-"&RIGHT(A${r},4)&"-CVA")," ","")`;
}

// SKU ARRAYFORMULA — versión dinámica que cubre todas las filas
function _formulaSKUArray_() {
  return '=ARRAYFORMULA(IF(A2:A="","",' +
    'SUBSTITUTE(UPPER(LEFT(C2:C,3)&"-"&E2:E&"-"&LEFT(F2:F,3)&"-"&RIGHT(A2:A,4)&"-CVA")," ","")' +
  '))';
}

// Fórmula Precio MELI Clásica para la fila r.
//   costo  = precio CVA (SYNC_CVA col E) por clave (col H de SKU)
//   catMeli = METADATA_PRODUCTOS!G por clave
//   peso    = METADATA_PRODUCTOS!H por clave
//   com     = CONFIG_MELI lookup catMeli (fallback 14%)
//   env     = CONFIG_MELI lookup peso (fallback $240)
//   gan     = CONFIG_MELI!E2
//   precio = (costo<=298 ? costo*(1+com)+33 : costo*(1+com)+env) * (1+gan/100)
function _formulaPrecioMELI_(r) {
  // ... (versión por fila — se mantiene por compatibilidad pero no se usa)
  return '=IFERROR(LET(' +
    `costo,IFERROR(I${r},0),` +
    `catMeli,B${r},` +
    `peso,IFERROR(VLOOKUP(H${r},METADATA_PRODUCTOS!$A:$H,8,FALSE),""),` +
    'com,IFNA(VLOOKUP(catMeli,CONFIG_MELI!$A:$B,2,FALSE),14)/100,' +
    'env,IFNA(VLOOKUP(peso,CONFIG_MELI!$A:$B,2,FALSE),240),' +
    'gan,CONFIG_MELI!$E$2/100,' +
    'objetivo,costo*(1+gan),' +
    'precioBajo,(objetivo+33)/(1-com),' +
    'precioAlto,(objetivo+env)/(1-com),' +
    'precioBruto,IF(precioBajo<=298,precioBajo,precioAlto),' +
    'IF(precioBruto<=9,IF(precioBruto<=0,0,9),MROUND(precioBruto-9,10)+9)' +
    '),0)';
}

// Precio MELI ARRAYFORMULA — dinámica, recalcula al cambiar W2/W3/CONFIG_MELI
// Lee la categoría MELI de METADATA_PRODUCTOS col G (cat_meli) en lugar de col B,
// porque col B ahora muestra la categoría Electronics (visible para el usuario).
// Usa ROUND/10*10+9 (array-native) en lugar de MROUND.
// Precio MELI ARRAYFORMULA — dinámica, recalcula al cambiar W2/W3/CONFIG_MELI.
// Lee la categoría desde col B (que ahora es CAT_ELECTRONICS), luego hace double
// VLOOKUP: CAT_ELECTRONICS → categoría MELI → comisión.
// Usa ROUND/10*10+9 (array-native) en lugar de MROUND.
function _formulaPrecioMELIArray_() {
  return '=ARRAYFORMULA(IF(H2:H="","",' +
    'IFERROR(LET(' +
      'costo,IFERROR(I2:I,0),' +
      'catCVA,B2:B,' +
      'catMeli,IFERROR(VLOOKUP(catCVA,CAT_ELECTRONICS!$A:$B,2,FALSE),"Accesorios electrónicos"),' +
      'peso,IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$H,8,FALSE),""),' +
      'com,IFNA(VLOOKUP(catMeli,CONFIG_MELI!$A:$B,2,FALSE),14)/100,' +
      'env,IFNA(VLOOKUP(peso,CONFIG_MELI!$A:$B,2,FALSE),240),' +
      'gan,CONFIG_MELI!$E$2/100,' +
      'objetivo,costo*(1+gan),' +
      'precioBajo,(objetivo+33)/(1-com),' +
      'precioAlto,(objetivo+env)/(1-com),' +
      'precioBruto,IF(precioBajo<=298,precioBajo,precioAlto),' +
      'IF(precioBruto<=9,IF(precioBruto<=0,0,9),ROUND((precioBruto-9)/10,0)*10+9)' +
    '),0)' +
  '))';
}

// Mapeo grupo CVA → CAT_ELECTRONICS (las 27 categorías propias).
// Heurística basada en palabras clave del grupo y la descripción.
// Si no matchea nada conocido, cae a "ACCESORIOS".
// La categoría MELI para calcular comisión la resolvemos vía CAT_ELECTRONICS!B
// (double VLOOKUP en la fórmula del Precio MELI).
function _mapeoGrupoCVAaCAT_(grupo, desc) {
  const g = String(grupo || "").toUpperCase();
  const d = String(desc || "").toUpperCase();
  const t = g + " " + d;

  // VIDEOJUEGOS (consolas + accesorios de gaming)
  if (t.match(/CONSOL|PLAYSTATION|\bXBOX\b|NINTENDO|PS[34-9]|PS\s?[34-9]|VIDEOJUEGO|GAMING|GAMEPAD|JOYSTICK/))
    return "VIDEOJUEGOS";

  // TV Y VIDEO
  if (t.match(/TELEVISOR|\bTV\b|PANTALLA(?!.*COMPUTAD)|SMART TV|REPRODUCTOR.*VIDEO|BLU.?RAY|\bDVD\b/))
    return "TV Y VIDEO";

  // PROYECTORES (separados de TV)
  if (t.match(/PROYECTOR/))
    return "PROYECTORES";

  // CELULARES
  if (t.match(/CELULAR|SMARTPHONE|\bIPHONE\b|TELEFON.*MOVIL|TELEFON.*CEL/))
    return "CELULARES";

  // TABLETS
  if (t.match(/TABLET|\bIPAD\b/))
    return "TABLETS";

  // CAMARAS Y LENTES
  if (t.match(/CAMARA|FOTOGRAF|\bDRONE\b|VIDEOCAMARA|\bLENTE.*FOTOG|LENTE.*CAMARA|TRIPIE/))
    return "CAMARAS Y LENTES";

  // LENTES DE ARMAZON (lentes para vestir/graduados)
  if (t.match(/LENTES?.*(ARMAZON|GRADUAD|OFTAL|VISION)|GAFAS|\bGOGGLE/))
    return "LENTES DE ARMAZON";

  // AUDIO Y AMPLIFICADORES
  if (t.match(/AUDIO|BOCINA|AUDIFON|PARLANT|HEADPHONE|HEADSET|SUBWOOFER|HOMETHEATER|AMPLIFICAD|MICROFONO|\bDJ\b/))
    return "AUDIO Y AMPLIFICADORES";

  // IMPRESORAS Y ESCANERES
  if (t.match(/IMPRES|SCANNER|ESCANER|TONER|CARTUCHO|MULTIFUNCIONAL/))
    return "IMPRESORAS Y ESCANERES";

  // COMPUTADORAS (PC, laptop, monitores)
  if (t.match(/LAPTOP|NOTEBOOK|COMPUTAD|DESKTOP|MONITOR|ALL.?IN.?ONE|CHROMEBOOK|MACBOOK|TODO.EN.UNO/))
    return "COMPUTADORAS";

  // HARDWARE (componentes internos)
  if (t.match(/MEMORIA RAM|PROCESADOR|\bSSD\b|\bHDD\b|DISCO DURO|TARJETA MADRE|MOTHERBOARD|TARJETA DE VIDEO|FUENTE DE PODER|GABINETE|TARJETA GRAFICA|ALMACENAMIENTO|VENTILADOR.*PC|COOLER|UPS|NO.?BREAK|NOBREAK|REGULADOR/))
    return "HARDWARE";

  // CABLES (todo lo que sea cable, adaptador, conector)
  if (t.match(/\bCABLE|ADAPTADOR|CONVERTIDOR|EXTENSI[OÓ]N|MULTICONTACTO/))
    return "CABLES";

  // ACCESORIOS (mouse, teclado, etc. — antes de DEFAULT)
  if (t.match(/\bMOUSE\b|TECLADO(?!.*MUSICAL)|MOUSEPAD|HUB.*USB|FUNDA|MICA|PROTECTOR.*PANTALLA|CARGADOR|POWER BANK|\bUSB\b|MEMORIA USB|MEMORIA SD|MICROSD/))
    return "ACCESORIOS";

  // ELECTRODOMESTICOS (grandes + pequeños)
  if (t.match(/REFRIGERADOR|LAVADORA|SECADORA|ESTUFA|HORNO|LAVAVAJILLAS|CONGELADOR|LICUADORA|CAFETERA|PLANCHA(?!.*CABELLO)|TOSTADOR|ASPIRADORA|VENTILADOR(?!.*PC)|EXTRACTOR|MICROONDAS|BATIDORA|FREIDORA/))
    return "ELECTRODOMESTICOS";

  // COCINA Y HOGAR
  if (t.match(/COCINA|HOGAR|SARTEN|OLLA|VAJILLA|UTENSILIO|DECORAC|ORGANIZ|MUEBLE|CORTIN|COLCH|EDREDON|TOALLA|SABANA|JARDIN|TERRAZA/))
    return "COCINA Y HOGAR";

  // ILUMINACION
  if (t.match(/\bLED\b(?!.*TV)|FOCO|LAMPARA|LUMINARIA|ILUMINAC|REFLECTOR/))
    return "ILUMINACION";

  // HERRAMIENTAS (eléctricas + manuales)
  if (t.match(/TALADRO|ROTOMARTILLO|SIERRA|ESMERIL|PULIDORA|HERRAMIENTA|MARTILLO|DESARMADOR|LLAVE INGLESA|JUEGO.*DADOS|SOLDADOR/))
    return "HERRAMIENTAS";

  // AUTOMOTRIZ
  if (t.match(/AUTOMOTR|\bAUTO\b|VEHICUL|MOTOCICLET|LLANTA|RIN.*AUTO|ACEITE.*MOTOR|GPS.*AUTO|ESTEREO.*AUTO/))
    return "AUTOMOTRIZ";

  // DEPORTES
  if (t.match(/DEPORTE|FITNESS|EJERCICIO|BICICLETA|CICLISMO|GIMNASIO|RUNNING|YOGA|PESAS/))
    return "DEPORTES";

  // JUGUETES
  if (t.match(/JUGUETE|MUÑECA|PELUCHE|LEGO|PUZZLE|ROMPECABEZAS|CARRITO.*JUGUE/))
    return "JUGUETES";

  // SALUD Y BELLEZA (aparatos electrónicos de cuidado personal)
  if (t.match(/SECADOR.*CABELLO|PLANCHA.*CABELLO|RIZADOR|DEPILADORA|RASURADOR|AFEITAD|CEPILLO.*ELECTR|CEPILLO DENTAL|MASAJEADOR|BAUMANOMETRO|TERMOMETRO|OXIMETRO|GLUCOMETRO|MEDICO|SALUD|BELLEZA/))
    return "SALUD Y BELLEZA";

  // PERFUMES
  if (t.match(/PERFUME|FRAGANC|COLONIA|EAU DE/))
    return "PERFUMES";

  // RELOJES
  if (t.match(/\bRELOJ|SMARTWATCH|WEARABLE/))
    return "RELOJES";

  // JOYERIA
  if (t.match(/JOYER|COLLAR|ANILLO|PULSERA|ARETE|CADENA|DIJE/))
    return "JOYERIA";

  // MASCOTAS
  if (t.match(/MASCOT|PERRO|GATO|ALIMENTO.*PERRO|ALIMENTO.*GATO|JUGUETE.*MASCOT/))
    return "MASCOTAS";

  // ALIMENTOS
  if (t.match(/ALIMENTO|BEBIDA|COMIDA|GOLOSIN|SNACK|CAFE|CHOCOLATE/))
    return "ALIMENTOS";

  // CALZADO
  if (t.match(/CALZADO|ZAPATO|TENIS|BOTA|SANDALIA/))
    return "CALZADO";

  // Default — categoría más segura para electrónica no clasificada
  return "ACCESORIOS";
}

// Alias retrocompatible (algunos archivos pueden seguir llamando esta función)
function _mapeoGrupoCVAaMELI_(grupo, desc) {
  return _mapeoGrupoCVAaCAT_(grupo, desc);
}

// ════════════════════════════════════════════════════════════════
//  IMPORTAR UPCs DESDE DRIVE FOLDER
//
//  Lee todos los archivos del folder de Drive configurado, detecta
//  las columnas "Clave CVA" y "UPC" en cada uno (busca en las primeras
//  filas dónde están los headers), y pega los datos en UPC_IMPORT
//  sin duplicar claves. Luego ofrece ejecutar el flujo de METADATA
//  y SKU_INVENTARIO automáticamente.
//
//  REQUIERE: Drive API (Advanced Service) habilitado.
//    Editor → Servicios → + Servicio → "Drive API" → Agregar
//
//  Funciona con archivos Excel (.xlsx, .xls) y Google Sheets nativos.
// ════════════════════════════════════════════════════════════════

const _CVA_DRIVE_FOLDER_ID = "1fN7Oi7k4ZdWjnev7-HhV8H3LLl1ZEhHv";

function importarUPCsDesdeDrive() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  Logger.log("=== importarUPCsDesdeDrive() arrancó ===");
  Logger.log("Folder ID: " + _CVA_DRIVE_FOLDER_ID);

  // Validar UPC_IMPORT existe
  const shImp = ss.getSheetByName("UPC_IMPORT");
  if (!shImp) {
    Logger.log("✖ UPC_IMPORT no existe");
    ui.alert("⚠ No existe UPC_IMPORT",
      "Crea primero la hoja UPC_IMPORT desde el menú:\n\n" +
      "🛠 MIS HERRAMIENTAS → 🏷 Crear hoja UPC_IMPORT");
    return;
  }
  Logger.log("✓ UPC_IMPORT existe");

  // Verificar acceso al Drive Advanced Service
  if (typeof Drive === "undefined" || !Drive.Files) {
    Logger.log("✖ Drive Advanced Service no habilitado");
    ui.alert("⚠ Drive API no habilitada",
      "Para leer archivos Excel desde Drive necesito habilitar el servicio:\n\n" +
      "1. Editor de Apps Script → menú izquierdo: Servicios (+)\n" +
      "2. Busca 'Drive API' → Agregar\n" +
      "3. Guarda y vuelve a intentar\n\n" +
      "Mientras tanto puedes pegar los UPCs manualmente en UPC_IMPORT.");
    return;
  }
  Logger.log("✓ Drive Advanced Service disponible");

  // Abrir folder
  let folder;
  try {
    folder = DriveApp.getFolderById(_CVA_DRIVE_FOLDER_ID);
  } catch(e) {
    const msg = String(e.message || "");
    // Detectar error de permisos específicamente
    if (msg.indexOf("permiso") >= 0 || msg.indexOf("permission") >= 0 || msg.indexOf("authorization") >= 0) {
      ui.alert("⚠ Falta autorizar Drive",
        "Apps Script aún no tiene permiso para leer tu Drive.\n\n" +
        "📋 SOLUCIÓN (una sola vez):\n" +
        "  1. Abre el editor de Apps Script (Extensiones → Apps Script)\n" +
        "  2. En el dropdown de funciones (arriba) elige: autorizarDriveAPI\n" +
        "  3. Click en el botón ▶ Ejecutar\n" +
        "  4. Google te mostrará el modal de permisos → acepta TODO\n" +
        "  5. Cuando veas 'Ejecución finalizada', regresa al Sheet\n" +
        "  6. Vuelve a usar 📂 Importar UPCs desde Drive folder\n\n" +
        "Error técnico:\n  " + msg);
      return;
    }
    ui.alert("❌ No pude abrir el folder de Drive\n\n" +
      "Folder ID: " + _CVA_DRIVE_FOLDER_ID + "\n" +
      "Error: " + msg + "\n\n" +
      "Verifica que el folder existe y que tu cuenta tiene acceso.");
    return;
  }

  // Listar archivos en el folder
  const archivosInfo = [];
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    archivosInfo.push({ id: f.getId(), name: f.getName(), mime: f.getMimeType() });
  }

  Logger.log("Folder '" + folder.getName() + "' tiene " + archivosInfo.length + " archivos:");
  archivosInfo.forEach(a => Logger.log("  - " + a.name + " (" + a.mime + ")"));

  if (archivosInfo.length === 0) {
    ui.alert("📂 Folder vacío",
      "No hay archivos en el folder de Drive.\n\n" +
      "Sube los Excels de CVA al folder y vuelve a intentar.");
    return;
  }

  // Confirmar
  const resp = ui.alert("📂 Importar desde Drive",
    "Encontré " + archivosInfo.length + " archivo(s) en el folder:\n\n" +
    archivosInfo.slice(0, 8).map(a => "  • " + a.name).join("\n") +
    (archivosInfo.length > 8 ? "\n  ... y " + (archivosInfo.length - 8) + " más" : "") +
    "\n\nVoy a:\n" +
    "  1. Leer cada archivo\n" +
    "  2. Buscar columnas Clave CVA + UPC\n" +
    "  3. Pegar las claves nuevas en UPC_IMPORT (sin duplicar)\n" +
    "  4. Te ofreceré procesar el import automáticamente\n\n" +
    "Los archivos NO se borrarán — tú decides cuándo borrarlos del Drive.\n\n" +
    "¿Continuar?",
    ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  // Cargar claves ya pegadas en UPC_IMPORT (para no duplicar)
  const yaPegadas = {};
  const lastRowImp = shImp.getLastRow();
  if (lastRowImp >= 10) {
    const existentes = shImp.getRange(10, 1, lastRowImp - 9, 1).getValues();
    existentes.forEach(r => {
      const k = String(r[0] || "").trim();
      if (k) yaPegadas[k] = true;
    });
  }

  // Procesar cada archivo
  const filasNuevas = [];
  let archivosLeidos = 0;
  const errores = [];
  const detalle = [];

  Logger.log("[importarUPCsDesdeDrive] Iniciando con " + archivosInfo.length + " archivos");

  for (let i = 0; i < archivosInfo.length; i++) {
    const info = archivosInfo[i];
    Logger.log("[" + (i+1) + "/" + archivosInfo.length + "] Procesando: " + info.name);

    try {
      const datos = _leerArchivoComoMatriz_(info);
      if (!datos || datos.length === 0) {
        errores.push(info.name + " (archivo vacío)");
        Logger.log("  → vacío");
        continue;
      }

      Logger.log("  → " + datos.length + " filas, " + (datos[0] || []).length + " columnas");

      // Layout FIJO del archivo CVA:
      //   Fila 1-2: encabezado del reporte
      //   Fila 3: headers (Clave CVA | ... | UPC en columna G)
      //   Fila 4 en adelante: datos
      //   Columna A (índice 0) = Clave CVA
      //   Columna G (índice 6) = UPC
      const COL_CLAVE = 0;  // A
      const COL_UPC   = 6;  // G
      const PRIMERA_FILA_DATOS = 3;  // fila 4 en notación humana

      let agregadasArchivo = 0, duplicadasArchivo = 0, vaciasArchivo = 0;
      for (let r = PRIMERA_FILA_DATOS; r < datos.length; r++) {
        const fila = datos[r];
        if (!fila) continue;
        const clave = String(fila[COL_CLAVE] || "").trim();
        let upc    = String(fila[COL_UPC]   || "").trim();
        if (!clave || !upc) { vaciasArchivo++; continue; }

        // Limpiar UPC: solo dígitos
        upc = upc.replace(/[^0-9]/g, "");
        if (!upc) { vaciasArchivo++; continue; }

        if (yaPegadas[clave]) {
          duplicadasArchivo++;
          continue;
        }
        filasNuevas.push([clave, upc, "Drive: " + info.name]);
        yaPegadas[clave] = true;
        agregadasArchivo++;
      }

      archivosLeidos++;
      const linea = info.name + ": +" + agregadasArchivo +
        " nuevas, " + duplicadasArchivo + " dup, " + vaciasArchivo + " vacías";
      detalle.push(linea);
      Logger.log("  ✓ " + linea);
    } catch(e) {
      const msgErr = info.name + " (" + e.message + ")";
      errores.push(msgErr);
      Logger.log("  ✖ ERROR: " + e.message);
    }
  }

  // Pegar las filas nuevas en UPC_IMPORT
  if (filasNuevas.length > 0) {
    const startRow = Math.max(10, shImp.getLastRow() + 1);
    shImp.getRange(startRow, 1, filasNuevas.length, 3).setValues(filasNuevas);
    SpreadsheetApp.flush();
  }

  // Reporte final
  let msg = "✅ LECTURA DE DRIVE COMPLETADA\n\n";
  msg += "📂 Archivos leídos: " + archivosLeidos + " / " + archivosInfo.length + "\n";
  msg += "🆕 Claves nuevas:   " + filasNuevas.length + "\n\n";
  if (detalle.length > 0) {
    msg += "Detalle:\n  " + detalle.slice(0, 8).join("\n  ");
    if (detalle.length > 8) msg += "\n  ... y " + (detalle.length - 8) + " más";
    msg += "\n\n";
  }
  if (errores.length > 0) {
    msg += "⚠ Errores:\n  " + errores.slice(0, 5).join("\n  ");
    if (errores.length > 5) msg += "\n  ... y " + (errores.length - 5) + " más";
    msg += "\n\n";
  }

  if (filasNuevas.length === 0) {
    ui.alert("Resultado", msg + "Sin claves nuevas para procesar.", ui.ButtonSet.OK);
    return;
  }

  // Ofrecer procesar automáticamente
  msg += "¿Procesar ahora? (UPCs → METADATA_PRODUCTOS + SKU_INVENTARIO)";
  const procesar = ui.alert("Resultado", msg, ui.ButtonSet.YES_NO);
  if (procesar === ui.Button.YES) {
    importarUPCsDesdeHoja();
  }
}

// Lee un archivo de Drive (Sheet o Excel) y devuelve una matriz de valores.
// Para Excel usa Drive Advanced Service para convertirlo temporalmente a Sheet.
// Soporta TANTO Drive API v2 (insert + convert) como v3 (create con mimeType).
function _leerArchivoComoMatriz_(info) {
  // Caso 1: ya es Google Sheets nativo
  if (info.mime === MimeType.GOOGLE_SHEETS) {
    const ss = SpreadsheetApp.openById(info.id);
    const sh = ss.getSheets()[0];
    return sh.getDataRange().getValues();
  }

  // Caso 2: Excel — convertir a Sheet temporal, leer, borrar
  const esExcel = info.mime === MimeType.MICROSOFT_EXCEL ||
                  info.mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                  info.mime === "application/vnd.ms-excel";
  if (!esExcel) {
    Logger.log("  → mime no soportado: " + info.mime);
    return null;  // skip otros tipos (PDF, imagen, etc.)
  }

  const file = DriveApp.getFileById(info.id);
  const blob = file.getBlob();
  const tempName = "__temp_upc_" + Utilities.getUuid().substring(0, 8);

  let tempFile = null;
  let tempId = null;
  try {
    // Detectar versión de Drive API disponible
    if (typeof Drive.Files.insert === "function") {
      // ── Drive API v2 ──
      Logger.log("  usando Drive API v2 (insert + convert)");
      tempFile = Drive.Files.insert({
        title: tempName,
        mimeType: MimeType.GOOGLE_SHEETS,
      }, blob, { convert: true });
      tempId = tempFile.id;
    } else if (typeof Drive.Files.create === "function") {
      // ── Drive API v3 ──
      Logger.log("  usando Drive API v3 (create con mimeType)");
      tempFile = Drive.Files.create({
        name: tempName,
        mimeType: "application/vnd.google-apps.spreadsheet",
      }, blob);
      tempId = tempFile.id;
    } else {
      throw new Error("Ni Drive.Files.insert ni Drive.Files.create están disponibles. " +
        "Verifica que Drive API esté habilitada en Servicios.");
    }

    Logger.log("  archivo temporal creado: " + tempId);
    const ssTmp = SpreadsheetApp.openById(tempId);
    const sh = ssTmp.getSheets()[0];
    const datos = sh.getDataRange().getValues();
    return datos;
  } finally {
    // Borrar el temporal (compatible con ambas versiones)
    if (tempId) {
      try {
        if (typeof Drive.Files.remove === "function") {
          Drive.Files.remove(tempId);
        } else {
          // Fallback: mover a la papelera vía DriveApp
          DriveApp.getFileById(tempId).setTrashed(true);
        }
      } catch(e) {
        Logger.log("  ⚠ no pude borrar temp: " + e.message);
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════
//  autorizarDriveAPI — fuerza el flujo de autorización OAuth
//
//  Cuando agregas llamadas nuevas a DriveApp / Drive Service, Apps
//  Script necesita pedir permisos adicionales al usuario. Pero el
//  modal de OAuth NO aparece cuando ejecutas desde el menú del Sheet
//  (onOpen está en un contexto sin UI permisos).
//
//  USO:
//   1. Editor de Apps Script (Extensiones → Apps Script)
//   2. Dropdown de funciones arriba (donde dice "Selecciona una función")
//   3. Elige: autorizarDriveAPI
//   4. Click ▶ Ejecutar
//   5. Google muestra modal pidiendo permisos → ACEPTA TODO
//   6. Cuando termine, regresa al Sheet y usa el menú normalmente
// ════════════════════════════════════════════════════════════════

function autorizarDriveAPI() {
  // Forzar evaluación de Drive Advanced Service para detectar el scope
  try {
    if (typeof Drive === "undefined") {
      throw new Error("Drive API (Advanced Service) no está habilitada.\n\n" +
        "En el editor:\n" +
        "  Servicios (+) → busca 'Drive API' → Agregar\n" +
        "  Después vuelve a ejecutar esta función.");
    }
    // Esto requiere el scope de drive.readonly o drive
    const folder = DriveApp.getFolderById(_CVA_DRIVE_FOLDER_ID);
    const folderName = folder.getName();

    // Contar archivos para confirmar acceso
    let count = 0;
    const files = folder.getFiles();
    while (files.hasNext()) { files.next(); count++; if (count > 100) break; }

    // Test del Advanced Service también
    let testAPIv2 = "no probado";
    try {
      Drive.Files.list({ maxResults: 1 });
      testAPIv2 = "✅ funcionando";
    } catch(e) {
      testAPIv2 = "⚠ " + e.message;
    }

    const msg = "✅ AUTORIZACIÓN COMPLETA\n\n" +
      "📂 Folder accesible: " + folderName + "\n" +
      "📄 Archivos detectados: " + count + (count > 100 ? "+" : "") + "\n" +
      "🔧 Drive API v2 (Advanced Service): " + testAPIv2 + "\n\n" +
      "Ya puedes regresar al Sheet y usar:\n" +
      "  🛠 MIS HERRAMIENTAS → 📂 Importar UPCs desde Drive folder";

    Logger.log(msg);

    // Mostrar también en UI si es posible (a veces no se puede desde el editor)
    try {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "Drive autorizado · " + count + " archivos en el folder",
        "✅ Listo",
        10
      );
    } catch(e) {}

    return msg;
  } catch(e) {
    const msg = "❌ ERROR DE AUTORIZACIÓN\n\n" + e.message +
      "\n\nSi ves un modal de Google pidiendo permisos, acéptalo y vuelve a ejecutar.";
    Logger.log(msg);
    throw new Error(msg);
  }
}

// ════════════════════════════════════════════════════════════════
//  DIAGNÓSTICO — muestra el estado de las hojas clave
//
//  Usa esto cuando algo "se ve en blanco" para saber qué pasó:
//   ¿UPC_IMPORT tiene datos? ¿METADATA_PRODUCTOS se actualizó?
//   ¿SKU_INVENTARIO tiene filas? ¿Las fórmulas están en su lugar?
// ════════════════════════════════════════════════════════════════

function diagnosticarEstado() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const lineas = [];

  // UPC_IMPORT
  const shImp = ss.getSheetByName("UPC_IMPORT");
  if (!shImp) {
    lineas.push("❌ UPC_IMPORT: no existe");
  } else {
    const last = shImp.getLastRow();
    const filasDatos = Math.max(0, last - 9);  // datos empiezan en fila 10
    lineas.push("📋 UPC_IMPORT");
    lineas.push("   última fila: " + last + " (datos: " + filasDatos + " filas en A10:C)");
    if (filasDatos > 0) {
      // Mostrar primeros 3 datos
      const muestra = shImp.getRange(10, 1, Math.min(3, filasDatos), 3).getValues();
      muestra.forEach((r, i) => {
        lineas.push("   ej " + (i+1) + ": clave='" + r[0] + "' upc='" + r[1] + "' notas='" + r[2] + "'");
      });
    }
  }

  // METADATA_PRODUCTOS
  const shMD = ss.getSheetByName("METADATA_PRODUCTOS");
  if (!shMD) {
    lineas.push("\n❌ METADATA_PRODUCTOS: no existe");
  } else {
    const last = shMD.getLastRow();
    const filasDatos = Math.max(0, last - 1);
    lineas.push("\n🗄 METADATA_PRODUCTOS");
    lineas.push("   última fila: " + last + " (datos: " + filasDatos + " productos)");
    if (filasDatos > 0) {
      // Contar cuántos tienen UPC
      const data = shMD.getRange(2, 1, filasDatos, 5).getValues();
      let conUPC = 0, sinUPC = 0;
      data.forEach(r => {
        const upc = String(r[4] || "").trim();
        if (upc) conUPC++; else sinUPC++;
      });
      lineas.push("   con UPC: " + conUPC + "  ·  sin UPC: " + sinUPC);
      // Primer producto con UPC
      const conUpcRow = data.find(r => String(r[4] || "").trim());
      if (conUpcRow) {
        lineas.push("   ej con UPC: clave='" + conUpcRow[0] + "' marca='" + conUpcRow[1] + "' upc='" + conUpcRow[4] + "'");
      }
    }
  }

  // SKU_INVENTARIO
  const shSKU = ss.getSheetByName("SKU_INVENTARIO");
  if (!shSKU) {
    lineas.push("\n❌ SKU_INVENTARIO: no existe");
  } else {
    const lastH = _ultimaFilaSKUInventario_(shSKU);
    const last = shSKU.getLastRow();
    const filasDatos = Math.max(0, lastH - 1);
    lineas.push("\n🏷 SKU_INVENTARIO");
    lineas.push("   última fila con clave: " + lastH + " (datos reales: " + filasDatos + " productos)");
    if (last !== lastH) {
      lineas.push("   ⚠ getLastRow=" + last + " (inflado por ARRAYFORMULAS — normal)");
    }

    // Headers en fila 1
    const headers = shSKU.getRange(1, 1, 1, 11).getValues()[0];
    lineas.push("   headers: " + headers.filter(h => h).length + "/11 columnas con título");

    // Fórmulas vivas
    const i2F = shSKU.getRange("I2").getFormula();
    const k2F = shSKU.getRange("K2").getFormula();
    const l2F = shSKU.getRange("L2").getFormula();
    const m2F = shSKU.getRange("M2").getFormula();
    const n2F = shSKU.getRange("N2").getFormula();
    const q2F = shSKU.getRange("Q2").getFormula();
    lineas.push("   I2 (Precio CVA) " + (i2F ? "✓" : "✗ VACÍA"));
    lineas.push("   K2 (Stock CVA) " + (k2F ? "✓" : "✗ VACÍA"));
    lineas.push("   L2 (Stock Odoo) " + (l2F ? "✓" : "✗ VACÍA"));
    lineas.push("   M2-P2 (peso+dimensiones) " + (m2F && n2F ? "✓" : "✗ FALTAN"));
    lineas.push("   Q2 (empaque alto) " + (q2F ? "✓" : "✗ VACÍA"));
    const w2 = shSKU.getRange("W2").getValue();
    lineas.push("   W2 (% Global): " + (w2 === "" || w2 == null ? "VACÍA" : w2));

    if (filasDatos > 0) {
      const primera = shSKU.getRange(2, 1, 1, 20).getValues()[0];
      lineas.push("   ej fila 2:");
      lineas.push("     A(UPC)='" + primera[0] + "' H(clave)='" + primera[7] + "'");
      lineas.push("     I(P.CVA)='" + primera[8] + "' J(P.MELI)='" + primera[9] + "'");
      lineas.push("     K(Stock CVA)='" + primera[10] + "' L(Stock Odoo)='" + primera[11] + "'");
      lineas.push("     M(Peso)='" + primera[12] + "' N/O/P(dim)='" + primera[13] + "×" + primera[14] + "×" + primera[15] + "'");
      lineas.push("     Q/R/S/T(empaque)='" + primera[16] + "×" + primera[17] + "×" + primera[18] + " · " + primera[19] + "kg'");
      if (!primera[7] && lastH > 2) {
        lineas.push("   ⚠ Fila 2 vacía pero hay datos en fila " + lastH + " — necesitas re-importar para compactar");
      }
    }
  }

  // SYNC_CVA
  const shSync = ss.getSheetByName("SYNC_CVA");
  if (!shSync) {
    lineas.push("\n⚠ SYNC_CVA: no existe (sin él Stock CVA dará 0)");
  } else {
    const last = shSync.getLastRow();
    lineas.push("\n📦 SYNC_CVA: " + Math.max(0, last - 1) + " productos en catálogo");
  }

  // CONFIG_MELI
  const shCfg = ss.getSheetByName("CONFIG_MELI");
  if (!shCfg) {
    lineas.push("\n⚠ CONFIG_MELI: no existe (sin ella Precio MELI dará 0)");
  } else {
    const e2 = shCfg.getRange("E2").getValue();
    lineas.push("\n⚙ CONFIG_MELI: existe (% Ganancia = " + e2 + "%)");
  }

  const msg = lineas.join("\n");
  Logger.log(msg);
  ui.alert("🔍 Diagnóstico", msg, ui.ButtonSet.OK);
}

// ════════════════════════════════════════════════════════════════
//  Llama al endpoint del Web App para enriquecer pesos desde CVA.
//  El endpoint hace todo el trabajo: consulta la API CVA por cada
//  producto en SKU_INVENTARIO, extrae el peso de las dimensiones y
//  lo guarda en METADATA_PRODUCTOS. Después de esto, todos los
//  Precios MELI recalculan automáticamente con el envío correcto.
// ════════════════════════════════════════════════════════════════

const _WEB_APP_URL = "https://script.google.com/macros/s/AKfycby9biqEbiv4syc3St3TuPKXkG9rI5A4YsmtNta3OEJ4mD0i8sg0PPg9OhfrPDZJuO_L/exec";

function enriquecerPesosDesdeCVAMenu() {
  const ui = SpreadsheetApp.getUi();

  // Preguntar si quiere forzar (re-consultar todos) o solo los vacíos
  const resp = ui.alert("🔬 Enriquecer pesos desde CVA",
    "Voy a consultar la API de CVA para obtener el peso real de cada producto en SKU_INVENTARIO.\n\n" +
    "El peso se guarda en METADATA_PRODUCTOS y la fórmula del Precio MELI lo lee al instante.\n\n" +
    "¿Re-consultar TODOS los productos (incluso los que ya tienen peso)?\n" +
    "  • SÍ = forzar refresh completo\n" +
    "  • NO = solo los que tienen peso vacío (ahorra cuota CVA)",
    ui.ButtonSet.YES_NO_CANCEL);

  if (resp === ui.Button.CANCEL) return;
  const forzar = (resp === ui.Button.YES);

  // Llamar al Web App
  let respuesta;
  try {
    const url = _WEB_APP_URL + "?action=enriquecer_pesos&forzar=" + (forzar ? "true" : "false");
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    respuesta = JSON.parse(res.getContentText());
  } catch(e) {
    ui.alert("❌ Error llamando al Web App",
      "Error: " + e.message + "\n\n" +
      "Verifica:\n" +
      "  1. Que el Web App esté desplegado con la última versión de Code.gs\n" +
      "  2. Que la URL esté correcta en sheets_menu.gs\n" +
      "  3. Que la deployment esté como 'Anyone' o tu cuenta",
      ui.ButtonSet.OK);
    return;
  }

  if (!respuesta.ok) {
    ui.alert("❌ Error", respuesta.error || "Error desconocido", ui.ButtonSet.OK);
    return;
  }

  // Mostrar reporte
  let msg = "✅ ENRIQUECIMIENTO COMPLETADO\n\n";
  msg += "📦 Total productos:    " + respuesta.total_productos + "\n";
  msg += "⏭ Saltadas (ya tenían peso): " + respuesta.saltadas + "\n";
  msg += "🔍 Consultadas a CVA:  " + respuesta.consultadas + "\n";
  msg += "✏ Actualizadas:         " + respuesta.actualizadas + "\n";
  msg += "⚠ Sin dimensiones:     " + respuesta.sin_dimensiones + "\n";
  msg += "❌ Errores:             " + respuesta.errores + "\n";
  if (respuesta.detalle_errores && respuesta.detalle_errores.length > 0) {
    msg += "\nPrimeros errores:\n  " + respuesta.detalle_errores.join("\n  ");
  }
  msg += "\n\nLos Precios MELI ya recalcularon automáticamente con el envío correcto.";

  ui.alert("Resultado", msg, ui.ButtonSet.OK);
}

// ════════════════════════════════════════════════════════════════
//  Formato condicional para SKU_INVENTARIO:
//   - Col E (Modelo) = "SINMODELO" → fondo rojo
//
//  Idempotente: si la regla ya está, no la duplica.
// ════════════════════════════════════════════════════════════════

function _aplicarFormatoCondicionalSKU_(sh) {
  const rango = sh.getRange("E2:E");

  // Quitar reglas viejas que apunten al mismo rango (para no duplicar)
  const reglas = sh.getConditionalFormatRules();
  const reglasLimpias = reglas.filter(regla => {
    const rangos = regla.getRanges();
    // Si TODAS sus referencias coinciden con E2:E, considerarla nuestra → quitarla
    if (rangos.length !== 1) return true;
    const ra = rangos[0].getA1Notation();
    // E2:E o E2:E1000 etc. — todo lo que empiece con E2 hacia abajo solo col E
    return !(ra.startsWith("E2") && rangos[0].getColumn() === 5 && rangos[0].getNumColumns() === 1);
  });

  // Regla: si el texto es "SIN MODELO" o "SINMODELO" → fondo rojo
  // (Soporta ambos por si quedan registros viejos.)
  const reglaNueva = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("SIN MODELO")
    .setBackground("#e05555")
    .setFontColor("#ffffff")
    .setBold(true)
    .setRanges([rango])
    .build();

  const reglaLegacy = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("SINMODELO")
    .setBackground("#e05555")
    .setFontColor("#ffffff")
    .setBold(true)
    .setRanges([rango])
    .build();

  reglasLimpias.push(reglaNueva);
  reglasLimpias.push(reglaLegacy);
  sh.setConditionalFormatRules(reglasLimpias);
}

// ════════════════════════════════════════════════════════════════
//  Fórmulas de empaque para SKU_INVENTARIO
//
//  Cada producto se asigna a un tamaño de empaque estándar (tabla
//  editable en CONFIG_MELI!G3:K). La lógica:
//
//   1. Toma la dimensión MÁXIMA del producto (max alto/ancho/prof)
//   2. Hace LOOKUP a la tabla — devuelve el empaque cuya umbral
//      "Dim máx producto cm ≤" es ≥ dim máx del producto
//   3. Si el peso real del producto excede el peso del empaque
//      sugerido, ajusta hacia arriba (CEILING al entero)
//
//  Mínimo absoluto garantizado: 20×20×20 cm, 1 kg.
//  Si el producto no tiene dimensiones registradas, devuelve mínimo.
// ════════════════════════════════════════════════════════════════

function _formulaEmpaqueAlto_(r) {
  return _formulaEmpaqueGeneric_(r, "H");
}
function _formulaEmpaqueAncho_(r) {
  return _formulaEmpaqueGeneric_(r, "I");
}
function _formulaEmpaqueProf_(r) {
  return _formulaEmpaqueGeneric_(r, "J");
}

// ── Versiones ARRAYFORMULA ──────────────────────────────────────
// CLAVE: XLOOKUP con match_mode=1 es array-aware DE VERDAD dentro de
// ARRAYFORMULA, y busca el primer valor ≥ buscado (cubre el producto).
// VLOOKUP con TRUE no funcionaba porque tenía bug con LET en Sheets.
//
// CONFIG_MELI layout (cols G:K):
//   G = Dim máx ≤  H = Alto  I = Ancho  J = Profundidad  K = Peso kg
//
// dimMax es max(N, O, P) usando aritmética booleana (array-aware sin LET).
// XLOOKUP busca el primer rango cuya Dim máx ≥ dimMax → cubre el producto.
function _formulaEmpaqueAltoArray_()  { return _formulaEmpaqueGenericArray_(2); }
function _formulaEmpaqueAnchoArray_() { return _formulaEmpaqueGenericArray_(3); }
function _formulaEmpaqueProfArray_()  { return _formulaEmpaqueGenericArray_(4); }

// dimMax array-aware sin LET, sin MAX (que no es array)
function _exprDimMaxArray_() {
  const a = 'IFERROR(N2:N+0,0)';
  const b = 'IFERROR(O2:O+0,0)';
  const c = 'IFERROR(P2:P+0,0)';
  // max(a,b) usando aritmética booleana
  const maxAB = '((' + a + '>=' + b + ')*' + a + '+(' + a + '<' + b + ')*' + b + ')';
  // max(maxAB, c)
  return '((' + maxAB + '>=' + c + ')*' + maxAB + '+(' + maxAB + '<' + c + ')*' + c + ')';
}

function _formulaEmpaqueGenericArray_(colIdx) {
  // colIdx: 2=H(Alto), 3=I(Ancho), 4=J(Prof) dentro del rango G:K
  const colLetras = ['H','I','J','K'];
  const colLetra = colLetras[colIdx - 2];
  const dimMax = _exprDimMaxArray_();
  // XLOOKUP(dimMax, G3:G13, X3:X13, fallback, match_mode=1 → primer ≥)
  return '=ARRAYFORMULA(IF(H2:H="","",' +
    'IFERROR(' +
      'XLOOKUP(' + dimMax + ',' +
        'CONFIG_MELI!$G$3:$G$13,' +
        'CONFIG_MELI!$' + colLetra + '$3:$' + colLetra + '$13,' +
        'CONFIG_MELI!$' + colLetra + '$3,' +    // fallback si nada encontrado
        '1' +                                    // match_mode: primer ≥
      '),' +
      'CONFIG_MELI!$' + colLetra + '$3' +       // fallback adicional ante errores
    ')))';
}

function _formulaEmpaquePesoArray_() {
  const dimMax = _exprDimMaxArray_();
  const pesoEmpTabla = 'IFERROR(XLOOKUP(' + dimMax + ',CONFIG_MELI!$G$3:$G$13,CONFIG_MELI!$K$3:$K$13,CONFIG_MELI!$K$3,1),CONFIG_MELI!$K$3)';
  const pesoProdMas02 = '(IFERROR(M2:M+0,0)+0.2)';
  // max(pesoEmpTabla, pesoProd+0.2) array-aware
  const pesoFinal = '((' + pesoEmpTabla + '>=' + pesoProdMas02 + ')*' + pesoEmpTabla + '+(' + pesoEmpTabla + '<' + pesoProdMas02 + ')*' + pesoProdMas02 + ')';
  return '=ARRAYFORMULA(IF(H2:H="","",IFERROR(CEILING(' + pesoFinal + '),1)))';
}

function _formulaEmpaqueGeneric_(r, colCfg) {
  // colCfg es la letra de CONFIG_MELI: H=alto, I=ancho, J=prof
  return '=IFERROR(IF(H' + r + '="","",' +
    'LET(' +
    'dimMax,MAX(IFERROR(N' + r + ',0),IFERROR(O' + r + ',0),IFERROR(P' + r + ',0)),' +
    'IF(dimMax<=0,CONFIG_MELI!$' + colCfg + '$3,' +
    'IFERROR(LOOKUP(dimMax,CONFIG_MELI!$G$3:$G,CONFIG_MELI!$' + colCfg + '$3:$' + colCfg + '),CONFIG_MELI!$' + colCfg + '$3))' +
    ')),20)';
}

// Peso del empaque = MAX(tabla, peso del producto + margen) redondeado a entero.
// Si el producto pesa más que el peso recomendado del empaque, usa el peso real.
function _formulaEmpaquePeso_(r) {
  return '=IFERROR(IF(H' + r + '="","",' +
    'LET(' +
    'dimMax,MAX(IFERROR(N' + r + ',0),IFERROR(O' + r + ',0),IFERROR(P' + r + ',0)),' +
    'pesoProd,IFERROR(M' + r + ',0),' +
    'pesoEmpTabla,IF(dimMax<=0,CONFIG_MELI!$K$3,' +
    'IFERROR(LOOKUP(dimMax,CONFIG_MELI!$G$3:$G,CONFIG_MELI!$K$3:$K),CONFIG_MELI!$K$3)),' +
    'CEILING(MAX(pesoEmpTabla,pesoProd+0.2))' +
    ')),1)';
}

// ════════════════════════════════════════════════════════════════
//  Trigger onEdit — sincronización SKU_INVENTARIO → METADATA
//
//  Cuando editas Modelo (col E) o Color (col F) en SKU_INVENTARIO,
//  el valor se copia automáticamente a METADATA_PRODUCTOS para que la
//  PWA y el resto del sistema queden alineados.
//
//  Las celdas col E (Modelo) también disparan el formato condicional
//  rojo para "SIN MODELO" (eso ya está configurado en el sheet).
// ════════════════════════════════════════════════════════════════
function onEdit(e) {
  try {
    _sincronizarBidireccional_(e);
  } catch(err) {
    Logger.log("Error en onEdit: " + err.message);
  }
}

// ════════════════════════════════════════════════════════════════
//  Sincronización BIDIRECCIONAL SKU ↔ METADATA
//
//  Cuando edites col E (modelo) o F (color) en cualquiera de las dos
//  hojas, se copia automáticamente a la otra. Cualquiera es source of
//  truth — la que edites más recientemente gana.
//
//  Mapeo de columnas:
//   SKU_INVENTARIO col E (modelo) ↔ METADATA_PRODUCTOS col C (modelo)
//   SKU_INVENTARIO col F (color)  ↔ METADATA_PRODUCTOS col D (color)
//
//  El "matching" entre hojas se hace por col H (clave CVA) en SKU y
//  col A (clave) en METADATA.
// ════════════════════════════════════════════════════════════════
function _sincronizarBidireccional_(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  const sheetName = sh.getName();
  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row < 2) return;

  const ss = sh.getParent();

  // Leer el valor REAL de la celda editada (no confiar en e.value, que puede
  // venir undefined en paste, edición desde barra de fórmula, multi-celda, etc.)
  // Esto evita el bug "desaparece el color al editar el otro lado".
  const valorRealCelda = sh.getRange(row, col).getValue();

  // ── DIRECCIÓN 1: SKU → METADATA ──
  if (sheetName === "SKU_INVENTARIO") {
    if (col !== 5 && col !== 6) return;   // E (modelo) o F (color)

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

    // Normalizar valor — usar lo que REALMENTE está en la celda
    let valor;
    if (col === 5) {
      valor = _limpiarModelo_(valorRealCelda);
      const original = String(valorRealCelda);
      if (valor !== original) sh.getRange(row, col).setValue(valor);
    } else {
      valor = String(valorRealCelda || "").toUpperCase();
    }
    const targetCol = col === 5 ? 3 : 4;

    const valorActualMD = String(shMD.getRange(mdRow, targetCol).getValue() || "");
    if (valorActualMD !== valor) {
      shMD.getRange(mdRow, targetCol).setValue(valor);
      shMD.getRange(mdRow, 9).setValue(new Date());
    }
    return;
  }

  // ── DIRECCIÓN 2: METADATA → SKU ──
  if (sheetName === "METADATA_PRODUCTOS") {
    if (col !== 3 && col !== 4) return;   // C (modelo) o D (color)

    const clave = String(sh.getRange(row, 1).getValue() || "").trim();
    if (!clave) return;

    const shSKU = ss.getSheetByName("SKU_INVENTARIO");
    if (!shSKU) return;

    const last = _ultimaFilaSKUInventario_(shSKU);
    if (last < 2) return;
    const skuData = shSKU.getRange(2, 8, last - 1, 1).getValues();
    let skuRow = null;
    for (let i = 0; i < skuData.length; i++) {
      if (String(skuData[i][0] || "").trim() === clave) {
        skuRow = i + 2;
        break;
      }
    }
    if (!skuRow) return;

    // Normalizar valor — usar lo que REALMENTE está en la celda
    let valor;
    if (col === 3) {
      valor = _limpiarModelo_(valorRealCelda);
      const original = String(valorRealCelda);
      if (valor !== original) sh.getRange(row, col).setValue(valor);
    } else {
      valor = String(valorRealCelda || "").toUpperCase();
    }
    const targetCol = col === 3 ? 5 : 6;

    const valorActualSKU = String(shSKU.getRange(skuRow, targetCol).getValue() || "");
    if (valorActualSKU !== valor) {
      shSKU.getRange(skuRow, targetCol).setValue(valor);
      sh.getRange(row, 9).setValue(new Date());
    }
    return;
  }
}

// ════════════════════════════════════════════════════════════════
//  sincronizarSKUaMetadata — script ONE-TIME para popular
//  METADATA con los valores actuales de SKU (modelo, color, UPC).
//
//  Útil cuando METADATA está vacío en colores y SKU sí los tiene.
//  Solo escribe en METADATA donde está vacío (no sobrescribe lo
//  que ya hay). Para hacer override completo, usa "forzar".
// ════════════════════════════════════════════════════════════════
function sincronizarSKUaMetadata() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("🎨 Sincronizar SKU → METADATA",
    "Copia los valores de SKU_INVENTARIO → METADATA_PRODUCTOS:\n\n" +
    "  • SKU col E (modelo) → METADATA col C\n" +
    "  • SKU col F (color)  → METADATA col D\n" +
    "  • SKU col A (UPC)    → METADATA col E\n\n" +
    "Solo escribe donde METADATA está vacío.\n" +
    "No sobrescribe valores existentes.\n\n" +
    "¿Continuar?", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shSKU = ss.getSheetByName("SKU_INVENTARIO");
    const shMD  = ss.getSheetByName("METADATA_PRODUCTOS");
    if (!shSKU) { ui.alert("Error", "Falta SKU_INVENTARIO", ui.ButtonSet.OK); return; }
    if (!shMD)  { ui.alert("Error", "Falta METADATA_PRODUCTOS", ui.ButtonSet.OK); return; }

    // Leer METADATA y armar índice clave+marca → {fila, modelo, color, upc}
    const mdLast = shMD.getLastRow();
    if (mdLast < 2) { ui.alert("METADATA está vacío"); return; }
    const mdData = shMD.getRange(2, 1, mdLast - 1, 5).getValues();
    const mdIdx = {};
    mdData.forEach(function(r, i) {
      const k = String(r[0] || "").trim();
      const m = String(r[1] || "").trim().toUpperCase();
      if (k) {
        mdIdx[k + "|" + m] = {
          fila: i + 2,
          modelo: String(r[2] || "").trim(),
          color:  String(r[3] || "").trim(),
          upc:    String(r[4] || "").trim(),
        };
      }
    });

    // Leer SKU desde col A hasta H (8 cols: A=UPC, B=Cat, C=Marca, D=Nombre, E=Modelo, F=Color, G=SKU, H=Clave)
    const skuLast = _ultimaFilaSKUInventario_(shSKU);
    if (skuLast < 2) { ui.alert("SKU está vacío"); return; }
    const skuData = shSKU.getRange(2, 1, skuLast - 1, 8).getValues();

    let actualizados = 0;
    let yaTenian = 0;
    let sinMatchMD = 0;
    const detalleNoMatch = [];

    skuData.forEach(function(r) {
      const upc    = String(r[0] || "").trim();
      const marca  = String(r[2] || "").trim().toUpperCase();
      const modelo = String(r[4] || "").trim().toUpperCase();
      const color  = String(r[5] || "").trim().toUpperCase();
      const clave  = String(r[7] || "").trim();

      if (!clave || !marca) return;

      const md = mdIdx[clave + "|" + marca];
      if (!md) {
        sinMatchMD++;
        if (detalleNoMatch.length < 5) detalleNoMatch.push(clave + " / " + marca);
        return;
      }

      let cambios = false;
      if (modelo && !md.modelo) {
        shMD.getRange(md.fila, 3).setValue(modelo);
        cambios = true;
      }
      if (color && !md.color) {
        shMD.getRange(md.fila, 4).setValue(color);
        cambios = true;
      }
      if (upc && !md.upc) {
        shMD.getRange(md.fila, 5).setValue(upc);
        cambios = true;
      }

      if (cambios) {
        shMD.getRange(md.fila, 9).setValue(new Date());
        actualizados++;
      } else {
        yaTenian++;
      }
    });

    SpreadsheetApp.flush();

    let msg = "✅ Sincronización completa\n\n";
    msg += "Actualizados: " + actualizados + "\n";
    msg += "Ya tenían datos: " + yaTenian + "\n";
    msg += "Sin match en METADATA: " + sinMatchMD;
    if (detalleNoMatch.length > 0) {
      msg += "\n\nEjemplos sin match:\n  " + detalleNoMatch.join("\n  ");
    }
    ui.alert("Sincronización", msg, ui.ButtonSet.OK);
  } catch(e) {
    ui.alert("Error", e.message, ui.ButtonSet.OK);
  }
}

// ════════════════════════════════════════════════════════════════
//  recalcularDimensionesMenu — Wrapper de menú para
//  recalcularDimensionesEnSKU (Code.gs).
//
//  Copia los pesos/dimensiones de METADATA_PRODUCTOS a las cols M-P
//  de SKU_INVENTARIO. Solo llena vacíos por defecto; con "forzar"
//  sobrescribe todo. NO llama a CVA — usa solo lo que ya está en
//  METADATA.
// ════════════════════════════════════════════════════════════════
function recalcularDimensionesMenu() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("🔄 Sincronizar dimensiones → SKU_INVENTARIO",
    "Esto copiará peso/alto/ancho/profundidad de METADATA_PRODUCTOS\n" +
    "a SKU_INVENTARIO (cols M-P).\n\n" +
    "• NO consulta CVA, solo usa lo que ya está en METADATA.\n" +
    "• Solo llena celdas vacías (respeta valores manuales).\n\n" +
    "¿Continuar?", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  try {
    const r = recalcularDimensionesEnSKU(false);
    if (!r.ok) {
      ui.alert("Error", r.error || "Error desconocido", ui.ButtonSet.OK);
      return;
    }
    ui.alert("✅ Listo",
      `Total productos en SKU:   ${r.total_productos}\n` +
      `Propagados (METADATA→SKU): ${r.propagadas}\n` +
      `Ya tenían datos:           ${r.ya_tenian}\n` +
      `Sin datos en METADATA:     ${r.sin_datos_md}\n\n` +
      (r.sin_datos_md > 0
        ? "💡 Para los productos sin datos en METADATA, ejecuta primero\n" +
          "   '🔬 Enriquecer pesos desde CVA'."
        : ""),
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert("Error", e.message, ui.ButtonSet.OK);
  }
}

// ════════════════════════════════════════════════════════════════
//  🔍 DIAGNÓSTICO: ver QUÉ devuelve CVA exactamente
//
//  Llama al endpoint cva_producto (que internamente usa lista_precios
//  con dimen=true) para 3 productos. Ése es el endpoint correcto para
//  obtener dimensiones — NO informacion_tecnica, que solo trae specs
//  técnicas (capacidad, tipo de memoria, etc.).
// ════════════════════════════════════════════════════════════════
function diagnosticarPesosCVAMenu() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActive();
  const shSKU = ss.getSheetByName("SKU_INVENTARIO");
  if (!shSKU) { ui.alert("No existe SKU_INVENTARIO"); return; }

  const lastRow = shSKU.getLastRow();
  if (lastRow < 2) { ui.alert("SKU_INVENTARIO vacío"); return; }
  const colH = shSKU.getRange(2, 8, Math.min(lastRow - 1, 1000), 1).getValues();
  const claves = [];
  for (let i = 0; i < colH.length && claves.length < 3; i++) {
    const v = String(colH[i][0] || "").trim();
    if (v) claves.push(v);
  }
  if (claves.length === 0) { ui.alert("No hay claves en SKU_INVENTARIO"); return; }

  let reporte = "🔍 DIAGNÓSTICO CVA · cva_producto (lista_precios con dimen=true)\n\n";
  reporte += "Probaré con " + claves.length + " producto(s): " + claves.join(", ") + "\n\n";
  reporte += "═══════════════════════════════════════\n\n";

  for (const clave of claves) {
    reporte += "▶ Clave: " + clave + "\n";
    try {
      const url = _WEB_APP_URL + "?action=cva_producto&clave=" + encodeURIComponent(clave);
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
      const code = res.getResponseCode();
      const txt = res.getContentText();

      reporte += "  HTTP: " + code + "\n";
      if (code !== 200) {
        reporte += "  ❌ Respuesta no-200:\n  " + txt.substring(0, 400) + "\n\n";
        continue;
      }

      let resp;
      try { resp = JSON.parse(txt); }
      catch(e) {
        reporte += "  ❌ JSON inválido: " + e.message + "\n\n";
        continue;
      }

      // cva_producto envuelve la respuesta así: { ok: true, producto: {...} }
      const data = resp.producto || resp;

      // Pretty-print JSON (limitado)
      reporte += "  Respuesta (primeros 2000 chars):\n";
      const json = JSON.stringify(data, null, 2);
      reporte += "  " + json.substring(0, 2000).split("\n").join("\n  ") + "\n";

      // Análisis de campos de dimensiones
      reporte += "\n  ── ANÁLISIS DIMENSIONES ──\n";
      const buscar = (obj, ruta) => {
        if (!obj) return;
        const keys = ["dimensiones", "dimensions", "peso", "weight",
                      "alto", "ancho", "profundidad", "height", "width", "depth", "deep",
                      "unidad_peso", "weight_unit"];
        keys.forEach(k => {
          if (obj.hasOwnProperty(k)) {
            reporte += "    • " + ruta + k + " = " + JSON.stringify(obj[k]) + "\n";
          }
        });
      };
      buscar(data, "data.");
      if (data.dimensiones) buscar(data.dimensiones, "data.dimensiones.");
      if (data.dimensions)  buscar(data.dimensions,  "data.dimensions.");

      // Si articulos[0] (caso lista de 1)
      if (data.articulos && data.articulos[0]) {
        reporte += "    [articulos[0]]:\n";
        buscar(data.articulos[0], "data.articulos[0].");
        if (data.articulos[0].dimensiones) buscar(data.articulos[0].dimensiones, "data.articulos[0].dimensiones.");
      }
      reporte += "\n";

    } catch(e) {
      reporte += "  ❌ Excepción: " + e.message + "\n\n";
    }
    Utilities.sleep(300);
  }

  reporte += "═══════════════════════════════════════\n";
  reporte += "Copia este texto y compártelo.\n";

  let shDiag = ss.getSheetByName("_DIAG_PESOS");
  if (!shDiag) shDiag = ss.insertSheet("_DIAG_PESOS");
  shDiag.clear();
  const lineas = reporte.split("\n").map(l => [l]);
  shDiag.getRange(1, 1, lineas.length, 1).setValues(lineas);
  shDiag.setColumnWidth(1, 900);
  shDiag.getRange(1, 1).setFontWeight("bold");

  ui.alert("✅ Diagnóstico completado",
    "Resultado guardado en hoja '_DIAG_PESOS'.\n\n" +
    "Ahora estamos consultando el endpoint CORRECTO (cva_producto con " +
    "dimen=true). Si igual no aparecen dimensiones, CVA no las tiene " +
    "para estos productos.",
    ui.ButtonSet.OK);
}

// ════════════════════════════════════════════════════════════════
//  🔬 ENRIQUECER PESOS LOCAL — usa el endpoint CORRECTO
//
//  El endpoint cva_info_tecnica solo trae specs técnicas (capacidad,
//  tipo, etc.) — NO dimensiones. Las dimensiones vienen del endpoint
//  cva_producto que internamente usa /lista_precios con dimen=true.
//
//  La lógica vive en _enriquecerPesosCore_ para que pueda ser llamada
//  silenciosamente desde importarUPCsDesdeHoja (sin UI). El wrapper
//  enriquecerPesosLocalMenu solo agrega los diálogos.
// ════════════════════════════════════════════════════════════════

function _enriquecerPesosCore_(opts) {
  opts = opts || {};
  const forzar = opts.forzar === true;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shSKU = ss.getSheetByName("SKU_INVENTARIO");
  const shMD  = ss.getSheetByName("METADATA_PRODUCTOS");
  if (!shSKU) return { ok: false, error: "Falta SKU_INVENTARIO" };
  if (!shMD)  return { ok: false, error: "Falta METADATA_PRODUCTOS" };

  // Leer claves de SKU
  const lastRow = _ultimaFilaSKUInventario_(shSKU);
  if (lastRow < 2) return { ok: false, error: "SKU_INVENTARIO vacío" };
  const colH = shSKU.getRange(2, 8, lastRow - 1, 1).getValues();
  const clavesNecesarias = [];
  colH.forEach(function(r) {
    const v = String(r[0] || "").trim();
    if (v) clavesNecesarias.push(v);
  });
  if (clavesNecesarias.length === 0) return { ok: false, error: "Sin claves" };

  // Indexar METADATA (clave → fila + saber quién ya tiene datos)
  const mdLast = shMD.getLastRow();
  const mdIdx = {};
  const yaTieneDatos = {};
  if (mdLast >= 2) {
    const mdData = shMD.getRange(2, 1, mdLast - 1, 13).getValues();
    mdData.forEach(function(r, i) {
      const k = String(r[0] || "").trim();
      if (k) {
        mdIdx[k] = i + 2;
        if (r[9] && r[10]) yaTieneDatos[k] = true;
      }
    });
  }

  // ── CONSULTAS INDIVIDUALES DIRECTAS A CVA ──
  // Para cada clave, consultar el endpoint individual que SIEMPRE trae
  // dimensiones (a diferencia del paginado que solo trae para algunos).
  // ~1.5s por producto. Para 35 productos: ~50 segundos.
  const START = Date.now();
  const MAX_MS = 5 * 60 * 1000;
  let okCount = 0, sinDim = 0, errores = 0, saltadas = 0;
  const detalleErrores = [];

  for (let i = 0; i < clavesNecesarias.length; i++) {
    if (Date.now() - START > MAX_MS) {
      _setupLog_("ENRIQUECER ⏱", "Tiempo límite alcanzado",
        "Procesados " + i + "/" + clavesNecesarias.length + ". Re-disparar para continuar.");
      break;
    }
    const clave = clavesNecesarias[i];

    if (!forzar && yaTieneDatos[clave]) {
      saltadas++;
      continue;
    }

    try {
      // Consulta individual con TODOS los parámetros de dimensión
      const respCva = _cvaFetchLocal_("/catalogo_clientes/lista_precios", {
        clave: clave,
        dimen: "true",
        dt: "true",
        dc: "true",
        MonedaPesos: "true",
      });

      let prod = respCva;
      if (respCva.articulos && respCva.articulos[0]) prod = respCva.articulos[0];

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
        continue;
      }

      const rangoMELI = _mapearPesoMELI_local_(pesoNum);
      const filaMD = mdIdx[clave];
      if (filaMD) {
        shMD.getRange(filaMD, 8, 1, 6).setValues([[
          rangoMELI, new Date(), pesoKg, altoCm, anchoCm, profCm,
        ]]);
        okCount++;
      }
    } catch(e) {
      errores++;
      if (detalleErrores.length < 5) detalleErrores.push(clave + ": " + e.message.substring(0, 50));
    }

    // Log de progreso cada 10 productos para que se vea avance en vivo
    if ((i + 1) % 10 === 0 || (i + 1) === clavesNecesarias.length) {
      SpreadsheetApp.flush();
      _setupLog_("ENRIQUECER ⏳", "Progreso " + (i + 1) + "/" + clavesNecesarias.length,
        "ok=" + okCount + " · sinDim=" + sinDim + " · err=" + errores + " · saltadas=" + saltadas);
    }
  }

  SpreadsheetApp.flush();
  const duracion = Math.round((Date.now() - START) / 1000);
  return {
    ok: true,
    total_productos: clavesNecesarias.length,
    actualizadas: okCount,
    saltadas: saltadas,
    sin_dimensiones: sinDim,
    errores: errores,
    detalle_errores: detalleErrores,
    duracion_seg: duracion,
  };
}

function enriquecerPesosLocalMenu() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("🔬 Re-enriquecer pesos desde CVA",
    "Recorre todos los productos de SKU_INVENTARIO, consulta CVA y\n" +
    "actualiza peso/dimensiones en METADATA y SKU.\n\n" +
    "NORMALMENTE no necesitas hacer esto manualmente — ya se ejecuta\n" +
    "automáticamente cuando importas UPCs.\n\n" +
    "Esta opción es para forzar una re-sincronización.\n\n" +
    "¿Continuar?", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  const r = _enriquecerPesosCore_({ silencioso: false });
  if (!r.ok) { ui.alert("Error", r.error || "Error desconocido", ui.ButtonSet.OK); return; }

  ui.alert("✅ Listo",
    "Total productos:  " + r.total + "\n" +
    "✅ Con datos:      " + r.actualizadas + "\n" +
    "⚠ Sin datos:      " + r.sin_dimensiones + "\n" +
    "❌ Errores:        " + r.errores + "\n\n" +
    "Detalle por producto en la hoja '_DIAG_PESOS'.",
    ui.ButtonSet.OK);
}

function _mapearPesoMELI_local_(kg) {
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
//  📈 Sincronizar VENTAS CVA AHORA — wrapper de menú
//
//  Trae ventas dropship de Odoo y las guarda en VENTAS_CVA con
//  particionamiento automático. Calcula utilidad usando SYNC_CVA
//  como fuente de costos.
// ════════════════════════════════════════════════════════════════
function sincronizarVentasCVAMenu() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("📈 Sincronizar ventas CVA",
    "Esto lee de Odoo todas las ventas con productos cuyo SKU termina\n" +
    "en -CVA y las guarda en la hoja VENTAS_CVA (creando particiones\n" +
    "VENTAS_CVA_2, VENTAS_CVA_3... cuando hace falta).\n\n" +
    "Calcula utilidad por línea usando los costos actuales de SYNC_CVA.\n\n" +
    "También se ejecuta automáticamente cada hora cuando los triggers\n" +
    "están instalados.\n\n" +
    "¿Continuar?", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  try {
    // Llama vía Web App porque sincronizarVentasCVA vive en el proyecto del Web App
    const url = _WEB_APP_URL + "?action=ventas_cva_sync";
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    const code = res.getResponseCode();
    if (code !== 200) {
      ui.alert("Error HTTP " + code, res.getContentText().substring(0, 500), ui.ButtonSet.OK);
      return;
    }
    const r = JSON.parse(res.getContentText());
    if (!r.ok) {
      ui.alert("Error", r.error || "Error desconocido", ui.ButtonSet.OK);
      return;
    }
    ui.alert("✅ Sincronización completada",
      "Líneas evaluadas:   " + (r.lineas_evaluadas || 0) + "\n" +
      "Productos -CVA:      " + (r.productos_cva || 0) + "\n" +
      "Órdenes revisadas:   " + (r.ordenes_revisadas || 0) + "\n\n" +
      "✅ Ventas nuevas:    " + r.nuevas + "\n" +
      "🔄 Actualizadas:     " + r.actualizadas + "\n\n" +
      "Particiones activas: " + (r.particiones || []).join(", "),
      ui.ButtonSet.OK);
  } catch(e) {
    ui.alert("Error", e.message, ui.ButtonSet.OK);
  }
}

// ════════════════════════════════════════════════════════════════
//  Odoo Sync — wrappers de menú
// ════════════════════════════════════════════════════════════════

function verEstadoColaOdooMenu() {
  const ui = SpreadsheetApp.getUi();
  try {
    const url = _WEB_APP_URL + "?action=odoo_sync_estado";
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    const r = JSON.parse(res.getContentText());
    if (!r.ok) { ui.alert("Error", r.error || "Error", ui.ButtonSet.OK); return; }

    const c = r.contadores || {};
    let msg = "📊 ESTADO DE LA COLA Odoo Sync\n\n";
    msg += "Total en cola:    " + r.total + "\n\n";
    msg += "🕓 Pendientes:     " + (c.PENDIENTE || 0) + "\n";
    msg += "✅ Completados:    " + (c.COMPLETADO || 0) + "\n";
    msg += "⚠ Con error:      " + (c.ERROR || 0) + " (reintentando)\n";
    msg += "❌ Failed:         " + (c.FAILED || 0) + " (excedió 3 intentos)\n\n";

    if (r.ultimos && r.ultimos.length > 0) {
      msg += "Últimos 5 procesados:\n";
      r.ultimos.slice(0, 5).forEach(u => {
        msg += "  • " + u.clave + " · " + u.tipo + " · " + u.estado;
        if (u.error_msg) msg += " (" + u.error_msg.substring(0, 50) + ")";
        msg += "\n";
      });
    }

    ui.alert("Odoo Sync", msg, ui.ButtonSet.OK);
  } catch(e) {
    ui.alert("Error", e.message, ui.ButtonSet.OK);
  }
}

function procesarColaOdooAhora() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("▶ Procesar cola Odoo Sync AHORA",
    "Detecta cambios en SKU_INVENTARIO col K (Stock para Odoo) y los\n" +
    "manda a Odoo (campo x_stock_cva). Normalmente corre cada 15 min\n" +
    "automáticamente.\n\n" +
    "¿Continuar?", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  try {
    // Detectar primero
    const urlDet = _WEB_APP_URL + "?action=odoo_sync_detectar";
    const resDet = UrlFetchApp.fetch(urlDet, { muteHttpExceptions: true, followRedirects: true });
    const det = JSON.parse(resDet.getContentText());

    // Procesar
    const urlProc = _WEB_APP_URL + "?action=odoo_sync_procesar&batch=100";
    const resProc = UrlFetchApp.fetch(urlProc, { muteHttpExceptions: true, followRedirects: true });
    const proc = JSON.parse(resProc.getContentText());

    let msg = "✅ Sync ejecutado\n\n";
    msg += "DETECCIÓN:\n";
    msg += "  Cambios detectados:  " + (det.cambios_detectados || 0) + "\n";
    msg += "  Primeras veces:      " + (det.primeras_veces || 0) + "\n";
    msg += "  Productos en SKU:    " + (det.productos_en_sku || 0) + "\n\n";
    msg += "PROCESAMIENTO:\n";
    msg += "  Procesados:          " + (proc.procesados || 0) + "\n";
    msg += "  ✅ Completados:       " + (proc.completados || 0) + "\n";
    msg += "  ❌ Errores:           " + (proc.errores || 0) + "\n\n";
    msg += "Ver detalle en hoja ODOO_SYNC_QUEUE.";

    ui.alert("Odoo Sync", msg, ui.ButtonSet.OK);
  } catch(e) {
    ui.alert("Error", e.message, ui.ButtonSet.OK);
  }
}

function limpiarCompletadosOdooMenu() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("🗑 Limpiar completados",
    "Elimina de la cola los items COMPLETADOS con más de 7 días\n" +
    "de antigüedad. Los items FAILED y PENDIENTES se conservan.\n\n" +
    "¿Continuar?", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  try {
    const url = _WEB_APP_URL + "?action=odoo_sync_limpiar&dias=7";
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    const r = JSON.parse(res.getContentText());
    ui.alert("✅ Listo", "Eliminados: " + (r.eliminados || 0) + " items", ui.ButtonSet.OK);
  } catch(e) {
    ui.alert("Error", e.message, ui.ButtonSet.OK);
  }
}

// ════════════════════════════════════════════════════════════════
//  asegurarConfigGlobal_ — verifica que W3 (TC) exista en SKU
//
//  No borra nada. Si W3 está vacío, lo crea con default 17.50.
//  Idempotente — ejecutable cuantas veces quieras.
//  Llamado al iniciar y cuando se entra a Análisis/Buscar.
// ════════════════════════════════════════════════════════════════
function asegurarConfigGlobal_() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const shSKU = ss.getSheetByName("SKU_INVENTARIO");
  if (!shSKU) return { ok: false, error: "SKU_INVENTARIO no existe" };

  // Verificar W2 (% global)
  const w2 = shSKU.getRange("W2").getValue();
  if (w2 === "" || w2 == null) {
    shSKU.getRange("W2").setValue(20).setNumberFormat("0\"%\"");
  }

  // Verificar W3 (TC USD→MXN) — si no existe, crearlo
  const w3 = shSKU.getRange("W3").getValue();
  if (w3 === "" || w3 == null || parseFloat(w3) < 1) {
    shSKU.setRowHeight(3, 40);
    shSKU.getRange("V3").setValue("TC USD→MXN:")
      .setBackground("#0a1f1d").setFontColor("#ddd").setHorizontalAlignment("right")
      .setVerticalAlignment("middle").setFontWeight("bold");
    shSKU.getRange("W3").setValue(17.50)
      .setBackground("#e8f0fe").setFontWeight("bold").setFontSize(16)
      .setHorizontalAlignment("center").setVerticalAlignment("middle")
      .setNumberFormat("$0.00");
    const ruleTC = SpreadsheetApp.newDataValidation()
      .requireNumberBetween(1, 100).setAllowInvalid(false).build();
    shSKU.getRange("W3").setDataValidation(ruleTC);
  }

  SpreadsheetApp.flush();
  return { ok: true, pct_global: parseFloat(w2) || 20, tc_global: parseFloat(w3) || 17.50 };
}

// Wrapper para invocar desde menú
function asegurarConfigGlobalMenu() {
  const ui = SpreadsheetApp.getUi();
  const r = asegurarConfigGlobal_();
  if (!r.ok) { ui.alert("Error", r.error, ui.ButtonSet.OK); return; }
  ui.alert("✅ Config OK",
    "% Global:    " + r.pct_global + "%\n" +
    "TC USD→MXN: $" + r.tc_global + "\n\n" +
    "Los valores se pueden editar directamente en SKU_INVENTARIO W2 y W3.",
    ui.ButtonSet.OK);
}

// ════════════════════════════════════════════════════════════════
//  migrarAARRAYFORMULA — convierte fórmulas por fila a ARRAYFORMULA
//
//  Lo hace IN-PLACE sin borrar la hoja:
//    1. Lee la última fila con clave (col H)
//    2. Limpia G3:G[last], J3:J[last], Q3:T[last] (celdas con fórmulas viejas)
//    3. Asegura ARRAYFORMULA en G2, J2, Q2, R2, S2, T2 (raíces)
//    4. Estas ARRAYFORMULA se autorrellenan al instante
//
//  Es 100% no destructivo para datos editables (modelo, color, UPC).
// ════════════════════════════════════════════════════════════════
function migrarAARRAYFORMULA() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("⚡ Migrar a ARRAYFORMULA (versión completa)",
    "Re-aplicará TODAS las ARRAYFORMULA en SKU_INVENTARIO:\n\n" +
    "  • Col G (SKU)\n" +
    "  • Col I (Precio CVA · con factor TC W3/17.5)\n" +
    "  • Col J (Precio MELI)\n" +
    "  • Col K (Stock CVA)\n" +
    "  • Col L (Stock para Odoo)\n" +
    "  • Col M (Peso kg) ← desde METADATA\n" +
    "  • Cols N, O, P (Alto, Ancho, Prof) ← desde METADATA\n" +
    "  • Cols Q, R, S, T (Empaque)\n\n" +
    "⚠ Las cols M-P ahora leen SIEMPRE de METADATA_PRODUCTOS\n" +
    "  Para actualizar dimensiones: edita METADATA, no SKU directamente.\n\n" +
    "✅ NO toca tus datos editables (modelo E, color F, UPC A, clave H)\n" +
    "✅ Cambios en W2/W3/CONFIG_MELI se propagan al instante\n\n" +
    "¿Continuar?", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  try {
    const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
    const sh = ss.getSheetByName("SKU_INVENTARIO");
    if (!sh) { ui.alert("Error", "SKU_INVENTARIO no existe", ui.ButtonSet.OK); return; }

    const lastReal = _ultimaFilaSKUInventario_(sh);
    Logger.log("[MIGRAR] Última fila con clave: " + lastReal);

    // 1) Limpiar celdas hijas (de la fila 3 hacia abajo)
    //    Cols calculadas: G(7), I(9), J(10), K(11), L(12), M(13), N(14), O(15), P(16), Q(17), R(18), S(19), T(20)
    //    NO se tocan: A(UPC), B(Categoría), C(Marca), D(Nombre), E(Modelo), F(Color), H(Clave)
    if (lastReal >= 3) {
      const filasALimpiar = lastReal - 2;
      [7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].forEach(col => {
        sh.getRange(3, col, filasALimpiar, 1).clearContent();
      });
      // También limpiar la celda raíz para evitar conflicto cuando re-aplicamos
      [7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].forEach(col => {
        sh.getRange(2, col, 1, 1).clearContent();
      });
      Logger.log("[MIGRAR] Limpié " + filasALimpiar + " filas en cols calculadas + celdas raíz");
    }

    SpreadsheetApp.flush();

    // 2) Aplicar ARRAYFORMULAS en las raíces (fila 2). El orden importa
    //    para que las dependencias se calculen bien.
    // SKU (G)
    sh.getRange("G2").setFormula(_formulaSKUArray_());
    // Precio CVA (I) — con factor TC dinámico W3/17.50 sobre TODOS los productos
    sh.getRange("I2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,SYNC_CVA!$A:$E,5,FALSE),0) * ($W$3 / 17.5)))'
    );
    // Stock CVA (K)
    sh.getRange("K2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,SYNC_CVA!$A:$H,7,FALSE),0)+IFERROR(VLOOKUP(H2:H,SYNC_CVA!$A:$H,8,FALSE),0)))'
    );
    // Stock para Odoo (L) — usa $W$2 (% global)
    sh.getRange("L2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",ROUNDDOWN(K2:K * $W$2 / 100, 0)))'
    );
    // Dimensiones (M, N, O, P) — leen de METADATA_PRODUCTOS
    sh.getRange("M2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,10,FALSE),"")))'
    );
    sh.getRange("N2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,11,FALSE),"")))'
    );
    sh.getRange("O2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,12,FALSE),"")))'
    );
    sh.getRange("P2").setFormula(
      '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,13,FALSE),"")))'
    );
    // Precio MELI (J) — depende de I, M (peso), B (categoría)
    sh.getRange("J2").setFormula(_formulaPrecioMELIArray_());
    // Empaque (Q, R, S, T) — depende de M, N, O, P
    sh.getRange("Q2").setFormula(_formulaEmpaqueAltoArray_());
    sh.getRange("R2").setFormula(_formulaEmpaqueAnchoArray_());
    sh.getRange("S2").setFormula(_formulaEmpaqueProfArray_());
    sh.getRange("T2").setFormula(_formulaEmpaquePesoArray_());

    SpreadsheetApp.flush();

    ui.alert("✅ Migración completada",
      "Las fórmulas ahora son ARRAYFORMULA dinámicas.\n\n" +
      "VERIFICA EN VIVO:\n" +
      "  • Cambia W3 (TC) de 17.50 a 20.00\n" +
      "    → col I sube ~14% (factor 20/17.5)\n" +
      "    → col J (Precio MELI) recalcula\n\n" +
      "  • Cambia W2 (% Global) de 20 a 30\n" +
      "    → col L (Stock Odoo) sube proporcional\n\n" +
      "  • Las dimensiones (M-P) ahora leen METADATA.\n" +
      "    Si están vacías, ejecuta '🔧 Re-enriquecer pesos LOCAL'.\n\n" +
      "Filas afectadas: " + Math.max(0, lastReal - 1),
      ui.ButtonSet.OK);
  } catch(e) {
    ui.alert("Error", e.message, ui.ButtonSet.OK);
  }
}

// ════════════════════════════════════════════════════════════════
//  CAT_ELECTRONICS — categorías propias del negocio
//
//  Estructura de la hoja CAT_ELECTRONICS (la función se adapta):
//    Col A: Nombre categoría Electronics       (OBLIGATORIA)
//    Col B: Categoría MELI correspondiente     (opcional)
//    Col C: Palabras clave separadas por coma  (opcional, mejor matching)
//
//  Si la hoja solo tiene col A, hacemos matching heurístico por
//  palabras del nombre Electronics vs grupo/descripción del producto.
//  Cache en memoria por ejecución para evitar lecturas repetidas.
// ════════════════════════════════════════════════════════════════

let _cacheCatElect_ = null;

function _leerCatElectronics_() {
  if (_cacheCatElect_ !== null) return _cacheCatElect_;

  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const sh = ss.getSheetByName("CAT_ELECTRONICS");
  if (!sh) { _cacheCatElect_ = []; return _cacheCatElect_; }

  const last = sh.getLastRow();
  if (last < 2) { _cacheCatElect_ = []; return _cacheCatElect_; }

  const cols = Math.min(sh.getLastColumn(), 3);
  const data = sh.getRange(2, 1, last - 1, cols).getValues();
  _cacheCatElect_ = data.map(r => ({
    nombre:   String(r[0] || "").trim(),
    catMeli:  cols >= 2 ? String(r[1] || "").trim() : "",
    keywords: cols >= 3 ? String(r[2] || "").trim() : "",
  })).filter(c => c.nombre.length > 0);

  Logger.log("[CAT_ELECTRONICS] cargadas " + _cacheCatElect_.length + " categorías");
  return _cacheCatElect_;
}

// Mapea grupo CVA + descripción → categoría Electronics
// Devuelve string (categoría) o "" si no hay match y no hay catálogo
function _mapeoCATELECT_(grupo, desc) {
  const catalogo = _leerCatElectronics_();
  if (catalogo.length === 0) return "";  // sin CAT_ELECTRONICS → vacío

  const g = String(grupo || "").toUpperCase();
  const d = String(desc || "").toUpperCase();
  const texto = (g + " " + d).trim();

  // 1) Match por palabras clave explícitas (col C) — más precisa
  for (const cat of catalogo) {
    if (cat.keywords) {
      const kws = cat.keywords.toUpperCase().split(/[,;|]/).map(s => s.trim()).filter(Boolean);
      for (const kw of kws) {
        if (kw && texto.indexOf(kw) >= 0) return cat.nombre;
      }
    }
  }

  // 2) Match por nombre completo de la categoría dentro del texto
  for (const cat of catalogo) {
    const nombreUpper = cat.nombre.toUpperCase();
    if (nombreUpper && texto.indexOf(nombreUpper) >= 0) return cat.nombre;
  }

  // 3) Fallback robusto: heurística regex sobre las 27 categorías estándar.
  // Solo devuelve la categoría si EXISTE en el catálogo del usuario.
  const sugerida = _mapeoGrupoCVAaCAT_(grupo, desc);
  if (sugerida) {
    const existe = catalogo.find(c => c.nombre.toUpperCase() === sugerida);
    if (existe) return existe.nombre;
  }

  // 4) Match por palabra individual del nombre (palabras de 4+ letras)
  for (const cat of catalogo) {
    const palabras = cat.nombre.toUpperCase().split(/\s+/).filter(p => p.length >= 4);
    for (const p of palabras) {
      if (texto.indexOf(p) >= 0) return cat.nombre;
    }
  }

  // 5) Buscar una categoría llamada "Otros" / "Otro" / "Sin categoría" / "Accesorios"
  const generico = catalogo.find(c =>
    /OTRO|SIN.*CATEGOR|MISC|ACCESORIOS/i.test(c.nombre)
  );
  if (generico) return generico.nombre;

  // 6) Último fallback
  return "";
}

// Mapea Electronics → MELI usando la col B de CAT_ELECTRONICS (si existe)
// Si no encuentra mapeo, usa el default del CAT_ELECTRONICS estándar.
function _electToMELI_(categoriaElectronics, grupo, desc) {
  if (categoriaElectronics) {
    const catalogo = _leerCatElectronics_();
    const match = catalogo.find(c =>
      c.nombre.toUpperCase() === categoriaElectronics.toUpperCase()
    );
    if (match && match.catMeli) return match.catMeli;
    // Si la categoría existe en el catálogo pero sin mapeo, buscar en el default
    const standardMatch = CAT_ELECTRONICS.find(([cat, _]) =>
      cat.toUpperCase() === categoriaElectronics.toUpperCase()
    );
    if (standardMatch) return standardMatch[1];
  }
  // Último fallback: heurística directa
  return "Accesorios electrónicos";
}

// Invalida cache (útil después de editar CAT_ELECTRONICS)
function _invalidarCacheCatElect_() {
  _cacheCatElect_ = null;
}

// ════════════════════════════════════════════════════════════════
//  _limpiarModelo_ — normaliza modelo: símbolos → espacios
//
//  Reemplaza  . , : ; _ / \ -  por espacios. Colapsa espacios
//  múltiples, hace trim y MAYÚSCULAS. Quita acentos.
//  Si el usuario escribe "RTX-3060_v2" → "RTX 3060 V2"
// ════════════════════════════════════════════════════════════════
function _limpiarModelo_(modelo) {
  if (!modelo) return "";
  return String(modelo)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // quita acentos
    .replace(/[.,:;_\/\\\-]/g, " ")   // símbolos → espacios
    .replace(/\s+/g, " ")              // colapsa espacios múltiples
    .trim()
    .toUpperCase();
}

// ════════════════════════════════════════════════════════════════
//  CAT_ELECTRONICS — categorías propias de Electronics México
//
//  Hoja con 27 categorías. Col A: CAT_ELECTRONICS, Col B: categoría MELI
//  equivalente (para que la fórmula del Precio MELI calcule comisión).
//
//  Si la hoja ya existe (porque el usuario la creó), respeta lo que tenga
//  en col A y B. Si no existe, la crea con las 27 categorías + mapeo
//  estándar a MELI.
// ════════════════════════════════════════════════════════════════
const CAT_ELECTRONICS = [
  ["ACCESORIOS",             "Accesorios electrónicos"],
  ["ALIMENTOS",              "Alimentos y bebidas"],
  ["AUDIO Y AMPLIFICADORES", "Audio y video"],
  ["AUTOMOTRIZ",             "Productos vehiculares (excluye audio y video)"],
  ["CABLES",                 "Accesorios electrónicos"],
  ["CALZADO",                "Ropa, calzado, maletas y accesorios"],
  ["CAMARAS Y LENTES",       "Cámaras y drones"],
  ["CELULARES",              "Celulares y smartphones"],
  ["COCINA Y HOGAR",         "Hogar (interior y exterior)"],
  ["COMPUTADORAS",           "Computación e impresión"],
  ["DEPORTES",               "Otros artículos de deportes y fitness (excluye ropa y calzado)"],
  ["ELECTRODOMESTICOS",      "Pequeños electrodomésticos"],
  ["HARDWARE",               "Computación e impresión"],
  ["HERRAMIENTAS",           "Herramientas eléctricas"],
  ["ILUMINACION",            "Hogar (interior y exterior)"],
  ["IMPRESORAS Y ESCANERES", "Computación e impresión"],
  ["JOYERIA",                "Joyería"],
  ["JUGUETES",               "Juegos y Juguetes"],
  ["LENTES DE ARMAZON",      "Accesorios electrónicos"],
  ["MASCOTAS",               "Animales y mascotas"],
  ["PERFUMES",               "Belleza"],
  ["PROYECTORES",            "Audio y video"],
  ["RELOJES",                "Relojes"],
  ["SALUD Y BELLEZA",        "Belleza"],
  ["TABLETS",                "Computación e impresión"],
  ["TV Y VIDEO",             "Televisores"],
  ["VIDEOJUEGOS",            "Consolas de videojuegos"],
];

function asegurarHojaCATElectronics_() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  let sh = ss.getSheetByName("CAT_ELECTRONICS");

  if (!sh) {
    sh = ss.insertSheet("CAT_ELECTRONICS");
  }

  // Verificar si tiene headers; si no, ponerlos
  const firstRow = sh.getRange(1, 1, 1, 2).getValues()[0];
  const tieneHeaders = String(firstRow[0] || "").toUpperCase().indexOf("CAT") >= 0
                    || String(firstRow[1] || "").toUpperCase().indexOf("MELI") >= 0;

  if (!tieneHeaders) {
    sh.insertRowBefore(1);
  }
  sh.getRange("A1:B1").setValues([["CAT_ELECTRONICS", "Categoría MELI (para comisión)"]])
    .setFontWeight("bold").setBackground("#00665e").setFontColor("#fff");
  sh.setFrozenRows(1);

  // Si la hoja está vacía (solo tiene headers), poblar con las 27 categorías
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) {
    sh.getRange(2, 1, CAT_ELECTRONICS.length, 2).setValues(CAT_ELECTRONICS);
  } else {
    // La hoja ya tiene datos del usuario en col A. Para cada categoría que
    // SÍ esté en col A pero NO tenga mapeo en col B, completar con el default.
    const datos = sh.getRange(2, 1, lastRow - 1, 2).getValues();
    const mapeoStandard = {};
    CAT_ELECTRONICS.forEach(([cat, meli]) => { mapeoStandard[cat] = meli; });
    let cambios = 0;
    datos.forEach((r, i) => {
      const catUsuario = String(r[0] || "").trim().toUpperCase();
      const meliActual = String(r[1] || "").trim();
      if (catUsuario && !meliActual) {
        const sugerido = mapeoStandard[catUsuario] || "Accesorios electrónicos";
        sh.getRange(i + 2, 2).setValue(sugerido);
        cambios++;
      }
    });
    Logger.log("[CAT_ELECTRONICS] Mapeos completados: " + cambios);
  }

  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 280);
  SpreadsheetApp.flush();
  return sh;
}

// Wrapper de menú
function asegurarHojaCATElectronicsMenu() {
  const ui = SpreadsheetApp.getUi();
  try {
    asegurarHojaCATElectronics_();
    ui.alert("✅ CAT_ELECTRONICS lista",
      "La hoja CAT_ELECTRONICS está configurada con tus 27 categorías y\n" +
      "su mapeo a las categorías MELI (para calcular comisiones).\n\n" +
      "Si quieres ajustar algún mapeo, edita la col B directamente.\n" +
      "El sistema usará col A para mostrar la categoría en SKU_INVENTARIO\n" +
      "y col B para calcular la comisión MELI.",
      ui.ButtonSet.OK);
  } catch(e) {
    ui.alert("Error", e.message, ui.ButtonSet.OK);
  }
}

// ════════════════════════════════════════════════════════════════
//  normalizarTodosLosModelos — recorre col E de SKU_INVENTARIO y
//  aplica _limpiarModelo_ a todos los valores existentes.
//
//  Útil después de borrar/reimportar SKU_INVENTARIO o si tienes
//  modelos viejos con guiones, puntos, etc.
// ════════════════════════════════════════════════════════════════
function normalizarTodosLosModelosMenu() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("🧹 Normalizar modelos",
    "Recorrerá la col E (Modelo) de SKU_INVENTARIO y reemplazará los\n" +
    "símbolos `. , : ; _ / \\ -` por espacios en TODOS los modelos.\n\n" +
    "Ejemplo:\n" +
    "  RTX-3060_v2  →  RTX 3060 V2\n" +
    "  HP/M281      →  HP M281\n" +
    "  GTX.1080;TI  →  GTX 1080 TI\n\n" +
    "¿Continuar?", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  try {
    const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
    const sh = ss.getSheetByName("SKU_INVENTARIO");
    if (!sh) { ui.alert("Error", "SKU_INVENTARIO no existe", ui.ButtonSet.OK); return; }

    const lastReal = _ultimaFilaSKUInventario_(sh);
    if (lastReal < 2) { ui.alert("Info", "No hay datos", ui.ButtonSet.OK); return; }

    const filas = lastReal - 1;
    const rango = sh.getRange(2, 5, filas, 1); // col E
    const data = rango.getValues();
    let cambios = 0;
    const limpios = data.map(r => {
      const original = String(r[0] || "");
      const limpio = _limpiarModelo_(original);
      if (limpio !== original && limpio !== "") cambios++;
      return [limpio];
    });
    rango.setValues(limpios);
    SpreadsheetApp.flush();

    ui.alert("✅ Listo",
      "Modelos procesados:  " + filas + "\n" +
      "Modelos modificados: " + cambios,
      ui.ButtonSet.OK);
  } catch(e) {
    ui.alert("Error", e.message, ui.ButtonSet.OK);
  }
}

// ════════════════════════════════════════════════════════════════
//  diagnosticarFormulasSKU — verifica el estado de las ARRAYFORMULA
//
//  Lee las celdas raíz (G2, I2, J2, K2, L2, M2-P2, Q2-T2) y reporta
//  cuál tiene fórmula, cuál no, y si hay errores propagados.
//  Útil para detectar si la migración a ARRAYFORMULA aplicó bien.
// ════════════════════════════════════════════════════════════════
function diagnosticarFormulasSKU() {
  const ui = SpreadsheetApp.getUi();
  try {
    const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
    const sh = ss.getSheetByName("SKU_INVENTARIO");
    if (!sh) { ui.alert("Error", "SKU_INVENTARIO no existe", ui.ButtonSet.OK); return; }

    const celdas = {
      "G2": "SKU",
      "I2": "Precio CVA",
      "J2": "Precio MELI",
      "K2": "Stock CVA",
      "L2": "Stock para Odoo",
      "M2": "Peso kg",
      "N2": "Alto cm",
      "O2": "Ancho cm",
      "P2": "Profundidad cm",
      "Q2": "Empaque Alto",
      "R2": "Empaque Ancho",
      "S2": "Empaque Prof",
      "T2": "Empaque Peso",
    };

    let msg = "📊 ESTADO DE FÓRMULAS — SKU_INVENTARIO\n\n";
    const errores = [];
    Object.keys(celdas).forEach(addr => {
      const label = celdas[addr];
      const rng = sh.getRange(addr);
      const formula = rng.getFormula();
      const valor = rng.getValue();

      const tieneFormula = formula && formula.indexOf("ARRAYFORMULA") >= 0;
      const indicador = tieneFormula ? "✅" : "❌";

      msg += indicador + " " + addr.padEnd(4) + " " + label.padEnd(20) + " · ";
      if (tieneFormula) {
        // Verificar si la celda muestra error
        if (String(valor).indexOf("#") === 0 || String(valor).indexOf("Error") >= 0) {
          msg += "⚠ ERROR: " + valor;
          errores.push(addr + " (" + label + "): " + valor);
        } else {
          msg += "OK · valor: " + String(valor).substring(0, 30);
        }
      } else {
        msg += "SIN ARRAYFORMULA";
        errores.push(addr + " (" + label + "): falta ARRAYFORMULA");
      }
      msg += "\n";
    });

    // Diagnóstico de empaque específico
    const lastReal = _ultimaFilaSKUInventario_(sh);
    if (lastReal >= 2) {
      // Mirar primera fila con dimensiones < 15cm
      const muestras = sh.getRange(2, 13, Math.min(20, lastReal - 1), 8).getValues();
      // M=13(peso), N=14(alto), O=15(ancho), P=16(prof), Q=17(empAlto), R=18(empAncho), S=19(empProf), T=20(empPeso)
      const conPeq = muestras.findIndex(r => {
        const max = Math.max(parseFloat(r[1]) || 0, parseFloat(r[2]) || 0, parseFloat(r[3]) || 0);
        return max > 0 && max < 15;
      });
      if (conPeq >= 0) {
        const r = muestras[conPeq];
        msg += "\n📦 MUESTRA producto pequeño (fila " + (conPeq + 2) + "):\n";
        msg += "   dim: " + r[1] + " × " + r[2] + " × " + r[3] + " cm\n";
        msg += "   empaque: " + r[4] + " × " + r[5] + " × " + r[6] + " cm · " + r[7] + " kg\n";
      }
    }

    msg += "\n";
    if (errores.length === 0) {
      msg += "✅ Todas las fórmulas activas y sin errores";
    } else {
      msg += "⚠ " + errores.length + " problemas detectados.\n";
      msg += "Solución: ejecuta '⚡ Migrar a ARRAYFORMULA' desde el menú de Configuración";
    }

    ui.alert("Diagnóstico", msg, ui.ButtonSet.OK);
  } catch(e) {
    ui.alert("Error", e.message, ui.ButtonSet.OK);
  }
}

// ════════════════════════════════════════════════════════════════
//  setupCompleto — ejecuta TODO el setup en orden, con log visible
//
//  Ejecuta de un solo click:
//    1. Crea CONFIG_MELI (si no existe)
//    2. Crea CAT_ELECTRONICS (si no existe)
//    3. Asegura UPC_IMPORT con formato correcto
//    4. Procesa UPC_IMPORT → SKU_INVENTARIO (+ enriquecimiento de pesos)
//    5. Aplica ARRAYFORMULAS (W2=20, W3=17.50)
//    6. Genera reporte de diagnóstico
//    7. Escribe TODO en hoja _SETUP_LOG con timestamp por paso
// ════════════════════════════════════════════════════════════════
function setupCompleto() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("🚀 Setup completo desde cero",
    "Ejecutará TODOS los pasos en orden:\n\n" +
    "  1. Crear CONFIG_MELI (tabla comisiones + empaques)\n" +
    "  2. Crear CAT_ELECTRONICS (27 categorías)\n" +
    "  3. Validar UPC_IMPORT\n" +
    "  4. Procesar UPCs → SKU_INVENTARIO\n" +
    "  5. Enriquecer pesos desde CVA (~25 seg)\n" +
    "  6. Aplicar ARRAYFORMULAS dinámicas\n" +
    "  7. Diagnóstico final\n\n" +
    "Todo el progreso se loggea en hoja '_SETUP_LOG'.\n\n" +
    "¿Continuar?", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  const START = Date.now();
  _setupLog_("INICIO", "Setup completo iniciado", "");

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── PASO 0: Verificar credenciales CVA ──
    _setupLog_("PASO 0", "Verificando credenciales CVA...", "");
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty("CVA_USER") || !props.getProperty("CVA_PASS")) {
      _setupLog_("PASO 0 ❌", "Credenciales no configuradas", "Ejecuta 🔑 Configurar credenciales CVA");
      ui.alert("❌ Falta configurar credenciales",
        "Antes de ejecutar setup, configura las credenciales CVA.\n\n" +
        "Menú → 🛠 MIS HERRAMIENTAS → 🔑 Configurar credenciales CVA\n\n" +
        "Luego vuelve a ejecutar el setup completo.",
        ui.ButtonSet.OK);
      return;
    }
    _setupLog_("PASO 0 ✅", "Credenciales OK", "");

    // ── PASO 1: CONFIG_MELI ──
    _setupLog_("PASO 1", "Creando CONFIG_MELI...", "");
    try {
      _crearHojaConfigMeli_();
      const shCM = ss.getSheetByName("CONFIG_MELI");
      _setupLog_("PASO 1 ✅", "CONFIG_MELI lista", shCM ? "OK" : "ERROR");
    } catch(e) {
      _setupLog_("PASO 1 ❌", "Error CONFIG_MELI", e.message);
      throw new Error("PASO 1 falló: " + e.message);
    }

    // ── PASO 2: CAT_ELECTRONICS ──
    _setupLog_("PASO 2", "Creando CAT_ELECTRONICS...", "");
    try {
      asegurarHojaCATElectronics_();
      _setupLog_("PASO 2 ✅", "CAT_ELECTRONICS lista", "");
    } catch(e) {
      _setupLog_("PASO 2 ❌", "Error CAT_ELECTRONICS", e.message);
      throw new Error("PASO 2 falló: " + e.message);
    }

    // ── PASO 3: UPC_IMPORT ──
    _setupLog_("PASO 3", "Validando UPC_IMPORT...", "");
    let shUI = ss.getSheetByName("UPC_IMPORT");
    if (!shUI) {
      _setupLog_("PASO 3 ❌", "UPC_IMPORT no existe", "Crea la hoja con tus UPCs en col B desde fila 10");
      throw new Error("Falta hoja UPC_IMPORT con tus productos");
    }
    // Contar UPCs reales (desde fila 10, donde están los datos según el formato del archivo)
    const lastUPC = shUI.getLastRow();
    let totalUPCs = 0;
    if (lastUPC >= 10) {
      const datos = shUI.getRange(10, 1, lastUPC - 9, 3).getValues();
      datos.forEach(r => { if (r[0] || r[1]) totalUPCs++; });
    }
    _setupLog_("PASO 3 ✅", "UPC_IMPORT con " + totalUPCs + " productos", "");

    if (totalUPCs === 0) {
      _setupLog_("PASO 3 ❌", "UPC_IMPORT vacío", "Pega tus UPCs en col B desde fila 10");
      throw new Error("UPC_IMPORT está vacío");
    }

    // ── PASO 4: Procesar UPCs → SKU (esto crea SKU_INVENTARIO y METADATA_PRODUCTOS) ──
    _setupLog_("PASO 4", "Procesando UPC_IMPORT → SKU...", "");
    let resultadoImport;
    try {
      // importarUPCsDesdeHoja muestra su propio diálogo; lo evitamos llamando
      // a la lógica directamente. Como no hay una función "_core_" expuesta,
      // dejamos que muestre el diálogo y el usuario lo cierre.
      // Mejor: corremos el equivalente manualmente.
      resultadoImport = _procesarUPCImportSilencioso_();
      _setupLog_("PASO 4 ✅", "Procesado",
        "Insertados: " + (resultadoImport.skuIns || 0) +
        " · Actualizados: " + (resultadoImport.skuAct || 0));
    } catch(e) {
      _setupLog_("PASO 4 ❌", "Error procesando", e.message);
      throw new Error("PASO 4 falló: " + e.message);
    }

    // ── PASO 5: Programar enriquecimiento de pesos async ──
    _setupLog_("PASO 5", "Programando enriquecimiento async (background)...", "");
    try {
      _programarEnriquecimientoAsync_();
      _setupLog_("PASO 5 ✅", "Trigger programado para 10s",
        "Resultado aparecerá en este log automáticamente cuando termine");
    } catch(e) {
      _setupLog_("PASO 5 ⚠", "No se pudo programar trigger", e.message);
    }

    // ── PASO 6: Aplicar ARRAYFORMULAS dinámicas ──
    _setupLog_("PASO 6", "Aplicando ARRAYFORMULAS...", "");
    try {
      _aplicarTodasLasArrayformulas_();
      _setupLog_("PASO 6 ✅", "ARRAYFORMULAS aplicadas", "G, I, J, K, L, M, N, O, P, Q, R, S, T");
    } catch(e) {
      _setupLog_("PASO 6 ❌", "Error ARRAYFORMULAS", e.message);
      throw new Error("PASO 6 falló: " + e.message);
    }

    // ── PASO 7: Diagnóstico ──
    _setupLog_("PASO 7", "Ejecutando diagnóstico...", "");
    const diag = _diagnosticoSilencioso_();
    _setupLog_("PASO 7 ✅", "Diagnóstico",
      "Fórmulas OK: " + diag.ok + " · Errores: " + diag.errores.length);
    if (diag.errores.length > 0) {
      diag.errores.forEach(e => _setupLog_("⚠ DIAG", e, ""));
    }

    const duracion = Math.round((Date.now() - START) / 1000);
    _setupLog_("FIN ✅", "Setup terminado en " + duracion + "s. Enriquecimiento async corre en background.", "");

    // Mensaje final al usuario
    let msg = "✅ SETUP COMPLETO\n\n";
    msg += "Tiempo total: " + duracion + " segundos\n\n";
    msg += "📊 RESULTADOS:\n";
    msg += "  • CONFIG_MELI: creada\n";
    msg += "  • CAT_ELECTRONICS: creada\n";
    msg += "  • UPC_IMPORT: " + totalUPCs + " productos\n";
    msg += "  • SKU_INVENTARIO: " + (resultadoImport.skuIns + resultadoImport.skuAct) + " filas\n";
    msg += "  • ⏳ Enriquecimiento pesos: corriendo en background\n";
    msg += "  • Fórmulas OK: " + diag.ok + "/" + (diag.ok + diag.errores.length) + "\n";

    if (diag.errores.length > 0) {
      msg += "\n⚠ ALERTAS:\n";
      diag.errores.forEach(e => { msg += "  • " + e + "\n"; });
    }

    msg += "\n📋 IMPORTANTE:\n";
    msg += "  • El enriquecimiento de pesos corre en background\n";
    msg += "  • Revisa hoja '_SETUP_LOG' en 1-2 min\n";
    msg += "  • Verás aparecer una fila 'ENRIQUECER ✅' cuando termine\n";
    msg += "  • Mientras tanto, ya puedes cambiar W3 y ver precios moverse";

    ui.alert("Setup completo", msg, ui.ButtonSet.OK);
  } catch(e) {
    _setupLog_("ABORTADO ❌", "Setup interrumpido", e.message);
    ui.alert("❌ Setup falló",
      e.message + "\n\nRevisa la hoja '_SETUP_LOG' para ver dónde quedó.",
      ui.ButtonSet.OK);
  }
}

// ── Programar enriquecimiento como trigger asíncrono ───────────
// setupCompleto NO espera el enriquecimiento. Solo lo programa.
// El trigger ejecuta _enriquecerPesosAsync_ en 10 segundos y reporta
// progreso al log. Esto evita el timeout de GAS dentro de setupCompleto.
function _programarEnriquecimientoAsync_() {
  // Eliminar triggers viejos del mismo handler para evitar duplicados
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "_enriquecerPesosAsync_") {
      ScriptApp.deleteTrigger(t);
    }
  });
  // Programar para dentro de 10 segundos
  ScriptApp.newTrigger("_enriquecerPesosAsync_")
    .timeBased()
    .after(10 * 1000)
    .create();
}

// ── Ejecutado por trigger: enriquecimiento de pesos en background ──
function _enriquecerPesosAsync_() {
  const start = Date.now();
  _setupLog_("ENRIQUECER", "Iniciando enriquecimiento (background)...", "");

  try {
    const resultado = _enriquecerPesosCore_({ silencioso: true });
    const duracion = Math.round((Date.now() - start) / 1000);

    if (resultado && resultado.ok) {
      _setupLog_("ENRIQUECER ✅", "Completado en " + duracion + "s",
        "Actualizados: " + (resultado.actualizadas || 0) +
        " · Sin datos en CVA: " + (resultado.sin_dimensiones || 0) +
        " · No encontradas: " + (resultado.no_encontradas || 0));
    } else {
      _setupLog_("ENRIQUECER ❌", "Falló", (resultado && resultado.error) || "Sin detalle");
    }
  } catch(e) {
    _setupLog_("ENRIQUECER ❌", "Excepción", e.message);
  } finally {
    // Auto-eliminar este trigger (es one-time)
    try {
      ScriptApp.getProjectTriggers().forEach(t => {
        if (t.getHandlerFunction() === "_enriquecerPesosAsync_") {
          ScriptApp.deleteTrigger(t);
        }
      });
    } catch(_) {}
  }
}

// ── Hoja LOG visible: cada paso con timestamp ──────────────────
function _setupLog_(paso, mensaje, detalle) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName("_SETUP_LOG");
    if (!sh) {
      sh = ss.insertSheet("_SETUP_LOG");
      sh.getRange(1, 1, 1, 4).setValues([["Timestamp", "Paso", "Mensaje", "Detalle"]])
        .setFontWeight("bold").setBackground("#00665e").setFontColor("#fff");
      sh.setColumnWidth(1, 180);
      sh.setColumnWidth(2, 140);
      sh.setColumnWidth(3, 300);
      sh.setColumnWidth(4, 400);
      sh.setFrozenRows(1);
    }
    sh.appendRow([
      new Date().toISOString().substring(0, 19).replace("T", " "),
      paso, mensaje, detalle
    ]);
    SpreadsheetApp.flush();
  } catch(e) {
    Logger.log("[LOG ERROR] " + e.message);
  }
}

// ── Procesar UPC_IMPORT sin diálogo (versión silenciosa) ───────
// Llama internamente a importarUPCsDesdeHoja pero captura su return
// y suprime el diálogo. Como esa función abre un alert al final, usamos
// un workaround: ejecutamos su lógica core directamente.
function _procesarUPCImportSilencioso_() {
  // La forma simple: invocar importarUPCsDesdeHoja con un flag global
  // que suprima la UI. Como no existe ese flag, lo hacemos así:
  //   1) Marcar flag
  //   2) Llamar a la función
  //   3) Restaurar
  const props = PropertiesService.getDocumentProperties();
  props.setProperty("UPC_IMPORT_SILENCIOSO", "true");
  try {
    importarUPCsDesdeHoja();
  } finally {
    props.deleteProperty("UPC_IMPORT_SILENCIOSO");
  }
  // Leer counts del log
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shSKU = ss.getSheetByName("SKU_INVENTARIO");
  const skuRows = shSKU ? Math.max(0, _ultimaFilaSKUInventario_(shSKU) - 1) : 0;
  return { skuIns: skuRows, skuAct: 0 };
}

// ── Aplicar todas las ARRAYFORMULAS y panel de config ─────────
function _aplicarTodasLasArrayformulas_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("SKU_INVENTARIO");
  if (!sh) throw new Error("SKU_INVENTARIO no existe — ejecuta el setup desde el inicio");

  const lastReal = _ultimaFilaSKUInventario_(sh);

  // 1) Asegurar panel V:W (W2 = % global, W3 = TC)
  if (!sh.getRange("W2").getValue()) sh.getRange("W2").setValue(20).setNumberFormat("0%");
  if (!sh.getRange("W3").getValue()) sh.getRange("W3").setValue(17.50).setNumberFormat("$0.00");
  // Asegurar labels en V2, V3
  if (!sh.getRange("V2").getValue()) sh.getRange("V2").setValue("% Global:").setHorizontalAlignment("right").setFontWeight("bold");
  if (!sh.getRange("V3").getValue()) sh.getRange("V3").setValue("TC USD→MXN:").setHorizontalAlignment("right").setFontWeight("bold");

  // 2) Limpiar celdas hijas (desde fila 3) para que ARRAYFORMULA pueda expandirse
  if (lastReal >= 3) {
    const filasALimpiar = lastReal - 2;
    [7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].forEach(col => {
      sh.getRange(3, col, filasALimpiar, 1).clearContent();
    });
  }
  // Limpiar también las celdas raíz para evitar conflicto
  [7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].forEach(col => {
    sh.getRange(2, col).clearContent();
  });
  SpreadsheetApp.flush();

  // 3) Aplicar ARRAYFORMULAS (orden importa por dependencias)
  // SKU (G)
  sh.getRange("G2").setFormula(_formulaSKUArray_());
  // Precio CVA (I) — con factor TC dinámico W3/17.50 a TODOS
  sh.getRange("I2").setFormula(
    '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,SYNC_CVA!$A:$E,5,FALSE),0) * ($W$3 / 17.5)))'
  );
  // Stock CVA (K)
  sh.getRange("K2").setFormula(
    '=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,SYNC_CVA!$A:$H,7,FALSE),0)+IFERROR(VLOOKUP(H2:H,SYNC_CVA!$A:$H,8,FALSE),0)))'
  );
  // Stock para Odoo (L)
  sh.getRange("L2").setFormula(
    '=ARRAYFORMULA(IF(H2:H="","",ROUNDDOWN(K2:K * $W$2 / 100, 0)))'
  );
  // Dimensiones (M-P) — leen METADATA_PRODUCTOS
  sh.getRange("M2").setFormula('=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,10,FALSE),"")))');
  sh.getRange("N2").setFormula('=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,11,FALSE),"")))');
  sh.getRange("O2").setFormula('=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,12,FALSE),"")))');
  sh.getRange("P2").setFormula('=ARRAYFORMULA(IF(H2:H="","",IFERROR(VLOOKUP(H2:H,METADATA_PRODUCTOS!$A:$M,13,FALSE),"")))');
  // Precio MELI (J)
  sh.getRange("J2").setFormula(_formulaPrecioMELIArray_());

  // ── Empaque (Q, R, S, T) — ARRAYFORMULA con XLOOKUP ──
  // XLOOKUP es array-aware DE VERDAD dentro de ARRAYFORMULA (a diferencia de
  // VLOOKUP+LET que tenía un bug que rompía Q2 y no se expandía).
  sh.getRange("Q2").setFormula(_formulaEmpaqueAltoArray_());
  sh.getRange("R2").setFormula(_formulaEmpaqueAnchoArray_());
  sh.getRange("S2").setFormula(_formulaEmpaqueProfArray_());
  sh.getRange("T2").setFormula(_formulaEmpaquePesoArray_());

  SpreadsheetApp.flush();
}

// ── Diagnóstico silencioso: devuelve estado sin diálogo ────────
function _diagnosticoSilencioso_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("SKU_INVENTARIO");
  if (!sh) return { ok: 0, errores: ["SKU_INVENTARIO no existe"] };

  const celdas = {
    "G2": "SKU", "I2": "Precio CVA", "J2": "Precio MELI",
    "K2": "Stock CVA", "L2": "Stock Odoo",
    "M2": "Peso", "N2": "Alto", "O2": "Ancho", "P2": "Prof",
    "Q2": "EmpAlto", "R2": "EmpAncho", "S2": "EmpProf", "T2": "EmpPeso",
  };
  let ok = 0;
  const errores = [];
  Object.keys(celdas).forEach(addr => {
    const rng = sh.getRange(addr);
    const formula = rng.getFormula();
    const valor = String(rng.getValue());
    if (!formula || formula.indexOf("ARRAYFORMULA") < 0) {
      errores.push(addr + " (" + celdas[addr] + "): falta ARRAYFORMULA");
    } else if (valor.indexOf("#") === 0 || valor.indexOf("Error") >= 0) {
      errores.push(addr + " (" + celdas[addr] + "): " + valor);
    } else {
      ok++;
    }
  });
  return { ok: ok, errores: errores };
}

// ════════════════════════════════════════════════════════════════
//  Gestión de triggers individuales (no afecta sync, polling, etc.)
// ════════════════════════════════════════════════════════════════

// Ver TODOS los triggers activos con detalle
function verTriggersDetalladoMenu() {
  const ui = SpreadsheetApp.getUi();
  const triggers = ScriptApp.getProjectTriggers();
  if (triggers.length === 0) {
    ui.alert("📋 Triggers activos", "No hay triggers programados.", ui.ButtonSet.OK);
    return;
  }
  let msg = "📋 Triggers activos (" + triggers.length + ")\n\n";
  triggers.forEach((t, i) => {
    const handler = t.getHandlerFunction();
    const type    = t.getEventType();
    let detalle = "";
    if (type === ScriptApp.EventType.CLOCK) {
      detalle = " · TIEMPO";
    } else if (type === ScriptApp.EventType.ON_EDIT) {
      detalle = " · ON EDIT";
    } else if (type === ScriptApp.EventType.ON_OPEN) {
      detalle = " · ON OPEN";
    }
    msg += (i + 1) + ". " + handler + detalle + "\n";
  });
  msg += "\n💡 Para cancelar SOLO el del enriquecimiento async:\n";
  msg += "   ⚠ Avanzado → 🛑 Cancelar enriquecimiento async";
  ui.alert("Triggers activos", msg, ui.ButtonSet.OK);
}

// Cancelar SOLO el trigger del enriquecimiento async
// NO toca: triggerSyncDiario, triggerPollingPedidos, triggerSincronizarVentas, triggerOdooSync
function cancelarEnriquecimientoAsync() {
  const ui = SpreadsheetApp.getUi();
  const triggers = ScriptApp.getProjectTriggers();
  const aEliminar = triggers.filter(t => t.getHandlerFunction() === "_enriquecerPesosAsync_");

  if (aEliminar.length === 0) {
    ui.alert("🛑 Cancelar enriquecimiento",
      "No hay trigger de enriquecimiento async activo.\n\n" +
      "Esto significa que:\n" +
      "  • O ya terminó (revisa _SETUP_LOG)\n" +
      "  • O nunca se programó\n\n" +
      "Triggers actuales: " + triggers.length + " (sync, polling, etc.)",
      ui.ButtonSet.OK);
    return;
  }

  aEliminar.forEach(t => ScriptApp.deleteTrigger(t));
  _setupLog_("CANCELADO 🛑", "Trigger _enriquecerPesosAsync_ eliminado por usuario", "");

  ui.alert("✅ Cancelado",
    aEliminar.length + " trigger(s) de enriquecimiento eliminados.\n\n" +
    "Los triggers del sistema NO se tocaron:\n" + resumenTriggers_(),
    ui.ButtonSet.OK);
}

// Re-disparar el enriquecimiento async manualmente (útil si quedó colgado)
function reDispararEnriquecimientoAsync() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("🚀 Re-disparar enriquecimiento",
    "Esto:\n" +
    "  1. Cancela cualquier trigger de enriquecimiento que esté pendiente\n" +
    "  2. Programa uno nuevo para ejecutarse en 10 segundos\n" +
    "  3. Verás el progreso en hoja '_SETUP_LOG'\n\n" +
    "NO afecta triggers de sync, polling, etc.\n\n" +
    "¿Continuar?", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  try {
    _programarEnriquecimientoAsync_();
    _setupLog_("RE-DISPARO 🚀", "Trigger _enriquecerPesosAsync_ programado para 10s", "");
    ui.alert("✅ Programado",
      "El enriquecimiento corre en 10 segundos.\n" +
      "Refresca la hoja '_SETUP_LOG' en 1-2 min para ver el resultado.",
      ui.ButtonSet.OK);
  } catch(e) {
    ui.alert("❌ Error", e.message, ui.ButtonSet.OK);
  }
}

// ════════════════════════════════════════════════════════════════
//  ACCESO DIRECTO A CVA desde el bound script
//
//  Esto evita el problema del HTTP entre scripts (timeout cuando
//  llamamos al Web App desde un trigger). Conecta directo a CVA.
//
//  EJECUTA UNA VEZ setupCredencialesBound() para guardar las
//  credenciales en el bound script. Después ya no se vuelve a tocar.
// ════════════════════════════════════════════════════════════════

const _CVA_BASE_LOCAL = "https://apicvaservices.grupocva.com/api/v2";

function setupCredencialesBound() {
  const p = PropertiesService.getScriptProperties();
  // Ya estan en Script Properties (mismo proyecto que el Web App).
  const _v = { CVA_USER: "PON_AQUI", CVA_PASS: "PON_AQUI" };
  if (_v.CVA_USER === "PON_AQUI") throw new Error("Pon los valores reales en el editor (sin subirlos) antes de correr esto.");
  p.setProperties(_v);
  p.deleteProperty("CVA_TOKEN_BOUND");
  p.deleteProperty("CVA_TOKEN_BOUND_EXP");
  const ui = SpreadsheetApp.getUi();
  ui.alert("✅ Credenciales guardadas",
    "Credenciales CVA guardadas en el bound script.\n\n" +
    "Ahora el enriquecimiento puede llamar a CVA directamente, sin pasar por el Web App.",
    ui.ButtonSet.OK);
}

// ── Menú: setup de carpeta GUIAS_ODOO ──
function menuSetupGuiasFolder() {
  const ui = SpreadsheetApp.getUi();
  const r = setupGuiasOdooFolder();
  if (r.ok) {
    ui.alert("✅ Carpeta lista",
      "Carpeta GUIAS_ODOO lista.\n\n" +
      "Nombre: " + r.nombre + "\n" +
      "URL: " + r.url + "\n\n" +
      "Sube ahí los PDFs de guías. El sistema los buscará por SO al usar 'Buscar guías en Drive'.",
      ui.ButtonSet.OK);
  } else {
    ui.alert("❌ Error", r.error || "Desconocido", ui.ButtonSet.OK);
  }
}

// ── Menú: buscar guías en Drive (masivo desde sheets) ──
function menuBuscarGuiasDrive() {
  const ui = SpreadsheetApp.getUi();
  const r = buscarGuiasEnDrive();
  if (!r.ok) {
    ui.alert("❌ Error", r.error || "Desconocido", ui.ButtonSet.OK);
    return;
  }
  var msg = r.encontradas + " guía(s) encontrada(s) y vinculada(s).\n";
  msg += "Ya tenían guía: " + (r.ya_con_guia || 0) + "\n";
  msg += "Sin coincidencia: " + (r.sin_coincidencia ? r.sin_coincidencia.length : 0);
  if (r.sin_coincidencia && r.sin_coincidencia.length > 0) {
    msg += "\n  → " + r.sin_coincidencia.slice(0, 10).join(", ");
    if (r.sin_coincidencia.length > 10) msg += "…";
  }
  if (r.multiple_coincidencia && r.multiple_coincidencia.length > 0) {
    msg += "\n\n⚠ SOs con reparto especial:\n";
    msg += r.multiple_coincidencia.map(function(m){
      return "  " + m.so + " → " + m.filas + " filas, " + m.pdfs + " PDFs. " + m.nota;
    }).join("\n");
  }
  msg += "\n\nTotal PDFs en la carpeta: " + (r.total_archivos_en_carpeta || 0);
  ui.alert("🔍 Resultado búsqueda", msg, ui.ButtonSet.OK);
}

// ── Menú: aplicar validaciones (dropdowns) a la hoja VENTAS_ODOO ──
function menuAplicarValidaciones() {
  const ui = SpreadsheetApp.getUi();
  const r = aplicarValidacionesVentasOdoo();
  if (r.ok) {
    ui.alert("✅ Dropdowns aplicados",
      r.mensaje + "\n\n" +
      "Ahora la celda C (Paquetería) muestra opciones fijas: DHL, Estafeta, FedEx, Paquetexpress, J&T, Redpack, Otro.\n" +
      "La celda I (Plataforma) muestra: WALMART, MERCADOLIBRE, AMAZON, TIENDA, OTRO.",
      ui.ButtonSet.OK);
  } else {
    ui.alert("❌ Error", r.error || "Desconocido", ui.ButtonSet.OK);
  }
}

function _getCVATokenLocal_() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("CVA_TOKEN_BOUND");
  const exp = parseInt(props.getProperty("CVA_TOKEN_BOUND_EXP") || "0");
  if (token && Date.now() < exp) return token;

  const user = props.getProperty("CVA_USER");
  const pass = props.getProperty("CVA_PASS");
  if (!user || !pass) {
    throw new Error("Credenciales CVA no configuradas en bound script. Ejecuta setupCredencialesBound() desde el editor de scripts.");
  }

  const res = UrlFetchApp.fetch(_CVA_BASE_LOCAL + "/user/login", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ user: user, password: pass }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error("CVA login falló: " + res.getContentText().substring(0, 200));
  }
  const data = JSON.parse(res.getContentText());
  if (!data.token) throw new Error("CVA no devolvió token");

  props.setProperty("CVA_TOKEN_BOUND", data.token);
  props.setProperty("CVA_TOKEN_BOUND_EXP", String(Date.now() + 11 * 3600 * 1000));
  return data.token;
}

function _cvaFetchLocal_(path, params) {
  const token = _getCVATokenLocal_();
  const qs = params ? "?" + Object.entries(params)
    .filter(function(e) { return e[1] !== "" && e[1] !== null && e[1] !== undefined; })
    .map(function(e) { return encodeURIComponent(e[0]) + "=" + encodeURIComponent(e[1]); })
    .join("&") : "";
  const res = UrlFetchApp.fetch(_CVA_BASE_LOCAL + path + qs, {
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true,
    deadline: 30,
  });
  const code = res.getResponseCode();
  if (code !== 200) {
    throw new Error("CVA HTTP " + code + ": " + res.getContentText().substring(0, 200));
  }
  return JSON.parse(res.getContentText());
}

// ════════════════════════════════════════════════════════════════
//  Adelgazar HISTORIAL_STOCK — borra descripcion y marca (cols C:D)
//  de todas las filas. El analisis no las usa (las toma de SYNC_CVA) y
//  eran ~60% del peso del archivo. Las filas nuevas ya no las traen.
// ════════════════════════════════════════════════════════════════
function adelgazarHistorialMenu() {
  const ui = SpreadsheetApp.getUi();
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("HISTORIAL_STOCK");
  if (!sh || sh.getLastRow() < 2) { ui.alert("HISTORIAL_STOCK vacio."); return; }
  const filas = sh.getLastRow() - 1;
  const r = ui.alert("🧹 Adelgazar HISTORIAL_STOCK",
    "Se borran descripcion y marca de " + filas.toLocaleString("es-MX") +
    " filas. Fechas, claves, precios y stock no se tocan.\n\n¿Continuar?",
    ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  sh.getRange(2, 3, filas, 2).clearContent();
  logSheet_("SYNC_LOG", ["HISTORIAL_ADELGAZADO", filas, "cols C:D"]);
  ui.alert("✅ Listo: " + filas.toLocaleString("es-MX") + " filas sin descripcion/marca.");
}


// ════════════════════════════════════════════════════════════════
//  LIMPIEZA DEL SHEET
//
//  Antes de tocar nada saca una COPIA COMPLETA del libro en Drive
//  (una vez por dia). Luego, en orden:
//    1. Borra hojas muertas (LIMPIEZA_CFG.BORRAR_HOJAS).
//    2. SYNC_LOG: deja solo las ultimas LIMPIEZA_CFG.SYNC_LOG_CONSERVAR filas.
//    3. SYNC_CVA: quita claves repetidas (gana la mas reciente) y pone en 0
//       el stock de lo que CVA ya no manda hace mas de N dias (se agoto).
//    4. HISTORIAL_STOCK: quita filas repetidas del mismo dia y clave (dias
//       que corrieron dos veces) y borra descripcion/marca.
//    5. Avisa si VENTAS_ODOO tiene celdas con #REF! (no las toca).
//  Las hojas con formulas (SKU_INVENTARIO, etc.) NO se tocan.
//  Se puede volver a correr: cada paso deja todo igual si ya esta limpio.
// ════════════════════════════════════════════════════════════════
const LIMPIEZA_CFG = {
  BORRAR_HOJAS: ["ODOO_SYNC_QUEUE", "_ODOO_SYNC_CACHE", "_SETUP_LOG"],
  SYNC_LOG_CONSERVAR: 2000,
  DIAS_SIN_VER_AGOTADO: 2,
  LOTE_ESCRITURA: 20000,
  MIN_SEG_PARA_HISTORIAL: 150,
};

function limpiezaSheetMenu() {
  const ui = SpreadsheetApp.getUi();
  const C = LIMPIEZA_CFG;
  const r = ui.alert("🧽 Limpieza del Sheet",
    "Primero se hace una copia completa del libro en Drive.\n\n" +
    "Despues:\n" +
    "• Borrar hojas: " + C.BORRAR_HOJAS.join(", ") + "\n" +
    "• SYNC_LOG: dejar las ultimas " + C.SYNC_LOG_CONSERVAR.toLocaleString("es-MX") + " filas\n" +
    "• SYNC_CVA: quitar repetidos y poner stock 0 a lo agotado (" + C.DIAS_SIN_VER_AGOTADO + "+ dias sin verse)\n" +
    "• HISTORIAL_STOCK: quitar filas repetidas y borrar descripcion/marca\n" +
    "• Revisar #REF! en VENTAS_ODOO\n\n" +
    "Puede tardar hasta 5 minutos. ¿Continuar?", ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;

  const res = limpiezaSheet_();
  ui.alert(res.ok ? "✅ Limpieza terminada" : "⚠ Limpieza incompleta", res.lineas.join("\n"), ui.ButtonSet.OK);
}

function limpiezaSheet_() {
  const t0 = Date.now();
  const C  = LIMPIEZA_CFG;
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(CFG.SHEET_ID);
  const props = PropertiesService.getScriptProperties();
  const hoy = Utilities.formatDate(new Date(), "America/Mexico_City", "yyyy-MM-dd");
  const L = [];
  let ok = true;

  // ── 0. Respaldo (una vez por dia) ──
  try {
    if (props.getProperty("LIMPIEZA_RESPALDO_FECHA") !== hoy) {
      const copia = DriveApp.getFileById(ss.getId()).makeCopy(ss.getName() + " · RESPALDO " + hoy);
      props.setProperty("LIMPIEZA_RESPALDO_FECHA", hoy);
      props.setProperty("LIMPIEZA_RESPALDO_URL", copia.getUrl());
      L.push("💾 Respaldo: " + copia.getName());
    } else {
      L.push("💾 Respaldo de hoy ya existe");
    }
  } catch (e) {
    return { ok: false, lineas: ["❌ No se pudo crear el respaldo, NO se toco nada:", e.message] };
  }

  // ── 1. Hojas muertas ──
  C.BORRAR_HOJAS.forEach(n => {
    const sh = ss.getSheetByName(n);
    if (sh) { ss.deleteSheet(sh); L.push("🗑 Hoja borrada: " + n); }
  });

  // ── 2. SYNC_LOG ──
  try {
    const sh = ss.getSheetByName("SYNC_LOG");
    if (sh) {
      const filas = sh.getLastRow() - 1;
      const sobran = filas - C.SYNC_LOG_CONSERVAR;
      if (sobran > 0) {
        sh.deleteRows(2, sobran);
        L.push("📋 SYNC_LOG: " + sobran.toLocaleString("es-MX") + " filas viejas fuera");
      } else {
        L.push("📋 SYNC_LOG: ya estaba corto");
      }
      _recortarRejilla_(sh, 10);
    }
  } catch (e) { ok = false; L.push("❌ SYNC_LOG: " + e.message); }

  // ── 3. SYNC_CVA ──
  try {
    const sh = ss.getSheetByName("SYNC_CVA");
    if (sh && sh.getLastRow() > 1) {
      const n = sh.getLastRow() - 1;
      const anchoS = Math.min(Math.max(sh.getLastColumn(), 14), SYNC_CVA_COLS);
      const datos = sh.getRange(2, 1, n, anchoS).getValues();
      const porClave = {};
      let maxTs = 0;
      datos.forEach(r => {
        const k = String(r[0] || "").trim();
        if (!k) return;
        const ts = new Date(r[13]).getTime() || 0;
        if (ts > maxTs) maxTs = ts;
        if (!porClave[k] || ts >= porClave[k].ts) porClave[k] = { ts: ts, fila: r };
      });
      const limite = maxTs - C.DIAS_SIN_VER_AGOTADO * 86400000;
      let agotados = 0;
      const limpio = Object.keys(porClave).map(k => {
        const x = porClave[k];
        if (x.ts < limite && ((parseFloat(x.fila[6]) || 0) > 0 || (parseFloat(x.fila[7]) || 0) > 0)) {
          x.fila[6] = 0; x.fila[7] = 0; x.fila[8] = 0; agotados++;
        }
        return x.fila;
      });
      const repetidos = n - limpio.length;
      sh.getRange(2, 1, n, anchoS).clearContent();
      if (limpio.length) sh.getRange(2, 1, limpio.length, anchoS).setValues(limpio);
      _recortarRejilla_(sh, SYNC_CVA_COLS);
      L.push("📦 SYNC_CVA: " + limpio.length.toLocaleString("es-MX") + " claves · " +
             repetidos + " repetidas fuera · " + agotados + " puestas en 0 (agotadas)");
    }
  } catch (e) { ok = false; L.push("❌ SYNC_CVA: " + e.message); }

  // ── 4. HISTORIAL_STOCK (lo mas pesado, va al final) ──
  try {
    const sh = ss.getSheetByName("HISTORIAL_STOCK");
    const restan = 330 - (Date.now() - t0) / 1000;
    if (sh && sh.getLastRow() > 1) {
      if (restan < C.MIN_SEG_PARA_HISTORIAL) {
        ok = false;
        L.push("⏱ HISTORIAL_STOCK: no alcanzo el tiempo. Vuelve a correr la limpieza (lo demas ya quedo).");
      } else {
        const n = sh.getLastRow() - 1;
        const cols = Math.min(sh.getLastColumn(), 10);
        const datos = sh.getRange(2, 1, n, cols).getValues();
        const vistos = {};
        const limpio = [];
        datos.forEach(r => {
          const f = _fechaTxt_(r[0]);
          const k = String(r[1] || "").trim();
          if (!f || !k) return;
          const llave = f + "|" + k;
          if (vistos[llave]) return;
          vistos[llave] = true;
          r[2] = ""; r[3] = "";            // descripcion y marca fuera
          limpio.push(r);
        });
        const fuera = n - limpio.length;
        sh.getRange(2, 1, n, cols).clearContent();
        for (let i = 0; i < limpio.length; i += C.LOTE_ESCRITURA) {
          const trozo = limpio.slice(i, i + C.LOTE_ESCRITURA);
          sh.getRange(2 + i, 1, trozo.length, cols).setValues(trozo);
        }
        _recortarRejilla_(sh, 10);
        L.push("📈 HISTORIAL_STOCK: " + limpio.length.toLocaleString("es-MX") + " filas · " +
               fuera.toLocaleString("es-MX") + " repetidas/vacias fuera · sin descripcion/marca");
      }
    }
  } catch (e) { ok = false; L.push("❌ HISTORIAL_STOCK: " + e.message); }

  // ── 5. #REF! en VENTAS_ODOO (solo aviso) ──
  try {
    const sh = ss.getSheetByName("VENTAS_ODOO");
    if (sh && sh.getLastRow() > 1) {
      const vals = sh.getDataRange().getDisplayValues();
      const malas = [];
      vals.forEach((fila, i) => fila.forEach((v, j) => {
        if (String(v).indexOf("#REF!") >= 0) malas.push(sh.getRange(i + 1, j + 1).getA1Notation());
      }));
      L.push(malas.length ? "⚠ VENTAS_ODOO con #REF! en: " + malas.slice(0, 10).join(", ") : "✔ VENTAS_ODOO sin #REF!");
    }
  } catch (e) { L.push("⚠ VENTAS_ODOO: " + e.message); }

  SpreadsheetApp.flush();
  L.push("", "⏱ " + Math.round((Date.now() - t0) / 1000) + " s");
  logSheet_("SYNC_LOG", ["LIMPIEZA", ok ? "OK" : "INCOMPLETA", L.join(" | ").substring(0, 45000)]);
  return { ok: ok, lineas: L };
}

// Quita filas vacias sobrantes al final y columnas de mas (las celdas
// vacias tambien cuentan para el limite de 10 millones). Solo para hojas
// que escribe el script, nunca para hojas con formulas.
function _recortarRejilla_(sh, colsUsadas) {
  const ultimaFila = Math.max(sh.getLastRow(), 1);
  const maxFilas = sh.getMaxRows();
  if (maxFilas > ultimaFila + 50) sh.deleteRows(ultimaFila + 51, maxFilas - ultimaFila - 50);
  const maxCols = sh.getMaxColumns();
  const usar = Math.max(colsUsadas, sh.getLastColumn());
  if (maxCols > usar) sh.deleteColumns(usar + 1, maxCols - usar);
}


function exportarSnapshotMenu() {
  const ui = SpreadsheetApp.getUi();
  try {
    const r = exportarSnapshotCVA();
    ui.alert("📤 Snapshot exportado",
      r.productos.toLocaleString("es-MX") + " productos con stock en " + CFG.EXPORT_SNAPSHOT +
      "\n(carpeta de Drive del proyecto). Ademas: " + CFG.EXPORT_LOG + ".", ui.ButtonSet.OK);
  } catch (e) {
    ui.alert("❌ No se pudo exportar", e.message, ui.ButtonSet.OK);
  }
}
