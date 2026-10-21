#!/bin/sh
set -eu

# The plugins directory is a bind mount; copy our jar without replacing other plugins.
mkdir -p /opt/Lavalink/plugins
cp /opt/Lavalink/nm-plugin/nm-hls.jar /opt/Lavalink/plugins/nm-hls.jar
exec java -jar /opt/Lavalink/Lavalink.jar "$@"
