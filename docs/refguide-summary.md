---
layout: page
title: "Reference Guide Summary"
permalink: /refguide-summary/
---

# WHO ICD-11 Reference Guide — local summary

A paraphrased summary of the WHO ICD-11 Reference Guide sections that govern postcoordination cluster handling. Scope is **only** the rules the conformance suite depends on; this is not a substitute for the full refguide.

**Source:** *Reference Guide for the Use of the International Classification of Diseases for Mortality and Morbidity Statistics, Eleventh Revision (ICD-11)*, WHO, edition aligned with `release/11/2026-01`. Online at `https://icdcdn.who.int/icd11referenceguide/en/html/index.html`. Section numbers here track WHO's numbering as of that edition. **Do not paste verbatim WHO prose into this file** — paraphrase, cite the section, and link to suite touchpoints.

For each rule below: a one-paragraph paraphrase, a syntactic shape, and the suite categories that exercise it.

---

## §2.9 — Precoordination & postcoordination (terminology baseline)

A **precoordinated** code carries its full clinical meaning in a single stem (e.g. `BA41.0` — *Acute ST elevation myocardial infarction*). A **postcoordinated** code refines a stem by combining it with one or more **extension codes** along defined axes (laterality, severity, anatomy, time-in-life, etc.). Extension codes are X-prefixed by convention (`X` followed by digits / letters) and never appear in the first position of a cluster — they always follow a stem.

| Suite categories | E.1-E.12 (parser rejections including "extension in first position"), and the implicit contract everywhere extensions appear |

---

## §2.10 — Cluster syntax

A **cluster** is a postcoordinated expression built from one or more groups separated by `/`. Each **group** is a stem followed by zero or more `&`-joined extensions:

```
cluster   := group ( "/" group )*
group     := stem ( "&" extension )*
stem      := non-X-prefixed code
extension := X-prefixed code
```

Two groups joined by `/` typically encode different clinical roles (e.g. underlying cause and manifestation, primary and secondary site). Within a group, all extensions modify the same stem.

| Touchpoint | Where |
|---|---|
| Grammar definition | `ClusterParser.parse` |
| Plugin trigger | `Icd11Plugin.looksLikeCluster` (fires on presence of `/` or `&`, excluding URI-form codes) |
| Suite cases | B (single-group), C (multi-stem), D (complex `stem&ext/stem&ext`) |
| Spec | "Cluster syntax recognition" + scenarios |

### §2.10.1 — Type-1 vs Type-2 extensions; replication prohibition

Extensions divide into two broad classes:

- **Type-1** — *stem-specific*. Each Type-1 extension belongs to a particular axis declared on a particular set of stems. Example: `XK8G` *Left* is valid on stems that declare a laterality axis, not on stems without one.
- **Type-2** — *universal*. A small set of extensions apply across many or all stems. See §2.10.3.

A separate policy in §2.10.1: a postcoordinated cluster **must not replicate** a meaning already carried by a precoordinated stem. E.g. if `CA41.0` precoordinates an existing combination, `CA41.Z&XN275` (the unspecified stem + an extension reconstructing what `CA41.0` already encodes) is non-conforming even if every token resolves. This is a content-modelling rule, not a syntactic one; whether `$validate-code` should enforce it is debatable.

| Touchpoint | Where |
|---|---|
| Plugin handles Type-1 today; Type-2 universals **outside current spec** | See `design.md` Open Questions — surfaced by suite cases I.1-4 and B.4-5 |
| Replication rule | Plugin does not enforce; suite category H probes both backends' behaviour |

### §2.10.2 — Worked examples and structural rules

The refguide walks through five canonical examples that fix the cluster grammar in the reader's mind. Roughly:

1. **Bare stem.** `BA41.0` — precoordinated, no cluster syntax involved.
2. **Stem with one extension.** `BA41.0&XA7RE3` — anatomy refinement.
3. **Two stems in one cluster.** `5A11/5A23` — multi-stem (the two groups represent different roles or layered conditions; the relationship is contextual, not encoded in the grammar).
4. **Same as 3 with reversed order.** `5A23/5A11` — still valid. Group order is not significant at the validation layer; it carries contextual meaning the validator does not interpret.
5. **Two groups, each with an extension.** `DD51&XK8G/ME24.2&XT5R` — both groups stand alone and combine.

The implicit structural rules behind these examples:

- A bare extension (no stem) is invalid (§2.9).
- An extension in first position is invalid (§2.9).
- Leading, trailing, or doubled separators are invalid (`/x`, `x/`, `//`, `&&`, `&x`).
- Group order is semantically meaningful but not validationally enforced — `5A11/5A23` and `5A23/5A11` are both well-formed (and the plugin treats them as equivalent for membership purposes; subsumption is set-based, see β/γ in `design.md`).

