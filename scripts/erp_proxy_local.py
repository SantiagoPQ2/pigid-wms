#!/usr/bin/env python3
"""
PIGID WMS - Proxy Local ERP Chess
===================================
Corre en tu máquina (que tiene acceso al ERP interno).
El frontend de PIGID detecta automáticamente si está activo.

INSTALACIÓN (solo primera vez):
    pip install flask flask-cors requests

USO:
    python scripts/erp_proxy_local.py

Queda escuchando en http://localhost:5001
Mientras esté activo, PIGID usará este proxy para cargar pedidos al ERP.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Permite requests desde pigid.netlify.app

# ─── Configuración ────────────────────────────────────────────────────────────
import os

BASE_URL = os.environ.get("ERP_BASE_URL", "http://appserver29.dyndns.org:8094")
USUARIO  = os.environ.get("ERP_USUARIO",  "dangulo")
PASSWORD = os.environ.get("ERP_PASSWORD", "Chelsea2009.")

HEADERS_JSON = {
    "Content-Type": "application/json",
    "Accept": "application/json",
}

MOTIVOS_BONIF = {1: "[B", 2: "CLIENTE ESPECIAL"}

# ─── Sesión ERP (se reutiliza entre pedidos del mismo batch) ──────────────────
_session = None
_session_ts = None
SESSION_TTL = 300  # segundos antes de re-loguearse

def get_session():
    global _session, _session_ts
    ahora = datetime.now().timestamp()
    if _session and _session_ts and (ahora - _session_ts) < SESSION_TTL:
        return _session
    
    print(f"  [ERP] Login como {USUARIO}...")
    sess = requests.Session()
    r = sess.post(
        f"{BASE_URL}/static/auth/j_spring_security_check",
        data={"j_username": USUARIO, "j_password": PASSWORD},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        allow_redirects=True, timeout=30,
    )
    if "JSESSIONID" not in sess.cookies:
        raise Exception(f"Login fallido (status {r.status_code})")
    
    try:
        sess.post(f"{BASE_URL}/web/api/sesion/gestionarURL",
                  json={}, headers=HEADERS_JSON, timeout=30, stream=True).close()
    except: pass
    
    _session = sess
    _session_ts = ahora
    print(f"  [ERP] Login OK")
    return sess


def erp_request(session, method, endpoint, body=None):
    r = session.request(
        method, f"{BASE_URL}{endpoint}",
        json=body, headers=HEADERS_JSON, timeout=(10, 60)
    )
    if not r.ok:
        raise Exception(f"ERP error {r.status_code}: {r.text[:200]}")
    return r.json()


def armar_renglones(renglones):
    result = []
    for i, r in enumerate(renglones, 1):
        bonifpct = float(r.get("bonifpct") or 0)
        motivo   = int(r.get("motivo") or 0)
        if bonifpct and not motivo:
            raise Exception(f"Artículo {r['codart']}: bonifpct requiere motivo")
        result.append({
            "idcabint": 0, "idempresa": 0, "iddocumento": "", "letra": "",
            "serie": 0, "nrodoc": 0, "idlinea": i, "idlinint": i,
            "codart": int(r["codart"]), "pallets": 0,
            "cant": float(r["cant"]), "resto": 0, "cantorig": 0, "restoorig": 0,
            "peso": 0, "precio": 0, "preciofinal": 0, "flete": 0,
            "bonifpct": bonifpct, "bonif": 0, "motivo2": motivo,
            "iva1": 0, "iva2": 0, "per3337": 0, "per212": 0, "perib": 0,
            "internos": 0, "bruto": 0, "netogra": 0, "nograva": 0, "exonerado": 0,
            "noauto": False, "descrip": "", "tipolin": "P", "codpromo": 0,
            "inmodif": False, "derivada": False, "ndocpadre": 0, "idpadre": 0,
            "expandido": False, "numerosserie": "", "numerosactivo": "",
            "estado": "", "msj": "", "imprime": True, "cuentayorden": False,
            "codprovcyo": 0, "totlin": 0, "idorigen": "", "anulado": False,
        })
    return result


def armar_payload(cliente, fecentre, renglones, overrides):
    ov = {k.lower(): v for k, v in (overrides or {}).items()}
    # Parsear fecha D/M/YYYY o DD/MM/YYYY
    partes = fecentre.split("/")
    d, m, y = partes[0].zfill(2), partes[1].zfill(2), partes[2]
    fec = f"{y}-{m}-{d}"
    hoy = datetime.today().strftime("%Y-%m-%d")

    mascara = {
        "idcliente":      cliente["idcliente"],
        "idclialias":     cliente["idclialias"],
        "nomcli":         cliente.get("nomcli", ""),
        "nropedido":      0,
        "iddocumento":    ov.get("iddocumento", "PRVTA"),
        "letra":          cliente.get("letra", "P"),
        "idComp":         cliente.get("idComp", "P"),
        "codlipre":       ov.get("codlipre", 1),
        "dslistapre":     cliente.get("dslistapre", ""),
        "tipopago":       ov.get("tipopago", 2),
        "dstipopago":     cliente.get("dstipopago", ""),
        "tipoiva":        cliente.get("tipoiva", "NC"),
        "idrechazo": "", "dsmotivo": "",
        "fechafac":       hoy,
        "fecentre":       fec,
        "fecvence":       fec,
        "idempresa":      ov.get("idempresa", 1),
        "firma":          "VAFOOD SRL",
        "idSucur":        ov.get("idsucur", 1),
        "desSucur":       cliente.get("desSucur", ""),
        "idDepo":         int(ov.get("iddepo", 1)),
        "desDepo":        cliente.get("desDepo", ""),
        "idfuerzaventas": ov.get("idfuerzaventas", 1),
        "dsfuerzaventas": cliente.get("dsfuerzaventas", ""),
        "c_perso":        ov.get("c_perso", 0),
        "d_perso":        cliente.get("d_perso", ""),
        "idmovcomercial": None,
        "lineacreditoid": cliente.get("lineacreditoid", 1),
        "bruto": 0, "bonif": 0, "internos": 0, "iva1": 0, "iva2": 0,
        "per212": 0, "per3337": 0, "perib": 0, "netogra": 0,
        "netoper": 0, "nograva": 0, "valtot": 0,
    }
    return {
        "dsTmpmascara": {
            "tmpmascara": [mascara],
            "tmplineas": armar_renglones(renglones),
            "tmpdetrel": [], "tmpreldoc": [],
        },
        "ePromosApli": [], "plsoloverifica": False, "plReaplica": False,
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.route("/ping")
def ping():
    """El frontend usa este endpoint para detectar si el proxy está activo."""
    return jsonify({"ok": True, "version": "1.0", "erp": BASE_URL})


@app.route("/cargar", methods=["POST"])
def cargar_pedido():
    """Recibe un pedido del frontend y lo graba en el ERP."""
    data = request.get_json()
    pedido = data.get("pedido", {})
    logs = []

    try:
        # 1. Login / reutilizar sesión
        logs.append("Conectando al ERP...")
        session = get_session()
        logs.append("Sesión ERP OK")

        # 2. Datos del cliente
        idcliente  = pedido["idcliente"]
        idclialias = pedido.get("idclialias", 1)
        logs.append(f"Obteniendo datos del cliente {idcliente}...")
        resp = erp_request(session, "GET",
            f"/web/api/pedidos/obtenerDatosPedido?picli={idcliente}&pialias={idclialias}")
        if resp.get("error"):
            raise Exception(f"Error ERP cliente: {resp['error']}")
        clientes = resp.get("dsDatosPedido", {}).get("eClientes", [])
        if not clientes:
            raise Exception(f"Cliente {idcliente} no encontrado")
        cliente = clientes[0]
        logs.append(f"Cliente: {cliente.get('nomcli', '')}")

        # 3. Armar payload
        payload = armar_payload(
            cliente, pedido["fecentre"],
            pedido.get("renglones", []),
            pedido.get("overrides", {})
        )

        # 4. F8 - precios y promociones
        logs.append("Aplicando precios (F8)...")
        payload_f8 = {**payload, "plReaplica": True}
        resp_f8 = erp_request(session, "POST", "/web/api/pedidos/confirmarPedido", payload_f8)
        errores_f8 = [e for e in (resp_f8.get("error") or []) if e.get("tipo") == "E"]
        if errores_f8:
            raise Exception("Error F8: " + ", ".join(e.get("mensaje","") for e in errores_f8))
        logs.append("Precios aplicados OK")

        # 5. F5 - grabar pedido
        logs.append("Grabando pedido (F5)...")
        payload_f5 = {
            "dsTmpmascara": resp_f8["dsTmpmascara"],
            "ePromosApli":  resp_f8.get("ePromosApli", []),
            "plsoloverifica": False, "plReaplica": False,
        }
        resp_f5 = erp_request(session, "POST", "/web/api/pedidos/confirmarPedido", payload_f5)

        # Advertencias F5 (no fatales)
        for e in (resp_f5.get("error") or []):
            if e.get("tipo") == "E":
                logs.append(f"⚠️ {e.get('mensaje','')}")

        nropedido = (
            (resp_f5.get("dsTmpmascara") or {})
            .get("tmpMascara", [{}])[0]
            .get("nropedido")
            or (resp_f5.get("dsTmpmascara") or {})
            .get("tmpmascara", [{}])[0]
            .get("nropedido", "?")
        )
        logs.append(f"✅ Pedido #{nropedido} grabado")

        return jsonify({"success": True, "nropedido": str(nropedido), "logs": logs})

    except Exception as e:
        logs.append(f"❌ {e}")
        return jsonify({"success": False, "error": str(e), "logs": logs})


# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 55)
    print("  PIGID WMS - Proxy Local ERP Chess")
    print(f"  ERP: {BASE_URL}")
    print(f"  Usuario: {USUARIO}")
    print("=" * 55)
    print("  Escuchando en http://localhost:5001")
    print("  PIGID detectará este proxy automáticamente.")
    print("  Ctrl+C para detener.")
    print("=" * 55)
    app.run(host="0.0.0.0", port=5001, debug=False)
