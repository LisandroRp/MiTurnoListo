"use client";

import { ServicesView } from "@/features/scheduling/components/ServicesView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function ServicesSectionPage() {
  const { messages, services, employees, saveService, deleteService, showToast } = useScheduling();

  return (
    <ServicesView
      messages={messages}
      services={services}
      employees={employees}
      onSaveService={saveService}
      onDeleteService={deleteService}
      onValidationWarning={() => showToast({ tone: "warning", title: messages.toast.formWarning })}
      onImageUploadError={(message) => showToast({ tone: "error", title: messages.toast.invalidImage, description: message })}
    />
  );
}
