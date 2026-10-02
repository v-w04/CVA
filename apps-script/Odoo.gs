// ============================================================
//  odoo.gs · Integración Odoo XML-RPC
// ============================================================

// ── AUTH ─────────────────────────────────────────────────────
function autenticarXMLRPC_() {
  const creds = getCreds_();
  const uid = xmlrpcCall_(
    CFG.ODOO_URL + "/xmlrpc/2/common",
    "authenticate",
    [CFG.ODOO_DB, creds.ODOO_USER, creds.ODOO_KEY, {}]
  );
  if (!uid || typeof uid !== "number") throw new Error("❌ Error autenticando en Odoo");
  return uid;
}

// Helper para ejecutar calls autenticadas
function odooExec_(uid, model, method, args, kwargs) {
  const creds = getCreds_();
  return xmlrpcCall_(CFG.ODOO_URL + "/xmlrpc/2/object", "execute_kw", [
    CFG.ODOO_DB, uid, creds.ODOO_KEY, model, method, args, kwargs || {}
  ]);
}

// ── VENTAS PENDIENTES DE DROPSHIP ────────────────────────────
//
// Antes este filtro usaba el campo personalizado `x_studio_dropship_cva`
// (booleano que marcabas a mano cuando una venta ya fue procesada con CVA).
// Ese campo fue eliminado de tu Odoo, así que las referencias se quitaron
// y ahora se traen todas las ventas en estado 'sale' o 'done'.
//
// Para distinguir cuáles ya tienen orden CVA creada, cruza el resultado
// con la hoja PEDIDOS_CVA en el sheet (campo num_oc).
//
// Si quieres volver a tener el flag: recrea el campo en Odoo Studio
// (Settings → Studio → Sale Order → Boolean field) y descomenta las
// líneas marcadas como "// REACTIVAR FLAG DROPSHIP".
function odooVentasPendientes(opts) {
  const uid = autenticarXMLRPC_();
  const ids = odooExec_(uid, "sale.order", "search", [[
    ["state", "in", ["sale", "done"]],
    // ["x_studio_dropship_cva", "=", false],   // REACTIVAR FLAG DROPSHIP
  ]], { limit: parseInt(opts.limit) || 50 });
  if (!ids || ids.length === 0) return { ok: true, ventas: [] };
  const ventas = odooExec_(uid, "sale.order", "read", [ids],
    { fields: ["name","partner_id","amount_total","state","date_order","order_line"
      // ,"x_studio_dropship_cva"   // REACTIVAR FLAG DROPSHIP
    ] });
  return { ok: true, ventas };
}

// ── BUSCAR PRODUCTO POR CLAVE CVA ────────────────────────────
function oodooBuscarProducto(claveCVA) {
  if (!claveCVA) throw new Error("Se requiere clave CVA");
  const uid = autenticarXMLRPC_();

  // 1) Intento por coincidencia EXACTA de default_code
  let ids = odooExec_(uid, "product.product", "search", [[["default_code", "=", claveCVA]]], { limit: 1 });

  // 2) Si no hay exacto, buscar PARCIAL en default_code o nombre (hasta 25)
  let multiple = false;
  if (!ids || ids.length === 0) {
    ids = odooExec_(uid, "product.product", "search", [[
      "|",
      ["default_code", "ilike", claveCVA],
      ["name",         "ilike", claveCVA]
    ]], { limit: 25, order: "default_code asc" });
    multiple = true;
  }

  if (!ids || ids.length === 0) return { ok: true, encontrado: false };

  const prods = odooExec_(uid, "product.product", "read", [ids],
    { fields: ["id","name","default_code","list_price","qty_available","virtual_available"] });

  // Un solo resultado (exacto o único parcial) → forma clásica
  if (prods.length === 1) {
    return { ok: true, encontrado: true, producto: prods[0] };
  }

  // Varios resultados → devolver lista + el primero como principal
  return { ok: true, encontrado: true, multiple: true, total: prods.length,
           producto: prods[0], productos: prods };
}

// ── STOCK DE UN PRODUCTO ─────────────────────────────────────
function odooStock(claveCVA) {
  if (!claveCVA) throw new Error("Se requiere clave");
  const uid = autenticarXMLRPC_();
  const ids = odooExec_(uid, "product.product", "search", [[["default_code", "=", claveCVA]]], { limit: 1 });
  if (!ids || ids.length === 0) return { ok: true, qty: 0, encontrado: false };
  const prods = odooExec_(uid, "product.product", "read", [ids],
    { fields: ["qty_available","virtual_available","incoming_qty"] });
  return { ok: true, encontrado: true, ...prods[0] };
}

