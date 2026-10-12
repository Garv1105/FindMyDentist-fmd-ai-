"use client";

import { useCallback, useEffect, useState } from "react";
import { H, useClinic, when } from "@/components/clinic/Shell";
import { inputCls, Notice } from "@/components/Page";

type Inv = {
  items: { id: string; name: string; unit: string; reorder_level: number; supplier: string; tracks_expiry: number; stock: number; low: boolean }[];
  alerts: { low: { name: string }[]; expiring: { item: string; batch: string; expires_on: string; remaining: number }[] };
};
type PO = { id: string; supplier: string; lines: { name: string; qty: number }[]; status: string; aiDrafted: boolean; created_at: number };
const NEXT: Record<string, string[]> = { draft: ["approved", "cancelled"], approved: ["sent", "cancelled"], sent: ["received", "cancelled"] };

export default function InventoryPage() {
  const { call, can } = useClinic();
  const [inv, setInv] = useState<Inv | null>(null);
  const [pos, setPos] = useState<PO[]>([]);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const load = useCallback(() => {
    call<Inv>("inventory").then(setInv).catch((e) => setMsg({ kind: "error", text: e.message }));
    call<PO[]>("purchase-orders").then(setPos).catch(() => {});
  }, [call]);
  useEffect(load, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };
  const [item, setItem] = useState({ name: "", unit: "", reorderLevel: "", supplier: "", tracksExpiry: false });
  return (
    <>
      <H title="Inventory" desc="Stock is the sum of recorded movements. Purchase orders need the owner's approval before they're sent." />
      {msg && (
        <div className="mb-4">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}
      {inv && (inv.alerts.low.length > 0 || inv.alerts.expiring.length > 0) && (
        <section className="mb-5 rounded-[18px] border border-line-strong p-4 text-[13px] text-ink-2">
          {inv.alerts.low.length > 0 && <p>Low stock: {inv.alerts.low.map((x) => x.name).join(", ")}</p>}
          {inv.alerts.expiring.map((e) => (
            <p key={e.item + e.batch}>
              Expiring: {e.item} batch {e.batch} on {e.expires_on} ({e.remaining} left)
            </p>
          ))}
        </section>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ul className="space-y-2">
          {inv?.items.length === 0 && <li className="text-[13px] text-ink-4">No items yet.</li>}
          {inv?.items.map((i) => (
            <Item key={i.id} i={i} canWrite={can("inventory.write")} onMove={(body) => act(() => call(`inventory/${i.id}/move`, "POST", body))} />
          ))}
        </ul>
        <aside className="space-y-5">
          {can("inventory.write") && (
            <div className="glass space-y-2 rounded-[20px] p-5">
              <h2 className="text-[15px] text-ink">Add item</h2>
              <input aria-label="Name" placeholder="Name" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} className={`${inputCls} h-9 text-[12.5px]`} />
              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Unit" placeholder="Unit (box, ml)" value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} className={`${inputCls} h-9 text-[12.5px]`} />
                <input aria-label="Reorder level" type="number" min={0} placeholder="Reorder at" value={item.reorderLevel} onChange={(e) => setItem({ ...item, reorderLevel: e.target.value })} className={`${inputCls} h-9 text-[12.5px]`} />
              </div>
              <input aria-label="Supplier" placeholder="Supplier (optional)" value={item.supplier} onChange={(e) => setItem({ ...item, supplier: e.target.value })} className={`${inputCls} h-9 text-[12.5px]`} />
              <label className="flex gap-2 text-[12.5px] text-ink-2">
                <input type="checkbox" checked={item.tracksExpiry} onChange={(e) => setItem({ ...item, tracksExpiry: e.target.checked })} /> Track batches and expiry
              </label>
              <button onClick={() => act(() => call("inventory", "POST", { ...item, reorderLevel: Number(item.reorderLevel) }).then(() => setItem({ name: "", unit: "", reorderLevel: "", supplier: "", tracksExpiry: false })))} className="btn-primary h-9 w-full text-[12.5px]">
                Add item
              </button>
            </div>
          )}
          <section className="glass rounded-[20px] p-5">
            <h2 className="text-[15px] text-ink">Purchase orders</h2>
            <ul className="mt-3 space-y-3">
              {pos.length === 0 && <li className="text-[12.5px] text-ink-4">None yet. The AI manager can draft one from low stock.</li>}
              {pos.map((p) => (
                <li key={p.id} className="text-[12.5px]">
                  <p className="text-ink">
                    {p.supplier} · <span className="capitalize">{p.status}</span>
                    {p.aiDrafted && <span className="text-ink-4"> · drafted by AI</span>}
                  </p>
                  <p className="text-ink-3">{p.lines.map((l) => `${l.name} × ${l.qty}`).join(", ")}</p>
                  <p className="text-ink-4">{when(p.created_at)}</p>
                  <div className="mt-1 flex gap-1.5">
                    {(NEXT[p.status] ?? [])
                      .filter((to) => to !== "approved" || can("inventory.approve"))
                      .map((to) => (
                        <button key={to} onClick={() => act(() => call(`purchase-orders/${p.id}/status`, "POST", { to }))} className="btn-ghost h-7 px-3 text-[11.5px] capitalize">
                          {to === "approved" ? "Approve" : to === "sent" ? "Mark sent" : to === "received" ? "Mark received" : "Cancel"}
                        </button>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}

function Item({ i, canWrite, onMove }: { i: Inv["items"][number]; canWrite: boolean; onMove: (b: Record<string, unknown>) => void }) {
  const [f, setF] = useState({ reason: "used", qty: "", batch: "", expiresOn: "", note: "" });
  return (
    <li className="glass rounded-[18px] p-4 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-ink">{i.name}</span>
        <span className={i.low ? "text-ink" : "text-ink-3"}>
          {i.stock} {i.unit}
          {i.low && " · low"}
        </span>
        <span className="text-[12px] text-ink-4">reorder at {i.reorder_level}</span>
      </div>
      {canWrite && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <select aria-label="Movement" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} className={`${inputCls} h-8 !w-auto text-[12px] [&>option]:bg-[var(--surface)]`}>
            <option value="used">Used</option>
            <option value="received">Received</option>
            <option value="adjustment">Adjustment (±)</option>
            <option value="expired">Expired</option>
            <option value="returned">Returned</option>
          </select>
          <input aria-label="Quantity" type="number" placeholder="Qty" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} className={`${inputCls} h-8 !w-20 px-2 text-[12px]`} />
          {f.reason === "received" && i.tracks_expiry === 1 && (
            <>
              <input aria-label="Batch" placeholder="Batch" value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} className={`${inputCls} h-8 !w-24 px-2 text-[12px]`} />
              <input aria-label="Expiry" type="date" value={f.expiresOn} onChange={(e) => setF({ ...f, expiresOn: e.target.value })} className={`${inputCls} h-8 !w-auto px-2 text-[12px]`} />
            </>
          )}
          {f.reason === "adjustment" && <input aria-label="Reason for adjustment" placeholder="Why?" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={`${inputCls} h-8 !w-40 px-2 text-[12px]`} />}
          <button onClick={() => (onMove({ ...f, qty: Number(f.qty) }), setF({ ...f, qty: "", note: "" }))} className="btn-ghost h-8 px-3 text-[12px]">
            Record
          </button>
        </div>
      )}
    </li>
  );
}
