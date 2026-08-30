import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthenticatedApi } from "./AuthContext";
import { resolveSalesScope } from "./SalesPage";
import type {
  PosLoadDataView,
  PosOrderView,
} from "@gadgets/workshop-shared/api";

const money = (n: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
type Tab = "floor" | "register" | "orders";

export default function PosPage() {
  const { authenticatedApi, businessSession } = useAuthenticatedApi(),
    scope = resolveSalesScope(businessSession);
  const [data, setData] = useState<PosLoadDataView | null>(null),
    [tab, setTab] = useState<Tab>("floor"),
    [table, setTable] = useState<{
      id: string;
      name: string;
      seats: number;
    } | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({}),
    [order, setOrder] = useState<PosOrderView | null>(null),
    [category, setCategory] = useState(""),
    [tender, setTender] = useState(""),
    [receipt, setReceipt] = useState<{
      order: PosOrderView;
      change: number;
    } | null>(null),
    [busy, setBusy] = useState(false);
  const [generalNote, setGeneralNote] = useState(""),
    [guestCount, setGuestCount] = useState(1),
    [tipMinor, setTipMinor] = useState(0),
    [discountBasisPoints, setDiscountBasisPoints] = useState(0),
    [paymentMethodId, setPaymentMethodId] = useState(""),
    [partnerId, setPartnerId] = useState(""),
    [search, setSearch] = useState(""),
    [ticketSearch, setTicketSearch] = useState(""),
    [invoiceRequested, setInvoiceRequested] = useState(false),
    [takeaway, setTakeaway] = useState(false),
    [splitPayment, setSplitPayment] = useState(false),
    [paymentAmounts, setPaymentAmounts] = useState<Record<string, number>>({}),
    [lineNotes, setLineNotes] = useState<Record<string, string>>({}),
    [manualPrices, setManualPrices] = useState<Record<string, number>>({}),
    [lineCourses, setLineCourses] = useState<Record<string, number>>({});
  const orderUuid = useRef<string>(crypto.randomUUID());
  const refresh = async () => {
    if (scope)
      setData(
        await authenticatedApi.posLoadData(
          scope.organizationId,
          scope.companyId,
        ),
      );
  };
  useEffect(() => {
    void refresh();
  }, [scope?.organizationId, scope?.companyId]);
  const categories = useMemo(
    () => [...new Set(data?.products.map((p) => p.category) ?? [])],
    [data],
  );
  useEffect(() => {
    if (!category && categories.length) setCategory(categories[0]);
  }, [categories, category]);
  const lines = useMemo(
    () =>
      Object.entries(cart).flatMap(([id, quantity]) => {
        const p = data?.products.find((x) => x.id === id);
        if (!p || quantity <= 0) return [];
        const unitPriceMinor = manualPrices[id] ?? p.priceMinor,
          discounted = Math.round(
            (unitPriceMinor * (10000 - discountBasisPoints)) / 10000,
          ),
          subtotal = discounted * quantity,
          tax = Math.round((subtotal * p.taxBasisPoints) / 10000);
        return [{ ...p, unitPriceMinor, quantity, subtotal, tax, total: subtotal + tax }];
      }),
    [cart, data, discountBasisPoints, manualPrices],
  );
  const total = lines.reduce((sum, line) => sum + line.total, 0) + tipMinor,
    tax = lines.reduce((sum, line) => sum + line.tax, 0);
  if (!scope || !data)
    return <div className="p-8 text-kumo-subtle">Cargando Punto de venta…</div>;
  const open = async () => {
    setBusy(true);
    try {
      await authenticatedApi.posOpenSession(
        scope.organizationId,
        scope.companyId,
        0,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const selectTable = (next: { id: string; name: string; seats: number }) => {
    const existing = data.orders.find((value) => value.tableId === next.id);
    setTable(next);
    setOrder(existing ?? null);
    orderUuid.current = existing?.uuid ?? crypto.randomUUID();
    setCart(
      Object.fromEntries(
        existing?.lines.map((line) => [line.productVariantId, line.quantity]) ??
          [],
      ),
    );
    setGeneralNote(existing?.metadata.generalNote ?? "");
    setGuestCount(existing?.metadata.guestCount ?? 1);
    setTipMinor(existing?.metadata.tipMinor ?? 0);
    setDiscountBasisPoints(existing?.lines[0]?.discountBasisPoints ?? 0);
    setPartnerId(existing?.metadata.partnerId ?? "");
    setInvoiceRequested(existing?.metadata.invoiceRequested ?? false);
    setTakeaway(existing?.metadata.takeaway ?? false);
    setLineNotes(
      Object.fromEntries(
        existing?.lines.flatMap((line) =>
          line.customerNote ? [[line.productVariantId, line.customerNote]] : [],
        ) ?? [],
      ),
    );
    setManualPrices(
      Object.fromEntries(
        existing?.lines.flatMap((line) => {
          const product = data.products.find(
            (item) => item.id === line.productVariantId,
          );
          return product && product.priceMinor !== line.unitPriceMinor
            ? [[line.productVariantId, line.unitPriceMinor]]
            : [];
        }) ?? [],
      ),
    );
    setLineCourses(
      Object.fromEntries(
        existing?.lines.map((line) => [line.productVariantId, line.courseNumber ?? 1]) ??
          [],
      ),
    );
    setTab("register");
  };
  const orderPayload = () => ({
    organizationId: scope.organizationId,
    companyId: scope.companyId,
    sessionId: data.session!.id,
    ...(table ? { tableId: table.id } : {}),
    uuid: orderUuid.current,
      metadata: {
        generalNote,
        guestCount,
        tipMinor,
        invoiceRequested,
        takeaway,
      ...(partnerId ? { partnerId } : {}),
    },
      lines: lines.map((line) => ({
        productVariantId: line.id,
        quantity: line.quantity,
        discountBasisPoints,
        ...(lineNotes[line.id] ? { customerNote: lineNotes[line.id] } : {}),
        ...(manualPrices[line.id] === undefined
          ? {}
          : { unitPriceMinor: manualPrices[line.id] }),
        courseNumber: lineCourses[line.id] ?? 1,
      })),
  });
  const save = async () => {
    if (!data.session || !lines.length) return;
    setBusy(true);
    try {
      const saved = await authenticatedApi.posSyncOrder(orderPayload());
      setOrder(saved);
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const change = (id: string, delta: number) =>
    setCart((current) => ({
      ...current,
      [id]: Math.max(0, (current[id] ?? 0) + delta),
    }));
  const setQuantity = (id: string, quantity: number) =>
    setCart((current) => ({
      ...current,
      [id]: Math.max(0, Math.round(quantity * 1000) / 1000),
    }));
  const cancel = async () => {
    if (order)
      await authenticatedApi.posCancelOrder(
        scope.organizationId,
        scope.companyId,
        order.id,
      );
    setOrder(null);
    setCart({});
    setTable(null);
    orderUuid.current = crypto.randomUUID();
    await refresh();
    setTab("floor");
  };
  const selectedPaymentMethod = data.paymentMethods.find(
      (method) => method.id === paymentMethodId,
    ),
    isCash =
      !selectedPaymentMethod || selectedPaymentMethod.methodType === "cash";
  const allocatedPayments = data.paymentMethods
    .filter((method) => (paymentAmounts[method.id] ?? 0) > 0)
    .map((method) => ({
      paymentMethodId: method.id,
      amountMinor: paymentAmounts[method.id]!,
      ...(method.methodType === "cash"
        ? { tenderedMinor: paymentAmounts[method.id]! }
        : {}),
    })),
    allocatedTotal = allocatedPayments.reduce(
      (sum, payment) => sum + payment.amountMinor,
      0,
    );
  const pay = async () => {
    if (!order || !data.session || !lines.length) return;
    setBusy(true);
    try {
      const updated = await authenticatedApi.posSyncOrder(orderPayload());
      const result = await authenticatedApi.posPayOrder({
        organizationId: scope.organizationId,
        companyId: scope.companyId,
        orderId: updated.id,
        ...(splitPayment
          ? { payments: allocatedPayments }
          : {
              tenderedMinor: isCash ? Number(tender) : updated.totalMinor,
              ...(paymentMethodId ? { paymentMethodId } : {}),
            }),
        requestId: crypto.randomUUID(),
      });
      setReceipt({ order: result.order, change: result.payment.changeMinor });
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const sendToPreparation = async () => {
    if (!order) return;
    setOrder(
      await authenticatedApi.posSendToPreparation(
        scope.organizationId,
        scope.companyId,
        order.id,
      ),
    );
    await refresh();
  };
  const transfer = async () => {
    if (!order) return;
    const available = data.floors
        .flatMap((floor) => floor.tables)
        .filter((item) => item.id !== table?.id),
      name = window.prompt(
        `Mover a mesa: ${available.map((item) => item.name).join(", ")}`,
      );
    const target = available.find(
      (item) => item.name.toLowerCase() === name?.trim().toLowerCase(),
    );
    if (!target) return;
    setOrder(
      await authenticatedApi.posTransferOrder(
        scope.organizationId,
        scope.companyId,
        order.id,
        target.id,
      ),
    );
    setTable(target);
    await refresh();
  };
  const split = async () => {
    if (!order || !order.lines.length) return;
    const lineQuantities = order.lines.flatMap((line) => {
      const quantity = Number(
        window.prompt(
          `Cantidad de ${line.description} para la cuenta separada (máximo ${line.quantity})`,
          "0",
        ),
      );
      return quantity > 0 && quantity <= line.quantity
        ? [{ lineId: line.id, quantity }]
        : [];
    });
    if (!lineQuantities.length) return;
    const result = await authenticatedApi.posSplitOrder({
      organizationId: scope.organizationId,
      companyId: scope.companyId,
      orderId: order.id,
      lineQuantities,
      requestId: crypto.randomUUID(),
    });
    setOrder(result.source);
    setCart(
      Object.fromEntries(
        result.source.lines.map((item) => [
          item.productVariantId,
          item.quantity,
        ]),
      ),
    );
    await refresh();
  };
  const cashMove = async (direction: "in" | "out") => {
    if (!data.session) return;
    const amount = Number(
        window.prompt(
          direction === "in" ? "Monto que entra" : "Monto que sale",
        ),
      ),
      reason = window.prompt("Motivo")?.trim();
    if (!Number.isSafeInteger(amount) || amount <= 0 || !reason) return;
    await authenticatedApi.posCashMove({
      organizationId: scope.organizationId,
      companyId: scope.companyId,
      sessionId: data.session.id,
      direction,
      amountMinor: amount,
      reason,
      requestId: crypto.randomUUID(),
    });
    await refresh();
  };
  const closeSession = async () => {
    if (!data.session || data.orders.length) return;
    const countedCashMinor = Number(window.prompt("Efectivo contado al cerrar"));
    if (!Number.isSafeInteger(countedCashMinor) || countedCashMinor < 0) return;
    const result = await authenticatedApi.posCloseSession(
      scope.organizationId,
      scope.companyId,
      data.session.id,
      countedCashMinor,
    );
    window.alert(`Diferencia de caja: ${money(result.differenceMinor)}`);
    await refresh();
  };
  const refund = async (ticket: PosOrderView) => {
    if (ticket.state !== "paid") return;
    const refundLines = ticket.lines.flatMap((line) => {
      const quantity = Number(
        window.prompt(
          `Cantidad a devolver de ${line.description} (máximo ${line.quantity})`,
          String(line.quantity),
        ),
      );
      return quantity > 0 && quantity <= line.quantity
        ? [{ lineId: line.id, quantity }]
        : [];
    });
    if (!refundLines.length) return;
    await authenticatedApi.posRefundOrder({
      organizationId: scope.organizationId,
      companyId: scope.companyId,
      orderId: ticket.id,
      lines: refundLines,
      requestId: crypto.randomUUID(),
    });
    await refresh();
  };
  const reset = () => {
    setReceipt(null);
    setOrder(null);
    setCart({});
    setTender("");
    setSplitPayment(false);
    setPaymentAmounts({});
    setLineNotes({});
    setManualPrices({});
    setLineCourses({});
    setTable(null);
    orderUuid.current = crypto.randomUUID();
    setTab("floor");
  };
  if (!data.session)
    return (
      <main className="mx-auto max-w-xl p-8">
        <p className="text-xs uppercase tracking-widest text-[#FE4A23]">
          Punto de venta
        </p>
        <h1 className="mt-2 text-3xl font-normal">
          {data.config?.name ?? "Restaurant"}
        </h1>
        <p className="mt-3 text-kumo-subtle">
          Abre la caja para comenzar a registrar pedidos.
        </p>
        <button
          disabled={busy}
          onClick={open}
          className="mt-8 w-full rounded-xl bg-[#FE4A23] p-4 text-white disabled:opacity-40"
        >
          Abrir sesión
        </button>
      </main>
    );
  if (receipt)
    return (
      <main className="mx-auto max-w-md p-8">
        <section className="rounded-xl border border-kumo-line bg-kumo-elevated p-8">
          <p className="text-center text-xs uppercase tracking-widest text-[#FE4A23]">
            Recibo
          </p>
          <h1 className="mt-2 text-center text-2xl font-normal">
            {data.config?.name}
          </h1>
          <p className="text-center text-kumo-subtle">Mesa {table?.name}</p>
          {receipt.order.lines.map((line) => (
            <div
              key={line.productVariantId}
              className="mt-4 flex justify-between"
            >
              <span>
                {line.quantity} × {line.description}
              </span>
              <span>{money(line.totalMinor)}</span>
            </div>
          ))}
          <div className="mt-6 space-y-2 border-t pt-4">
            <div className="flex justify-between">
              <span>Neto</span>
              <span>{money(receipt.order.untaxedMinor)}</span>
            </div>
            <div className="flex justify-between">
              <span>IVA 19%</span>
              <span>{money(receipt.order.taxMinor)}</span>
            </div>
            <div className="flex justify-between text-xl">
              <span>Total</span>
              <span>{money(receipt.order.totalMinor)}</span>
            </div>
            <div className="flex justify-between">
              <span>Vuelto</span>
              <span>{money(receipt.change)}</span>
            </div>
          </div>
          <div className="mt-8 flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 rounded-xl border border-kumo-line p-3"
            >
              Imprimir
            </button>
            <button
              onClick={reset}
              className="flex-1 rounded-xl bg-[#FE4A23] p-3 text-white"
            >
              Nueva venta
            </button>
          </div>
        </section>
      </main>
    );
  return (
    <main className="flex min-h-full flex-col bg-kumo-base">
      <nav className="flex h-14 items-stretch border-b border-kumo-line bg-kumo-elevated">
        <button
          className={`px-7 ${tab === "floor" ? "bg-kumo-line" : ""}`}
          onClick={() => setTab("floor")}
        >
          Mesas
        </button>
        <button
          className={`px-7 ${tab === "register" ? "bg-kumo-line" : ""}`}
          onClick={() => setTab("register")}
        >
          Registrar
        </button>
        <button
          className={`px-7 ${tab === "orders" ? "bg-kumo-line" : ""}`}
          onClick={() => setTab("orders")}
        >
          Pedidos{" "}
          {data.orders.length > 0 && (
            <span className="ml-2 rounded-full bg-sky-500 px-2 py-1 text-xs text-white">
              {data.orders.length}
            </span>
          )}
        </button>
        <span className="m-auto text-sm text-kumo-subtle">
          {data.config?.name}
        </span>
      </nav>
      {tab === "register" && (
        <section className="flex flex-wrap items-center gap-2 border-b border-kumo-line bg-kumo-elevated p-3">
          <label className="flex items-center gap-2">
            Comensales
            <input
              aria-label="Comensales"
              type="number"
              min="1"
              value={guestCount}
              onChange={(event) =>
                setGuestCount(Math.max(1, Number(event.target.value)))
              }
              className="w-16 rounded-xl border border-kumo-line bg-kumo-base p-2"
            />
          </label>
          <label className="flex items-center gap-2">
            Descuento
            <input
              aria-label="Descuento porcentual"
              type="number"
              min="0"
              max="100"
              value={discountBasisPoints / 100}
              onChange={(event) =>
                setDiscountBasisPoints(
                  Math.round(
                    Math.max(0, Math.min(100, Number(event.target.value))) *
                      100,
                  ),
                )
              }
              className="w-20 rounded-xl border border-kumo-line bg-kumo-base p-2"
            />
            %
          </label>
          <label className="flex items-center gap-2">
            Propina
            <input
              aria-label="Propina"
              type="number"
              min="0"
              value={tipMinor}
              onChange={(event) =>
                setTipMinor(Math.max(0, Number(event.target.value)))
              }
              className="w-28 rounded-xl border border-kumo-line bg-kumo-base p-2"
            />
          </label>
          <input
            aria-label="Nota del pedido"
            value={generalNote}
            onChange={(event) => setGeneralNote(event.target.value)}
            placeholder="Nota del pedido"
            className="min-w-52 flex-1 rounded-xl border border-kumo-line bg-kumo-base p-2"
          />
          <select
            aria-label="Cliente"
            value={partnerId}
            onChange={(event) => setPartnerId(event.target.value)}
            className="max-w-52 rounded-xl border border-kumo-line bg-kumo-base p-2"
          >
            <option value="">Cliente ocasional</option>
            {data.partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.displayName}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={takeaway}
              onChange={(event) => setTakeaway(event.target.checked)}
            />
            Para llevar
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={invoiceRequested}
              onChange={(event) => setInvoiceRequested(event.target.checked)}
            />
            Solicitar factura
          </label>
          <select
            aria-label="Medio de pago"
            value={paymentMethodId}
            onChange={(event) => setPaymentMethodId(event.target.value)}
            className="rounded-xl border border-kumo-line bg-kumo-base p-2"
          >
            <option value="">Efectivo</option>
            {data.paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
          {order && (
            <>
              <button
                onClick={sendToPreparation}
                className="rounded-xl border border-[#FE4A23] px-4 py-2 text-[#FE4A23]"
              >
                Enviar comanda
              </button>
              <button
                onClick={transfer}
                className="rounded-xl border border-kumo-line px-4 py-2"
              >
                Mover mesa
              </button>
              <button
                onClick={split}
                className="rounded-xl border border-kumo-line px-4 py-2"
              >
                Dividir
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-xl border border-kumo-line px-4 py-2"
              >
                Cuenta provisoria
              </button>
            </>
          )}
        </section>
      )}
      {tab === "floor" && (
        <section className="flex flex-wrap items-center gap-2 border-b border-kumo-line px-4 pb-3">
          <div className="mr-auto flex flex-wrap gap-4 text-sm text-kumo-subtle">
            <span>Caja esperada: {money(data.session.expectedCashMinor)}</span>
            <span>Ventas: {money(data.session.grossSalesMinor)}</span>
            <span>Pedidos pagados: {data.session.paidOrderCount}</span>
            <span>Devoluciones: {money(data.session.refundMinor)}</span>
            {data.session.paymentsByMethod.map((method) => (
              <span key={method.paymentMethodId}>
                {method.name}: {money(method.amountMinor)}
              </span>
            ))}
          </div>
          <button
            onClick={() => cashMove("in")}
            className="rounded-xl border border-kumo-line px-4 py-2"
          >
            Entrada
          </button>
          <button
            onClick={() => cashMove("out")}
            className="rounded-xl border border-kumo-line px-4 py-2"
          >
            Salida
          </button>
          <button
            disabled={data.orders.length > 0}
            onClick={closeSession}
            className="rounded-xl border border-kumo-line px-4 py-2 disabled:opacity-40"
          >
            Cerrar caja
          </button>
        </section>
      )}
      {tab === "floor" && (
        <section className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => {
                setTable(null);
                setCart({});
                setOrder(null);
                orderUuid.current = crypto.randomUUID();
                setTab("register");
              }}
              className="rounded-xl bg-[#FE4A23] px-5 py-3 text-white"
            >
              ＋ Nueva orden
            </button>
            <div className="text-sm">
              <span className="mr-4">
                ●{" "}
                {data.floors.flatMap((f) => f.tables).length -
                  data.orders.length}{" "}
                Libres
              </span>
              <span className="text-[#FE4A23]">
                ● {data.orders.length} Ocupadas
              </span>
            </div>
          </div>
          {data.floors.map((floor) => (
            <section key={floor.id}>
              <h1 className="mb-4 text-center text-lg font-normal">
                {floor.name}
              </h1>
              <div className="flex flex-wrap gap-3">
                {floor.tables.map((item) => {
                  const current = data.orders.find(
                    (value) => value.tableId === item.id,
                  );
                  return (
                    <button
                      key={item.id}
                      onClick={() => selectTable(item)}
                      className={`h-32 w-36 rounded-xl border p-3 text-center ${current ? "border-[#FE4A23] bg-[#FE4A23] text-white" : "border-kumo-line bg-kumo-elevated"}`}
                    >
                      <span className="block text-3xl">{item.name}</span>
                      <span className="mt-3 block text-xs">
                        ♟ {item.seats}
                      </span>
                      {current && (
                        <span className="mt-2 block">
                          {money(current.totalMinor)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </section>
      )}
      {tab === "orders" && (
        <section className="p-6">
          <h1 className="text-2xl font-normal">Pedidos abiertos</h1>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {data.orders.map((item) => {
              const target = data.floors
                .flatMap((f) => f.tables)
                .find((value) => value.id === item.tableId);
              return (
                <button
                  key={item.id}
                  onClick={() => target && selectTable(target)}
                  className="flex justify-between rounded-xl border border-kumo-line bg-kumo-elevated p-5 text-left"
                >
                  <span>
                    Mesa {target?.name ?? "sin asignar"} · {item.lines.length}{" "}
                    líneas
                  </span>
                  <span>{money(item.totalMinor)}</span>
                </button>
              );
            })}
            {!data.orders.length && (
              <p className="text-kumo-subtle">No hay pedidos abiertos.</p>
            )}
          </div>
        </section>
      )}
      {tab === "orders" && (
        <section className="border-t border-kumo-line p-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-normal">Historial de tickets</h2>
            <input
              aria-label="Buscar tickets"
              value={ticketSearch}
              onChange={(event) => setTicketSearch(event.target.value)}
              placeholder="Buscar ticket"
              className="ml-auto rounded-xl border border-kumo-line bg-kumo-elevated p-2"
            />
          </div>
          <div className="mt-4 grid gap-2">
            {data.tickets
              .filter(
                (ticket) =>
                  ticket.state !== "draft" &&
                  (!ticketSearch ||
                    ticket.id.toLowerCase().includes(ticketSearch.toLowerCase()) ||
                    ticket.metadata.orderName
                      ?.toLowerCase()
                      .includes(ticketSearch.toLowerCase())),
              )
              .map((ticket) => (
                <article
                  key={ticket.id}
                  className="flex items-center gap-4 rounded-xl border border-kumo-line bg-kumo-elevated p-4"
                >
                  <span className="flex-1">
                    {ticket.metadata.orderName ?? ticket.id} ·{" "}
                    {ticket.state === "paid" ? "Pagado" : "Cancelado"}
                  </span>
                  <span>{money(ticket.totalMinor)}</span>
                  <button
                    onClick={() => setReceipt({ order: ticket, change: 0 })}
                    className="rounded-xl border border-kumo-line px-3 py-2"
                  >
                    Reimprimir
                  </button>
                  {ticket.state === "paid" && (
                    <button
                      onClick={() => refund(ticket)}
                      className="rounded-xl border border-[#FE4A23] px-3 py-2 text-[#FE4A23]"
                    >
                      Devolver
                    </button>
                  )}
                </article>
              ))}
          </div>
        </section>
      )}
      {tab === "register" && (
        <section className="grid flex-1 lg:grid-cols-[1fr_450px]">
          <div className="border-r border-kumo-line p-4">
            <input
              aria-label="Buscar productos o escanear código"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const product = data.products.find(
                  (item) => item.sku?.toLowerCase() === search.trim().toLowerCase(),
                );
                if (product) {
                  change(product.id, 1);
                  setSearch("");
                }
              }}
              placeholder="Buscar productos o escanear código"
              className="mb-3 w-full rounded-xl border border-kumo-line bg-kumo-elevated p-3"
            />
            <div className="mb-4 flex gap-2">
              {categories.map((name) => (
                <button
                  key={name}
                  onClick={() => setCategory(name)}
                  className={`min-w-32 rounded-xl border px-5 py-4 ${category === name ? "border-[#FE4A23] bg-orange-100" : "border-kumo-line bg-kumo-elevated"}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {data.products
                .filter(
                  (product) =>
                    (!search ||
                      product.name.toLowerCase().includes(search.toLowerCase()) ||
                      product.sku?.toLowerCase().includes(search.toLowerCase())) &&
                    (!category || product.category === category),
                )
                .map((product) => (
                  <button
                    key={product.id}
                    onClick={() => change(product.id, 1)}
                    className="min-h-20 rounded-xl border border-kumo-line bg-kumo-elevated p-4 text-left"
                  >
                    <span className="block">{product.name}</span>
                    <span className="mt-2 block text-[#FE4A23]">
                      {money(
                        Math.round(
                          product.priceMinor *
                            (1 + product.taxBasisPoints / 10000),
                        ),
                      )}
                    </span>
                  </button>
                ))}
            </div>
          </div>
          <aside className="flex flex-col bg-kumo-elevated p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl">
                {table ? `Mesa ${table.name}` : "Pedido"}
              </h2>
              {order && (
                <button onClick={cancel} className="text-sm text-red-500">
                  Cancelar
                </button>
              )}
            </div>
            <div className="flex-1">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="flex items-center gap-3 border-b border-kumo-line py-3"
                >
                  <button
                    onClick={() => change(line.id, -1)}
                    className="h-8 w-8 rounded border"
                  >
                    −
                  </button>
                  <input
                    aria-label={`Cantidad de ${line.name}`}
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.quantity}
                    onChange={(event) =>
                      setQuantity(line.id, Number(event.target.value))
                    }
                    className="w-20 rounded border border-kumo-line bg-kumo-base p-1 text-center"
                  />
                  <button
                    onClick={() => change(line.id, 1)}
                    className="h-8 w-8 rounded border"
                  >
                    ＋
                  </button>
                  <div className="flex-1">
                    <span className="block">{line.name}</span>
                    {lineNotes[line.id] && (
                      <span className="block text-xs text-kumo-subtle">
                        {lineNotes[line.id]}
                      </span>
                    )}
                    <span className="block text-xs text-kumo-subtle">
                      Curso {lineCourses[line.id] ?? 1}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const note = window.prompt(
                        "Nota de la línea",
                        lineNotes[line.id] ?? "",
                      );
                      if (note !== null)
                        setLineNotes((current) => ({
                          ...current,
                          [line.id]: note.trim(),
                        }));
                    }}
                    className="rounded border border-kumo-line px-2 py-1 text-xs"
                  >
                    Nota
                  </button>
                  <button
                    onClick={() => {
                      const price = Number(
                        window.prompt("Precio unitario", String(line.unitPriceMinor)),
                      );
                      if (Number.isSafeInteger(price) && price >= 0)
                        setManualPrices((current) => ({
                          ...current,
                          [line.id]: price,
                        }));
                    }}
                    className="rounded border border-kumo-line px-2 py-1 text-xs"
                  >
                    Precio
                  </button>
                  <button
                    onClick={() => {
                      const course = Number(
                        window.prompt(
                          "Número de curso",
                          String(lineCourses[line.id] ?? 1),
                        ),
                      );
                      if (Number.isSafeInteger(course) && course > 0)
                        setLineCourses((current) => ({
                          ...current,
                          [line.id]: course,
                        }));
                    }}
                    className="rounded border border-kumo-line px-2 py-1 text-xs"
                  >
                    Curso
                  </button>
                  <span>{money(line.total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-kumo-line pt-4">
              <div className="flex justify-between text-sm text-kumo-subtle">
                <span>Impuestos</span>
                <span>{money(tax)}</span>
              </div>
              <div className="mt-2 flex justify-between text-xl">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
              {!order ? (
                <button
                  disabled={!lines.length || busy}
                  onClick={save}
                  className="mt-4 w-full rounded-xl bg-[#FE4A23] p-4 text-white disabled:opacity-40"
                >
                  Guardar pedido
                </button>
              ) : (
                <>
                  <label className="mt-4 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={splitPayment}
                      onChange={(event) => setSplitPayment(event.target.checked)}
                    />
                    Dividir pago
                  </label>
                  {splitPayment && (
                    <div className="mt-2 space-y-2 rounded-xl border border-kumo-line p-3">
                      {data.paymentMethods.map((method) => (
                        <label key={method.id} className="flex items-center gap-2">
                          <span className="flex-1">{method.name}</span>
                          <input
                            aria-label={`Monto ${method.name}`}
                            type="number"
                            min="0"
                            value={paymentAmounts[method.id] ?? ""}
                            onChange={(event) =>
                              setPaymentAmounts((current) => ({
                                ...current,
                                [method.id]: Math.max(0, Number(event.target.value)),
                              }))
                            }
                            className="w-32 rounded-xl border border-kumo-line bg-kumo-base p-2"
                          />
                        </label>
                      ))}
                      <div className="flex justify-between text-sm text-kumo-subtle">
                        <span>Asignado</span>
                        <span>{money(allocatedTotal)} / {money(total)}</span>
                      </div>
                    </div>
                  )}
                  {!splitPayment && isCash && (
                    <input
                      aria-label="Efectivo recibido"
                      type="number"
                      value={tender}
                      onChange={(event) => setTender(event.target.value)}
                      placeholder="Efectivo recibido"
                      className="mt-4 w-full rounded-xl border border-kumo-line bg-kumo-base p-3"
                    />
                  )}
                  <button
                    disabled={
                      busy ||
                      (splitPayment
                        ? allocatedPayments.length < 2 || allocatedTotal !== total
                        : isCash && Number(tender) < total)
                    }
                    onClick={pay}
                    className="mt-2 w-full rounded-xl bg-[#FE4A23] p-4 text-white disabled:opacity-40"
                  >
                    Pago
                  </button>
                </>
              )}
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}
