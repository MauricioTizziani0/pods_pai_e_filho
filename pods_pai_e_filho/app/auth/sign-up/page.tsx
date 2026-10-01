import { SignUpForm } from "@/components/sign-up-form";
import { AuthLayout } from "@/components/auth/auth-layout";

export const metadata = { title: "Criar conta" };

export default function Page() {
  return (
    <AuthLayout
      title="Criar conta"
      description="A primeira conta vira administrador. As seguintes começam como consulta."
    >
      <SignUpForm />
    </AuthLayout>
  );
}
