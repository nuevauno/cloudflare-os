// Vitest corre en Node, pero el tsconfig de esta app declara solo tipos del navegador.
// @ts-expect-error builtin de Node sin @types/node en el bundle del cliente
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./PosPage.tsx", import.meta.url), "utf8");
const rootRoute = readFileSync(new URL("./routes/__root.tsx", import.meta.url), "utf8");

describe("recorridos POS portados desde la fuente 19", () => {
  it("mantiene el POS dentro del shell de NUEVAUNO y conserva el acceso a la plataforma", () => {
    expect(rootRoute).not.toContain("pathname === '/pos'");
    expect(rootRoute).toContain("isFullscreenApplication");
    expect(rootRoute).toContain("<AppShell>");
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
    expect(source).not.toContain('setCategory(categories[0])');
  });

  it("Nueva orden limpia todo el contexto comercial antes de abrir el registro", () => {
    expect(source).toContain("const startNewOrder = () =>");
    for (const reset of [
      'setGeneralNote("")',
      "setGuestCount(1)",
      "setTipMinor(0)",
      "setDiscountBasisPoints(0)",
      'setPartnerId("")',
      "setInvoiceRequested(false)",
      "setTakeaway(false)",
      'setSelectedLineId("")',
    ]) expect(source).toContain(reset);
    expect(source).toContain("onClick={startNewOrder}");
  });

  it("mantiene Mesas como superficie operativa limpia y deja caja/edición fuera del salón", () => {
    const floorStart = source.indexOf('{tab === "floor" && (');
    const ordersStart = source.indexOf('{tab === "orders" && (', floorStart);
    const floor = source.slice(floorStart, ordersStart);
    expect(floor).toContain("＋ Nueva orden");
    expect(floor).toContain('fixed inset-x-0 bottom-0');
    for (const state of ["Libre", "Ocupada", "Demorada", "Pendiente", "Envío parcial", "Enviado"]) expect(floor).toContain(state);
    expect(floor).not.toContain("Caja esperada");
    expect(floor).not.toContain("Editar salón");
  });

  it("porta Pedidos como listado operativo con estados y recarga de órdenes activas", () => {
    for (const text of ["Buscar órdenes…", "Activo", "Pago", "Cancelado", "Demorada", "Pendiente", "Envío parcial", "Enviado", "Cargar orden"]) expect(source).toContain(text);
    expect(source).toContain('ticket.state === "draft"');
    expect(source).toContain("loadOrder(selectedTicket, targetTable)");
    expect(source).not.toContain('ticket.state !== "draft" &&');
  });

  it("muestra tiempo y estados operativos completos directamente en cada mesa",()=>{
    for(const text of ["elapsedLabel",'current.metadata.preparationState','Demorada','Pendiente','Envío parcial','Enviado'])expect(source).toContain(text);
    expect(source).toContain('absolute right-3 top-3');
    expect(source).toContain('window.setInterval(() => setClock(Date.now()), 30_000)');
  });

  it("identifica encargados, cajeros y garzones sin diálogos nativos",()=>{
    for(const text of ["Selecciona tu usuario","Encargado","Cajero","Garzón","posLoginOperator","posLogoutOperator","Empleados del punto de venta"])expect(source).toContain(text);
    expect(source).toContain('inputMode="numeric"');
    expect(source).toContain('data.activeOperator?.role');
  });

  it("porta control de apertura, conciliación de cierre y venta diaria",()=>{
    for(const text of ["Nota de apertura","Nota de cierre","Medios de pago","Entradas y salidas","Efectivo contado","Diferencia:","Venta diaria","pedidos abiertos"])expect(source).toContain(text);
    expect(source).toContain("downloadSalesReport");
    expect(source).toContain("data.session.paymentsByMethod.map");
    expect(source).toContain("data.session.cashMoves.map");
    expect(source).toContain("openingNote.trim() || undefined");
    expect(source).toContain("closingNote.trim() || undefined");
  });

  it("cuenta efectivo por denominaciones y concilia cada medio bancario",()=>{
    for(const text of ["Detalle de efectivo","billetes y monedas","Total contado","Autocompletar","Diferencias de pagos","Otros medios"])expect(source).toContain(text);
    expect(source).toContain("CLP_DENOMINATIONS");
    expect(source).toContain("denominationLines(openingDenominations)");
    expect(source).toContain("denominationLines(closingDenominations)");
    expect(source).toContain("setNonCashCounts");
    expect(source).toContain("paymentDifferences");
  });
});
