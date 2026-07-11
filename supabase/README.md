# Supabase notes

## Recipe nutrition contract

`recipes.calories`, `recipes.protein_g`, `recipes.carbs_g`, `recipes.fat_g`,
and `recipes.fiber_g` always describe **one serving**. The meal-plan generator
uses only these per-serving values.

`recipe_ingredients` values describe the whole recipe as written. A recipe is
eligible for automatic meal-plan generation only when:

- `macros_verified` is `true`: the ingredient total divided by
  `recipes.servings` is within 10% of every recipe-level macro; and
- `eligible_for_generator` is `true`: it also has at least one controlled
  `meal_types` value.

The supported controlled meal types are `breakfast`, `lunch`, `dinner`, and
`snack`. Tags remain display metadata and must not be used for eligibility.

Recipe authors must explicitly maintain dietary patterns, allergens, fiber,
and portioning. `allowed_portions`, when supplied, is the complete permitted
set of serving multipliers. A non-scalable recipe can only use whole servings.

## Generation configuration

The deterministic defaults are:

| Setting | Value |
| --- | --- |
| 3 meals | breakfast 30%, lunch 35%, dinner 35% |
| 3 meals plus snack | breakfast 25%, lunch 30%, dinner 30%, snack 15% |
| Default tolerances | calories 5%, protein 10%, carbs 15%, fat 15% |
| Default repeat limit | 2 recipes per week |

Clinical guardrails for calories and individual macros have not been approved
or supplied. The generator must remain disabled until the coach records those
ranges; this product does not replace medical or dietitian advice.

## Plan publication precedence

There is no implicit source-priority lookup for meal plans. Exactly one
assignment is marked `current`; publication is an explicit transaction.

- An administrator may publish a coach-authored or generated draft, replacing
  the current assignment.
- A user-generated or user-requested plan stays a draft until that user
  confirms it; confirmation then replaces the current assignment.
- An administrator may instead leave a generated draft for the user to review.
  It has no effect until the user confirms it or the administrator publishes it.

This preserves historical assignments and lets `get_current_meal_plan_id` be
the only current-plan resolver.

## Phase 0 catalogue coverage report — 2026-07-11

The live audit found 9 recipes, all with ingredients and all passing the 10%
per-serving macro reconciliation. The provisional controlled classification
produces the following eligible counts:

| Meal type | Eligible recipes | Result |
| --- | ---: | --- |
| Breakfast | 3 | Fails the minimum of 4 |
| Lunch | 4 | Meets the count only; protein-share feasibility still needs approved guardrails |
| Dinner | 5 | Meets the count only; protein-share feasibility still needs approved guardrails |
| Snack | 1 | Fails the minimum of 4 |

Generation launch is blocked. At least one additional breakfast and three
additional snack recipes are required before considering protein-share checks;
the coach must also approve the calorie and macro guardrail range used for
those checks. The Phase 0 migration records the full per-recipe audit and
classification reproducibly.
