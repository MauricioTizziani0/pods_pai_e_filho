import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Conta criada</CardTitle>
              <CardDescription>Confira o e-mail se a confirmação estiver ligada</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Se o projeto exigir confirmação, abra o link enviado para o e-mail antes de entrar.
                A primeira conta criada fica como administrador.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
