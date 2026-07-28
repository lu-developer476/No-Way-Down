import canonicalConfigJson from '../../public/assets/levels/level5_canonical_descent.json';
import { Level5CanonicalConfig, Level5CanonicalSystem } from '../systems/Level5CanonicalSystem';

const config = canonicalConfigJson as Level5CanonicalConfig;

export function runLevel5CanonicalExample(): void {
  const system = new Level5CanonicalSystem(config, {
    onBeatActivated: (beat) => {
      console.info('[L5 Canon] Beat activo:', beat.id, '-', beat.label);
    },
    onBeatCompleted: (beat, event) => {
      console.info('[L5 Canon] Beat completado:', beat.id, '-> evento', event.type, event.targetId ?? 'n/a');
    },
    onTimerTick: (timer) => {
      if (timer.remainingMs % 60000 < 1000) {
        console.info('[L5 Canon] Tiempo restante:', timer.formattedRemaining);
      }
    }
  });

  const now = Date.now();
  system.startTimer(now);

  system.processEvent({ type: 'checkpoint-activated', targetId: 'cp-piso-3', floor: 3 }, now + 30_000);
  system.processEvent({ type: 'checkpoint-activated', targetId: 'cp-piso-2', floor: 2 }, now + 95_000);
  system.processEvent({ type: 'cinematic-played', targetId: 'puerta-casi-abierta', floor: 1 }, now + 150_000);
  system.processEvent({ type: 'door-defense-cleared', targetId: 'puerta-principal', floor: 1 }, now + 190_000);
  system.processEvent({ type: 'cinematic-played', targetId: 'nahir-selene-reencuentro' }, now + 220_000);
  system.processEvent({ type: 'coworkers-fled', targetId: 'oficina-selene' }, now + 250_000);
  system.processEvent({ type: 'level-finished', targetId: 'nivel5-cierre' }, now + 280_000);

  console.info('[L5 Canon] Snapshot final:', system.getSnapshot(now + 280_000));
}
