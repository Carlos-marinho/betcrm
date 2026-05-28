#!/usr/bin/env python3
"""
Importação de banners do Google Drive → fixtures/banners/

O que faz:
  1. Baixa os banners 1200×600 (PNG) do Google Drive via URL pública
  2. Converte PNG → JPG (qualidade 85, fundo #0a0a0a para transparência)
  3. Salva em api/apps/templates/fixtures/banners/

Uso: python infra/scripts/import_banners.py
Próximo passo: make migrate (no Docker) para criar os EmailAssets no banco.

Para adicionar novos banners futuramente:
  1. Adicione uma entrada em BANNERS (ou FOOTER) com o drive_id e filename
  2. Rode este script novamente (arquivos existentes são pulados)
  3. Crie nova migration de seed apontando para o novo arquivo
"""

import io
import os
import sys
import time

try:
    import requests
    from PIL import Image
except ImportError as e:
    sys.exit(f"Dependência faltando: {e}\nInstale: pip install Pillow requests")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FIXTURES_DIR = os.path.normpath(
    os.path.join(SCRIPT_DIR, "..", "..", "api", "apps", "templates", "fixtures", "banners")
)

BG_COLOR = (10, 10, 10)   # #0a0a0a — fundo padrão dos emails
JPG_QUALITY = 85
SIZE_LIMIT_KB = 200

# ── Banners a baixar ──────────────────────────────────────────────────────────
# Todos na versão 1200×600 (2×/retina). O HTML já tem width="600" então
# o email client escala para 600px mas usa os pixels extras em telas retina.
# Ao adicionar novos banners, inclua aqui e crie uma nova migration.

BANNERS = [
    {
        "drive_id": "1Ushj7NLG4RbeA99qNo4B2n2aLe3uNaob",
        "template_code": "welcome_guide_v1",
        "filename": "welcome_guide_v1.jpg",
    },
    {
        "drive_id": "1YBzGEP1Ekoa7rXF-AYcFRnLbGq0MG3-h",
        "template_code": "welcome_urgency_v1",
        "filename": "welcome_urgency_v1.jpg",
    },
    {
        "drive_id": "1Zc-NS3Y1oPp80gUgZA3g-5Qkh7SBN8tp",
        "template_code": "welcome_lastchance_v1",
        "filename": "welcome_lastchance_v1.jpg",
    },
    {
        "drive_id": "1vAj0j_sGolURtDCAG6J6pcn7Lt-ISEcs",
        "template_code": "nrc_activation_v1",
        "filename": "nrc_activation_v1.jpg",
    },
    {
        "drive_id": "1ZcF07Pbsw9hXm2--tAj2l5gOXt3C_d9r",
        "template_code": "nrc_lastcall_v1",
        "filename": "nrc_lastcall_v1.jpg",
    },
    {
        "drive_id": "1gViNBqwJvwUP_3sWhcpbZ-RtqRiURX-g",
        "template_code": "deposit_abandoned_d2_v1",
        "filename": "deposit_abandoned_d2_v1.jpg",
    },
    {
        "drive_id": "1P82bN8Cadd-K2Em6B7zg3L7nqAL_ywkO",
        "template_code": "ftd_game_nudge_v1",
        "filename": "ftd_game_nudge_v1.jpg",
    },
    {
        "drive_id": "1Gtoofkr7s7-5VqHxnLHVAScRWy07YRsR",
        "template_code": "ftd_bonus_urgency_v1",
        "filename": "ftd_bonus_urgency_v1.jpg",
    },
    {
        "drive_id": "19Py3SftdpkRIhhN9xRdxPbacPrXSwX6-",
        "template_code": "deposit_failed_retry_v1",
        "filename": "deposit_failed_retry_v1.jpg",
    },
]

FOOTER = {
    "drive_id": "1RDdRbr0nVWF0AtQyxlWvmPHc7Ucm7Ey8",
    "filename": "footer_padrao.jpg",
}


def drive_download(file_id: str) -> bytes:
    url = f"https://drive.google.com/uc?export=download&id={file_id}"
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()

    # Google redireciona para página de confirmação em arquivos grandes
    if "text/html" in resp.headers.get("Content-Type", ""):
        import re
        token_match = re.search(r'confirm=([0-9A-Za-z_\-]+)', resp.text)
        if token_match:
            resp = requests.get(f"{url}&confirm={token_match.group(1)}", timeout=60)
            resp.raise_for_status()

    return resp.content


def png_to_jpg(data: bytes, quality: int = JPG_QUALITY) -> bytes:
    """Converte PNG → JPG compondo sobre fundo escuro (preserva transparência)."""
    img = Image.open(io.BytesIO(data)).convert("RGBA")
    bg = Image.new("RGBA", img.size, BG_COLOR + (255,))
    bg.paste(img, mask=img.split()[3])
    rgb = bg.convert("RGB")
    out = io.BytesIO()
    rgb.save(out, format="JPEG", quality=quality, optimize=True, progressive=True)
    return out.getvalue()


def process(entry: dict) -> bool:
    filename = entry["filename"]
    dest = os.path.join(FIXTURES_DIR, filename)

    if os.path.exists(dest):
        size_kb = os.path.getsize(dest) // 1024
        print(f"  ✓ {filename:<45} já existe ({size_kb} KB)")
        return True

    print(f"  ↓ {filename:<45}", end=" ", flush=True)
    raw = drive_download(entry["drive_id"])
    orig_kb = len(raw) // 1024
    print(f"{orig_kb} KB baixados", end=" → ", flush=True)

    is_png = raw[:4] == b"\x89PNG" or filename.lower().endswith(".png")
    final = png_to_jpg(raw) if is_png else raw

    size_kb = len(final) // 1024
    with open(dest, "wb") as f:
        f.write(final)

    flag = "✓" if size_kb <= SIZE_LIMIT_KB else "⚠"
    print(f"JPG {size_kb} KB {flag}")
    time.sleep(0.3)
    return True


def main():
    os.makedirs(FIXTURES_DIR, exist_ok=True)
    print(f"\nDestino: {FIXTURES_DIR}\n")

    print("── Banners dos templates ─────────────────────────────────────────────")
    for entry in BANNERS:
        process(entry)

    print("\n── Footer global ─────────────────────────────────────────────────────")
    process(FOOTER)

    print("\n── Resumo ────────────────────────────────────────────────────────────")
    total = 0
    over_limit = []
    for f in sorted(os.listdir(FIXTURES_DIR)):
        if not f.endswith(".jpg"):
            continue
        size_kb = os.path.getsize(os.path.join(FIXTURES_DIR, f)) // 1024
        total += size_kb
        flag = "✅" if size_kb <= SIZE_LIMIT_KB else "⚠️  ACIMA DO LIMITE"
        print(f"  {flag}  {f:<45} {size_kb:>4} KB")
        if size_kb > SIZE_LIMIT_KB:
            over_limit.append(f)

    print(f"\n  Total: {total} KB em {len(os.listdir(FIXTURES_DIR))} arquivos")

    if over_limit:
        print(f"\n  ⚠️  {len(over_limit)} arquivo(s) acima de {SIZE_LIMIT_KB}KB.")
        print("     Considere reduzir a qualidade JPG (JPG_QUALITY = 70) e rodar novamente.")
    else:
        print("\n  ✅ Todos dentro do limite de 200 KB.")

    print("\nPróximo passo: make migrate\n")


if __name__ == "__main__":
    main()
