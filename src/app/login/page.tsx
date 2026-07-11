import { Suspense } from "react";

import { BrandMark } from "@/components/composed/BrandMark";
import { Card } from "@/components/ui/Card";
import { AuthPanel } from "@/features/auth/components/AuthPanel";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <AuthPanel />
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
