#!/bin/sh
# Desactiva validación de host en qBittorrent (evita "Unauthorized" al entrar por IP)
set -e
CONF=/config/qBittorrent/qBittorrent.conf
mkdir -p /config/qBittorrent

if [ ! -f "$CONF" ]; then
  printf '%s\n' '[LegalNotice]' 'Accepted=true' '' '[Preferences]' > "$CONF"
fi

set_kv() {
  key="$1"
  val="$2"
  if grep -q "^${key}=" "$CONF" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$CONF"
  else
    echo "${key}=${val}" >> "$CONF"
  fi
}

set_kv 'WebUI\HostHeaderValidation' 'false'
set_kv 'WebUI\LocalHostAuth' 'false'
set_kv 'WebUI\CSRFProtection' 'false'
set_kv 'WebUI\AuthSubnetWhitelistEnabled' 'true'
set_kv 'WebUI\AuthSubnetWhitelist' '172.16.0.0/12, 192.168.0.0/16, 10.0.0.0/8, 127.0.0.1'

echo "qBittorrent: HostHeaderValidation desactivado"
