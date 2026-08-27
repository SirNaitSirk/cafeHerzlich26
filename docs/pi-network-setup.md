# Raspberry Pi – Netzwerk-Setup (Kiosk-AP + Internet für Auto-Updates)

Ziel: Der Pi spannt ein **eigenes, abgeschottetes WLAN** für die Kiosk-Geräte
(iPads, Touchscreen, TV) auf und ist **gleichzeitig** über einen zweiten
WLAN-Adapter mit dem Café-WLAN verbunden, um sich automatisch die Änderungen
von GitHub zu ziehen.

Wichtig: Die Bestell-App läuft weiterhin **komplett lokal**. Das Internet dient
ausschließlich den Updates – zur Laufzeit braucht die App keine Internetverbindung.

## Überblick

| Schnittstelle | Rolle | Zweck |
|---|---|---|
| `wlan0` (interner Chip) | Access Point | Kiosk-Netz `CafeHerzlich`, App unter `192.168.4.1:3000` |
| `wlan1` (USB-Stick) | Client am Café-WLAN | Internet → `git pull` |

- **Kein Routing/NAT** zwischen `wlan0` und `wlan1`. Die Kiosk-Geräte erreichen
  nur den Pi, nicht das Internet. Genau die gewünschte Abgrenzung.
- Getrennte Radios: Ein einzelner Pi-WLAN-Chip kann AP + Client nicht
  zuverlässig gleichzeitig – deshalb der USB-Stick als zweite Schnittstelle.

## Hardware: USB-WLAN-Stick

Nicht jeder Chipsatz kann unter Linux stabil im Client-Modus. Bewährt:

