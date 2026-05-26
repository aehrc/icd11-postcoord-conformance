# ICD-11 Postcoordination Conformance Suite

A portable, CSV-driven conformance test suite for **ICD-11 postcoordinated cluster expressions**, evaluated against any FHIR terminology server that implements `CodeSystem/$validate-code`. Designed to run side-by-side against two backends — your candidate server and the WHO ICD-API FHIR endpoint — and diff per-case agreement. No coupling to any specific terminology server implementation.

The test cases are keyed to the WHO ICD-11 [Reference Guide](https://icdcdn.who.int/icd11referenceguide/en/html/index.html) §2.9-§2.11, and ship with a paraphrased [reference guide summary](docs/refguide-summary.md) that maps each rule to the suite category that exercises it.

Project page (GitHub Pages): **TODO: `https://aehrc.github.io/icd11-postcoord-conformance/`** (placeholder — populated once Pages is enabled, see "Bootstrapping" below).

## Layout

```
postcoord-suite.csv                      # canonical test data (63 cases, 18 categories, source of truth)
postcoord-suite.postman_collection.json  # single parameterised $validate-code request
candidate.postman_environment.json       # baseUrl + backendLabel for your candidate server
icdapi.postman_environment.json          # baseUrl + backendLabel for the WHO ICD-API FHIR reference
run.sh                                   # newman runner + jq diff -> comparison.json
upload-codesystems.sh                    # one-time fixture upload via FHIR REST POST /CodeSystem
tools/render-report.py                   # comparison.json -> self-contained HTML report
docs/                                    # GitHub Pages source (Jekyll, minima theme)
.github/workflows/nightly-conformance.yml  # weekly CI run + report publish
```

## Quick start (Newman / CLI)

```bash
brew install newman jq                  # or: npm i -g newman

# One-time: upload ICD-11 CodeSystems into your terminology server via
# standard FHIR REST. Reads ICD11toFHIR converter output from
# ~/code/ICD11toFHIR/target by default.
./upload-codesystems.sh --server http://localhost:8080/fhir

# Each run: compare your candidate server vs the WHO ICD-API.
./run.sh --candidate http://localhost:8080/fhir \
         --icdapi    http://localhost:9000/fhir
# Outputs: candidate-results.json, icdapi-results.json, comparison.json
```

Both `--candidate` and `--icdapi` are optional — each falls back to the `baseUrl` in the corresponding `*.postman_environment.json`. `./run.sh --help` for full usage.

The ICD-API endpoint is typically a local docker container the WHO publishes that exposes a FHIR endpoint — the default `icdapi.postman_environment.json` points at `http://localhost:8081/fhir`. WHO also operates a hosted Azure FHIR-testing endpoint, used by the CI workflow in this repo; pass `--icdapi <url>` to point at any endpoint you prefer.

`upload-codesystems.sh` uses `POST /CodeSystem` with `application/fhir+json` — works against any FHIR terminology server that accepts CodeSystem resources (Ontoserver, the HAPI reference server, Snowstorm, etc.).

## Quick start (Postman desktop)

1. Open Postman, import `postcoord-suite.postman_collection.json` and both `*.postman_environment.json` files.
2. Pick the **Candidate FHIR terminology server (local)** or **WHO ICD-API (FHIR)** environment.
3. Open the Runner, attach `postcoord-suite.csv` as the data file, and run. Each iteration sends one `$validate-code` and checks the `Parameters.result` boolean against the CSV's `expectedValid`.

For machine-readable diffing across backends, use `run.sh` — Postman desktop runs are convenient but `comparison.json` is the canonical artifact.

## Reading the report

`run.sh` prints an aggregate summary and writes `comparison.json` (one entry per case). See [docs/conformance-report-explained.md](docs/conformance-report-explained.md) for the field-by-field schema and how to interpret per-case agreement / disagreement.

Quick mental model: `expected` is the **suite's belief** (grounded in the WHO refguide); `candidate` and `icdapi` are what each backend actually returns; `agree` is `candidate === icdapi`. A row where both backends agree but disagree with `expected` is interesting — that's data, not a bug report.

## Test categories

Eighteen categories (letters A through O); see [docs/categories.md](docs/categories.md) for the full table and per-category rationale. Highlights:

- **A-D** — well-formed cluster shapes (bare stem, single-stem cluster, multi-stem, complex).
- **E** — parser rejections (every structural-rule violation in §2.10.2).
- **G** — axis-membership violations (extension exists but not in the stem's axis VS).
- **I, O** — the Type-1 vs Type-2 discrimination — the suite's sharpest probe of plugin behaviour.
- **J, K, N** — required axes (abstract codes) and `AllowMultipleValues` policies.
- **M** — ICF cases (does the backend correctly *refuse* to apply MMS cluster syntax to ICF codes?).

## Adjusting the suite

Add a row to `postcoord-suite.csv`; that's the only file Newman reads. Available Postman variables per iteration: `{{id}}`, `{{expression}}`, `{{system}}`, `{{expectedValid}}`, `{{category}}`, `{{rationale}}`, `{{refguide}}`.

## Caveats

- **Suite belief is not authoritative.** Some refguide rules (e.g. replication prohibition in §2.10.1) are content-modelling policy that a `$validate-code` implementation may legitimately not enforce. Treat backend disagreement on those rows as data.
- **Required-axis (J) and AllowMultipleValues (K, N) cases are sensitive to content-model details** — the per-axis policy values published by WHO and preserved through the FHIR projection may shift between releases.
- **Your server's fixtures must be complete enough** to exercise the rules — if a stem the suite references isn't loaded, the case returns false with `NOT_IN_CS` regardless of the cluster logic. Load the full MMS linearization (and ICF, axis lookups) via `upload-codesystems.sh` for meaningful results.
- **ICF cases (M.6-M.10)** probe converter coverage as well as validation; the current ICD11toFHIR linearization emits only bare ICF concepts (no `b110.3`).

## Pages site

The `docs/` tree is the Jekyll source for a GitHub Pages site. It mirrors the per-category breakdown and reference-guide summary, and (after the first nightly CI run) carries the rendered HTML conformance reports under `docs/results/`.

Local preview (optional):

```bash
cd docs
bundle init && bundle add jekyll jekyll-theme-minima
bundle exec jekyll serve --baseurl ""    # localhost:4000
```

## Bootstrapping as a real repo

This directory is a standalone scaffold. To publish it:

```bash
cd /path/to/icd11-postcoord-conformance

# git init has already been run in the scaffold, with an initial commit ready
# to push. To push to a new GitHub repo under aehrc:

gh repo create aehrc/icd11-postcoord-conformance \
    --source=. --public --push \
    --description "Conformance test suite for ICD-11 postcoordinated cluster expressions"

# Then enable GitHub Pages: Settings -> Pages -> Source = Deploy from a branch,
# Branch = main, folder = /docs. Apply.
#
# After Pages is enabled, the project URL above will be:
#   https://aehrc.github.io/icd11-postcoord-conformance/
# Update the TODO link at the top of this README with that URL.
```

The nightly workflow at `.github/workflows/nightly-conformance.yml` is **disabled in effect until the WHO ICD-API container image name is filled in** (search for `TODO` in that file). Once Pages is enabled and the image is verified, the workflow will run weekly (Mon 04:00 UTC) and publish reports under `docs/results/`.

## License

Apache License, Version 2.0. See [LICENSE](LICENSE).

Copyright Commonwealth Scientific and Industrial Research Organisation (CSIRO) — Australian e-Health Research Centre (AEHRC).
