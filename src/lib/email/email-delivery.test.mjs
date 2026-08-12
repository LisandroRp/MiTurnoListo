import test from "node:test";
import assert from "node:assert/strict";

import { isNonCriticalEmailDeliveryDisabled } from "./email-delivery.ts";

test("isNonCriticalEmailDeliveryDisabled enables the email kill switch for truthy values", () => {
  for (const value of ["true", "TRUE", "  yes ", "1", "on"]) {
    assert.equal(isNonCriticalEmailDeliveryDisabled({ DONT_SEND_EMAILS: value }), true);
  }
});

test("isNonCriticalEmailDeliveryDisabled keeps email delivery enabled by default", () => {
  for (const value of [undefined, "", "false", "0", "off", "no"]) {
    assert.equal(isNonCriticalEmailDeliveryDisabled({ DONT_SEND_EMAILS: value }), false);
  }
});
