# Linux AIO board kiosk — prototype installer

This folder installs a **browser-based kiosk** for a dedicated 24-inch all-in-one display. No GNOME/KDE desktop is required. Use a dedicated Debian or Ubuntu installation with wired Ethernet where possible.

> **Pilot status:** This launcher is an initial artifact. Server-side six-digit monitor-origin pairing, restricted display credentials, reassignment, and automatic authentication are **not implemented yet**. The current `/board-display` prototype requires a signed-in league user and a board query parameter. Do not deploy unattended in a public venue until the display registration feature replaces that mechanism.

## Installation

Run as root from the directory containing `install.sh`:

```bash
sudo bash ./install.sh https://your-scorekeeper-host.example
sudo reboot
```

The script installs Chromium, Cage (Wayland kiosk compositor), and systemd service `dart-board-kiosk`. It configures automatic startup on the next boot, automatic restart after process failure, a persistent Chromium profile and a server URL without embedded account secrets.

## Maintenance

```bash
sudo systemctl status dart-board-kiosk
sudo journalctl -u dart-board-kiosk -b --no-pager
sudo systemctl restart dart-board-kiosk
```

Set `DISPLAY_URL` in `/etc/dart-board-kiosk.conf` to change the launch URL, then restart the service. Use HTTPS and manage OS updates independently.

## Planned device enrollment protocol

1. A fresh monitor generates a **random enrollment secret** locally and requests a short-lived PIN from the server.
2. The monitor displays the six-digit PIN; the administrator enters it in Venue Hardware and chooses a venue and physical board.
3. The server atomically claims the PIN after authenticating the administrator and verifying venue permissions, then issues a **read-only display credential**, separately scoped from scorer credentials.
4. The monitor persists its credential in its browser profile; a restart retrieves its current assignment automatically.
5. Admin can move a display to a new board, disable it, or rotate/revoke its credential; its screen never exposes scoring or league mutations.
6. Enrollment PINs expire quickly; endpoints must rate-limit PIN guesses, avoid session fixation and race conditions, and never return monitor credentials to the manager.
7. If the network drops, display a conspicuous stale-data warning rather than implying scores are live.

The board-scoring device API and `dsk_` credentials must **not** be reused for monitors because they authorize match mutations.

## Acceptance criteria

- Cold boot without a keyboard launches fullscreen display.
- Power restoration and browser crash recover automatically.
- Unpaired monitor shows its own PIN.
- Manager claims it and assigns Board 1–4, and pairing survives reboot.
- Manager can reassign and revoke it without visiting the monitor.
- Monitor can read only its assigned match; all score, undo and administrative writes are forbidden.
- Credential never appears in URL or log output.
- Lost connectivity is visually obvious; reconnection restores live board state.