// ── CREAR PURCHASE ORDER EN ODOO ────────────────────────────
function odooCrearPO(body) {
  const { num_pedido_cva, num_oc, productos, total_cva, moneda } = body;
  const uid = autenticarXMLRPC_();
  const provIds = odooExec_(uid, "res.partner", "search", [[["name", "ilike", "CVA"]]], { limit: 1 });
  const provId = provIds && provIds.length > 0 ? provIds[0] : false;
  const poId = odooExec_(uid, "purchase.order", "create", [{
    partner_id : provId || false,
    partner_ref: num_pedido_cva,
    notes      : "Dropship CVA · OC: " + (num_oc || ""),
    origin     : num_oc || "",
  }]);
  for (const p of (productos || [])) {
    const prodIds = odooExec_(uid, "product.product", "search", [[["default_code", "=", p.clave]]], { limit: 1 });
    if (!prodIds || prodIds.length === 0) { Logger.log("⚠️ No encontrado: " + p.clave); continue; }
    odooExec_(uid, "purchase.order.line", "create", [{
      order_id   : poId,
      product_id : prodIds[0],
      product_qty: parseFloat(p.cantidad) || 1,
      price_unit : parseFloat(p.precio)   || 0,
      name       : p.descripcion || p.clave,
    }]);
  }
  logSheet_("PEDIDOS_CVA", [num_oc||"", num_pedido_cva||"", total_cva||"", moneda||"", "FF", "PO_CREADA", "odoo_po_id:"+poId]);
  return { ok: true, po_id: poId, pedido_cva: num_pedido_cva };
}

// ── ACTUALIZAR ESTATUS PO ────────────────────────────────────
function actualizarEstatusPOOdoo_(uid, numOC, estado, facturaCVA) {
  const poIds = odooExec_(uid, "purchase.order", "search", [[["origin", "=", numOC]]], { limit: 1 });
  if (!poIds || poIds.length === 0) { Logger.log("⚠️ PO no encontrada: " + numOC); return false; }
  odooExec_(uid, "purchase.order", "write", [[poIds[0]], {
    notes: "Dropship CVA · Factura: " + facturaCVA + " · " + new Date().toISOString(),
  }]);
  return true;
}

// ── CONFIRMAR PO ─────────────────────────────────────────────
function odooConfirmarPO(body) {
  const { po_id } = body;
  if (!po_id) throw new Error("Se requiere po_id");
  const uid = autenticarXMLRPC_();
  odooExec_(uid, "purchase.order", "button_confirm", [[parseInt(po_id)]]);
  return { ok: true, confirmada: true, po_id };
}

// ── STOCK EN BODEGA CVA ──────────────────────────────────────
function odooStockBodegaCVA(claveCVA) {
  if (!claveCVA) throw new Error("Se requiere clave CVA");
  const uid = autenticarXMLRPC_();
  const prodIds = odooExec_(uid, "product.product", "search", [[["default_code", "=", claveCVA]]], { limit: 1 });
  if (!prodIds || prodIds.length === 0) return { ok: true, encontrado: false, qty: 0 };
  const quants = odooExec_(uid, "stock.quant", "search_read",
    [[["product_id", "=", prodIds[0]], ["location_id", "=", CFG.ODOO_BODEGA_CVA_ID]]],
    { fields: ["quantity","reserved_quantity","location_id"] });
  const qty = quants.reduce((s, q) => s + (q.quantity - q.reserved_quantity), 0);
  return { ok: true, encontrado: true, producto_id: prodIds[0], qty, quants };
}

// ── RECIBIR EN BODEGA CVA ────────────────────────────────────
function odooRecibirEnBodegaCVA(po_id) {
  if (!po_id) throw new Error("Se requiere po_id");
  const uid = autenticarXMLRPC_();
  const pickIds = odooExec_(uid, "stock.picking", "search",
    [[["purchase_id", "=", parseInt(po_id)], ["state", "in", ["assigned","confirmed"]]]]);
  if (!pickIds || pickIds.length === 0) return { ok: true, mensaje: "Sin pickings pendientes" };
  for (const pickId of pickIds) {
    odooExec_(uid, "stock.picking", "action_assign", [[pickId]]);
    odooExec_(uid, "stock.picking", "button_validate", [[pickId]]);
  }
  logSheet_("SYNC_LOG", ["RECEPCION_CVA", po_id, pickIds.join(",")]);
  return { ok: true, pickings_validados: pickIds };
}

