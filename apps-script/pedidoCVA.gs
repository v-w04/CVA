/**********************************************************************
 * pedidoCVA.gs · Flujo unificado de pedido CVA desde venta Odoo
 *
 * Flujo del usuario:
 *  1) En la pantalla: pone número de venta Odoo (S00042).
 *  2) Backend trae la venta, lee líneas, resuelve cada SKU → Clave CVA
 *     usando SKU_INVENTARIO (col G=SKU, H=Clave CVA).
 *  3) Consulta stock en CVA por cada Clave CVA y todas las sucursales.
 *  4) Elige automáticamente la sucursal con MÁS unidades para cubrir
 *     el pedido completo.
 *  5) Pantalla muestra todo, usuario revisa, marca "test" si quiere.
 *  6) Botón "Generar pedido CVA" → cvaCrearOrden → obtiene NMXT.
 *  7) Bloque "adjuntar guía" → cvaEnviarGuia.
 *  8) Todo se registra en PEDIDOS_CVA_HISTORIAL.
 *
 * REUSA (ya existentes, no se tocan):
 *   - cvaCrearOrden, cvaEnviarGuia, cvaConsultarPedido, cvaPrecioStock
 *   - autenticarXMLRPC_, odooExec_, CFG
 **********************************************************************/

var PED_CVA_CFG = {
  HOJA_HISTORIAL: 'PEDIDOS_CVA_HISTORIAL',
  HOJA_SKU_INV:   'SKU_INVENTARIO',
};

// ════════════════════════════════════════════════════════════════
//  HOJA PEDIDOS_CVA_HISTORIAL
//  A=NMXT  B=SO Odoo  C=Fecha  D=Sucursal  E=Monto neto  F=IVA
//  G=Total  H=Estado  I=Guía  J=Tracking  K=URL guía PDF  L=Líneas JSON
// ════════════════════════════════════════════════════════════════
function _hojaPedidosCVAHistorial_() {
  var ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  var sh = ss.getSheetByName(PED_CVA_CFG.HOJA_HISTORIAL);
  if (!sh) {
    sh = ss.insertSheet(PED_CVA_CFG.HOJA_HISTORIAL);
    var headers = ['NMXT', 'SO Odoo', 'Fecha', 'Sucursal', 'Monto neto',
                   'IVA', 'Total', 'Estado', 'Guía', 'Tracking',
                   'URL guía PDF', 'Líneas (JSON)'];
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#00665e').setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 120); sh.setColumnWidth(2, 110); sh.setColumnWidth(3, 150);
    sh.setColumnWidth(4, 100); sh.setColumnWidth(5, 100); sh.setColumnWidth(6, 90);
    sh.setColumnWidth(7, 100); sh.setColumnWidth(8, 110); sh.setColumnWidth(9, 130);
    sh.setColumnWidth(10, 140); sh.setColumnWidth(11, 280); sh.setColumnWidth(12, 400);
    sh.getRange('A:A').setNumberFormat('@').setHorizontalAlignment('center');
    sh.getRange('B:B').setNumberFormat('@').setHorizontalAlignment('center');
  }
  return sh;
}

