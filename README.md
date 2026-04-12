# Guitar Hero MIDI Practice

A Guitar Hero 3–style falling-notes practice application for learning piano. Load any standard MIDI file, watch the notes descend from the top of the screen to a hit line at the bottom, and play along on your MIDI keyboard. Get real-time feedback on your timing — perfect, good, early, late, or miss — with visual icons and scoring.

No server, no installation, no dependencies. Just open `guitar_hero.html` in a modern browser.

## Features

- **MIDI File Loading** — Parse and display any standard MIDI file (format 0 or 1)
- **Guitar Hero–Style Falling Notes** — Notes scroll down the screen in time with the music, aligned to a piano keyboard at the bottom
- **Practice Mode (Step Sequencer)** — Play at your own pace: notes freeze in place and advance only when you play the correct key(s), removing time pressure so you can learn the progression
- **Reading Mode (Sheet Music Only)** — Expanded sheet music notation without falling notes; designed for sight-reading practice and integrating formal music theory
- **Chord Analysis** — Real-time identification of chords you play (name, type, notes, and a music theory description of purpose and character)
- **Countdown** — A beat countdown (matching your time signature) plays before the song starts so you can prepare
- **Metronome** — Optional click track during playback, with accented downbeats; toggle it on or off as you prefer
- **Customizable Time Signature** — Set any time signature (e.g. 3/4, 6/8, 5/4); defaults to the MIDI file's own time signature and is used for the metronome pattern and countdown
- **MIDI Keyboard Input** — Connect any USB MIDI keyboard via the Web MIDI API for automatic note detection
- **Computer Keyboard Fallback** — Use keys `A`–`L` (white keys) and `W`, `E`, `T`, `Y`, `U`, `O` (black keys) around middle C
- **Timing Feedback** — Visual popups above each key: ⭐ Perfect, ✓ Good, Early, Late, ✗ Wrong, Miss
- **Timeline Scrubber** — Visual minimap of note density across the entire song; click or drag to jump to any section in either mode
- **Reaction Time Tracking** — In Practice mode, tracks the time between completing one step and hitting the next; displays last, best, and average reaction times
- **Scoring & Combo** — Earn points based on timing accuracy; track consecutive correct hits
- **BPM Adjustment** — Slider (20–300 BPM) to slow down or speed up the song for practice and warm-up
- **Octave Shift** — Shift all notes up or down by octave to fit your keyboard's range; useful when your keyboard has fewer keys than the song requires
- **Note Remap** — Shift individual notes to a different octave (e.g. move all B1 notes to B2) while leaving other notes unchanged; useful when specific notes fall outside your keyboard's range
- **Sheet Music Display** — Toggle a side panel showing standard music notation (grand staff with treble and bass clefs); the current notes the player should press are highlighted in cyan with a glow effect
- **A-B Loop** — Set loop start (A) and end (B) points on the timeline so a section repeats automatically; right-click the timeline to place markers, or use the A/B buttons
- **Microphone Input (Acoustic Piano)** — Enable microphone pitch detection to play an acoustic piano without a MIDI keyboard; includes a calibration flow for tuning accuracy
- **Audio Playback** — Toggle synthesized note sounds on correct hits so you can hear what you're playing; adjustable volume
- **Settings Persistence** — All preferences (BPM, mode, metronome, time signature, sound, sheet music) are saved to localStorage and restored on next visit
- **Song Library** — Tracks every song you play with high scores, best combos, accuracy, play count, and total practice time
- **Statistics Dashboard** — View overall practice stats: total songs, sessions, practice time, average accuracy, all-time high score
- **Keyboard Shortcuts** — `Space` for Start/Pause, `Escape` for Stop or close overlays
- **PWA Support** — Installable as a standalone app with offline caching via service worker
- **Training Center** — Interactive learning hub with five modes: Ear Training (Notes), Ear Training (Chords), Arpeggios & Runs, Chord Training, and Music Theory Lessons, each with difficulty levels
- **Dark Neon Theme** — Inspired by Guitar Hero with color-coded notes by pitch
- **Zero Dependencies** — Custom JavaScript MIDI parser, no external libraries required

