"use client";

import { PersonnelView } from "@/features/scheduling/components/PersonnelView/index";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function PersonnelSectionPage() {
  const { appointments, archiveEmployee, businessId, employees, focusedDate, messages, profile, saveEmployee, deleteEmployee, services, showToast, unarchiveEmployee, updateEmployeeVisibility } = useScheduling();

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
      onUpdateEmployeeVisibility={updateEmployeeVisibility}
      onValidationWarning={() => showToast({ tone: "warning", title: messages.toast.formWarning })}
      onImageUploadError={(message) => showToast({ tone: "error", title: messages.toast.invalidImage, description: message })}
    />
  );
}
