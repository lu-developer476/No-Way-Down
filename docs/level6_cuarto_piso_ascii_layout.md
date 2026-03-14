# Nivel 6 (Cuarto piso - cocina y comedor) - Layout ASCII

## Leyenda
- `S` = escalera
- `P` = piso
- `C` = cocina
- `M` = mesa
- `T` = bandeja o carro
- `F` = cámara frigorífica
- `Z` = spawn zombie
- `D` = puerta
- `B` = cobertura
- `E` = salida

## Layout ASCII completo

```text
###############################################  NIVEL 6  ###############################################
# S1 ACCESO ESCALERA / ASCENSOR DE SERVICIO            S2 RED DE PASILLOS INTERCONECTADOS               #
#                                                                                                         #
#  S S S S   D   P P P P P P P P P   D   P P P P P P P P P P P P P P P P P P P P P P   D   E E E       #
#  S P P S   P   P B P P T P P B P   P   P P B P P Z P P P P B P P T P P P P Z P P B   P   E P E       #
#  S P P S   P   P P P P P P P P P   P   P P P P P P P P P P P P P P P P P P P P P P   P   E E E       #
#  S S S S   P   P P P P P P P P P   D   P P P P P P P P P P P P P P P P P P P P P P   D               #
#                  | pasillo norte conecta con cocina |          | pasillo este conecta salida |         #
#                                                                                                         #
# S3 COCINA INDUSTRIAL + CÁMARA FRIGORÍFICA                S4 ÁREA DE PREPARACIÓN                        #
#                                                                                                         #
#  D   C C C C C C C C C C C C C   D      D   P P P P P P P P P P P P P P P P P P   D                 #
#  P   C B C C C T C C B C C C C   P      P   P T P P B P P T P P B P P T P P B P   P                 #
#  P   C C C C C C C C C C C C C   P      P   P P P P P P P P P P P P P P P P P P   P                 #
#  P   C C F F F F F C C C Z C C   D      P   P P Z P P P P T P P P P Z P P P P P   D                 #
#  D   C C F F F F F C C C C C C   D      D   P P P P P P P P P P P P P P P P P P   D                 #
#                  | puerta de servicio a comedor |               | conexión doble a comedor |           #
#                                                                                                         #
# S5 COMEDOR DEL PERSONAL (MESAS Y COBERTURAS)                S6 EXTRACCIÓN                               #
#                                                                                                         #
#  D   P P M M P P M M P P M M P P M M P P M M P P P P P P P P P P P P P P P P P P   D               #
#  P   P B M M P B M M P B M M P B M M P B M M P   B P P Z P P B P P T P P B P P P   P               #
#  P   P P M M P P M M P P M M P P M M P P M M P   P P P P P P P P P P P P P P P P   P               #
#  P   P P P P P P P P P P P P P P P P P P P P P   P T P P B P P P P B P P Z P P P   D               #
#  D   P P P P P P P P P P P P P P P P P P P P P   D P P P P P P P P P P P P P P P   E               #
#                                                                                                         #
# Recorrido principal sugerido: S -> pasillos servicio -> cocina (C/F) -> preparación (T/B) -> comedor(M)->E #
###########################################################################################################
```

## Explicación del recorrido del jugador

1. **Ingreso por escalera y núcleo de ascensores (`S1`):**
   - El jugador aparece en la zona de `S` y atraviesa una primera `D` para entrar al circuito logístico.
   - La salida (`E`) es visible desde el eje este, pero queda bloqueada por puertas y presión de enemigos.

2. **Navegación por pasillos de servicio interconectados (`S2`):**
   - El nivel abre varios tramos de `P` con conexiones norte-sur y este-oeste para flanquear.
   - Los `B` y `T` cortan líneas de tiro, mientras los `Z` fuerzan limpiar nodos antes de avanzar.

3. **Empuje a cocina industrial (`S3`):**
   - El jugador entra a la cocina (`C`) por puertas dobles `D` y combate entre estaciones con coberturas mixtas.
   - La cámara frigorífica (`F`) funciona como subzona de riesgo/recompensa: puede usarse para romper persecuciones, pero contiene spawn `Z` cercano.

4. **Transición al área de preparación (`S4`):**
   - Se avanza a una zona de carriles con `T` (bandejas/carros) y `B` distribuidos para combate táctico.
   - Las conexiones dobles hacia comedor permiten elegir ruta segura o ruta rápida con más exposición.

5. **Control del comedor del personal y extracción (`S5` -> `S6`):**
   - En comedor, las `M` (mesas) crean cobertura blanda y obligan a moverse en zigzag entre pasillos cortos.
   - Tras despejar los últimos `Z`, se cruza la puerta final `D` y se alcanza `E` para cerrar el nivel.
