"use client";

import { PersonnelView } from "@/features/scheduling/components/PersonnelView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function PersonnelSectionPage() {
  const { appointments, archiveEmployee, businessId, employees, focusedDate, messages, profile, saveEmployee, deleteEmployee, services, showToast, unarchiveEmployee } = useScheduling();

  return (
    <PersonnelView
      messages={messages}
      employees={employees}
      services={services}
      appointments={appointments}
      businessId={businessId}
      referenceDate={focusedDate}
      subscriptionTier={profile.subscriptionTier}
      onSaveEmployee={saveEmployee}
      onArchiveEmployee={archiveEmployee}
      onDeleteEmployee={deleteEmployee}
      onUnarchiveEmployee={unarchiveEmployee}
      onValidationWarning={() => showToast({ tone: "warning", title: messages.toast.formWarning })}
      onImageUploadError={(message) => showToast({ tone: "error", title: messages.toast.invalidImage, description: message })}
    />
  );
}
