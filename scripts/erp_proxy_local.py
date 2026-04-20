#!/usr/bin/env python3
"""
PIGID WMS - Proxy Local ERP Chess v2
======================================
Usa el flujo REAL que funciona:
  1. Login via /web/api/chess/v1/auth/login  (devuelve sessionId como Cookie)
  2. GET obtenerDatosPedido
  3. POST confirmarPedido (plsoloverifica=True)   <- verificar
  4. POST confirmarPedido (plsoloverifica=False)  <- confirmar/guardar

INSTALACIÓN:
    pip install flask flask-cors requests

USO:
    python scripts/erp_proxy_local.py

Queda en http://localhost:5001 — PIGID lo detecta automáticamente.
"""

from __future__ import annotations
import os, json
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from requests.exceptions import ChunkedEncodingError

app = Flask(__name__)
CORS(app)

# ── Configuración ──────────────────────────────────────────────────────────────
BASE     = os.environ.get("ERP_BASE_URL", "http://appserver29.dyndns.org:8094")
USUARIO  = os.environ.get("ERP_USUARIO",  "DANGULO")
PASSWORD = os.environ.get("ERP_PASSWORD", "Chelsea2009.")

HEADERS_JSON = {
    "Accept":       "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    "Connection":   "close",
    "User-Agent":   "Mozilla/5.0",
    "X-Requested-With": "XMLHttpRequest",
    "Origin":   BASE,
    "Referer":  BASE + "/",
}

# ── Sesión con caché ───────────────────────────────────────────────────────────
_cookie_str: str | None = None
_cookie_ts:  float      = 0
SESSION_TTL = 300  # segundos

def get_cookie() -> str:
    global _cookie_str, _cookie_ts
    ahora = datetime.now().timestamp()
    if _cookie_str and (ahora - _cookie_ts) < SESSION_TTL:
        return _cookie_str

    print(f"  [ERP] Login como {USUARIO}...")
    r = requests.post(
        f"{BASE}/web/api/chess/v1/auth/login",
        json={"usuario": USUARIO, "password": PASSWORD},
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Connection": "close",
            "User-Agent": "Mozilla/5.0",
        },
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    sid = data.get("sessionId")
    if not sid:
        raise RuntimeError(f"No se recibió sessionId. Respuesta: {data}")

    _cookie_str = f"sessionId={sid}"
    _cookie_ts  = ahora
    print(f"  [ERP] Login OK — sessionId: {sid[:20]}...")
    return _cookie_str


def make_headers(cookie: str) -> dict:
    return {**HEADERS_JSON, "Cookie": cookie}


# ── Helpers ────────────────────────────────────────────────────────────────────
def norm_int(v, d=0) -> int:
    try:
        return int(v) if v not in (None, "", "null") else d
    except: return d

def norm_float(v, d=0.0) -> float:
    try:
        return float(v) if v not in (None, "", "null") else d
    except: return d

def hoy_arg() -> str:
    return datetime.now(timezone(timedelta(hours=-3))).strftime("%Y-%m-%d")

def parsear_fecha(fecentre: str) -> str:
    """D/M/YYYY o DD/MM/YYYY → YYYY-MM-DD"""
    partes = fecentre.split("/")
    d, m, y = partes[0].zfill(2), partes[1].zfill(2), partes[2]
    return f"{y}-{m}-{d}"

def buscar_vendedor(raw: dict, idfuerzaventas: int) -> dict:
    vendedores = raw.get("dsDatosPedido", {}).get("eVendedorFuerzaVenta", [])
    for v in vendedores:
        if norm_int(v.get("idfuerzaventas"), -1) == idfuerzaventas and v.get("defecto") and not v.get("anulado"):
            return {"c_perso": norm_int(v.get("c_perso"), 17), "d_perso": v.get("d_perso", "")}
    for v in vendedores:
        if norm_int(v.get("idfuerzaventas"), -1) == idfuerzaventas and not v.get("anulado"):
            return {"c_perso": norm_int(v.get("c_perso"), 17), "d_perso": v.get("d_perso", "")}
    return {"c_perso": 17, "d_perso": ""}


def post_chunked(url: str, headers: dict, payload: dict) -> dict:
    """POST tolerante a ChunkedEncodingError (igual que el script que funciona)."""
    chunks = []
    with requests.post(url, headers=headers, json=payload, timeout=120, stream=True) as r:
        r.raise_for_status()
        try:
            for chunk in r.iter_content(8192):
                if chunk: chunks.append(chunk)
        except ChunkedEncodingError:
            pass

    texto = b"".join(chunks).decode("utf-8", errors="replace")
    if not texto:
        raise RuntimeError(f"POST {url} no devolvió body")
    return json.loads(texto)


