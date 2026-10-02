/**********************************************************************
 * ventasMasivo.gs · Procesamiento masivo de ventas Odoo → Pedidos CVA
 *
 * Hoja VENTAS_ODOO:
 *   A=SO  B=SKU  C=PAQUETERÍA  D=GUÍA(link PDF Drive)
 *   E=NMXT  F=COSTO  G=ESTADO  H=SALDO (H2 tiene fórmula del saldo restante)
 *
 * Filas con ESTADO="Enviado" NO se procesan.
 * Cada fila = 1 pedido CVA = 1 NMXT.
 * El PDF de col D se descarga de Drive y se manda a CVA con cvaEnviarGuia.
 *
 * Tras procesar exitoso, escribe: E=NMXT, F=Costo, G=Enviado <fecha>
 * Si falla por saldo: G=Sin saldo, dispara alerta Twilio+Email.
 **********************************************************************/

var VENTAS_CFG = {
  HOJA:             'VENTAS_ODOO',
  HOJA_SKU_INV:     'SKU_INVENTARIO',
  CELDA_SALDO:      'H2',
  UMBRAL_BAJO:      5000,
  LOTE_TAM:         5,
  // Mismas credenciales Twilio del email viejo. Ahora se leen de Script Properties.
};

// ════════════════════════════════════════════════════════════════
//  Setup credenciales Twilio (correr una vez desde el editor de scripts)
// ════════════════════════════════════════════════════════════════
function setupCredencialesTwilio() {
  // Ya estan en Script Properties. Para cambiarlas, pon los valores aqui SOLO
  // en el editor, corre y vuelve a dejar PON_AQUI. Nunca subir.
  var props = PropertiesService.getScriptProperties();
  var _v = {
    'TWILIO_ACCOUNT_SID': 'PON_AQUI',
    'TWILIO_AUTH_TOKEN':  'PON_AQUI',
    'TWILIO_FROM':        'PON_AQUI',
    'ALERTA_EMAIL':       'PON_AQUI',
    'ALERTA_WHATSAPP':    'PON_AQUI',
    'ALERTA_NOMBRE':      'PON_AQUI'
  };
  for (var k in _v) if (_v[k] === 'PON_AQUI') return { ok: false, mensaje: 'Pon los valores reales en el editor antes de correr esto.' };
  props.setProperties(_v);
  return { ok: true, mensaje: 'Credenciales Twilio guardadas en Script Properties.' };
}

// ════════════════════════════════════════════════════════════════
//  Asegurar que la hoja VENTAS_ODOO existe con su esquema
// ════════════════════════════════════════════════════════════════
function _hojaVentasOdoo_() {
  var ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  var sh = ss.getSheetByName(VENTAS_CFG.HOJA);
  if (!sh) {
    sh = ss.insertSheet(VENTAS_CFG.HOJA);
    var headers = ['SO', 'SKU', 'PAQUETERÍA', 'GUÍA', 'NMXT', 'COSTO', 'ESTADO', 'SALDO', 'PLATAFORMA'];
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#00665e').setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 110); sh.setColumnWidth(2, 200);
    sh.setColumnWidth(3, 120); sh.setColumnWidth(4, 280);
    sh.setColumnWidth(5, 130); sh.setColumnWidth(6, 110);
    sh.setColumnWidth(7, 140); sh.setColumnWidth(8, 120);
    sh.setColumnWidth(9, 110);
    sh.getRange('A:A').setNumberFormat('@').setHorizontalAlignment('center');
    sh.getRange('B:B').setNumberFormat('@');
    sh.getRange('E:E').setNumberFormat('@').setHorizontalAlignment('center');
    sh.getRange('F:F').setNumberFormat('$#,##0.00');
    sh.getRange('H:H').setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
    sh.getRange('I:I').setNumberFormat('@').setHorizontalAlignment('center');
    sh.getRange('H2').setValue(30000);
  }
  return sh;
}

// ════════════════════════════════════════════════════════════════
//  DRIVE: carpeta GUIAS_ODOO (dentro de EM ARCHIVOS, al mismo nivel que UPC CVA)
// ════════════════════════════════════════════════════════════════

var DRIVE_UPC_CVA_ID = '1fN7Oi7k4ZdWjnev7-HhV8H3LLl1ZEhHv';  // "UPC CVA"

