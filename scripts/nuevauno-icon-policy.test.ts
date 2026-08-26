import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, relative } from "node:path";
import { describe, it } from "node:test";

const frontendRoot = new URL("../packages/workshop-frontend/src/", import.meta.url);

function sourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) return sourceFiles(child);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [child] : [];
  });
}

function fileName(file: URL): string {
  return relative(frontendRoot.pathname, file.pathname);
}

describe("NUEVAUNO icon policy", () => {
  const files = sourceFiles(frontendRoot);

  it("does not import an upstream icon library", () => {
    const violations = files
      .filter((file) => readFileSync(file, "utf8").includes("@phosphor-icons/react"))
      .map(fileName);
    assert.deepEqual(violations, []);
  });

  it("does not render vendor or resource logo URLs", () => {
    const forbidden = [/vendor\.logo\??\.url/, /vendor\.description\.logo\??\.url/, /resource\??\.icon\??\.url/];
    const violations = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return forbidden.some((pattern) => pattern.test(source)) ? [fileName(file)] : [];
    });
    assert.deepEqual(violations, []);
  });

  it("keeps raw SVG limited to illustrations, never interface icons", () => {
    const illustrationAllowlist = new Set([
      "components/BlueprintPreviewImage.tsx",
      "routes/gatekeepers.tsx",
      "siteLogoUtils.test.ts",
    ]);
    const violations = files
      .filter((file) => readFileSync(file, "utf8").includes("<svg"))
      .map(fileName)
      .filter((name) => !illustrationAllowlist.has(name));
    assert.deepEqual(violations, []);
  });

  it("resolves product icons only through the canonical branding host", () => {
    const iconComponent = readFileSync(
      new URL("../packages/workshop-frontend/src/components/NuevaunoIcon.tsx", import.meta.url),
      "utf8",
    );
    assert.match(iconComponent, /https:\/\/branding\.nuevauno\.com\/icons\/nuevauno/);
  });
});
