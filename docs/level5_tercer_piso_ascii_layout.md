# Nivel 5 (Tercer piso institucional) - Layout ASCII

## Leyenda
- `S` = escalera
- `P` = piso transitable
- `B` = balcón
- `C` = columna
- `O` = oficina
- `D` = puerta
- `Z` = spawn zombie
- `T` = trigger combate
- `R` = baranda
- `E` = salida

## Layout ASCII completo

```text
##########################################  NIVEL 5  ##########################################
#  S1 ACCESO / CORREDOR PERIMETRAL  ->  S2 CORREDOR INICIAL  ->  S3 GALERÍA ABIERTA AL HALL  #
#                                                                                              #
#  S S S   P P P P P P P   C   P P P P P   D O O O D   P P P P P   C   Z                      #
#  S P S   P C P P T P P   C   P Z P P P   D O O O D   P C P P P   C   P                      #
#  S S S   P P P P P P P   C   P P P P P   D O O O D   P P P T P   C   P                      #
#          P P P P P P P       P P P P P               P P P P P       P                      #
#                                                                                              #
#  R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R            #
#  B B B B B B B B B B B B B B B B B B B B B B B B B B B B B B B B B B B B B B B B            #
#  P P P C P P P P P P P T P P P C P P Z P P P P C P P P P P P T P P P C P P P P             #
#  P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P               #
#  R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R R            #
#               (apertura visual al hall central a través del balcón/barandas)                 #
#                                                                                              #
#  S4 SECTOR DE OFICINAS                                                                        #
#  P P P P P   D O O O D   P C P P P   D O O O D   P P P Z P   D O O O D                       #
#  P T P P P   D O O O D   P C P T P   D O O O D   P C P P P   D O O O D                       #
#  P P P C P   D O O O D   P P P P P   D O O O D   P P P C P   D O O O D                       #
#                                                                                              #
#  S5 CORREDOR FINAL  ->  S6 SALIDA                                                             #
#  P P C P P P P T P P P C P P P Z P P P C P P P P P P P P E                                   #
#  P P P P P P P P P P P P P P P P P P P P P P P P P P P P P                                   #
#  R R R R R R R R R R R R R R R R R R R R R R R R R R R R R                                   #
################################################################################################
```

## Explicación del flujo del jugador

1. **Entrada por escaleras (`S1`) y enganche al corredor perimetral:**
   - El jugador sube por `S` y entra a una franja de `P` con primeras coberturas en `C`.
   - Aparece presión inicial con `Z` y el primer `T` para fijar el ritmo de avance.

2. **Progresión por corredor inicial (`S2`):**
   - El recorrido sigue lineal sobre `P`, con puertas `D` hacia oficinas `O` que cortan visuales.
   - Los `C` generan micro-coberturas y obligan a limpiar por segmentos.

3. **Galería abierta hacia el hall (`S3`):**
   - Se abre un tramo longitudinal con `B` y `R` continuas, marcando la exposición al vacío central.
   - Los `T` en la galería fuerzan combate en fuego cruzado mientras los `Z` presionan desde extremos.

4. **Sector de oficinas (`S4`):**
   - El flujo pasa de lineal a nodos cortos entre `D` y `O`.
   - Los `T` intermedios encadenan encuentros en cuartos y pasillos, con columnas `C` como puntos de corte.

5. **Corredor final y extracción (`S5` -> `S6`):**
   - El jugador vuelve a un pasillo más angosto de `P` con barandas `R` y último pico de presión (`T` + `Z`).
   - La ruta culmina en `E`, que funciona como salida tras despejar la secuencia final.
