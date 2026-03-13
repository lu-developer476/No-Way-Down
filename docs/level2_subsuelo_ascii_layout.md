# Nivel 2 (Pasillo del subsuelo) - Layout ASCII

## Leyenda
- `#` = pared
- `_` = piso
- `C` = columna
- `A` = cajero automático
- `B` = caja de reciclaje
- `Z` = spawn zombie
- `P` = punto de activación de limpieza
- `E` = salida del nivel

## Layout completo

```text
############################################################################################
#Z____C____A____Z____B____C____Z____A____C____Z____B____C____Z____A____C____Z____B____C__#
#__________________________________________________________________________________________#
#____P________________P________________P________________P________________P_________________#
#__________________________________________________________________________________________E
#Z____B____C____A____Z____C____B____Z____A____C____Z____B____C____Z____A____C____Z____B__#
############################################################################################
```

## Explicación del diseño

- Se usa una estructura rectangular y alargada para representar un **pasillo largo** de subsuelo, con paredes superior e inferior continuas.
- Los `P` están distribuidos de forma pareja a lo largo del corredor para marcar las **5 zonas de limpieza** (inicio, primer tercio, centro, segundo tercio y tramo final).
- Los `Z` aparecen tanto en la franja superior como en la inferior para cumplir con **spawns en ambos lados** del pasillo y forzar presión cruzada sobre el jugador.
- Los elementos `C`, `A` y `B` se intercalan como obstáculos/landmarks visuales para dar ritmo al avance y diferenciar sectores del recorrido.
- La `E` se colocó al extremo derecho como **salida del nivel**, reforzando una progresión lineal de izquierda a derecha.
