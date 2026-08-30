// Vitest corre en Node, pero el tsconfig de esta app declara solo tipos del navegador.
// @ts-expect-error builtin de Node sin @types/node en el bundle del cliente
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./PosPage.tsx", import.meta.url), "utf8");
const rootRoute = readFileSync(new URL("./routes/__root.tsx", import.meta.url), "utf8");

describe("recorridos POS portados desde la fuente 19", () => {
  it("renderiza el POS como aplicación de pantalla completa, sin el shell lateral", () => {
    expect(rootRoute).toContain("pathname === '/pos'");
    expect(rootRoute).toContain("isFullscreenApplication");
  });
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

  it("no delega ningún recorrido operativo a diálogos nativos del navegador", () => {
    expect(source).not.toMatch(/window\.(prompt|confirm|alert)/);
    for (const title of [
      "Configurar producto",
      "Seleccionar lote",
      "Mover mesa",
      "Unir mesas",
      "Dividir cuenta",
      "Movimiento de caja",
      "Devolver productos",
      "Cambiar precio",
      "Curso",
    ]) expect(source).toContain(title);
  });

  it("incluye tablero de preparación y refresco autoritativo entre dispositivos", () => {
    for (const text of ["Preparación", "Pendiente", "En preparación", "Marcar listo", "Entregar"]) expect(source).toContain(text);
    expect(source).toContain("posSetPreparationState");
    expect(source).toContain("window.setInterval(synchronize, 2_000)");
    expect(source).toContain('document.addEventListener("visibilitychange", synchronize)');
  });

  it("expone ajustes persistentes por sección en vez de controles decorativos",()=>{
    for(const text of ["Ajustes del punto de venta","Interfaz del PdV","Facturas y recibos","Terminales de pago","NUEVAUNO Desktop y dispositivos","Inventario"])expect(source).toContain(text);
    expect(source).toContain("posUpdateSettings");
    expect(source).toContain("settingsDirty");
  });

  it("mantiene el registro limpio y mueve las acciones secundarias al menú contextual",()=>{
    for(const text of ["⋮","Nota para el cliente","Transferir / Fusionar","Comensales","Tarifa","Cancelar orden"])expect(source).toContain(text);
    expect(source).toContain('grid-cols-[1fr_1fr_44px_1fr_44px]');
    expect(source).toContain('["1","2","3","Ctdad"');
    expect(source).toContain('setActionsOpen(true)');
  });
});
