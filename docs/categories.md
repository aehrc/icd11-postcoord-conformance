---
layout: page
title: "Test Categories"
permalink: /categories/
---

Each row in `postcoord-suite.csv` carries an `id` like `B.3`, where the letter encodes the rule category. The category letters are deliberate but the alphabetical ordering is incidental — categories were added as new rules came into scope and renumbering would invalidate existing reports.

For each category below: the rule it exercises, the refguide section it traces to (with an anchor into [refguide-summary](refguide-summary.html)), and a one-line rationale for why the category exists.

## Category table

| Cat | Rule | What it exercises | Refguide |
|-----|------|-------------------|----------|
| **A** | Bare precoordinated stem | Sanity — no clustering needed. | [§2.10.2 rule 1](refguide-summary.html#2102--worked-examples-and-structural-rules) |
| **B** | Single-stem cluster with one or more extensions | Stem followed by Type-1 anatomy / Type-2 timing extensions joined by `&`. | [§2.10.2 Ex 1-2](refguide-summary.html#2102--worked-examples-and-structural-rules) |
| **C** | Multi-stem cluster | Two stems joined by `/` — combinations like "underlying cause / manifestation". | [§2.10.2 Ex 3-4](refguide-summary.html#2102--worked-examples-and-structural-rules) |
| **D** | Complex cluster | `stem & ext / stem & ext` — refguide §2.10.2 Example 5. | [§2.10.2 Ex 5](refguide-summary.html#2102--worked-examples-and-structural-rules) |
| **E** | Parser rejections | Trailing/leading/doubled separators, extension code in first position (§2.9), bare extensions, empty input. | [§2.9](refguide-summary.html#29--precoordination--postcoordination-terminology-baseline) / [§2.10.2](refguide-summary.html#2102--worked-examples-and-structural-rules) |
| **F** | Unknown codes | Existence checks on stem and extension tokens individually. | existence |
| **G** | Axis-membership violations | Extension is real but not in the stem's permitted axis VS (e.g. laterality on a stem with no laterality axis). | [§2.10.1](refguide-summary.html#2101--type-1-vs-type-2-extensions-replication-prohibition) |
| **H** | Policy violations — replicating a precoordinated meaning | §2.10.1 prohibits postcoordinating to encode something that already has a precoordinated stem. | [§2.10.1](refguide-summary.html#2101--type-1-vs-type-2-extensions-replication-prohibition) |
| **I** | Type-2 universal extensions | Diagnosis Code Descriptors (`XY0Y`, `XY6M`, `XY69`, `XY85`) should apply to any stem regardless of its Type-1 axes. | [§2.10.3](refguide-summary.html#2103--type-2-universal-extensions) |
| **J** | Required-axis missing -> abstract | `requiredPostcoordination=true` axes. Bare stem is abstract; cluster with the axis fulfilled is concrete. | [§2.10.5](refguide-summary.html#2105--required-axes-and-abstraction) |
| **K** | `AllowMultipleValues` semantics | Two values from a single axis where the axis policy is `NotAllowed` or `AllowedExceptFromSameBlock`. | [§2.10.4](refguide-summary.html#2104--axis-multiplicity-allowmultiplevalues) |
| **L** | Cluster ordering (mortality vs morbidity) | Both `5A11/5A23` and `5A23/5A11` are syntactically valid; the ordering is interpreted, not validated. | [§2.10.2 Ex 3-4](refguide-summary.html#2102--worked-examples-and-structural-rules) |
| **M** | ICF cases (`http://id.who.int/icd/release/11/icf`) | Bare ICF body-function / activity / structure / environmental codes (M.1-M.5); classical inline-qualifier syntax `b110.3` (M.6-M.7); attempted MMS-style cluster syntax on ICF codes (M.8, M.10). | [§2.11](refguide-summary.html#211--icf-differences) |
| **N** | `AllowMultipleValues` corner cases | `NotAllowed`, `AllowedExceptFromSameBlock` policies with multiple values from the same axis / block. | [§2.10.4](refguide-summary.html#2104--axis-multiplicity-allowmultiplevalues) |
| **O** | Axisless-stem cases (Type-1 vs Type-2 discrimination) | Stem with no declared postcoordination axes. O.1: Type-1 stem-specific extension on it (false per §2.10.1). O.2-O.4: Type-2 universal extensions on it (true per §2.10.3). | [§2.10.1](refguide-summary.html#2101--type-1-vs-type-2-extensions-replication-prohibition) / [§2.10.3](refguide-summary.html#2103--type-2-universal-extensions) |

## Per-category rationale

### A — Precoordinated baseline

A precoordinated stem encodes the full clinical meaning in one code; no cluster syntax is involved. Cases A.1-A.2 are baseline sanity checks: any backend that returns `false` here cannot be expected to work for postcoordinated input.

### B — Single-stem cluster

The simplest postcoord shape: `stem & ext` (B.1), `stem & ext & ext` (B.2-3), with both Type-1 and Type-2 extensions probed.

### C — Multi-stem cluster

Two stems joined by `/`. The pair encodes a combination — underlying cause / manifestation, mortality UCOD order, or other refguide-blessed pairings. Group order is **not** validated (see L).

### D — Complex cluster

The fully-general shape: `stem & ext / stem & ext`. If a backend handles A through C but not D, the parser is probably special-casing instead of running the recursive cluster grammar.

### E — Parser rejections

Twelve cases exercising every structural-rule violation in §2.10.2: leading/trailing/doubled separators, bare extensions, extension-in-first-position, empty input, and stem-in-extension-position (E.11-12).

### F — Unknown codes

Existence checks. A known stem with an unknown extension token (F.1), an unknown stem with a known extension (F.2), and an entirely unknown code (F.3).

### G — Axis-membership

The extension code exists, but is not in the stem's permitted axis ValueSet. A laterality extension on a non-lateralised stem; a fracture extension on a non-fracture stem. Tests whether the backend consults the stem's axis VS or just confirms each token exists somewhere.

### H — Policy: replication prohibition

§2.10.1 explicitly disallows using postcoordination to encode something that already has a precoordinated stem. Whether `$validate-code` should reject this is a policy choice — both backends may legitimately accept H.1 and H.2 if they choose not to enforce content-modelling rules at the validate layer.

### I — Type-2 universal extensions

The `XY` series of diagnosis-code descriptors should apply to any stem regardless of declared axes. As of 2026-05-26 neither Ontoserver's experimental ICD-11 plugin nor the WHO ICD-API FHIR container surfaces a Type-2 marker — see refguide §2.10.3 for the open detection question.

### J — Required-axis missing -> abstract

When a stem declares an axis as required (`requiredPostcoordination=true`), the bare stem is "abstract" — well-formed but not fully specified. J.1 probes that; J.2 supplies the required axis.

### K — AllowMultipleValues general

Two values from a single axis where the axis declares its multi-value policy as `NotAllowed`. Speculative — the per-axis policy values used here may not be exact for the chosen stems; the comparison surfaces the actual answer.

### L — Cluster ordering invariance

Both `5A11/5A23` and `5A23/5A11` are syntactically valid (§2.10.2 Ex 3 and 4). The order carries clinical interpretation (mortality vs morbidity) but the validation layer does not enforce it.

### M — ICF cases

ICF is a separate linearization under `http://id.who.int/icd/release/11/icf` that does **not** use cluster syntax. Classical ICF expressions use inline qualifiers (`b110.3`) which are not encoded as distinct concepts in the FHIR projection. M.1-M.5 confirm bare ICF concepts validate; M.6-M.7 confirm inline-qualifier syntax fails; M.8 and M.10 confirm MMS-style clustering on ICF codes fails.

### N — AllowMultipleValues corner cases

Targeted probes of the two non-trivial multi-value policies: `NotAllowed` (N.1 positive, N.2 violation) and `AllowedExceptFromSameBlock` (N.3 allowed across blocks, N.4 violation within a block).

### O — Axisless-stem Type-1 vs Type-2 discrimination

The sharpest discriminator in the suite. A stem with **no declared postcoordination axes** must reject any Type-1 (stem-specific) extension (O.1), and must accept any Type-2 (universal) extension (O.2-O.4). A backend that treats all extensions uniformly will fail at least one of the four. A backend with strict Type-1 enforcement but no Type-2 awareness will fail O.2-O.4.
