# Nivel 10 - Subsuelo 3 / Estacionamiento + ruta a San Telmo

## Alcance narrativo implementado

El Nivel 10 se modela con sistemas desacoplados de escena para no cargar la lógica en `GameScene`:

- `Level10ParkingExplorationSystem`
  - Explora estacionamiento con vehículos interactivos y decorativos.
  - Gestiona búsqueda de recursos, llaves y objetos vehiculares.
- `Level10NarrativeSystem`
  - Orquesta la cadena narrativa completa del nivel con beats secuenciales.
  - Dispara placeholders visuales por beat.
- `Level10ResistanceCombatSystem`
  - Controla defensas de resistencia temporizadas (10 minutos y 2 minutos).

## Secuencia narrativa cubierta

1. Cinemática inicial en subsuelo 3.
2. Exploración del estacionamiento con vehículos interactivos/decorativos.
3. Búsqueda de recursos y llaves de vehículo.
4. Evento de mordida de una gemela cerca de una camioneta.
5. Descubrimiento de auto utilizable por otra aliada.
6. Combate principal de resistencia de 10 minutos junto al auto.
7. Progresión de infección durante la defensa.
8. Cinemática posterior con muerte entre hermanas y suicidio fuera de cámara directa.
9. Escape en auto de dos personajes.
10. Cinemática de trayecto hacia San Telmo.
11. Emboscada final a dos cuadras.
12. Combate final de resistencia de 2 minutos.
13. Cinemática final abierta.

## Configuración por JSON

- `game/public/assets/levels/level10_parking_exploration.json`
- `game/public/assets/levels/level10_narrative_chain.json`
- `game/public/assets/levels/level10_resistance_encounters.json`

Todos los assets visuales se referencian por nombre como placeholders.
