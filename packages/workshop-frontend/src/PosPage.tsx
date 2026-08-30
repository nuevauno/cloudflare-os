import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthenticatedApi } from "./AuthContext";
import { resolveSalesScope } from "./SalesPage";
import type {
  PosConfigSettingsView,
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
const elapsedLabel = (startedAt: string | undefined, now: number) => {
  if (!startedAt) return "0m";
  const minutes = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
const preparationBadge = (state: PosOrderView["metadata"]["preparationState"]) =>
  ({ draft: "", sent: "P", preparing: "EP", ready: "EC", served: "EC" })[state];
type Tab = "floor" | "register" | "orders" | "preparation";
type PosDialogRequest =
  | { kind: "text"; title: string; label?: string; value?: string }
  | { kind: "number"; title: string; label?: string; value?: number; min?: number; max?: number }
  | { kind: "selection"; title: string; options: Array<{ id: string; label: string }>; selected?: string[]; min?: number; max?: number }
  | { kind: "confirm"; title: string; body?: string; confirmLabel?: string }
  | { kind: "message"; title: string; body: string };
type PosDialogState = PosDialogRequest & { resolve: (value: string | string[] | number | boolean | null) => void };
type DeviceBridge = {
  readScale(id?: string): Promise<{ ok?: boolean; weight: number | null }>;
  createPrintJob(job: {
    payload: string;
    format: "text";
    jobType: "receipt" | "kitchen_ticket";
    source: string;
  }): Promise<{ ok?: boolean; status?: string }>;
};
type PosSettingDefinition = { key:string; label:string; help:string; kind?:"text"|"number"|"select"; options?:Array<{value:string;label:string}> };
type PosSettingSection = { title:string; items:PosSettingDefinition[] };
const POS_SETTING_SECTIONS:PosSettingSection[]=[
  {title:"Punto de venta",items:[
    {key:"pos_module_pos_restaurant",label:"Es un restaurante",help:"Activa mesas, salones y comandas."},
    {key:"pos_use_presets",label:"Para llevar / Entrega / Miembros",help:"Define modalidades con precios y reglas preestablecidas."},
    {key:"pos_cash_control",label:"Control de efectivo",help:"Registra apertura, movimientos y cierre de caja."},
  ]},
  {title:"Pago",items:[
    {key:"pos_auto_validate_terminal_payment",label:"Validar automáticamente",help:"Valida pagos confirmados por un terminal."},
    {key:"pos_cash_rounding",label:"Redondeo de efectivo",help:"Aplica la denominación mínima al pagar en efectivo."},
    {key:"pos_only_round_cash_method",label:"Solo medios en efectivo",help:"No redondea otros medios de pago."},
    {key:"pos_use_fast_payment",label:"Pago en un clic",help:"Omite la pantalla de pago con medios compatibles."},
    {key:"pos_set_maximum_difference",label:"Diferencia máxima",help:"Limita la diferencia autorizada al cerrar caja."},
    {key:"pos_amount_authorized_diff",label:"Diferencia autorizada",help:"Monto máximo permitido en CLP.",kind:"number"},
    {key:"pos_iface_tipproduct",label:"Propinas",help:"Acepta propinas del cliente o convierte el vuelto."},
    {key:"pos_set_tip_after_payment",label:"Propina después del pago",help:"Permite agregar propina una vez pagados los productos."},
  ]},
  {title:"Interfaz del PdV",items:[
    {key:"pos_module_pos_hr",label:"Iniciar sesión con empleados",help:"Permite identificar y cambiar garzones o cajeros."},
    {key:"pos_iface_big_scrollbars",label:"Barras de desplazamiento grandes",help:"Mejora el uso en pantallas táctiles imprecisas."},
    {key:"pos_show_product_images",label:"Mostrar imágenes de productos",help:"Muestra imágenes en las tarjetas del catálogo."},
    {key:"pos_show_category_images",label:"Mostrar imágenes de categorías",help:"Muestra imágenes en categorías."},
    {key:"pos_iface_group_by_categ",label:"Agrupar productos por categoría",help:"Ordena el catálogo por categorías."},
    {key:"pos_default_screen",label:"Pantalla predeterminada",help:"Selecciona mesa antes o después de registrar.",kind:"select",options:[{value:"tables",label:"Mesas"},{value:"register",label:"Caja"}]},
  ]},
  {title:"Categorías de producto y PdV",items:[
    {key:"pos_limit_categories",label:"Restringir categorías",help:"Selecciona las categorías disponibles en este PdV."},
    {key:"pos_is_margins_costs_accessible_to_every_user",label:"Mostrar márgenes y costos",help:"Expone margen y costo en la información del producto."},
  ]},
  {title:"Contabilidad",items:[
    {key:"sale_tax_id",label:"Impuesto de venta predeterminado",help:"Código del impuesto aplicado a productos nuevos.",kind:"text"},
    {key:"account_default_pos_receivable_account_id",label:"Cuenta por cobrar predeterminada",help:"Cuenta intermediaria para clientes sin identificar.",kind:"text"},
    {key:"pos_order_edit_tracking",label:"Seguimiento de edición",help:"Conserva las modificaciones hechas a pedidos."},
    {key:"pos_tax_regime_selection",label:"Impuestos flexibles",help:"Permite elegir una posición fiscal por pedido."},
    {key:"pos_is_closing_entry_by_product",label:"Asiento de cierre por producto",help:"Desglosa ventas por producto en el cierre."},
  ]},
  {title:"Precios",items:[
    {key:"pos_use_pricelist",label:"Listas de precios flexibles",help:"Permite seleccionar listas de precios."},
    {key:"pos_restrict_price_control",label:"Control de precios",help:"Restringe cambios de precio según permisos."},
    {key:"pos_iface_tax_included",label:"Precios con impuestos incluidos",help:"Muestra precios finales en productos y recibos."},
    {key:"pos_manual_discount",label:"Descuentos por línea",help:"Permite aplicar descuentos manuales."},
  ]},
  {title:"Facturas y recibos",items:[
    {key:"pos_is_header_or_footer",label:"Encabezado y pie personalizados",help:"Agrega mensajes propios al recibo."},
    {key:"pos_receipt_header",label:"Encabezado",help:"Texto superior del recibo.",kind:"text"},
    {key:"pos_receipt_footer",label:"Pie",help:"Texto inferior del recibo.",kind:"text"},
    {key:"pos_iface_print_auto",label:"Impresión automática",help:"Imprime el recibo al validar el pago."},
    {key:"pos_iface_print_skip_screen",label:"Omitir pantalla de recibo",help:"Vuelve directamente a una venta nueva."},
    {key:"point_of_sale_use_ticket_qr_code",label:"Código QR en el recibo",help:"Permite consultar el ticket desde un QR."},
    {key:"pos_basic_receipt",label:"Recibo básico",help:"Usa un formato compacto sin precios para regalos."},
    {key:"pos_iface_printbill",label:"Cuenta provisoria",help:"Permite imprimir antes del pago."},
    {key:"pos_iface_splitbill",label:"Dividir cuenta",help:"Divide el total o líneas del pedido."},
  ]},
  {title:"Terminales de pago",items:[
    {key:"module_pos_adyen",label:"Adyen",help:"Activa el conector de terminal Adyen."},
    {key:"module_pos_stripe",label:"Stripe",help:"Activa el conector de terminal Stripe."},
    {key:"module_pos_mercado_pago",label:"Mercado Pago",help:"Activa el conector de Mercado Pago."},
    {key:"module_pos_qfpay",label:"QFPay",help:"Activa el conector QFPay."},
  ]},
  {title:"NUEVAUNO Desktop y dispositivos",items:[
    {key:"pos_other_devices",label:"Impresora de recibos",help:"Usa una impresora conectada mediante Desktop."},
    {key:"pos_epson_printer_ip",label:"Dirección de impresora",help:"IP o identificador de la impresora.",kind:"text"},
    {key:"pos_iface_cashdrawer",label:"Cajón de efectivo",help:"Abre el cajón al validar pagos en efectivo."},
    {key:"pos_iface_electronic_scale",label:"Balanza electrónica",help:"Lee peso desde NUEVAUNO Desktop."},
    {key:"pos_customer_display_bg_img",label:"Pantalla del cliente",help:"Configura la pantalla secundaria del cliente.",kind:"text"},
  ]},
  {title:"Preparación",items:[
    {key:"pos_is_order_printer",label:"Impresoras de preparación",help:"Envía comandas a cocina o bar."},
    {key:"pos_note_ids",label:"Notas internas",help:"Activa notas rápidas para la preparación."},
  ]},
  {title:"Inventario",items:[
    {key:"pos_ship_later",label:"Permitir envío posterior",help:"Vende ahora y despacha después."},
    {key:"pos_picking_policy",label:"Política de despacho",help:"Define entrega parcial o completa.",kind:"select",options:[{value:"direct",label:"Lo disponible"},{value:"one",label:"Todo junto"}]},
    {key:"barcode_nomenclature_id",label:"Nomenclatura de códigos",help:"Reglas para escanear productos y clientes.",kind:"text"},
    {key:"update_stock_quantities",label:"Gestión de inventario",help:"Actualiza existencias según pedidos pagados."},
  ]},
];
declare global {
  interface Window {
    NUEVAUNOBridge?: DeviceBridge;
  }
}

export default function PosPage() {
  const { authenticatedApi, businessSession } = useAuthenticatedApi(),
    scope = resolveSalesScope(businessSession);
  const [data, setData] = useState<PosLoadDataView | null>(null),
    [screen, setScreen] = useState<"dashboard" | "settings" | "terminal" | "payment">("dashboard"),
    [tab, setTab] = useState<Tab>("floor"),
    [table, setTable] = useState<{
      id: string;
      name: string;
      seats: number;
    } | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({}),
    [selectedLineId,setSelectedLineId]=useState(""),
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
    [countedCashMinor, setCountedCashMinor] = useState(0),
    [noteEditor, setNoteEditor] = useState<{
      productId: string;
      productName: string;
      value: string;
    } | null>(null),
    [partnerDialog, setPartnerDialog] = useState(false),
    [partnerSearch, setPartnerSearch] = useState(""),
    [partnerCreate, setPartnerCreate] = useState(false),
    [actionsOpen,setActionsOpen]=useState(false),
    [partnerDraft, setPartnerDraft] = useState({displayName:"",email:"",phone:"",taxIdentifier:""}),
    [dialog, setDialog] = useState<PosDialogState | null>(null),
    [dialogText, setDialogText] = useState(""),
    [dialogSelections, setDialogSelections] = useState<string[]>([]);
  const [settingsDraft,setSettingsDraft]=useState<PosConfigSettingsView>({}),[settingsDirty,setSettingsDirty]=useState(false),[clock,setClock]=useState(Date.now());
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
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const requestDialog = (request: PosDialogRequest) =>
    new Promise<string | string[] | number | boolean | null>((resolve) => {
      setDialogText("value" in request ? String(request.value ?? "") : "");
      setDialogSelections(request.kind === "selection" ? request.selected ?? [] : []);
      setDialog({ ...request, resolve });
    });
  const finishDialog = (value: string | string[] | number | boolean | null) => {
    dialog?.resolve(value);
    setDialog(null);
  };
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
    const synchronize = () => {
      if (navigator.onLine && document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(synchronize, 2_000);
    window.addEventListener("focus", synchronize);
    document.addEventListener("visibilitychange", synchronize);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", synchronize);
      document.removeEventListener("visibilitychange", synchronize);
    };
  }, [scope?.organizationId, scope?.companyId]);
  useEffect(()=>{if(data?.config&&!settingsDirty)setSettingsDraft(data.config.settings)},[data?.config,settingsDirty]);
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
  const addProduct = async (
    initial: PosLoadDataView["products"][number],
  ) => {
    const variants = data.products.filter(
        (product) => product.templateId === initial.templateId,
      ),
      variantId =
        variants.length > 1
          ? await requestDialog({
              kind: "selection",
              title: "Configurar producto",
              options: variants.map((product) => ({
                id: product.id,
                label: `${product.name}${product.attributes.length ? ` · ${product.attributes.map((attribute) => attribute.valueName).join(", ")}` : ""}`,
              })),
              selected: [initial.id],
              min: 1,
              max: 1,
            })
          : [initial.id];
    if (variantId === null) return;
    const product =
        variants.find((candidate) => candidate.id === (variantId as string[] | null)?.[0]) ?? initial,
      comboSelections: Array<{
        componentName: string;
        product: PosLoadDataView["products"][number];
        quantity: number;
      }> = [];
    for (const component of product.comboComponents) {
      const available = data.products.filter(
          (candidate) => candidate.id !== product.id,
        ),
        selected = await requestDialog({
          kind: "selection",
          title: component.name,
          options: available.map((candidate) => ({ id: candidate.id, label: candidate.name })),
          min: component.minChoices,
          max: component.maxChoices,
        });
      if (selected === null) return;
      const choices = (selected as string[]).map((id) => available.find((candidate) => candidate.id === id));
      if (
        choices.some((choice) => !choice) ||
        choices.length < component.minChoices ||
        choices.length > component.maxChoices
      ) {
        await requestDialog({ kind: "message", title: "Selección incompleta", body: `Debes elegir entre ${component.minChoices} y ${component.maxChoices} opciones para ${component.name}.` });
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
      const lotSelection = await requestDialog({
          kind: "selection",
          title: product.lots.some((lot) => lot.tracking === "serial") ? "Seleccionar número de serie" : "Seleccionar lote",
          options: product.lots.map((lot) => ({ id: lot.id, label: lot.name })),
          selected: product.lots[0] ? [product.lots[0].id] : [],
          min: 1,
          max: 1,
        }),
        lot = product.lots.find((candidate) => candidate.id === (lotSelection as string[] | null)?.[0]);
      if (!lot) return;
      const alreadySelected = lineLots[product.id]?.some(
        (selection) => selection.lotId === lot.id,
      );
      if (lot.tracking === "serial" && alreadySelected) {
        await requestDialog({ kind: "message", title: "Número de serie duplicado", body: "Ese número de serie ya está agregado." });
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
      if (optional && await requestDialog({ kind: "confirm", title: "Producto opcional", body: `¿Agregar ${optional.name}?`, confirmLabel: "Agregar" })) change(optional.id, 1);
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
  const setPreparationState = async (
    target: PosOrderView,
    state: "preparing" | "ready" | "served",
  ) => {
    await authenticatedApi.posSetPreparationState(
      scope.organizationId,
      scope.companyId,
      target.id,
      state,
    );
    syncChannel.current?.postMessage({ type: "preparation-state", orderId: target.id, state });
    await refresh();
  };
  const transfer = async () => {
    if (!order) return;
    const available = data.floors
        .flatMap((floor) => floor.tables)
        .filter((item) => item.id !== table?.id),
      selected = await requestDialog({ kind: "selection", title: "Mover mesa", options: available.map((item) => ({ id: item.id, label: item.name })), min: 1, max: 1 });
    const target = available.find((item) => item.id === (selected as string[] | null)?.[0]);
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
      selected = await requestDialog({
        kind: "selection",
        title: "Unir mesas",
        options: targets.map((item) => ({
          id: item.id,
          label: data.floors.flatMap((floor) => floor.tables).find((candidate) => candidate.id === item.tableId)?.name ?? item.id,
        })),
        min: 1,
        max: 1,
      }),
      target = targets.find((item) => item.id === (selected as string[] | null)?.[0]);
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
    const lineQuantities: Array<{ lineId: string; quantity: number }> = [];
    for (const line of order.lines) {
      const quantity = Number(await requestDialog({ kind: "number", title: "Dividir cuenta", label: line.description, value: 0, min: 0, max: line.quantity }));
      if (quantity > 0 && quantity <= line.quantity) lineQuantities.push({ lineId: line.id, quantity });
    }
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
    const amount = Number(await requestDialog({ kind: "number", title: direction === "in" ? "Entrada de efectivo" : "Salida de efectivo", label: "Monto", min: 1 })),
      reasonValue = await requestDialog({ kind: "text", title: "Movimiento de caja", label: "Motivo" }),
      reason = typeof reasonValue === "string" ? reasonValue.trim() : "";
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
    await requestDialog({ kind: "message", title: "Caja cerrada", body: `Diferencia: ${money(result.differenceMinor)}` });
  };
  const createTable = async (floorId: string) => {
    const nameValue = await requestDialog({ kind: "text", title: "Nueva mesa", label: "Nombre" }),
      seats = Number(await requestDialog({ kind: "number", title: "Nueva mesa", label: "Cantidad de asientos", value: 4, min: 1 })),
      name = typeof nameValue === "string" ? nameValue.trim() : "";
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
    const nameValue = await requestDialog({ kind: "text", title: "Editar mesa", label: "Nombre", value: current.name }),
      seats = Number(await requestDialog({ kind: "number", title: "Editar mesa", label: "Asientos", value: current.seats, min: 1 })),
      shapeSelection = await requestDialog({ kind: "selection", title: "Forma de la mesa", options: [{ id: "square", label: "Cuadrada" }, { id: "round", label: "Redonda" }], selected: [current.shape], min: 1, max: 1 }),
      colorValue = await requestDialog({ kind: "text", title: "Editar mesa", label: "Color", value: current.color ?? "#FE4A23" }),
      width = Number(await requestDialog({ kind: "number", title: "Editar mesa", label: "Ancho", value: current.width, min: 1 })),
      height = Number(await requestDialog({ kind: "number", title: "Editar mesa", label: "Alto", value: current.height, min: 1 })),
      positionX = Number(await requestDialog({ kind: "number", title: "Editar mesa", label: "Posición horizontal", value: current.positionX })),
      positionY = Number(await requestDialog({ kind: "number", title: "Editar mesa", label: "Posición vertical", value: current.positionY })),
      name = typeof nameValue === "string" ? nameValue.trim() : "",
      color = typeof colorValue === "string" ? colorValue.trim() : "",
      shape = (shapeSelection as string[] | null)?.[0];
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
    if (!await requestDialog({ kind: "confirm", title: "Eliminar mesa", body: `¿Eliminar mesa ${current.name}?`, confirmLabel: "Eliminar" })) return;
    await authenticatedApi.posDeleteTable(
      scope.organizationId,
      scope.companyId,
      current.id,
    );
    await refresh();
  };
  const refund = async (ticket: PosOrderView) => {
    if (ticket.state !== "paid") return;
    const refundLines: Array<{ lineId: string; quantity: number }> = [];
    for (const line of ticket.lines) {
      const quantity = Number(await requestDialog({ kind: "number", title: "Devolver productos", label: line.description, value: line.quantity, min: 0, max: line.quantity }));
      if (quantity > 0 && quantity <= line.quantity) refundLines.push({ lineId: line.id, quantity });
    }
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
  const saveSettings=async()=>{if(!scope)return;setBusy(true);try{await authenticatedApi.posUpdateSettings(scope.organizationId,scope.companyId,settingsDraft);setSettingsDirty(false);await refresh()}finally{setBusy(false)}};
  if(screen==="settings"&&data.config)return <main className="min-h-full bg-[#f6f7f8] text-[#202124]">
    <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-kumo-line bg-kumo-base px-5">
      <button onClick={()=>setScreen("dashboard")} className="rounded-xl border border-kumo-line px-4 py-2">Volver</button>
      <button disabled={!settingsDirty||busy} onClick={()=>void saveSettings()} className="rounded-xl bg-[#FE4A23] px-5 py-2 text-white disabled:opacity-40">Guardar</button>
      <button disabled={!settingsDirty||busy} onClick={()=>{setSettingsDraft(data.config?.settings??{});setSettingsDirty(false)}} className="rounded-xl border border-kumo-line px-4 py-2 disabled:opacity-40">Descartar</button>
      <h1 className="ml-4 text-xl font-normal">Ajustes del punto de venta</h1>
    </header>
    <div className="mx-auto max-w-6xl p-5">
      <section className="mb-4 rounded-xl border border-[#f0c68d] bg-[#fff2dc] p-4 text-sm">Los cambios se aplican a {data.config.name}. Las opciones dependientes de hardware requieren NUEVAUNO Desktop conectado.</section>
      {POS_SETTING_SECTIONS.map(section=><section key={section.title} className="mb-4 overflow-hidden rounded-xl border border-kumo-line bg-kumo-base">
        <h2 className="border-b border-kumo-line bg-[#eef0f2] px-5 py-3 text-base font-normal">{section.title}</h2>
        <div className="grid md:grid-cols-2">
          {section.items.map(item=>{const value=settingsDraft[item.key];return <label key={item.key} className="grid min-h-28 grid-cols-[24px_1fr] gap-3 border-b border-r border-kumo-line p-5">
            {item.kind ? <span/>:<input type="checkbox" checked={Boolean(value)} onChange={event=>{setSettingsDraft(current=>({...current,[item.key]:event.target.checked}));setSettingsDirty(true)}} className="mt-1 h-4 w-4 accent-[#FE4A23]"/>}
            <span><span className="block text-[15px]">{item.label}</span><span className="mt-1 block text-sm text-kumo-subtle">{item.help}</span>
              {item.kind==="text"&&<input value={typeof value==="string"?value:""} onChange={event=>{setSettingsDraft(current=>({...current,[item.key]:event.target.value}));setSettingsDirty(true)}} className="mt-3 w-full rounded-xl border border-kumo-line bg-kumo-base px-3 py-2"/>}
              {item.kind==="number"&&<input type="number" value={typeof value==="number"?value:0} onChange={event=>{setSettingsDraft(current=>({...current,[item.key]:Number(event.target.value)}));setSettingsDirty(true)}} className="mt-3 w-full rounded-xl border border-kumo-line bg-kumo-base px-3 py-2"/>}
              {item.kind==="select"&&<select value={typeof value==="string"?value:""} onChange={event=>{setSettingsDraft(current=>({...current,[item.key]:event.target.value}));setSettingsDirty(true)}} className="mt-3 w-full rounded-xl border border-kumo-line bg-kumo-base px-3 py-2"><option value="">Seleccionar</option>{item.options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>}
            </span>
          </label>})}
        </div>
      </section>)}
    </div>
  </main>;
  if (screen === "dashboard" || !data.session)
    return (
      <main className="min-h-full bg-kumo-base p-6">
        <header className="mb-6 flex items-center justify-between border-b border-kumo-line pb-4">
          <div>
            <p className="text-sm text-[#FE4A23]">Punto de venta</p>
            <h1 className="mt-1 text-2xl font-normal">Cajas</h1>
          </div>
          <div className="flex gap-2"><button onClick={()=>setScreen("settings")} className="rounded-xl border border-kumo-line bg-kumo-elevated px-4 py-2">Ajustes</button><button onClick={() => void refresh()} className="rounded-xl border border-kumo-line bg-kumo-elevated px-4 py-2">Actualizar</button></div>
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
  if (screen === "payment") {
    const remaining = Math.max(0, total - allocatedTotal),
      selectedPartner = data.partners.find((partner) => partner.id === partnerId),
      canValidate = splitPayment
        ? allocatedPayments.length > 0 && allocatedTotal === total
        : Boolean(selectedPaymentMethod) && (!isCash || Number(tender) >= total);
    return (
      <main className="grid min-h-full grid-cols-[minmax(260px,340px)_1fr_minmax(300px,440px)] bg-kumo-base">
        <aside className="flex min-h-full flex-col border-r border-kumo-line bg-kumo-elevated p-5">
          <h1 className="text-lg font-normal">Pedido</h1>
          <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
            {lines.map((line) => <div key={line.id} className="grid grid-cols-[32px_1fr_auto] gap-2 text-sm"><span>{line.quantity}</span><span>{line.name}</span><span>{money(line.total)}</span></div>)}
            {tipMinor > 0 && <div className="grid grid-cols-[32px_1fr_auto] gap-2 border-l-4 border-[#FE4A23] bg-orange-50 p-2 text-sm"><span>1</span><span>Propina</span><span>{money(tipMinor)}</span></div>}
          </div>
          <div className="space-y-2 border-t border-kumo-line pt-4"><div className="flex justify-between text-kumo-subtle"><span>Impuestos</span><span>{money(tax)}</span></div><div className="flex justify-between text-xl"><span>Total</span><span>{money(total)}</span></div></div>
        </aside>
        <section className="flex min-h-full flex-col p-8">
          <div className="text-center"><p className="text-[clamp(64px,8vw,125px)] leading-none">{money(remaining)}</p><p className="mt-4 text-2xl text-kumo-subtle">Restante</p></div>
          <div className="mx-auto mt-10 w-full max-w-3xl flex-1 space-y-3">
            {allocatedPayments.map((payment) => {
              const method = data.paymentMethods.find((item) => item.id === payment.paymentMethodId);
              return <div key={payment.paymentMethodId} className="flex items-center justify-between rounded-xl border border-[#FE4A23] bg-orange-50 p-5"><span>{method?.name}</span><span>{money(payment.amountMinor)}</span><button onClick={() => setPaymentAmounts((current) => ({...current,[payment.paymentMethodId]:0}))} className="text-[#FE4A23]">×</button></div>;
            })}
          </div>
        </section>
        <aside className="flex min-h-full flex-col border-l border-kumo-line bg-kumo-elevated p-4">
          <div className="space-y-2">
            {data.paymentMethods.map((method) => <button key={method.id} onClick={() => { const rest=Math.max(0,total-allocatedTotal); setPaymentMethodId(method.id); if(method.methodType!=="cash") { setPaymentAmounts((current)=>({...current,[method.id]:(current[method.id]??0)+rest})); setSplitPayment(true); } }} className="flex w-full justify-between rounded-xl border border-kumo-line p-5 text-left"><span>{method.name}</span><span>{money(paymentAmounts[method.id] ?? 0)}</span></button>)}
          </div>
          <div className="mt-auto space-y-2">
            <div className="grid grid-cols-2 gap-2"><button onClick={() => setPartnerDialog(true)} className="rounded-xl border border-kumo-line p-4">{selectedPartner?.displayName ?? "Cliente"}</button><button onClick={() => setInvoiceRequested((value) => !value)} className={`rounded-xl border p-4 ${invoiceRequested ? "border-[#FE4A23] bg-orange-50" : "border-kumo-line"}`}>Factura</button></div>
            <button onClick={() => setTipMinor(Math.round((rawTotal-tipMinor)*0.1))} className={`flex w-full justify-between rounded-xl border p-4 ${tipMinor ? "border-[#FE4A23] bg-orange-50" : "border-kumo-line"}`}><span>Propina</span><span>{tipMinor ? money(tipMinor) : "Agregar"}</span></button>
            {selectedPaymentMethod?.methodType === "cash" && <input autoFocus aria-label="Efectivo recibido" type="number" value={tender} onChange={(event)=>setTender(event.target.value)} placeholder="Efectivo recibido" className="w-full rounded-xl border border-kumo-line bg-kumo-base p-4" />}
            <label className="flex items-center gap-2 p-2"><input type="checkbox" checked={splitPayment} onChange={(event)=>setSplitPayment(event.target.checked)} /> Pago múltiple</label>
            <div className="grid grid-cols-2 gap-2"><button onClick={()=>setScreen("terminal")} className="rounded-xl border border-kumo-line p-4">Regresar</button><button disabled={!canValidate||busy} onClick={pay} className="rounded-xl bg-[#FE4A23] p-4 text-white disabled:opacity-40">Validar</button></div>
          </div>
        </aside>
        {partnerDialog && <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"><section role="dialog" aria-modal="true" aria-label="Elegir cliente" className="flex h-[75vh] w-full max-w-5xl flex-col rounded-xl bg-kumo-elevated shadow-xl"><header className="flex items-center gap-3 border-b border-kumo-line p-4"><button onClick={()=>setPartnerCreate((value)=>!value)} className="rounded-xl bg-[#FE4A23] px-5 py-3 text-white">{partnerCreate?"Volver":"Crear"}</button><h2 className="text-xl font-normal">{partnerCreate?"Nuevo cliente":"Elige un cliente"}</h2>{!partnerCreate&&<input autoFocus value={partnerSearch} onChange={(event)=>setPartnerSearch(event.target.value)} placeholder="Buscar clientes…" className="ml-auto w-72 rounded-xl border border-kumo-line bg-kumo-base p-3" />}</header>{partnerCreate?<form onSubmit={async(event)=>{event.preventDefault();const created=await authenticatedApi.posCreatePartner(scope.organizationId,scope.companyId,{displayName:partnerDraft.displayName,...(partnerDraft.email?{email:partnerDraft.email}:{}),...(partnerDraft.phone?{phone:partnerDraft.phone}:{}),...(partnerDraft.taxIdentifier?{taxIdentifier:partnerDraft.taxIdentifier}:{})});setPartnerId(created.id);setPartnerDialog(false);setPartnerCreate(false);setPartnerDraft({displayName:"",email:"",phone:"",taxIdentifier:""});await refresh()}} className="grid flex-1 content-start gap-4 overflow-y-auto p-6 md:grid-cols-2"><label>Nombre<input required autoFocus value={partnerDraft.displayName} onChange={(event)=>setPartnerDraft((current)=>({...current,displayName:event.target.value}))} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base p-3" /></label><label>RUT<input value={partnerDraft.taxIdentifier} onChange={(event)=>setPartnerDraft((current)=>({...current,taxIdentifier:event.target.value}))} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base p-3" /></label><label>Correo<input type="email" value={partnerDraft.email} onChange={(event)=>setPartnerDraft((current)=>({...current,email:event.target.value}))} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base p-3" /></label><label>Teléfono<input value={partnerDraft.phone} onChange={(event)=>setPartnerDraft((current)=>({...current,phone:event.target.value}))} className="mt-2 w-full rounded-xl border border-kumo-line bg-kumo-base p-3" /></label><button className="rounded-xl bg-[#FE4A23] p-4 text-white md:col-span-2">Guardar cliente</button></form>:<div className="flex-1 overflow-y-auto">{data.partners.filter((partner)=>[partner.displayName,partner.email,partner.phone].filter(Boolean).join(" ").toLowerCase().includes(partnerSearch.toLowerCase())).map((partner)=><button key={partner.id} onClick={()=>{setPartnerId(partner.id);setPartnerDialog(false)}} className={`grid w-full grid-cols-[1fr_1fr_1fr] border-b border-kumo-line p-5 text-left hover:bg-kumo-line ${partner.id===partnerId?"bg-orange-50":""}`}><span>{partner.displayName}</span><span>{partner.email}</span><span>{partner.phone}</span></button>)}</div>}<footer className="border-t border-kumo-line p-4"><button onClick={()=>setPartnerDialog(false)} className="w-full rounded-xl border border-kumo-line p-4">Descartar</button></footer></section></div>}
      </main>
    );
  }
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
        <span className="m-auto" />
        {tab==="register"&&<label className="my-2 mr-4 flex w-[min(30vw,380px)] items-center gap-3 rounded-xl border border-kumo-line px-4"><span className="text-2xl">⌕</span><input aria-label="Buscar productos" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar productos…" className="min-w-0 flex-1 bg-transparent outline-none"/></label>}
        <button aria-label="Usuario" className="my-auto mr-4 h-7 w-7 rounded-lg bg-purple-700 text-sm text-white">A</button>
        <button aria-label="Menú principal" onClick={()=>setScreen("dashboard")} className="my-auto mr-5 text-2xl">☰</button>
        {offlinePending > 0 && (
          <span className="my-auto mr-4 rounded-xl bg-amber-100 px-3 py-1 text-sm text-amber-800">
            {offlinePending} pendiente{offlinePending === 1 ? "" : "s"} de sincronizar
          </span>
        )}
      </nav>
      {data && tab === "register" && screen === "settings" && (
        <section aria-hidden="true" className="hidden">
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
            {data?.partners.map((partner) => (
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
            {data?.pricelists.map((list) => (
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
            {data?.fiscalPositions.map((position) => (
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
            {data?.paymentMethods.map((method) => (
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
                disabled={(data?.orders.length??0) < 2}
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
            <div className="flex flex-wrap items-center gap-4 text-sm text-kumo-subtle">
              <span><i className="mr-1 inline-block h-3 w-3 rounded bg-kumo-line" />Libre</span>
              <span><i className="mr-1 inline-block h-3 w-3 rounded bg-[#FE4A23]" />Ocupada</span>
              <span><i className="mr-1 inline-block h-3 w-3 rounded bg-red-500" />Demorada</span>
              <span><i className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] text-white">P</i>Pendiente</span>
              <span><i className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[9px] text-white">EP</i>Envío parcial</span>
              <span><i className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[9px] text-white">EC</i>Enviado</span>
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
                  const startedAt = current?.createdAt ?? data.session?.openedAt;
                  const elapsedMinutes = startedAt
                    ? Math.max(0, Math.floor((clock - new Date(startedAt).getTime()) / 60_000))
                    : 0;
                  const isLate = Boolean(current && elapsedMinutes >= 15 && current.metadata.preparationState !== "served");
                  const badge = current ? preparationBadge(current.metadata.preparationState) : "";
                  return (
                    <button
                      key={item.id}
                      onClick={() =>
                        layoutEditing ? editTable(item) : selectTable(item)
                      }
                      onDoubleClick={() => layoutEditing && deleteTable(item)}
                      className={`relative h-32 w-36 rounded-xl border p-3 text-center ${current ? isLate ? "border-red-500 bg-red-500 text-white" : "border-[#FE4A23] bg-[#FE4A23] text-white" : "border-kumo-line bg-kumo-elevated"}`}
                    >
                      {current && <span className="absolute left-3 top-3 text-xs">♟ {current.metadata.guestCount}</span>}
                      {current && <span className="absolute right-3 top-3 text-xs">{elapsedLabel(startedAt, clock)}</span>}
                      <span className="block text-3xl">{item.name}</span>
                      {!current && <span className="mt-3 block text-xs">♟ {item.seats}</span>}
                      {current && (
                        <span className="mt-2 block">
                          {money(current.totalMinor)}
                        </span>
                      )}
                      {badge && <span className={`absolute bottom-3 right-3 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] text-white ${badge === "P" ? "bg-rose-600" : badge === "EP" ? "bg-purple-600" : "bg-slate-700"}`}>{badge}</span>}
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
      {tab === "preparation" && (
        <section className="flex-1 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-2xl font-normal">Preparación</h1>
            <span className="text-sm text-kumo-subtle">Sincronización activa · 2 s</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {([
              ["sent", "Pendiente"],
              ["preparing", "En preparación"],
              ["ready", "Listo"],
            ] as const).map(([state, label]) => (
              <section key={state} className="rounded-xl border border-kumo-line bg-kumo-elevated p-4">
                <h2 className="mb-4 text-xl font-normal">{label}</h2>
                <div className="space-y-3">
                  {data.orders.filter((item) => item.metadata.preparationState === state).map((item) => {
                    const targetTable = data.floors.flatMap((floor) => floor.tables).find((candidate) => candidate.id === item.tableId);
                    const next = state === "sent" ? "preparing" : state === "preparing" ? "ready" : "served";
                    return (
                      <article key={item.id} className="rounded-xl border border-kumo-line bg-kumo-base p-4">
                        <div className="flex justify-between"><span>{targetTable ? `Mesa ${targetTable.name}` : "Para llevar"}</span><span>{item.metadata.orderName ?? item.id}</span></div>
                        <div className="my-4 space-y-2 text-sm">{item.lines.map((line) => <div key={line.id}><span className="text-[#FE4A23]">{line.quantity} ×</span> {line.description}{line.customerNote && <span className="block text-kumo-subtle">{line.customerNote}</span>}</div>)}</div>
                        <button onClick={() => setPreparationState(item, next)} className="w-full rounded-xl bg-[#FE4A23] p-3 text-white">
                          {next === "preparing" ? "Comenzar" : next === "ready" ? "Marcar listo" : "Entregar"}
                        </button>
                      </article>
                    );
                  })}
                  {!data.orders.some((item) => item.metadata.preparationState === state) && <p className="text-sm text-kumo-subtle">Sin pedidos</p>}
                </div>
              </section>
            ))}
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
            <div className="mb-4 flex gap-2">
              {categories.map((name) => (
                <button
                  key={name}
                  onClick={() => setCategory(current=>current===name?"":name)}
                  className={`h-16 min-w-32 rounded-lg border px-5 ${category === name ? "border-[#FE4A23]" : "border-transparent"} ${name==="Bar"?"bg-[#fee28a]":name==="Cocina"?"bg-[#f7a3a8]":"bg-[#f8d1a8]"}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
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
                    className="relative h-20 w-32 rounded-lg border border-kumo-line bg-kumo-elevated p-3 text-center shadow-[0_4px_0_#e4e6e9]"
                  >
                    <span className="block">{product.name}</span>
                    {(cart[product.id]??0)>0&&<span className="absolute bottom-1 right-1 rounded bg-black px-2 py-0.5 text-xs text-white">{cart[product.id]}</span>}
                  </button>
                ))}
            </div>
          </div>
          <aside className="flex min-h-0 flex-col bg-kumo-elevated">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {lines.map(line=><button key={line.id} onClick={()=>setSelectedLineId(line.id)} className={`grid w-full grid-cols-[36px_1fr_auto] gap-3 border-b px-3 py-3 text-left ${selectedLineId===line.id?"border-[#FE4A23] bg-[#fff1ed]":"border-kumo-line"}`}>
                <span>{line.quantity}</span><span>{line.name}{lineNotes[line.id]&&<small className="block text-kumo-subtle">{lineNotes[line.id]}</small>}</span><span>{money(line.total)}</span>
              </button>)}
            </div>
            <div className="border-t border-kumo-line p-3">
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
              <div className="mt-3 grid grid-cols-[1fr_1fr_44px_1fr_44px] gap-2"><button onClick={()=>setPartnerDialog(true)} className="rounded-lg border border-kumo-line py-3">Cliente</button><button onClick={()=>{const line=lines.find(item=>item.id===selectedLineId);if(line)setNoteEditor({productId:line.id,productName:line.name,value:lineNotes[line.id]??""});else void requestDialog({kind:"text",title:"Nota para el cliente",value:generalNote}).then(value=>typeof value==="string"&&setGeneralNote(value))}} className="rounded-lg border border-kumo-line py-3">Nota</button><button onClick={()=>order&&void sendToPreparation()} aria-label="Enviar comanda" className="rounded-lg border border-kumo-line">↥</button><button onClick={async()=>{const line=lines.find(item=>item.id===selectedLineId);if(!line)return;const course=Number(await requestDialog({kind:"number",title:"Tiempo",label:"Curso",value:lineCourses[line.id]??1,min:1}));if(course>0)setLineCourses(current=>({...current,[line.id]:course}))}} className="rounded-lg border border-kumo-line">Tiempo</button><button onClick={()=>setActionsOpen(true)} aria-label="Acciones" className="rounded-lg border border-kumo-line text-xl">⋮</button></div>
              <div className="mt-2 grid grid-cols-4">{["1","2","3","Ctdad","4","5","6","%","7","8","9","Precio","+/−","0",",","⌫"].map(key=><button key={key} onClick={async()=>{
                const line=lines.find(item=>item.id===selectedLineId);if(!line)return;
                if(/^\d$/.test(key))setQuantity(line.id,Number(key));
                else if(key==="⌫")removeProduct(line.id);
                else if(key==="%") {const discount=Number(await requestDialog({kind:"number",title:"Descuento",value:discountBasisPoints/100,min:0,max:100}));if(Number.isFinite(discount))setDiscountBasisPoints(Math.round(discount*100));}
                else if(key==="Precio"){const price=Number(await requestDialog({kind:"number",title:"Cambiar precio",label:line.name,value:line.unitPriceMinor,min:0}));if(price>=0)setManualPrices(current=>({...current,[line.id]:price}));}
              }} className={`h-13 border border-kumo-line ${(key==="Ctdad"||key==="Precio")?"bg-[#fff1ed]":key==="+/−"?"bg-[#fee28a]":""}`}>{key}</button>)}</div>
              <div className="mt-2 grid grid-cols-2 gap-2"><button onClick={reset} className="rounded-lg border border-kumo-line p-4">Nuevo</button><button disabled={busy||!lines.length} onClick={async()=>{if(!order)await save();setScreen("payment")}} className="rounded-lg bg-[#FE4A23] p-4 text-white disabled:opacity-40">Pago</button></div>
            </div>
          </aside>
        </section>
      )}
      {actionsOpen&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"><section role="dialog" aria-modal="true" aria-label="Acciones" className="w-full max-w-5xl rounded-lg bg-kumo-elevated shadow-xl"><header className="flex items-center justify-between border-b border-kumo-line p-4"><h2 className="text-lg font-normal">Acciones</h2><button onClick={()=>setActionsOpen(false)} aria-label="Cerrar" className="text-2xl text-kumo-subtle">×</button></header><div className="grid grid-cols-3 gap-2 p-4">
        <button onClick={async()=>{const value=await requestDialog({kind:"text",title:"Nota para el cliente",value:generalNote});if(typeof value==="string")setGeneralNote(value);setActionsOpen(false)}} className="h-32 rounded-lg border border-kumo-line">▣ Nota para el cliente</button>
        <button disabled={!order} onClick={()=>{if(order)void printTicket(order,"receipt");setActionsOpen(false)}} className="h-32 rounded-lg border border-kumo-line disabled:opacity-40">▣ Cuenta</button>
        <button onClick={async()=>{const value=Number(await requestDialog({kind:"number",title:"Comensales",value:guestCount,min:1}));if(value>0)setGuestCount(value);setActionsOpen(false)}} className="h-32 rounded-lg border border-kumo-line">● Comensales</button>
        <button disabled={!order} onClick={()=>{void split();setActionsOpen(false)}} className="h-32 rounded-lg border border-kumo-line disabled:opacity-40">▱ Dividir</button>
        <button disabled={!order} onClick={()=>{void transfer();setActionsOpen(false)}} className="h-32 rounded-lg border border-kumo-line disabled:opacity-40">→ Transferir / Fusionar</button>
        <button disabled={!order} onClick={()=>{void sendToPreparation();setActionsOpen(false)}} className="h-32 rounded-lg border border-kumo-line disabled:opacity-40">↓ Transferir comida</button>
        <button onClick={async()=>{const id=await requestDialog({kind:"selection",title:"Tarifa",options:data.pricelists.map(item=>({id:item.id,label:item.name})),selected:pricelistId?[pricelistId]:[],max:1});if(Array.isArray(id))setPricelistId(id[0]??"");setActionsOpen(false)}} className="h-32 rounded-lg border border-kumo-line">▦ Tarifa</button>
        <button onClick={()=>{setTab("orders");setActionsOpen(false)}} className="h-32 rounded-lg border border-kumo-line">↶ Reembolso</button>
        <button onClick={()=>{void requestDialog({kind:"message",title:"Información",body:`${table?`Mesa ${table.name}`:"Pedido"} · ${lines.length} líneas · ${money(total)}`});setActionsOpen(false)}} className="h-32 rounded-lg border border-kumo-line">● Información</button>
        <button disabled={!order} onClick={()=>{void cancel();setActionsOpen(false)}} className="h-32 rounded-lg border border-kumo-line disabled:opacity-40">♜ Cancelar orden</button>
        <button onClick={()=>{window.open(`${window.location.pathname}?display=customer`,"nuevauno-customer-display","popup,width=900,height=700");setActionsOpen(false)}} className="h-32 rounded-lg border border-kumo-line">▣ Pantalla cliente</button>
        <button disabled={data.orders.length<2} onClick={()=>{void merge();setActionsOpen(false)}} className="h-32 rounded-lg border border-kumo-line disabled:opacity-40">⇄ Unir órdenes</button>
      </div></section></div>}
      {dialog && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4">
          <section role="dialog" aria-modal="true" aria-label={dialog.title} className="w-full max-w-xl rounded-xl bg-kumo-elevated shadow-xl">
            <header className="flex items-center justify-between border-b border-kumo-line px-5 py-4">
              <h2 className="text-xl font-normal">{dialog.title}</h2>
              <button aria-label="Cerrar" onClick={() => finishDialog(null)} className="px-2 text-2xl text-kumo-subtle">×</button>
            </header>
            <div className="p-5">
              {dialog.kind === "message" && <p className="text-lg">{dialog.body}</p>}
              {dialog.kind === "confirm" && <p className="text-lg">{dialog.body}</p>}
              {(dialog.kind === "text" || dialog.kind === "number") && (
                <label className="grid gap-2">
                  <span>{dialog.label ?? dialog.title}</span>
                  <input
                    autoFocus
                    type={dialog.kind === "number" ? "number" : "text"}
                    value={dialogText}
                    min={dialog.kind === "number" ? dialog.min : undefined}
                    max={dialog.kind === "number" ? dialog.max : undefined}
                    onChange={(event) => setDialogText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") finishDialog(dialog.kind === "number" ? Number(dialogText) : dialogText);
                    }}
                    className="rounded-xl border border-[#FE4A23] bg-kumo-base p-4 outline-none"
                  />
                </label>
              )}
              {dialog.kind === "selection" && (
                <div className="grid max-h-[55vh] gap-2 overflow-auto sm:grid-cols-2">
                  {dialog.options.map((option) => {
                    const selected = dialogSelections.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => setDialogSelections((current) => selected ? current.filter((id) => id !== option.id) : dialog.max === 1 ? [option.id] : [...current, option.id])}
                        className={`rounded-xl border p-4 text-left ${selected ? "border-[#FE4A23] bg-orange-100" : "border-kumo-line bg-kumo-base"}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <footer className="flex justify-end gap-2 border-t border-kumo-line px-5 py-4">
              {dialog.kind !== "message" && <button onClick={() => finishDialog(null)} className="rounded-xl border border-kumo-line px-5 py-3">Descartar</button>}
              {dialog.kind === "confirm" && <button onClick={() => finishDialog(true)} className="rounded-xl bg-[#FE4A23] px-5 py-3 text-white">{dialog.confirmLabel ?? "Confirmar"}</button>}
              {dialog.kind === "message" && <button onClick={() => finishDialog(true)} className="rounded-xl bg-[#FE4A23] px-5 py-3 text-white">Aceptar</button>}
              {(dialog.kind === "text" || dialog.kind === "number") && (
                <button onClick={() => finishDialog(dialog.kind === "number" ? Number(dialogText) : dialogText)} className="rounded-xl bg-[#FE4A23] px-5 py-3 text-white">Aplicar</button>
              )}
              {dialog.kind === "selection" && (
                <button
                  disabled={dialogSelections.length < (dialog.min ?? 0) || dialogSelections.length > (dialog.max ?? Number.POSITIVE_INFINITY)}
                  onClick={() => finishDialog(dialogSelections)}
                  className="rounded-xl bg-[#FE4A23] px-5 py-3 text-white disabled:opacity-40"
                >
                  Confirmar
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
      {noteEditor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Nota de ${noteEditor.productName}`}
            className="w-full max-w-4xl rounded-xl bg-kumo-elevated shadow-xl"
          >
            <header className="flex items-center justify-between border-b border-kumo-line px-5 py-4">
              <h2 className="text-lg font-normal">{noteEditor.productName}: Agregar nota</h2>
              <button aria-label="Cerrar" onClick={() => setNoteEditor(null)} className="px-2 text-2xl text-kumo-subtle">×</button>
            </header>
            <div className="p-5">
              <div className="mb-2 flex flex-wrap gap-2">
                {[
                  ["Esperar", "border-red-500 bg-red-100"],
                  ["Servir", "border-orange-400 bg-orange-100"],
                  ["Urgente", "border-amber-400 bg-amber-100"],
                  ["Sin aderezo", "border-sky-500 bg-sky-100"],
                ].map(([label, color]) => (
                  <button
                    key={label}
                    onClick={() => setNoteEditor((current) => current ? {
                      ...current,
                      value: [current.value.trim(), label].filter(Boolean).join(" · "),
                    } : current)}
                    className={`rounded-lg border px-3 py-2 ${color}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                autoFocus
                rows={5}
                value={noteEditor.value}
                onChange={(event) => setNoteEditor((current) => current ? { ...current, value: event.target.value } : current)}
                className="w-full resize-y rounded-xl border border-[#FE4A23] bg-kumo-base p-4 outline-none"
              />
            </div>
            <footer className="flex gap-2 border-t border-kumo-line px-5 py-4">
              <button
                onClick={() => {
                  setLineNotes((current) => ({ ...current, [noteEditor.productId]: noteEditor.value.trim() }));
                  setNoteEditor(null);
                }}
                className="rounded-xl bg-[#FE4A23] px-5 py-3 text-white"
              >
                Aplicar
              </button>
              <button onClick={() => setNoteEditor(null)} className="rounded-xl border border-kumo-line px-5 py-3">Descartar</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
