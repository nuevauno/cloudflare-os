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
  assert.match(release, /26\.08\.25\.9/);
});

test("client provisioning accepts email login and hashes its normalized identity", async () => {
  const user = await readFile("packages/workshop-backend/src/user.ts", "utf8");
  const menu = await readFile("packages/workshop-frontend/src/components/UserMenu.tsx", "utf8");
  const login = await readFile("packages/workshop-frontend/src/LoginPage.tsx", "utf8");
  assert.match(user, /username = username\.trim\(\)\.toLowerCase\(\)/);
  assert.match(user, /const email = \/\^\[a-z0-9\]/);
  assert.match(menu, /hashPassword\(login, provision\.password\)/);
  assert.match(menu, /Correo de acceso/);
  assert.match(login, /Correo o usuario/);
});

test("the shell keeps company switching visible and streams canonical activity", async () => {
  const status = await readFile("packages/workshop-frontend/src/components/AppShell/BottomStatusBar.tsx", "utf8");
  const activity = await readFile("packages/workshop-frontend/src/components/AppShell/BusinessActivity.tsx", "utf8");
  const server = await readFile("packages/workshop-backend/src/server.ts", "utf8");
  assert.match(status, /<select/);
  assert.doesNotMatch(status, /multipleCompanies/);
  assert.doesNotMatch(status, /organization\.name/);
  const switcher = await readFile("packages/workshop-frontend/src/components/AppShell/BusinessContextSwitcher.tsx", "utf8");
  assert.doesNotMatch(switcher, /organization\.name/);
  assert.match(activity, /listBusinessActivity/);
  assert.match(activity, /POLL_MS = 10_000/);
  assert.match(activity, /activityAppIcon\(event\)/);
  assert.match(server, /PLATFORM_CORE\.listActivity\(this\.#userId\.name!/);
});
