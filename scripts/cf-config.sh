#!/usr/bin/env bash
# Antes de `wrangler pages deploy` (deploy.yml y fast.yml): rellena wrangler.toml con las Variables de GitHub
# D1_DATABASE_ID, ACCESS_TEAM_DOMAIN y ACCESS_AUD. Si falta alguna, quita wrangler.toml: la web se publica
# igual y /api/prefs (ajustes por usuario) responde «sin configurar».
set -euo pipefail
if [ -n "${D1_DATABASE_ID:-}" ] && [ -n "${ACCESS_TEAM_DOMAIN:-}" ] && [ -n "${ACCESS_AUD:-}" ]; then
	sed -i -e "s|__D1_DATABASE_ID__|${D1_DATABASE_ID}|" -e "s|__ACCESS_TEAM_DOMAIN__|${ACCESS_TEAM_DOMAIN}|" -e "s|__ACCESS_AUD__|${ACCESS_AUD}|" wrangler.toml
else
	rm -f wrangler.toml
	echo "::notice::Ajustes por usuario sin configurar (faltan Variables D1_DATABASE_ID, ACCESS_TEAM_DOMAIN o ACCESS_AUD)"
fi
