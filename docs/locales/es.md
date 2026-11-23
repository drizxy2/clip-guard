# Clip Guard

Clip Guard es una extensión experimental que avisa sobre comandos de shell sospechosos antes de que se escriban en el portapapeles o se peguen en una página. Sus heurísticas pueden generar falsos positivos o no detectar amenazas; no sustituye las protecciones del sistema operativo.

## Instalación

Descarga y extrae la [versión más reciente](https://github.com/drizxy2/clip-guard/releases).

- **Chrome, Edge, Brave y otros navegadores Chromium:** abre `chrome://extensions` o `edge://extensions`, activa el modo de desarrollador, selecciona **Cargar descomprimida** y elige la carpeta extraída que contiene `manifest.json`.
- **Firefox:** hasta que el complemento esté firmado y publicado en AMO, cárgalo temporalmente desde `about:debugging#/runtime/this-firefox`, seleccionando el `manifest.json` extraído. Los complementos temporales se eliminan al cerrar Firefox.

## Protección y privacidad

El modo de bloqueo detiene las escrituras o pegados sospechosos hasta que decidas. El modo de solo aviso permite la acción y muestra una advertencia. Clip Guard no realiza solicitudes de red ni guarda el texto del portapapeles. Si activas las mediciones locales opcionales, solo registra el origen, el nivel, los motivos y la fecha. El texto pendiente de tu decisión permanece temporalmente en memoria.

La interfaz sigue el idioma del navegador. Consulta el [README del proyecto](../../README.md) para obtener detalles técnicos.
