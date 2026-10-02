/**********************************************************************
 * imagenesBuscador.gs — Buscador de imágenes por UPC (Serper + CVA → Drive + Cloudinary)
 *
 * ARQUITECTURA FUSIONADA (junio 2026):
 *  - Una sola pantalla, una sola hoja, un solo log.
 *  - El usuario captura: UPC* | Clave CVA* | Categoría | Marca | Nombre | Modelo
 *    (los dos primeros son obligatorios).
 *  - Antes de buscar: valida bidireccionalmente contra SKU_INVENTARIO.
 *    Si UPC ya existe ahí → su Clave CVA debe coincidir.
 *    Si Clave CVA ya existe ahí → su UPC debe coincidir.
 *  - Por cada fila válida:
 *      1) descarga imágenes oficiales de CVA por Clave (1, 2 o 3).
 *      2) busca 6 imágenes en Google (Serper) por UPC + datos opcionales.
 *      → la pantalla muestra ambos grupos en dos filas; usuario selecciona.
 *  - Las seleccionadas pasan por canvas 1000×1000 en el navegador y suben a:
 *      • Drive: subcarpeta UPC CVA/<upc>/<upc>_v1.jpg, v2.jpg, ...
 *      • Cloudinary: con public_id "<upc>_vN"
 *    Tanto las de CVA como las de Google caen en la misma subcarpeta del UPC.
 *  - Log: IMAGENES_LOG (27 cols), sin duplicados, URLs/IDs separados por columna.
 *      A=UPC  B=Fecha  C=Imágenes  D=Marca  E=Nombre  F=Modelo  G=Categoría
 *      H-M = Nombre archivo 1..6
 *      N-S = Drive ID 1..6
 *      T-Y = URL Cloudinary 1..6
 *      Z=SKU(ARRAYFORMULA)  AA=Clave CVA
 *
 * CONFIG: Propiedades del script → SERPER_API_KEY.
 **********************************************************************/

var IMG_CFG = {
  HOJA_CAPTURA: 'BUSQUEDA_IMAGENES',
  HOJA_LOG: 'IMAGENES_LOG',
  DRIVE_FOLDER_ID: '1fN7Oi7k4ZdWjnev7-HhV8H3LLl1ZEhHv',
  FILAS_DEFAULT: 10,
  CANDIDATAS_POR_UPC: 6,
  MAX_IMAGES_CVA: 6,
  MIN_PX: 800,
  SERPER_IMAGES_URL: 'https://google.serper.dev/images',
  GL: 'mx',
  HL: 'es',
  CLOUDINARY_CLOUD:  'dene2fzbe',
  CLOUDINARY_PRESET: 'upc_cva'
};

function _getSerperKey_() {
  var k = PropertiesService.getScriptProperties().getProperty('SERPER_API_KEY');
  if (!k) throw new Error('Falta SERPER_API_KEY en Propiedades del script.');
  return k;
}

function configurarSerperKey_() {
  PropertiesService.getScriptProperties().setProperty('SERPER_API_KEY', 'PEGA_AQUI_TU_KEY_Y_BORRALA');
  Logger.log('SERPER_API_KEY guardada. Borra la key de esta función.');
}

// Cloudinary — subida unsigned
function _subirACloudinary_(blob, publicId) {
  try {
    var endpoint = 'https://api.cloudinary.com/v1_1/' + IMG_CFG.CLOUDINARY_CLOUD + '/image/upload';
    var resp = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      payload: { 'file': blob, 'upload_preset': IMG_CFG.CLOUDINARY_PRESET, 'public_id': publicId },
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode(), body = resp.getContentText();
    if (code !== 200) { Logger.log('Cloudinary HTTP ' + code + ': ' + body.substring(0, 300)); return null; }
    var json = JSON.parse(body);
    return { url: json.secure_url || json.url, public_id: json.public_id };
  } catch (e) { Logger.log('Cloudinary excepción: ' + e.message); return null; }
}

