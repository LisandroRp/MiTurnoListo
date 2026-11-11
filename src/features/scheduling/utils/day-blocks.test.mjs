import assert from "node:assert/strict";
import test from "node:test";

import { getVisibleDayBlocksForTab, getTimedBlockEnd, isValidDayBlockTimeRange } from "./day-blocks.ts";

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


test("hourly durations accept minutes and midnight but never cross to the next day", () => {
  assert.equal(getTimedBlockEnd("14:00", "2", "30"), "16:30");
  assert.equal(getTimedBlockEnd("23:30", "0", "30"), "24:00");
  assert.equal(getTimedBlockEnd("00:00", "24", "0"), "24:00");
  for (const args of [["23:30", "1", "0"], ["14:00", "0", "0"], ["14:00", "-1", "0"], ["14:00", "0.5", "0"], ["25:00", "1", "0"], ["14:00", "1", "60"], ["14:00", "", "0"]]) assert.equal(getTimedBlockEnd(...args), null);
});

test("hour blocks require a professional, one date and both ordered valid times", () => {
  const block = { startsOn: "2030-08-09", endsOn: "2030-08-09", employeeId: "person", startTime: "14:00", endTime: "16:00" };
  assert.equal(isValidDayBlockTimeRange(block), true);
  assert.equal(isValidDayBlockTimeRange({ ...block, endTime: "24:00" }), true);
  assert.equal(isValidDayBlockTimeRange({ startsOn: "2030-08-09", endsOn: "2030-08-15" }), true);
  for (const change of [{ employeeId: null }, { endsOn: "2030-08-10" }, { endTime: null }, { startTime: null }, { startTime: "" }, { endTime: "14:00" }, { endTime: "13:00" }, { startTime: "24:00" }, { endTime: "25:00" }]) assert.equal(isValidDayBlockTimeRange({ ...block, ...change }), false);
});
