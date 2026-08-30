import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthenticatedApi } from "./AuthContext";
import { resolveSalesScope } from "./SalesPage";
import type {
  PosLoadDataView,
  PosOrderView,
} from "@gadgets/workshop-shared/api";
import { listPosOperations, queuePosOperation, removePosOperation } from "./posOffline";

const money = (n: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
type Tab = "floor" | "register" | "orders";
type DeviceBridge = {
  readScale(id?: string): Promise<{ ok?: boolean; weight: number | null }>;
  createPrintJob(job: {
    payload: string;
    format: "text";
    jobType: "receipt" | "kitchen_ticket";
    source: string;
  }): Promise<{ ok?: boolean; status?: string }>;
};
declare global {
  interface Window {
    NUEVAUNOBridge?: DeviceBridge;
  }
}

export default function PosPage() {
  const { authenticatedApi, businessSession } = useAuthenticatedApi(),
    scope = resolveSalesScope(businessSession);
  const [data, setData] = useState<PosLoadDataView | null>(null),
    [screen, setScreen] = useState<"dashboard" | "terminal">("dashboard"),
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
    [busy, setBusy] = useState(false),
    [offlinePending, setOfflinePending] = useState(0),
    [customerDisplay, setCustomerDisplay] = useState<{
      lines: Array<{ name: string; quantity: number; total: number }>;
      total: number;
    }>({ lines: [], total: 0 }),
    [layoutEditing, setLayoutEditing] = useState(false),
    [openingDialog, setOpeningDialog] = useState(false),
    [openingCashMinor, setOpeningCashMinor] = useState(0),
    [closingDialog, setClosingDialog] = useState(false),
    [countedCashMinor, setCountedCashMinor] = useState(0);
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
    [lineCourses, setLineCourses] = useState<Record<string, number>>({}),
    [pricelistId, setPricelistId] = useState(""),
    [shippingDate, setShippingDate] = useState(""),
    [fiscalPositionId, setFiscalPositionId] = useState(""),
    [lineLots, setLineLots] = useState<
      Record<string, Array<{ lotId: string; quantityMilli: number }>>
    >({}),
    [terminalReferences, setTerminalReferences] = useState<Record<string, string>>(
      {},
    );
  const orderUuid = useRef<string>(crypto.randomUUID());
  const scannerBuffer = useRef(""),
    scannerAt = useRef(0),
    syncChannel = useRef<BroadcastChannel | null>(null);
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
  useEffect(() => {
    if (!scope) return;
    const channel = new BroadcastChannel(
      `nuevauno-pos:${scope.organizationId}:${scope.companyId}`,
    );
    syncChannel.current = channel;
    channel.addEventListener("message", () => void refresh());
    return () => {
      channel.close();
      syncChannel.current = null;
    };
  }, [scope?.organizationId, scope?.companyId]);
  useEffect(() => {
    if (!scope) return;
    const operationScope = `${scope.organizationId}:${scope.companyId}`;
    const flush = async () => {
      const pending = await listPosOperations(operationScope);
      setOfflinePending(pending.length);
      for (const operation of pending) {
        try {
          await authenticatedApi.posSyncOrder(
            operation.payload as Parameters<
              typeof authenticatedApi.posSyncOrder
            >[0],
          );
          await removePosOperation(operation.id);
          syncChannel.current?.postMessage({ type: "order-synced" });
        } catch {
          break;
        }
      }
      setOfflinePending((await listPosOperations(operationScope)).length);
    };
    void flush();
    window.addEventListener("online", flush);
    const timer = window.setInterval(() => void flush(), 15_000);
    return () => {
      window.removeEventListener("online", flush);
      window.clearInterval(timer);
    };
  }, [scope?.organizationId, scope?.companyId]);
  useEffect(() => {
    const scan = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      const now = Date.now();
      if (now - scannerAt.current > 80) scannerBuffer.current = "";
      scannerAt.current = now;
      if (event.key === "Enter") {
        const product = data?.products.find(
          (item) =>
            item.sku?.toLowerCase() === scannerBuffer.current.toLowerCase() ||
            item.barcode?.toLowerCase() === scannerBuffer.current.toLowerCase(),
        );
        if (product) addProduct(product);
        scannerBuffer.current = "";
      } else if (event.key.length === 1) scannerBuffer.current += event.key;
    };
    window.addEventListener("keydown", scan);
    return () => window.removeEventListener("keydown", scan);
  }, [data]);
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
          fiscalRate =
            data?.fiscalPositions
              .find((position) => position.id === fiscalPositionId)
              ?.mappings.find(
                (mapping) =>
                  mapping.sourceRateBasisPoints === p.taxBasisPoints,
              )?.destinationRateBasisPoints ?? p.taxBasisPoints,
          tax = Math.round((subtotal * fiscalRate) / 10000);
        return [{ ...p, unitPriceMinor, quantity, subtotal, tax, total: subtotal + tax }];
      }),
    [cart, data, discountBasisPoints, manualPrices, fiscalPositionId],
  );
  const rawTotal = lines.reduce((sum, line) => sum + line.total, 0) + tipMinor,
    roundingIncrement = data?.config?.cashRoundingIncrementMinor ?? 1,
    total =
      data?.config?.cashRoundingMethod === "up"
        ? Math.ceil(rawTotal / roundingIncrement) * roundingIncrement
        : data?.config?.cashRoundingMethod === "down"
          ? Math.floor(rawTotal / roundingIncrement) * roundingIncrement
          : Math.round(rawTotal / roundingIncrement) * roundingIncrement,
    roundingMinor = total - rawTotal,
    tax = lines.reduce((sum, line) => sum + line.tax, 0);
  const isCustomerDisplay =
    new URLSearchParams(window.location.search).get("display") === "customer";
  useEffect(() => {
    if (!scope) return;
    const channel = new BroadcastChannel(
      `nuevauno-pos-display:${scope.organizationId}:${scope.companyId}`,
    );
    const displayPayload = {
      lines: lines.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        total: line.total,
      })),
      total,
    };
    if (isCustomerDisplay) {
      channel.addEventListener("message", (event) =>
        event.data?.type !== "request" && setCustomerDisplay(event.data),
      );
      channel.postMessage({ type: "request" }); // eslint-disable-line unicorn/require-post-message-target-origin
    } else {
      channel.addEventListener("message", (event) => {
        if (event.data?.type === "request")
          channel.postMessage(displayPayload); // eslint-disable-line unicorn/require-post-message-target-origin
      });
      // BroadcastChannel is same-origin by construction and accepts no targetOrigin.
      channel.postMessage(displayPayload); // eslint-disable-line unicorn/require-post-message-target-origin
    }
    return () => channel.close();
  }, [scope?.organizationId, scope?.companyId, isCustomerDisplay, lines, total]);
  if (!scope || !data)
    return <div className="p-8 text-kumo-subtle">Cargando Punto de venta…</div>;
  if (isCustomerDisplay)
    return (
      <main className="flex min-h-screen flex-col bg-kumo-base p-10">
        <p className="text-center text-sm text-[#FE4A23]">Tu pedido</p>
        <div className="mx-auto mt-10 w-full max-w-2xl flex-1 space-y-4">
          {customerDisplay.lines.map((line, index) => (
            <div key={`${line.name}:${index}`} className="flex justify-between text-2xl">
              <span>{line.quantity} × {line.name}</span>
              <span>{money(line.total)}</span>
            </div>
          ))}
        </div>
        <div className="mx-auto flex w-full max-w-2xl justify-between border-t border-kumo-line pt-6 text-4xl text-[#FE4A23]">
          <span>Total</span>
          <span>{money(customerDisplay.total)}</span>
        </div>
      </main>
    );
  const open = async () => {
    setBusy(true);
    try {
      await authenticatedApi.posOpenSession(
        scope.organizationId,
        scope.companyId,
        openingCashMinor,
      );
      await refresh();
      setOpeningDialog(false);
      setScreen("terminal");
    } finally {
      setBusy(false);
    }
  };
  const printTicket = async (
    ticket: PosOrderView,
    jobType: "receipt" | "kitchen_ticket",
  ) => {
    const payload = [
      data.config?.name ?? "Restaurant",
      ticket.metadata.orderName ?? ticket.id,
      table ? `Mesa ${table.name}` : "Pedido para llevar",
      ...ticket.lines.map(
        (line) =>
          `${line.quantity} x ${line.description}${line.customerNote ? ` · ${line.customerNote}` : ""}`,
      ),
      `Total ${money(ticket.totalMinor)}`,
    ].join("\n");
    if (window.NUEVAUNOBridge) {
      await window.NUEVAUNOBridge.createPrintJob({
        payload,
        format: "text",
        jobType,
        source: "nuevauno-os-pos",
      });
      return;
    }
    if (jobType === "receipt") window.print();
  };
  const printPreparationChanges = async (
    previous: PosOrderView | null,
    current: PosOrderView,
  ) => {
    const previousByProduct = new Map(
        (previous?.metadata.preparationState === "sent" ? previous.lines : []).map(
          (line) => [line.productVariantId, line],
        ),
      ),
      currentByProduct = new Map(
        current.lines.map((line) => [line.productVariantId, line]),
      ),
      added = current.lines.flatMap((line) => {
        const quantity =
          line.quantity - (previousByProduct.get(line.productVariantId)?.quantity ?? 0);
        return quantity > 0 ? [`+ ${quantity} × ${line.description}`] : [];
      }),
      removed = (previous?.lines ?? []).flatMap((line) => {
        const quantity =
          line.quantity - (currentByProduct.get(line.productVariantId)?.quantity ?? 0);
        return quantity > 0 ? [`- ${quantity} × ${line.description}`] : [];
      });
    if (!window.NUEVAUNOBridge || (!added.length && !removed.length)) return;
    await window.NUEVAUNOBridge.createPrintJob({
      payload: [
        data.config?.name ?? "Restaurant",
        table ? `Mesa ${table.name}` : "Pedido",
        ...added,
        ...removed,
      ].join("\n"),
      format: "text",
      jobType: "kitchen_ticket",
      source: "nuevauno-os-pos",
    });
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
    setPricelistId(existing?.metadata.pricelistId ?? "");
    setShippingDate(existing?.metadata.shippingDate ?? "");
    setFiscalPositionId(existing?.metadata.fiscalPositionId ?? "");
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
    setLineLots(
      Object.fromEntries(
        existing?.lines.flatMap((line) =>
          line.lotLines?.length
            ? [[line.productVariantId, line.lotLines]]
            : [],
        ) ?? [],
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
        ...(pricelistId ? { pricelistId } : {}),
        ...(shippingDate ? { shippingDate } : {}),
        ...(fiscalPositionId ? { fiscalPositionId } : {}),
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
        ...(lineLots[line.id]?.length ? { lotLines: lineLots[line.id] } : {}),
      })),
  });
  const save = async () => {
    if (!data.session || !lines.length) return;
    setBusy(true);
    try {
      const payload = orderPayload(),
        saved = await authenticatedApi.posSyncOrder(payload);
      setOrder(saved);
      syncChannel.current?.postMessage({ type: "order-synced", id: saved.id });
      await refresh();
    } catch (error) {
      if (navigator.onLine && !(error instanceof TypeError)) throw error;
      const payload = orderPayload(),
        id = `offline:${payload.uuid}:${Date.now()}`;
      await queuePosOperation({
        id,
        scope: `${scope.organizationId}:${scope.companyId}`,
        payload,
        createdAt: new Date().toISOString(),
      });
      setOfflinePending((current) => current + 1);
      return;
    } finally {
      setBusy(false);
    }
  };
  const change = (id: string, delta: number) =>
    setCart((current) => ({
      ...current,
      [id]: Math.max(0, (current[id] ?? 0) + delta),
    }));
  const setQuantity = (id: string, quantity: number) => {
    const normalized = Math.max(0, Math.round(quantity * 1000) / 1000),
      product = data?.products.find((item) => item.id === id);
    if (lineLots[id]?.length && !product?.lots.some((lot) => lot.tracking === "serial"))
      setLineLots((current) => ({
        ...current,
        [id]: [
          { ...current[id]![0]!, quantityMilli: Math.round(normalized * 1000) },
        ],
      }));
    setCart((current) => ({
      ...current,
      [id]: normalized,
    }));
  };
  const addProduct = (
    initial: PosLoadDataView["products"][number],
  ) => {
    const variants = data.products.filter(
        (product) => product.templateId === initial.templateId,
      ),
      variantName =
        variants.length > 1
          ? window.prompt(
              `Elige variante: ${variants
                .map(
                  (product) =>
                    `${product.name}${product.attributes.length ? ` (${product.attributes.map((attribute) => attribute.valueName).join(", ")})` : ""}`,
                )
                .join(", ")}`,
              initial.name,
            )
          : initial.name,
      product =
        variants.find(
          (candidate) =>
            candidate.name.toLowerCase() === variantName?.trim().toLowerCase(),
        ) ?? initial,
      comboSelections: Array<{
        componentName: string;
        product: PosLoadDataView["products"][number];
        quantity: number;
      }> = [];
    for (const component of product.comboComponents) {
      const available = data.products.filter(
          (candidate) => candidate.id !== product.id,
        ),
        response = window.prompt(
          `${component.name}: elige entre ${component.minChoices} y ${component.maxChoices}. Separa varias opciones con coma.\n${available
            .map((candidate) => candidate.name)
            .join(", ")}`,
          available[0]?.name ?? "",
        );
      if (response === null) return;
      const names = response
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
        choices = names.map((name) =>
          available.find(
            (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
          ),
        );
      if (
        choices.some((choice) => !choice) ||
        choices.length < component.minChoices ||
        choices.length > component.maxChoices
      ) {
        window.alert(
          `Debes elegir entre ${component.minChoices} y ${component.maxChoices} opciones válidas para ${component.name}.`,
        );
        return;
      }
      for (const choice of choices) {
        comboSelections.push({
          componentName: component.name,
          product: choice!,
          quantity: component.quantity,
        });
      }
    }
    if (product.lots.length) {
      const lotName = window.prompt(
          `Lote o serie: ${product.lots.map((lot) => lot.name).join(", ")}`,
          product.lots[0]?.name,
        ),
        lot = product.lots.find(
          (candidate) =>
            candidate.name.toLowerCase() === lotName?.trim().toLowerCase(),
        );
      if (!lot) return;
      const alreadySelected = lineLots[product.id]?.some(
        (selection) => selection.lotId === lot.id,
      );
      if (lot.tracking === "serial" && alreadySelected) {
        window.alert("Ese número de serie ya está agregado.");
        return;
      }
      setLineLots((current) => {
        const selections = current[product.id] ?? [],
          existing = selections.find((selection) => selection.lotId === lot.id);
        return {
          ...current,
          [product.id]: existing
            ? selections.map((selection) =>
                selection.lotId === lot.id
                  ? {
                      ...selection,
                      quantityMilli: selection.quantityMilli + 1000,
                    }
                  : selection,
              )
            : [...selections, { lotId: lot.id, quantityMilli: 1000 }],
        };
      });
    }
    change(product.id, 1);
    for (const optionalId of product.optionalProductIds) {
      const optional = data.products.find((candidate) => candidate.id === optionalId);
      if (optional && window.confirm(`¿Agregar ${optional.name}?`)) change(optional.id, 1);
    }
    for (const selection of comboSelections) {
      change(selection.product.id, selection.quantity);
      setLineNotes((current) => ({
        ...current,
        [selection.product.id]: `Parte de ${product.name}: ${selection.componentName}`,
      }));
    }
  };
  const removeProduct = (productId: string) => {
    const selections = lineLots[productId];
    if (selections?.length) {
      const last = selections.at(-1)!;
      setLineLots((current) => ({
        ...current,
        [productId]:
          last.quantityMilli > 1000
            ? current[productId]!.map((selection) =>
                selection.lotId === last.lotId
                  ? {
                      ...selection,
                      quantityMilli: selection.quantityMilli - 1000,
                    }
                  : selection,
              )
            : current[productId]!.slice(0, -1),
      }));
    }
    change(productId, -1);
  };
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
      ...(method.requiresTerminal && terminalReferences[method.id]
        ? { terminalReference: terminalReferences[method.id] }
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
              ...(selectedPaymentMethod?.requiresTerminal &&
              terminalReferences[selectedPaymentMethod.id]
                ? {
                    payments: [
                      {
                        paymentMethodId: selectedPaymentMethod.id,
                        amountMinor: updated.totalMinor,
                        terminalReference:
                          terminalReferences[selectedPaymentMethod.id],
                      },
                    ],
                  }
                : {}),
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
    const synchronized = await authenticatedApi.posSyncOrder(orderPayload());
    const sent = await authenticatedApi.posSendToPreparation(
        scope.organizationId,
        scope.companyId,
        synchronized.id,
      );
    setOrder(sent);
    await printPreparationChanges(order, sent);
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
  const merge = async () => {
    if (!order) return;
    const targets = data.orders.filter((item) => item.id !== order.id),
      name = window.prompt(
        `Unir con mesa: ${targets
          .map((item) => {
            const targetTable = data.floors
              .flatMap((floor) => floor.tables)
              .find((candidate) => candidate.id === item.tableId);
            return targetTable?.name ?? item.id;
          })
          .join(", ")}`,
      ),
      target = targets.find((item) => {
        const targetTable = data.floors
          .flatMap((floor) => floor.tables)
          .find((candidate) => candidate.id === item.tableId);
        return (targetTable?.name ?? item.id).toLowerCase() === name?.trim().toLowerCase();
      });
    if (!target) return;
    const merged = await authenticatedApi.posMergeOrders(
      scope.organizationId,
      scope.companyId,
      order.id,
      target.id,
    );
    const targetTable = data.floors
      .flatMap((floor) => floor.tables)
      .find((candidate) => candidate.id === target.tableId);
    setOrder(merged);
    setCart(
      Object.fromEntries(
        merged.lines.map((line) => [line.productVariantId, line.quantity]),
      ),
    );
    if (targetTable) setTable(targetTable);
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
    if (!Number.isSafeInteger(countedCashMinor) || countedCashMinor < 0) return;
    const result = await authenticatedApi.posCloseSession(
      scope.organizationId,
      scope.companyId,
      data.session.id,
      countedCashMinor,
    );
    setClosingDialog(false);
    setScreen("dashboard");
    await refresh();
    window.alert(`Caja cerrada. Diferencia: ${money(result.differenceMinor)}`);
  };
  const createTable = async (floorId: string) => {
    const name = window.prompt("Nombre de la mesa")?.trim(),
      seats = Number(window.prompt("Cantidad de asientos", "4"));
    if (!name || !Number.isSafeInteger(seats) || seats <= 0) return;
    await authenticatedApi.posCreateTable(
      scope.organizationId,
      scope.companyId,
      floorId,
      name,
      seats,
    );
    await refresh();
  };
  const editTable = async (
    current: PosLoadDataView["floors"][number]["tables"][number],
  ) => {
    const name = window.prompt("Nombre", current.name)?.trim(),
      seats = Number(window.prompt("Asientos", String(current.seats))),
      shape = window.prompt("Forma: square o round", current.shape),
      color = window.prompt("Color", current.color ?? "#FE4A23")?.trim(),
      width = Number(window.prompt("Ancho", String(current.width))),
      height = Number(window.prompt("Alto", String(current.height))),
      positionX = Number(window.prompt("Posición X", String(current.positionX))),
      positionY = Number(window.prompt("Posición Y", String(current.positionY)));
    if (!name || !Number.isSafeInteger(seats) || seats <= 0) return;
    await authenticatedApi.posUpdateTable(
      scope.organizationId,
      scope.companyId,
      current.id,
      {
        name,
        seats,
        shape: shape === "round" ? "round" : "square",
        width,
        height,
        positionX,
        positionY,
        ...(color ? { color } : {}),
      },
    );
    await refresh();
  };
  const deleteTable = async (
    current: PosLoadDataView["floors"][number]["tables"][number],
  ) => {
    if (!window.confirm(`Eliminar mesa ${current.name}`)) return;
    await authenticatedApi.posDeleteTable(
      scope.organizationId,
      scope.companyId,
      current.id,
    );
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
    setPricelistId("");
    setShippingDate("");
    setFiscalPositionId("");
    setLineLots({});
    setTerminalReferences({});
    setTable(null);
    orderUuid.current = crypto.randomUUID();
    setTab("floor");
  };
  if (screen === "dashboard" || !data.session)
    return (
      <main className="min-h-full bg-kumo-base p-6">
        <header className="mb-6 flex items-center justify-between border-b border-kumo-line pb-4">
          <div>
            <p className="text-sm text-[#FE4A23]">Punto de venta</p>
            <h1 className="mt-1 text-2xl font-normal">Cajas</h1>
          </div>
          <button onClick={() => void refresh()} className="rounded-xl border border-kumo-line bg-kumo-elevated px-4 py-2">Actualizar</button>
        </header>
        <section className="max-w-4xl rounded-xl border border-kumo-line bg-kumo-elevated p-6">
          <h2 className="text-2xl font-normal">{data.config?.name ?? "Restaurant"}</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-[240px_1fr]">
            <div>
              <button
                disabled={busy}
                onClick={() => data.session ? setScreen("terminal") : setOpeningDialog(true)}
                className="w-full rounded-xl bg-[#FE4A23] p-4 text-white disabled:opacity-40"
              >
                {data.session ? "Continuar vendiendo" : "Abrir caja"}
              </button>
              {data.session && data.orders.length === 0 && (
                <button onClick={() => { setCountedCashMinor(data.session?.expectedCashMinor ?? 0); setClosingDialog(true); }} className="mt-3 w-full rounded-xl border border-kumo-line p-3">Cerrar caja</button>
              )}
            </div>
            {data.session ? (
              <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
                <dt>Fecha</dt><dd>{data.session.openedAt ? new Date(data.session.openedAt).toLocaleString("es-CL") : "En curso"}</dd>
                <dt>Apertura</dt><dd>{money(data.session.openingCashMinor)}</dd>
                <dt>Vendido</dt><dd>{money(data.session.grossSalesMinor)} ({data.session.paidOrderCount} pedidos)</dd>
                <dt>En curso</dt><dd>{money(data.session.draftSalesMinor)} ({data.session.draftOrderCount} pedidos)</dd>
                <dt>Caja esperada</dt><dd>{money(data.session.expectedCashMinor)}</dd>
              </dl>
            ) : <p className="text-kumo-subtle">No hay una caja abierta. Ingresa el efectivo inicial para comenzar.</p>}
          </div>
        </section>
        {openingDialog && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <section role="dialog" aria-modal="true" aria-label="Control de apertura" className="w-full max-w-lg rounded-xl bg-kumo-elevated p-6 shadow-xl">
              <h2 className="text-2xl font-normal">Control de apertura</h2>
              <label className="mt-6 block">Efectivo inicial
                <input autoFocus type="number" min="0" value={openingCashMinor} onChange={(event) => setOpeningCashMinor(Math.max(0, Number(event.target.value)))} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base p-3" />
              </label>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setOpeningDialog(false)} className="rounded-xl border border-kumo-line px-4 py-3">Descartar</button>
                <button disabled={busy || !Number.isSafeInteger(openingCashMinor)} onClick={open} className="rounded-xl bg-[#FE4A23] px-4 py-3 text-white disabled:opacity-40">Abrir caja</button>
              </div>
            </section>
          </div>
        )}
        {closingDialog && data.session && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <section role="dialog" aria-modal="true" aria-label="Cerrar caja" className="w-full max-w-lg rounded-xl bg-kumo-elevated p-6 shadow-xl">
              <h2 className="text-2xl font-normal">Cerrar caja</h2>
              <dl className="mt-6 grid grid-cols-2 gap-3"><dt>Apertura</dt><dd className="text-right">{money(data.session.openingCashMinor)}</dd><dt>Ventas</dt><dd className="text-right">{money(data.session.grossSalesMinor)}</dd><dt>Esperado</dt><dd className="text-right">{money(data.session.expectedCashMinor)}</dd></dl>
              <label className="mt-6 block">Efectivo contado<input autoFocus type="number" min="0" value={countedCashMinor} onChange={(event) => setCountedCashMinor(Math.max(0, Number(event.target.value)))} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base p-3" /></label>
              <p className="mt-3 text-kumo-subtle">Diferencia: {money(countedCashMinor - data.session.expectedCashMinor)}</p>
              <div className="mt-6 flex justify-end gap-2"><button onClick={() => setClosingDialog(false)} className="rounded-xl border border-kumo-line px-4 py-3">Descartar</button><button disabled={busy || data.orders.length > 0} onClick={closeSession} className="rounded-xl bg-[#FE4A23] px-4 py-3 text-white disabled:opacity-40">Cerrar caja</button></div>
            </section>
          </div>
        )}
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
              onClick={() => printTicket(receipt.order, "receipt")}
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
        <button className="px-5 text-[#FE4A23]" onClick={() => setScreen("dashboard")}>Caja</button>
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
        {offlinePending > 0 && (
          <span className="my-auto mr-4 rounded-xl bg-amber-100 px-3 py-1 text-sm text-amber-800">
            {offlinePending} pendiente{offlinePending === 1 ? "" : "s"} de sincronizar
          </span>
        )}
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
          <select
            aria-label="Lista de precios"
            value={pricelistId}
            onChange={(event) => setPricelistId(event.target.value)}
            className="max-w-52 rounded-xl border border-kumo-line bg-kumo-base p-2"
          >
            <option value="">Precio general</option>
            {data.pricelists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Posición fiscal"
            value={fiscalPositionId}
            onChange={(event) => setFiscalPositionId(event.target.value)}
            className="max-w-52 rounded-xl border border-kumo-line bg-kumo-base p-2"
          >
            <option value="">Impuestos generales</option>
            {data.fiscalPositions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </select>
          {takeaway && (
            <input
              aria-label="Fecha de entrega"
              type="date"
              value={shippingDate}
              onChange={(event) => setShippingDate(event.target.value)}
              className="rounded-xl border border-kumo-line bg-kumo-base p-2"
            />
          )}
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
                onClick={merge}
                disabled={data.orders.length < 2}
                className="rounded-xl border border-kumo-line px-4 py-2 disabled:opacity-40"
              >
                Unir mesas
              </button>
              <button
                onClick={() => order && printTicket(order, "receipt")}
                className="rounded-xl border border-kumo-line px-4 py-2"
              >
                Cuenta provisoria
              </button>
              <button
                onClick={() =>
                  window.open(
                    `${window.location.pathname}?display=customer`,
                    "nuevauno-customer-display",
                    "popup,width=900,height=700",
                  )
                }
                className="rounded-xl border border-kumo-line px-4 py-2"
              >
                Pantalla cliente
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
            <button
              onClick={() => setLayoutEditing((current) => !current)}
              className="ml-2 rounded-xl border border-kumo-line px-5 py-3"
            >
              {layoutEditing ? "Terminar edición" : "Editar salón"}
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
              <div className="mb-4 flex items-center justify-center gap-3">
                <h1 className="text-lg font-normal">{floor.name}</h1>
                {layoutEditing && (
                  <button
                    onClick={() => createTable(floor.id)}
                    className="rounded-xl border border-kumo-line px-3 py-2 text-sm"
                  >
                    Nueva mesa
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {floor.tables.map((item) => {
                  const current = data.orders.find(
                    (value) => value.tableId === item.id,
                  );
                  return (
                    <button
                      key={item.id}
                      onClick={() =>
                        layoutEditing ? editTable(item) : selectTable(item)
                      }
                      onDoubleClick={() => layoutEditing && deleteTable(item)}
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
                      product.sku?.toLowerCase().includes(search.toLowerCase()) ||
                      product.barcode?.toLowerCase().includes(search.toLowerCase())) &&
                    (!category || product.category === category),
                )
                .map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addProduct(product)}
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
                    onClick={() => removeProduct(line.id)}
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
                    disabled={line.lots.some((lot) => lot.tracking === "serial")}
                    onChange={(event) =>
                      setQuantity(line.id, Number(event.target.value))
                    }
                    className="w-20 rounded border border-kumo-line bg-kumo-base p-1 text-center"
                  />
                  <button
                    onClick={() =>
                      line.lots.length ? addProduct(line) : change(line.id, 1)
                    }
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
                  {window.NUEVAUNOBridge && (
                    <button
                      onClick={async () => {
                        const reading = await window.NUEVAUNOBridge?.readScale();
                        if (reading?.ok !== false && reading?.weight)
                          setQuantity(line.id, reading.weight);
                      }}
                      className="rounded border border-kumo-line px-2 py-1 text-xs"
                    >
                      Báscula
                    </button>
                  )}
                  <span>{money(line.total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-kumo-line pt-4">
              <div className="flex justify-between text-sm text-kumo-subtle">
                <span>Impuestos</span>
                <span>{money(tax)}</span>
              </div>
              {roundingMinor !== 0 && (
                <div className="flex justify-between text-sm text-kumo-subtle">
                  <span>Redondeo</span>
                  <span>{money(roundingMinor)}</span>
                </div>
              )}
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
                        <div key={method.id} className="flex items-center gap-2">
                          <label className="contents">
                            <span className="flex-1">{method.name}</span>
                            <input
                              aria-label={`Monto ${method.name}`}
                              type="number"
                              min="0"
                              value={paymentAmounts[method.id] ?? ""}
                              onChange={(event) =>
                                setPaymentAmounts((current) => ({
                                  ...current,
                                  [method.id]: Math.max(
                                    0,
                                    Number(event.target.value),
                                  ),
                                }))
                              }
                              className="w-32 rounded-xl border border-kumo-line bg-kumo-base p-2"
                            />
                          </label>
                          {method.requiresTerminal && (
                            <input
                              aria-label={`Referencia ${method.name}`}
                              value={terminalReferences[method.id] ?? ""}
                              onChange={(event) =>
                                setTerminalReferences((current) => ({
                                  ...current,
                                  [method.id]: event.target.value,
                                }))
                              }
                              placeholder="Referencia terminal"
                              className="w-40 rounded-xl border border-kumo-line bg-kumo-base p-2"
                            />
                          )}
                        </div>
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
                  {!splitPayment && selectedPaymentMethod?.requiresTerminal && (
                    <input
                      aria-label="Referencia terminal"
                      value={terminalReferences[selectedPaymentMethod.id] ?? ""}
                      onChange={(event) =>
                        setTerminalReferences((current) => ({
                          ...current,
                          [selectedPaymentMethod.id]: event.target.value,
                        }))
                      }
                      placeholder="Referencia de autorización"
                      className="mt-4 w-full rounded-xl border border-kumo-line bg-kumo-base p-3"
                    />
                  )}
                  <button
                    disabled={
                      busy ||
                      (splitPayment
                        ? allocatedPayments.length < 2 ||
                          allocatedTotal !== total ||
                          allocatedPayments.some(
                            (payment) =>
                              data.paymentMethods.find(
                                (method) => method.id === payment.paymentMethodId,
                              )?.requiresTerminal && !payment.terminalReference,
                          )
                        : (isCash && Number(tender) < total) ||
                          (selectedPaymentMethod?.requiresTerminal &&
                            !terminalReferences[selectedPaymentMethod.id]))
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
