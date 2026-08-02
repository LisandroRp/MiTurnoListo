import { PublicAppointmentCancellation } from "@/features/booking-flow/components/PublicAppointmentCancellation";

type CancellationPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function CancellationPage({ params }: CancellationPageProps) {
  const { token } = await params;

  return <PublicAppointmentCancellation token={token} />;
}
