import { LoginForm } from "@/components/login-form";
import { AuthLayout } from "@/components/auth/auth-layout";

export const metadata = { title: "Entrar" };

export default function Page() {
  return (
    <AuthLayout title="Entrar">
      <LoginForm />
    </AuthLayout>
  );
}
