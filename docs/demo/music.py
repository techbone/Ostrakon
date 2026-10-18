"""Original, deterministic instrumental score and voice-first stereo mix.

All tones and percussion are synthesized here; no recordings or sampled songs.
This production tool is covered by the repository's MIT license.
"""
from __future__ import annotations

import json
import wave

import numpy as np

SR = 48000
BPM = 80
SEED = 3520054


def read_mono(path):
    with wave.open(str(path), "rb") as f:
        if f.getsampwidth() != 2:
            raise ValueError("Narration must be 16-bit PCM WAV")
        rate, channels = f.getframerate(), f.getnchannels()
        signal = np.frombuffer(f.readframes(f.getnframes()), dtype="<i2").astype(np.float32) / 32768
    signal = signal.reshape(-1, channels).mean(axis=1)
    if rate != SR:
        target = round(len(signal) * SR / rate)
        signal = np.interp(np.arange(target) * rate / SR, np.arange(len(signal)), signal).astype(np.float32)
    return signal


def write_wav(path, signal):
    with wave.open(str(path), "wb") as f:
        f.setnchannels(1 if signal.ndim == 1 else signal.shape[1])
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((np.clip(signal, -1, 1) * 32767).astype("<i2").tobytes())


def db(signal):
    return float(20 * np.log10(max(1e-9, np.sqrt(np.mean(np.square(signal, dtype=np.float64))))))


