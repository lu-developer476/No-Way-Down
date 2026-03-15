# Nivel 10 (Subsuelo 3 + escape vehicular) - Layout ASCII

## Leyenda
- `S` = escalera
- `P` = pasillo / tránsito del estacionamiento
- `V` = vehículo decorativo
- `I` = vehículo interactivo
- `K` = vehículo con llave o recurso útil
- `X` = camioneta del evento de mordida
- `O` = auto de escape encontrado
- `Z` = spawn zombie
- `T` = trigger de combate
- `C` = trigger de cinemática
- `R` = punto de resistencia de 10 minutos
- `H` = ruta de huida en auto
- `M` = emboscada final en calle
- `F` = punto de resistencia final de 2 minutos
- `E` = final del nivel
- `_` = suelo transitable

## Layout ASCII completo

```text
##############################################################################################################################
# NIVEL 10 - FLUJO: LLEGADA S3 -> EXPLORACIÓN UNILATERAL -> INSPECCIÓN VEHICULAR -> EVENTO DE MORDIDA -> AUTO DE ESCAPE    #
#           -> RESISTENCIA 10' -> HUIDA EN AUTO -> EMBOSCADA -> RESISTENCIA 2' -> FINAL                                     #
##############################################################################################################################

[1) LLEGADA AL ESTACIONAMIENTO DEL 3° SUBSUELO]

S____P____P____P____P
_    _    C    _    _
S____P____P____P____P
          (C: cinemática de entrada al S3)

                     |
                     v

[2) RECORRIDO UNILATERAL DE EXPLORACIÓN + ZONA DE INSPECCIÓN DE VEHÍCULOS]

P____P____P____P____P____P____P____P____P____P
_    V    _    I    _    V    _    I    _    _
P____P____P____P____P____P____P____P____P____P
                |                 |
                v                 v
                K                 X
                _                 _
                P_________________P

Notas del tramo:
- Flujo unilateral: no hay bifurcación útil de regreso, la progresión avanza de izquierda a derecha.
- `I` y `K` concentran inspección interactiva y recurso/llave.
- `X` marca la camioneta del evento de mordida bajo chasis.

                     |
                     v

[3) UBICACIÓN DEL AUTO DE ESCAPE + DISPARO NARRATIVO]

P____P____P____P____O____P
_    Z    T    C    _    _
P____P____P____P____P____P
               (C: hallazgo y activación del plan de huida)

                     |
                     v

[4) DEFENSA PRINCIPAL DE 10 MINUTOS]

P____P____R____P____P____P
_    Z    T    Z    T    _
P____P____P____P____P____P

                     |
                     v

[5) TRANSICIÓN AL TRAYECTO EN AUTO]

O====H====H====H====H
      C         C
      _         _
      P_________P

( `C` intermedios: beats narrativos de salida del estacionamiento y avance por calle )

                     |
                     v

[6) EMBOSCADA FINAL EN CALLE]

H====H====M====H
_    Z    T    _
P____P____P____P

                     |
                     v

[7) COMBATE FINAL DE 2 MINUTOS + CIERRE]

P____P____F____P____E
_    Z    T    C    _
P____P____P____P____P

( `F` = resistencia final de 2 minutos, `C` = cinemática de cierre antes de `E` )
```

## Explicación del recorrido

1. **Llegada al 3° subsuelo:**
   - El grupo entra por escalera (`S`) al área de tránsito (`P`).
   - Un `C` temprano fija tono narrativo y objetivo inmediato en el estacionamiento.

2. **Exploración unilateral del parking:**
   - El recorrido avanza en un único sentido por pasillos (`P`) con vehículos decorativos (`V`) y puntos interactivos (`I`).
   - La inspección de `K` entrega recurso/llave útil para habilitar la progresión.
   - La camioneta `X` activa el evento de mordida bajo vehículo y acelera la urgencia.

3. **Hallazgo del auto de escape:**
   - El `O` aparece tras una zona de presión con `Z` + `T`.
   - Un `C` confirma narrativamente que ese auto será la salida.

4. **Resistencia principal de 10 minutos:**
   - El punto `R` concentra el combate sostenido con oleadas (`Z`) y triggers (`T`).
   - Este bloque representa la defensa principal antes de poder abandonar el lugar.

5. **Transición a la huida en auto:**
   - Desde `O`, la ruta `H` representa el trayecto vehicular continuo.
   - Los `C` del tramo muestran cortes narrativos durante el escape.

6. **Emboscada final y último aguante:**
   - En `M` se produce la emboscada en calle y se reabre combate (`Z`, `T`).
   - Se llega al nodo `F` para la defensa final de 2 minutos.

7. **Final del nivel:**
   - Tras superar `F`, un `C` final dispara el cierre y el nivel concluye en `E`.
