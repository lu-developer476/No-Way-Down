# Nivel 9 (Fallas de escape y descenso final) - Layout ASCII

## Leyenda
- `P` = pasillo
- `S` = escalera
- `A` = salida A
- `B` = salida B
- `C` = salida C
- `D` = salida D
- `E` = salida E
- `Z` = spawn zombie
- `T` = trigger de combate
- `X` = trigger de cinemática
- `L` = evento de pérdida irreversible
- `R` = punto de retroceso
- `U` = descenso a subsuelo
- `K` = evento de suicidio en 2° subsuelo
- `F` = punto de sacrificio final
- `_` = suelo transitable

## Layout ASCII completo

```text
###################################################################################################################################
# NIVEL 9 - FLUJO: PISO 1 -> PLANTA BAJA -> SALIDAS A/B/C/D/E (RUTAS FALLIDAS) -> NUEVO DESCENSO -> 2° SUBSUELO (K) -> 3° SUBSUELO (F) #
###################################################################################################################################

[1) INICIO EN PISO 1]

S____P____P____P____P____P____P____P
_    _    Z    _    T    _    _    _
S____P____P____X____P____P____P____S
                (brief narrativo inicial)

                      |
                      v

[2) DESCENSO A PLANTA BAJA]

S
_
S
|
v
P____P____P____P____P____P____P____P
_    _    _    Z    _    T    _    _

[3) PRIMER INTENTO DE ESCAPE: SALIDA A BLOQUEADA]

P____P____A
_    _    X    <- cinemática: persiana/gate bloqueado
P____P____R    <- retroceso forzado desde A

[4) RECORRIDO ENTRE B, C, D y E (VERIFICACIÓN DE RUTAS FALLIDAS)]

                B
                _
P____P____P____B____P____P____C____P____P____D____P____P____E
_    Z    T    L    _    _    X    _    Z    T    _    _    X
P____P____P____R____P____P____P____P____P____P____P____P____R

Notas del tramo:
- `B + L`: pérdida irreversible durante intento de apertura/salida.
- `C + X`: cinemática de estado inviable (infectados/obstrucción).
- `D + T`: combate para sostener avance y no quedar encerrados.
- `E + X`: decisión narrativa que revela la ruta final de descenso.

[5) RUTA FINAL: DESCENSO A SUBSUELOS]

R____P____P____U
_    _    X    _   <- trigger de decisión final: "abajo es la única salida"
R____P____P____S
                |
                v

[6) 2° SUBSUELO - EVENTO DE SUICIDIO]

S____P____P____P____P
_    Z    T    K    X
S____P____P____P____U

[7) 3° SUBSUELO - TRAMO FINAL Y SACRIFICIO]

U____P____P____P____P____P____F
_    Z    T    _    Z    T    X
U____P____P____P____P____P_____

( `F` = punto de sacrificio final para permitir el escape del resto )
```

## Explicación del recorrido

1. **Inicio en piso 1:**
   - El jugador aparece en un corredor (`P`) con presión temprana de `Z` y `T`.
   - Un `X` inicial marca el primer trigger narrativo antes de bajar.

2. **Descenso a Planta Baja:**
   - Se usa la escalera (`S`) para conectar piso 1 con la planta baja.
   - El pasillo de llegada vuelve a introducir tensión con zombies y combate.

3. **Salida A y retroceso:**
   - La `A` se intenta primero, pero un `X` confirma que está bloqueada.
   - El equipo retrocede por el punto `R`, cumpliendo la vuelta forzada desde A.

4. **Barrido de B, C, D y E:**
   - En `B` ocurre `L`, la pérdida irreversible.
   - En `C` y `E` hay `X` cinematográficos para mostrar por qué no son escapes válidos.
   - En `D` se dispara `T`, representando combate de contención.
   - Esta secuencia deja explícitas las rutas de escape fallidas.

5. **Descenso definitivo a subsuelos:**
   - Tras la decisión en `E`, un `X` conduce al nodo `U` de descenso.
   - El flujo continúa a 2° subsuelo, donde ocurre `K` (suicidio de infectado) como hito narrativo.

6. **Cierre en 3° subsuelo:**
   - El avance final alterna `Z`/`T` hasta `F`.
   - `F` marca el sacrificio final de aliados para habilitar la salida del resto del grupo.