// ════════════════════════════════════════════════════════════════
//  Procesamiento SERVER-SIDE a 1000×1000 (para imágenes que el
//  navegador no pudo procesar por CORS).
//  1) Descarga la original con UrlFetchApp (sin restricción CORS).
//  2) La sube a Cloudinary (asset base).
//  3) Construye la URL derivada con transformación c_pad 1000×1000
//     fondo blanco y la descarga — ese blob 1000×1000 va a Drive.
//  Devuelve { blob, cloudUrl } o null si falló.
// ════════════════════════════════════════════════════════════════
function _procesarImagenServerSide_(urlOriginal, publicId) {
  try {
    // 1) Descargar original (GAS no tiene CORS)
    var resp = UrlFetchApp.fetch(urlOriginal, {
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: false,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GoogleAppsScript)' }
    });
    if (resp.getResponseCode() !== 200) {
      Logger.log('ServerSide: original HTTP ' + resp.getResponseCode() + ' → ' + urlOriginal.substring(0, 120));
      return null;
    }
    var blobOriginal = resp.getBlob();

    // 2) Subir asset base a Cloudinary
    var up = _subirACloudinary_(blobOriginal, publicId);
    if (!up) { Logger.log('ServerSide: fallo subida Cloudinary'); return null; }

    // 3) URL derivada — MISMA regla de marco uniforme que el frontend:
    //    trim → producto a 800px (80%) → lienzo 1000×1000 → sharpen
    var urlDerivada = 'https://res.cloudinary.com/' + IMG_CFG.CLOUDINARY_CLOUD
      + '/image/upload/e_trim:10/c_pad,w_800,h_800,b_white/c_lpad,w_1000,h_1000,b_white/e_sharpen:70,q_auto:best,f_jpg/' + up.public_id + '.jpg';

    // 4) Descargar la derivada (Cloudinary la genera al vuelo la primera vez)
    var respDeriv = UrlFetchApp.fetch(urlDerivada, { muteHttpExceptions: true, followRedirects: true });
    if (respDeriv.getResponseCode() !== 200) {
      Logger.log('ServerSide: derivada HTTP ' + respDeriv.getResponseCode());
      // Aunque falle la descarga de la derivada, ya está en Cloudinary.
      // Devolver el original como último recurso NO — mantener estándar 1000×1000.
      return null;
    }
    var blobDerivada = respDeriv.getBlob().setContentType('image/jpeg');

    return { blob: blobDerivada, cloudUrl: urlDerivada };
  } catch (e) {
    Logger.log('ServerSide excepción: ' + e.message);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
//  HOJA BUSQUEDA_IMAGENES — 8 columnas
//  A=UPC* B=Categoría C=Marca D=Nombre E=Modelo F=Color G=SKU(ignorado) H=Clave CVA*
//  Color y SKU se guardan para preservar el pegado, pero NO se usan en búsqueda.
// ════════════════════════════════════════════════════════════════
function _hojaCaptura_() {
  var ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  var sh = ss.getSheetByName(IMG_CFG.HOJA_CAPTURA);
  var headers = ['UPC (obligatorio)', 'Categoría', 'Marca', 'Nombre', 'Modelo', 'Color', 'SKU', 'Clave CVA (obligatoria)'];
  if (!sh) {
    sh = ss.insertSheet(IMG_CFG.HOJA_CAPTURA);
    _aplicarHeaderCaptura_(sh, headers);
    sh.getRange('J1').setValue('▶ Pega aquí los UPC y Claves CVA (ambos obligatorios). Las demás columnas afinan la búsqueda en Google (Color y SKU se ignoran).')
      .setFontColor('#888').setFontStyle('italic');
  } else {
    // Migración: detectar esquema viejo y reacomodar
    var primerHeader = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
    var bHdr = String(primerHeader[1] || '').trim().toLowerCase();
    var hCol = sh.getLastColumn();
    var necesitaMigracion = false;
    var datosViejos = [];

    if (bHdr.indexOf('clave') >= 0) {
      // Esquema muy viejo: A=UPC B=ClaveCVA C=Categoría D=Marca E=Nombre F=Modelo
      necesitaMigracion = true;
      var lastRow = sh.getLastRow();
      if (lastRow >= 2) datosViejos = sh.getRange(2, 1, lastRow - 1, 6).getValues().map(function (r) {
        // Mapear a nuevo orden: UPC, Categoría, Marca, Nombre, Modelo, Color='', SKU='', ClaveCVA
        return [r[0] || '', r[2] || '', r[3] || '', r[4] || '', r[5] || '', '', '', r[1] || ''];
      });
    } else if (hCol < 8) {
      // Esquema intermedio: A=UPC B=Categoría C=Marca D=Nombre E=Modelo F=ClaveCVA (6 cols)
      // Hay que insertar Color y SKU vacíos antes de Clave CVA.
      necesitaMigracion = true;
      var lastRow2 = sh.getLastRow();
      if (lastRow2 >= 2) datosViejos = sh.getRange(2, 1, lastRow2 - 1, 6).getValues().map(function (r) {
        return [r[0] || '', r[1] || '', r[2] || '', r[3] || '', r[4] || '', '', '', r[5] || ''];
      });
    }

    if (necesitaMigracion) {
      sh.clear();
      _aplicarHeaderCaptura_(sh, headers);
      if (datosViejos.length > 0) sh.getRange(2, 1, datosViejos.length, 8).setValues(datosViejos);
    }
  }
  return sh;
}

function _aplicarHeaderCaptura_(sh, headers) {
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#00665e').setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 150); sh.setColumnWidth(2, 130);
  sh.setColumnWidth(3, 130); sh.setColumnWidth(4, 280);
  sh.setColumnWidth(5, 130); sh.setColumnWidth(6, 100);
  sh.setColumnWidth(7, 180); sh.setColumnWidth(8, 130);
  sh.getRange('A:A').setNumberFormat('@').setHorizontalAlignment('center');
  sh.getRange('H:H').setNumberFormat('@').setHorizontalAlignment('center');
}

function _leerCaptura_() {
  var sh = _hojaCaptura_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var data = sh.getRange(2, 1, last - 1, 8).getValues();
  var out = [];
  data.forEach(function (r) {
    // A=UPC B=Categoría C=Marca D=Nombre E=Modelo F=Color G=SKU(ignorado) H=Clave CVA
    var upc   = String(r[0] || '').trim();
    var clave = String(r[7] || '').trim();
    if (!upc && !clave) return;
    out.push({
      upc: upc,
      categoria: String(r[1] || '').trim(),
      marca:     String(r[2] || '').trim(),
      nombre:    String(r[3] || '').trim(),
      modelo:    String(r[4] || '').trim(),
      color:     String(r[5] || '').trim(),     // se guarda en captura pero no se usa
      sku_pegado: String(r[6] || '').trim(),    // se guarda en captura pero no se usa
      clave_cva: clave
    });
  });
  return out;
}

function cargarCapturaImagenes() {
  try { return { ok: true, filas: _leerCaptura_(), filas_default: IMG_CFG.FILAS_DEFAULT }; }
  catch (e) { return { ok: false, error: e.message }; }
}

function guardarCapturaImagenes(filas) {
  try {
    var sh = _hojaCaptura_();
    var last = sh.getLastRow();
    if (last >= 2) sh.getRange(2, 1, last - 1, 8).clearContent();
    var limpias = (filas || []).filter(function (f) {
      return (String(f.upc || '').trim() !== '') || (String(f.clave_cva || '').trim() !== '');
    });
    if (limpias.length > 0) {
      var matriz = limpias.map(function (f) {
        return [
          String(f.upc || '').trim(),
          String(f.categoria || '').trim(),
          String(f.marca || '').trim(),
          String(f.nombre || '').trim(),
          String(f.modelo || '').trim(),
          String(f.color || '').trim(),
          String(f.sku_pegado || '').trim(),
          String(f.clave_cva || '').trim()
        ];
      });
      sh.getRange(2, 1, matriz.length, 8).setValues(matriz);
    }
    SpreadsheetApp.flush();
    return { ok: true, guardadas: limpias.length };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ════════════════════════════════════════════════════════════════
//  HOJA IMAGENES_LOG — 26 columnas
//  A=UPC  B=Fecha  C=Imágenes(total)  D=Marca  E=Nombre  F=Modelo  G=Categoría
//  H-M  = Nombre archivo 1..6
//  N-S  = Drive ID 1..6
//  T-Y  = URL Cloudinary 1..6
//  Z=SKU(ARRAYFORMULA)   AA=Clave CVA
// ════════════════════════════════════════════════════════════════
function _hojaImagenesLog_() {
  var ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  var sh = ss.getSheetByName(IMG_CFG.HOJA_LOG);
  if (!sh) {
    sh = ss.insertSheet(IMG_CFG.HOJA_LOG);
    _aplicarHeaderLog_(sh);
  } else {
    _migrarLogVarianteAlNuevo_(sh);
  }
  _asegurarFormulaSKU_(sh);
  return sh;
}

function _aplicarHeaderLog_(sh) {
  // 26 columnas: 7 metadatos + 6+6+6 imágenes + SKU + Clave CVA
  var headers = ['UPC', 'Fecha', 'Imágenes', 'Marca', 'Nombre', 'Modelo', 'Categoría'];
  for (var i = 1; i <= 6; i++) headers.push('Nombre ' + i);
  for (var i = 1; i <= 6; i++) headers.push('Drive ID ' + i);
  for (var i = 1; i <= 6; i++) headers.push('URL Cloudinary ' + i);
  headers.push('SKU');
  headers.push('Clave CVA');
  // Total: 7 + 6 + 6 + 6 + 2 = 27. Lo dejamos en 27 para tener "número de imágenes" como C.

  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#00665e').setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  sh.setFrozenRows(1);
  // Anchos
  sh.setColumnWidth(1, 150);  // UPC
  sh.setColumnWidth(2, 150);  // Fecha
  sh.setColumnWidth(3, 80);   // Imágenes
  sh.setColumnWidth(4, 130);  // Marca
  sh.setColumnWidth(5, 280);  // Nombre
  sh.setColumnWidth(6, 130);  // Modelo
  sh.setColumnWidth(7, 130);  // Categoría
  // Nombres archivo 1..6 = cols 8..13
  for (var c = 8; c <= 13; c++) sh.setColumnWidth(c, 220);
  // Drive IDs 1..6 = cols 14..19
  for (var c = 14; c <= 19; c++) sh.setColumnWidth(c, 220);
  // URLs Cloudinary 1..6 = cols 20..25
  for (var c = 20; c <= 25; c++) sh.setColumnWidth(c, 360);
  // SKU + Clave CVA
  sh.setColumnWidth(26, 180);
  sh.setColumnWidth(27, 110);

  sh.getRange('A:A').setNumberFormat('@').setHorizontalAlignment('center');
  // Clave CVA está en col 27 (AA)
  sh.getRange(1, 27, sh.getMaxRows(), 1).setNumberFormat('@').setHorizontalAlignment('center');
}

// Migración: detecta el esquema viejo (12 cols con URLs juntas) y reacomoda al nuevo (27 cols).
function _migrarLogVarianteAlNuevo_(sh) {
  try {
    var primerHeader = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
    var col8 = String(primerHeader[7] || '').trim();
    var col27 = sh.getLastColumn() >= 27 ? String(primerHeader[26] || '').trim() : '';
    // Esquema NUEVO: H = "Nombre 1" y col 27 = "Clave CVA"
    if (col8 === 'Nombre 1' && col27 === 'Clave CVA') return;

    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    var datos = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, Math.max(lastCol, 12)).getValues() : [];
    sh.clear();
    _aplicarHeaderLog_(sh);

    if (datos.length > 0) {
      var migrados = datos.map(function (r) {
        // Detectamos qué esquema viejo era basándonos en el header original
        // Esquema "12 cols con URLs juntas" (el más reciente antes de este cambio):
        //   A=UPC B=Fecha C=Imágenes D=Marca E=Nombre F=Modelo G=Categoría
        //   H=Nombres(coma) I=DriveIDs(coma) J=Urls(coma) K=SKU L=ClaveCVA
        var nombres   = String(r[7]  || '').split(/,\s*/).filter(function(x){return x;});
        var driveIds  = String(r[8]  || '').split(/,\s*/).filter(function(x){return x;});
        var urls      = String(r[9]  || '').split(/,\s*/).filter(function(x){return x;});
        var claveCVA  = r[11] || '';

        var fila = [
          r[0] || '',   // A UPC
          r[1] || '',   // B Fecha
          r[2] || '',   // C Imágenes
          r[3] || '',   // D Marca
          r[4] || '',   // E Nombre
          r[5] || '',   // F Modelo
          r[6] || ''    // G Categoría
        ];
        for (var k = 0; k < 6; k++) fila.push(nombres[k]  || '');  // H-M
        for (var k = 0; k < 6; k++) fila.push(driveIds[k] || '');  // N-S
        for (var k = 0; k < 6; k++) fila.push(urls[k]     || '');  // T-Y
        fila.push('');         // Z SKU (la fórmula)
        fila.push(claveCVA);   // AA Clave CVA
        return fila;
      });
      sh.getRange(2, 1, migrados.length, 27).setValues(migrados);
    }
    Logger.log('IMAGENES_LOG migrado al esquema de 27 columnas (URLs separadas).');
  } catch (e) { Logger.log('Error migrando IMAGENES_LOG: ' + e.message); }
}

function _asegurarFormulaSKU_(sh) {
  try {
    // SKU ahora vive en col 26 = Z
    var f = '=ARRAYFORMULA(IF(A2:A="";"";IFERROR(VLOOKUP(A2:A;SKU_INVENTARIO!A:G;7;FALSE);"")))';
    var celda = sh.getRange('Z2');
    if (!celda.getFormula()) celda.setFormula(f);
  } catch (e) { Logger.log('Lookup SKU: ' + e.message); }
}

function _upcsYaHechos_() {
  var sh = _hojaImagenesLog_();
  var hechos = {};
  var last = _ultimaFilaRealLog_(sh);
  if (last < 2) return hechos;
  // A=UPC ... C=Imágenes (índice 2)
  sh.getRange(2, 1, last - 1, 3).getValues().forEach(function (r) {
    var upc = String(r[0] || '').trim();
    var n = parseInt(r[2], 10) || 0;
    if (upc && n > 0) hechos[upc] = true;
  });
  return hechos;
}

// ════════════════════════════════════════════════════════════════
//  Validación bidireccional contra SKU_INVENTARIO
//  SKU_INVENTARIO: A=UPC ... H=Clave CVA
// ════════════════════════════════════════════════════════════════
function _leerMapeoSKUInventario_() {
  var ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  var sh = ss.getSheetByName('SKU_INVENTARIO');
  if (!sh) return { porUPC: {}, porClave: {} };
  var lastCol = Math.max(sh.getLastColumn(), 8);
  var n = Math.max(sh.getLastRow() - 1, 0);
  if (n === 0) return { porUPC: {}, porClave: {} };
  var data = sh.getRange(2, 1, n, lastCol).getValues();
  var porUPC = {}, porClave = {};
  data.forEach(function (r) {
    var upc = String(r[0] || '').trim();
    var clave = String(r[7] || '').trim();
    if (upc) porUPC[upc] = clave;
    if (clave) porClave[clave] = upc;
  });
  return { porUPC: porUPC, porClave: porClave };
}

function validarFilasContraInventario(filas) {
  try {
    var mapa = _leerMapeoSKUInventario_();
    var inconsistencias = [];
    (filas || []).forEach(function (f, i) {
      var upc = String(f.upc || '').trim();
      var clave = String(f.clave_cva || '').trim();
      if (!upc || !clave) return;
      var claveEsp = mapa.porUPC[upc];
      if (claveEsp && claveEsp !== clave) {
        inconsistencias.push({
          fila: i + 1, upc: upc, clave_capturada: clave,
          mensaje: 'UPC ' + upc + ' ya está en SKU_INVENTARIO con clave ' + claveEsp + ', no ' + clave
        });
        return;
      }
      var upcEsp = mapa.porClave[clave];
      if (upcEsp && upcEsp !== upc) {
        inconsistencias.push({
          fila: i + 1, upc: upc, clave_capturada: clave,
          mensaje: 'Clave ' + clave + ' ya está en SKU_INVENTARIO con UPC ' + upcEsp + ', no ' + upc
        });
      }
    });
    return { ok: true, inconsistencias: inconsistencias };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ════════════════════════════════════════════════════════════════
//  Serper Images
// ════════════════════════════════════════════════════════════════
function _serperImages_(query) {
  try {
    var resp = UrlFetchApp.fetch(IMG_CFG.SERPER_IMAGES_URL, {
      method: 'post', contentType: 'application/json',
      headers: { 'X-API-KEY': _getSerperKey_() },
      payload: JSON.stringify({ q: query, gl: IMG_CFG.GL, hl: IMG_CFG.HL }),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) return { images: [], error: 'HTTP ' + resp.getResponseCode() };
    var json = JSON.parse(resp.getContentText());
    var imgs = (json.images || []).map(function (im) {
      return { url: im.imageUrl, w: im.imageWidth, h: im.imageHeight, source: im.source || '', title: im.title || '' };
    }).filter(function (im) { return im.url; });
    return { images: imgs };
  } catch (e) { return { images: [], error: e.message }; }
}

function _construirQuery_(f) {
  var partes = [String(f.upc || '').trim()];
  ['marca', 'nombre', 'modelo'].forEach(function (k) {
    var v = String(f[k] || '').trim();
    if (v) partes.push(v);
  });
  return partes.filter(function (p) { return p; }).join(' ').trim();
}

function _filtroPx_(imgs, minPx) {
  if (!minPx) return imgs;
  return imgs.filter(function (im) {
    var w = parseInt(im.w, 10) || 0, h = parseInt(im.h, 10) || 0;
    return (w >= minPx && h >= minPx);
  });
}

// ════════════════════════════════════════════════════════════════
//  CVA imágenes por clave (reusa cva.gs si existe)
// ════════════════════════════════════════════════════════════════
function _obtenerImagenesCVA_(clave) {
  try {
    if (typeof obtenerImagenesPorClave === 'function') {
      var r = obtenerImagenesPorClave(clave);
      if (r && r.ok && Array.isArray(r.imagenes)) return _extraerUrls_(r.imagenes);
    }
  } catch (e) {}
  try {
    if (typeof routeGet_ === 'function') {
      var r2 = routeGet_('cva_imagenes', { clave: clave });
      if (r2 && r2.ok) return _extraerUrls_(r2.imagenes || r2.data || r2.urls || []);
    }
  } catch (e) {}
  try {
    if (typeof routeGet_ === 'function') {
      var r3 = routeGet_('cva_producto', { clave: clave });
      if (r3 && r3.ok) {
        var fuentes = r3.imagenes || (r3.producto && r3.producto.imagenes) || [];
        return _extraerUrls_(fuentes);
      }
    }
  } catch (e) {}
  return [];
}

function _extraerUrls_(arr) {
  if (!arr) return [];
  if (typeof arr === 'string') return [arr];
  if (!Array.isArray(arr)) return [];
  return arr.map(function (it) {
    if (typeof it === 'string') return it;
    return it.url || it.URL || it.image || it.imageUrl || it.src || '';
  }).filter(function (u) { return u && /^https?:/i.test(u); });
}

// ════════════════════════════════════════════════════════════════
//  PÚBLICA: buscar imágenes (CVA + Google) para una tabla de filas
// ════════════════════════════════════════════════════════════════
function buscarImagenesPorTabla(filas, forzar, minPx) {
  if (!Array.isArray(filas) || filas.length === 0) {
    return { ok: false, error: 'No capturaste ninguna fila.' };
  }
  try { guardarCapturaImagenes(filas); } catch (e) {}
  var hechos = forzar ? {} : _upcsYaHechos_();
  var minP = (minPx === undefined) ? IMG_CFG.MIN_PX : (parseInt(minPx, 10) || 0);
  var resultados = [];
  var saltadas = 0;

  filas.forEach(function (f) {
    var upc = String(f.upc || '').trim();
    var clave = String(f.clave_cva || '').trim();
    if (!upc || !clave) return;
    if (hechos[upc]) { saltadas++; return; }

    var cvaUrls = [];
    try { cvaUrls = _obtenerImagenesCVA_(clave).slice(0, IMG_CFG.MAX_IMAGES_CVA); }
    catch (e) { cvaUrls = []; }

    var query = _construirQuery_(f);
    var serp = _serperImages_(query);
    var googleImgs = (serp && serp.images) ? serp.images : [];
    var filtrado = _filtroPx_(googleImgs, minP).slice(0, IMG_CFG.CANDIDATAS_POR_UPC);
    if (filtrado.length < IMG_CFG.CANDIDATAS_POR_UPC) {
      var extra = googleImgs.filter(function (im) {
        return !filtrado.some(function (x) { return x.url === im.url; });
      }).slice(0, IMG_CFG.CANDIDATAS_POR_UPC - filtrado.length);
      filtrado = filtrado.concat(extra);
    }

    resultados.push({
      upc: upc, clave_cva: clave,
      categoria: f.categoria || '', marca: f.marca || '',
      nombre: f.nombre || '', modelo: f.modelo || '',
      query: query,
      cva: cvaUrls,
      google: filtrado,
      aviso_cva: cvaUrls.length === 0 ? 'CVA no devolvió imágenes' : '',
      aviso_google: serp.error ? ('Serper: ' + serp.error) : ''
    });
    Utilities.sleep(180);
  });

  return { ok: true, total: resultados.length, resultados: resultados, saltadas: saltadas };
}

// ════════════════════════════════════════════════════════════════
//  PÚBLICA: subir blobs seleccionados a Drive + Cloudinary
// ════════════════════════════════════════════════════════════════
function subirSeleccionadasADrive(seleccion) {
  if (!seleccion || !seleccion.length) return { ok: false, error: 'No llegaron imágenes seleccionadas.' };

  var folder;
  try { folder = DriveApp.getFolderById(IMG_CFG.DRIVE_FOLDER_ID); }
  catch (e) { return { ok: false, error: 'No puedo abrir la carpeta Drive padre. ' + e.message }; }

  var shLog = _hojaImagenesLog_();
  var resumen = [];
  var upcsSubidos = {};

  seleccion.forEach(function (sel, i) {
    var upc = String(sel.upc || '').trim() || ('SIN_UPC_' + (i + 1));
    var clave = String(sel.clave_cva || '').trim();
    var items = sel.items || [];
    var subidas = [], fallos = [], nombres = [], ids = [], urlsCloudinary = [];

    var subfolder;
    try {
      var iter = folder.getFoldersByName(upc);
      subfolder = iter.hasNext() ? iter.next() : folder.createFolder(upc);
    } catch (e) {
      resumen.push({ upc: upc, subidas: 0, fallos: ['no pude crear subcarpeta: ' + e.message], cloudinary_ok: 0 });
      return;
    }

    items.forEach(function (it, v) {
      try {
        var blob;
        var cloudUrlYaResuelta = null;
        if (it.b64) {
          var bytes = Utilities.base64Decode(it.b64);
          blob = Utilities.newBlob(bytes, it.mime || 'image/jpeg', 'tmp');
        } else if (it.server && it.url) {
          // Procesamiento SERVER-SIDE: el navegador no pudo (CORS en canvas
          // y en Cloudinary fetch). Apps Script no tiene CORS, así que:
          // 1) descarga la original, 2) la sube a Cloudinary, 3) descarga la
          // versión transformada 1000×1000 y esa es la que va a Drive.
          var srv = _procesarImagenServerSide_(it.url, upc + '_v' + (v + 1));
          if (!srv) { fallos.push('v' + (v + 1) + ' server-side falló (URL inaccesible o Cloudinary)'); return; }
          blob = srv.blob;
          cloudUrlYaResuelta = srv.cloudUrl;
        } else {
          fallos.push('v' + (v + 1) + ' sin b64 procesado — recarga la pantalla (versión vieja)');
          return;
        }

        var ext = _extDesdeBlob_(blob, it.url || '');
        var nombreSinExt = upc + '_v' + (v + 1);
        var nombre = nombreSinExt + ext;
        blob.setName(nombre);
        var file = subfolder.createFile(blob);
        subidas.push(nombre); nombres.push(nombre); ids.push(file.getId());
        if (cloudUrlYaResuelta) {
          // El flujo server-side ya subió a Cloudinary y tenemos la URL transformada
          urlsCloudinary.push(cloudUrlYaResuelta);
        } else {
          var cloud = _subirACloudinary_(blob, nombreSinExt);
          urlsCloudinary.push(cloud ? cloud.url : '');
        }
      } catch (e) { fallos.push('v' + (v + 1) + ' ' + e.message); }
    });

    if (subidas.length > 0) {
      _registrarEnLog_(shLog, {
        upc: upc, clave_cva: clave, cuantas: subidas.length,
        marca: sel.marca || '', nombre: sel.nombre || '', modelo: sel.modelo || '',
        categoria: sel.categoria || '',
        nombres: nombres, ids: ids, urls: urlsCloudinary
      });
      upcsSubidos[upc] = true;
    }
    resumen.push({ upc: upc, subidas: subidas.length, fallos: fallos,
                   cloudinary_ok: urlsCloudinary.filter(function(u){return u;}).length });
  });

  var limpiadas = _limpiarCapturaUPCs_(Object.keys(upcsSubidos));
  return { ok: true, carpeta: IMG_CFG.DRIVE_FOLDER_ID, resumen: resumen, limpiadas: limpiadas };
}

function _registrarEnLog_(shLog, d) {
  var last = _ultimaFilaRealLog_(shLog);
  var filaExistente = 0;
  if (last >= 2) {
    var colA = shLog.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < colA.length; i++) {
      if (String(colA[i][0] || '').trim() === d.upc) { filaExistente = i + 2; break; }
    }
  }
  // Construir fila de 27 cols. SKU (col 26 = Z) la dejamos vacía: la ARRAYFORMULA la llena.
  var fila = [
    d.upc, new Date(), d.cuantas, d.marca, d.nombre, d.modelo, d.categoria
  ]; // A-G (7 valores)
  // H-M: Nombres archivo 1..6
  for (var k = 0; k < 6; k++) fila.push(d.nombres[k] || '');
  // N-S: Drive IDs 1..6
  for (var k = 0; k < 6; k++) fila.push(d.ids[k] || '');
  // T-Y: URLs Cloudinary 1..6
  for (var k = 0; k < 6; k++) fila.push(d.urls[k] || '');
  // Z: SKU (vacío - lo llena la fórmula). AA: Clave CVA
  fila.push('');
  fila.push(d.clave_cva || '');

  var filaDestino = filaExistente || (last + 1);
  // Escribimos A-Y (cols 1..25) y omitimos Z porque tiene fórmula.
  // Luego escribimos AA (col 27).
  shLog.getRange(filaDestino, 1, 1, 25).setValues([fila.slice(0, 25)]);
  shLog.getRange(filaDestino, 27).setValue(d.clave_cva || '');
}

// Devuelve la última fila REAL con datos en col A (UPC) de IMAGENES_LOG,
// ignorando las filas que la ARRAYFORMULA de K llenó con strings vacíos.
// Sin esto, getLastRow() devuelve 1000+ y _registrarEnLog_ escribe muy abajo.
function _ultimaFilaRealLog_(sh) {
  var lastFisica = sh.getLastRow();
  if (lastFisica < 2) return 1;
  var data = sh.getRange(1, 1, lastFisica, 1).getValues();
  for (var i = data.length - 1; i >= 0; i--) {
    if (String(data[i][0] || '').trim() !== '') return i + 1;
  }
  return 1;
}

function _limpiarCapturaUPCs_(upcs) {
  if (!upcs || !upcs.length) return 0;
  var sh = _hojaCaptura_();
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var set = {};
  upcs.forEach(function (u) { set[String(u).trim()] = true; });
  var data = sh.getRange(2, 1, last - 1, 6).getValues();
  var quedan = data.filter(function (r) {
    var u = String(r[0] || '').trim();
    return u && !set[u];
  });
  sh.getRange(2, 1, last - 1, 6).clearContent();
  if (quedan.length > 0) sh.getRange(2, 1, quedan.length, 6).setValues(quedan);
  SpreadsheetApp.flush();
  return (last - 1) - quedan.length;
}

function _extDesdeBlob_(blob, url) {
  var mime = (blob.getContentType() || '').toLowerCase();
  if (mime.indexOf('jpeg') >= 0 || mime.indexOf('jpg') >= 0) return '.jpg';
  if (mime.indexOf('png')  >= 0) return '.png';
  if (mime.indexOf('webp') >= 0) return '.webp';
  if (mime.indexOf('gif')  >= 0) return '.gif';
  var u = String(url || '').toLowerCase();
  if (u.match(/\.png(\?|$)/))  return '.png';
  if (u.match(/\.webp(\?|$)/)) return '.webp';
  if (u.match(/\.gif(\?|$)/))  return '.gif';
  return '.jpg';
}

// ════════════════════════════════════════════════════════════════
//  Pantalla + menú
// ════════════════════════════════════════════════════════════════
function htmlBuscadorImagenes() {
  return HtmlService.createTemplateFromFile('imagenesUI').evaluate()
    .setTitle('Buscar imágenes por UPC')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function abrirBuscadorImagenes() {
  var html = HtmlService.createTemplateFromFile('imagenesUI').evaluate()
    .setWidth(1280).setHeight(820);
  SpreadsheetApp.getUi().showModalDialog(html, 'Buscar imágenes por UPC');
}

function irABusquedaImagenes() {
  var ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  var sh = _hojaCaptura_();
  ss.setActiveSheet(sh);
}

function diagnosticarImagenes_() {
  var out = [];
  try { out.push('Hoja captura: ' + _hojaCaptura_().getName() + ' (filas con datos: ' + _leerCaptura_().length + ')'); }
  catch (e) { out.push('ERROR captura: ' + e.message); }
  try {
    var hechos = _upcsYaHechos_();
    out.push('IMAGENES_LOG: ' + Object.keys(hechos).length + ' UPC ya con imágenes');
  } catch (e) { out.push('ERROR log: ' + e.message); }
  try { out.push('Carpeta Drive OK: ' + DriveApp.getFolderById(IMG_CFG.DRIVE_FOLDER_ID).getName()); }
  catch (e) { out.push('ERROR carpeta Drive: ' + e.message); }
  try {
    var k = _getSerperKey_();
    out.push('SERPER_API_KEY presente: sí (len ' + k.length + ')');
    var r = _serperImages_('test producto electronico');
    out.push(r.error ? ('Serper ERROR: ' + r.error) : ('Serper OK, imágenes: ' + (r.images || []).length));
  } catch (e) { out.push('Serper ERROR: ' + e.message); }
  try {
    var pingB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    var pingBlob = Utilities.newBlob(Utilities.base64Decode(pingB64), 'image/png', 'tmp');
    var c = _subirACloudinary_(pingBlob, '_diagnostico_ping');
    out.push(c ? ('Cloudinary OK: ' + c.url) : 'Cloudinary ERROR: revisa Logger');
  } catch (e) { out.push('Cloudinary ERROR: ' + e.message); }
  Logger.log(out.join('\n'));
  try { SpreadsheetApp.getUi().alert('🔍 Diagnóstico imágenes', out.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
}