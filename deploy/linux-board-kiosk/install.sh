#!/usr/bin/env bash
set -euo pipefail

# Run on Debian/Ubuntu as root. Example:
# sudo bash install.sh https://score.example.org
if [[ "${EUID}" -ne 0 ]]; then echo "Run with sudo/root." >&2; exit 1; fi
SERVER_URL="${1:-}"
if [[ ! "$SERVER_URL" =~ ^https://[^[:space:]]+$ ]]; then
  echo "Usage: sudo bash install.sh https://your-scorekeeper-server" >&2; exit 1
fi
SERVER_URL="${SERVER_URL%/}"
APP_USER="dart-display"
INSTALL_DIR="/opt/dart-board-kiosk"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y chromium cage seatd curl ca-certificates
if ! id "$APP_USER" &>/dev/null; then
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
fi
usermod -aG video,input "$APP_USER"
if getent group seat >/dev/null; then usermod -aG seat "$APP_USER"; fi
systemctl enable --now seatd.service
install -d -m 0755 "$INSTALL_DIR"
cat > "$INSTALL_DIR/start.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
source /etc/dart-board-kiosk.conf
exec cage -- chromium \
  --ozone-platform=wayland \
  --no-first-run \
  --no-default-browser-check \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --kiosk \
  --user-data-dir=/home/dart-display/.config/chromium-kiosk \
  "$DISPLAY_URL"
EOF
chmod 0755 "$INSTALL_DIR/start.sh"
printf 'DISPLAY_URL=%q\n' "$SERVER_URL/board-display" > /etc/dart-board-kiosk.conf
chmod 0644 /etc/dart-board-kiosk.conf
cat > /etc/systemd/system/dart-board-kiosk.service <<'EOF'
[Unit]
Description=Dart Scorekeeper board display kiosk
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=dart-display
WorkingDirectory=/home/dart-display
Environment=HOME=/home/dart-display
Environment=XDG_RUNTIME_DIR=/run/dart-board-kiosk
Environment=LIBSEAT_BACKEND=seatd
RuntimeDirectory=dart-board-kiosk
RuntimeDirectoryMode=0700
ExecStart=/opt/dart-board-kiosk/start.sh
Restart=always
RestartSec=5
StartLimitIntervalSec=0
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable dart-board-kiosk.service
echo "Installed. Reboot to start the kiosk; verify the display service with: systemctl status dart-board-kiosk"
echo "WARNING: Server-side persistent pairing is not yet implemented. This installer opens the existing sign-in display prototype."
