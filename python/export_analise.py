# -*- coding: utf-8 -*-
"""
C2 Finance — Export & Análise de Dados (cientista de dados)

Baixa transações e faturas de uma organização via REST e gera:
  - export_transacoes.csv / export_contas.csv
  - relatorio.json (KPIs, séries mensais, top categorias)

Também imprime um resumo rápido qualitativo no terminal.

Uso:
    set SUPABASE_URL=https://SEU-PROJECT.supabase.co
    set SUPABASE_ANON_KEY=sb_publishable_SUA_CHAVE
    python export_analise.py --email seu@email.com --senha s3nh4
    python export_analise.py --org-id <uuid> --email ... --senha ...
"""

import argparse
import json
import ssl
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import date

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import os

# Credenciais via variáveis de ambiente (nunca versionar).
# Ex.:
#   set SUPABASE_URL=https://SEU-PROJECT.supabase.co
#   set SUPABASE_ANON_KEY=sb_publishable_SUA_CHAVE
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not ANON_KEY:
    raise SystemExit(
        "Credenciais ausentes. Defina SUPABASE_URL e SUPABASE_ANON_KEY "
        "como variáveis de ambiente e tente novamente."
    )

BASE = f"{SUPABASE_URL}/rest/v1"
CTX = ssl.create_default_context()


def auth(email, password):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        data=json.dumps({"email": email, "password": password}).encode(),
        method="POST",
    )
    req.add_header("apikey", ANON_KEY)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, context=CTX) as r:
        d = json.loads(r.read())
    return d["access_token"]


def get_all(token, table, org_id=None):
    out = []
    # paginação compatível com Supabase (coluna "id" uuid)
    last = None
    while True:
        query = f"?select=*&order=id&limit=1000"
        if last:
            query += f"&id=gt.{last}"
        if org_id:
            query += f"&org_id=eq.{org_id}"
        req = urllib.request.Request(BASE + f"/{table}{query}")
        req.add_header("apikey", ANON_KEY)
        req.add_header("Authorization", f"Bearer {token}")
        with urllib.request.urlopen(req, context=CTX) as r:
            batch = json.loads(r.read())
        if not batch:
            break
        out.extend(batch)
        last = batch[-1]["id"]
        if len(batch) < 1000:
            break
    return out


def fmt_moeda(v):
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def main():
    ap = argparse.ArgumentParser(description="Exporta e analisa dados do C2 Finance")
    ap.add_argument("--email", required=True)
    ap.add_argument("--senha", required=True)
    ap.add_argument("--org-id", default=None)
    args = ap.parse_args()

    token = auth(args.email, args.senha)

    orgs = get_all(token, "organizations")
    if not orgs:
        raise SystemExit("Nenhuma organização encontrada para este usuário.")
    org_id = args.org_id or orgs[0]["id"]
    org = next((o for o in orgs if o["id"] == org_id), orgs[0])
    print(f"Organização: {org['name']} ({org['id']})")

    tx = get_all(token, "transactions", org_id)
    fat = get_all(token, "invoices", org_id)
    cli = {c["id"]: c for c in get_all(token, "clients", org_id)}
    cat = {c["id"]: c for c in get_all(token, "categories", org_id)}

    print(f"{len(tx)} transações | {len(fat)} faturas")

    # ---- arquivos CSV ----
    def csv_write(nome, headers, rows):
        with open(nome, "w", encoding="utf-8-sig", newline="") as f:
            f.write(";".join(headers) + "\n")
            for r in rows:
                f.write(";".join(str(x) if x is not None else "" for x in r) + "\n")
        print(f"  → {nome}")

    csv_write(
        "export_transacoes.csv",
        ["data", "tipo", "categoria", "cliente", "descricao", "valor", "status"],
        [[t["date"], "Receita" if t["kind"] == "income" else "Despesa",
          cat.get(t["category_id"], {}).get("name", ""),
          cli.get(t["client_id"], {}).get("name", ""), t["description"],
          t["amount"], t["status"]] for t in tx],
    )
    csv_write(
        "export_contas.csv",
        ["emissao", "vencimento", "tipo", "numero", "descricao", "cliente", "valor", "status", "pago_em"],
        [[f["issue_date"], f.get("due_date", ""),
          "A receber" if f["kind"] == "receivable" else "A pagar",
          f.get("number", ""), f.get("description", ""),
          cli.get(f["client_id"], {}).get("name", ""), f["amount"], f["status"],
          f.get("paid_at", "")] for f in fat],
    )

    # ---- KPIs ----
    receitas = sum(t["amount"] for t in tx if t["kind"] == "income")
    despesas = sum(t["amount"] for t in tx if t["kind"] == "expense")
    result = receitas - despesas

    por_mes = defaultdict(lambda: {"in": 0.0, "out": 0.0})
    for t in tx:
        m = t["date"][:7]
        if t["kind"] == "income":
            por_mes[m]["in"] += t["amount"]
        else:
            por_mes[m]["out"] += t["amount"]

    por_cat = defaultdict(float)
    for t in tx:
        if t["kind"] == "expense":
            por_cat[cat.get(t["category_id"], {}).get("name", "sem categoria")] += t["amount"]

    abertura = [f for f in fat if f["status"] not in ("paid", "cancelled")]
    a_receber = sum(f["amount"] for f in abertura if f["kind"] == "receivable")
    a_pagar = sum(f["amount"] for f in abertura if f["kind"] == "payable")

    relatorio = {
        "org_id": org_id,
        "gerado_em": date.today().isoformat(),
        "resumo": {"receitas": receitas, "despesas": despesas, "resultado": result,
                   "a_receber": a_receber, "a_pagar": a_pagar},
        "por_mes": dict(sorted(por_mes.items())),
        "despesas_por_categoria": dict(sorted(por_cat.items(), key=lambda x: -x[1])),
    }
    with open("relatorio.json", "w", encoding="utf-8") as f:
        json.dump(relatorio, f, ensure_ascii=False, indent=2)
    print("  → relatorio.json")

    # ---- resumo qualitativo ----
    print("\n=== RESUMO EXECUTIVO ===")
    print(f"Receitas : {fmt_moeda(receitas)}")
    print(f"Despesas : {fmt_moeda(despesas)}")
    print(f"Resultado: {fmt_moeda(result)}")
    print(f"A receber: {fmt_moeda(a_receber)} | A pagar: {fmt_moeda(a_pagar)}")
    margem = (result / receitas * 100) if receitas else 0
    print(f"Margem   : {margem:.1f}%")
    top = relatorio["despesas_por_categoria"]
    if top:
        print("\nMaiores despesas por categoria:")
        for nome, v in list(top.items())[:4]:
            print(f"  - {nome}: {fmt_moeda(v)}")


if __name__ == "__main__":
    main()