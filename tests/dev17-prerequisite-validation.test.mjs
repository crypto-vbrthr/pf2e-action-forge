import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { ActionRegistry } from "../scripts/core/action-registry.js";
import { CORE_ACTIONS } from "../scripts/data/core-action-catalog.js";
import { PrerequisiteValidator } from "../scripts/core/prerequisite-validator.js";

const byId = new Map(CORE_ACTIONS.map((action) => [action.id, action]));

function actor({ items = [], traits = [], hp = null, conditions = [], skills = {}, speedOther = [] } = {}) {
  const conditionList = [...conditions];
  conditionList.bySlug = (slug) => conditionList.filter((entry) => entry.slug === slug);
  conditionList.get = (slug) => conditionList.find((entry) => entry.slug === slug) ?? null;
  return {
    type: "character",
    items,
    conditions: conditionList,
    skills,
    system: {
      traits: { value: traits },
      attributes: {
        ...(hp ? { hp } : {}),
        speed: { value: 25, other: speedOther }
      }
    },
    getStatistic(slug) {
      const entry = skills[slug];
      return entry ? { rank: entry.rank, proficiency: { rank: entry.rank } } : null;
    }
  };
}

function item(slug, { carryType = "worn", handsHeld = 0, name = slug } = {}) {
  return { type: "equipment", slug, name, system: { equipped: { carryType, handsHeld } } };
}

function condition(slug, value = 1, extra = {}) {
  return { type: "condition", slug, value, system: { value: { value }, ...extra } };
}

test("dev.17 catalog declares hard equipment and target prerequisites", () => {
  assert.equal(byId.get("maneuver-in-flight").prerequisites[0].type, "movement-speed");
  assert.equal(byId.get("command-an-animal").prerequisites[0].trait, "animal");
  assert.equal(byId.get("repair").prerequisites[0].type, "item");
  assert.equal(byId.get("identify-alchemy").prerequisites[0].type, "item");
  assert.equal(byId.get("treat-wounds").prerequisites.some((entry) => entry.state === "living-wounded"), true);
  assert.equal(byId.get("administer-first-aid-stabilize").prerequisites.some((entry) => entry.state === "dying"), true);
  assert.equal(byId.get("administer-first-aid-stop-bleeding").prerequisites.some((entry) => entry.state === "persistent-bleed"), true);
  assert.equal(byId.get("follow-the-expert").prerequisites[0].minRank, 2);
});

test("ActionRegistry copies and deep-freezes prerequisite metadata", () => {
  const registry = new ActionRegistry();
  registry.register(byId.get("treat-wounds"));
  const action = registry.get("treat-wounds");
  assert.ok(Object.isFrozen(action.prerequisites));
  assert.ok(Object.isFrozen(action.prerequisites[0]));
  assert.ok(Object.isFrozen(action.prerequisites[0].slugs));
});

test("equipment validation recognizes toolkits and First Aid held-or-worn usage", async () => {
  const validator = new PrerequisiteValidator();
  const patient = actor({ hp: { value: 0, max: 30 }, conditions: [condition("dying", 2)] });
  const healer = actor({ items: [item("healers-toolkit", { carryType: "worn" })] });
  let result = await validator.validate(byId.get("administer-first-aid-stabilize"), {
    actor: healer,
    targetState: { targets: [{ actor: patient }] },
    statistic: "medicine",
    resolveTargets: false
  });
  assert.equal(result.ok, true);

  healer.items[0].system.equipped.carryType = "stowed";
  result = await validator.validate(byId.get("administer-first-aid-stabilize"), {
    actor: healer,
    targetState: { targets: [{ actor: patient }] },
    statistic: "medicine",
    resolveTargets: false
  });
  assert.equal(result.ok, false);
  assert.equal(result.hardFailures[0].message, "PF2EActionForge.Prerequisites.HealersToolkit");
});

test("Treat Wounds requires healer tools and a living damaged or wounded target", async () => {
  const validator = new PrerequisiteValidator();
  const healer = actor({ items: [item("heilers-tools", { name: "Heilerwerkzeuge" })], skills: { medicine: { rank: 2 } } });
  const damaged = actor({ hp: { value: 17, max: 30 } });
  const fullButWounded = actor({ hp: { value: 30, max: 30 }, conditions: [condition("wounded", 1)] });
  const full = actor({ hp: { value: 30, max: 30 } });
  const undead = actor({ traits: ["undead"], hp: { value: 12, max: 30 } });

  for (const target of [damaged, fullButWounded]) {
    const result = await validator.validate(byId.get("treat-wounds"), { actor: healer, targetState: { targets: [{ actor: target }] }, resolveTargets: false });
    assert.equal(result.ok, true);
  }
  for (const target of [full, undead]) {
    const result = await validator.validate(byId.get("treat-wounds"), { actor: healer, targetState: { targets: [{ actor: target }] }, resolveTargets: false });
    assert.equal(result.ok, false);
  }
});

