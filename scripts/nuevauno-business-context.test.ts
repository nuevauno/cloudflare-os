import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("business context derives authority from the authenticated server identity", async () => {
  const source = await readFile("packages/workshop-backend/src/server.ts", "utf8");
  assert.match(source, /getBusinessSession\(this\.#userId\.name!/);
  assert.match(source, /#isEffectiveAdmin/);
  assert.match(source, /return !session\.support/);
  assert.match(source, /if \(!await this\.#isEffectiveAdmin\(\)\) throw new Error\("permission_denied"\)/);
  assert.match(source, /idempotencyKey: `support:\$\{this\.#userId\.name\}/);
  assert.doesNotMatch(source, /input\.actorSubject/);
});

test("support access remains visible and can be ended from every product screen", async () => {
  const shell = await readFile("packages/workshop-frontend/src/components/AppShell/AppShell.tsx", "utf8");
  assert.match(shell, /businessSession\?\.support/);
  assert.match(shell, /Atendiendo a/);
  assert.match(shell, />\s*Salir\s*</);
  assert.match(shell, /endSupportSession/);
});

test("support mode cannot expose owner or personal workspace surfaces", async () => {
  const shell = await readFile("packages/workshop-frontend/src/components/AppShell/AppShell.tsx", "utf8");
  const sidebar = await readFile("packages/workshop-frontend/src/components/AppShell/Sidebar.tsx", "utf8");
  const clients = await readFile("packages/workshop-frontend/src/OwnerClientsPage.tsx", "utf8");
  assert.match(shell, /isBusinessSupportRoute/);
  assert.match(shell, /navigate\(\{ to: '\/sales', replace: true \}\)/);
  assert.match(sidebar, /supportMode/);
  assert.match(sidebar, /!supportMode && <SidebarItem/);
  assert.match(clients, /businessSession\?\.support/);
  assert.match(clients, /if \(businessSession\?\.support\) return null/);
});

test("the release uses the canonical dated version", async () => {
  const release = await readFile("packages/workshop-frontend/src/release.ts", "utf8");
  assert.match(release, /export const RELEASE_VERSION = '\d{2}\.\d{2}\.\d{2}\.\d+'/);
});

test("client provisioning accepts email login and hashes its normalized identity", async () => {
  const user = await readFile("packages/workshop-backend/src/user.ts", "utf8");
  const menu = await readFile("packages/workshop-frontend/src/components/UserMenu.tsx", "utf8");
  const login = await readFile("packages/workshop-frontend/src/LoginPage.tsx", "utf8");
  assert.match(user, /username = username\.trim\(\)\.toLowerCase\(\)/);
  assert.match(user, /const email = \/\^\[a-z0-9\]/);
  assert.match(menu, /hashPassword\(login, provision\.password\)/);
  assert.match(menu, /Correo de acceso/);
  assert.match(login, /t\('auth\.username'\)/);
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
  assert.match(server, /PLATFORM_CORE\.listActivity\(await this\.#businessSubject/);
  assert.match(server, /support_scope_invalid/);
});
