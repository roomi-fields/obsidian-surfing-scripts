#!/usr/bin/env python3
"""
Orchestrateur de publication d'articles.

Pipeline complet en 5 étapes :
1. prep   → Move Blog/ → Articles/ + split titre colon
2. SEO    → Génère frontmatter SEO via Gemini (prepare-seo.js)
3. fr     → Publication FR (liens, glossaire, backlinks, INDEX, MOC)
4. trad   → Traduction FR → EN via Gemini (traduire-article.js)
5. en     → Publication EN (liens, glossaire EN, régénération INDEX)

Usage:
    python publier-article.py <path_to_article.md>

Called from Obsidian Shell Commands plugin when right-clicking an article.
"""

import platform
import re
import subprocess
import sys
from pathlib import Path

# ─── Configuration ───────────────────────────────────────────────────────────

if platform.system() == "Windows":
    SCRIPTS_DIR = Path(r"D:\Claude\obsidian-surfing-scripts")
    ARTICLES_DIR = Path(
        r"D:\Romain\Articles\Publications\roomi-fields.com\Articles"
    )
    PUBLISH_SCRIPT = Path(r"D:\Claude\BP2SC\tools\publish_article.py")
else:
    # WSL / Linux paths
    SCRIPTS_DIR = Path("/mnt/d/Claude/obsidian-surfing-scripts")
    ARTICLES_DIR = Path(
        "/mnt/d/Romain/Articles/Publications/roomi-fields.com/Articles"
    )
    PUBLISH_SCRIPT = Path("/mnt/d/Claude/BP2SC/tools/publish_article.py")

SEO_SCRIPT = SCRIPTS_DIR / "prepare-seo.js"
TRANSLATE_SCRIPT = SCRIPTS_DIR / "traduire-article.js"


# ─── Helpers ─────────────────────────────────────────────────────────────────


def extract_id(source: Path) -> str:
    """Extract article ID from filename (e.g. L6 from L6_SOS.md)."""
    m = re.match(r"^([A-Z]\d+)_", source.stem)
    if not m:
        print(f"ERREUR: Nom de fichier invalide: {source.name}")
        print("Format attendu: PREFIX_Titre.md (ex: L6_SOS.md)")
        sys.exit(1)
    return m.group(1)


def run_step(description: str, cmd: list, timeout: int | None = None):
    """Run a subprocess, print output, stop on error."""
    print(f"> {description}")
    result = subprocess.run(cmd, capture_output=False, timeout=timeout)
    if result.returncode != 0:
        print(f"  ERREUR (code {result.returncode})")
        sys.exit(result.returncode)


# ─── Main ────────────────────────────────────────────────────────────────────


def main():
    if len(sys.argv) < 2:
        print("Usage: publier-article.py <file_path>")
        sys.exit(1)

    source = Path(sys.argv[1])

    if not source.exists():
        print(f"ERREUR: Fichier introuvable: {source}")
        sys.exit(1)

    if source.suffix != ".md":
        print(f"ERREUR: Ce n'est pas un fichier .md: {source}")
        sys.exit(1)

    article_id = extract_id(source)
    articles_path = ARTICLES_DIR / source.name

    # 1. Prep (move + split title)
    run_step(
        "1/5 — Préparation (déplacement + titre)",
        [
            sys.executable, str(PUBLISH_SCRIPT),
            article_id, "--apply", "--phase", "prep",
        ],
    )

    # 2. SEO (Gemini ~30s)
    run_step(
        "2/5 — Génération SEO (Gemini)",
        ["node", str(SEO_SCRIPT), str(articles_path)],
        timeout=60,
    )

    # 3. Publication FR
    run_step(
        "3/5 — Publication FR",
        [
            sys.executable, str(PUBLISH_SCRIPT),
            article_id, "--apply", "--phase", "fr",
        ],
    )

    # 4. Traduction (Gemini ~3min)
    run_step(
        "4/5 — Traduction FR → EN (Gemini)",
        ["node", str(TRANSLATE_SCRIPT), str(articles_path)],
        timeout=300,
    )

    # 5. Publication EN
    run_step(
        "5/5 — Publication EN",
        [
            sys.executable, str(PUBLISH_SCRIPT),
            article_id, "--apply", "--phase", "en",
        ],
    )

    print(f"✅ {article_id} publié !")


if __name__ == "__main__":
    main()
