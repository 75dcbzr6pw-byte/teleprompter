# MiniPrompter Web

PWA instalable para iPhone y iPad. Guarda la biblioteca en el almacenamiento local del navegador y funciona sin conexión después de la primera carga.

## Probar localmente

Ejecuta un servidor HTTP dentro de esta carpeta, por ejemplo `python3 -m http.server 8080`, y abre `http://localhost:8080`. La instalación real en iPhone requiere publicar la carpeta mediante HTTPS.

## Instalar en iPhone

Abre la dirección publicada con Safari, toca Compartir, elige **Añadir a pantalla de inicio**, activa **Abrir como app** y toca **Añadir**.

## Datos e iCloud Drive

Cada instalación guarda su propia biblioteca. Usa **Respaldar** y elige iCloud Drive en la hoja de compartir. En el segundo dispositivo usa **Restaurar** para cargar ese JSON. iCloud Drive puede sincronizar esta carpeta de código entre Mac, pero no actúa como servidor web ni sincroniza por sí mismo el almacenamiento de Safari.

Incluye biblioteca, búsqueda, editor con ajuste de línea, importación de texto y formato para todo el discurso: tipografía, negrita, cursiva, subrayado, tachado y conversión entre mayúsculas, minúsculas y tipo oración. La lectura ofrece color de texto, 20 niveles uniformes de velocidad —desde una línea cada dos segundos en el nivel 1 hasta 20 líneas por segundo en el nivel 20—, pausa, reinicio, cambio de tamaño, indicador lateral adaptado al espejo horizontal, espejo horizontal y vertical, cuenta regresiva con aviso rojo durante los últimos tres segundos, diseño de ancho adaptable para iPhone y iPad, pantalla completa, bloqueo de suspensión, funcionamiento sin conexión y respaldo/restauración. Al abrir un discurso, solo aparece la primera línea sobre los controles para dar tiempo al locutor antes de iniciar.