test("First Aid stop bleeding and Command an Animal validate target state/trait", async () => {
  const validator = new PrerequisiteValidator();
  const healer = actor({ items: [item("healers-toolkit")] });
  const bleeding = actor({ conditions: [condition("persistent-damage", 1, { persistent: { damageType: "bleed" } })] });
  const normal = actor();
  assert.equal((await validator.validate(byId.get("administer-first-aid-stop-bleeding"), { actor: healer, targetState: { targets: [{ actor: bleeding }] }, resolveTargets: false })).ok, true);
  assert.equal((await validator.validate(byId.get("administer-first-aid-stop-bleeding"), { actor: healer, targetState: { targets: [{ actor: normal }] }, resolveTargets: false })).ok, false);

  const source = actor();
  assert.equal((await validator.validate(byId.get("command-an-animal"), { actor: source, targetState: { targets: [{ actor: actor({ traits: ["animal"] }) }] }, resolveTargets: false })).ok, true);
  assert.equal((await validator.validate(byId.get("command-an-animal"), { actor: source, targetState: { targets: [{ actor: actor({ traits: ["humanoid"] }) }] }, resolveTargets: false })).ok, false);
});

test("Maneuver in Flight and Follow the Expert validate movement and expert rank", async () => {
  const validator = new PrerequisiteValidator();
  const flyer = actor({ speedOther: [{ type: "fly", value: 30 }] });
  const walker = actor();
  assert.equal((await validator.validate(byId.get("maneuver-in-flight"), { actor: flyer, resolveTargets: false })).ok, true);
  assert.equal((await validator.validate(byId.get("maneuver-in-flight"), { actor: walker, resolveTargets: false })).ok, false);

  const follower = actor();
  const expert = actor({ skills: { stealth: { rank: 2 } } });
  const trained = actor({ skills: { stealth: { rank: 1 } } });
  assert.equal((await validator.validate(byId.get("follow-the-expert"), { actor: follower, statistic: "stealth", targetState: { targets: [{ actor: expert }] }, resolveTargets: false })).ok, true);
  assert.equal((await validator.validate(byId.get("follow-the-expert"), { actor: follower, statistic: "stealth", targetState: { targets: [{ actor: trained }] }, resolveTargets: false })).ok, false);
});

test("thieves-tool exceptions remain advisory instead of inventing a hard block", async () => {
  const validator = new PrerequisiteValidator();
  const rogue = actor();
  for (const id of ["pick-a-lock", "disable-a-device"]) {
    const result = await validator.validate(byId.get(id), { actor: rogue, resolveTargets: false });
    assert.equal(result.ok, true, id);
    assert.equal(result.warnings.length, 1, id);
    assert.equal(result.warnings[0].severity, "advisory", id);
  }
});

test("UI and privileged application broker both invoke the shared validator", async () => {
  const root = new URL("../", import.meta.url);
  const app = await readFile(new URL("scripts/ui/action-forge-app.js", root), "utf8");
  const broker = await readFile(new URL("scripts/core/application-broker.js", root), "utf8");
  const bootstrap = await readFile(new URL("scripts/action-forge.js", root), "utf8");
  assert.match(app, /prerequisiteValidator\.validate\(action/);
  assert.match(app, /prerequisiteBroker\.request/);
  assert.match(broker, /prerequisiteValidator\.validate\(definition/);
  assert.match(bootstrap, /prerequisiteBroker\.registerQueryHandler/);
});

test("medicine tool prerequisites respect explicit PF2e replacements and waivers", async () => {
  const validator = new PrerequisiteValidator();
  const damaged = actor({ hp: { value: 12, max: 30 } });
  const dying = actor({ hp: { value: 0, max: 30 }, conditions: [condition("dying", 1)] });

  const violetRayMedic = actor({ items: [item("violet-ray", { carryType: "held", handsHeld: 2, name: "Violet Ray" })] });
  assert.equal((await validator.validate(byId.get("administer-first-aid-stabilize"), {
    actor: violetRayMedic,
    targetState: { targets: [{ actor: dying }] },
    resolveTargets: false
  })).ok, true);

  const kholoMedic = actor({ items: [item("right-hand-blood", { carryType: "stowed", name: "Right-Hand Blood" })] });
  for (const id of ["administer-first-aid-stabilize", "treat-disease", "treat-wounds"]) {
    const target = id === "administer-first-aid-stabilize" ? dying : damaged;
    const result = await validator.validate(byId.get(id), {
      actor: kholoMedic,
      targetState: { targets: [{ actor: target }] },
      resolveTargets: false
    });
    assert.equal(result.ok, true, id);
  }
  assert.equal((await validator.validate(byId.get("treat-poison"), {
    actor: kholoMedic,
    targetState: { targets: [{ actor: damaged }] },
    resolveTargets: false
  })).ok, false);
});

test("Aeonbound target waives healer toolkit only for Treat Wounds", async () => {
  const validator = new PrerequisiteValidator();
  const healer = actor();
  const aeonboundPatient = actor({ hp: { value: 18, max: 30 }, items: [item("aeonbound", { name: "Aeonbound" })] });
  const result = await validator.validate(byId.get("treat-wounds"), {
    actor: healer,
    targetState: { targets: [{ actor: aeonboundPatient }] },
    resolveTargets: false
  });
  assert.equal(result.ok, true);
  assert.equal(result.results.some((entry) => entry.code === "item-waived-target"), true);
});
