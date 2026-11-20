// LOCAL TEST CONTAINER ONLY. This script never reads application environment files.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
const execute = promisify(execFile);
const container = process.env.SUBSCRIPTION_TEST_CONTAINER ?? "myagenda-visible-plan-tests";
async function sql(statement) {
  const { stdout } = await execute("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", statement]);
  return stdout.trim();
}
for (const [tier, table, capacity] of [["pro", "employees", 3], ["pro", "services", 10], ["free", "employees", 1], ["free", "services", 2]]) {
  test(`${tier} concurrent ${table} creations both save and only one claims the final visible slot`, async () => {
    const id = "80000000-0000-4000-8000-000000000001";
    try {
      await sql(`insert into public.businesses(id,name,subscription_tier,pro_limits_enabled) values ('${id}','Local concurrent creation','${tier}',true)`);
      await sql(`insert into public.${table}(business_id,is_public) select '${id}',true from generate_series(1,${capacity - 1})`);
      const statement = `begin; insert into public.${table}(business_id,is_public) values ('${id}',true); select pg_sleep(0.2); commit;`;
      const results = await Promise.allSettled([sql(statement), sql(statement)]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
      assert.equal(Number(await sql(`select count(*) from public.${table} where business_id='${id}' and is_active and is_public`)), capacity);
      assert.equal(Number(await sql(`select count(*) from public.${table} where business_id='${id}' and is_active and not is_public`)), 1);
    } finally {
      await sql(`delete from public.${table} where business_id='${id}'; delete from public.businesses where id='${id}'`);
    }
  });

  test(`${tier} concurrent ${table} activations cannot exceed the final visible slot`, async () => {
    const id = "80000000-0000-4000-8000-000000000002";
    try {
      await sql(`insert into public.businesses(id,name,subscription_tier,pro_limits_enabled) values ('${id}','Local concurrent activation','${tier}',true)`);
      await sql(`insert into public.${table}(business_id,is_public) select '${id}',true from generate_series(1,${capacity - 1})`);
      const hidden = (await sql(`insert into public.${table}(business_id,is_public) values ('${id}',false),('${id}',false) returning id`)).split('\n').filter((value) => /^[a-f0-9-]{36}$/.test(value));
      assert.equal(hidden.length, 2);
      const results = await Promise.allSettled(hidden.map((resourceId) => sql(`begin; update public.${table} set is_public=true where id='${resourceId}'; select pg_sleep(0.2); commit;`)));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.match(results.find((result) => result.status === "rejected").reason.stderr, /PLAN_LIMIT:/);
      assert.equal(Number(await sql(`select count(*) from public.${table} where business_id='${id}' and is_active and is_public`)), capacity);
    } finally {
      await sql(`delete from public.${table} where business_id='${id}'; delete from public.businesses where id='${id}'`);
    }
  });
}


test("concurrent status requests acquire only one provider verification lease", async () => {
  const id = "80000000-0000-4000-8000-000000000003";
  try {
    await sql(`insert into public.businesses(id,name,subscription_tier) values ('${id}','Local verification concurrency','pro')`);
    const responses = await Promise.all([sql(`select public.claim_subscription_verification('${id}','subscription:fixture')`), sql(`select public.claim_subscription_verification('${id}','subscription:fixture')`)]);
    assert.equal(responses.map((response) => JSON.parse(response)).filter((response) => response.allowed).length, 1);
  } finally { await sql(`delete from public.businesses where id='${id}'`); }
});