// ── ACTUALIZAR PRECIO ────────────────────────────────────────
function odooActualizarPrecio(claveCVA, precio, moneda) {
  if (!claveCVA || !precio) throw new Error("Se requieren claveCVA y precio");
  const uid = autenticarXMLRPC_();
  const prodIds = odooExec_(uid, "product.product", "search", [[["default_code", "=", claveCVA]]], { limit: 1 });
  if (!prodIds || prodIds.length === 0) return { ok: false, error: "No encontrado: " + claveCVA };
  const prod = odooExec_(uid, "product.product", "read", [prodIds], { fields: ["product_tmpl_id"] });
  const tmplId = prod[0].product_tmpl_id[0];
  odooExec_(uid, "product.template", "write", [[tmplId], { standard_price: parseFloat(precio) }]);
  return { ok: true, claveCVA, precio, tmplId };
}

// ── VENTAS PENDIENTES DROPSHIP ───────────────────────────────
//
// Filtra solo ventas que tengan al menos un producto con default_code
// terminando en "-CVA" (que es como marcas los productos dropship CVA
// en Odoo). Si no hay ninguna venta así, devuelve array vacío.
//
// Para cada venta, también trae el estado del picking principal
// (En espera, Listo, Hecho, Cancelado) y la guía de rastreo, que es
// lo que realmente quieres ver, no el estado "sale" genérico.
function odooVentasPendientesDropship(opts) {
  const uid = autenticarXMLRPC_();

  // 1) Productos cuyo default_code termina en "-CVA"
  const prodIds = odooExec_(uid, "product.product", "search", [[
    ["default_code", "=like", "%-CVA"]
  ]], { limit: 5000 });

  if (!prodIds || prodIds.length === 0) return { ok: true, ventas: [], info: "Sin productos -CVA en Odoo" };

  // 2) Líneas de venta con esos productos — SIN filtro de estado
  //    (el estado "state" de la línea refleja el de la orden padre; filtrar
  //     aquí por sale/done dejaba fuera las órdenes en borrador. Ahora se
  //     traen todas y el estado real se muestra como columna.)
  const lineIds = odooExec_(uid, "sale.order.line", "search", [[
    ["product_id", "in", prodIds]
  ]], { limit: 5000, order: "id desc" });

  if (!lineIds || lineIds.length === 0) return { ok: true, ventas: [] };

  // 3) Leer las líneas → órdenes únicas
  const lines = odooExec_(uid, "sale.order.line", "read", [lineIds], { fields: ["order_id"] });
  const orderIds = Array.from(new Set(lines.map(l => l.order_id && l.order_id[0]).filter(Boolean)));
  if (orderIds.length === 0) return { ok: true, ventas: [] };

  // 4) Leer órdenes
  const limit = parseInt(opts && opts.limit) || 200;
  const orderIdsLimited = orderIds.slice(0, limit);
  const ventas = odooExec_(uid, "sale.order", "read", [orderIdsLimited], {
    fields: ["name", "partner_id", "amount_total", "state", "date_order",
             "picking_ids", "invoice_status", "create_date"]
  });

  // 5) Traer estado y guía del picking principal de cada venta (en un solo batch)
  const allPickIds = [];
  ventas.forEach(v => (v.picking_ids || []).forEach(id => allPickIds.push(id)));

  let pickById = {};
  if (allPickIds.length > 0) {
    let picks;
    try {
      picks = odooExec_(uid, "stock.picking", "read", [allPickIds], {
        fields: ["id", "name", "state", "x_studio_guia_de_rastreo", "scheduled_date"]
      });
    } catch(e) {
      // Si el campo personalizado no existe, omitir
      picks = odooExec_(uid, "stock.picking", "read", [allPickIds], {
        fields: ["id", "name", "state", "scheduled_date"]
      });
    }
    picks.forEach(p => { pickById[p.id] = p; });
  }

  // Mapa de estado de la ORDEN (draft/sent/sale/done/cancel) → texto legible
  const _EST_ORDEN = {
    draft:  "Borrador",
    sent:   "Cotización",
    sale:   "Confirmado",
    done:   "Entregado",
    cancel: "Cancelado"
  };

  ventas.forEach(v => {
    // Estado real de la venta (orden), independiente del picking
    v.estado_orden      = v.state || "";
    v.estado_orden_txt  = _EST_ORDEN[v.state] || v.state || "—";

    const ps = (v.picking_ids || []).map(id => pickById[id]).filter(Boolean);
    // Tomar el más reciente como representativo
    if (ps.length > 0) {
      const principal = ps[0];
      v.picking_name      = principal.name || "";
      v.picking_state     = principal.state || "";
      v.guia_rastreo      = principal.x_studio_guia_de_rastreo || "";
      v.picking_scheduled = principal.scheduled_date || "";
    } else {
      v.picking_state = "";
    }
  });

  // Ordenar por fecha descendente
  ventas.sort((a, b) => String(b.date_order).localeCompare(String(a.date_order)));

  return { ok: true, ventas, total_productos_cva: prodIds.length };
}