- **RTL8811AU / RTL8812AU** (Dualband, z. B. viele „AC600"-Sticks)
- **RTL8192EU**
- Offizieller **Raspberry Pi USB-WLAN-Adapter**

Nach dem Einstecken prüfen, dass der Stick als `wlan1` erkannt wird:

```bash
ip link            # wlan0 (intern) + wlan1 (USB) müssen erscheinen
lsusb              # Chipsatz identifizieren
```

Falls die Namen vertauscht sind (USB wird `wlan0`), unten überall `wlan0`/`wlan1`
entsprechend tauschen. Empfehlung: Namen per udev-Regel festnageln, damit sie
nach Reboot stabil bleiben (siehe Abschnitt „Interface-Namen fixieren").

---

## 1. Pakete installieren

```bash
sudo apt update
sudo apt install -y hostapd dnsmasq
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
```

`dnsmasq` erstmal stoppen, bis die Config steht:

```bash
sudo systemctl stop dnsmasq
sudo systemctl stop hostapd
```

## 2. Statische IP für den Access Point (`wlan0`)

Auf Raspberry Pi OS (Bookworm) wird das Netzwerk über **NetworkManager**
verwaltet. Der interne Chip bekommt eine feste IP; der USB-Stick holt sich per
DHCP eine Adresse aus dem Café-WLAN.

`wlan0` als reines AP-Interface mit fester IP – Datei
`/etc/dhcpcd.conf` (falls dhcpcd genutzt wird) bzw. via NetworkManager.

**Variante dhcpcd** (`/etc/dhcpcd.conf` ergänzen):

```conf
interface wlan0
    static ip_address=192.168.4.1/24
    nohook wpa_supplicant
```

> Prüfe mit `systemctl status dhcpcd` bzw. `systemctl status NetworkManager`,
> welcher Dienst aktiv ist, und nutze die passende Variante. Bei
> NetworkManager stattdessen eine AP-Verbindung anlegen (siehe Abschnitt 6).

## 3. DHCP + DNS im Kiosk-Netz (`dnsmasq`)

Original sichern und neu schreiben:

```bash
sudo mv /etc/dnsmasq.conf /etc/dnsmasq.conf.orig
```

`/etc/dnsmasq.conf`:

```conf
interface=wlan0                 # nur auf dem AP-Interface lauschen
bind-interfaces
domain-needed
bogus-priv

# DHCP-Range fürs Kiosk-Netz
dhcp-range=192.168.4.10,192.168.4.100,255.255.255.0,24h

# Fester Hostname -> Pi
address=/herzlich.local/192.168.4.1
```

Damit erreichen die Kiosk-Browser die App unter `http://herzlich.local:3000`
(oder direkt `http://192.168.4.1:3000`).

## 4. Access Point konfigurieren (`hostapd`)

`/etc/hostapd/hostapd.conf`:

```conf
interface=wlan0
driver=nl80211
ssid=CafeHerzlich
hw_mode=g
channel=7
wmm_enabled=1
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=BITTE_SICHERES_PASSWORT
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
```

- `ssid` / `wpa_passphrase` anpassen.
- `channel`: 2,4-GHz-Kanal (1, 6 oder 11 sind interferenzarm). Wenn der
  USB-Stick auf 2,4 GHz mit dem Café-WLAN verbunden ist, möglichst **denselben
  Kanal** wählen wie das Café-WLAN, sonst muss das Radio springen. Am
  entspanntesten: Café-WLAN auf 2,4 GHz nutzen und den USB-Stick auf 5 GHz –
  oder umgekehrt.

Verweis auf die Config setzen in `/etc/default/hostapd`:

```conf
DAEMON_CONF="/etc/hostapd/hostapd.conf"
```

## 5. USB-Stick ans Café-WLAN (`wlan1`)

`wlan1` als Client ins bestehende Café-WLAN einbuchen.

**Variante wpa_supplicant** – `/etc/wpa_supplicant/wpa_supplicant-wlan1.conf`:

```conf
country=DE
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1

network={
    ssid="CAFE_WLAN_SSID"
    psk="CAFE_WLAN_PASSWORT"
}
```

Dienst für genau dieses Interface aktivieren:

```bash
sudo systemctl enable wpa_supplicant@wlan1
sudo systemctl start wpa_supplicant@wlan1
```

`wlan1` holt sich per DHCP eine Adresse vom Café-Router und hat damit Internet.

> **NetworkManager-Variante (Bookworm-Standard):**
> ```bash
> sudo nmcli device wifi connect "CAFE_WLAN_SSID" password "CAFE_WLAN_PASSWORT" ifname wlan1
> ```

## 6. Wichtig: keine Verbindung zwischen den Netzen

Standardmäßig kein IP-Forwarding aktivieren – dann kommt aus dem Kiosk-Netz
nichts ins Internet. Sicherstellen, dass Forwarding **aus** ist:

```bash
# /etc/sysctl.conf: die folgende Zeile muss auskommentiert / 0 sein
# net.ipv4.ip_forward=1   -> NICHT setzen
sudo sysctl net.ipv4.ip_forward=0
```

Damit ist die Trennung erledigt: `wlan0`-Geräte sehen nur den Pi.

## 7. Interface-Namen fixieren (empfohlen)

Damit interner Chip und USB-Stick nach jedem Reboot dieselben Namen behalten,
eine udev-Regel anhand der MAC-Adresse anlegen. MACs auslesen:

```bash
ip link show    # MAC unter "link/ether" je Interface
```

`/etc/udev/rules.d/72-wlan-names.rules`:

```
SUBSYSTEM=="net", ACTION=="add", ATTR{address}=="AA:BB:CC:DD:EE:F0", NAME="wlan0"
SUBSYSTEM=="net", ACTION=="add", ATTR{address}=="AA:BB:CC:DD:EE:F1", NAME="wlan1"
```

(MACs durch die echten ersetzen: interner Chip → `wlan0`, USB-Stick → `wlan1`.)

## 8. Starten & testen

```bash
sudo systemctl start hostapd
sudo systemctl start dnsmasq
sudo reboot
```

Nach dem Reboot prüfen:

```bash
iw dev                       # wlan0 im Typ AP, wlan1 als managed/Client
ip addr show wlan0           # 192.168.4.1
ip addr show wlan1           # DHCP-Adresse aus dem Café-Netz
ping -c2 -I wlan1 github.com # Internet über den USB-Stick?
```

Ein Kiosk-Gerät ins WLAN `CafeHerzlich` einwählen und
`http://herzlich.local:3000` öffnen.

---

## 9. Auto-Update von GitHub (systemd-Timer)

Der Pi zieht regelmäßig Änderungen, baut neu und lädt den laufenden Prozess
über pm2 neu – **nur zu Randzeiten**, damit nie mitten im Betrieb neugestartet
wird.

### Update-Skript `/opt/cafeherzlich/update.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/pi/cafeHerzlich26"   # anpassen
BRANCH="main"

cd "$APP_DIR"

# Nur weitermachen, wenn es wirklich neue Commits gibt
git fetch origin "$BRANCH"
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "$(date -Is) keine Änderungen"
    exit 0
fi

echo "$(date -Is) Update $LOCAL -> $REMOTE"
git reset --hard "origin/$BRANCH"

npm ci
npm run db:migrate
npm run build

pm2 reload cafeherzlich   # pm2-Prozessname anpassen
echo "$(date -Is) Update fertig"
```

Ausführbar machen:

```bash
sudo chmod +x /opt/cafeherzlich/update.sh
```

### systemd-Service `/etc/systemd/system/cafeherzlich-update.service`

```ini
[Unit]
Description=Cafe Herzlich Auto-Update von GitHub
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=pi
ExecStart=/opt/cafeherzlich/update.sh
```

### systemd-Timer `/etc/systemd/system/cafeherzlich-update.timer`

Läuft z. B. täglich um 04:00 Uhr (außerhalb der Öffnungszeiten):

```ini
[Unit]
Description=Taeglicher Cafe-Herzlich-Update-Check

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Aktivieren:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cafeherzlich-update.timer
systemctl list-timers | grep cafeherzlich   # nächste Ausführung prüfen
```

Manuell testen:

```bash
sudo systemctl start cafeherzlich-update.service
journalctl -u cafeherzlich-update.service -n 50 --no-pager
```

---

## Troubleshooting

- **`wlan0` startet nicht als AP:** `sudo systemctl status hostapd`,
  `journalctl -u hostapd`. Häufig: `rfkill list` → `sudo rfkill unblock wlan`.
- **Kiosk-Gerät bekommt keine IP:** `dnsmasq` läuft? Auf richtigem Interface?
  `journalctl -u dnsmasq`.
- **Kein Internet auf `wlan1`:** `iwconfig wlan1` / `nmcli device status`,
  Café-WLAN-Passwort korrekt, Signalstärke am Pi-Standort messen.
- **Namen vertauscht nach Reboot:** udev-Regel aus Abschnitt 7 setzen.
- **Update läuft, App startet nicht neu:** pm2-Prozessname im Skript prüfen
  (`pm2 list`).
