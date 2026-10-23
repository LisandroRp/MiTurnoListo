import { FiInfo } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { FloatingInfoPopover } from "@/components/ui/FloatingInfoPopover";
import { Messages } from "@/features/scheduling/i18n/messages";
import { CustomerTag } from "@/features/scheduling/utils/customer-list";

const tagStyles = {
  new: { tone: "neutral", className: "bg-shell text-primary" },
  active: { tone: "success", className: undefined },
  frequent: { tone: "brand", className: undefined },
  vip: { tone: "warning", className: "bg-warning-soft text-warning" },
  atRisk: { tone: "danger", className: undefined }
} as const;

export function CustomerTagBadge({ tag, messages }: { tag: CustomerTag; messages: Messages }) {
  const style = tagStyles[tag];
  return <Badge tone={style.tone} className={`whitespace-nowrap ${style.className ?? ""}`}>{messages.customers.tags[tag]}</Badge>;
}

export function CustomerTagInfo({ messages }: { messages: Messages }) {
  return (
    <FloatingInfoPopover
      ariaLabel={messages.customers.tagRulesTitle}
      className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-strong hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      content={
        <ul className="grid gap-3 font-normal normal-case tracking-normal">
          {(["new", "active", "frequent", "vip", "atRisk"] as const).map((tag) => (
            <li key={tag} className="flex items-start gap-3">
              <CustomerTagBadge tag={tag} messages={messages} />
              <span>{messages.customers.tagDescriptions[tag]}</span>
            </li>
          ))}
        </ul>
      }
    >
      <FiInfo aria-hidden="true" />
    </FloatingInfoPopover>
  );
}
