# Nivel 7 (Quinto piso técnico-administrativo) - Layout ASCII

## Leyenda
- `S` = escalera
- `P` = pasillo
- `D` = Desarrollo
- `C` = Servicios de Comunicaciones
- `I` = Instalación e Implementación
- `E` = Equipamiento
- `B` = baño
- `K` = cocina pequeña
- `G` = puesto de guardia
- `Z` = spawn zombie
- `T` = trigger de combate
- `H` = checkpoint de pertenencias
- `X` = trigger de cinemática
- `_` = suelo transitable

## Layout ASCII completo

```text
#######################################################################################################################################
# NIVEL 7 - FLUJO: LLEGADA (S) -> PASILLO PRINCIPAL (P) -> CHECKPOINTS (H) -> SECTORES TÉCNICOS -> GUARDIAS (G) -> LLAMADA FINAL (X) #
#######################################################################################################################################

      [ACCESO ESCALERAS]                                 [PASILLO PRINCIPAL LARGO]

      S S S
      S _ S
      S _ S____T____Z____P____P____P____P____P____P____P____P____P____P____P____P____P____P____P____P____P____P____P____P____P____P
      S _ S         _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _
      S S S         _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _
                     \__________________________________________ FLUJO PRINCIPAL _________________________________________________/

                             |-------------------------- ÁREAS CONECTADAS AL PASILLO ---------------------------|

         [DESARROLLO]                     [BAÑOS]                         [COCINA PEQUEÑA]            [TRAMO MEDIO]
             D D D                         B B B                              K K K                         P P P
             D _ D                         B _ B                              K _ K                         P _ P
P____P____P__D_Z_D____T____H____P____P____B_Z_B____P____P____K_Z_K____P____P__T__P____P____P____P____P____P____P____P
_    _    _  D _ D    _    H    _    _    B _ B    _    _    K _ K    _    _  _  _    _    _    _    _    _    _    _
_    _    _  D D D    _    H    _    _    B B B    _    _    K K K    _    _  _  _    _    _    _    _    _    _    _
                              (Checkpoint 1: control de pertenencias)

                                     [SERVICIOS DE COMUNICACIONES]
                                           C C C C C
                                           C _ Z _ C
P____P____P____P____P____P____P____P____P__C _ T _ C____H____P____P____P____P____P____P____P____P____P
_    _    _    _    _    _    _    _    _  C _ _ _ C    H    _    _    _    _    _    _    _    _    _
_    _    _    _    _    _    _    _    _  C C C C C    H    _    _    _    _    _    _    _    _    _
                                                   (Checkpoint 2: verificación y resguardo)

                  [INSTALACIÓN E IMPLEMENTACIÓN]                [EQUIPAMIENTO]
                           I I I I                                   E E E E
                           I _ Z I                                   E _ Z E
P____P____P____P____P____P_I _ T I____P____P____P____P____P____P____E _ T E____P____P____P____G____P____P____P____X
_    _    _    _    _    _ I _ _ I    _    _    _    _    _    _    E _ _ E    _    _    _    G    _    _    _    X
_    _    _    _    _    _ I I I I    _    _    _    _    _    _    E E E E    _    _    _    G    _    _    _    X

                                                                                 [PUESTO DE GUARDIA FINAL]
                                                                                          G G G
                                                                                          G _ G
                                                                                          G G G

#######################################################################################################################################
# ZONAS DE COMBATE: T en acceso, Desarrollo, tramo medio, Comunicaciones, Instalación y Equipamiento. X marca el trigger final.      #
#######################################################################################################################################
```

## Explicación del recorrido

1. **Llegada y adaptación inicial (`S`):**
   - El jugador entra por la escalera y pisa suelo transitable (`_`) hasta enganchar el pasillo principal (`P`).
   - En este arranque se activa el primer `T` y aparece presión inicial con un `Z`, obligando a limpiar antes de tomar ritmo.

2. **Avance por pasillo largo y desvío a Desarrollo (`D`):**
   - El flujo principal está claramente horizontal de izquierda a derecha por el eje de `P`.
   - La primera gran apertura lateral es `D`, con spawn (`Z`) y trigger (`T`) para introducir combate en oficina técnica.

3. **Primer checkpoint (`H`) y zonas laterales de riesgo (`B` y `K`):**
   - Tras Desarrollo, el jugador cruza el **Checkpoint 1** (`H`), que sirve como hito de progresión.
   - Baños (`B`) y cocina (`K`) están conectados al corredor como rutas cortas de flanqueo con spawns secundarios (`Z`).

4. **Núcleo de Comunicaciones (`C`) y segundo checkpoint (`H`):**
   - En `C`, el jugador enfrenta otro nodo táctico (`Z` + `T`) en un espacio más controlado.
   - Al salir, cruza el **Checkpoint 2** (`H`), marcando la transición al tramo final del piso.

5. **Empuje final por Instalación (`I`) y Equipamiento (`E`):**
   - El combate escala en dos áreas consecutivas con triggers (`T`) y spawns (`Z`), manteniendo la progresión clara.
   - Los guardias (`G`) aparecen en puntos estratégicos al final del corredor y junto al cierre del nivel.

6. **Cierre narrativo (`X`):**
   - El recorrido concluye en el extremo derecho con `X`, el trigger de cinemática que representa la llamada final.
   - La lectura espacial deja visible que el objetivo siempre fue avanzar por el gran pasillo y consolidar checkpoints hasta ese punto.