def original_score(seconds):
    rng = np.random.default_rng(SEED)
    count = round(seconds * SR)
    score = np.zeros((count, 2), dtype=np.float32)
    beat = 60 / BPM
    bar = 4 * beat

    def place(at, value, level, pan=0.0):
        start = round(at * SR)
        if start < 0 or start >= count:
            return
        value = value[:count-start] * level
        score[start:start+len(value), 0] += value * np.sqrt((1-pan)/2)
        score[start:start+len(value), 1] += value * np.sqrt((1+pan)/2)

    def tone(midi, duration, kind):
        t = np.arange(round(duration*SR), dtype=np.float32)/SR
        hz = 440 * 2 ** ((midi-69)/12)
        if kind == "keys":
            envelope = (1-np.exp(-t/0.018)) * np.exp(-t/1.0)
            value = (np.sin(2*np.pi*hz*t + 0.16*np.sin(2*np.pi*hz*2*t))
                     + 0.12*np.sin(2*np.pi*hz*2*t)) * envelope
        elif kind == "pad":
            envelope = np.minimum(1,t/0.65) * np.minimum(1,(duration-t)/0.9)
            value = (np.sin(2*np.pi*hz*t) + 0.28*np.sin(2*np.pi*hz*1.0018*t)
                     + 0.08*np.sin(2*np.pi*hz*2*t)) * envelope
        else:
            envelope = np.minimum(1,t/0.035) * np.exp(-t/0.38)
            value = np.sin(2*np.pi*hz*t) * envelope
        return value.astype(np.float32)

    # Dm9 / Bbmaj9 / Fmaj9 / Cadd9: restrained, warm voicings.
    chords = [[50,57,60,64,65], [46,53,57,60,62], [41,53,57,60,64], [48,55,60,62,64]]
    for b in range(int(np.ceil(seconds/bar))):
        start = b*bar
        chord = chords[(b//2)%len(chords)]
        for j, midi in enumerate(chord[1:]):
            place(start+0.025*j, tone(midi, bar+0.7, "pad"), 0.045, (j-1.5)*0.28)
            place(start+0.035*j, tone(midi+12, 2.1, "keys"), 0.035, (j-1.5)*0.3)
        place(start, tone(chord[0], 1.5, "bass"), 0.09)
        place(start+2.5*beat, tone(chord[0]+12, 1.0, "keys"), 0.025, -0.1)
        # Sparse upper notes enter after the opening; no foreground melody.
        if b > 1 and b%2 == 0:
            place(start+1.5*beat, tone(chord[3]+12, 1.4, "keys"), 0.025, 0.35)
        for step in (0, 2):
            t=np.arange(round(0.24*SR),dtype=np.float32)/SR
            phase=2*np.pi*(45*t + 50*0.022*(1-np.exp(-t/0.022)))
            kick=np.sin(phase)*np.exp(-t/0.075)*np.minimum(1,t/0.003)
            place(start+step*beat, kick, 0.16)
        for step in (1, 3):
            t=np.arange(round(0.10*SR),dtype=np.float32)/SR
            noise=rng.normal(size=len(t)).astype(np.float32)
            rim=(0.65*np.sin(2*np.pi*1350*t)+0.15*noise)*np.exp(-t/0.015)*np.minimum(1,t/0.002)
            place(start+step*beat, rim, 0.035, 0.14)
        for eighth in (1, 3, 5, 7):
            t=np.arange(round(0.055*SR),dtype=np.float32)/SR
            noise=rng.normal(size=len(t)).astype(np.float32)
            high=np.concatenate(([0],np.diff(noise))).astype(np.float32)
            hat=high*np.exp(-t/0.009)*np.minimum(1,t/0.001)
            place(start+eighth*beat/2, hat, 0.009, (-1 if eighth%4==1 else 1)*0.28)

    # A quiet master with no borrowed sample or externally sourced track.
    score *= np.float32(0.052 / max(1e-9,np.sqrt(np.mean(score*score))))
    t=np.arange(count,dtype=np.float32)/SR
    fade=np.minimum(1,t/2.0)*np.minimum(1,(seconds-t)/3.0)
    score *= fade[:,None]
    return score


def build_soundtrack(plan, out):
    count=round(plan["duration"]*SR)
    narration=np.zeros(count,dtype=np.float32)
    for scene in plan["scenes"]:
        signal=read_mono(scene["audio"])
        start=round((scene["start"]+scene["audioOffset"])*SR)
        if start+len(signal)>count:
            raise ValueError(f"Narration extends beyond the cut: {scene['id']}")
        narration[start:start+len(signal)] += signal

    music=original_score(plan["duration"])
    # Actual voice energy drives a 10ms envelope, with look-ahead and a slow release.
    hop=SR//100
    blocks=int(np.ceil(count/hop))
    padded=np.pad(narration,(0,blocks*hop-count)).reshape(blocks,hop)
    rms=np.sqrt(np.mean(padded*padded,axis=1))
    speech=rms>0.009
    lookahead=np.maximum(speech,np.concatenate((speech[1:], [False])))
    gain=np.empty(blocks,dtype=np.float32)
    current=1.0
    for i, active in enumerate(lookahead):
        target=0.38 if active else 1.0
        smoothing=0.45 if target<current else 0.025
        current += smoothing*(target-current)
        gain[i]=current
    envelope=np.interp(np.arange(count),np.arange(blocks)*hop,gain).astype(np.float32)
    ducked=music*envelope[:,None]
    mixed=narration[:,None]+ducked
    peak=float(np.max(np.abs(mixed)))
    normalization=min(1,0.94/max(1e-9,peak))
    mixed*=normalization
    write_wav(out/"original-music.wav",music)
    write_wav(out/"narration-with-pauses.wav",narration)
    write_wav(out/"mixdown.wav",mixed)
    active=np.repeat(speech,hop)[:count]
    silent=np.abs(narration)<1e-5
    stats={"title":"Fieldnotes No. 1", "composer":"techbone / Ostrakon procedural score",
           "source":"Original synthesized keys, pads and percussion; no sampled recordings",
           "bpm":BPM,"sampleRate":SR,"channels":2,"seed":SEED,
           "musicRmsDbfs":round(db(music),2),
           "musicDuringSpeechDbfs":round(db(ducked[active]),2),
           "narrationDuringSpeechDbfs":round(db(narration[active]),2),
           "mixedPeakDbfs":round(20*np.log10(max(1e-9,float(np.max(np.abs(mixed))))),2),
           "narrationSilentSeconds":round(float(np.mean(silent)*plan['duration']),2),
           "musicPresentDuringPauseSamples":int(np.count_nonzero(np.abs(mixed[silent])>0.001))}
    (out/"mix-stats.json").write_text(json.dumps(stats,indent=2)+"\n")
    return str(out/"mixdown.wav"),stats
