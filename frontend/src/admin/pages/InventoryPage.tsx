import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../hooks";
import type { InventoryDetail } from "../types";
import { cfa } from "../components/billing";
import { qty } from "../stock";
import { EmptyState, FormError, LoadingBlock, Panel, StatusBadge } from "../components/ui";

/** Comptage d'un inventaire (enregistré au fil de la saisie), puis validation et écarts. */
export default function InventoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: inv, isLoading, isError } = useQuery({ queryKey: ["inventory", id], queryFn: () => api<{ data: InventoryDetail }>(`/inventories/${id}`).then((r) => r.data) });
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (inv) setCounts(Object.fromEntries(inv.lines.map((l) => [l.article.id, l.counted_quantity === null ? "" : String(l.counted_quantity)])));
  }, [inv]);

  const keys = [["inventory", id], ["inventories"], ["articles"]];
  const validate = useApiMutation(() => api(`/inventories/${id}/validate`, { method: "POST" }), { success: "Inventaire validé : le stock est ajusté.", invalidate: keys });
  const discard = useApiMutation(() => api(`/inventories/${id}`, { method: "DELETE" }), { success: "Inventaire supprimé.", invalidate: keys, onSuccess: () => navigate("/admin/inventaires") });

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, InventoryDetail["lines"]>();
    inv?.lines.filter((l) => !q || l.article.name.toLowerCase().includes(q) || l.article.reference.toLowerCase().includes(q))
      .forEach((l) => { const k = l.article.category ?? "Sans catégorie"; map.set(k, [...(map.get(k) ?? []), l]); });
    return [...map.entries()];
  }, [inv, search]);

  if (isLoading) return <LoadingBlock />;
  if (isError || !inv) return <EmptyState title="Inventaire introuvable" />;
  const open = inv.status.value === "en_cours";
  const counted = Object.values(counts).filter((v) => v !== "").length;

  async function save(articleId: number) {
    const original = inv!.lines.find((l) => l.article.id === articleId)?.counted_quantity;
    const value = counts[articleId];
    if ((original === null ? "" : String(original)) === value) return;
    setSaving(true);
    try {
      await api(`/inventories/${id}`, { method: "PUT", body: { counts: [{ article_id: articleId, counted_quantity: value === "" ? null : Number(value.replace(",", ".")) }] } });
      queryClient.setQueryData<InventoryDetail>(["inventory", id], (old) => old && ({
        ...old, lines: old.lines.map((l) => (l.article.id === articleId ? { ...l, counted_quantity: value === "" ? null : Number(value.replace(",", ".")) } : l)),
      }));
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors).flat()[0] ?? e.message) : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Link to="/admin/inventaires" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Inventaires</Link>
      <section className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{inv.number}</h1>
            <StatusBadge option={{ value: open ? "en_cours" : "payee", label: inv.status.label }} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{inv.category?.name ?? "Tous les articles"} · compté le {formatDate(inv.counted_on)} · {open ? counted : inv.counted_count}/{inv.lines_count} articles comptés{saving && " · enregistrement…"}</p>
          {!open && inv.value_difference !== null && <p className={cn("mt-1 text-sm font-medium", inv.value_difference < 0 ? "text-red-600" : "text-emerald-700")}>Écart total : {inv.value_difference > 0 ? "+" : ""}{cfa(inv.value_difference)}</p>}
        </div>
        {open && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { if (confirm("Supprimer cet inventaire et ses comptages ?")) discard.mutate(undefined); }}><Trash2 className="h-4 w-4" /> Supprimer</Button>
            <Button disabled={!counted || validate.isPending} onClick={() => { if (confirm(`Valider l'inventaire ? Les ${counted} articles comptés seront ajustés à la quantité comptée ; les autres ne changent pas.`)) validate.mutate(undefined); }}>
              <Check className="h-4 w-4" /> Valider
            </Button>
          </div>
        )}
      </section>
      <FormError message={validate.error?.field("inventory")} />
      <Input className="mb-4" placeholder="Chercher un article…" value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="space-y-4">
        {groups.map(([category, lines]) => (
          <Panel key={category} title={category} bodyClassName="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Article</TableHead>
                  <TableHead className="w-40 text-right">Compté</TableHead>
                  {!open && <TableHead className="hidden text-right sm:table-cell">Théorique</TableHead>}
                  {!open && <TableHead className="text-right">Écart</TableHead>}
                  {!open && <TableHead className="hidden text-right md:table-cell">Valeur</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.article.id}>
                    <TableCell><p className="font-medium">{l.article.name}</p><p className="text-xs text-muted-foreground">{l.article.reference}{l.article.location && ` · ${l.article.location}`}</p></TableCell>
                    <TableCell className="text-right">
                      {open ? (
                        <div className="flex items-center justify-end gap-2">
                          <Input inputMode="decimal" className="h-9 w-24 text-right" value={counts[l.article.id] ?? ""} placeholder="—"
                            onChange={(e) => setCounts({ ...counts, [l.article.id]: e.target.value })} onBlur={() => save(l.article.id)} />
                          <span className="w-10 text-left text-xs text-muted-foreground">{l.article.unit}</span>
                        </div>
                      ) : <span className="tabular-nums">{l.counted_quantity === null ? <span className="text-muted-foreground">non compté</span> : `${qty(l.counted_quantity)} ${l.article.unit}`}</span>}
                    </TableCell>
                    {!open && <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">{qty(l.expected_quantity)}</TableCell>}
                    {!open && <TableCell className={cn("text-right tabular-nums", (l.difference ?? 0) < 0 && "text-red-600", (l.difference ?? 0) > 0 && "text-emerald-700")}>{l.difference === null ? "—" : `${l.difference > 0 ? "+" : ""}${qty(l.difference)}`}</TableCell>}
                    {!open && <TableCell className="hidden text-right tabular-nums md:table-cell">{l.value_difference === null ? "—" : cfa(l.value_difference)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        ))}
      </div>
    </>
  );
}
