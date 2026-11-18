"use client";

import { PersonnelView } from "@/features/scheduling/components/PersonnelView/index";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";
import { useSetupCreation } from "@/features/scheduling/components/useSetupCreation";

export default function PersonnelSectionPage() {
  const { startsInCreateMode, leaveSetupCreation } = useSetupCreation();
  const { appointments, archiveEmployee, businessId, employees, focusedDate, messages, profile, saveEmployee, deleteEmployee, services, showToast, unarchiveEmployee, updateEmployeeVisibility } = useScheduling();

  return (
    <PersonnelView
      key={String(startsInCreateMode)}
      startsInCreateMode={startsInCreateMode}
      onLeaveSetupCreation={leaveSetupCreation}
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
