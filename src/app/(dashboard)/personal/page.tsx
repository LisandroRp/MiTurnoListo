"use client";

import { PersonnelView } from "@/features/scheduling/components/PersonnelView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function PersonnelSectionPage() {
  const { messages, employees, profile, saveEmployee, deleteEmployee, showToast } = useScheduling();

  return (
    <PersonnelView
      messages={messages}
      employees={employees}
      subscriptionTier={profile.subscriptionTier}
      onSaveEmployee={saveEmployee}
      onDeleteEmployee={deleteEmployee}
      onValidationWarning={() => showToast({ tone: "warning", title: messages.toast.formWarning })}
      onImageUploadError={(message) => showToast({ tone: "error", title: messages.toast.invalidImage, description: message })}
    />
  );
}
