#!/usr/bin/env bash
# Run the postcoordination suite against both backends and produce a side-by-side diff.
#
# Usage:
#   ./run.sh [--onto URL] [--icdapi URL] [-h|--help]
#
# Both flags take a FHIR base URL (the part before /CodeSystem/$validate-code).
# Falls back to the baseUrl in the matching postman environment file if not given.
#
# Examples:
#   ./run.sh --onto http://localhost:8080/fhir --icdapi http://localhost:9000/fhir
#   ./run.sh --icdapi http://localhost:9000/fhir          # onto from env file
#
# Requires: newman (npm i -g newman or brew install newman), jq.

set -euo pipefail
cd "$(dirname "$0")"

ONTO=""
ICDAPI=""

usage () {
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
    exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --onto)   ONTO="$2";   shift 2 ;;
        --icdapi) ICDAPI="$2"; shift 2 ;;
        -h|--help) usage 0 ;;
        *) echo "unknown arg: $1" >&2; usage 1 ;;
    esac
done

run_backend () {
    local label=$1 env_file=$2 base_override=$3 out=$4
    local args=(run postcoord-suite.postman_collection.json
                -e "$env_file"
                -d postcoord-suite.csv
                --reporters cli,json
                --reporter-json-export "$out"
                --silent)
    if [[ -n "$base_override" ]]; then
        args+=(--env-var "baseUrl=$base_override")
    fi
    echo "== Running $label${base_override:+ ($base_override)} =="
    newman "${args[@]}" || true   # don't abort on test failures; we want both runs
}

run_backend "Ontoserver" onto.postman_environment.json    "$ONTO"   onto-results.json
run_backend "ICD-API"    icdapi.postman_environment.json  "$ICDAPI" icdapi-results.json

# Newman's JSON export does NOT include console.log output, but it does include each
# test's `assertions[].assertion` string. Our test script formats that as:
#   `{id} [{backend}] {expression} -> expected={bool}, actual={bool}`
# so we parse the string back into structured data.
extract_cases () {
    local file=$1
    jq -r '
        [
          .run.executions[]
          | .assertions[0]?
          | select(.assertion)
          | .assertion
          | capture("^(?<id>\\S+) \\[(?<backend>[^\\]]+)\\] (?<expression>.*) -> expected=(?<expected>true|false), actual=(?<actual>true|false)$")
          | { id, backend, expression, expected: (.expected == "true"), actual: (.actual == "true") }
        ]' "$file"
}

extract_cases onto-results.json   > onto-cases.json
extract_cases icdapi-results.json > icdapi-cases.json

# Join CSV metadata + per-backend results into comparison.json. Python handles CSV
# quoting properly (jq's `scan` regex mis-aligned columns when rationales contained
# commas).
python3 - <<'PY' > comparison.json
import csv, json, pathlib
here = pathlib.Path(__file__).parent if "__file__" in globals() else pathlib.Path(".")
meta = {}
with open("postcoord-suite.csv") as f:
    for row in csv.DictReader(f):
        meta[row["id"]] = row
def by_id(p): return {r["id"]: r for r in json.load(open(p))}
onto = by_id("onto-cases.json")
icdapi = by_id("icdapi-cases.json")
out = []
for cid, m in meta.items():
    o = onto.get(cid, {})
    i = icdapi.get(cid, {})
    out.append({
        "id":         cid,
        "category":   m["category"],
        "expression": m["expression"],
        "expected":   m["expectedValid"] == "true",
        "onto":       o.get("actual"),
        "icdapi":     i.get("actual"),
        "agree":      o.get("actual") == i.get("actual"),
        "refguide":   m["refguide"],
        "rationale":  m["rationale"],
    })
print(json.dumps(out, indent=2))
PY

echo
echo "== Comparison summary =="
{
    printf 'id\tcategory\texpected\tonto\ticdapi\tagree\texpression\n'
    jq -r '
        def show: if . == null then "-" else tostring end;
        .[] | [
            .id, .category,
            (.expected | show), (.onto | show), (.icdapi | show), (.agree | show),
            .expression
        ] | @tsv' comparison.json
} | column -t -s $'\t'

echo
total=$(jq 'length' comparison.json)
agreement=$(jq '[.[] | select(.agree == true)] | length' comparison.json)
onto_match=$(jq '[.[] | select(.onto == .expected)] | length' comparison.json)
icdapi_match=$(jq '[.[] | select(.icdapi == .expected)] | length' comparison.json)
printf 'Onto-vs-ICDAPI agreement: %s / %s\n' "$agreement"  "$total"
printf 'Onto matches suite:        %s / %s\n' "$onto_match" "$total"
printf 'ICD-API matches suite:     %s / %s\n' "$icdapi_match" "$total"
echo "Full per-case JSON: $(pwd)/comparison.json"