// ── BUSCAR ID de la bodega CVA por nombre ──
//
// Antes hardcodeábamos location_id=216, pero ese ID puede ser distinto
// en tu base. Esta función encuentra la location interna cuyo nombre o
// complete_name contiene "CVA". Cachea el resultado en Script Properties
// para no repetir la búsqueda en cada call.
function _detectarBodegaCVA_(uid, forzar) {
  const props = PropertiesService.getScriptProperties();
  if (!forzar) {
    const cached = props.getProperty("ODOO_CVA_LOC_ID");
    if (cached) return parseInt(cached);
  }

  // Buscar locations internas que contengan "CVA"
  const ids = odooExec_(uid, "stock.location", "search", [[
    ["usage", "=", "internal"],
    "|",
    ["complete_name", "ilike", "CVA"],
    ["name", "ilike", "CVA"],
  ]], { limit: 10 });

  if (!ids || ids.length === 0) return null;

  // Si hay varias, leerlas y preferir "Almacén/Existencias/CVA"
  // (la más profunda, con CVA como nombre exacto)
  const locs = odooExec_(uid, "stock.location", "read", [ids], {
    fields: ["id", "name", "complete_name", "usage"]
  });

  // Prioridad: name === "CVA" > complete_name contiene "/CVA"
  locs.sort((a, b) => {
    const aExact = String(a.name || "").toUpperCase() === "CVA" ? 1 : 0;
    const bExact = String(b.name || "").toUpperCase() === "CVA" ? 1 : 0;
    return bExact - aExact;
  });

  const winner = locs[0];
  props.setProperty("ODOO_CVA_LOC_ID", String(winner.id));
  props.setProperty("ODOO_CVA_LOC_NAME", winner.complete_name || winner.name || "");
  return winner.id;
}

// ── LISTAR todas las locations internas (para debug) ──
function odooListarLocations() {
  const uid = autenticarXMLRPC_();
  const ids = odooExec_(uid, "stock.location", "search", [[
    ["usage", "=", "internal"]
  ]], { limit: 100, order: "complete_name asc" });
  if (!ids || ids.length === 0) return { ok: true, locations: [] };
  const locs = odooExec_(uid, "stock.location", "read", [ids], {
    fields: ["id", "name", "complete_name", "usage", "warehouse_id"]
  });
  return { ok: true, locations: locs };
}

