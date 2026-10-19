#!/usr/bin/env bash
# Instalador de Lomo-Saltado (macOS / Linux).
# Clona (o actualiza) el repo, lo registra como marketplace e instala el mod.

set -euo pipefail

REPO_DEFAULT="mbaudran/Lomo-Saltado"
REPO="${SALTADO_REPO:-$REPO_DEFAULT}"
DEST="$HOME/.claude/plugins/marketplaces/lomo-saltado"

echo "🥩 instalador de Lomo-Saltado"
echo

# 1. Descargar
if [ -d "$DEST/.git" ]; then
    echo "→ actualizando $DEST"
    git -C "$DEST" pull --ff-only
else
    echo "→ clonando $REPO en $DEST"
    mkdir -p "$(dirname "$DEST")"
    git clone --depth 1 "https://github.com/$REPO.git" "$DEST"
fi

# 2. Registrar el marketplace e instalar el plugin con la CLI oficial
if ! command -v claude >/dev/null 2>&1; then
    echo "✘ No encuentro la CLI 'claude' en el PATH. Instala Claude Code primero." >&2
    exit 1
fi

echo "→ registrando el marketplace"
claude plugin marketplace add "$DEST" || true

echo "→ instalando el plugin"
claude plugin install saltado@lomo-saltado || true

echo
echo "✅ Lomo-Saltado instalado. Reinicia Claude Code para activarlo."
echo
echo "   Para desinstalar:"
echo "     bash $DEST/uninstall.sh"
