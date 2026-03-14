# Nivel 8 (Rescate en oficina 422) - Layout ASCII

## Leyenda
- `S` = escalera
- `P` = pasillo
- `O` = oficina común
- `D` = Desarrollo
- `C` = Servicios de Comunicaciones
- `X` = oficina 422
- `A` = ascensores
- `R` = zona de descanso / checkpoint
- `W` = escalera en espiral
- `Z` = spawn zombie
- `T` = trigger de combate
- `H` = punto de rescate
- `M` = trigger de mensaje / cinemática
- `Y` = ruta hacia piso 1
- `E` = objetivo final
- `_` = suelo transitable

## Layout ASCII completo

```text
#####################################################################################################################################################
# NIVEL 8 - FLUJO: INICIO EN C -> RECORRIDO INVERSO NIVEL 7 -> DESCENSO AL 4° PISO -> OFICINA 422 (X/H) -> DESCANSO (R/A) -> W + TEMPORIZADOR -> Y -> E #
#####################################################################################################################################################

                             [INICIO - SERVICIOS DE COMUNICACIONES / RECORRIDO INVERSO DEL NIVEL 7]

                 C C C C C
                 C _ M _ C
                 C _ Z _ C____T____P____P____P____P____P____P____P____P____P____P____P____P____P____P____S
                 C _ _ _ C    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _
                 C C C C C    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    S
                                \______________ avance de regreso por corredor técnico-administrativo ______________/

                                      [RAMALES DE OFICINAS DURANTE EL RETROCESO]

                 O O O                         D D D                         O O O
                 O _ Z____T                    D _ Z____T                    O _ Z____T
P____P____P____P_O _ _    _____P____P____P____D _ _    _____P____P____P____O _ _    _____P____P____P____M
_    _    _    _ O O O         _    _    _    D D D         _    _    _    O O O         _    _    _    _
_    _    _    _               _    _    _                  _    _    _                  _    _    _    _
                                                                                                     (mensaje de descenso)

#####################################################################################################################################################
# TRANSICIÓN VERTICAL: descenso al 4° piso por escalera S. Se mantiene el eje de pasillo P con encuentros de combate (T) y presión de hordas (Z).     #
#####################################################################################################################################################

                                                     [4° PISO - ACCESO A OFICINA 422]

S____P____P____P____P____P____P____P____P____P____P____P____P____P____P____P____P____P____P____X X X X
_    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    X _ H X
S____T____Z____P____P____O____O____P____D____D____P____P____T____Z____P____P____P____M____P____X _ _ X
                 _    _    O _ O    _    D _ D    _    _    _    _    _    _    _    _    _    X X X X
                 _    _    O O O    _    D D D    _    _    _    _    _    _    _    _    _

                                            [X = OFICINA 422 | H = PUNTO DE RESCATE]

                                              M (cinemática de rescate / confirma objetivo)

#####################################################################################################################################################
# SALIDA: OFICINA 422 -> ZONA DE DESCANSO R CON 3 ASCENSORES A -> ESCALERA EN ESPIRAL W -> ACTIVACIÓN DE TEMPORIZADOR -> RUTA Y HACIA PISO 1 -> E   #
#####################################################################################################################################################

X____P____P____P____P____P____P____R R R R R____A A A____A A A____A A A____P____P____W W W____M____Y____Y____Y____E
_    _    _    _    _    _    _    R _ _ _ R    A _ A    A _ A    A _ A    _    _    W _ W    _    _    _    _    E
X____T____Z____P____P____M____P____R _ _ _ R____A A A____A A A____A A A____P____T____W _ W____M____Y____Z____T____E
_    _    _    _    _    _    _    R R R R R                               _    _    W W W    _    _    _    _    _
                                          (checkpoint temporizado)                    (inicio cuenta regresiva)   (rush final)
```

## Explicación del recorrido

1. **Inicio en Servicios de Comunicaciones (`C`) y recuperación narrativa (`M`):**
   - El jugador aparece en `C` con un mensaje inicial (`M`) que confirma el objetivo de retorno.
   - Inmediatamente se activa presión con `Z` y un primer `T` para marcar que el nivel comienza en estado de emergencia.

2. **Recorrido inverso del Nivel 7 por pasillo (`P`) y oficinas (`O`/`D`):**
   - La lectura del mapa empuja de derecha a izquierda respecto al flujo original del Nivel 7: ahora se **retrocede** por el mismo sistema de corredor.
   - Los ramales de oficinas comunes (`O`) y Desarrollo (`D`) introducen encuentros laterales con `Z` + `T`, forzando despeje y control de flancos.

3. **Descenso al 4° piso (`S`) y aproximación a oficina 422 (`X`):**
   - El tramo de transición desciende por escalera (`S`) y reengancha un nuevo eje de `P` en el cuarto piso.
   - El corredor alterna combate (`T`) y spawns (`Z`) hasta el bloque `X` (oficina 422), donde el `H` representa el punto de rescate.
   - Un `M` posterior marca la cinemática de éxito parcial y el cambio de objetivo: evacuar con urgencia.

4. **Salida a zona de descanso (`R`) con tres ascensores (`A`):**
   - Tras abandonar `X`, el jugador alcanza la zona `R`, que funciona como checkpoint seguro.
   - Los **3 ascensores** aparecen explícitos como `A A A` en tres columnas, reforzando el hito espacial pedido.

5. **Escalera en espiral (`W`) y activación del temporizador (`M`):**
   - El avance llega a `W`, nodo vertical crítico donde se activa la cuenta regresiva (marcada con `M`).
   - Se incluye un segundo `T` para representar el pico de amenaza al comenzar el tramo contrarreloj.

6. **Ruta hacia piso 1 (`Y`) y objetivo final (`E`):**
   - El último segmento es una ruta lineal de escape (`Y`) con presión final (`Z` + `T`).
   - El nivel cierra en `E`, explicitando que el objetivo final es alcanzar la salida durante el temporizador activo.