def obtener_cliente(cookie: str, idcliente: int, idclialias: int) -> tuple[dict, dict]:
    r = requests.get(
        f"{BASE}/web/api/pedidos/obtenerDatosPedido",
        headers=make_headers(cookie),
        params={"picli": idcliente, "pialias": idclialias},
        timeout=30,
    )
    r.raise_for_status()
    raw = r.json()

    cliente = raw["dsDatosPedido"]["eClientes"][0]

    # Enriquecer con datos de alias
    try:
        alias = raw["dsDatosPedido"]["eClialias"][0]
        for k, v in alias.items():
            if k not in cliente or cliente.get(k) in (None, "", 0, "0"):
                cliente[k] = v
    except: pass

    # Resolver vendedor
    idfv = norm_int(cliente.get("idfuerzaventas"), 1)
    if cliente.get("c_perso") in (None, "", 0, "0", "null"):
        vend = buscar_vendedor(raw, idfv)
        cliente["c_perso"] = vend["c_perso"]
        cliente["d_perso"] = vend["d_perso"]

    return cliente, raw


def construir_cabecera(cliente: dict, fecentre: str, overrides: dict) -> dict:
    ov = {k.lower(): v for k, v in (overrides or {}).items()}
    fec = parsear_fecha(fecentre)
    return {
        "idcliente":      norm_int(cliente.get("idcliente")),
        "idclialias":     norm_int(cliente.get("idclialias")),
        "nomcli":         cliente.get("nomcli", ""),
        "nropedido":      0,
        "iddocumento":    ov.get("iddocumento", cliente.get("iddocumento", "PRVTA")),
        "letra":          "P",
        "idComp":         "P",
        "codlipre":       norm_int(ov.get("codlipre", cliente.get("codlipre", 1))),
        "dslistapre":     "LISTA 1",
        "tipopago":       norm_int(ov.get("tipopago", cliente.get("tipopago", 2))),
        "dstipopago":     "CONTADO",
        "tipoiva":        cliente.get("tipoiva", "RI"),
        "idrechazo": "", "dsmotivo": "",
        "fechafac":       fec,
        "fecentre":       fec,
        "fecvence":       fec,
        "idempresa":      norm_int(ov.get("idempresa", 1)),
        "firma":          "VAFOOD SRL",
        "idSucur":        norm_int(ov.get("idsucur", 1)),
        "desSucur":       "CASA CENTRAL",
        "idDepo":         norm_int(ov.get("iddepo", 1)),
        "desDepo":        "CASA CENTRAL",
        "idfuerzaventas": norm_int(ov.get("idfuerzaventas", cliente.get("idfuerzaventas", 1))),
        "dsfuerzaventas": "ESQUEMA UNICO",
        "c_perso":        norm_int(ov.get("c_perso", cliente.get("c_perso", 17))),
        "d_perso":        cliente.get("d_perso", ""),
        "idmovcomercial": None,
        "lineacreditoid": norm_int(cliente.get("lineacreditoid", 1)),
        "bruto": 0, "bonif": 0, "internos": 0, "iva1": 0, "iva2": 0,
        "per212": 0, "per3337": 0, "perib": 0, "netogra": 0,
        "netoper": 0, "nograva": 0, "valtot": 0,
    }


def construir_lineas(renglones: list) -> list:
    """
    Shape idéntico al del script que funciona (construir_linea_ui).
    Usa plsoloverifica=True en el primer llamado, igual que el script.
    """
    lineas = []
    for i, r in enumerate(renglones, 1):
        bonifpct = norm_float(r.get("bonifpct"))
        motivo   = norm_int(r.get("motivo"))
        if bonifpct and not motivo:
            raise ValueError(f"Artículo {r['codart']}: bonifpct requiere motivo")
        lineas.append({
            "idlinea":   i, "idlinint": i,
            "tipolin":   "", "concepto": "", "codpromo": "", "cambio": "",
            "inmodif":   False,
            "codart":    str(r["codart"]),
            "codbarra":  "", "descrip": "",
            "idempmatriz": 1, "buscadorart": "",
            "pallets":   0,
            "cant":      str(norm_float(r["cant"])),
            "resto":     0, "bultosReal": norm_float(r["cant"]),
            "bonif":     0, "bonifpct": bonifpct,
            "motivo":    str(motivo) if motivo else "",
            "anulado": False, "retenido": False, "motretenido": "",
            "confirmada": False, "checkLineasAnuladas": False, "ordenweb": i,
            "precio": 0, "precioFinal": "", "bltxplt": 1, "presentacion": 1,
            "exento": False, "pesable": True, "peso": 0,
            "rangod": 0, "rangoh": 0, "combo": False, "idpadre": 0,
            "visibilidad": "LineaVisible", "abierta": False, "expandido": False,
            "comodat": False, "activofijo": False,
            "numerosserie": "", "numerosactivo": "",
            "tasaint": 0, "tasaiva": 21, "internosfij": 0,
            "stkcant": 0, "stkresto": 0, "stock": "0.000", "stockbkp": "",
            "iva1": 0, "iva2": 0, "internos": 0, "per212": 0, "per3337": 0,
            "perib": 0, "netogra": 0, "nograva": 0, "netoper": 0,
            "bruto": 0, "neto": 0, "totlin": 0,
            "xblt_neto": 0, "xblt_final": 0, "xuni_neto": 0, "xuni_final": 0,
            "estado": "", "derivada": False, "idlineacredito": 1,
            "idpresentacion": 0, "vacio": False, "tmpDetlin": [],
            # campos del CSV original
            "motivo2": motivo,
        })
    return lineas


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.route("/ping")
def ping():
    return jsonify({"ok": True, "version": "2.0", "erp": BASE, "usuario": USUARIO})


