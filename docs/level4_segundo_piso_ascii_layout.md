# Nivel 4 (Escaleras curvas + Segundo piso) - Layout ASCII

## Leyenda
- `S` = escalera
- `R` = rellano
- `C` = columna
- `M` = molinete
- `B` = barrera o cobertura
- `Z` = spawn zombie
- `T` = trigger de combate
- `P` = piso transitable
- `E` = salida o transición
- `D` = puerta
- `_` = suelo

## Layout ASCII completo

```text
##############################  NIVEL 4  ############################################
#Z____C____SSS____C____R R R____M____D____P P P P P____C____Z______________________#
#____B____SS_SS___B____R___R____M____D____P__C____P____B______________________E____#
#____C___SS___SS__C____R T R__________D____P____B__P____C___________________________#
#________S_____S_______R___R____B___________P__T___P_____________________B__________#
#Z___C___S_____S___C___R R R____B____T______P P P P P____C___________Z______________#
#______B__S___S__B______________________________C___________B_______________________#
#_______B__SSS__B__________P P P P P P P____C____P P P P P__________________________#
#___________R______________P___C_____T_P__________P__C____P_________________________#
#_____Z_____R_____C________P_B____B____P____M_____P____B__P_____Z___________________#
#___________R______________P____T______P____M_____P_______P_________________________#
#___________R_____B________P P P P P P P____D_____P P P P P_________________________#
########################################################################################
```

## Explicación del recorrido

1. **Subida por escaleras curvas/seccionadas (bloque izquierdo):**
   - El jugador avanza por tramos de `S` en zig-zag para simular una escalera curva o fragmentada.
   - Los `C` y `B` en los laterales crean coberturas y cortes de visión.
   - Los `Z` en extremos superior e inferior presionan desde dos direcciones.

2. **Zonas de rellano (`R`) y primer punto de combate:**
   - Al terminar la subida, se entra en una malla de `R` (rellanos intermedios) antes del acceso alto.
   - El `T` sobre `R` marca un combate obligatorio de transición, ideal para oleada corta.

3. **Acceso al segundo piso (núcleo con `M` + `D`):**
   - Los molinetes `M` y puertas `D` canalizan la entrada al segundo piso y controlan el ritmo.
   - El flujo principal recomendado es: `S -> R -> M/D -> P`.

4. **Sector principal del segundo piso (derecha):**
   - El área amplia de `P` representa la planta superior jugable.
   - Columnas `C` y barreras `B` generan rutas alternativas y cobertura táctica.
   - Los `T` están repartidos en centro y laterales para crear varios focos de combate.

5. **Rutas de enemigos y zonas de combate:**
   - **Rutas enemigas:**
     - Spawns `Z` del borde izquierdo persiguen durante la subida.
     - Spawns `Z` del borde derecho flanquean en el segundo piso.
     - Spawn `Z` inferior fuerza presión cuando el jugador limpia el centro.
   - **Zonas de combate (`T`):**
     - `T` en rellano (control de transición).
     - `T` central alto (combate principal en planta).
     - `T` lateral bajo (combate de pinza/flanqueo).

6. **Salida o transición (`E`):**
   - La `E` se ubica en el extremo superior derecho para reforzar progresión clara de izquierda (ascenso) a derecha (objetivo).
