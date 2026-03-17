import level8CanonicalJson from '../../public/assets/levels/level8_canonical_subsuelo_push.json';
import { Level8CanonicalConfig, Level8CanonicalSystem } from '../systems/Level8CanonicalSystem';
import { PartyMember } from '../systems/core/PartyStateSystem';

const seedParty: PartyMember[] = [
  { id: 'alan', name: 'Alan Nahuel', controlMode: 'human', status: 'active', permanentlyLost: false, narrative: { deathPending: false } },
  { id: 'giovanna', name: 'Giovanna', controlMode: 'ai', status: 'active', permanentlyLost: false, narrative: { deathPending: false } },
  { id: 'nahir', name: 'Nahir', controlMode: 'ai', status: 'active', permanentlyLost: false, narrative: { deathPending: false } },
  { id: 'selene', name: 'Selene', controlMode: 'ai', status: 'active', permanentlyLost: false, narrative: { deathPending: false } },
  { id: 'damian', name: 'Damian', controlMode: 'ai', status: 'active', permanentlyLost: false, narrative: { deathPending: false } },
  { id: 'hernan', name: 'Hernan', controlMode: 'ai', status: 'active', permanentlyLost: false, narrative: { deathPending: false } },
  { id: 'yamil', name: 'Yamil', controlMode: 'ai', status: 'removed', permanentlyLost: true, narrative: { deathPending: false } }
];

const canonicalConfig = level8CanonicalJson as Level8CanonicalConfig;

const canonicalSystem = new Level8CanonicalSystem(canonicalConfig, seedParty, {
  onKillCounterChanged: ({ current, required }) => {
    console.info(`[L8 Canon] Bajas confirmadas ${current}/${required}.`);
  },
  onMassAssaultCompleted: ({ kills }) => {
    console.info(`[L8 Canon] Oleada canónica completada con ${kills} bajas.`);
  },
  onDamianCinematicRequested: ({ cinematicId }) => {
    console.info(`[L8 Canon] Lanzar cinemática ${cinematicId}.`);
  },
  onSacrificeDecisionStarted: ({ selectedSacrificeIds }) => {
    console.info(`[L8 Canon] Se sacrifican: ${selectedSacrificeIds.join(', ') || 'nadie'}.`);
  },
  onPartyAdjustedForNextLevel: ({ nextLevelId, survivingPartyIds }) => {
    console.info(`[L8 Canon] Party final para ${nextLevelId}: ${survivingPartyIds.join(', ')}`);
  }
});

for (let i = 0; i < 105; i += 1) {
  canonicalSystem.processEvent({ type: 'zombie-killed', waveId: 'level8_mass_assault_105' });
}

canonicalSystem.processEvent({ type: 'damian-cinematic-finished', targetId: 'level8_damian_infection_farewell' });
for (let i = 0; i < 6; i += 1) {
  canonicalSystem.processEvent({ type: 'stair-segment-cleared', targetId: `pasillo_segmento_${i}` });
}
canonicalSystem.processEvent({ type: 'stairs-reached', targetId: 'stairs_to_subsuelo3' });
canonicalSystem.processEvent({ type: 'sacrifice-cinematic-finished', targetId: 'level8_optional_duo_hold_decision' });
canonicalSystem.processEvent({ type: 'sacrifice-cinematic-finished', targetId: 'level8_optional_duo_overrun' });

console.info('[L8 Canon] Snapshot final', canonicalSystem.getSnapshot());
