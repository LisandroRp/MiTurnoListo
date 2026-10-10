import assert from "node:assert/strict";
import test from "node:test";

import { getVisibleDayBlocksForTab } from "./day-blocks.ts";

test("business and employee tabs separate blocks without filtering by professional", () => {
  const blocks = [
    { id: "employee-2", employeeId: "person-2", startsOn: "2026-12-15", endsOn: "2026-12-15", reason: "Vacation" },
    { id: "business", employeeId: null, startsOn: "2026-12-10", endsOn: "2026-12-10", reason: "Holiday" },
    { id: "employee-1", employeeId: "person-1", startsOn: "2026-12-08", endsOn: "2026-12-11", reason: "Vacation" },
    { id: "expired", employeeId: "person-3", startsOn: "2026-09-01", endsOn: "2026-09-02", reason: "Past" }
  ];

  assert.deepEqual(getVisibleDayBlocksForTab(blocks, "business", "2026-10-10").map((block) => block.id), ["business"]);
  assert.deepEqual(getVisibleDayBlocksForTab(blocks, "employee", "2026-10-10").map((block) => block.id), ["employee-1", "employee-2"]);
});
