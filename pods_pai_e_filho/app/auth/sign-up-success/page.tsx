import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Conta criada" };

export default function Page() {
  return (
    <AuthLayout title="Conta criada" description="Confira o e-mail se a confirmação estiver ligada.">
      <div className="grid gap-4">
        <div className="flex items-start gap-3 rounded-lg border border-success/35 bg-success/10 px-3 py-3 text-sm">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p className="leading-relaxed">
            Se o projeto exigir confirmação, abra o link enviado para o e-mail antes de entrar. A primeira conta
            criada fica como administrador.
          </p>
        </div>
        <Link href="/auth/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Ir para entrar
        </Link>
      </div>
    </AuthLayout>
  );
}
