import test from "node:test";
import assert from "node:assert/strict";

import { CORE_ACTIONS } from "../scripts/data/core-action-catalog.js";
import { PF2eActionAdapter } from "../scripts/core/pf2e-action-adapter.js";

test("Perform uses the statistic path instead of PF2e's multi-variant system action", async () => {
  const previousGame = globalThis.game;
  let systemActionUseCalls = 0;
  let rollOptions = null;

  try {
    const performSystemAction = {
      slug: "perform",
      use: async () => {
        systemActionUseCalls += 1;
        throw new Error("Action Perform has multiple variants, but no variant was selected.");
      }
    };

    globalThis.game = {
      pf2e: { actions: new Map([["perform", performSystemAction]]) },
      i18n: { localize: (value) => value }
    };

    const actor = {
      getStatistic: (slug) => slug === "performance"
        ? {
            roll: async (options) => {
              rollOptions = options;
              const roll = { total: 24, degreeOfSuccess: 2 };
              options.callback?.(roll, "success", { id: "perform-message" });
              return roll;
            }
          }
        : null
    };

    const definition = CORE_ACTIONS.find((action) => action.id === "perform");
    assert.ok(definition);
    assert.equal(definition.execution.mode, "statistic");

    const adapter = new PF2eActionAdapter();
    const result = await adapter.execute({ definition, actor, difficultyClass: 14 });

    assert.equal(result.ok, true);
    assert.equal(systemActionUseCalls, 0);
    assert.equal(result.results[0].outcome, "success");
    assert.equal(rollOptions.action, "perform");
    assert.equal(rollOptions.identifier, "perform");
    assert.equal(rollOptions.dc.value, 14);
    assert.equal(rollOptions.dc.visible, true);
    assert.equal(rollOptions.createMessage, true);
  } finally {
    globalThis.game = previousGame;
  }
});
