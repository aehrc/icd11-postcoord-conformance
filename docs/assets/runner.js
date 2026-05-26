// ICD-11 Postcoordination Conformance Suite — browser runner.
//
// Drives the same cases as run.sh, but from a static page: pastes a candidate
// FHIR base URL (and optionally an ICD-API base URL), GETs
//   {base}/CodeSystem/$validate-code?url={system}&code={expression}
// for every row in postcoord-suite.csv, parses Parameters.result, and renders
// the agreement matrix into a live-updating table.
//
// Vanilla JS, no framework, no build step. The CSV is shipped under
// docs/assets/postcoord-suite.csv so Jekyll serves it alongside this script.
//
// DESIGN: GET form of $validate-code is used to avoid a CORS preflight (no
// Content-Type negotiation, no custom headers beyond Accept). POST would also
// work but pulls in extra preflight complexity for no benefit here.

(function () {
  "use strict";

  const CSV_URL = document.currentScript.dataset.csv ||
    "./postcoord-suite.csv";

  // -------- CSV parsing ---------------------------------------------------

  // RFC-4180-ish parser that handles quoted fields, doubled-quote escapes,
  // and commas inside quotes. The suite CSV is well-formed; this is defensive
  // rather than exhaustive.
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
        else if (c === "\r") { /* skip */ }
        else { field += c; }
      }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const header = rows.shift();
    return rows
      .filter(r => r.length === header.length && r.some(v => v !== ""))
      .map(r => Object.fromEntries(header.map((h, idx) => [h, r[idx]])));
  }

  // -------- FHIR plumbing -------------------------------------------------

  function trimBase(url) {
    return (url || "").trim().replace(/\/+$/, "");
  }

  function validateCodeUrl(base, system, code) {
    const params = new URLSearchParams();
    params.set("url", system);
    params.set("code", code);
    return `${trimBase(base)}/CodeSystem/$validate-code?${params.toString()}`;
  }

  // Pull Parameters.result (valueBoolean) out of a FHIR Parameters response.
  // Returns true/false, or null when the response shape is something we don't
  // recognise (which we surface to the user rather than silently swallowing).
  function extractResult(json) {
    if (!json || typeof json !== "object") return null;
    if (json.resourceType !== "Parameters") return null;
    const param = (json.parameter || []).find(p => p && p.name === "result");
    if (!param) return null;
    if (typeof param.valueBoolean === "boolean") return param.valueBoolean;
    return null;
  }

  // One $validate-code call. Returns { result, error } where result is
  // true | false | null and error is a human-readable string (or null on
  // success — including the case where result is false).
  async function callValidateCode(base, system, code) {
    const url = validateCodeUrl(base, system, code);
    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/fhir+json" },
        // No credentials, no custom headers — keep the preflight surface flat.
      });
      if (!resp.ok) {
        return { result: null, error: `HTTP ${resp.status}` };
      }
      let json;
      try { json = await resp.json(); }
      catch (e) { return { result: null, error: "Non-JSON response" }; }
      // Many servers return an OperationOutcome on auth/CORS-policy errors
      // even with 200; surface that so the user knows.
      if (json && json.resourceType === "OperationOutcome") {
        const issue = (json.issue || [])[0] || {};
        const sev = issue.severity || "info";
        const diag = issue.diagnostics || issue.details && issue.details.text || "OperationOutcome";
        return { result: null, error: `OperationOutcome (${sev}): ${diag}` };
      }
      const result = extractResult(json);
      if (result === null) {
        return { result: null, error: "No Parameters.result in response" };
      }
      return { result, error: null };
    } catch (e) {
      // fetch() throws on network errors AND on CORS rejections — these are
      // indistinguishable from JS-land by design. Surface a clear hint.
      return { result: null, error: `CORS / network error (${e.message || e})` };
    }
  }

  // -------- Rendering ----------------------------------------------------

  function boolCell(v) {
    if (v === true) return '<span class="bool-true">true</span>';
    if (v === false) return '<span class="bool-false">false</span>';
    return '<span class="bool-null">-</span>';
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureRow(tbody, id) {
    let tr = tbody.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
    if (tr) return tr;
    tr = document.createElement("tr");
    tr.dataset.id = id;
    tr.innerHTML =
      `<td class="id"></td>` +
      `<td class="category"></td>` +
      `<td><code class="expression"></code></td>` +
      `<td class="expected"></td>` +
      `<td class="candidate"></td>` +
      `<td class="icdapi"></td>` +
      `<td class="agree"></td>`;
    tbody.appendChild(tr);
    return tr;
  }

  function setCell(tr, cls, html, title) {
    const td = tr.querySelector("." + cls);
    if (!td) return;
    td.innerHTML = html;
    if (title) td.title = title;
  }

  function updateRowStyling(tr, row) {
    tr.classList.remove("agree-true", "agree-false", "agree-pending");
    if (row.candidate === null && row.icdapi === null) {
      tr.classList.add("agree-pending");
      return;
    }
    // "agree" = candidate vs icdapi when both present; otherwise we colour
    // by candidate-vs-expected so single-backend runs still surface signal.
    let agree;
    if (row.icdapiRequested) {
      agree = (row.candidate !== null && row.icdapi !== null && row.candidate === row.icdapi);
    } else {
      agree = (row.candidate !== null && row.candidate === row.expected);
    }
    tr.classList.add(agree ? "agree-true" : "agree-false");
  }

  function updateSummary(el, rows, total) {
    const done = rows.filter(r => r.done).length;
    const candidateMatch = rows.filter(r => r.candidate === r.expected).length;
    const icdapiRequested = rows.some(r => r.icdapiRequested);
    const icdapiMatch = rows.filter(r => r.icdapi === r.expected).length;
    const agree = rows.filter(r => r.candidate !== null && r.icdapi !== null && r.candidate === r.icdapi).length;

    const parts = [
      `<strong>${done}</strong> / ${total} cases evaluated`,
      `<strong>${candidateMatch}</strong> / ${total} candidate matches suite`,
    ];
    if (icdapiRequested) {
      parts.push(`<strong>${icdapiMatch}</strong> / ${total} ICD-API matches suite`);
      parts.push(`<strong>${agree}</strong> / ${total} candidate &harr; ICD-API agreement`);
    }
    el.innerHTML = parts.join(" &middot; ");
  }

  // -------- Top-level orchestration --------------------------------------

  async function run(form, table, summary, exportBtn) {
    const candidateBase = trimBase(form.candidate.value);
    const icdapiBase    = trimBase(form.icdapi.value);
    const concurrency   = Math.max(1, Math.min(8, Number(form.concurrency.value) || 2));
    const runBtn        = form.querySelector("button[type=submit]");

    if (!candidateBase) {
      alert("Candidate FHIR base URL is required.");
      return;
    }

    // Reload the CSV every run — cheap, and lets users iterate on the
    // suite by editing it locally during dev.
    let cases;
    try {
      const resp = await fetch(CSV_URL, { cache: "no-cache" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      cases = parseCSV(text);
    } catch (e) {
      summary.innerHTML = `<span class="bool-false">Failed to load CSV: ${escapeHtml(e.message || e)}</span>`;
      return;
    }

    // Reset table.
    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";

    const rows = cases.map(c => ({
      id: c.id,
      category: c.category,
      expression: c.expression,
      system: c.system,
      expected: c.expectedValid === "true",
      candidate: null,
      candidateError: null,
      icdapi: null,
      icdapiError: null,
      icdapiRequested: !!icdapiBase,
      refguide: c.refguide,
      rationale: c.rationale,
      done: false,
    }));

    // Eagerly stub all rows so the user sees the full list immediately.
    for (const r of rows) {
      const tr = ensureRow(tbody, r.id);
      setCell(tr, "id", escapeHtml(r.id));
      setCell(tr, "category", escapeHtml(r.category));
      setCell(tr, "expression", escapeHtml(r.expression));
      setCell(tr, "expected", boolCell(r.expected));
      setCell(tr, "candidate", '<span class="pending">…</span>');
      setCell(tr, "icdapi", icdapiBase ? '<span class="pending">…</span>' : '<span class="bool-null">n/a</span>');
      setCell(tr, "agree", '<span class="pending">…</span>');
      tr.classList.add("agree-pending");
    }
    updateSummary(summary, rows, rows.length);
    runBtn.disabled = true;
    if (exportBtn) exportBtn.disabled = true;

    // Simple bounded-concurrency worker pool.
    let cursor = 0;
    async function worker() {
      while (true) {
        const idx = cursor++;
        if (idx >= rows.length) return;
        const r = rows[idx];
        const tr = tbody.querySelector(`tr[data-id="${CSS.escape(r.id)}"]`);

        const cand = await callValidateCode(candidateBase, r.system, r.expression);
        r.candidate = cand.result;
        r.candidateError = cand.error;
        setCell(tr, "candidate",
          cand.error ? `<span class="bool-null">err</span>` : boolCell(cand.result),
          cand.error || "");

        if (icdapiBase) {
          const ref = await callValidateCode(icdapiBase, r.system, r.expression);
          r.icdapi = ref.result;
          r.icdapiError = ref.error;
          setCell(tr, "icdapi",
            ref.error ? `<span class="bool-null">err</span>` : boolCell(ref.result),
            ref.error || "");
        }

        // agree column
        let agreeVal = null;
        if (icdapiBase) {
          if (r.candidate !== null && r.icdapi !== null) {
            agreeVal = (r.candidate === r.icdapi);
          }
        } else {
          if (r.candidate !== null) agreeVal = (r.candidate === r.expected);
        }
        setCell(tr, "agree", boolCell(agreeVal));
        r.done = true;
        updateRowStyling(tr, r);
        updateSummary(summary, rows, rows.length);
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    runBtn.disabled = false;
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn._rows = rows;
    }
  }

  function exportComparison(rows) {
    // Match run.sh's comparison.json shape so the same downstream tooling
    // (e.g. tools/render-report.py) works on browser-runner output.
    const out = rows.map(r => ({
      id: r.id,
      category: r.category,
      expression: r.expression,
      expected: r.expected,
      candidate: r.candidate,
      icdapi: r.icdapiRequested ? r.icdapi : null,
      agree: r.icdapiRequested
        ? (r.candidate !== null && r.icdapi !== null && r.candidate === r.icdapi)
        : null,
      refguide: r.refguide,
      rationale: r.rationale,
    }));
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "comparison.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // -------- Wiring -------------------------------------------------------

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("runner-form");
    const table = document.getElementById("runner-results");
    const summary = document.getElementById("runner-summary");
    const exportBtn = document.getElementById("runner-export");
    if (!form || !table || !summary) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      run(form, table, summary, exportBtn);
    });

    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        if (exportBtn._rows) exportComparison(exportBtn._rows);
      });
    }
  });
})();
