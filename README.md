# Películas Web 🎬

Centro de medios personal con React + Node.js. Escanea automáticamente películas y series desde tu carpeta en Linux, busca contenido online via TMDB, gestiona descargas y reproduce video con streaming.

## Características

- **Biblioteca local**: detecta automáticamente archivos de video (mp4, mkv, avi, etc.) en carpetas configurables
- **Películas y Series**: categorización separada con detección de episodios (S01E01, 1x01)
- **Metadatos TMDB**: posters, sinopsis, valoraciones enriquecidas automáticamente
- **Búsqueda online**: busca películas y series en The Movie Database
- **Descargas**: cola de descargas con URLs directas o integración con qBittorrent
- **Reproductor**: streaming con soporte de seek (HTTP Range)
- **Escaneo automático**: cron configurable para detectar nuevos archivos
- **Autenticación**: login con usuario/contraseña (JWT)
- **Subtítulos**: detección automática de `.srt`, `.vtt`, `.ass` junto al video
- **Integraciones**: sincronización de metadatos desde Jellyfin y Plex
- **Docker**: despliegue con un solo comando

## Requisitos

- Node.js 18+
- Servidor Linux (donde están tus películas)
- API Key de [TMDB](https://www.themoviedb.org/settings/api) (gratis)
- (Opcional) qBittorrent con Web UI para descargas torrent

## Instalación rápida

```bash
# Clonar o copiar el proyecto a tu servidor Linux
cd peliculas-web

# Instalar dependencias
npm run install:all

# Configurar variables de entorno
cp server/.env.example server/.env
# Editar server/.env con tu ruta de medios y API key

# Desarrollo (frontend + backend)
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Docker (recomendado)

```bash
# Configurar variables
cp .env.example .env
# Editar TMDB_API_KEY, JWT_SECRET, ADMIN_PASSWORD...

# Crear carpetas de medios
mkdir -p media/movies media/series data

# Arrancar
docker compose up -d --build
```

Accede en http://localhost:3001 — usuario por defecto `admin` / `admin`.

Monta tus películas en `./media/movies` y series en `./media/series`.

## Autenticación

- Login por defecto: **admin / admin** (cámbialo en Configuración → Seguridad)
- Desactiva el login desmarcando "Requerir login para acceder"
- Variable `JWT_SECRET` en producción (Docker o `.env`)

## Subtítulos

Coloca archivos de subtítulo junto al video con el mismo nombre:

```
movies/
  Inception.mkv
  Inception.spa.srt    ← detectado automáticamente
  Inception.en.srt
```

Formatos soportados: `.srt`, `.vtt`, `.ass`. Los `.srt` se convierten a WebVTT al reproducir.

## Integraciones Jellyfin / Plex

En **Configuración → Jellyfin / Plex**:

1. Introduce la URL y API key/token de tu servidor
2. Pulsa **Probar** para verificar la conexión
3. Pulsa **Sync** para enriquecer tu biblioteca con metadatos (sinopsis, valoraciones, TMDB ID)

## Despliegue en producción (Linux)

### 1. Estructura de carpetas recomendada

```
/home/tu-usuario/media/
├── movies/          ← Películas (.mp4, .mkv, etc.)
│   ├── Inception.mkv
│   └── Avatar.mp4
└── series/          ← Series (nombre S01E01)
    ├── Breaking Bad/
    │   ├── Breaking.Bad.S01E01.mkv
    │   └── Breaking.Bad.S01E02.mkv
    └── Stranger Things/
        └── Stranger.Things.S01E01.mkv
```

### 2. Configurar

En la web → **Configuración**:

| Campo | Ejemplo |
|-------|---------|
| Ruta base | `/home/tu-usuario/media` |
| Subcarpeta películas | `movies` |
| Subcarpeta series | `series` |
| TMDB API Key | tu clave |
| qBittorrent URL | `http://localhost:8080` (opcional) |

Pulsa **Escanear biblioteca** para importar tus archivos.

### 3. Compilar y ejecutar

```bash
npm run build
npm start
```

El servidor sirve el frontend compilado y la API en el puerto 3001.

### 4. Servicio systemd (recomendado)

```ini
# /etc/systemd/system/peliculas-web.service
[Unit]
Description=Peliculas Web
After=network.target

[Service]
Type=simple
User=tu-usuario
WorkingDirectory=/home/tu-usuario/peliculas-web
ExecStart=/usr/bin/node server/dist/index.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable peliculas-web
sudo systemctl start peliculas-web
```

### 5. Nginx reverse proxy (opcional)

```nginx
server {
    listen 80;
    server_name pelis.tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Importante para streaming de video
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

## Uso

1. **Inicio**: dashboard con estadísticas y contenido reciente
2. **Películas / Series**: navega tu biblioteca local
3. **Buscar**: encuentra contenido en TMDB y añádelo a descargas
4. **Descargas**: monitoriza el progreso
5. **Reproducir**: click en cualquier película/episodio disponible

## Descargas

Al buscar contenido online, puedes añadir descargas de dos formas:

- **URL directa**: enlace HTTP/HTTPS a un archivo de video
- **Magnet/Torrent**: requiere qBittorrent configurado en el servidor

> Usa solo fuentes legales y contenido del que tengas derechos.

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/library/stats` | Estadísticas |
| GET | `/api/library/movies` | Listar películas |
| GET | `/api/library/series` | Listar series |
| GET | `/api/search/multi?q=` | Buscar en TMDB |
| POST | `/api/downloads` | Añadir descarga |
| POST | `/api/settings/scan` | Escanear biblioteca |
| GET | `/api/stream/:id` | Stream de video |
| GET | `/api/stream/:id/subtitle/:index` | Subtítulo WebVTT |
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/integrations/jellyfin/sync` | Sync metadatos Jellyfin |
| POST | `/api/integrations/plex/sync` | Sync metadatos Plex |

## Tecnologías

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router
- **Backend**: Node.js, Express, JSON storage, node-cron
- **Metadatos**: TMDB API, Jellyfin, Plex

## Licencia

MIT — Uso personal.
