import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { AuthLayout } from "@/components/auth/auth-layout";

export const metadata = { title: "Recuperar senha" };

export default function Page() {
  return (
    <AuthLayout
      title="Recuperar senha"
      description="Informe o e-mail e enviaremos um link para redefinir a senha."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