## Quick Start

1. Open `guitar_hero.html` in Chrome, Edge, or Firefox
2. Click **Load MIDI** and select a `.mid` file from your computer
3. Choose a mode: **Normal** (timed) or **Practice** (step sequencer)
4. (Optional) Adjust the **BPM** slider, enable the **Metronome**, or change the **Time Signature**
5. Press **Start** — a countdown plays, then notes begin
6. Play the notes on your MIDI keyboard (or computer keyboard) as they reach the cyan hit line

## Controls

| Control | Description |
|---------|-------------|
| **Load MIDI** | Select a `.mid` / `.midi` file to load |
| **Start** | Begin playback (enabled after loading a file) |
| **Pause / Resume** | Pause or resume the falling notes |
| **Stop** | Stop playback and reset |
| **Mode** | **Normal** — timed falling notes; **Practice** — step sequencer (no time pressure); **Reading** — sheet-music-only mode for sight-reading |
| **BPM Slider** (20–300) | Adjust tempo; defaults to the MIDI file's original tempo (Normal mode only) |
| **Metronome** | Checkbox to enable/disable the click track during playback |
| **Time Sig** | Set the time signature (numerator / denominator) for the metronome and countdown |
| **Timeline** | Note-density minimap; click/drag to seek to any point in the song |
| **Octave ▼ / ▲** | Shift all notes down or up by one octave to fit your keyboard range |
| **Note Remap** | Open a panel to remap individual notes to different octaves (e.g. B1 → B2) |
| **Sheet Music** | Checkbox to show/hide the sheet music notation panel on the left side |
| **Sound** | Checkbox to enable synthesized note sounds; volume slider adjusts level |
| **🎤 Mic** | Toggle microphone input for acoustic piano |
| **Calibrate** | Open calibration panel to tune mic pitch detection (play a reference note) |
| **A / B / ✕** | Set loop start (A), end (B), or clear loop points on the timeline |
| **📚 Library** | Open the Song Library panel to view play history for all practiced songs |
| **📊 Stats** | Open the Statistics Dashboard showing overall practice metrics |
| **🎓 Training** | Open the Training Center for ear training, arpeggios, chord practice, and music theory lessons |
| **Score** | Points earned based on timing accuracy |
| **Combo** | Consecutive correct hits |
| **MIDI Status** | Shows connected MIDI keyboard name or "No device" |
| **Mic Status** | Shows microphone status when enabled |
| <kbd>Space</kbd> | Start or Pause playback |
| <kbd>Escape</kbd> | Stop playback or close the current overlay panel |

## Practice Mode (Step Sequencer)

In Practice mode the song doesn't scroll with time — instead it works like a step sequencer:

1. The current note (or chord) sits highlighted on the hit line
2. Upcoming notes are visible above, so you can see what's next
3. Play the correct note on your keyboard → the display advances to the next note
4. If the current step is a chord, play all notes in the chord before it advances
5. Wrong notes show a ✗ feedback and reset your combo, but the position doesn't change

This lets you learn the progression of a song without any time pressure. When you're comfortable, switch to Normal mode and add the tempo back.

## Reading Mode (Sheet Music Only)

Reading mode focuses exclusively on traditional music notation for sight-reading practice:

1. Select **Reading** from the Mode dropdown
2. The sheet music panel expands to a wider view (480px) with the game canvas reduced alongside it
3. There are no falling notes — you read from the staff notation only
4. Notes advance step-by-step like Practice mode: play the correct note(s) to advance
5. The chord analysis panel (top-right of the game area) shows what chord you're playing in real time

This mode is designed for musicians transitioning to formal sight-reading. It forces you to engage with the notation rather than relying on the falling-note visual cues.

