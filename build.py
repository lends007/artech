#!/usr/bin/env python3
"""
Empacota o PET CONTROL em um único arquivo HTML.

Os módulos ES são reescritos como IIFEs que devolvem seus exports, e os
imports viram desestruturação desses objetos. Isso permite hospedar a
demonstração como página única, sem servidor e sem etapa de build no cliente.

Gera duas variantes:
  - autônoma  (padrão): documento completo, abre com duplo clique, sem servidor
  - fragmento (--fragment): só o conteúdo, para hospedagem que já provê o esqueleto

Uso:  python3 build.py [saida.html] [--fragment]
"""

import os
import re
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))

CSS = [
    "assets/css/tokens.css",
    "assets/css/base.css",
    "assets/css/components.css",
    "assets/css/layout.css",
    "assets/css/screens.css",
]

# Ordem topológica: um módulo só aparece depois de tudo que ele importa.
JS = [
    "src/util.js",
    "src/data/catalog.js",
    "src/data/seed.js",
    "src/ui/icons.js",
    "src/ui/brand.js",
    "src/store.js",
    "src/selectors.js",
    "src/ui/charts.js",
    "src/ui/kit.js",
    "src/ui/overlay.js",
    "src/ui/camera.js",
    "src/screens/auth.js",
    "src/screens/dashboard.js",
    "src/screens/pet-form.js",
    "src/screens/pets.js",
    "src/screens/validacao.js",
    "src/screens/acessos.js",
    "src/screens/funcionarios.js",
    "src/screens/medicoes.js",
    "src/screens/alertas.js",
    "src/screens/rastreabilidade.js",
    "src/screens/relatorios.js",
    "src/screens/transformacao.js",
    "src/screens/configuracoes.js",
    "src/app.js",
]

RE_IMPORT_NAMED = re.compile(r"^import\s*\{([^}]+)\}\s*from\s*['\"]([^'\"]+)['\"]\s*;?\s*$", re.M)
RE_IMPORT_NS = re.compile(r"^import\s*\*\s*as\s+(\w+)\s*from\s*['\"]([^'\"]+)['\"]\s*;?\s*$", re.M)
RE_EXPORT_DECL = re.compile(r"^export\s+(?:async\s+)?(function|const|let|var|class)\s+([A-Za-z_$][\w$]*)", re.M)
RE_EXPORT_LIST = re.compile(r"^export\s*\{([^}]+)\}\s*;?\s*$", re.M)


def nome_modulo(caminho):
    return "M_" + re.sub(r"[^A-Za-z0-9]", "_", caminho[len("src/"):-len(".js")])


def resolver(origem, alvo):
    """Resolve um especificador relativo para um caminho a partir da raiz."""
    base = os.path.dirname(origem)
    p = os.path.normpath(os.path.join(base, alvo))
    return p.replace(os.sep, "/")


def exports_de(src):
    nomes = []
    for _, nome in RE_EXPORT_DECL.findall(src):
        nomes.append((nome, nome))
    for corpo in RE_EXPORT_LIST.findall(src):
        for item in corpo.split(","):
            item = item.strip()
            if not item:
                continue
            if " as " in item:
                local, exportado = [x.strip() for x in item.split(" as ")]
            else:
                local = exportado = item
            nomes.append((local, exportado))
    # preserva a ordem, remove duplicatas
    vistos, saida = set(), []
    for local, exportado in nomes:
        if exportado in vistos:
            continue
        vistos.add(exportado)
        saida.append((local, exportado))
    return saida


def transformar(caminho, src):
    exps = exports_de(src)

    def sub_named(m):
        especificadores, alvo = m.group(1), m.group(2)
        mod = nome_modulo(resolver(caminho, alvo))
        partes = []
        for item in especificadores.split(","):
            item = item.strip()
            if not item:
                continue
            if " as " in item:
                orig, local = [x.strip() for x in item.split(" as ")]
                partes.append(f"{orig}: {local}")
            else:
                partes.append(item)
        return f"const {{ {', '.join(partes)} }} = {mod};"

    def sub_ns(m):
        local, alvo = m.group(1), m.group(2)
        return f"const {local} = {nome_modulo(resolver(caminho, alvo))};"

    src = RE_IMPORT_NAMED.sub(sub_named, src)
    src = RE_IMPORT_NS.sub(sub_ns, src)

    # remove a palavra-chave export das declarações e as listas de export
    src = RE_EXPORT_LIST.sub("", src)
    src = re.sub(r"^export\s+(?=(?:async\s+)?(?:function|const|let|var|class)\s)", "", src, flags=re.M)

    retorno = ", ".join(
        (local if local == exportado else f"{exportado}: {local}") for local, exportado in exps
    )
    return (
        f"/* ---------- {caminho} ---------- */\n"
        f"const {nome_modulo(caminho)} = (() => {{\n{src}\nreturn {{ {retorno} }};\n}})();\n"
    )


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    fragmento = "--fragment" in sys.argv
    padrao = "pet-control-fragmento.html" if fragmento else "pet-control.html"
    saida = args[0] if args else os.path.join(RAIZ, "dist", padrao)

    css = "\n".join(open(os.path.join(RAIZ, f), encoding="utf-8").read() for f in CSS)

    partes = []
    for f in JS:
        src = open(os.path.join(RAIZ, f), encoding="utf-8").read()
        partes.append(transformar(f, src))
    js = "\n".join(partes)

    # As telas são carregadas por import() dinâmico no roteador; na versão de
    # arquivo único elas já estão em memória.
    js = re.sub(
        r"mod:\s*\(\)\s*=>\s*import\('\./screens/([\w-]+)\.js'\)",
        lambda m: "mod: async () => M_screens_" + m.group(1).replace("-", "_"),
        js,
    )
    assert "import(" not in js, "sobrou um import() dinâmico"

    cabeca = f"""<title>PET CONTROL</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
<style>
{css}
</style>"""

    corpo = f"""<div id="app">
  <div style="position:fixed;inset:0;display:grid;place-items:center;background:#06080B">
    <div style="text-align:center">
      <div style="width:44px;height:44px;border-radius:11px;margin:0 auto 16px;display:grid;place-items:center;
                  background:linear-gradient(140deg,#22D3EE,#0B7C96);box-shadow:0 6px 26px rgba(34,211,238,.26)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#04161B" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
      </div>
      <div style="font:600 13px/1.2 Inter,system-ui,sans-serif;letter-spacing:.14em;color:#E8EDF4">PET CONTROL</div>
      <div style="font:400 10px/1.4 Inter,system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#414B59;margin-top:6px">
        Inicializando plataforma
      </div>
    </div>
  </div>
</div>

<script type="module">
{js}
</script>"""

    if fragmento:
        html = cabeca + "\n\n" + corpo + "\n"
    else:
        html = (
            '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="color-scheme" content="dark">\n'
            + cabeca
            + '\n</head>\n<body>\n' + corpo
            + '\n<noscript><div style="padding:40px;font:400 14px system-ui;color:#AFBACB">'
              'O PET CONTROL requer JavaScript habilitado.</div></noscript>\n</body>\n</html>\n'
        )

    os.makedirs(os.path.dirname(saida), exist_ok=True)
    with open(saida, "w", encoding="utf-8") as fh:
        fh.write(html)

    kb = len(html.encode("utf-8")) / 1024
    tipo = "fragmento" if fragmento else "autônoma"
    print(f"{saida}  ({kb:.0f} KB, versão {tipo}, {len(JS)} módulos)")


if __name__ == "__main__":
    main()
