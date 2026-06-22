# Eyedpelis — App Android (Capacitor)

App nativa Android (móvil + Android TV) que carga la web de producción en un WebView.

**URL del servidor:** `https://eyedmovies.eyedcomun.me/`

## Requisitos

- Node.js 18+
- [Android Studio](https://developer.android.com/studio) con Android SDK
- JDK 17 (incluido con Android Studio)

## Comandos

```bash
cd client

# Compilar web + sincronizar con Android
npm run cap:sync

# Abrir proyecto en Android Studio
npm run cap:open

# Sync + ejecutar en dispositivo conectado
npm run cap:run
```

## Generar APK/AAB firmado

1. `npm run cap:sync`
2. `npx cap open android`
3. En Android Studio: **Build → Generate Signed Bundle / APK**
4. Crear o seleccionar keystore
5. Elegir **Android App Bundle** (Play Store) o **APK** (sideload)

## Instalación

### Móvil
- Conecta el teléfono por USB con depuración activada, o instala el APK generado.

### Android TV
- Mismo APK/AAB. Instala con `adb install app-release.apk` o sideload.
- La app aparece en el launcher de TV gracias a `LEANBACK_LAUNCHER`.

## Probar en TV desde el navegador

Añade `?tv=1` a la URL para simular modo TV en desktop:

```
https://eyedmovies.eyedcomun.me/?tv=1
```

## Qué incluye la app

| Característica | Detalle |
|----------------|---------|
| Servidor remoto | `server.url` en `capacitor.config.ts` — no empaqueta el backend |
| Móvil | Launcher normal, navegación táctil |
| Android TV | Banner, leanback launcher, menú simplificado, foco D-pad |
| Reproductor | Play/Pause del mando, seek ±10s, pantalla completa en TV |
| Atrás | Botón del sistema → historial WebView o salir |

## Errores frecuentes

| Problema | Solución |
|----------|----------|
| Pantalla blanca | Revisar `server.url` en `capacitor.config.ts` |
| Vídeo no reproduce | Verificar INTERNET + `mediaPlaybackRequiresUserGesture=false` en MainActivity |
| No aparece en TV | Comprobar `LEANBACK_LAUNCHER` en AndroidManifest.xml |
| Gradle falla | Abrir Android Studio y dejar que sincronice dependencias |

## Archivos clave

- `capacitor.config.ts` — URL remota y appId
- `android/app/src/main/AndroidManifest.xml` — permisos, TV, launcher
- `android/.../MainActivity.java` — WebView, vídeo, botón atrás
- `src/utils/device.ts` — detección modo TV
- `src/components/Layout.tsx` — menú adaptado a TV

## Notas

- Los cambios de UI web se despliegan en el servidor; **no hace falta recompilar el APK** para actualizar la interfaz.
- Solo recompila si cambias código nativo Android o `capacitor.config.ts`.
