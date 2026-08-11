# Security Observatory Evidence Terminology Contract

**Contract version:** 1.0  
**Status:** Canonical  
**Effective date:** 11 August 2026

This document is the authoritative terminology contract for Security Observatory evidence states, coverage, severity and completeness language.

The Salesforce implementation, public website, diagrams, validators and any technical publication that uses these terms must conform to this contract. Older wording that conflicts with this contract is superseded.

## 1. Rendered evidence state

Rendered evidence state answers one question: **what state can the product truthfully show for the evidence available for this assessment?**

The canonical rendered states are:

| State | Meaning |
| --- | --- |
| **Contextual metric or finding label** | The assessment completed with usable evidence and the product has retained a metric, finding or other bounded contextual result supported by that evidence. |
| **None found** | The required evidence was successfully assessed and no matching records were observed in the assessed scope. This is not a pass, compliance decision or proof that exposure cannot exist outside the assessed sources. |
| **Unavailable** | The assessment was attempted, but required evidence could not be obtained or used. The result must carry a bounded cause, limitation and safe next action where available. An attempted source, authentication or read failure is Unavailable, not Not assessed and not None found. |
| **Not assessed** | The question was not assessed for the relevant run, scope or evidence level. This state is for non-assessment, not for an attempted source failure. |
| **Not retained at this evidence level** | The evidence may have been assessed, but the relevant detail was intentionally not retained at the selected evidence level. |
| **Not captured** | The product does not capture the relevant evidence or field for this result. |
| **Not applicable** | The question does not apply to the assessed context. |

### Decision rule

Use these distinctions consistently:

1. **Assessment attempted and required source/read failed → Unavailable.**
2. **Question not assessed for the run, scope or evidence level → Not assessed.**
3. **Assessment completed successfully and returned zero matching records → None found.**

These states must never be collapsed into one another.

## 2. Reserved warning token

**Unknown** is not a general rendered evidence state and must not be used as a substitute for Unavailable.

It is reserved only for the bounded retained-evidence read warning used when a retained-evidence read itself cannot establish the expected value. This is the **EV-04** condition in the supporting assurance record. Any such use must remain explicitly scoped to that warning condition.

Generic **Unknown/Error** wording is not part of the canonical rendered vocabulary.

## 3. Coverage

Coverage is a separate axis from rendered evidence state. It describes how far available evidence can assess a mapped question.

The canonical Coverage values are:

- **Automated**
- **Partial Evidence**
- **Manual Required**
- **Not Covered**
- **Extended Check**

Coverage must not be presented as a confidence score, compliance decision or rendered evidence state.

## 4. Severity

Severity is a separate axis from rendered evidence state and Coverage.

The canonical Severity values are:

- **Critical**
- **High**
- **Moderate**

Severity describes prioritisation of a retained finding or risk context. It does not mean that a control passed or failed.

## 5. Completeness qualifier

**Partial** is a completeness qualifier, not a rendered evidence state.

Where a usable count is retained but required scope is incomplete:

- the usable count may be shown as **Partial**; and
- the missing scope must be identified separately using **Not assessed** or **Unavailable**, according to the decision rule in section 1.

Partial must never be used to hide an unavailable source or to convert incomplete evidence into a zero.

## 6. Historical evidence and comparison

Historical retained evidence is not rewritten when this contract changes.

- Scans created before terminology-contract version stamping are **pre-contract / unversioned** evidence.
- A legacy `Not assessed` value is not silently reinterpreted as v1.0 `Unavailable`.
- New scans retain the terminology contract version used for their comparison semantics.
- Comparison is available only when both scans carry the same supported terminology contract version, in addition to any separate like-for-like evidence-depth and source-organisation requirements.
- If either terminology version is missing, differs or is unsupported, comparison is **Unavailable** and must not imply improvement, resolution, worsening or newly observed evidence.
- Existing pre-contract scans are not backfilled merely to make them comparable.

The deliberate consequence is that scans created before terminology version stamping become unavailable for v1.0 comparison once the version gate ships. Preserving historical meaning takes precedence over manufacturing a comparison across incompatible semantics.

## 7. Consumer surfaces

The following public website surfaces consume this contract and must be checked together whenever the contract changes:

1. Home
2. Security Observatory Overview
3. Findings
4. Identity & Access
5. External Connections
6. Entitlements & Assets
7. Evidence & Coverage
8. Architecture & Security, including all diagrams and accompanying prose
9. Documents

The Salesforce application, validators and technical whitepapers are also conforming artefacts and must be checked before publication or release.

Terms, Privacy, Contact and Acknowledgements are included in whole-site regression because they share navigation, footer and partner-status presentation, but they are not terminology consumers.

## 8. Change procedure

This contract is frozen at the version shown above.

A terminology change is permitted only when all of the following occur:

1. The contract version is incremented.
2. The meaning of the changed term is updated here first.
3. Every conforming artefact identified in section 7 is audited against the new contract.
4. The Salesforce implementation and validators are checked for conformity.
5. Technical publications identified as conforming artefacts in section 7 are checked for conformity.
6. The conformity determination for each artefact is recorded before the changed terminology is published or released.
7. All identified deltas are resolved before the changed terminology is published as current.

No consuming surface may silently introduce, redefine or retire a canonical term.

## 9. Publication rule

This contract defines terminology. It does not by itself prove scanner coverage, installation compatibility, release validation, compliance, security, or the existence of evidence in a particular Salesforce organisation.

Product and publication claims must remain bounded by the evidence that supports them.
