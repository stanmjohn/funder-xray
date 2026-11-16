// Every committed example is rebuilt from its fixture and compared to the
// file in examples/ byte for byte. The README's Example excerpt is checked
// against the example it quotes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NAMES, EXAMPLES, renderExample } from "../scripts/examples.mjs";

for (const name of NAMES) {
  test(`examples/${name}.md rebuilds exactly from its fixture`, () => {
    assert.equal(renderExample(name), readFileSync(`${EXAMPLES}${name}.md`, "utf8"));
  });

  test(`examples/${name}.md carries the PLACEHOLDER banner`, () => {
    assert.match(readFileSync(`${EXAMPLES}${name}.md`, "utf8"), /\*\*PLACEHOLDER\. This (foundation|organization) is made up\.\*\*/);
  });
}

test("the README excerpt matches the example it quotes", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const blocks = [...readme.matchAll(/<!-- excerpt from (examples\/[\w-]+\.md) -->\n([\s\S]*?)\n<!-- end excerpt -->/g)];
  assert.ok(blocks.length > 0, "README carries at least one excerpt");
  for (const [, file, body] of blocks) {
    const text = body.split("\n").map((l) => l.replace(/^> ?/, "")).join("\n");
    const example = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(example.includes(text), `excerpt matches ${file}`);
  }
});
