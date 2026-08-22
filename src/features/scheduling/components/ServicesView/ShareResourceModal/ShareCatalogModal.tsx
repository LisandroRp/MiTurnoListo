import { Messages } from "@/features/scheduling/i18n/messages";
import { ShareResourceModal } from "@/features/scheduling/components/ServicesView/ShareResourceModal/ShareResourceModal";

type ShareCatalogModalProps = {
  messages: Messages;
  catalogUrl: string;
  onClose: () => void;
  onCopy: () => void;
};

export function ShareCatalogModal({
  messages,
  catalogUrl,
  onClose,
  onCopy
}: ShareCatalogModalProps) {
  return (
    <ShareResourceModal
      messages={messages}
      title={messages.services.shareCatalogTitle}
      description={messages.services.shareCatalogDescription}
      qrAlt={messages.services.shareCatalogQrAlt}
      url={catalogUrl}
      onClose={onClose}
      onCopy={onCopy}
    />
  );
}
