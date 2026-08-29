import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript6";

const ROOT = path.resolve(import.meta.dirname, "..");
const FRONTEND = path.join(ROOT, "packages/workshop-frontend/src");
const ENFORCED = ["LoginPage.tsx", "SignupPage.tsx", "OnboardingWizard.tsx", "AdminPage.tsx"];
const TRANSLATABLE_ATTRIBUTES = new Set(["alt", "aria-label", "label", "placeholder", "title"]);
const LANGUAGE_NEUTRAL = new Set(["tu@empresa.com"]);

function line(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function visibleLiterals(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const failures: string[] = [];
  const inspect = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const value = node.text.trim();
      if (/[A-Za-zÀ-ÿ]/.test(value)) failures.push(`${line(source, node)}: ${JSON.stringify(value)}`);
    }
    if (
      ts.isJsxAttribute(node)
      && TRANSLATABLE_ATTRIBUTES.has(node.name.getText(source))
      && node.initializer
      && ts.isStringLiteral(node.initializer)
    ) {
      const value = node.initializer.text.trim();
      if (/[A-Za-zÀ-ÿ]/.test(value) && !LANGUAGE_NEUTRAL.has(value)) {
        failures.push(`${line(source, node)}: ${node.name.getText(source)}=${JSON.stringify(value)}`);
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(source);
  return failures;
}

test("auth, onboarding, and administration keep visible copy in the i18n catalog", () => {
  const failures = ENFORCED.flatMap((relative) => {
    const file = path.join(FRONTEND, relative);
    return visibleLiterals(file).map((failure) => `${relative}:${failure}`);
  });
  assert.deepEqual(failures, [], `Move visible copy to i18n.tsx:\n${failures.join("\n")}`);
});

test("Spanish and English catalogs stay key-for-key aligned", () => {
  const catalog = fs.readFileSync(path.join(FRONTEND, "i18n.tsx"), "utf8");
  const spanish = new Set([...catalog.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]));
  const englishStart = catalog.indexOf("\n  en: {");
  assert.notEqual(englishStart, -1);
  const spanishPart = catalog.slice(0, englishStart);
  const englishPart = catalog.slice(englishStart);
  const es = new Set([...spanishPart.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]));
  const en = new Set([...englishPart.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]));
  assert.deepEqual([...es].toSorted(), [...en].toSorted());
  assert.ok(spanish.size > 0);
});
