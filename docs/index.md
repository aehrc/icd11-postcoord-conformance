---
layout: page
title: "ICD-11 Postcoordination Conformance Suite"
---

This site documents a portable conformance test suite for **ICD-11 postcoordinated cluster expressions** evaluated against FHIR terminology servers via `CodeSystem/$validate-code`. The suite runs side-by-side against two backends — your candidate server and the WHO ICD-API FHIR endpoint — and diffs per-case agreement. No coupling to any specific terminology server implementation.

## Purpose

The WHO ICD-11 Reference Guide defines a non-trivial postcoordination grammar (§2.9-§2.11). Terminology servers vary in how completely they enforce it. The four-quadrant matrix below (extension class x stem axis presence) is the spine of the suite:

| Stem state | Type-1 (stem-specific) extension | Type-2 (universal) extension |
|---|---|---|
| Declares Type-1 axes, ext in axis VS | **valid** | **valid** |
| Declares Type-1 axes, ext not in axis VS | **invalid** (axis policy) | **valid** (universal overrides) |
| Declares no Type-1 axes | **invalid** (no axis admits it) | **valid** (§2.10.3) |

A backend that "treats all extensions uniformly" fails the bottom-left and the right-hand column. A backend with strict Type-1 axis-VS membership but no Type-2 awareness passes the top-left and bottom-left, but fails Type-2 cases.

See [Categories](categories.html) for the full per-category breakdown (A through O, 18 categories, 63 cases at scaffold time) and [Reference Guide Summary](refguide-summary.html) for the paraphrased WHO rules each category traces back to.

## Latest results

A scheduled CI run (see `.github/workflows/nightly-conformance.yml`) executes the suite weekly against the WHO ICD-API container and publishes the rendered HTML report below.

- [Latest report](results/latest.html) (refreshed by CI; placeholder until the workflow has run)

Dated runs are kept under `results/icd-api-YYYY-MM-DD.html` so trends are visible over time.

## How to read a report

Each case carries an `expected` (the suite's belief, grounded in the refguide), and per-backend `candidate` / `icdapi` actuals. The `agree` flag is `candidate === icdapi`. A row where both backends agree but disagree with `expected` is interesting — it means either the suite belief is wrong or both backends share the same gap. See [Conformance Report Explained](conformance-report-explained.html).

## How to run against your server

The repository ships everything needed to run the suite locally:

```bash
git clone https://github.com/aehrc/icd11-postcoord-conformance.git
cd icd11-postcoord-conformance

# Newman-based comparison (need newman + jq).
brew install newman jq                # or: npm i -g newman

# Point at your candidate server and a WHO ICD-API endpoint.
./run.sh --candidate http://localhost:8080/fhir \
         --icdapi    http://localhost:9000/fhir
```

Outputs land in `comparison.json` (machine-readable) and a summary table on stdout. See the [repo README](https://github.com/aehrc/icd11-postcoord-conformance#quick-start) for Postman desktop instructions and the one-time CodeSystem fixture upload (via standard FHIR REST — works with any terminology server).

## Caveats

- **Suite belief is not authoritative.** §2.10 carries policy rules (e.g. "do not replicate a precoordinated code") that a `$validate-code` operation may or may not enforce. Disagreement on those cases is data, not a bug.
- **`expected` is the WHO refguide oracle**, not what any given backend chooses to enforce.
- **Required-axis and AllowMultipleValues cases (J, K, N) are speculative** in places — they probe published policy and the agreement matrix surfaces gaps in either side.

## Repository

Source code, CSV, Postman collection, run script, and CI workflow live at:
**[github.com/aehrc/icd11-postcoord-conformance](https://github.com/aehrc/icd11-postcoord-conformance)**
