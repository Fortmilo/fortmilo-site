# Security Observatory Evidence Terminology Contract

**Contract version:** 1.1
**Status:** Canonical — current
**Effective date:** 29 August 2026

This document is the authoritative terminology contract for Security Observatory evidence states, source availability, completeness, Coverage and licence-assignment capture status. These are separate axes and must not be collapsed.

## 1. Rendered evidence state

Rendered evidence state answers: **what state can the product truthfully show for the evidence available for this assessment?**

| State | Meaning |
| --- | --- |
| **Contextual metric or finding label** | The assessment completed with usable evidence and retained a bounded result supported by that evidence. |
| **None found** | The required evidence was successfully assessed and no matching records were observed in scope. This is not a pass or compliance decision. |
| **Unavailable** | Assessment was attempted, but a required source could not be obtained or used. Include a bounded cause, limitation and safe next action where available. |
| **Not assessed** | The question was not assessed for the run, scope or evidence detail level. |
| **Not retained at this evidence level** | Evidence may have been assessed, but the detail was intentionally not retained at the selected evidence detail level. |
| **Not captured** | The product does not capture the relevant evidence or field for this result. |
| **Not applicable** | The question does not apply to the assessed context. |

Decision rule: an attempted but inaccessible or unusable required source is **Unavailable**; a question not assessed is **Not assessed**; a successful assessment returning no matching records is **None found**. **Incomplete** is not a rendered evidence state.

## 2. Source availability

Source availability records whether each required source was accessible and usable. An attempted required source that is inaccessible or unusable is **Unavailable**. Availability must remain distinct from completeness, Coverage, capture status and rendered evidence state.

## 3. Completeness qualifier

**Partial** is the general completeness qualifier, not a rendered evidence state or licence-assignment capture status. A usable result may be Partial when required scope is incomplete; identify missing scope separately as Not assessed or Unavailable under the decision rule.

## 4. Licence-assignment capture status

Licence-assignment capture status is a separate axis used only for retained assignment evidence:

- **Complete** — the full assignment population for that licence family was retained.
- **Incomplete** — some usable assignment evidence was retained, but the full population could not be retained safely.
- **Unavailable** — assignment capture was attempted, but required assignment evidence could not be obtained or used.

Incomplete must never be rendered as an evidence state. A capped retained count is not an exact organisation total.

## 5. Coverage

Coverage describes how far available evidence can assess a mapped question. Its values are **Automated**, **Partial Evidence**, **Manual Required**, **Not Covered** and **Extended Check**. Coverage is not availability, completeness, capture status, confidence, compliance or rendered evidence state.

## 6. Severity and reserved warning

Severity values are **Critical**, **High** and **Moderate**. Severity is prioritisation, not a pass/fail decision. **Unknown** is reserved only for the bounded EV-04 retained-evidence read warning and is not a general rendered evidence state.

## 7. Evidence detail levels and licence assignments

The evidence detail levels are **Top Issues**, **Balanced** and **Everything**.

- Top Issues retains no licence-assignment rows or assignment-summary rows.
- Balanced retains holding summaries only; individual assignment identities are Not captured.
- Everything performs bounded assignment capture for Package Licences, Permission Set Licences and Salesforce User Licences. It retains at most 1,000 assignment rows per family. The theoretical maximum is 3,000 rows, but safe capture can be lower because Salesforce transaction and DML headroom must be preserved.
- Licence-capacity totals and holding summaries are separate from individual assignment evidence.

Use “evidence detail level”, not “evidence depth”, for these levels.

## 8. Historical evidence and comparison

Historical retained evidence is not rewritten when terminology changes. Public claims that runtime scans are terminology-version stamped or comparison-gated require source evidence. Until that evidence exists, those capabilities are future behaviour and must not be described as current.

## 9. Publication and change rule

This contract defines terminology; it does not prove scanner coverage, installation compatibility, release validation, compliance, security or evidence in a particular Salesforce organisation. A later contract must be published separately, audit all consuming artefacts and preserve frozen earlier versions unchanged.
