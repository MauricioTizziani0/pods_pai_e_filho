import { createClient } from "@/lib/supabase/server";
import { getSessionState } from "@/lib/auth";
import { loadCatalog, loadLowStockThreshold } from "@/lib/data/catalog";
import type { Profile } from "@/lib/types";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { PromotionSettingsPanel } from "@/components/settings/promotion-settings";
import { loadPromotionSettings } from "@/lib/data/promotion";
import { redirect } from "next/navigation";

export const metadata = { title: "Configurações" };

type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  role_code: string;
  roles: { name: string; can_write: boolean } | { name: string; can_write: boolean }[] | null;
};

export default async function ConfiguracoesPage() {
  const session = await getSessionState();
  if (session.status !== "ok") return <Notice>Não foi possível carregar o seu perfil.</Notice>;
  if (!session.profile.can_write) redirect("/inicio");

  const isAdmin = session.profile.role_code.toLowerCase() === "admin";
  const [catalog, threshold, promotion] = await Promise.all([
    loadCatalog(),
    loadLowStockThreshold(),
    isAdmin ? loadPromotionSettings() : Promise.resolve(null),
  ]);
  if (!catalog.ok) return <Notice>{catalog.message}</Notice>;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role_code, roles(name, can_write)")
    .order("full_name");

  const profiles: Profile[] = ((data ?? []) as ProfileRow[]).map((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      role_code: row.role_code,
      role_name: role?.name ?? row.role_code,
      can_write: Boolean(role?.can_write),
    };
  });

  return (
    <div className="w-full min-w-0">
      <PageHeading
        title="Configurações"
        eyebrow="Sistema"
        description="Papéis, estoque baixo, divulgação e cadastros que mudam o preço."
      />
      {error ? <Notice>{error.message}</Notice> : null}
      {promotion ? (
        <div className="mb-5 min-w-0">
          {promotion.ok ? <PromotionSettingsPanel settings={promotion.settings} /> : <Notice>{promotion.message}</Notice>}
        </div>
      ) : null}
      <SettingsPanel
        profile={session.profile}
        profiles={profiles.length > 0 ? profiles : [session.profile]}
        types={catalog.data.customerTypes}
        statuses={catalog.data.statuses}
        threshold={threshold}
      />
    </div>
  );
}
