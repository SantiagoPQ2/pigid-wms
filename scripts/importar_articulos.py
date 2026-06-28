#!/usr/bin/env python3
"""
PIGID WMS - Importador de artículos desde CSV a Supabase
Uso: python3 importar_articulos.py Articulos.csv
"""
import csv, sys, requests, os

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://ivriqgapkcjqnbfvsqtz.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')  # Usar service_role key
NEGOCIO_ID = '00000000-0000-0000-0000-000000000001'

def importar(filepath):
    with open(filepath, encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f, delimiter=';'))
    
    print(f"Total artículos: {len(rows)}")
    
    chunk_size = 100
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i+chunk_size]
        data = []
        for r in chunk:
            data.append({
                'negocio_id': NEGOCIO_ID,
                'codigo': r['Codigo'].strip(),
                'nombre': r['Descripcion'].strip()[:200],
                'unidad_medida': r.get('UnidadMedida', 'UN').strip() or 'UN',
                'requiere_lote': r.get('UsaLote','False').strip().lower() == 'true',
                'requiere_serie': r.get('UsaSerie','False').strip().lower() == 'true',
                'activo': r.get('Activo','True').strip().lower() == 'true',
            })
        
        resp = requests.post(
            f'{SUPABASE_URL}/rest/v1/articulos',
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            json=data
        )
        
        if resp.status_code in [200, 201]:
            print(f"  Lote {i//chunk_size + 1}: {len(chunk)} artículos OK")
        else:
            print(f"  Lote {i//chunk_size + 1}: ERROR {resp.status_code} - {resp.text[:200]}")
    
    print("\n✅ Importación completada")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Uso: python3 importar_articulos.py Articulos.csv")
        sys.exit(1)
    importar(sys.argv[1])