## Chord Analysis

Whenever you press two or more notes simultaneously, the app analyzes the chord and displays:

- **Chord name** (highlighted in cyan) — e.g. "Cmaj7", "Dm", "G7", "Bdim"
- **Chord type** (in amber) — Major, Minor, Diminished, Augmented, Dominant 7th, etc.
- **Notes played** — Individual note names (e.g. C4 · E4 · G4)
- **Description** — A brief music theory explanation of the chord's character and typical use cases

### Supported Chord Types

| Type | Example | Character |
|------|---------|-----------|
| Major | C | Bright, stable, resolved |
| Minor | Cm | Dark, introspective |
| Diminished | Bdim | Tense, passing chord |
| Augmented | Caug | Mysterious, dreamlike |
| Sus2 / Sus4 | Csus4 | Ambiguous, anticipatory |
| Major 7th | Cmaj7 | Lush, jazzy |
| Dominant 7th | G7 | Strong pull to resolve (V→I) |
| Minor 7th | Dm7 | Smooth, mellow |
| Half-Dim 7th | Bø7 | Jazz ii-V-i progressions |
| Diminished 7th | B°7 | Dramatic, symmetrical |
| Dominant 9th | G9 | Full, funky |
| Power Chord | E5 | Root + fifth, rock/metal |

The chord panel appears in the top-right of the game canvas and fades after a few seconds of silence.

## Timeline Scrubber

After loading a MIDI file, a timeline bar appears below the controls panel:

- **Note-density minimap** — Cyan bars show where notes are concentrated across the song, so you can visually identify sections (intro, verse, chorus, bridge, etc.)
- **Click to seek** — Click anywhere on the timeline to jump to that position
- **Drag to scrub** — Click and drag to quickly skim through the song
- **Position display** — Shows current time and total duration (e.g. `0:35 / 2:15`)
- **Works in both modes** — In Normal mode, seeking repositions playback; in Practice mode, it jumps to the nearest step group
- **Start from any point** — Set your position before pressing Start to begin from a specific section

## A-B Loop

Set a loop region to repeat a specific section automatically — like FL Studio's piano roll loop:

- **Set Loop A** — Click the **A** button on the timeline (or right-click the timeline) to mark the loop start
- **Set Loop B** — Click the **B** button (or right-click again) to mark the loop end
- **Clear** — Click **✕** to remove both loop points
- **Visual markers** — The loop region is highlighted in green on the timeline, with labeled A (green) and B (orange) markers
- **Right-click** — Right-click on the timeline for quick A/B placement; the first right-click sets A, the second sets B, the third resets
- **Auto-repeat** — When playback reaches point B, it automatically jumps back to point A
- **Works in both modes** — In Normal mode, the time-based playback loops; in Practice mode, when you complete the last step in the loop, it wraps to the first step in the loop
- **Auto-start** — If a loop is set when you press Start, playback begins from point A
- **Persists across start/stop** — Loop points are kept when you stop and restart; they only clear when you load a new file or click ✕

## Reaction Time Tracking

In Practice mode, the app measures and displays the time it takes you to move from one note to the next:

- **Last** — Reaction time for the most recent transition (in milliseconds)
- **Best** — Your fastest reaction time across all transitions in the current session
- **Avg** — Running average of all reaction times

This lets you track your technique progression as you practice. Over time, you should see your average decrease as your muscle memory improves. Reaction times reset when you stop or restart.

## Octave Shift

If your MIDI keyboard has fewer keys than the song requires, you can shift all notes up or down by octave:

- **▲ (Up)** — Shift all notes up one octave (+12 semitones)
- **▼ (Down)** — Shift all notes down one octave (−12 semitones)
- The display shows the current shift in octaves (e.g. `+1`, `-2`, `0`)
- Shifts are rejected if any note would go outside the valid MIDI range (0–127); the button has no effect in that case
- The keyboard display and note positions update immediately
- Resets to `0` when a new MIDI file is loaded
- Works in both Normal and Practice modes

