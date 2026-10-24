import { vResultValidator, vWorkflowId, WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

/**
 * Extracting a pattern, start to finish, as a durable workflow: each stage
 * is a step (stages.ts), the run's status on the pattern says where it is,
 * and a stage that fails stops the run (see `done`). Sections run four at a
 * time after the first, which writes the prompt cache the others read.
 */

export const workflow = new WorkflowManager(components.workflow, { workpoolOptions: { maxParallelism: 4 } });

export const extract = workflow
  .define({ args: { patternId: v.id("patterns"), preprocess: v.boolean() } })
  .handler(async (step, { patternId, preprocess }): Promise<void> => {
    const stages = internal.pipeline.stages;
    const enter = (stage: string, problems: string[] = []) => step.runMutation(internal.pipeline.state.setStage, { patternId, stage, problems });

    if (preprocess) {
      await enter("preprocess");
      await step.runAction(stages.preprocess, { patternId }, { retry: true });
    }
    await enter("map");
    const map = await step.runAction(stages.map, { patternId });

    await enter("sections", map.problems);
    const [first, ...rest] = map.sectionIds;
    const sections = [
      await step.runAction(stages.section, { patternId, sectionId: first }),
      ...(await Promise.all(rest.map((sectionId) => step.runAction(stages.section, { patternId, sectionId })))),
    ];
    if (!sections.some((s) => s.ok)) throw new Error("No section could be extracted");

    await enter("charts", sections.flatMap((s) => s.problems));
    const charts = await step.runAction(stages.charts, { patternId });
    await enter("glossary", charts.problems);
    const glossary = await step.runAction(stages.glossary, { patternId });
    await enter("checks", glossary.problems);
    await step.runMutation(internal.pipeline.state.finish, { patternId });
  });

/** When the workflow ends: a failure or cancellation is recorded on the pattern (success already was, by `finish`). */
export const done = internalMutation({
  args: { workflowId: vWorkflowId, result: vResultValidator, context: v.object({ patternId: v.id("patterns") }) },
  handler: async (ctx, { result, context }) => {
    if (result.kind === "success") return;
    const error = result.kind === "failed" ? result.error : "Canceled";
    await ctx.runMutation(internal.pipeline.state.stop, { patternId: context.patternId, error });
  },
});
