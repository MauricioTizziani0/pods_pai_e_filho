import Link from "next/link";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Notice } from "@/components/feedback/notice";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Erro" };

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <Notice>
      {params?.error ? <>Código do erro: {params.error}</> : <>Ocorreu um erro não especificado.</>}
    </Notice>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <AuthLayout title="Algo deu errado" description="Não foi possível concluir a autenticação.">
      <div className="grid gap-4">
        <Suspense>
          <ErrorContent searchParams={searchParams} />
        </Suspense>
        <Link href="/auth/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Voltar para entrar
        </Link>
      </div>
    </AuthLayout>
  );
}