## Note Remap

For finer control, you can remap individual notes to a different octave without affecting the rest of the song. This is useful when only certain notes fall outside your keyboard's range:

1. Load a MIDI file and click **Note Remap** in the controls bar
2. The **source** dropdown lists every distinct note found in the song
3. The **target** dropdown offers every octave of the same pitch class (e.g. for B1 you can choose B0, B2, B3, …)
4. Click **Add** to apply the remap — all instances of that note shift to the target
5. Active remaps are listed below with an **✕** button to revert individual ones
6. **Clear All** reverts every remap back to the original notes
7. Remaps reset when a new MIDI file is loaded
8. Remaps and global octave shift work together — the octave shift is applied first, then remaps

## Sheet Music Display

Toggle the **Sheet Music** checkbox to show a notation panel on the left side of the screen:

- **Grand staff** — Treble clef (𝄞) and bass clef (𝄢) with a connecting bracket
- **Note positions** — Each MIDI note is placed at the correct line/space on the staff, with ledger lines for notes above or below the staff
- **Accidentals** — Sharp (♯) symbols displayed next to notes that need them
- **Stems** — Stem direction follows standard convention (up for lower notes, down for higher notes)
- **Active note highlighting** — The note(s) the player should press next are highlighted in **cyan with a glow effect**, with a subtle column highlight behind them
- **Scrolling** — The staff scrolls to follow the current playback position or step group
- **Hit/miss coloring** — Notes that have been played correctly turn green; missed notes turn red
- **Works in both modes** — In Normal mode, notes near the hit line are highlighted; in Practice mode, the current step group is highlighted
- When hidden, the game canvas takes the full window width

## Metronome

The metronome provides an audible click track to help you keep time:

- **Toggle** — Use the **Metronome** checkbox to turn it on or off at any time
- **Accented downbeat** — Beat 1 of each measure plays a higher-pitched click
- **Time signature aware** — The click pattern follows the time signature you've set
- **Active during countdown** — The countdown clicks also follow the time signature
- Uses the Web Audio API to generate clean click sounds — no audio files needed

## Countdown

When you press **Start** in Normal mode, a beat countdown plays before the song begins:

- The number of countdown beats matches the **numerator** of the current time signature (e.g. 3 beats in 3/4, 4 beats in 4/4)
- Each beat pulses at the current BPM
- Click sounds play on each beat (accented on beat 1) regardless of the metronome toggle, so you always know when the song starts

## Input Methods

### MIDI Keyboard

Connect any USB MIDI keyboard. The app uses the [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) to detect note-on/off events automatically. Chrome and Edge support this natively; Firefox may require enabling `dom.webmidi.enabled` in `about:config`.

### Microphone (Acoustic Piano)

If you play an acoustic piano (or any instrument), you can use your computer's microphone for note detection:

1. Click **🎤 Mic** in the controls bar to enable the microphone (you'll be prompted for permission)
2. **(Recommended)** Click **Calibrate** to tune the pitch detector to your instrument:
   - Select a reference note (default: A4 / 440 Hz)
   - Play that note on your piano and hold it steady for about half a second
   - The detector measures the actual frequency and calculates a tuning offset
3. Play your piano — detected notes are fed into the game just like a MIDI keyboard

**Tips:**
- Works best in a quiet environment
- Hold notes clearly; short staccato may not be detected reliably
- Calibrate if you notice notes being detected one semitone off (e.g. your piano is slightly flat/sharp)
- The microphone and MIDI keyboard can be used simultaneously

### Computer Keyboard (Fallback)

If you don't have a MIDI keyboard, use your computer keyboard. The following keys are mapped to piano notes around middle C:

| Computer Key | Piano Note |
|-------------|-----------|
| A | C4 |
| W | C#4 |
| S | D4 |
| E | D#4 |
| D | E4 |
| F | F4 |
| T | F#4 |
| G | G4 |
| Y | G#4 |
| H | A4 |
| U | A#4 |
| J | B4 |
| K | C5 |
| O | C#5 |
| L | D5 |

## Timing & Scoring

| Grade | Timing Window | Points | Visual |
|-------|--------------|--------|--------|
| Perfect | ≤ 50 ms | 100 | ⭐ Perfect (gold) |
| Good | ≤ 100 ms | 50 | ✓ Good (green) |
| Early | ≤ 200 ms before | 25 | Early (amber) |
| Late | ≤ 200 ms after | 25 | Late (orange) |
| Wrong Key | — | 0 | ✗ (red) |
| Miss | Not pressed | 0 | Miss (red) |

Feedback popups appear above the key and fade out over ~600 ms. The combo counter resets on a miss or wrong key.

In Practice mode, timing grades don't apply — you simply get ✓ (correct) or ✗ (wrong) feedback.

## How It Works

1. **Load** — The custom MIDI parser reads the binary `.mid` file, extracting note events, timing (delta ticks), tempo changes, and time signature
2. **Process** — Note-on/off events are paired and converted to absolute milliseconds using the tempo map; notes that start at the same time are grouped into chords for Practice mode
3. **Display** — A full-screen HTML5 Canvas renders falling note rectangles (color-coded by pitch), a piano keyboard at the bottom, and a glowing cyan hit line
4. **Input** — The Web MIDI API, microphone pitch detection, or keyboard events detect which notes the player presses
5. **Judge** — In Normal mode, timing determines the grade; in Practice mode, only correctness matters and reaction time between steps is tracked
6. **Metronome** — Web Audio API oscillators generate click sounds on each beat, with an accent on beat 1
7. **Timeline** — A minimap canvas displays note density across the entire song; clicking seeks to any position
8. **Loop** — A-B markers on the timeline define a repeating section; playback wraps from B back to A automatically
9. **Persist** — Settings and song history are stored in localStorage so progress and preferences survive page refreshes

## Song Library

The app automatically tracks your practice history for every MIDI file you play:

- **Per-song tracking** — Each song is identified by a fingerprint based on its notes and duration
- **Metrics tracked** — Play count, high score, best combo, best accuracy, total practice time, first/last played dates
- **Session history** — The last 50 sessions per song are stored with detailed stats
- Click **📚 Library** to view your song history sorted by most recently played

## Statistics Dashboard

Click **📊 Stats** to see your overall practice metrics:

- **Songs Practiced** — Total unique songs you've played
- **Total Sessions** — How many times you've started a song
- **Practice Time** — Cumulative time spent practicing
- **Avg Best Accuracy** — Average of your best accuracy across all songs
- **All-Time High Score** — Your highest score ever
- **Last Session** — When you last practiced

## Audio Playback

Toggle the **Sound** checkbox to hear synthesized note sounds when you play correctly:

- Sine wave oscillators generate a tone for each correctly hit note
- Adjust the **volume slider** next to the toggle
- Helps you hear the melody as you play, even without speakers connected to your piano
- Works in both Normal and Practice modes

## Training Center

Click **🎓 Training** to open the interactive Training Center. Choose a skill level (Beginner, Intermediate, Advanced), then select a training mode:

### Ear Training: Single Notes

The program plays a random note; you identify it by pressing the matching key on your MIDI keyboard (or computer keyboard).

| Difficulty | Range | Description |
|-----------|-------|-------------|
| Easy | C4–B4 (1 octave) | One octave around middle C |
| Medium | C3–B4 (2 octaves) | Two octaves |
| Hard | C2–B5 (4 octaves) | Wide range across the keyboard |

- **Play** — Hear the target note
- **Replay** — Listen again as many times as you like
- **Reveal** — Show the answer without guessing
- After each guess (right or wrong), see the note's name, MIDI number, frequency, octave description, and musical context
- Streak counter tracks consecutive correct guesses

### Ear Training: Chords

The program plays a random chord; identify the chord type either by pressing the same notes on your keyboard or by clicking a chord-type button.

| Difficulty | Chord Types |
|-----------|-------------|
| Easy | Major, Minor, Diminished, Augmented, Sus4, Power |
| Medium | + Sus2, Maj7, Dom7, Min7 (10 types) |
| Hard | All 18 types including extended and altered chords |

- **Play Chord** — Hear all notes simultaneously
- **Arpeggiate** — Hear the notes one at a time
- **Reveal** — Show the answer
- After each guess, see the chord name (e.g. "Cmaj7"), type, notes, intervals, and a music theory description of when and why the chord is used

### Arpeggios & Runs

Practice common arpeggio patterns and scale runs interactively. The app shows the sequence of notes; play them in order:

| Difficulty | Patterns |
|-----------|----------|
| Easy | Major and Minor arpeggios, Major scale run |
| Medium | + Diminished, Augmented, Maj7, Dom7, Min7 arpeggios; Minor scale run, Thirds run |
| Hard | All patterns including Two-Octave arpeggios, Dim7, Chromatic run, Alberti bass |

- **Listen** — Hear the full pattern before attempting it
- **Restart** — Reset the current pattern to try again
- Notes highlight as you play them correctly; wrong notes show the expected note
- Patterns include arpeggios (major, minor, dim, aug, 7th chords, two-octave) and runs (scale runs, thirds, chromatic, Alberti bass)

### Chord Training

Learn chord shapes hands-on. The app displays a chord name, its notes, and a description; you must play all notes simultaneously:

| Difficulty | Chord Types |
|-----------|-------------|
| Easy | Major, Minor, Sus4, Power |
| Medium | + Diminished, Augmented, Sus2, Maj7, Dom7, Min7 |
| Hard | All 18 chord types |

- **Hear It** — Listen to the chord
- **Arpeggiate** — Hear notes individually
- Hold all notes at once to complete the chord
- Each chord shows its name, intervals, and a description of its character and use cases

### Music Theory Lessons

Interactive lessons that explain a music theory concept, then have you apply it on the keyboard:

| Skill Level | Topics |
|------------|--------|
| Beginner | Musical alphabet, half/whole steps, major scale, minor scale, intervals, major/minor triads |
| Intermediate | Seventh chords, ii-V-I progression, relative major/minor, circle of fifths, inversions, Dorian/Mixolydian modes |
| Advanced | Diminished/augmented chords, secondary dominants, harmonic minor, tritone substitution, altered dominants, modal interchange |

- Each lesson has a **concept explanation** followed by a **hands-on exercise**
- Exercises include: playing note sequences, scales, chords, chord progressions, and intervals
- Lessons are **randomized** within your selected skill level to keep practice fresh
- **Hear** buttons let you listen to scales and progressions before attempting them
- Visual feedback tracks your progress through each exercise

## File Structure

```
piano/
├── guitar_hero.html   # Main HTML page — open this in a browser
├── guitar_hero.js     # Game logic, MIDI parser, canvas rendering, pitch detection
├── guitar_hero.css    # Dark neon theme styles
├── training.js        # Training Center — ear training, arpeggios, chords, music theory
├── manifest.json      # PWA manifest for installability
├── sw.js              # Service worker for offline caching
└── README.md          # This file
```

## Browser Compatibility

| Browser | MIDI Keyboard Support | Computer Keyboard | Metronome Audio |
|---------|----------------------|-------------------|-----------------|
| Chrome / Edge | ✅ Full support | ✅ | ✅ |
| Firefox | ⚠️ Requires `dom.webmidi.enabled` | ✅ | ✅ |
| Safari | ❌ No Web MIDI API | ✅ | ✅ |

## License

MIT License — Feel free to use and modify as needed.