// ════════════════════════════════════════════════════════════════
//  PÚBLICA: Traer venta de Odoo por nombre (ej "S00042")
//  Devuelve { ok, venta: { name, partner, fecha, lineas: [...] } }
// ════════════════════════════════════════════════════════════════
function odooTraerVentaPorNombre(soName) {
  if (!soName) return { ok: false, error: 'Se requiere número de venta' };
  soName = String(soName).trim().toUpperCase();
  try {
    var uid = autenticarXMLRPC_();
    var ids = odooExec_(uid, 'sale.order', 'search', [[['name', '=', soName]]], { limit: 1 });
    if (!ids || ids.length === 0) {
      return { ok: false, error: 'Venta ' + soName + ' no existe en Odoo.' };
    }
    var venta = odooExec_(uid, 'sale.order', 'read', [ids],
      { fields: ['name', 'partner_id', 'date_order', 'amount_total', 'state', 'order_line', 'partner_shipping_id'] })[0];

    // Traer líneas
    var lineas = [];
    if (venta.order_line && venta.order_line.length > 0) {
      var lines = odooExec_(uid, 'sale.order.line', 'read', [venta.order_line],
        { fields: ['product_id', 'product_uom_qty', 'price_unit', 'name'] });
      // Para cada línea, leer el default_code (SKU) del producto
      var prodIds = lines.map(function (l) {
        return Array.isArray(l.product_id) ? l.product_id[0] : l.product_id;
      }).filter(function (x) { return x; });
      var prodMap = {};
      if (prodIds.length > 0) {
        var prods = odooExec_(uid, 'product.product', 'read', [prodIds],
          { fields: ['id', 'default_code', 'barcode', 'name'] });
        prods.forEach(function (p) { prodMap[p.id] = p; });
      }
      lineas = lines.map(function (l) {
        var pid = Array.isArray(l.product_id) ? l.product_id[0] : l.product_id;
        var prod = prodMap[pid] || {};
        return {
          producto_id:   pid,
          producto_name: Array.isArray(l.product_id) ? l.product_id[1] : l.name,
          sku:           String(prod.default_code || '').trim(),
          barcode:       String(prod.barcode || '').trim(),
          descripcion:   l.name || prod.name || '',
          cantidad:      parseFloat(l.product_uom_qty) || 0,
          precio_unit:   parseFloat(l.price_unit) || 0
        };
      });
    }

    return {
      ok: true,
      venta: {
        name: venta.name,
        partner: Array.isArray(venta.partner_id) ? venta.partner_id[1] : '',
        partner_id: Array.isArray(venta.partner_id) ? venta.partner_id[0] : null,
        fecha: venta.date_order,
        total: venta.amount_total,
        estado: venta.state,
        lineas: lineas
      }
    };
  } catch (e) { return { ok: false, error: 'Odoo: ' + e.message }; }
}

