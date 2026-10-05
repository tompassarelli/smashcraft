# Click and OCR-wait primitives for the private-desktop Warcraft clients a and b.
# Session-bound values to re-resolve before use: window IDs, displays, store paths.
import os,sys,time,subprocess,re
from pathlib import Path
client=sys.argv[1];op=sys.argv[2];args=sys.argv[3:]
runs={"a":"/run/user/1000/private-desktop.ua70lDgf","b":"/run/user/1000/private-desktop.DIasYMFK"}
env=dict(os.environ,DISPLAY=":2" if client=="a" else ":1",XAUTHORITY="")
xd="/nix/store/sappapmdp66dl0h5fqp1yw32121r2b5j-xdotool-3.20211022.1/bin/xdotool"
if op in {"click","double"}:
 subprocess.run(["/nix/store/ci70n3x298zfp6r04hx0xaxiwz8akxin-wlrctl-0.2.2/bin/wlrctl", "toplevel", "focus", "title:Warcraft III"],env=dict(os.environ,XDG_RUNTIME_DIR=runs[client]+"/runtime",WAYLAND_DISPLAY="wayland-0"),check=True)
 subprocess.run([xd,"windowactivate","--sync","77594625" if client=="a" else "77594625","windowraise","77594625" if client=="a" else "77594625"],env=env,check=True)
 pos=subprocess.check_output([xd,"getmouselocation","--shell"],env=env,text=True)
 p=dict(line.split("=",1) for line in pos.splitlines());x,y=map(int,args)
 subprocess.run([xd,"mousemove_relative","--",str(x-int(p["X"])),str(y-int(p["Y"]))],env=env,check=True)
 actual=subprocess.check_output([xd,"getmouselocation","--shell"],env=env,text=True)
 point=dict(line.split("=",1) for line in actual.splitlines())
 if int(point["X"])!=x or int(point["Y"])!=y: raise RuntimeError("pointer did not reach target")
 # XTEST confirms Xwayland's cursor, but Warcraft consumes relative motion
 # later. No native cursor-processed signal is exposed here; use this bounded
 # settling fallback before sending the button edge.
 time.sleep(.12)
 for click_index in range(2 if op=="double" else 1):
  subprocess.run([xd,"mousedown","1"],env=env,check=True)
  time.sleep(.1)
  subprocess.run([xd,"mouseup","1"],env=env,check=True)
  if op=="double":time.sleep(.1)
 print(client,"clicked",x,y,flush=True)
elif op=="wait":
 pat=args[0];end=time.monotonic()+25
 image=Path("/tmp/sc-ui-"+client+".png");mask=Path("/tmp/sc-ui-"+client+"-gold.png")
 while time.monotonic()<end:
  subprocess.run(["/home/tom/code/nixos-config/main/dotfiles/agents/skills/private-desktop-development-distilled/scripts/private-desktop.sh","capture",runs[client],str(image)],check=True,stdout=subprocess.DEVNULL)
  subprocess.run(["/nix/store/h96xb48dvbk486n7ici59h7jjdxamsz0-imagemagick-7.1.2-30/bin/magick",str(image),"-fx","(r>0.667&&g>0.588)?0:1",str(mask)],check=True)
  text=subprocess.check_output(["/nix/store/3q7wcadbgh2mhdybxz77567km4sa13qh-tesseract-5.5.2/bin/tesseract",str(image),"stdout"],stderr=subprocess.DEVNULL,text=True)+"\n"+subprocess.check_output(["/nix/store/3q7wcadbgh2mhdybxz77567km4sa13qh-tesseract-5.5.2/bin/tesseract",str(mask),"stdout"],stderr=subprocess.DEVNULL,text=True)
  if re.search(pat,' '.join(text.split()),re.I) or re.search(pat,text,re.I):print(text[-2500:],flush=True);break
 else: print("WAIT EXPIRED last OCR\n"+text[-2500:],flush=True);sys.exit(2)
