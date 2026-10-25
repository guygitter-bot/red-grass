#!/bin/sh
# אפקטים קוליים פשוטים שנוצרים עם ffmpeg (בלי שירות חיצוני): sh ads/sfx.sh ads/<שם>/audio
set -e
O="$1"; mkdir -p "$O"
m() { [ -f "$O/$1.mp3" ] || ffmpeg -v error -y -f lavfi -i "$2" ${3:+-af "$3"} -c:a libmp3lame -q:a 3 "$O/$1.mp3"; }
m whoosh "anoisesrc=d=0.55:c=pink:a=0.9" "bandpass=f=1400:w=1600,afade=t=in:d=0.3:curve=exp,afade=t=out:st=0.3:d=0.25,volume=2.2"
m pop "aevalsrc='0.8*sin(2*PI*(250*t+5000*t*t))*exp(-22*t)':d=0.22"
m stamp "aevalsrc='0.95*sin(2*PI*(110*t-60*t*t))*exp(-7*t)+0.5*(random(0)*2-1)*exp(-45*t)':d=0.7" "lowpass=f=2500"
m crunch "aevalsrc='(random(0)*2-1)*exp(-35*mod(t,0.065))*lt(t,0.4)*0.9':d=0.45" "highpass=f=900,lowpass=f=7000"
m tick "aevalsrc='0.6*(random(0)*2-1)*exp(-500*mod(t,0.1))*lt(t,1.1)+gte(t,1.1)*0.5*(sin(2*PI*1568*t)+0.5*sin(2*PI*3136*t))*exp(-4*(t-1.1))':d=2.2" "highpass=f=300"
m sparkle "aevalsrc='0.25*(sin(2*PI*2637*t)*gt(mod(t,0.24),0)*exp(-9*mod(t,0.12))+sin(2*PI*3520*t)*exp(-9*mod(t+0.06,0.12)))*exp(-2.2*t)':d=1.1"
m sizzle "anoisesrc=d=1.6:c=white:a=0.5" "highpass=f=2500,tremolo=f=14:d=0.7,afade=t=in:d=0.2,afade=t=out:st=1.1:d=0.5,volume=0.6"
