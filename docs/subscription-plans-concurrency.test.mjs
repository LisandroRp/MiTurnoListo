// LOCAL TEST CONTAINER ONLY. This script never reads application environment files.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
const execute = promisify(execFile);
const container = "myagenda-plan-tests";
async function sql(statement) {
  const { stdout } = await execute("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", statement]);
  return stdout.trim();
}
for (const [table, capacity, columns, values] of [
  ["employees", 3, "", ""],
  ["services", 10, "", ""],
  ["appointments", 150, ",starts_at", ",'2027-01-15 10:00:00-03'"]
]) {
  test(`concurrent ${table} requests cannot exceed the final Pro quota slot`, async () => {
    const id = "60000000-0000-0000-0000-000000000001";
    try {
      await sql(`insert into public.businesses(id,name,subscription_tier,pro_limits_enabled) values ('${id}','Local concurrency test','pro',true)`);
      await sql(`insert into public.${table}(business_id${columns}) select '${id}'${values} from generate_series(1,${capacity - 1})`);
      const statement = `begin; insert into public.${table}(business_id${columns}) values ('${id}'${values}); select pg_sleep(0.2); commit;`;
      const results = await Promise.allSettled([sql(statement), sql(statement)]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const failure = results.find((result) => result.status === "rejected");
      assert.match(failure.reason.stderr, /PLAN_LIMIT:/);
      assert.equal(Number(await sql(`select count(*) from public.${table} where business_id='${id}'`)), capacity);
    } finally {
      await sql(`delete from public.${table} where business_id='${id}'; delete from public.businesses where id='${id}'`);
    }
  });
}
