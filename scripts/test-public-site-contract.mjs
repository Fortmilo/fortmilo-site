import assert from "node:assert/strict";
import { customerVisibleSurface, headingErrors, namingErrors } from "./public-site-contract.mjs";

assert.deepEqual(headingErrors("<h1>One</h1><h2>Two</h2><h3>Three</h3>"), []);
assert.ok(headingErrors("<h1>One</h1><h3>Three</h3>").some((value) => value.includes("skipped H1 to H3")));
assert.ok(headingErrors("<h1>One</h1><h1>Again</h1>").some((value) => value.includes("exactly one H1")));
assert.ok(headingErrors("<h2>Two</h2><h1>One</h1>").some((value) => value.includes("H1 must be first")));

for (const html of [
  "<p>Salesforce Security Observatory</p>",
  '<meta name="description" content="FortMilo Security Observatory">',
  '<meta property="og:title" content="Fortmilo Security Observatory">',
  '<meta name="twitter:image:alt" content="FORTMILO Security Observatory">',
  '<img alt="Salesforce Security Observatory" src="/safe.png">',
  '<nav aria-label="Security Observatory by FortMilo"></nav>',
  '<script type="application/ld+json">{"name":"Salesforce Security Observatory"}</script>'
]) {
  assert.ok(namingErrors(html, "test.html").length > 0, `expected naming failure for ${html}`);
}

assert.deepEqual(
  namingErrors(
    '<a href="https://github.com/Fortmilo/fortmilo-site/">Repository</a><img src="/assets/fortmilo-security-observatory-og-20260731.jpg" alt="FortMilo — Security Observatory">',
    "test.html"
  ),
  []
);

const surface = customerVisibleSurface('<meta name="description" content="Safe description"><img src="unsafe-name.jpg" alt="Safe alt">');
assert.ok(surface.includes("Safe description"));
assert.ok(surface.includes("Safe alt"));
assert.ok(!surface.includes("unsafe-name.jpg"));

console.log("Validated public-site contract fixtures");
