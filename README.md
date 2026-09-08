# MiniPrompter Web

PWA instalable para iPhone. Guarda la biblioteca en el almacenamiento local del navegador y funciona sin conexión después de la primera carga.

## Probar localmente

Ejecuta un servidor HTTP dentro de esta carpeta, por ejemplo `python3 -m http.server 8080`, y abre `http://localhost:8080`. La instalación real en iPhone requiere publicar la carpeta mediante HTTPS.

## Instalar en iPhone

Abre la dirección publicada con Safari, toca Compartir, elige **Añadir a pantalla de inicio**, activa **Abrir como app** y toca **Añadir**.

## Datos e iCloud Drive

Cada instalación guarda su propia biblioteca. Usa **Respaldar** y elige iCloud Drive en la hoja de compartir. En el segundo dispositivo usa **Restaurar** para cargar ese JSON. iCloud Drive puede sincronizar esta carpeta de código entre Mac, pero no actúa como servidor web ni sincroniza por sí mismo el almacenamiento de Safari.

Incluye biblioteca, búsqueda, editor con ajuste de línea, importación de texto, velocidad 1–20, desplazamiento, pausa, reinicio, indicador lateral adaptado al espejo horizontal, espejo horizontal y vertical, cuenta regresiva con aviso rojo durante los últimos tres segundos, pantalla completa, bloqueo de suspensión, funcionamiento sin conexión y respaldo/restauración.
