# Commercial readiness architecture

This document records the product/commercial boundary before billing is implemented.

## Product decision

- **Casual Play is the free product.** Basic casual scoring, local saved games, and casual history should remain usable without a league subscription.
- **League is the paid product.** A subscription belongs to the league/organization, not to every player. Players should not need to buy a subscription merely to participate in a league.
- **League development remains preview-unlocked for now.** There is no paywall, checkout flow, billing provider dependency, or subscription enforcement in the current build.
- If advertising is introduced for the free product, it must stay out of the active scoring surface. Setup, results/history, or other low-attention screens are safer candidates.

## Architecture rule: authorization and entitlement are different

The existing `league_memberships` model answers **who is allowed to administer or use a league**. Commercial entitlements answer **whether that league currently has access to the paid league product**.

A future protected league mutation should therefore require both:

1. normal league role/ownership authorization; and
2. the relevant commercial capability.

Do not replace membership roles with subscription checks and do not use a paid subscription as proof of administrative permission.

## Stable capability IDs

Application code should check capabilities from `lib/commercial/capabilities.ts`, not marketing plan names or billing products. Current boundaries are:

### Free casual

- `casual.play`
- `casual.saved_games`
- `casual.history`

### League product

- `league.access`
- `league.manage`
- `league.roster`
- `league.game_night`
- `league.devices`
- `league.statistics`
- `league.status_displays`

These IDs are intended to remain stable even if future plans are renamed or split into tiers.

## Provider-neutral league access

`LeagueAccessSnapshot` deliberately stores only the business state the app needs:

- league ID
- access source: preview, trial, subscription, or manual grant
- access state: active, grace, or inactive
- optional expiry

There are no Stripe-specific customer IDs, price IDs, webhook event types, or provider SDK types in the commercial domain.

A future billing integration should live behind `LeagueAccessProvider`. For example, a billing webhook may update a billing projection or commercial-access table, but feature code should only consume the resulting provider-neutral `LeagueAccessSnapshot`.

## Current preview behavior

`PreviewLeagueAccessProvider` grants active league access to every league. This preserves the existing development/testing experience while giving us the same entitlement shape that a real subscription provider will eventually produce.

No current league route is being paywalled in this architecture pass. Enforcement should be introduced only when the paid launch workflow is ready.

## Data ownership

The league is the commercial subject. This aligns with the existing model:

- leagues are long-lived organizational containers;
- user access is represented by `league_memberships`;
- player identities remain independent from authentication identities;
- seasons, Game Nights, rosters, devices, and league statistics can remain attached to the league regardless of which administrator pays or manages the account.

Changing a league owner or billing contact should therefore not require moving league data to a different user account.

## What we are intentionally not building yet

- Checkout or customer portal
- Subscription database records
- Billing-provider SDK
- Webhooks
- Trials/grace-period UI
- Pricing tiers or per-player limits
- Ads
- Paywall screens

Those should wait until the League/Game Night workflow is mature enough to validate the product and pricing.

## Commercial-launch implementation order

1. Add a persistent provider-neutral league commercial-access projection.
2. Add a billing adapter that translates provider state into that projection.
3. Enforce capabilities at server-side league write boundaries; UI gating remains secondary presentation.
4. Add trial/upgrade/manage-subscription flows.
5. Decide pricing and limits from real league usage rather than baking them into the architecture prematurely.
6. Add product analytics, terms/privacy, billing support flows, and any tasteful free-product advertising only after the scoring UX is stable.
