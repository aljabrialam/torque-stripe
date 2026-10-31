# Torque Stripe · post captions

Graphics in this folder (PNG exports, editable HTML sources, rebuilt with `node docs/social/build.mjs`):

| File | Size | Use |
|---|---|---|
| `torque-stripe-portrait-1080x1350.png` | 1080 x 1350 | LinkedIn / Instagram feed: the product |
| `torque-stripe-results-1080x1080.png` | 1080 x 1080 | LinkedIn / Instagram: the measured result |
| `torque-stripe-report-1080x1350.png` | 1080 x 1350 | LinkedIn / Instagram: the signed report |
| `torque-stripe-landscape-1600x900.png` | 1600 x 900 | X, LinkedIn link post, slides |

## LinkedIn (launch post)

Today at Autonomous SG 2026 I built Torque Stripe for the Airbus track (Challenge 4: find, understand and verify regulated technical information).

A licensed engineer asks about an FAA proposed airworthiness directive for their aircraft. The answer is quoted from the Federal Register notice, cited to the page, checked against the docket's revision history and the aircraft's model list. If the data cannot support an answer, it refuses and says why.

The rule I held to: every safety decision is code, not a model's guess. Claude only rewords evidence the rules already picked, and a verifier drops anything it cannot trace back to the source.

On 42 real questions over 431 notices: 42 correct and 0 of 16 unsafe answers. A plain search baseline got 5 right and answered all 16 unsafe questions. Every withdrawn proposal was flagged.

Each answer exports as a PDF report with a fingerprint and a sign-off block, because the engineer signs, not the AI.

Try it: https://torque-stripe.vercel.app
Code: https://github.com/aljabrialam/torque-stripe

#AutonomousSG #Airbus #Aviation #AI #Claude #Hackathon

## X (short)

Torque Stripe: cited, model-checked answers about FAA proposed ADs, or a clear refusal. Rules decide, Claude only rewords, the engineer signs. 42/42 correct, 0/16 unsafe vs a search baseline at 16/16 unsafe. Built at #AutonomousSG for the Airbus track.
https://torque-stripe.vercel.app
