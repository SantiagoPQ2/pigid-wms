// netlify/functions/erp-proxy.js
// Proxy para llamadas al ERP de Chess (evita CORS desde el frontend)

const https = require('https');
const http = require('http');
const url = require('url');

// ─── Helper para hacer requests HTTP ────────────────────────────────────────
function httpRequest(method, fullUrl, headers, body, cookies) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(fullUrl);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const allHeaders = {
      ...headers,
      ...(cookies ? { Cookie: cookies } : {}),
    };
    if (body) allHeaders['Content-Length'] = Buffer.byteLength(body);

    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.path,
      method,
      headers: allHeaders,
      rejectUnauthorized: false, // ERP puede tener cert autofirmado
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── Login al ERP ────────────────────────────────────────────────────────────
async function loginERP(baseUrl, usuario, password) {
  // Paso 1: Spring Security login
  const formData = `j_username=${encodeURIComponent(usuario)}&j_password=${encodeURIComponent(password)}`;
  const r1 = await httpRequest('POST',
    `${baseUrl}/static/auth/j_spring_security_check`,
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    formData
  );
  
  // Extraer JSESSIONID de las cookies
  const setCookies = Array.isArray(r1.headers['set-cookie'])
    ? r1.headers['set-cookie']
    : [r1.headers['set-cookie'] || ''];
  const jsessionid = setCookies
    .map(c => c?.split(';')[0])
    .find(c => c?.includes('JSESSIONID'));

  if (!jsessionid) throw new Error('Login fallido: no se obtuvo JSESSIONID');

  const cookieStr = jsessionid;

  // Paso 2: gestionarURL
  try {
    await httpRequest('POST',
      `${baseUrl}/web/api/sesion/gestionarURL`,
      { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      '{}', cookieStr
    );
  } catch(e) { /* ignorar */ }

  return cookieStr;
}

// ─── Llamada al ERP ──────────────────────────────────────────────────────────
async function erpRequest(baseUrl, method, endpoint, body, cookieStr) {
  const r = await httpRequest(
    method,
    `${baseUrl}${endpoint}`,
    { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body ? JSON.stringify(body) : undefined,
    cookieStr
  );
  if (!r.body) throw new Error('ERP no respondió');
  try { return JSON.parse(r.body); }
  catch(e) { throw new Error('ERP no devolvió JSON válido: ' + r.body.substring(0, 200)); }
}

// ─── Armar renglones ─────────────────────────────────────────────────────────
function armarRenglones(renglones) {
  return renglones.map((r, i) => ({
    idcabint: 0, idempresa: 0, iddocumento: '', letra: '', serie: 0, nrodoc: 0,
    idlinea: i + 1, idlinint: i + 1,
    codart: r.codart, pallets: 0, cant: r.cant, resto: 0, cantorig: 0, restoorig: 0,
    peso: 0, precio: 0, preciofinal: 0, flete: 0,
    bonifpct: r.bonifpct || 0,
    bonif: 0,
    motivo2: r.motivo || 0,
    iva1: 0, iva2: 0, per3337: 0, per212: 0, perib: 0, internos: 0,
    bruto: 0, netogra: 0, nograva: 0, exonerado: 0,
    noauto: false, descrip: '', tipolin: 'P', codpromo: 0, inmodif: false,
    derivada: false, ndocpadre: 0, idpadre: 0, expandido: false,
    numerosserie: '', numerosactivo: '', estado: '', msj: '',
    imprime: true, cuentayorden: false, codprovcyo: 0, totlin: 0,
    idorigen: '', anulado: false,
  }));
}

// ─── Handler principal ───────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };

  try {
    const { action, erp_base, usuario, password, pedido } = JSON.parse(event.body || '{}');

    // Usar variables de entorno del servidor (más seguro)
    const baseUrl = process.env.ERP_BASE_URL || erp_base || 'http://appserver29.dyndns.org:8094';
    const user    = process.env.ERP_USUARIO  || usuario;
    const pass    = process.env.ERP_PASSWORD  || password;

    if (!user || !pass) throw new Error('Credenciales ERP no configuradas en variables de entorno');
    if (action !== 'cargar_pedido') throw new Error('Acción no válida');

    const logs = [];

    // 1. Login
    logs.push('Conectando al ERP...');
    const cookieStr = await loginERP(baseUrl, user, pass);
    logs.push('Login OK');

    // 2. Obtener datos del cliente
    logs.push(`Obteniendo datos del cliente ${pedido.idcliente}...`);
    const datosCliente = await erpRequest(
      baseUrl, 'GET',
      `/web/api/pedidos/obtenerDatosPedido?picli=${pedido.idcliente}&pialias=${pedido.idclialias}`,
      null, cookieStr
    );
    if (datosCliente.error) throw new Error('Error cliente: ' + datosCliente.error);
    const cliente = datosCliente?.dsDatosPedido?.eClientes?.[0];
    if (!cliente) throw new Error('Cliente ' + pedido.idcliente + ' no encontrado');
    logs.push('Cliente: ' + (cliente.nomcli || ''));

    // 3. Armar fecha
    const [d, m, y] = pedido.fecentre.split('/');
    const fec = `${y}-${m}-${d}`;
    const hoy = new Date().toISOString().split('T')[0];

    // 4. Armar payload
    const ov = pedido.overrides || {};
    const tmpmascara = {
      idcliente: cliente.idcliente, idclialias: cliente.idclialias,
      nomcli: cliente.nomcli || '', nropedido: 0,
      iddocumento: ov.iddocumento || 'PRVTA',
      letra: cliente.letra || 'P', idComp: cliente.idComp || 'P',
      codlipre: ov.codlipre || 1, dslistapre: cliente.dslistapre || '',
      tipopago: ov.tipopago || 2, dstipopago: cliente.dstipopago || '',
      tipoiva: cliente.tipoiva || 'NC', idrechazo: '', dsmotivo: '',
      fechafac: hoy, fecentre: fec, fecvence: fec,
      idempresa: ov.idempresa || 1, firma: 'VAFOOD SRL',
      idSucur: ov.idsucur || 1, desSucur: cliente.desSucur || '',
      idDepo: ov.iddepo || 1, desDepo: cliente.desDepo || '',
      idfuerzaventas: ov.idfuerzaventas || 1, dsfuerzaventas: cliente.dsfuerzaventas || '',
      c_perso: ov.c_perso || 0, d_perso: cliente.d_perso || '',
      idmovcomercial: null, lineacreditoid: cliente.lineacreditoid || 1,
      bruto: 0, bonif: 0, internos: 0, iva1: 0, iva2: 0,
      per212: 0, per3337: 0, perib: 0, netogra: 0, netoper: 0, nograva: 0, valtot: 0,
    };

    const payloadBase = {
      dsTmpmascara: {
        tmpmascara: [tmpmascara],
        tmplineas: armarRenglones(pedido.renglones),
        tmpdetrel: [], tmpreldoc: [],
      },
      ePromosApli: [], plsoloverifica: false, plReaplica: false,
    };

    // 5. F8 - aplicar precios y promociones
    logs.push('Aplicando precios y promociones (F8)...');
    const respF8 = await erpRequest(baseUrl, 'POST', '/web/api/pedidos/confirmarPedido',
      { ...payloadBase, plReaplica: true }, cookieStr
    );
    const errF8 = (respF8.error || []).filter(e => e.tipo === 'E');
    if (errF8.length > 0) throw new Error('Error F8: ' + errF8.map(e => e.mensaje).join(', '));
    logs.push('Precios aplicados OK');

    // 6. F5 - grabar pedido
    logs.push('Grabando pedido (F5)...');
    const payloadF5 = {
      dsTmpmascara: respF8.dsTmpmascara,
      ePromosApli: respF8.ePromosApli || [],
      plsoloverifica: false, plReaplica: false,
    };
    const respF5 = await erpRequest(baseUrl, 'POST', '/web/api/pedidos/confirmarPedido', payloadF5, cookieStr);

    // Advertencias F5 (no son errores fatales)
    const advert = (respF5.error || []).filter(e => e.tipo === 'E');
    if (advert.length > 0) advert.forEach(a => logs.push('⚠ ' + a.mensaje));

    const nropedido = respF5?.dsTmpmascara?.tmpMascara?.[0]?.nropedido
      || respF5?.dsTmpmascara?.tmpmascara?.[0]?.nropedido || '?';

    logs.push('Pedido grabado: #' + nropedido);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, nropedido, logs }),
    };

  } catch (err) {
    return {
      statusCode: 200, headers, // 200 para que el frontend lea el error
      body: JSON.stringify({ success: false, error: String(err), nropedido: '' }),
    };
  }
};
