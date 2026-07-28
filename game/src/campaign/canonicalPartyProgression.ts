import type { CampaignStateData } from '../systems/core/CampaignState.ts';
import { PartyStateSystem, type PartyMember } from '../systems/core/PartyStateSystem.ts';

type PartyEffect = 'rescue_lorena' | 'rescue_selene' | 'death_lorena' | 'death_damian' | 'death_duo' | 'infect_selene' | 'remove_selene';
const EFFECT_BY_NODE: Readonly<Record<string, PartyEffect>> = {
  'lvl04-cin01-rescate-lorena-en-oficina-422': 'rescue_lorena',
  'lvl06-cin01-reencuentro-y-salida-e': 'rescue_selene',
  'lvl06-cin02-muerte-lorena-y-guardia-en-salida-e': 'death_lorena',
  'lvl08-cin01-damian-infectado-y-suicidio': 'death_damian',
  'lvl08-cin03-caida-final-del-duo': 'death_duo',
  'lvl09-cin01-hallazgo-salida-y-mordida-selene': 'infect_selene',
  'lvl09-cin02-traicion-de-selene-y-huida': 'remove_selene'
};

const ALLIES = {
  rescue_lorena: { id: 'ally-lorena', name: 'Lorena', characterId: 'lorena' },
  rescue_selene: { id: 'ally-selene', name: 'Selene', characterId: 'selene' }
} as const;

export interface CanonicalPartyCommit {
  party: PartyMember[];
  campaign: CampaignStateData;
  changed: boolean;
}

/** Applies only the irreversible event authored for this exact canonical node. */
export function commitCanonicalNode(
  nodeId: string,
  partySnapshot: readonly PartyMember[],
  campaignSnapshot: CampaignStateData
): CanonicalPartyCommit {
  const eventKey = `canonical:${nodeId}`;
  if (campaignSnapshot.irreversibleEvents.includes(eventKey)) {
    return { party: PartyStateSystem.restore(partySnapshot).getSnapshot(), campaign: structuredClone(campaignSnapshot), changed: false };
  }

  const effect = EFFECT_BY_NODE[nodeId];
  if (!effect) return { party: PartyStateSystem.restore(partySnapshot).getSnapshot(), campaign: structuredClone(campaignSnapshot), changed: false };

  const party = PartyStateSystem.restore(partySnapshot);
  const campaign = structuredClone(campaignSnapshot);
  campaign.currentLevel = nodeId;
  campaign.irreversibleEvents = [...new Set([...campaign.irreversibleEvents, eventKey])];
  campaign.seenCinematics = [...new Set([...campaign.seenCinematics, nodeId])];

  if (effect.startsWith('death_')) {
    const victims = effect === 'death_lorena' ? ['ally-lorena'] : effect === 'death_damian' ? ['ally-damian'] : ['ally-hernan', 'ally-yamil'];
    victims.forEach((id) => party.markDead(id));
    campaign.activeCharacters = campaign.activeCharacters.filter((id) => !victims.includes(id));
    campaign.deadCharacters = [...new Set([...campaign.deadCharacters, ...victims])];
    campaign.infectedCharacters = campaign.infectedCharacters.filter((id) => !victims.includes(id));
  } else if (effect === 'infect_selene') {
    party.markInfected('ally-selene');
    campaign.infectedCharacters = [...new Set([...campaign.infectedCharacters, 'ally-selene'])];
  } else if (effect === 'remove_selene') {
    party.removePermanently('ally-selene');
    campaign.activeCharacters = campaign.activeCharacters.filter((id) => id !== 'ally-selene');
    campaign.infectedCharacters = campaign.infectedCharacters.filter((id) => id !== 'ally-selene');
  } else if (effect === 'rescue_lorena' || effect === 'rescue_selene') {
    const ally = ALLIES[effect];
    if (!campaign.deadCharacters.includes(ally.id)) {
      party.upsertMember({ ...ally, controlMode: 'ai', status: 'active', permanentlyLost: false, narrative: { deathPending: false } });
      campaign.activeCharacters = [...new Set([...campaign.activeCharacters, ally.id])];
      campaign.rescuedCharacters = [...new Set([...campaign.rescuedCharacters, ally.id])];
    }
  }

  campaign.narrativeProgress = { ...campaign.narrativeProgress, [eventKey]: true };
  return { party: party.getSnapshot(), campaign, changed: true };
}
