import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BASE = Deno.env.get("CHESS_BASE")!;
const USER = Deno.env.get("CHESS_USER")!;
const PASS = Deno.env.get("CHESS_PASSWORD")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

// ── Login via Spring Security (igual que la edge function que funciona) ────────
async function loginAndGetCookie(): Promise<string> {
  const form = new URLSearchParams();
  form.set("j_username", USER);
  form.set("j_password", PASS);

  const resp = await fetch(`${BASE}/static/auth/j_spring_security_check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json, text/plain, */*",
    },
    body: form.toString(),
    redirect: "manual",
  });

  const setCookie = resp.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/JSESSIONID=([^;]+)/i);
  if (!match?.[1]) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Login fallido. Status=${resp.status}. Body=${txt.slice(0, 300)}`);
  }
  return `JSESSIONID=${match[1]}`;
}

function makeHeaders(cookie: string): Record<string, string> {
  return {
    "Cookie": cookie,
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    "Connection": "close",
    "User-Agent": "Mozilla/5.0",
    "X-Requested-With": "XMLHttpRequest",
    "Origin": BASE,
    "Referer": BASE + "/",
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function normInt(v: unknown, d = 0): number {
  if (v === null || v === undefined || v === "" || v === "null") return d;
  const n = parseInt(String(v));
  return isNaN(n) ? d : n;
}

function normFloat(v: unknown, d = 0): number {
  if (v === null || v === undefined || v === "" || v === "null") return d;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? d : n;
}

function parseFecha(f: string): string {
  // D/M/YYYY o DD/MM/YYYY → YYYY-MM-DD
  const p = f.split("/");
  return `${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
}

function buscarVendedor(raw: Record<string, unknown>, idfv: number) {
  const vendedores = (raw?.dsDatosPedido as any)?.eVendedorFuerzaVenta ?? [];
  for (const v of vendedores) {
    if (normInt(v.idfuerzaventas, -1) === idfv && v.defecto && !v.anulado)
      return { c_perso: normInt(v.c_perso, 17), d_perso: v.d_perso ?? "" };
  }
  for (const v of vendedores) {
    if (normInt(v.idfuerzaventas, -1) === idfv && !v.anulado)
      return { c_perso: normInt(v.c_perso, 17), d_perso: v.d_perso ?? "" };
  }
  return { c_perso: 17, d_perso: "" };
}

// ── Obtener datos del cliente ──────────────────────────────────────────────────
async function obtenerCliente(cookie: string, idcliente: number, idclialias: number) {
  const url = `${BASE}/web/api/pedidos/obtenerDatosPedido?picli=${idcliente}&pialias=${idclialias}`;
  const resp = await fetch(url, { headers: makeHeaders(cookie) });
  if (!resp.ok) throw new Error(`obtenerDatosPedido error ${resp.status}`);
  
  const raw = await resp.json() as Record<string, any>;
  const cliente = raw.dsDatosPedido.eClientes[0] as Record<string, any>;

  // Enriquecer con eClialias (igual que el script Python que funciona)
  try {
    const alias = raw.dsDatosPedido.eClialias[0] as Record<string, any>;
    for (const [k, v] of Object.entries(alias)) {
      if (!(k in cliente) || cliente[k] === null || cliente[k] === "" || cliente[k] === 0) {
        cliente[k] = v;
      }
    }
  } catch { /* sin alias */ }

  // Resolver vendedor si falta
  const idfv = normInt(cliente.idfuerzaventas, 1);
  if ([null, "", 0, "0", "null"].includes(cliente.c_perso)) {
    const vend = buscarVendedor(raw, idfv);
    cliente.c_perso = vend.c_perso;
    cliente.d_perso = vend.d_perso;
  }

  return cliente;
}

// ── Construir cabecera (fiel al script Python) ─────────────────────────────────
function construirCabecera(cliente: Record<string, any>, fecentre: string, overrides: Record<string, unknown>) {
  const ov: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(overrides ?? {})) ov[k.toLowerCase()] = v;
  const fec = parseFecha(fecentre);
  return {
    idcliente:      normInt(cliente.idcliente),
    idclialias:     normInt(cliente.idclialias),
    nomcli:         cliente.nomcli ?? "",
    nropedido:      0,
    iddocumento:    ov.iddocumento ?? cliente.iddocumento ?? "PRVTA",
    letra:          "P",
    idComp:         "P",
    codlipre:       normInt(ov.codlipre ?? cliente.codlipre, 1),
    dslistapre:     "LISTA 1",
    tipopago:       normInt(ov.tipopago ?? cliente.tipopago, 2),
    dstipopago:     "CONTADO",
    tipoiva:        cliente.tipoiva ?? "RI",
    idrechazo:      "",
    dsmotivo:       "",
    fechafac:       fec,
    fecentre:       fec,
    fecvence:       fec,
    idempresa:      normInt(ov.idempresa, 1),
    firma:          "VAFOOD SRL",
    idSucur:        normInt(ov.idsucur, 1),
    desSucur:       "CASA CENTRAL",
    idDepo:         normInt(ov.iddepo, 1),
    desDepo:        "CASA CENTRAL",
    idfuerzaventas: normInt(ov.idfuerzaventas ?? cliente.idfuerzaventas, 1),
    dsfuerzaventas: "ESQUEMA UNICO",
    c_perso:        normInt(ov.c_perso ?? cliente.c_perso, 17),
    d_perso:        cliente.d_perso ?? "",
    idmovcomercial: null,
    lineacreditoid: normInt(cliente.lineacreditoid, 1),
    bruto:0, bonif:0, internos:0, iva1:0, iva2:0,
    per212:0, per3337:0, perib:0, netogra:0, netoper:0, nograva:0, valtot:0,
  };
}

// ── Construir lineas (fiel al script Python que funciona) ──────────────────────
function construirLineas(renglones: any[]) {
  return renglones.map((r, i) => {
    const bonifpct = normFloat(r.bonifpct);
    const motivo   = normInt(r.motivo);
    if (bonifpct && !motivo) throw new Error(`Art ${r.codart}: bonifpct requiere motivo`);
    return {
      idlinea: i+1, idlinint: i+1,
      tipolin: "", concepto: "", codpromo: "", cambio: "",
      inmodif: false,
      codart:  String(r.codart),        // STRING — crítico
      codbarra:"", descrip: "",
      idempmatriz: 1, buscadorart: "",
      pallets: 0,
      cant:    String(normFloat(r.cant)), // STRING — crítico
      resto:0, bultosReal: normFloat(r.cant),
      bonif:0, bonifpct,
      motivo:  motivo ? String(motivo) : "", // STRING vacío si no hay
      anulado:false, retenido:false, motretenido:"",
      confirmada:false, checkLineasAnuladas:false,
      ordenweb: i+1,
      precio:0, precioFinal:"",
      bltxplt:1, presentacion:1,
      exento:false, pesable:true, peso:0,
      rangod:0, rangoh:0, combo:false, idpadre:0,
      visibilidad:"LineaVisible",
      abierta:false, expandido:false, comodat:false, activofijo:false,
      numerosserie:"", numerosactivo:"",
      tasaint:0, tasaiva:21, internosfij:0,
      stkcant:0, stkresto:0, stock:"0.000", stockbkp:"",
      iva1:0, iva2:0, internos:0, per212:0, per3337:0,
      perib:0, netogra:0, nograva:0, netoper:0,
      bruto:0, neto:0, totlin:0,
      xblt_neto:0, xblt_final:0, xuni_neto:0, xuni_final:0,
      estado:"", derivada:false, idlineacredito:1,
      idpresentacion:0, vacio:false, tmpDetlin:[],
    };
  });
}

// ── confirmarPedido con ReadableStream (Deno no tiene stream=True pero sí body) ─
async function confirmarPedido(cookie: string, payload: unknown): Promise<Record<string, any>> {
  const resp = await fetch(`${BASE}/web/api/pedidos/confirmarPedido`, {
    method: "POST",
    headers: makeHeaders(cookie),
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`confirmarPedido error ${resp.status}: ${txt.slice(0, 300)}`);
  }

  // Leer el body completo (Deno maneja chunked automáticamente)
  const txt = await resp.text();
  if (!txt) throw new Error("confirmarPedido no devolvió body");
  
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error(`confirmarPedido no devolvió JSON válido: ${txt.slice(0, 300)}`);
  }
}

// ── Handler principal ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ error: "Método no permitido" }, 405);

  const logs: string[] = [];

  try {
    const body = await req.json();
    const pedido = body.pedido as Record<string, any>;
    if (!pedido) throw new Error("Falta el campo 'pedido' en el body");

    // 1. Login
    logs.push("Conectando al ERP...");
    const cookie = await loginAndGetCookie();
    logs.push("Login OK");

    // 2. Datos del cliente
    const idcliente  = normInt(pedido.idcliente);
    const idclialias = normInt(pedido.idclialias, 1);
    logs.push(`Obteniendo cliente ${idcliente}...`);
    const cliente = await obtenerCliente(cookie, idcliente, idclialias);
    logs.push(`Cliente: ${cliente.nomcli ?? idcliente}`);

    // 3. Construir estructuras
    const cabecera = construirCabecera(cliente, pedido.fecentre, pedido.overrides ?? {});
    const lineas   = construirLineas(pedido.renglones ?? []);

    const dsInicial = {
      tmpmascara: [cabecera],
      tmplineas:  lineas,
      tmpdetrel:  [],
      tmpreldoc:  [],
    };

    // 4. PASO 1: verificar (plsoloverifica=True)
    logs.push("Verificando pedido (paso 1/2)...");
    const respVer = await confirmarPedido(cookie, {
      dsTmpmascara:   dsInicial,
      ePromosApli:    [],
      plsoloverifica: true,
      plReaplica:     false,
    });

    const errVer = (respVer.error ?? []).filter((e: any) => e.tipo === "E");
    if (errVer.length > 0) throw new Error("Error verificar: " + errVer.map((e: any) => e.mensaje).join("; "));

    const dsVer   = respVer.dsTmpmascara;
    const ePromos = respVer.ePromosApli ?? [];
    if (!dsVer) throw new Error("La verificación no devolvió dsTmpmascara");
    logs.push(`Verificado OK — promos: ${ePromos.length}`);

    // 5. PASO 2: confirmar/grabar (plsoloverifica=False)
    logs.push("Grabando pedido (paso 2/2)...");
    const respConf = await confirmarPedido(cookie, {
      dsTmpmascara:   dsVer,
      ePromosApli:    ePromos,
      plsoloverifica: false,
      plReaplica:     false,
    });

    // Advertencias no fatales
    for (const e of (respConf.error ?? [])) {
      if (e.tipo === "E") logs.push(`Advertencia: ${e.mensaje}`);
    }

    // Extraer nropedido
    const dsFinal   = respConf.dsTmpmascara ?? {};
    const mascara   = dsFinal.tmpMascara ?? dsFinal.tmpmascara ?? [{}];
    const nropedido = mascara[0]?.nropedido ?? "?";

    logs.push(`Pedido #${nropedido} grabado OK`);

    return jsonResp({ success: true, nropedido: String(nropedido), logs });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logs.push(`Error: ${msg}`);
    return jsonResp({ success: false, error: msg, logs, nropedido: "" });
  }
});