// ── PICKINGS PENDIENTES (Stock Odoo · solo CVA) ──────────────
//
// Devuelve los stock.picking pendientes (no done ni cancel) cuya
// ubicación de ORIGEN o DESTINO sea la bodega CVA.
//
// La bodega CVA se autodetecta buscando una location interna con
// nombre que contenga "CVA". Se cachea en Script Properties.
//
// Si quieres ver pickings de TODO Odoo (no solo CVA), pasa &solo_cva=false.
// Si quieres forzar un ID específico, pasa &bodega_id=N.
// Si quieres re-detectar la bodega, pasa &redetectar=true.
function odooPickingsPendientes(opts) {
  const uid = autenticarXMLRPC_();
  const limit = parseInt(opts && opts.limit) || 200;
  const incluirTodos = opts && (opts.solo_cva === "false" || opts.solo_cva === false);
  const forzarRedetect = opts && opts.redetectar === "true";

  // Resolver ID de la bodega CVA: 1) si lo pasaron, 2) autodetectar, 3) fallback CFG
  let bodegaCVA = parseInt(opts && opts.bodega_id) || 0;
  let bodegaNombre = "";
  if (!bodegaCVA && !incluirTodos) {
    bodegaCVA = _detectarBodegaCVA_(uid, forzarRedetect);
    if (!bodegaCVA) {
      // Sin bodega CVA detectada — devolver mensaje claro con listado de locations
      const todasLocs = odooListarLocations().locations || [];
      return {
        ok: true,
        pickings: [],
        info: "No se encontró la bodega CVA en Odoo. Revisa el listado de locations internas y verifica que exista una con 'CVA' en el nombre.",
        bodega_cva_id: null,
        locations_disponibles: todasLocs.map(l => ({ id: l.id, nombre: l.complete_name || l.name })),
      };
    }
    bodegaNombre = PropertiesService.getScriptProperties().getProperty("ODOO_CVA_LOC_NAME") || "";
  }

  let dom;
  if (incluirTodos) {
    dom = [["state", "in", ["draft", "waiting", "confirmed", "assigned"]]];
  } else {
    dom = [
      ["state", "in", ["draft", "waiting", "confirmed", "assigned"]],
      "|",
      ["location_id",      "=", bodegaCVA],
      ["location_dest_id", "=", bodegaCVA],
    ];
  }

  const ids = odooExec_(uid, "stock.picking", "search", [dom], {
    limit: limit, order: "scheduled_date desc"
  });

  if (!ids || ids.length === 0) {
    return {
      ok: true,
      pickings: [],
      info: incluirTodos
        ? "Sin pickings pendientes en Odoo"
        : "Sin pickings pendientes en la bodega CVA",
      bodega_cva_id: bodegaCVA,
      bodega_cva_nombre: bodegaNombre,
    };
  }

  let pickings;
  try {
    pickings = odooExec_(uid, "stock.picking", "read", [ids], {
      fields: ["name", "location_id", "location_dest_id", "partner_id",
               "scheduled_date", "create_date", "origin", "state",
               "x_studio_guia_de_rastreo"]
    });
  } catch(e) {
    pickings = odooExec_(uid, "stock.picking", "read", [ids], {
      fields: ["name", "location_id", "location_dest_id", "partner_id",
               "scheduled_date", "create_date", "origin", "state"]
    });
  }
  return {
    ok: true,
    pickings,
    bodega_cva_id: bodegaCVA,
    bodega_cva_nombre: bodegaNombre,
  };
}

// ── XML-RPC CLIENT ───────────────────────────────────────────
function xmlrpcCall_(url, methodName, paramsArray) {
  const xml = '<?xml version="1.0"?><methodCall><methodName>' + methodName + '</methodName><params>' +
    paramsArray.map(v => '<param>' + xmlValue_(v) + '</param>').join('') + '</params></methodCall>';
  const resp = UrlFetchApp.fetch(url, { method:"post", contentType:"text/xml", payload:xml, muteHttpExceptions:true });
  if (resp.getResponseCode() !== 200) throw new Error("HTTP " + resp.getResponseCode() + ": " + resp.getContentText());
  return parseXmlRpc_(resp.getContentText());
}

function xmlValue_(v) {
  if (v === null || v === undefined) return '<value><nil/></value>';
  if (typeof v === "number")  return '<value><int>' + v + '</int></value>';
  if (typeof v === "boolean") return '<value><boolean>' + (v ? 1 : 0) + '</boolean></value>';
  if (typeof v === "string")  return '<value><string>' + escXml_(v) + '</string></value>';
  if (Array.isArray(v)) return '<value><array><data>' + v.map(xmlValue_).join('') + '</data></array></value>';
  if (typeof v === "object") return '<value><struct>' +
    Object.keys(v).map(k => '<member><name>' + k + '</name>' + xmlValue_(v[k]) + '</member>').join('') + '</struct></value>';
  return '<value><string>' + String(v) + '</string></value>';
}

function escXml_(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function parseXmlRpc_(xmlText) {
  const doc = XmlService.parse(xmlText);
  const root = doc.getRootElement();
  const fault = root.getChild("fault");
  if (fault) throw new Error("XML-RPC Fault: " + JSON.stringify(xmlToJs_(fault.getChild("value"))));
  return xmlToJs_(root.getChild("params").getChild("param").getChild("value"));
}

function xmlToJs_(valueEl) {
  const child = valueEl.getChildren()[0];
  if (!child) return valueEl.getText();
  switch (child.getName()) {
    case "int": case "i4": return Number(child.getText());
    case "double":         return Number(child.getText());
    case "boolean":        return child.getText() === "1";
    case "string":         return child.getText();
    case "nil":            return null;
    case "array":          return child.getChild("data").getChildren("value").map(xmlToJs_);
    case "struct":
      const o = {};
      child.getChildren("member").forEach(m => {
        o[m.getChild("name").getText()] = xmlToJs_(m.getChild("value"));
      });
      return o;
    default: return valueEl.getText();
  }
}