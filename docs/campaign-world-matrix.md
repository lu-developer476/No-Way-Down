# Matriz canónica del mundo de campaña

Auditoría realizada sobre el manifiesto canónico (autoridad de orden), `story_bible.json`, configuraciones jugables, runtime JSON y cinemáticas adyacentes. La Story Bible conserva identificadores históricos en los actos 1 y 5 que no coinciden con el manifiesto (`lvl01-esc01-subsuelo-inicial`, `lvl10-esc03-combate-final-en-via-publica` y `lvl10-esc04-epilogo-final`). La resolución mantiene **sin cambios** los 35 nodos del manifiesto y usa la Story Bible únicamente para intención narrativa.

| Índice | nodeId | runtimeLevelId | Ubicación / piso | Origen → destino | Entrada / salida / transición | Vertical | Objetivo y presencia | Landmark | Sectores | Definición |
|---:|---|---|---|---|---|---|---|---|---:|---|
| 2 | lvl01-esc01-comedor-resistencia | level_1_comedor_resistencia | Banco, comedor subsuelo 1 | intro → pasillos | servicio → puerta, door | neutra | resistir; Alan, Giovanna, Damián, Nahir; oleadas | barricada de resistencia | 3 | subsuelo-dining-resistance |
| 3 | lvl01-esc02-pasillos-hacia-escaleras-pb | level_1_pasillos_escaleras_pb | Banco, subsuelo 1 | comedor → cierre contextual | puerta → escalera PB, stairUp | ascenso narrado | alcanzar escaleras; grupo; infectados | línea de ventanillas | 3 | service-corridor-ascent |
| 5 | lvl02-esc01-hall-planta-baja | level_2_hall_planta_baja | Banco, planta baja | cierre → ascenso | hall → núcleo vertical, stairUp | ascenso narrado | asegurar hall; grupo; infectados | hall principal | 3 | ground-floor-grand-hall |
| 7 | lvl03-esc01-segundo-piso | level_3_segundo_piso | Banco, segundo piso | ascenso → llamado | descanso → escalera, stairUp | ascenso narrado | despejar administración; grupo; infectados | corredor de archivo y vidrio | 3 | second-floor-administration |
| 9 | lvl04-esc01-tercer-piso | level_4_tercer_piso | Banco, tercer piso | llamado → rescate | escalera → oficina, officeAccess | neutra | avanzar hacia rescate; grupo; infectados | oficinas colapsadas | 3 | third-floor-compromised |
| 12 | lvl05-esc01-cuarto-piso-comedor | level_4_oficina_422_comedor_escaleras | Banco, cuarto piso | llamada/descenso → descenso | acceso → escalera, stairDown | descenso narrado | cruzar comedor; sobrevivientes; infectados | ventanales del comedor | 3 | upper-dining-fourth |
| 14 | lvl06-esc01-quinto-piso-pertenencias | level_5_oficinas_selene_descenso | Banco, quinto piso | descenso → salida E | descanso → escalera, stairDown | descenso narrado | recuperar pertenencias; grupo; infectados | lockers abandonados | 3 | fifth-floor-belongings |
| 17 | lvl07-esc01-oficina-422-rescate | level_6_pasillos_planta_baja_salidas | Banco, oficina 422 | pérdida/reencuentro → inicio descenso | oficina → acceso, officeAccess | neutra | rescate canónico; rescatados y grupo; oleadas | barricada 422 ficticia | 3 | office-422-rescue |
| 19 | lvl08-esc01-descenso-con-temporizador | level_8_pasillo_subsuelo2_escaleras_subsuelo3 | Banco, bandas piso 5–subsuelo 2 | inicio descenso → tragedia Damián | descanso superior → inferior, stairDown | descenso jugable | descender a tiempo; grupo; perseguidores | núcleo cortafuego | 3 | timed-multiflight-descent |
| 23 | lvl09-esc01-verificacion-salidas | level_9_verificacion_salidas | Banco, subsuelo 2 | caída final → hallazgo | corredor → rampa garage, garageRamp | descenso espacial | verificar salidas; sobrevivientes; infectados | banco de salidas distintas | 3 | exit-verification-sublevel |
| 26 | lvl10-esc01-garage-busqueda-vehiculo | level_9_subsuelo3_garage_salida | Garage, subsuelo 3 | traición → vehículo | rampa → vehículo, vehicle | neutra | reunir pistas; dúo; infectados | vehículo objetivo | 3 | garage-vehicle-search |
| 28 | lvl10-esc02-resistencia-en-garage | level9_b3_estacionamiento_canonico | Garage, subsuelo 3 | hallazgo → salida garage | vehículo → vehículo, vehicle | neutra | resistir; dúo; oleadas | barricada del vehículo | 3 | garage-resistance |
| 31 | lvl10-esc01-combate-50-bajas-en-via-publica | level10 | Buenos Aires, Plaza de Mayo | traslado → cierre del dúo | calle → ruta exterior, exteriorRoute | neutra | 50 bajas; Alan y Giovanna; oleadas | frente urbano de Plaza | 3 | plaza-de-mayo-street-hold |
| 33 | lvl10-esc03-llegada-a-san-telmo | level_10_llegada_san_telmo | San Telmo, exterior | cierre → desenlace | ruta exterior → límite cinemático | neutra | alcanzar ruta final; dúo; amenazas | esquina de San Telmo | 3 | san-telmo-final-route |

## Resolución de continuidad

- Las escaleras entre nodos siguen siendo landmarks conectados a las cinemáticas canónicas; no se agregaron nodos.
- El descenso temporizado es el recorrido vertical interno: contiene descansos y una interpolación continua, no un teletransporte.
- Garage, Plaza de Mayo y San Telmo tienen geometrías de minimapa y perfiles diferentes.
- Los `runtimeLevelId` peculiares de Oficina 422 y pisos superiores se preservan porque provienen de las configuraciones existentes; el `nodeId` es la identidad canónica.
