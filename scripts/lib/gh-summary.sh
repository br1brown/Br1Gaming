#!/usr/bin/env bash
# =============================================================================
# gh-summary.sh — Scrive markdown nel Job Summary di GitHub Actions (da "sourcare").
#
# GITHUB_STEP_SUMMARY è una variabile che GitHub Actions imposta da sé su ogni step:
# un file su cui accumulare markdown, mostrato nella pagina del workflow run senza dover
# aprire il log dello step (ogni job ha il proprio Job Summary, mostrati insieme
# nell'overview del run). Assente fuori da GitHub Actions (run locali, altri CI): lì
# gh_summary_append() è un no-op silenzioso, nessuno script deve comportarsi
# diversamente in locale.
#
# Uso:
#   source "$(dirname "${BASH_SOURCE[0]}")/../lib/gh-summary.sh"   # path da scripts/test/
#   gh_summary_append "### Titolo
#   corpo markdown, anche multi-riga"
#
# Ogni chiamata aggiunge un blocco separato (riga vuota prima e dopo) — non serve gestire
# a mano newline finali fra chiamate successive nello stesso step.
# =============================================================================

gh_summary_append() {
    [[ -z "${GITHUB_STEP_SUMMARY:-}" ]] && return 0
    printf '%s\n\n' "$1" >> "$GITHUB_STEP_SUMMARY"
}
