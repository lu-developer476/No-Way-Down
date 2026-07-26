# Evidencia visual reproducible de alineación

Las láminas `weapons.svg` y `character-states.svg` son capturas deterministas, con renderizado `crispEdges`, de los anclajes centralizados. Muestran las once armas, ambos sentidos, fogonazo/proyectil, cambio de slot, ataque cuerpo a cuerpo, escalera, daño, muerte, aliado y zombi.

Regenerar desde la configuración usada por el juego:

```bash
node --experimental-strip-types scripts/generateVisualAlignmentEvidence.mjs
```

La línea verde representa el suelo, la elipse la sombra, el rectángulo celeste el cuerpo Arcade y la cruz amarilla la boca visible/fogonazo. La prueba unitaria verifica además que los perfiles terminan en el origen de pies y que todos los cálculos producen coordenadas enteras.
