import assert from "node:assert/strict";
import { customerVisibleSurface, headingErrors, namingErrors } from "./public-site-contract.mjs";

// Regression fixtures for the public naming and heading contract.
assert.deepEqual(headingErrors("<h1>One</h1><h2>Two</h2><h3>Three</h3>"), []);
assert.ok(headingErrors("<h1>One</h1><h3>Three</h3>").some((value) => value.includes("skipped H1 to H3")));
assert.ok(headingErrors("<h1>One</h1><h1>Again</h1>").some((value) => value.includes("exactly one H1")));
assert.ok(headingErrors("<h2>Two</h2><h1>One</h1>").some((value) => value.includes("H1 must be first")));

for (const html of [
  "<p>Salesforce Security Observatory</p>",
  '<meta name="description" content="FortMilo">',
  '<meta property="og:title" content="FORTMILO">',
  '<meta name="twitter:image:alt" content="Fortmilo Security Observatory">',
  '<img alt="Salesforce Security Observatory" src="/safe.png">',
  '<script type="application/ld+json">{"name":"Salesforce Security Observatory"}</script>'
]) {
  assert.ok(namingErrors(html, "test.html").length > 0, `expected naming failure for ${html}`);
}

for (const html of [
  '<p>Fortmilo</p>',
  '<nav aria-label="Security Observatory by Fortmilo"></nav>',
  '<img src="/assets/fortmilo-security-observatory-og-20260731.jpg" alt="Fortmilo — Security Observatory">'
]) assert.deepEqual(namingErrors(html, "test.html"), []);

const surface = customerVisibleSurface('<meta name="description" content="Safe description"><img src="unsafe-name.jpg" alt="Safe alt">');
assert.ok(surface.includes("Safe description"));
assert.ok(surface.includes("Safe alt"));
assert.ok(!surface.includes("unsafe-name.jpg"));

console.log("Validated public-site contract fixtures");
