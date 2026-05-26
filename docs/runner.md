---
layout: page
title: "Run the suite against your server"
permalink: /runner/
---

<link rel="stylesheet" href="{{ site.baseurl }}/assets/runner.css">

Paste the FHIR base URL of a terminology server that has the ICD-11 CodeSystems loaded, hit **Run**, and the page will fire every case in `postcoord-suite.csv` straight at the server from your browser. Results stream into the table as responses arrive. Optionally point the runner at a second server (typically the WHO ICD-API FHIR endpoint) to produce a cross-backend agreement matrix in the same shape as the CI-rendered [report]({{ site.baseurl }}/results/latest.html).

This runs entirely client-side. Nothing is sent anywhere except to the URLs you paste in.

<div class="cors-note" markdown="1">
**Heads-up: CORS.** Because the requests go straight from your browser to the terminology server, the server has to permit cross-origin requests from `https://aehrc.github.io`. If you see "CORS / network error" rows, that's the server's CORS configuration — not the runner. The same suite runs cleanly from `run.sh` because that script invokes the server over server-to-server HTTP with no browser security model in the way. See [Conformance Report Explained]({{ site.baseurl }}/conformance-report-explained/) for the equivalent CLI workflow.
</div>

<form id="runner-form" class="runner-form" autocomplete="off">
  <label for="candidate">Candidate base URL</label>
  <input type="url" id="candidate" name="candidate" required
         placeholder="https://your-tx-server.example.org/fhir">
  <div class="hint">FHIR base URL — the part before <code>/CodeSystem/$validate-code</code>. Trailing slash optional.</div>

  <label for="icdapi">ICD-API base URL <span style="font-weight:normal;color:#57606a">(optional)</span></label>
  <input type="url" id="icdapi" name="icdapi"
         placeholder="http://localhost:8081/fhir"
         title="Local docker default. WHO also runs a public instance at https://icdapi-fhir-testing-byfzd6budwdmbabf.northeurope-01.azurewebsites.net/fhir">
  <div class="hint">
    Defaults to the local docker container (<code>http://localhost:8081/fhir</code>). WHO also hosts a public testing instance at
    <code>https://icdapi-fhir-testing-byfzd6budwdmbabf.northeurope-01.azurewebsites.net/fhir</code>.
    Leave blank to skip the reference comparison.
  </div>

  <label for="concurrency">Concurrency</label>
  <input type="number" id="concurrency" name="concurrency" min="1" max="8" value="2">
  <div class="hint">Parallel in-flight requests per backend. Keep low to be polite.</div>

  <div class="actions">
    <button type="submit">Run</button>
    <button type="button" id="runner-export" class="secondary" disabled
            title="Export the live table as comparison.json, identical in shape to run.sh output">Download comparison.json</button>
  </div>
</form>

<div id="runner-summary">Idle. Fill in a candidate base URL and click <strong>Run</strong>.</div>

<table id="runner-results">
  <thead>
    <tr>
      <th>id</th>
      <th>category</th>
      <th>expression</th>
      <th>expected</th>
      <th>candidate</th>
      <th>icdapi</th>
      <th>agree</th>
    </tr>
  </thead>
  <tbody></tbody>
</table>

<script src="{{ site.baseurl }}/assets/runner.js"
        data-csv="{{ site.baseurl }}/assets/postcoord-suite.csv"></script>

## Notes for maintainers

- The suite CSV is the canonical source at the repo root (`postcoord-suite.csv`), and a build-time copy lives at `docs/assets/postcoord-suite.csv` so Jekyll serves it under the same Pages site as this script. **If you edit the root CSV, refresh the copy** (`cp postcoord-suite.csv docs/assets/postcoord-suite.csv`) — there is no automated sync. A pre-commit hook or a one-liner in the Pages workflow would close that gap.
- The runner uses the **GET** form of `$validate-code` (URL parameters), which keeps the request "simple" by CORS rules and avoids a preflight `OPTIONS`. That means the only header sent is `Accept: application/fhir+json`.
- The `agree` flag matches the CLI runner's semantics: `candidate === icdapi` when both backends are queried; falls back to `candidate === expected` when only the candidate is configured, so a single-server run still produces useful colour coding.
- "Download comparison.json" emits the same JSON shape as `run.sh`, so `tools/render-report.py` can render a browser-produced run identically to a CI run.
