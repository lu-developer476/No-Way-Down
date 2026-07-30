# Render QA — final exterior campaign

Open the deployed build with `/?qaCampaign=1`. This checklist records **manual checks to perform on Render**; it does not claim visual approval before deployment.

## Traslado
- [ ] The garage survivor vehicle remains the same vehicle; Alan and Giovanna are visible.
- [ ] Plaza de Mayo reads at a distance and Paseo Colón has Metrobús platforms, stopped buses and dispersed stationary infected.
- [ ] Engine stop, both door exits and the fade to gameplay occur once without a hard cut.

## Avenida Independencia combat
- [ ] The intersection, crosswalks, lanes, cover, foreground and twelve distinct sectors read as an exterior street.
- [ ] HUD starts at `BAJAS 0 / 50`; the timer is a separate pacing chip and expiry is not a new defeat rule.
- [ ] `street_north`, `street_east`, `street_west`, `street_rear` are in bounds and feed the three canonical phases.
- [ ] Test 0, 1 and 49 through QA, spawn and kill the final enemy, then confirm 50/50, no 51st enemy, silence and one cinematic request.
- [ ] Reload returns to the pre-descent checkpoint and resets the complete objective instance to zero.
- [ ] Alan and Giovanna are the only survivors; finite pickups cannot be duplicated.

## San Telmo
- [ ] Narrow cobbled streets, old façades, balconies, ajar doors, foreground and restrained light are visually distinct from Independencia.
- [ ] Observe four or more visible recent clues; none identifies the sender.
- [ ] Limited corner encounters remain reachable and never spawn on the party.
- [ ] The minimap discovers streets, clues and radio progressively.
- [ ] `radio-san-telmo` is visible, prompted and single-use; the exit is locked before it and unlocked after the incomplete transmission.

## Final
- [ ] The open ending preserves the ten canonical beats and does not reveal sender, refuge, cure, military force or later destination.
- [ ] Campaign end shows title, completion, Alan/Giovanna line, credits, thanks and ENTER/click return.
- [ ] Return to menu happens once; Continue reads “Campaña completada” and cannot replay the finale.
- [ ] New Game begins at `campaign-intro`; Options and historical completion remain intact.
- [ ] Audio loops, timers, listeners, overlays and finale diagnostics clean up when their scenes shut down.
