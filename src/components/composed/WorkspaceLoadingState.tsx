import { BrandMark } from "@/components/composed/BrandMark";
import { Card } from "@/components/ui/Card";

type WorkspaceLoadingStateProps = {
  title?: string;
  theme?: string;
};

export function WorkspaceLoadingState({
  title = "Preparando tu espacio...",
  theme
}: WorkspaceLoadingStateProps) {
  return (
    <main className={`${theme ? `theme-${theme} ` : ""}grid min-h-screen place-items-center bg-shell p-6 text-primary`}>
      <Card className="w-full max-w-sm text-center">
        <BrandMark variant="compact" size="md" align="center" className="brand-bounce mx-auto" priority />
        <h1 className="mt-3 text-xl font-bold text-primary">{title}</h1>
      </Card>
    </main>
  );
}
