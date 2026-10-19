#!/usr/bin/env bash
# Desinstalador de Lomo-Saltado. Quita el plugin, el marketplace, su clon y
# los archivos de la cocina.

set -euo pipefail

DEST="$HOME/.claude/plugins/marketplaces/lomo-saltado"

echo "🥩 desinstalador de Lomo-Saltado"

if command -v claude >/dev/null 2>&1; then
    echo "→ desinstalando el plugin"
    claude plugin uninstall saltado 2>/dev/null || true
    echo "→ quitando el marketplace"
    claude plugin marketplace remove lomo-saltado 2>/dev/null || true
fi

if [ -d "$DEST" ]; then
    echo "→ borrando $DEST"
    rm -rf "$DEST"
fi

rm -rf "$HOME/.claude/saltado" 2>/dev/null || true

echo "✅ Lomo-Saltado desinstalado. Reinicia Claude Code."
