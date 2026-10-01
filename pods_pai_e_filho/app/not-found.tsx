import Link from "next/link";
import { SystemScreen } from "@/components/setup/system-screen";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <SystemScreen eyebrow="Erro 404" title="Página não encontrada">
      <p>O endereço não existe ou foi movido.</p>
      <div className="pt-2">
        <Link href="/inicio" className={buttonVariants()}>
          Voltar ao início
        </Link>
      </div>
    </SystemScreen>
  );
}
