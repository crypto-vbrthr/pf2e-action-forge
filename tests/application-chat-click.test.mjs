import test from "node:test";
import assert from "node:assert/strict";

test("application chat source binds rendered buttons directly and retries replication-shaped broker failures", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../scripts/core/application-chat.js", import.meta.url), "utf8");
  assert.match(source, /afApplicationBound/);
  assert.match(source, /addEventListener\("click"/);
  assert.match(source, /#handleButtonClick/);
  assert.match(source, /#requestWithReplicationRetry/);
  assert.match(source, /missing-transaction/);
  assert.match(source, /transaction-mismatch/);
});
