# Claude project instructions — FortMilo website

Before reviewing, editing, or advising on this website, read GitHub issue #4 and follow this file as the current owner-approved naming/public-site direction.

## Binding naming rule

These decisions are final unless Luca Pacini explicitly reopens them:

- **Brand/company:** `FortMilo`
- **Product/app:** `Security Observatory`
- `FortMilo` is the canonical written brand casing.
- `FORTMILO` is allowed only as a deliberate visual/logo treatment.
- `Fortmilo` is not an approved written brand form.
- `Salesforce` is descriptive only and is never part of the formal product name.
- Do not routinely use `Security Observatory by FortMilo`.
- Do not use `FortMilo Security Observatory`, `Fortmilo Security Observatory`, `FORTMILO Security Observatory`, or `Salesforce Security Observatory` as the active formal product name.

## Website hierarchy

- Site/header brand: **FortMilo**
- Product navigation/item: **Security Observatory**
- Product page H1: **Security Observatory**
- FortMilo remains visually and semantically separate as the company/brand.
- Footer/legal wording may use **Luca Pacini, trading as FortMilo** where appropriate.

Do not ask Luca to reconfirm any of the above naming decisions.

## Current website action queue

Implement/review in this order:

1. Architecture product-level `Read-only first` -> **Read-only assessment**.
2. Scope the body to: **No security remediation or write-back to assessed Salesforce configuration.**
3. Keep sandbox-validation status on Home and Overview, and use **Request access when available** as the practical availability mechanism. Do not add a global availability banner/footer or repeat availability disclaimers on every technical page.
4. Correct H1 -> H3 heading gaps on affected review-area pages.
5. Add heading-order regression validation in `scripts/validate-site.mjs`.
6. Correct the Overview five-versus-six contradiction: there are five review-area cards plus Overview.
7. Remove the duplicate item-level `not product documentation` disclaimer from Documents while retaining the section-level disclaimer.
8. Keep the Acknowledgements page visibly linked from the shared footer on every route.

## Explicitly deferred / do not invent

- Dashboard screenshot: deferred until a genuine sanitised capture is approved.
- Social preview replacement: defer with the screenshot.
- Hosted contact/lead form: do not add now; visible `info@fortmilo.co.uk` is sufficient.
- Do not claim AppExchange Security Review progress or a release date without evidence.
- Do not fabricate screenshots, customer data, production evidence, endorsements, customers, testimonials, or readiness claims.

## Cross-repo authority

The Salesforce product repo has the binding requirement:

`docs/requirements/REQ-076-canonical-brand-product-identity.md`

and the detailed Claude handoff:

`docs/handoffs/CLAUDE-FORTMILO-SECURITY-OBSERVATORY-DECISIONS.md`

Related website governance issue: #4.

If older website copy, issue history, PDFs, or prior review notes conflict with the naming rule above, treat them as historical/stale and follow the current rule. Do not rewrite historical evidence merely to hide the old decision.
