import { BrandMark } from "@/components/composed/BrandMark";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-app px-6 text-primary">
      <div className="grid justify-items-center text-center">
        <BrandMark variant="compact" size="xl" priority />
        <h1 className="mt-6 text-7xl font-black leading-none sm:text-8xl">404</h1>
        <p className="mt-4 text-lg font-semibold text-muted">Página no encontrada</p>
      </div>
    </main>
  );
}