| Touchpoint | Where |
|---|---|
| Plugin parser implements each rule | `ClusterParser` — `EMPTY_INPUT`, `EMPTY_GROUP`, `EMPTY_STEM`, `EMPTY_EXTENSION`, `STEM_STARTS_WITH_X`, `EXTENSION_DOES_NOT_START_WITH_X` |
| Order-invariance at validation layer | `synthesizeClusterLookup` iterates groups independently |
| Order-invariance for subsumption | `design.md` decision "β / γ subsumption semantics" — γ treats groups as a set |
| Suite cases | A (Ex 1), B.1 (Ex 2), C.1-2 (Ex 3 & 4), D.1 (Ex 5), E.* (rule violations), L.1-2 (ordering invariance) |

### §2.10.3 — Type-2 universal extensions

Certain extensions are usable against any stem regardless of which axes the stem declares. The published examples include the `XY` series — `XY0Y` (laterality unspecified), `XY6M` (timing unspecified-as-acute-or-chronic), `XY69` (time-of-onset unspecified), and others ending in `XY99`-style "unspecified" sentinels. The refguide's worked example shows `BA41.Z&XY0Y` as a valid postcoordinated expression even though `XY0Y` is not in `BA41.Z`'s declared laterality VS — its universal status overrides the per-stem axis check.

The current ICD-11 plugin spec does **not** model universal extensions: every extension is required to be in one of the stem's declared axis ValueSets. Suite cases I.1-I.4 and B.4-B.5 demonstrate the gap (both Ontoserver and the WHO ICD-API container return false for these as of 2026-05-26; the suite's belief, grounded in this section, is true).

**The four-quadrant matrix** (extension type × stem axis presence) — the suite categories were re-organised on 2026-05-26 to cover all four:

| Stem state | Type-1 (stem-specific) ext | Type-2 (universal) ext |
|---|---|---|
| Stem declares Type-1 axes, ext in axis VS | **true** (refguide §2.10.1) — covered by B.1-3 | **true** (§2.10.3) — covered by I.1-4 / B.4-5 |
| Stem declares Type-1 axes, ext NOT in axis VS | **false** (§2.10.1) — covered by G.1-3 | **true** (§2.10.3 overrides axis check) — partially covered by I.1-4 |
| Stem declares no Type-1 axes | **false** (§2.10.1 — no axis to admit) — covered by O.1 | **true** (§2.10.3) — covered by O.2-4 |

The bottom-row distinction (Type-1 vs Type-2 on an axisless stem) is the suite's sharpest discriminator between three plugin behaviours: (a) "treat all extensions uniformly" (fails O.1 by accepting it, fails O.2-4 by rejecting them); (b) "strict Type-1 only" (today's plugin, passes O.1, fails O.2-4); (c) "Type-2-universal-aware" (passes all four).

