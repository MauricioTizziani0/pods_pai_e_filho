import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 px-6">
      <p className="font-display text-4xl text-primary">Pods</p>
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <Link href="/inicio" className="text-sm font-medium underline">
        Voltar ao início
      </Link>
    </main>
  );
}
