# -*- coding: utf-8 -*-
"""
C2 Finance — Seed de Demonstração Multi-tenant

Cria uma organização de demonstração com clientes, contas bancárias,
categorias, transações e faturas para o usuário logado.

Segurança: usa a chave PUBLISHABLE (não contém segredos) e a sessão
do usuário. O RLS do Supabase garante que os dados caiam apenas na
organização do dono.

Uso:
    python seed_demo.py
    python seed_demo.py --email voce@empresa.com --senha "sua-senha"
"""

import argparse
import json
import math
import random
import ssl
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SUPABASE_URL = "https://sqpmjxtswdheonabubau.supabase.co"
ANON_KEY = "sb_publishable_iDW91XSUr9NzEjjAQTCwdw_9lRoiOp8"

BASE = f"{SUPABASE_URL}/rest/v1"
CTX = ssl.create_default_context()


def http(method, path, payload=None, token=None):
    url = BASE + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", ANON_KEY)
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/vnd.pgrst.object+json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, context=CTX) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  [HTTP {e.code}] {body[:300]}")
        raise


def auth_token(email, password):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        data=json.dumps({"email": email, "password": password}).encode(),
        method="POST",
    )
    req.add_header("apikey", ANON_KEY)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, context=CTX) as r:
        data = json.loads(r.read())
    if "access_token" not in data:
        raise SystemExit("Falha no login (confira e-mail/senha e confirmação de e-mail).")
    return data["access_token"], data["user"]["id"]


