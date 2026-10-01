import { LoginForm } from "@/components/login-form";
import { AuthLayout } from "@/components/auth/auth-layout";

export const metadata = { title: "Entrar" };

export default function Page() {
  return (
    <AuthLayout title="Entrar" description="Use o e-mail cadastrado para Maurício ou para o pai.">
      <LoginForm />
    </AuthLayout>
  );
}
