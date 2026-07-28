#!/bin/bash
set -e

app_dir="/opt/NPSharp"
executable="npsharp"
binary="$app_dir/$executable"
sandbox="$app_dir/chrome-sandbox"
crashpad="$app_dir/chrome_crashpad_handler"

if [ ! -f "$binary" ]; then
    echo "NPSharp install error: missing application binary at $binary" >&2
    exit 1
fi

chmod 755 "$binary"

if [ -f "$crashpad" ]; then
    chmod 755 "$crashpad"
fi

if type update-alternatives 2>/dev/null >&1; then
    # Remove previous link if it doesn't use update-alternatives.
    if [ -L "/usr/bin/$executable" ] && [ -e "/usr/bin/$executable" ] && [ "$(readlink "/usr/bin/$executable")" != "/etc/alternatives/$executable" ]; then
        rm -f "/usr/bin/$executable"
    fi
    update-alternatives --install "/usr/bin/$executable" "$executable" "$binary" 100 || ln -sf "$binary" "/usr/bin/$executable"
else
    ln -sf "$binary" "/usr/bin/$executable"
fi

if [ -f "$sandbox" ]; then
    chown root:root "$sandbox"
    chmod 4755 "$sandbox"
    sandbox_owner="$(stat -c '%u:%g' "$sandbox")"
    if [ "$sandbox_owner" != "0:0" ] || [ ! -u "$sandbox" ]; then
        echo "NPSharp install error: chrome-sandbox was not configured correctly." >&2
        exit 1
    fi
fi

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi
