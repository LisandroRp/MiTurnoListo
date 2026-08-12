"use client";

import { ServicesView } from "@/features/scheduling/components/ServicesView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function ServicesSectionPage() {
  const { messages, appointments, archiveService, businessId, services, employees, paymentSettings, profile, saveService, deleteService, showToast, unarchiveService } = useScheduling();
  const isTransferConfigured = Boolean(
    paymentSettings.transfers.accountHolder.trim() &&
    paymentSettings.transfers.cbu.trim() &&
    paymentSettings.transfers.alias.trim() &&
    paymentSettings.transfers.receiptWhatsapp.trim()
  );

  return (
    <ServicesView
      messages={messages}
      services={services}
      employees={employees}
      appointments={appointments}
      businessId={businessId}
      subscriptionTier={profile.subscriptionTier}
      isMercadoPagoConfigured={paymentSettings.mercadoPago.isConfigured}
      isTransferConfigured={isTransferConfigured}
      onSaveService={saveService}
      onArchiveService={archiveService}
      onDeleteService={deleteService}
      onUnarchiveService={unarchiveService}
      onValidationWarning={() => showToast({ tone: "warning", title: messages.toast.formWarning })}
      onImageUploadError={(message) => showToast({ tone: "error", title: messages.toast.invalidImage, description: message })}
      onShareSuccess={() => showToast({ tone: "success", title: messages.toast.serviceLinkCopied })}
      onShareError={() => showToast({ tone: "error", title: messages.toast.serviceLinkCopyFailed })}
    />
  );
}
