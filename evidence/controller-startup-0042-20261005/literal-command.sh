private_run=/run/user/1000/private-desktop.ua70lDgf
private_display=$(cat "$private_run/display")
private_xauthority=$(cat "$private_run/xauthority")
private_wayland=$(cat "$private_run/wayland-display")
env XDG_RUNTIME_DIR="$private_run/runtime" WAYLAND_DISPLAY="$private_wayland" \
  DISPLAY="$private_display" XAUTHORITY="$private_xauthority" \
  ~/.local/share/smashcraft-build-inputs/input-integrity-delivery-20261005/build/wc3-journal-0.0.42 \
  --follow-matches --build playable-0042 --slot 0 \
  --device /dev/input/event2 --out '/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData' \
  --editbox-display "$private_display" --x11-window 77594625 --pid 1520922 \
  --private-wlr-app-id steam_app_3516115571
