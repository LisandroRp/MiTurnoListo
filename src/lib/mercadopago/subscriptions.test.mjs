import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSubscriptionExternalReference,
  extractBusinessIdFromExternalReference,
  mapMercadoPagoStatusToTier
} from "./subscription-status.ts";

test("buildSubscriptionExternalReference joins business and user ids", () => {
  assert.equal(
    buildSubscriptionExternalReference("business-123", "user-456", "intent-789"),
    "mtl_b_business-123_u_user-456_i_intent-789"
  );
});

test("extractBusinessIdFromExternalReference returns the business id", () => {
  assert.equal(
    extractBusinessIdFromExternalReference("mtl_b_business-123_u_user-456_i_intent-789"),
    "business-123"
  );
  assert.equal(
    extractBusinessIdFromExternalReference("mtl|b:business-123|u:user-456|i:intent-789"),
    "business-123"
  );
  assert.equal(
    extractBusinessIdFromExternalReference("business-123:user-456"),
    "business-123"
  );
  assert.equal(extractBusinessIdFromExternalReference(null), null);
});

test("mapMercadoPagoStatusToTier only enables pro for authorized subscriptions", () => {
  assert.equal(mapMercadoPagoStatusToTier("authorized"), "pro");
  assert.equal(mapMercadoPagoStatusToTier("pending"), "free");
  assert.equal(mapMercadoPagoStatusToTier("canceled"), "free");
});
