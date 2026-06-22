#!/bin/sh
# Evita "Unauthorized" en la Web UI de Prowlarr al acceder por IP de la red local
set -e
CONFIG=/config/config.xml
mkdir -p /config

if [ ! -f "$CONFIG" ]; then
  printf '%s\n' \
    '<Config>' \
    '  <BindAddress>*</BindAddress>' \
    '  <Port>9696</Port>' \
    '  <UrlBase></UrlBase>' \
    '  <AuthenticationMethod>none</AuthenticationMethod>' \
    '  <AuthenticationRequired>DisabledForLocalAddresses</AuthenticationRequired>' \
    '</Config>' > "$CONFIG"
fi

set_xml() {
  tag="$1"
  val="$2"
  if grep -q "<${tag}>" "$CONFIG" 2>/dev/null; then
    sed -i "s|<${tag}>.*</${tag}>|<${tag}>${val}</${tag}>|" "$CONFIG"
  else
    sed -i "s|</Config>|  <${tag}>${val}</${tag}>\n</Config>|" "$CONFIG"
  fi
}

set_xml 'AuthenticationMethod' 'none'
set_xml 'AuthenticationRequired' 'DisabledForLocalAddresses'
set_xml 'BindAddress' '*'

echo "Prowlarr: autenticación local desactivada"