// Obtiene (o crea) la carpeta GUIAS_ODOO en el mismo directorio padre.
function _folderGuiasOdoo_() {
  var props = PropertiesService.getScriptProperties();
  var cachedId = props.getProperty('DRIVE_GUIAS_ODOO_ID');
  if (cachedId) {
    try { return DriveApp.getFolderById(cachedId); } catch (e) {}
  }
  // Encontrar el padre de UPC CVA (= EM ARCHIVOS)
  var upcCva = DriveApp.getFolderById(DRIVE_UPC_CVA_ID);
  var parents = upcCva.getParents();
  if (!parents.hasNext()) throw new Error('UPC CVA no tiene carpeta padre — no puedo ubicar EM ARCHIVOS');
  var emArchivos = parents.next();
  // Buscar GUIAS_ODOO dentro del padre
  var iter = emArchivos.getFoldersByName('GUIAS_ODOO');
  var folder = iter.hasNext() ? iter.next() : emArchivos.createFolder('GUIAS_ODOO');
  props.setProperty('DRIVE_GUIAS_ODOO_ID', folder.getId());
  return folder;
}

// PÚBLICA para el menú: verifica/crea la carpeta y devuelve su URL
function setupGuiasOdooFolder() {
  try {
    var folder = _folderGuiasOdoo_();
    return { ok: true, id: folder.getId(), url: folder.getUrl(), nombre: folder.getName() };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ════════════════════════════════════════════════════════════════
//  PÚBLICA: buscar guías en GUIAS_ODOO por SO y pegar link en col D
//  Busca archivos cuyo nombre CONTENGA el SO (case-insensitive).
//  Solo actualiza filas pendientes (ESTADO != Enviado) sin guía ya.
// ════════════════════════════════════════════════════════════════
function buscarGuiasEnDrive() {
  try {
    var sh = _hojaVentasOdoo_();
    var last = sh.getLastRow();
    if (last < 2) return { ok: true, encontradas: 0, sin_encontrar: 0, mensaje: 'Hoja vacía' };
    var lastCol = Math.max(sh.getLastColumn(), 9);
    var data = sh.getRange(2, 1, last - 1, lastCol).getValues();

    // Recolectar todos los archivos de GUIAS_ODOO una sola vez
    var folder = _folderGuiasOdoo_();
    var archivos = [];
    var iter = folder.getFiles();
    while (iter.hasNext()) {
      var f = iter.next();
      archivos.push({ id: f.getId(), name: f.getName(), url: f.getUrl(), nameLower: f.getName().toLowerCase() });
    }

    if (archivos.length === 0) {
      return { ok: true, encontradas: 0, sin_encontrar: 0, mensaje: 'La carpeta GUIAS_ODOO está vacía' };
    }

    // Paso 1: agrupar filas pendientes por SO
    var filasPorSO = {};  // { SO: [{fila, sku, ...}, ...] }
    var yaConGuia = 0;

    data.forEach(function (r, i) {
      var so = String(r[0] || '').trim();
      var sku = String(r[1] || '').trim();
      var guiaExistente = String(r[3] || '').trim();
      var estado = String(r[6] || '').trim();
      if (!so || so === '-' || !sku || sku === '-') return;
      if (/enviado/i.test(estado)) return;
      if (guiaExistente) { yaConGuia++; return; }
      if (!filasPorSO[so]) filasPorSO[so] = [];
      filasPorSO[so].push({ fila: i + 2, sku: sku });
    });

    // Paso 2: para cada SO, encontrar sus PDFs y repartir
    var actualizaciones = [];
    var sinCoincidencia = [];
    var multipleConReparto = [];   // SOs donde hay más PDFs que filas o al revés
    var pdfsUsados = {};           // {archivoId: true} para no repetir el mismo PDF en el mismo SO

    Object.keys(filasPorSO).forEach(function (so) {
      var filas = filasPorSO[so];
      var soLower = so.toLowerCase();
      var pdfs = archivos
        .filter(function (a) { return a.nameLower.indexOf(soLower) >= 0; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });  // orden alfabético

      if (pdfs.length === 0) {
        sinCoincidencia.push(so);
        return;
      }

      // Intento de match por SKU: si el nombre del PDF contiene el SKU (o parte),
      // se asigna a esa fila específica.
      var filasSinAsignar = filas.slice();
      var pdfsSinAsignar = pdfs.slice();

      // Primero: match por SKU en el nombre del PDF
      for (var fi = filasSinAsignar.length - 1; fi >= 0; fi--) {
        var f = filasSinAsignar[fi];
        var skuLower = f.sku.toLowerCase();
        // Buscar PDF que contenga el SKU completo o su parte más distintiva
        var skuTokens = skuLower.split(/[-_\s]/).filter(function(t){ return t.length >= 3; });
        var matchIdx = -1;
        for (var pi = 0; pi < pdfsSinAsignar.length; pi++) {
          var pdfName = pdfsSinAsignar[pi].nameLower;
          // Match si contiene TODOS los tokens del SKU (de 3+ chars)
          var matches = skuTokens.every(function(t){ return pdfName.indexOf(t) >= 0; });
          if (matches && skuTokens.length >= 2) { matchIdx = pi; break; }
        }
        if (matchIdx >= 0) {
          actualizaciones.push({
            fila: f.fila,
            url: pdfsSinAsignar[matchIdx].url,
            nombre: pdfsSinAsignar[matchIdx].name,
            so: so,
            metodo: 'sku'
          });
          filasSinAsignar.splice(fi, 1);
          pdfsSinAsignar.splice(matchIdx, 1);
        }
      }

      // Después: repartir el resto en orden (1-a-1, o repetir si menos PDFs)
      filasSinAsignar.forEach(function (f, idx) {
        if (pdfsSinAsignar.length === 0) return;
        var pdf = pdfsSinAsignar[Math.min(idx, pdfsSinAsignar.length - 1)];
        actualizaciones.push({
          fila: f.fila,
          url: pdf.url,
          nombre: pdf.name,
          so: so,
          metodo: pdfsSinAsignar.length < filasSinAsignar.length ? 'compartido' : 'orden'
        });
      });

      // Info para el usuario
      if (pdfs.length !== filas.length) {
        multipleConReparto.push({
          so: so,
          filas: filas.length,
          pdfs: pdfs.length,
          nota: pdfs.length > filas.length
            ? (pdfs.length - filas.length) + ' PDF(s) sobrantes sin usar'
            : 'Solo ' + pdfs.length + ' PDF(s) para ' + filas.length + ' fila(s), se compartió el último'
        });
      }
    });

    // Escribir en col D
    actualizaciones.forEach(function (a) {
      sh.getRange(a.fila, 4).setValue(a.url);
    });
    SpreadsheetApp.flush();

    return {
      ok: true,
      encontradas: actualizaciones.length,
      ya_con_guia: yaConGuia,
      sin_coincidencia: sinCoincidencia,
      multiple_coincidencia: multipleConReparto,
      total_archivos_en_carpeta: archivos.length,
      actualizaciones: actualizaciones
    };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ════════════════════════════════════════════════════════════════
//  PÚBLICA: aplicar dropdown de paquetería a la columna C del sheet
// ════════════════════════════════════════════════════════════════
function aplicarValidacionesVentasOdoo() {
  try {
    var sh = _hojaVentasOdoo_();
    var paqueterias = ['DHL', 'Estafeta', 'FedEx', 'Paquetexpress', 'J&T', 'Redpack', 'Otro'];
    var plataformas = ['WALMART', 'MERCADOLIBRE', 'AMAZON', 'TIENDA', 'OTRO'];

    // Rango reducido a 500 filas para evitar FAILED_PRECONDITION en sheets pesados
    var maxFilas = 500;

    // allowInvalid=true = permitimos otros valores (menos estricto, más estable)
    var ruleP = SpreadsheetApp.newDataValidation()
      .requireValueInList(paqueterias, true)
      .setAllowInvalid(true)
      .setHelpText('Paqueterías comunes (puedes escribir otra si es necesario)')
      .build();

    var ruleI = SpreadsheetApp.newDataValidation()
      .requireValueInList(plataformas, true)
      .setAllowInvalid(true)
      .setHelpText('Plataforma de origen (puedes escribir otra)')
      .build();

    // Aplicar en batches de 100 filas para minimizar riesgo de timeout/storage
    var batch = 100;
    for (var i = 2; i <= maxFilas + 1; i += batch) {
      var end = Math.min(i + batch - 1, maxFilas + 1);
      var n = end - i + 1;
      try {
        sh.getRange(i, 3, n, 1).setDataValidation(ruleP);
        sh.getRange(i, 9, n, 1).setDataValidation(ruleI);
        Utilities.sleep(60);
      } catch (eBatch) {
        return { ok: false, error: 'Falló al aplicar validación en filas ' + i + '-' + end + ': ' + eBatch.message };
      }
    }

    return { ok: true, mensaje: 'Validaciones aplicadas hasta la fila ' + (maxFilas + 1) + ' (Paquetería en C, Plataforma en I).' };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ════════════════════════════════════════════════════════════════
//  PÚBLICA: guardar UNA celda editada desde la pantalla
//  body = { fila: int, col: 'paqueteria'|'guia'|'plataforma', valor: string }
// ════════════════════════════════════════════════════════════════
function guardarCeldaVenta(body) {
  try {
    if (!body || !body.fila) return { ok: false, error: 'Falta fila' };
    var col = body.col || '';
    var valor = (body.valor == null ? '' : String(body.valor));
    var mapCol = { paqueteria: 3, guia: 4, plataforma: 9 };
    var nCol = mapCol[col];
    if (!nCol) return { ok: false, error: 'Columna no editable: ' + col };
    var sh = _hojaVentasOdoo_();
    sh.getRange(body.fila, nCol).setValue(valor);
    SpreadsheetApp.flush();
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ════════════════════════════════════════════════════════════════
//  PÚBLICA: leer la hoja, devolver filas pendientes (ESTADO != "Enviado")
// ════════════════════════════════════════════════════════════════
function listarVentasPendientes() {
  try {
    var sh = _hojaVentasOdoo_();
    var last = sh.getLastRow();
    if (last < 2) return { ok: true, ventas: [], saldo: _leerSaldoActual_(sh) };
    var lastCol = Math.max(sh.getLastColumn(), 10);
    var data = sh.getRange(2, 1, last - 1, lastCol).getValues();
    var ventas = [];
    data.forEach(function (r, i) {
      var so    = String(r[0] || '').trim();
      var sku   = String(r[1] || '').trim();
      var paque = String(r[2] || '').trim();
      var guia  = String(r[3] || '').trim();
      var nmxt  = String(r[4] || '').trim();
      var costo = parseFloat(r[5]) || 0;
      var estado = String(r[6] || '').trim();
      var plataforma  = String(r[8] || '').trim();  // col I
      var estadoOdoo  = String(r[9] || '').trim();  // col J (QUERY estatus Odoo)
      // Skipear líneas vacías o placeholder
      if (!so || so === '-' || !sku || sku === '-') return;
      // Skipear ya enviadas
      if (/enviado/i.test(estado)) return;
      ventas.push({
        fila: i + 2,
        so: so,
        sku: sku,
        paqueteria: paque,
        guia: guia,
        nmxt: nmxt,
        costo: costo,
        estado: estado,
        plataforma: plataforma,
        estado_odoo: estadoOdoo
      });
    });
    return { ok: true, ventas: ventas, saldo: _leerSaldoActual_(sh) };
  } catch (e) { return { ok: false, error: e.message }; }
}

function _leerSaldoActual_(sh) {
  try {
    if (!sh) sh = _hojaVentasOdoo_();
    var v = sh.getRange(VENTAS_CFG.CELDA_SALDO).getValue();
    return parseFloat(v) || 0;
  } catch (e) { return 0; }
}

// PÚBLICA para el badge de saldo en la app web
function leerSaldoVentas() {
  try { return { ok: true, saldo: _leerSaldoActual_() }; }
  catch (e) { return { ok: false, error: e.message }; }
}

// ════════════════════════════════════════════════════════════════
//  Resolver SKU → Clave CVA + Precio CVA actual
//  Usa SKU_INVENTARIO (cols G=SKU, H=Clave CVA) y consulta CVA por precio.
// ════════════════════════════════════════════════════════════════
function _resolverSKUyPrecio_(skus) {
  var ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  var sh = ss.getSheetByName(VENTAS_CFG.HOJA_SKU_INV);
  if (!sh) return { ok: false, error: 'SKU_INVENTARIO no existe' };
  var last = _ultimaFilaSKUInventario_(sh);
  if (last < 2) return { ok: true, mapeo: {} };
  var data = sh.getRange(2, 7, last - 1, 2).getValues(); // G=SKU, H=Clave
  var porSKU = {};
  data.forEach(function (r) {
    var sku = String(r[0] || '').trim();
    var clave = String(r[1] || '').trim();
    if (sku && clave) porSKU[sku] = clave;
  });

  // Para cada SKU pedido, traer su clave y consultar precio CVA
  var mapeo = {};
  skus.forEach(function (sku) {
    var clave = porSKU[sku];
    if (!clave) { mapeo[sku] = { ok: false, error: 'SKU no está en SKU_INVENTARIO' }; return; }
    try {
      var resp = cvaGetProducto(clave, { sucursales: 'true' });
      var prod = resp.producto;
      var primero = Array.isArray(prod) ? prod[0] : prod;
      var precio = parseFloat((primero && (primero.precio || primero.precio_lista)) || 0);
      // Sucursales con stock
      var sucs = {};
      if (primero && primero.sucursales && Array.isArray(primero.sucursales)) {
        primero.sucursales.forEach(function (s) {
          var cod = s.codigo || s.codigoSucursal || s.sucursal_id || s.id;
          var exist = parseInt(s.existencia, 10) || 0;
          if (cod !== undefined && cod !== null) sucs[cod] = exist;
        });
      }
      mapeo[sku] = { ok: true, clave: clave, precio: precio, sucursales: sucs };
    } catch (e) {
      mapeo[sku] = { ok: false, error: 'CVA: ' + e.message };
    }
    Utilities.sleep(150);
  });
  return { ok: true, mapeo: mapeo };
}

// Mejor sucursal para 1 SKU+cantidad: la que tenga existencia >= cantidad,
// o la de más existencia si nadie cubre completo.
function _mejorSucursalParaSKU_(sucursales, cantidad) {
  cantidad = cantidad || 1;
  var mejor = { codigo: CFG.CVA_SUCURSAL, existencia: 0 };
  Object.keys(sucursales).forEach(function (cod) {
    var ex = sucursales[cod];
    if (ex >= cantidad && ex > mejor.existencia) {
      mejor = { codigo: parseInt(cod), existencia: ex };
    }
  });
  // Si nadie cubre completo, elegir la de más
  if (mejor.existencia < cantidad) {
    Object.keys(sucursales).forEach(function (cod) {
      var ex = sucursales[cod];
      if (ex > mejor.existencia) mejor = { codigo: parseInt(cod), existencia: ex };
    });
  }
  return mejor;
}

// ════════════════════════════════════════════════════════════════
//  PÚBLICA: procesar un LOTE de filas (compra CVA + sube guía)
//  body = { filas: [n, n, n, ...], test: bool }
//  Devuelve { ok, resultados: [{fila, ok, nmxt, costo, estado, error?}], saldo_final }
// ════════════════════════════════════════════════════════════════
function procesarVentasMasivo(body) {
  try {
    body = body || {};
    var filas = body.filas || [];
    var test = !!body.test;
    if (!filas.length) return { ok: false, error: 'Sin filas para procesar.' };

    var sh = _hojaVentasOdoo_();

    // Leer filas pedidas
    var ventasFila = [];
    filas.forEach(function (f) {
      var lastCol = Math.max(sh.getLastColumn(), 9);
      var r = sh.getRange(f, 1, 1, lastCol).getValues()[0];
      ventasFila.push({
        fila: f,
        so: String(r[0] || '').trim(),
        sku: String(r[1] || '').trim(),
        paqueteria: String(r[2] || '').trim(),
        guia: String(r[3] || '').trim(),
        nmxt_existente: String(r[4] || '').trim(),
        estado: String(r[6] || '').trim(),
        plataforma: String(r[8] || '').trim()
      });
    });

    // Resolver SKUs únicos
    var skus = Array.from(new Set(ventasFila.map(function (v) { return v.sku; }).filter(function (s) { return s; })));
    var rMap = _resolverSKUyPrecio_(skus);
    if (!rMap.ok) return { ok: false, error: rMap.error };
    var mapeo = rMap.mapeo;

    var saldoInicial = _leerSaldoActual_(sh);
    var saldoActual = saldoInicial;
    var resultados = [];

    ventasFila.forEach(function (v) {
      var info = mapeo[v.sku];

      // Validación 1: SKU resoluble
      if (!info || !info.ok) {
        resultados.push({ fila: v.fila, ok: false, error: (info && info.error) || 'SKU no resuelto', estado: 'ERROR SKU' });
        _escribirResultadoFila_(sh, v.fila, '', '', 'ERROR: ' + ((info && info.error) || 'SKU no resuelto'));
        return;
      }

      var costo = info.precio || 0;

      // Validación 2: saldo suficiente
      if (!test && saldoActual < costo) {
        var msg = 'Sin saldo (necesario $' + costo.toFixed(2) + ', disponible $' + saldoActual.toFixed(2) + ')';
        resultados.push({ fila: v.fila, ok: false, error: msg, estado: 'Sin saldo' });
        _escribirResultadoFila_(sh, v.fila, '', '', 'Sin saldo');
        _dispararAlertaSaldo_(saldoActual, costo, v);
        return;
      }

      // Compra a CVA: 1 pedido por fila
      var mejor = _mejorSucursalParaSKU_(info.sucursales, 1);
      try {
        var resp = cvaCrearOrden({
          productos: [{ clave: info.clave, cantidad: 1 }],
          num_oc: v.so,
          codigo_sucursal: mejor.codigo,
          tipo_flete: 'SF',
          observaciones: 'Electronics MX · SO: ' + v.so + ' · SKU: ' + v.sku,
          test: test ? 1 : 0
        });
        if (!resp || resp.ok === false) {
          var errCVA = JSON.stringify(resp);
          resultados.push({ fila: v.fila, ok: false, error: 'CVA rechazó: ' + errCVA, estado: 'ERROR CVA' });
          _escribirResultadoFila_(sh, v.fila, '', '', 'ERROR CVA');
          return;
        }
        var nmxt = resp.pedido || resp.NMXT || '';
        var totalReal = parseFloat(resp.total) || costo;
        if (!test) saldoActual -= totalReal;

        // Subir guía si hay
        var avisoGuia = '';
        if (!test && nmxt && v.guia && v.paqueteria) {
          try {
            var pdfB64 = _descargarPDFDeDrive_(v.guia);
            if (pdfB64) {
              // El "número" lo extraemos del nombre del archivo o usamos el SO
              var numGuia = _extraerNumeroGuia_(v.guia) || v.so;
              var resG = cvaEnviarGuia({
                order_number: nmxt,
                waybills: numGuia,
                carrier: v.paqueteria.toUpperCase(),
                pdf_base64: pdfB64
              });
              if (!resG || resG.ok === false) avisoGuia = ' (guía rechazada)';
            } else { avisoGuia = ' (PDF no descargable)'; }
          } catch (eG) { avisoGuia = ' (error guía: ' + eG.message + ')'; }
        }

        // Registrar en historial general
        if (!test && nmxt) {
          try {
            var shH = _hojaPedidosCVAHistorial_();
            var iva = totalReal * 0.16 / 1.16;
            var neto = totalReal - iva;
            shH.appendRow([
              nmxt, v.so, new Date(), mejor.codigo,
              neto, iva, totalReal,
              avisoGuia ? 'CON ERROR GUIA' : (v.guia ? 'CON GUIA' : 'SIN GUIA'),
              v.paqueteria || '', v.guia || '', '',
              JSON.stringify([{ clave: info.clave, cantidad: 1, sku: v.sku }]),
              v.plataforma || ''
            ]);
          } catch (eH) { Logger.log('Historial: ' + eH.message); }
        }

        // Marcar fila como Enviada
        var estadoFinal = test
          ? 'TEST · NMXT prueba'
          : 'Enviado ' + Utilities.formatDate(new Date(), 'America/Mexico_City', 'dd/MM/yy HH:mm') + avisoGuia;
        _escribirResultadoFila_(sh, v.fila, nmxt, totalReal, estadoFinal);

        resultados.push({
          fila: v.fila, ok: true, nmxt: nmxt, costo: totalReal,
          estado: estadoFinal, sucursal: mejor.codigo
        });

      } catch (e) {
        resultados.push({ fila: v.fila, ok: false, error: e.message, estado: 'ERROR' });
        _escribirResultadoFila_(sh, v.fila, '', '', 'ERROR: ' + e.message);
      }
    });

    SpreadsheetApp.flush();
    return { ok: true, resultados: resultados, saldo_final: _leerSaldoActual_(sh) };
  } catch (e) { return { ok: false, error: e.message }; }
}

// Escribir NMXT (E), Costo (F), Estado (G) en una fila
function _escribirResultadoFila_(sh, fila, nmxt, costo, estado) {
  try {
    sh.getRange(fila, 5).setValue(nmxt || '');
    if (costo !== '' && costo !== null) sh.getRange(fila, 6).setValue(costo || '');
    sh.getRange(fila, 7).setValue(estado || '');
  } catch (e) { Logger.log('escribir fila: ' + e.message); }
}

// ════════════════════════════════════════════════════════════════
//  Descargar PDF desde un link de Drive (acepta los 2 formatos comunes)
// ════════════════════════════════════════════════════════════════
function _descargarPDFDeDrive_(url) {
  try {
    var fileId = _extraerFileIdDrive_(url);
    if (!fileId) return null;
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    return Utilities.base64Encode(blob.getBytes());
  } catch (e) { Logger.log('Drive PDF: ' + e.message); return null; }
}

function _extraerFileIdDrive_(url) {
  if (!url) return null;
  // Formatos típicos:
  // https://drive.google.com/file/d/FILEID/view
  // https://drive.google.com/open?id=FILEID
  // https://drive.google.com/uc?id=FILEID
  var m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

function _extraerNumeroGuia_(url) {
  // Si el archivo se llamó "1234567.pdf", tomar el nombre
  try {
    var id = _extraerFileIdDrive_(url);
    if (!id) return '';
    var name = DriveApp.getFileById(id).getName();
    return name.replace(/\.pdf$/i, '').trim();
  } catch (e) { return ''; }
}

// ════════════════════════════════════════════════════════════════
//  Alertas: email + WhatsApp Twilio cuando se intenta comprar sin saldo
//  Se dispara UNA vez por ejecución (no spammea)
// ════════════════════════════════════════════════════════════════
var _ALERTA_DISPARADA = false;

function _dispararAlertaSaldo_(saldoActual, montoNecesario, venta) {
  if (_ALERTA_DISPARADA) return;
  _ALERTA_DISPARADA = true;

  var props = PropertiesService.getScriptProperties();
  var email = props.getProperty('ALERTA_EMAIL');
  var whats = props.getProperty('ALERTA_WHATSAPP');
  var nombre = props.getProperty('ALERTA_NOMBRE') || 'Victor';

  var asunto = '⚠ SALDO INSUFICIENTE en CVA Dropship';
  var cuerpo = 'Hola ' + nombre + ',\n\n' +
               'Se intentó procesar la venta SO ' + venta.so + ' (SKU ' + venta.sku + ')\n' +
               'pero el saldo es insuficiente:\n\n' +
               '  Saldo actual:     $' + saldoActual.toFixed(2) + '\n' +
               '  Monto necesario:  $' + montoNecesario.toFixed(2) + '\n' +
               '  Faltan:           $' + (montoNecesario - saldoActual).toFixed(2) + '\n\n' +
               'Recarga tu saldo en CVA y vuelve a intentar.\n\n' +
               '— Sistema CVA Dropship';

  if (email) {
    try { MailApp.sendEmail({ to: email, subject: asunto, body: cuerpo }); }
    catch (e) { Logger.log('Email alerta: ' + e.message); }
  }

  if (whats) {
    try {
      _twilioWhatsApp_(whats, '⚠ SALDO INSUFICIENTE CVA\nSO ' + venta.so +
        '\nFaltan $' + (montoNecesario - saldoActual).toFixed(2) +
        '\nSaldo: $' + saldoActual.toFixed(2));
    } catch (e) { Logger.log('Twilio alerta: ' + e.message); }
  }
}

function _twilioWhatsApp_(to, mensaje) {
  var props = PropertiesService.getScriptProperties();
  var sid   = props.getProperty('TWILIO_ACCOUNT_SID');
  var token = props.getProperty('TWILIO_AUTH_TOKEN');
  var from  = props.getProperty('TWILIO_FROM');
  if (!sid || !token || !from) throw new Error('Twilio no configurado en Script Properties');
  if (!to.startsWith('whatsapp:')) to = 'whatsapp:' + to;
  var url = 'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json';
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: { From: from, To: to, Body: mensaje },
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token) },
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code !== 200 && code !== 201) Logger.log('Twilio HTTP ' + code + ': ' + resp.getContentText());
}

// ════════════════════════════════════════════════════════════════
//  PANTALLA
// ════════════════════════════════════════════════════════════════
function htmlVentasMasivo() {
  return HtmlService.createTemplateFromFile('ventasMasivoUI').evaluate()
    .setTitle('Todos los pedidos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function abrirVentasMasivo() {
  var html = HtmlService.createTemplateFromFile('ventasMasivoUI').evaluate()
    .setWidth(1280).setHeight(820);
  SpreadsheetApp.getUi().showModalDialog(html, 'Procesar todos los pedidos');
}