**Detecting universal extensions in practice.** As of 2026-05-26 the WHO ICD-API container surface and the `jimsteel/ICD11toFHIR` converter output don't carry a machine-readable signal that distinguishes Type-1 from Type-2 — the editorial distinction in the WHO content model isn't preserved through the FHIR projection. A `$lookup` on `XY0Y` returns the same shape as `$lookup` on `XA7RE3`. Detection therefore needs one of:
- A converter-side marker (e.g. a `extensionType=universal` property on universal concepts) — the cleanest data-driven path.
- Runtime hierarchy lookup — load each extension's IS-A ancestors and test for membership in the universal-extensions parent ("Diagnosis Code Descriptors" block in the foundation).
- A curated VCL canonical for universals checked alongside the per-stem axis VSs.
- An XY-prefix heuristic — fast and wrong-in-general (the XY namespace isn't strictly universal).

| Touchpoint | Where |
|---|---|
| Open design question | `design.md` Open Questions — "Type-2 universal extensions" |
| Tracking | A separate openspec change (proposed name `add-icd11-type2-universals`) when prioritised |
| Suite cases | I.1-I.4 (universal Type-2 on a single stem with axes), B.4-B.5 (universal Type-2 alongside a Type-1 axis), O.1-O.4 (axisless-stem Type-1 vs Type-2 discrimination) |

### §2.10.4 — Axis multiplicity (`AllowMultipleValues`)

Each axis declares an `AllowMultipleValues` policy controlling how many values may populate it within a single cluster:

- **NotAllowed** — at most one value from this axis per group. `4A20&XT0S&XT4Z` is invalid if both extensions are from a `NotAllowed`-policy axis.
- **AllowedExceptFromSameBlock** — multiple values allowed only if they come from different top-level blocks of the axis VS. `PF2Y&XE266&XE9D` is valid if `XE266` and `XE9D` are in different blocks of the place-of-occurrence axis; `PF2Y&XE9XY&XE9P0` is invalid if both are descendants of the same block.
- **Allowed** (sometimes written **AllowAlways**) — no per-axis multiplicity restriction.

The policy is encoded in the converter's per-stem subproperty groups via the `allowMultipleValues` property pointing at the `ICD11AllowMultipleValues` companion CodeSystem.

| Touchpoint | Where |
|---|---|
| Plugin: not yet enforced (blocked on `#1313`) | `design.md` — Tier-B axis-VS validation block |
| Spec | "Axis-membership validation" requirement, scenario *NotAllowed multivalue violated* |
| Decision | `design.md` — `AllowedExceptFromSameBlock` defaults to AllowAlways in Phase 1 (no block notion yet) |
| Suite cases | K.1-K.3 (general `AllowMultipleValues`), N.1-N.4 (NotAllowed + AllowedExceptFromSameBlock) |

### §2.10.5 — Required axes and abstraction

Some stems declare one or more **required** axes. A cluster that fails to supply any extension for a required axis is well-formed syntactically but **abstract** — it does not refer to a fully-specified clinical concept. Per the spec's decision, abstract clusters are reported `abstract=true` rather than rejected outright: `$validate-code abstract=false` (the FHIR default) rejects them; `$validate-code abstract=true` accepts them.

The `required` flag is encoded in the converter's per-stem subproperty groups as `required=true` on the axis subproperty group.

| Touchpoint | Where |
|---|---|
| Plugin: not yet enforced (blocked on `#1313`) | `design.md` — same Tier-B block |
| Spec | "Missing required axis renders cluster abstract" requirement + three scenarios |
| Decision | `design.md` — "Missing required axis → abstract" |
| Suite cases | J.1 (required axis missing → abstract), J.2 (required axis supplied) |

---

## §2.11 — ICF differences

The International Classification of Functioning, Disability and Health (ICF) is included in the ICD-11 family and is published as a FHIR CodeSystem at `http://id.who.int/icd/release/11/icf`, but its postcoordination model is **not** the same as MMS:

- ICF uses **inline qualifiers** rather than cluster syntax. Classical ICF expressions of the form `b110.3` (a body-function code suffixed with a qualifier digit indicating severity) are not encoded as separate FHIR concepts in the converter's linearization — only the bare codes (`b110`, `d530`, `s410`, `e310`, `b1100`) are present.
- ICF does **not** use the ICD-11 `&` / `/` cluster grammar at all. Expressions like `b110&XA7RE3` (an MMS extension applied to an ICF code) or `b110/d530` (two ICF codes joined as if a multi-stem cluster) are non-conforming by §2.11, even when every individual token exists in the ICF CodeSystem.

This is the precise reason the plugin's claim surface needs to be sharper than "linearization": ICF is a linearization under `http://id.who.int/icd/release/11/` but is **not** a postcoordination-bearing linearization. See `design.md` Open Questions — "ICF claim — postcoord trigger needs to be narrower than 'linearization'".

| Touchpoint | Where |
|---|---|
| Open design question | `design.md` — ICF cluster trigger |
| Plugin: today claims ICF (regression risk on `b110/d530`) | `Icd11Plugin.isLinearization` accepts anything under `release/11/` |
| Suite cases | M.1-M.5 (bare ICF — valid), M.6-M.7 (classical qualifier syntax — not in linearization, expected false), M.8 / M.10 (attempted ICD-11 cluster syntax on ICF — expected false) |

---

## Section index — where each refguide section lights up in this repo

| Refguide | Plugin code | Spec requirement | Suite categories |
|---|---|---|---|
| §2.9 (terminology, extension prefix) | `ClusterParser` token validation | "Cluster syntax recognition" | E |
| §2.10 (grammar) | `ClusterParser.parse`, `Icd11Plugin.looksLikeCluster` | "Cluster syntax recognition", "Cluster-trigger by separator presence" | A, B, C, D, L |
| §2.10.1 (Type-1 vs Type-2; replication) | Type-1 axis-VS check in `isInAnyAxisVS`; Type-2 not modelled | "Axis-membership validation" (Type-1 only) | G, H, I, B.4-5 |
| §2.10.2 (worked examples) | All `Reason` cases in `ClusterParseException` | "Cluster syntax recognition" scenarios | A, B.1, C.1-2, D.1, E.*, L |
| §2.10.3 (universal Type-2) | **not modelled** — `design.md` Open Question | not in spec yet | I.1-4, B.4-5 |
| §2.10.4 (AllowMultipleValues) | Not enforced (blocked on `#1313`) | "Axis-membership validation" scenario *NotAllowed multivalue violated* | K, N |
| §2.10.5 (required axes / abstract) | Not enforced (blocked on `#1313`) | "Missing required axis renders cluster abstract" | J |
| §2.11 (ICF differences) | **claim surface too broad — regression risk** (`design.md` Open Question) | "Postcoordination handling scoped to linearizations" (needs narrowing) | M.6-7, M.8, M.10 |

---

## Updating this file

When WHO publishes a new refguide edition or the plugin's coverage changes, update the section index and the "Touchpoint" tables. Keep the prose paraphrased — if a verbatim WHO quotation is genuinely necessary (rare), keep it short, mark it as a quotation with attribution, and confirm it falls within fair-use bounds.
