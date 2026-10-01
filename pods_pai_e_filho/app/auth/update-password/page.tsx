import { UpdatePasswordForm } from "@/components/update-password-form";
import { AuthLayout } from "@/components/auth/auth-layout";

export const metadata = { title: "Nova senha" };

export default function Page() {
  return (
    <AuthLayout title="Definir nova senha" description="Digite a nova senha para a sua conta.">
      <UpdatePasswordForm />
    </AuthLayout>
  );
}
