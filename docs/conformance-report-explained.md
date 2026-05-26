---
layout: page
title: "Conformance Report Explained"
permalink: /conformance-report-explained/
---

The runner (`run.sh`) emits a structured `comparison.json` file. Each entry corresponds to one case from `postcoord-suite.csv`. This page explains the fields and how to interpret the agreement matrix.

## Schema

```json
{
  "id":         "B.1",
  "category":   "single-group-extensions",
  "expression": "BA41.0&XA7RE3",
  "expected":   true,
  "candidate":  true,
  "icdapi":     true,
  "agree":      true,
  "refguide":   "§2.10.2 Ex 1 (simplified)",
  "rationale":  "Single anatomy extension on axis-bearing stem"
}
```

| Field | Meaning |
|-------|---------|
| `id` | Stable case identifier (e.g. `B.1`). The letter encodes the category; the number is the position within the category. |
| `category` | Human-readable category slug from the CSV (e.g. `single-group-extensions`). Same as the letter mapping in [Categories](categories.html). |
| `expression` | The literal `code` value sent to `$validate-code`. May contain `&`, `/`, or be empty. |
| `expected` | The **suite's belief** about whether the expression should validate. Grounded in the refguide, but not authoritative. |
| `candidate` | The `Parameters.result` boolean returned by your candidate terminology server. `null` if the server didn't return a parseable response. |
| `icdapi` | The `Parameters.result` boolean returned by the WHO ICD-API FHIR endpoint. Same null semantics. |
| `agree` | `candidate === icdapi`. True when both backends produce the same answer, regardless of whether either matches `expected`. |
| `refguide` | Citation back to the WHO refguide section that justifies the `expected` value. |
| `rationale` | Free-text justification for the case. |

## How to read the agreement matrix

The interesting cases are *not* the ones where everything matches. Pay particular attention to four shapes:

### Both backends agree with `expected` (the boring case)

```json
{ "expected": true, "candidate":  true, "icdapi": true, "agree": true }
```

Sanity check passing. Move on.

### Both backends agree, but disagree with `expected`

```json
{ "expected": true, "candidate": false, "icdapi": false, "agree": true }
```

Either the suite belief is wrong (the refguide rule may be policy that neither backend enforces), or both backends share the same gap. This is data, **not** a bug report against either backend. Common causes:

- Type-2 universal extensions (category I, O.2-O.4) — neither implementation currently distinguishes universals from Type-1 stem-specifics.
- Replication-prohibition rule (category H) — content-modelling policy that `$validate-code` may legitimately not enforce.

### Backends disagree, one matches `expected`

```json
{ "expected": false, "candidate": false, "icdapi": true, "agree": false }
```

The candidate backend got it right per the refguide; the other did not (or vice versa). Worth investigating which interpretation is correct — sometimes the suite belief is right, sometimes the alternative reading is.

### Backends disagree, neither matches `expected`

```json
{ "expected": true, "candidate": false, "icdapi": null, "agree": false }
```

Likely an environmental issue (e.g. ICD-API container down, content missing, parser bug). `null` actuals are a flag to check the run log before treating the row as substantive.

## Caveats

- **`expected` is the WHO refguide oracle**, not the spec of any particular backend. The suite intentionally encodes rules that some backends may not enforce (replication prohibition, Type-2 universals, AllowMultipleValues policy) — surfacing the gap is the point.
- **Required-axis cases (J)** are particularly delicate. WHO models "required" via per-stem subproperty groups; whether the FHIR projection preserves the flag, and whether a backend chooses to enforce it at validate-time vs treating it as advisory, varies.
- **AllowMultipleValues (K, N) cases** depend on the per-axis policy declared in the WHO content model for the stems used. If WHO updates the content model, the suite's `expected` values may need to be revisited.
- **ICF cases (M)** probe converter coverage, not just validation. The current ICD11toFHIR converter emits only bare ICF concepts (no qualifier-bearing concepts like `b110.3`), so M.6-M.10 will fail on both backends until that changes.

## Summary metrics

`run.sh` also prints three aggregate counts:

```
Candidate-vs-ICDAPI agreement: 51 / 63
Candidate matches suite:       47 / 63
ICD-API matches suite:         49 / 63
```

These are quick health indicators but say less than the per-case shapes above. A drop in cross-backend agreement is the most useful trend to monitor over time — it tracks whether the two implementations are converging or diverging.
