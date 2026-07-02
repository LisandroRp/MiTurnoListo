import { Suspense } from "react";

import { BrandMark } from "@/components/composed/BrandMark";
import { Card } from "@/components/ui/Card";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-page p-6">
      <Card className="w-full max-w-sm text-center">
        <BrandMark variant="full" size="md" align="center" className="mx-auto" priority />
        <h1 className="mt-2 text-xl font-bold text-primary">Cargando acceso...</h1>
      </Card>
    </main>
  );
}
