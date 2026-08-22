import { Messages } from "@/features/scheduling/i18n/messages";
import { Service } from "@/features/scheduling/types";
import { ShareResourceModal } from "@/features/scheduling/components/ServicesView/ShareResourceModal/ShareResourceModal";

type ShareServiceModalProps = {
  messages: Messages;
  service: Service;
  serviceUrl: string;
  onClose: () => void;
  onCopy: () => void;
};

export function ShareServiceModal({
  messages,
  service,
  serviceUrl,
  onClose,
  onCopy
}: ShareServiceModalProps) {
  return (
    <ShareResourceModal
      messages={messages}
      title={messages.services.shareTitle}
      description={messages.services.shareDescription.replace("{serviceName}", service.name)}
      qrAlt={messages.services.shareQrAlt}
      url={serviceUrl}
      onClose={onClose}
      onCopy={onCopy}
    />
  );
}