@app.route("/cargar", methods=["POST"])
def cargar_pedido():
    data   = request.get_json()
    pedido = data.get("pedido", {})
    logs   = []

    try:
        # 1. Sesión
        logs.append("Conectando al ERP...")
        cookie = get_cookie()
        logs.append("Sesión OK")

        # 2. Datos del cliente
        idcliente  = pedido["idcliente"]
        idclialias = pedido.get("idclialias", 1)
        logs.append(f"Obteniendo cliente {idcliente}...")
        cliente, _ = obtener_cliente(cookie, idcliente, idclialias)
        logs.append(f"Cliente: {cliente.get('nomcli', idcliente)}")

        # 3. Construir estructuras
        cabecera = construir_cabecera(cliente, pedido["fecentre"], pedido.get("overrides", {}))
        lineas   = construir_lineas(pedido.get("renglones", []))

        ds_base = {
            "tmpmascara": [cabecera],
            "tmplineas":  lineas,
            "tmpdetrel":  [],
            "tmpreldoc":  [],
        }

        url_confirmar = f"{BASE}/web/api/pedidos/confirmarPedido"
        hdrs = make_headers(cookie)

        # 4. Paso 1: verificar (plsoloverifica=True)
        logs.append("Verificando pedido (paso 1/2)...")
        payload_ver = {
            "dsTmpmascara":  ds_base,
            "ePromosApli":   [],
            "plsoloverifica": True,
            "plReaplica":    False,
        }
        resp_ver = post_chunked(url_confirmar, hdrs, payload_ver)

        errores_ver = [e for e in (resp_ver.get("error") or []) if e.get("tipo") == "E"]
        if errores_ver:
            raise RuntimeError("Error verificar: " + ", ".join(e.get("mensaje","") for e in errores_ver))
        logs.append(f"Verificado OK — promos: {len(resp_ver.get('ePromosApli') or [])}")

        ds_confirmado = resp_ver.get("dsTmpmascara")
        e_promos      = resp_ver.get("ePromosApli", [])
        if not ds_confirmado:
            raise RuntimeError("La verificación no devolvió dsTmpmascara")

        # 5. Paso 2: confirmar / grabar (plsoloverifica=False)
        logs.append("Grabando pedido (paso 2/2)...")
        payload_conf = {
            "dsTmpmascara":   ds_confirmado,
            "ePromosApli":    e_promos,
            "plsoloverifica": False,
            "plReaplica":     False,
        }
        resp_conf = post_chunked(url_confirmar, hdrs, payload_conf)

        # Advertencias no fatales
        for e in (resp_conf.get("error") or []):
            if e.get("tipo") == "E":
                logs.append(f"⚠️ {e.get('mensaje','')}")

        # Extraer nropedido
        ds_final = resp_conf.get("dsTmpmascara") or {}
        nropedido = (
            (ds_final.get("tmpMascara") or ds_final.get("tmpmascara") or [{}])[0]
            .get("nropedido", "?")
        )
        logs.append(f"✅ Pedido #{nropedido} grabado correctamente")

        return jsonify({"success": True, "nropedido": str(nropedido), "logs": logs})

    except Exception as exc:
        logs.append(f"❌ {exc}")
        return jsonify({"success": False, "error": str(exc), "logs": logs, "nropedido": ""})


# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  PIGID WMS — Proxy Local ERP Chess v2")
    print(f"  ERP:     {BASE}")
    print(f"  Usuario: {USUARIO}")
    print("  Escuchando en http://localhost:5001")
    print("  PIGID detectará este proxy automáticamente.")
    print("  Ctrl+C para detener.")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5001, debug=False)