def main():
    ap = argparse.ArgumentParser(description="Seed de demonstração do C2 Finance")
    ap.add_argument("--email", default="celso_scjunior@hotmail.com")
    ap.add_argument("--senha", default="")
    ap.add_argument("--org", default="C2 Finance (Demonstração)")
    args = ap.parse_args()

    if not args.senha:
        args.senha = input("Senha do usuário: ").strip()

    print("→ Autenticando...")
    token, uid = auth_token(args.email, args.senha)

    headers_org = token  # reutilizado via http()

    # 1) Criar organização
    rpc = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/create_organization",
        data=json.dumps({"_name": args.org, "_segment": "Farmacêutica"}).encode(),
        method="POST",
    )
    rpc.add_header("apikey", ANON_KEY)
    rpc.add_header("Content-Type", "application/json")
    rpc.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(rpc, context=CTX) as r:
            org_id = json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise SystemExit(
                "\nERRO: o schema do banco ainda não foi aplicado.\n"
                "Abra o Supabase > SQL Editor > cole o conteúdo de supabase/schema.sql\n"
                "> Run. Depois rode este script novamente."
            )
        raise
    print(f"→ Organização criada: {org_id}")

    def insert(table, rows):
        # insere em lote e retorna os objetos criados (precisamos dos ids)
        url = f"{BASE}/{table}"
        req = urllib.request.Request(url, data=json.dumps(rows).encode(), method="POST")
        req.add_header("apikey", ANON_KEY)
        req.add_header("Content-Type", "application/json")
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Prefer", "return=representation")
        try:
            with urllib.request.urlopen(req, context=CTX) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            print(f"  [HTTP {e.code}] {e.read().decode()[:300]}")
            raise

    rng = random.Random(42)

    # 2) Clientes
    clientes = [
        ("Farmácia Nossa Senhora", "46.312.558/0001-55", "farmacia@santo.com.br", "(31) 98900-1122", "client"),
        ("Clínica Vida Plena", "18.422.833/0001-90", "adm@vidaplena.com", "(31) 98811-3344", "client"),
        ("Drogaria Bem Estar", "33.199.277/0001-40", "financeiro@bemestar.com", "(11) 97777-8899", "client"),
        ("Distribuidora Saúde Total", "27.856.911/0001-73", "compras@saudetotal.com", "(41) 96666-5544", "supplier"),
    ]
    cl_ids = insert("clients", [
        {"org_id": org_id, "name": n, "document": d, "email": e, "phone": p, "kind": k}
        for n, d, e, p, k in clientes
    ])
    cl_by_name = {c["name"]: c["id"] for c in cl_ids}
    print(f"→ {len(cl_ids)} clientes")

    # 3) Contas bancárias
    contas = [
        ("Itaú PJ", "Itaú", "checking", 48250.00),
        ("Caixa PJ", "Caixa", "checking", 12500.00),
        ("Caixa interno", "C2", "cash", 3200.00),
    ]
    acc_ids = insert("bank_accounts", [
        {"org_id": org_id, "name": n, "bank": b, "kind": k, "opening_balance": saldo}
        for n, b, k, saldo in contas
    ])
    acc_by_name = {a["name"]: a["id"] for a in acc_ids}
    print(f"→ {len(acc_ids)} contas")

    # 4) Categorias (o create_organization já criou padrão; garantimos ids)
    cats = insert("categories", [
        {"org_id": org_id, "name": "Vendas", "kind": "income", "color": "#22c55e", "icon": "trending_up"},
        {"org_id": org_id, "name": "Prestação de Serviços", "kind": "income", "color": "#10b981", "icon": "briefcase"},
        {"org_id": org_id, "name": "Impostos", "kind": "expense", "color": "#ef4444", "icon": "receipt"},
        {"org_id": org_id, "name": "Folha de Pagamento", "kind": "expense", "color": "#f97316", "icon": "users"},
        {"org_id": org_id, "name": "Fornecedores", "kind": "expense", "color": "#eab308", "icon": "truck"},
    ])
    cat_income = [c["id"] for c in cats if c["kind"] == "income"]
    cat_expense = [c["id"] for c in cats if c["kind"] == "expense"]
    print(f"→ {len(cats)} categorias")

    # 5) Transações (6 meses, receitas + despesas)
    hoje = date.today()
    tx = []
    vendas_ids = [cl_by_name["Farmácia Nossa Senhora"], cl_by_name["Clínica Vida Plena"], cl_by_name["Drogaria Bem Estar"]]
    contas_itau = acc_by_name["Itaú PJ"]

    for m in range(5, -1, -1):
        base = hoje.replace(day=1) - timedelta(days=30 * m)
        for _ in range(rng.randint(6, 10)):
            d = base + timedelta(days=rng.randint(1, 26))
            v = rng.uniform(2800, 15000)
            tx.append({
                "org_id": org_id, "client_id": rng.choice(vendas_ids), "account_id": contas_itau,
                "date": d.isoformat(), "description": "Venda de produtos", "amount": round(v, 2),
                "kind": "income", "category_id": cat_income[0], "status": "posted",
            })
        for _ in range(rng.randint(3, 6)):
            d = base + timedelta(days=rng.randint(1, 26))
            v = rng.uniform(800, 9000)
            tx.append({
                "org_id": org_id, "client_id": cl_by_name["Distribuidora Saúde Total"], "account_id": contas_itau,
                "date": d.isoformat(), "description": "Compra de insumos", "amount": round(v, 2),
                "kind": "expense", "category_id": cat_expense[2], "status": "posted",
            })
        # folha (fixo mensal)
        fy = base + timedelta(days=5)
        tx.append({
            "org_id": org_id, "account_id": contas_itau, "date": fy.isoformat(),
            "description": "Folha de pagamento", "amount": 9200.00, "kind": "expense",
            "category_id": cat_expense[3], "status": "posted",
        })
        # imposto (fixo)
        fy2 = base + timedelta(days=20)
        tx.append({
            "org_id": org_id, "account_id": contas_itau, "date": fy2.isoformat(),
            "description": "Impostos (PIS/COFINS)", "amount": round(v * 0.09, 2), "kind": "expense",
            "category_id": cat_expense[0], "status": "posted",
        })

    insert("transactions", tx)
    print(f"→ {len(tx)} transações")

    # 6) Faturas (a receber / a pagar, em aberto)
    fat = []
    for i, nome in enumerate(["Farmácia Nossa Senhora", "Clínica Vida Plena", "Drogaria Bem Estar"]):
        fat.append({
            "org_id": org_id, "client_id": cl_by_name[nome], "kind": "receivable",
            "description": "Fatura mensal de serviços", "number": f"REC-{i+121}",
            "amount": round(rng.uniform(8500, 24000), 2),
            "issue_date": hoje.isoformat(), "due_date": (hoje + timedelta(days=15 * (i + 1))).isoformat(),
            "status": "open",
        })
    fat.append({
        "org_id": org_id, "client_id": cl_by_name["Distribuidora Saúde Total"], "kind": "payable",
        "description": "Fatura do fornecedor", "number": f"PAY-{250}",
        "amount": round(rng.uniform(6000, 15000), 2),
        "issue_date": hoje.isoformat(), "due_date": (hoje + timedelta(days=-3)).isoformat(),
        "status": "open",
    })
    insert("invoices", fat)
    print(f"→ {len(fat)} faturas")

    print("\n✔ Seed concluído! Abra o C2 Finance com esse usuário.")


if __name__ == "__main__":
    main()