#!/usr/bin/env bash
# Upload the ICD-11 CodeSystems the postcoord suite needs into a running Ontoserver.
# One-time setup; ~155 MB on disk for the minimum set, takes a few minutes to index.
#
# Usage:
#   ./setup-ontoserver.sh [--onto URL] [--fixtures DIR]
#                         [--supplements] [--include-foundation]
#
#   --onto URL           FHIR base URL for the target Ontoserver
#                        (default: http://localhost:8080/fhir)
#   --fixtures DIR       Path to the ICD11toFHIR target directory
#                        (default: $HOME/code/ICD11toFHIR/target)
#   --supplements        Also upload the -es / -fr translation supplements
#                        (not needed for cluster validation; displays only)
#   --include-foundation Also upload ICD11Foundation-2026-01 (~130 MB; not needed for
#                        the current suite — only MMS + ICF cases are exercised)
#
# Idempotent: re-running re-uploads via POST, replacing the prior version match.

set -euo pipefail

ONTO="http://localhost:8080/fhir"
FIXTURES="$HOME/code/ICD11toFHIR/target"
SUPPLEMENTS=0
INCLUDE_FOUNDATION=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --onto)               ONTO="$2"; shift 2 ;;
        --fixtures)           FIXTURES="$2"; shift 2 ;;
        --supplements)        SUPPLEMENTS=1; shift ;;
        --include-foundation) INCLUDE_FOUNDATION=1; shift ;;
        -h|--help)            sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *)                    echo "unknown arg: $1" >&2; exit 1 ;;
    esac
done

if [[ ! -d "$FIXTURES" ]]; then
    echo "fixtures dir not found: $FIXTURES" >&2
    echo "Run the ICD11toFHIR converter first (mvn package in that repo)." >&2
    exit 1
fi

upload () {
    local file="$1" label="$2"
    if [[ ! -f "$file" ]]; then
        echo "  skip $label (file missing: $file)"
        return
    fi
    echo "  uploading $label ($(du -h "$file" | cut -f1))..."
    local http
    http=$(curl -sS -o /tmp/upload-resp.json -w '%{http_code}' \
        -X POST "$ONTO/CodeSystem" \
        -H 'Content-Type: application/fhir+json' \
        --data-binary @"$file")
    if [[ "$http" != "201" && "$http" != "200" ]]; then
        echo "    HTTP $http"
        head -c 500 /tmp/upload-resp.json; echo
    else
        echo "    HTTP $http"
    fi
}

echo "Target: $ONTO"
echo "Source: $FIXTURES"

# Axis lookups — small support code systems referenced by MMS subproperty groups.
upload "$FIXTURES/ICD11AxisName-2025-01.json"           "AxisName lookup"
upload "$FIXTURES/ICD11AllowMultipleValues-2025-01.json" "AllowMultipleValues lookup"

# Primary linearizations.
upload "$FIXTURES/ICD11MMS-2026-01-en.json" "MMS 2026-01 (en)"
upload "$FIXTURES/ICD11ICF-2026-01-en.json" "ICF 2026-01 (en)"

if [[ $SUPPLEMENTS -eq 1 ]]; then
    upload "$FIXTURES/ICD11MMS-2026-01-supplement-es.json" "MMS 2026-01 (es supplement)"
    upload "$FIXTURES/ICD11MMS-2026-01-supplement-fr.json" "MMS 2026-01 (fr supplement)"
    upload "$FIXTURES/ICD11ICF-2026-01-supplement-es.json" "ICF 2026-01 (es supplement)"
    upload "$FIXTURES/ICD11ICF-2026-01-supplement-fr.json" "ICF 2026-01 (fr supplement)"
fi

if [[ $INCLUDE_FOUNDATION -eq 1 ]]; then
    upload "$FIXTURES/ICD11Foundation-2026-01-en.json" "Foundation 2026-01 (en)"
fi

echo "Done. Indexing may continue server-side for a few minutes — check $ONTO/CodeSystem before running ./run.sh."
