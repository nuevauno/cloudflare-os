import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("business context derives authority from the authenticated server identity", async () => {
  const source = await readFile("packages/workshop-backend/src/server.ts", "utf8");
  assert.match(source, /getBusinessSession\(this\.#userId\.name!/);
  assert.match(source, /if \(!this\.#isAdmin\(\)\) throw new Error\("permission_denied"\)/);
  assert.match(source, /idempotencyKey: `support:\$\{this\.#userId\.name\}/);
  assert.doesNotMatch(source, /input\.actorSubject/);
});

test("support access remains visible and can be ended from every product screen", async () => {
  const shell = await readFile("packages/workshop-frontend/src/components/AppShell/AppShell.tsx", "utf8");
  assert.match(shell, /businessSession\?\.support/);
  assert.match(shell, /Salir del cliente/);
  assert.match(shell, /endSupportSession/);
});

test("the release uses the canonical dated version", async () => {
  const release = await readFile("packages/workshop-frontend/src/release.ts", "utf8");
  assert.match(release, /26\.08\.24\.1/);
});
