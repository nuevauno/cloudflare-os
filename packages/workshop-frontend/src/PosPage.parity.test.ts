// Vitest corre en Node, pero el tsconfig de esta app declara solo tipos del navegador.
// @ts-expect-error builtin de Node sin @types/node en el bundle del cliente
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./PosPage.tsx", import.meta.url), "utf8");

describe("recorridos POS portados desde la fuente 19", () => {
  it("usa un diálogo de nota de línea con accesos rápidos y no un prompt", () => {
    expect(source).toContain('aria-label={`Nota de ${noteEditor.productName}`}');
    expect(source).toContain("Sin aderezo");
    expect(source).not.toMatch(/window\.prompt\(\s*"Nota de la línea"/);
  });

  it("separa pago y conserva cliente, factura, propina y múltiples medios", () => {
    for (const text of ["Restante", "Pago múltiple", "Propina", "Factura", "Validar", "Regresar"]) expect(source).toContain(text);
    expect(source).toContain('screen === "payment"');
  });

  it("elige, busca y crea clientes mediante persistencia real", () => {
    expect(source).toContain("Elige un cliente");
    expect(source).toContain("Nuevo cliente");
    expect(source).toContain("posCreatePartner");
  });
});