// ════════════════════════════════════════════════════════════════
//  PÚBLICA: dado un array de SKUs (o UPC), devolver el mapeo
//  a Clave CVA usando SKU_INVENTARIO.
//  SKU_INVENTARIO: A=UPC, ... G=SKU, H=Clave CVA
//  Búsqueda primero por SKU (col G), luego por UPC (col A), luego por barcode.
// ════════════════════════════════════════════════════════════════
function resolverClavesCVA(items) {
  // items: [{ sku, barcode }, ...]
  try {
    var ss = SpreadsheetApp.openById(CFG.SHEET_ID);
    var sh = ss.getSheetByName(PED_CVA_CFG.HOJA_SKU_INV);
    if (!sh) return { ok: false, error: 'SKU_INVENTARIO no existe' };
    var last = _ultimaFilaSKUInventario_(sh);
    if (last < 2) return { ok: true, mapeo: {} };
    // Leer A (UPC), G (SKU), H (Clave CVA), D (Nombre)
    var data = sh.getRange(2, 1, last - 1, 8).getValues();
    var porSKU = {}, porUPC = {};
    data.forEach(function (r) {
      var upc   = String(r[0] || '').trim();
      var sku   = String(r[6] || '').trim();
      var clave = String(r[7] || '').trim();
      var nombre = String(r[3] || '').trim();
      if (sku && clave) porSKU[sku] = { clave: clave, nombre: nombre, upc: upc };
      if (upc && clave) porUPC[upc] = { clave: clave, nombre: nombre, sku: sku };
    });

    var mapeo = {};
    (items || []).forEach(function (it) {
      var sku = String(it.sku || '').trim();
      var barcode = String(it.barcode || '').trim();
      var match = null;
      if (sku && porSKU[sku]) match = porSKU[sku];
      else if (barcode && porUPC[barcode]) match = porUPC[barcode];
      var key = sku || barcode;
      if (key) mapeo[key] = match || null;
    });
    return { ok: true, mapeo: mapeo };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ════════════════════════════════════════════════════════════════
//  Disponibilidad por sucursal: una sola llamada a cvaPrecioStock por clave.
//  Devuelve para cada clave: { precio, sucursales: { codigo: cantidad } }
//  La respuesta de CVA con sucursales=true trae array de sucursales con stock.
// ════════════════════════════════════════════════════════════════
function consultarDisponibilidadCVA(claves) {
  if (!claves || !claves.length) return { ok: true, resultados: {} };
  var resultados = {};
  claves.forEach(function (clave) {
    try {
      // cvaGetProducto trae sucursales con stock por sucursal
      var data = cvaGetProducto(clave, { sucursales: 'true' });
      var prod = data.producto;
      // El formato exacto de la respuesta CVA varía. Intentamos extraer:
      //   prod[0].sucursales -> array de {sucursal, codigo, existencia, ...}
      var sucursales = {};
      var primero = Array.isArray(prod) ? prod[0] : prod;
      if (primero && primero.sucursales && Array.isArray(primero.sucursales)) {
        primero.sucursales.forEach(function (s) {
          var codigo = s.codigo || s.codigoSucursal || s.sucursal_id || s.id;
          var nombre = s.sucursal || s.nombre || ('S' + codigo);
          var exist  = parseInt(s.existencia, 10) || 0;
          if (codigo !== undefined && codigo !== null) {
            sucursales[codigo] = { nombre: nombre, existencia: exist };
          }
        });
      }
      var precio = (primero && (primero.precio || primero.precio_lista)) || 0;
      resultados[clave] = { ok: true, precio: parseFloat(precio) || 0, sucursales: sucursales };
    } catch (e) {
      resultados[clave] = { ok: false, error: e.message, sucursales: {} };
    }
    Utilities.sleep(120);
  });
  return { ok: true, resultados: resultados };
}

// ════════════════════════════════════════════════════════════════
//  Decide la mejor sucursal: la que cubre más unidades del pedido.
//  Entrada: lineas = [{ clave, cantidad }, ...]
//           disp = { clave: { sucursales: { codigo: { nombre, existencia } } } }
//  Salida: { codigo, nombre, score, cubre_total, faltantes: [...] }
// ════════════════════════════════════════════════════════════════
function elegirMejorSucursal(lineas, disp) {
  // Calcular para cada sucursal cuántas piezas del pedido cubre
  var scores = {}; // { codigoSucursal: { nombre, totalCubierto } }
  lineas.forEach(function (l) {
    var sucs = (disp[l.clave] && disp[l.clave].sucursales) || {};
    Object.keys(sucs).forEach(function (cod) {
      if (!scores[cod]) scores[cod] = { nombre: sucs[cod].nombre, cubre: 0, total_pedido: 0 };
      var pueden = Math.min(sucs[cod].existencia, l.cantidad);
      scores[cod].cubre += pueden;
      scores[cod].total_pedido += l.cantidad;
    });
  });

  var mejorCod = null, mejorScore = -1, mejorNombre = '';
  Object.keys(scores).forEach(function (cod) {
    if (scores[cod].cubre > mejorScore) {
      mejorScore = scores[cod].cubre;
      mejorCod = cod;
      mejorNombre = scores[cod].nombre;
    }
  });

  var totalPedido = lineas.reduce(function (a, l) { return a + l.cantidad; }, 0);

  // Lista de faltantes en la mejor sucursal
  var faltantes = [];
  if (mejorCod !== null) {
    lineas.forEach(function (l) {
      var sucs = (disp[l.clave] && disp[l.clave].sucursales) || {};
      var exist = (sucs[mejorCod] && sucs[mejorCod].existencia) || 0;
      if (exist < l.cantidad) {
        faltantes.push({ clave: l.clave, pedido: l.cantidad, disponible: exist });
      }
    });
  }

  return {
    codigo: mejorCod !== null ? parseInt(mejorCod) : CFG.CVA_SUCURSAL,
    nombre: mejorNombre || ('Sucursal ' + (mejorCod || CFG.CVA_SUCURSAL)),
    cubre: mejorScore >= 0 ? mejorScore : 0,
    total_pedido: totalPedido,
    cubre_completo: faltantes.length === 0,
    faltantes: faltantes
  };
}

// ════════════════════════════════════════════════════════════════
//  PÚBLICA: Toda la fase 1 en una sola llamada desde la pantalla.
//  Recibe el número SO, devuelve TODO listo para mostrar la tabla.
// ════════════════════════════════════════════════════════════════
function prepararPedidoDesdeSO(soName) {
  try {
    var rVenta = odooTraerVentaPorNombre(soName);
    if (!rVenta.ok) return rVenta;
    var venta = rVenta.venta;

    if (!venta.lineas || venta.lineas.length === 0) {
      return { ok: false, error: 'La venta ' + venta.name + ' no tiene líneas.' };
    }

    // Resolver SKUs → Clave CVA
    var rMap = resolverClavesCVA(venta.lineas);
    if (!rMap.ok) return rMap;
    var mapeo = rMap.mapeo;

    var resueltas = []; // líneas con clave CVA
    var sinClave = [];  // líneas sin clave en SKU_INVENTARIO
    venta.lineas.forEach(function (l) {
      var key = l.sku || l.barcode;
      var m = mapeo[key];
      if (m && m.clave) {
        resueltas.push({
          sku: l.sku,
          barcode: l.barcode,
          descripcion: l.descripcion || m.nombre,
          cantidad: l.cantidad,
          precio_odoo: l.precio_unit,
          clave: m.clave
        });
      } else {
        sinClave.push({ sku: l.sku, descripcion: l.descripcion, cantidad: l.cantidad });
      }
    });

    if (resueltas.length === 0) {
      return { ok: false, error: 'Ninguna línea pudo resolverse a Clave CVA. Revisa SKU_INVENTARIO.',
               sin_clave: sinClave };
    }

    // Consultar disponibilidad CVA
    var claves = resueltas.map(function (l) { return l.clave; });
    var disp = consultarDisponibilidadCVA(claves).resultados;

    // Inyectar precio CVA en cada línea
    resueltas.forEach(function (l) {
      if (disp[l.clave]) l.precio_cva = disp[l.clave].precio || 0;
    });

    // Elegir mejor sucursal
    var mejor = elegirMejorSucursal(resueltas, disp);

    // Para cada línea, qué stock tiene en la sucursal recomendada
    resueltas.forEach(function (l) {
      var sucs = (disp[l.clave] && disp[l.clave].sucursales) || {};
      l.stock_sucursal = (sucs[mejor.codigo] && sucs[mejor.codigo].existencia) || 0;
    });

    return {
      ok: true,
      venta: { name: venta.name, partner: venta.partner, fecha: venta.fecha, total: venta.total },
      lineas: resueltas,
      sin_clave: sinClave,
      sucursal: mejor,
      disp_completa: disp
    };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ════════════════════════════════════════════════════════════════
//  PÚBLICA: Crear el pedido en CVA y registrar en historial
//  body = { so_name, codigo_sucursal, productos: [{clave, cantidad}], test }
// ════════════════════════════════════════════════════════════════
function generarPedidoCVADesdeSO(body) {
  try {
    if (!body || !body.productos || !body.productos.length) {
      return { ok: false, error: 'No hay productos para enviar.' };
    }
    var soName = body.so_name || '';
    var test = !!body.test;

    // Llamar cvaCrearOrden (reusa función existente)
    var resp = cvaCrearOrden({
      productos: body.productos.map(function (p) {
        return { clave: p.clave, cantidad: parseInt(p.cantidad) || 1 };
      }),
      num_oc: soName,
      codigo_sucursal: body.codigo_sucursal || CFG.CVA_SUCURSAL,
      tipo_flete: 'SF',           // siempre sucursal — la guía se adjunta aparte
      observaciones: 'Dropship Electronics México · SO: ' + soName,
      test: test ? 1 : 0
    });

    if (!resp || resp.ok === false) {
      return { ok: false, error: 'CVA respondió con error: ' + JSON.stringify(resp) };
    }

    var nmxt   = resp.pedido || resp.NMXT || '';
    var monto  = parseFloat(resp.total) || 0;
    var moneda = resp.moneda || 'MXN';
    var iva    = parseFloat(resp.iva) || (monto * 0.16 / 1.16);
    var neto   = monto - iva;

    // Registrar en historial
    if (!test && nmxt) {
      var sh = _hojaPedidosCVAHistorial_();
      var lineasJSON = JSON.stringify(body.productos.map(function (p) {
        return { clave: p.clave, cantidad: p.cantidad };
      }));
      sh.appendRow([
        nmxt, soName, new Date(), body.codigo_sucursal || CFG.CVA_SUCURSAL,
        neto, iva, monto, 'PENDIENTE', '', '', '', lineasJSON
      ]);
    }

    return {
      ok: true,
      nmxt: nmxt,
      total: monto,
      iva: iva,
      neto: neto,
      moneda: moneda,
      test: test,
      raw: resp
    };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ════════════════════════════════════════════════════════════════
//  PÚBLICA: subir guía a un pedido CVA y guardarla en Drive
//  body = { nmxt, carrier, waybills, pdf_base64 (sin prefijo data:), filename }
// ════════════════════════════════════════════════════════════════
function subirGuiaPedidoCVA(body) {
  try {
    if (!body || !body.nmxt) return { ok: false, error: 'Falta NMXT' };
    if (!body.waybills) return { ok: false, error: 'Falta número de guía' };
    if (!body.carrier) return { ok: false, error: 'Falta paquetería' };

    // 1) Llamar a CVA para registrar la guía
    var resp = cvaEnviarGuia({
      order_number: body.nmxt,
      waybills: body.waybills,
      carrier: body.carrier,
      pdf_base64: body.pdf_base64 || ''
    });
    if (!resp || resp.ok === false) {
      return { ok: false, error: 'CVA rechazó la guía: ' + JSON.stringify(resp) };
    }

    // 2) Si hay PDF, guardarlo en Drive y registrar URL
    var urlPDF = '';
    if (body.pdf_base64) {
      try {
        var folder = DriveApp.getFolderById('1fN7Oi7k4ZdWjnev7-HhV8H3LLl1ZEhHv');
        // Subcarpeta GUIAS
        var subIter = folder.getFoldersByName('GUIAS');
        var subFolder = subIter.hasNext() ? subIter.next() : folder.createFolder('GUIAS');
        var bytes = Utilities.base64Decode(body.pdf_base64);
        var blob = Utilities.newBlob(bytes, 'application/pdf',
          (body.filename || (body.nmxt + '_' + body.waybills + '.pdf')));
        var file = subFolder.createFile(blob);
        urlPDF = file.getUrl();
      } catch (e) { Logger.log('Drive guía: ' + e.message); }
    }

    // 3) Actualizar fila en PEDIDOS_CVA_HISTORIAL
    try {
      var sh = _hojaPedidosCVAHistorial_();
      var last = sh.getLastRow();
      if (last >= 2) {
        var col1 = sh.getRange(2, 1, last - 1, 1).getValues();
        for (var i = 0; i < col1.length; i++) {
          if (String(col1[i][0] || '').trim() === body.nmxt) {
            sh.getRange(i + 2, 8).setValue('CON GUIA');                                  // H Estado
            sh.getRange(i + 2, 9).setValue(body.carrier + ' · ' + body.waybills);        // I Guía
            sh.getRange(i + 2, 10).setValue(body.waybills);                              // J Tracking
            if (urlPDF) sh.getRange(i + 2, 11).setValue(urlPDF);                         // K URL guía PDF
            break;
          }
        }
      }
    } catch (e) { Logger.log('Update historial guía: ' + e.message); }

    return { ok: true, nmxt: body.nmxt, waybills: body.waybills, carrier: body.carrier, pdf_url: urlPDF };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ════════════════════════════════════════════════════════════════
//  PÚBLICA: listar historial de pedidos (para la pantalla Historial CVA)
// ════════════════════════════════════════════════════════════════
function listarHistorialPedidosCVA(opts) {
  try {
    opts = opts || {};
    var sh = _hojaPedidosCVAHistorial_();
    var last = sh.getLastRow();
    if (last < 2) return { ok: true, pedidos: [] };
    var data = sh.getRange(2, 1, last - 1, 12).getValues();
    var pedidos = data.map(function (r) {
      return {
        nmxt:    String(r[0] || '').trim(),
        so:      String(r[1] || '').trim(),
        fecha:   r[2] instanceof Date ? r[2].toISOString() : String(r[2] || ''),
        sucursal: r[3] || '',
        neto:    parseFloat(r[4]) || 0,
        iva:     parseFloat(r[5]) || 0,
        total:   parseFloat(r[6]) || 0,
        estado:  String(r[7] || '').trim(),
        guia:    String(r[8] || '').trim(),
        tracking: String(r[9] || '').trim(),
        url_pdf: String(r[10] || '').trim(),
        lineas_json: String(r[11] || '').trim()
      };
    }).filter(function (p) { return p.nmxt; });
    // Más recientes primero
    pedidos.sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
    var limit = parseInt(opts.limit) || 100;
    return { ok: true, pedidos: pedidos.slice(0, limit) };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ════════════════════════════════════════════════════════════════
//  PANTALLAS + menú
// ════════════════════════════════════════════════════════════════
function htmlPedidoCVA() {
  return HtmlService.createTemplateFromFile('pedidoCvaUI').evaluate()
    .setTitle('Pedido CVA')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function htmlHistorialCVA() {
  return HtmlService.createTemplateFromFile('historialCvaUI').evaluate()
    .setTitle('Historial CVA')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function abrirPedidoCVA() {
  var html = HtmlService.createTemplateFromFile('pedidoCvaUI').evaluate()
    .setWidth(1280).setHeight(820);
  SpreadsheetApp.getUi().showModalDialog(html, 'Pedido CVA');
}

function abrirHistorialCVA() {
  var html = HtmlService.createTemplateFromFile('historialCvaUI').evaluate()
    .setWidth(1280).setHeight(820);
  SpreadsheetApp.getUi().showModalDialog(html, 'Historial CVA');
}