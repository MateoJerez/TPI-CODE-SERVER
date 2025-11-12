set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
ENVFILE="$APP_DIR/.env"


if [ -f "$ENVFILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    l="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    case "$l" in
      ''|#*|//*) continue ;;
      *)
        if echo "$l" | grep -qE '^[A-Za-z_][A-Za-z0-9_]*='; then
          export "$l"
        fi
        ;;
    esac
  done < "$ENVFILE"
fi

cd "$APP_DIR"
exec node server.js
