# Nivel 3 (Escaleras + Hall principal) - Layout ASCII

## Leyenda
- `S` = escalera
- `P` = plataforma
- `C` = columna
- `M` = mostrador
- `Z` = spawn zombie
- `T` = trigger de combate
- `E` = salida
- `_` = piso

## Layout ASCII completo

```text
#######################  ZONA 1: ESCALERAS  #######################
#Z___C____S____C___Z______________________________________________#
#____C___SSS___C______________P__________P_______________________#
#____C__SSSSS__C_______T______P__________P__________T____________#
#____C___SSS___C______________________________________________E___#
#Z___C____S____C__________________________________________________#
####################################################################

###################  ZONA 2: HALL PRINCIPAL (AMPLIO/CIRCULAR)  ###################
#________________________________________________________________________________#
#___________Z______________C___________M M M___________C______________Z__________#
#______________________P P P P P___________________P P P P P_____________________#
#________C___________P___________P____T_____T____P___________P___________C_______#
#___________________P_____C_______P___________P_______C_____P_____________________#
#_____Z_____________P___________P_____M M M_____P___________P_____________Z______#
#____________________P P P P P_____________________P P P P P______________________#
#___________C_______________________T_______T_______________________C______________#
#___________________________________________________________________________E______#
####################################################################################
```

## Flujo de movimiento

1. **Entrada por escaleras (Zona 1):**
   - El avance inicia en la franja de escaleras `S`, con columnas `C` que crean cobertura lateral.
   - Los `Z` en extremos superior e inferior generan presión desde ambos ángulos.
   - Los `T` intermedios obligan a resolver micro-combates antes de conectar con el hall.

2. **Transición a plataformas:**
   - Las plataformas `P` sirven como rutas de enlace hacia la zona amplia.
   - Se puede elegir un avance más seguro por bordes o uno más directo por el centro.

3. **Combate en hall principal (Zona 2):**
   - El hall se diseñó como espacio abierto con anillos de `P` para rodeo y reposicionamiento.
   - Los mostradores `M` y columnas `C` dividen líneas de visión y crean puntos de cobertura.
   - Los `T` centrales fuerzan enfrentamientos en el núcleo del área, mientras los `Z` periféricos alimentan oleadas desde distintos flancos.

4. **Rutas de movimiento recomendadas:**
   - **Ruta central agresiva:** `S -> T (escaleras) -> P central -> T del hall -> E`.
   - **Ruta lateral segura:** `S -> P lateral -> borde del hall (evitando centro) -> E`.
   - **Ruta de control:** limpiar `Z` laterales primero, luego activar `T` centrales para reducir pinzas.

5. **Salida del nivel:**
   - La `E` final está en el extremo del hall para mantener progresión clara de avance tras completar encuentros.
