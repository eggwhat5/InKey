/* === Guitar Hero MIDI Practice - Main Application === */

// ─── Settings Persistence ───────────────────────────────────────────────────────

class SettingsManager {
    static STORAGE_KEY = 'ghmp_settings';

    static defaults() {
        return {
            bpm: 120,
            mode: 'normal',
            metronome: false,
            sheetMusic: false,
            tsNumerator: 4,
            tsDenominator: 4,
            audioPlayback: false,
            audioVolume: 0.5
        };
    }

    static load() {
        try {
            const raw = localStorage.getItem(SettingsManager.STORAGE_KEY);
            if (!raw) return SettingsManager.defaults();
            return Object.assign(SettingsManager.defaults(), JSON.parse(raw));
        } catch {
            return SettingsManager.defaults();
        }
    }

    static save(settings) {
        try {
            localStorage.setItem(SettingsManager.STORAGE_KEY, JSON.stringify(settings));
        } catch { /* quota exceeded — silently ignore */ }
    }
}

// ─── Song Library & Progress Tracking ───────────────────────────────────────────

class SongLibrary {
    static STORAGE_KEY = 'ghmp_library';
    static STATS_KEY = 'ghmp_stats';

    static loadLibrary() {
        try {
            const raw = localStorage.getItem(SongLibrary.STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    static saveLibrary(lib) {
        try {
            localStorage.setItem(SongLibrary.STORAGE_KEY, JSON.stringify(lib));
        } catch { /* quota exceeded */ }
    }

    /** Generate a fingerprint for a song based on note count, first few notes, and duration */
    static songFingerprint(notes) {
        if (notes.length === 0) return 'empty';
        const first5 = notes.slice(0, 5).map(n => n.note + ':' + Math.round(n.startMs));
        const last = notes[notes.length - 1];
        const dur = Math.round(last.startMs + last.durationMs);
        return notes.length + '_' + dur + '_' + first5.join(',');
    }

    /** Record a play session for a song */
    static recordSession(fileName, fingerprint, score, maxCombo, totalNotes, accuracy, durationMs) {
        const lib = SongLibrary.loadLibrary();
        let entry = lib.find(e => e.fingerprint === fingerprint);
        if (!entry) {
            entry = {
                fileName,
                fingerprint,
                playCount: 0,
                highScore: 0,
                bestCombo: 0,
                bestAccuracy: 0,
                totalPracticeMs: 0,
                sessions: [],
                firstPlayed: new Date().toISOString()
            };
            lib.push(entry);
        }
        entry.playCount++;
        entry.highScore = Math.max(entry.highScore, score);
        entry.bestCombo = Math.max(entry.bestCombo, maxCombo);
        entry.bestAccuracy = Math.max(entry.bestAccuracy, accuracy);
        entry.totalPracticeMs += durationMs;
        entry.lastPlayed = new Date().toISOString();
        entry.fileName = fileName; // update in case renamed

        // Keep last 50 sessions
        entry.sessions.push({
            date: new Date().toISOString(),
            score,
            maxCombo,
            accuracy: Math.round(accuracy * 100) / 100,
            durationMs
        });
        if (entry.sessions.length > 50) entry.sessions = entry.sessions.slice(-50);

        SongLibrary.saveLibrary(lib);
        SongLibrary._updateGlobalStats(durationMs);
        return entry;
    }

    static _updateGlobalStats(sessionDurationMs) {
        const stats = SongLibrary.loadStats();
        stats.totalSessions++;
        stats.totalPracticeMs += sessionDurationMs;
        stats.lastSessionDate = new Date().toISOString();
        SongLibrary.saveStats(stats);
    }

    static loadStats() {
        try {
            const raw = localStorage.getItem(SongLibrary.STATS_KEY);
            return raw ? JSON.parse(raw) : {
                totalSessions: 0,
                totalPracticeMs: 0,
                lastSessionDate: null
            };
        } catch {
            return { totalSessions: 0, totalPracticeMs: 0, lastSessionDate: null };
        }
    }

    static saveStats(stats) {
        try {
            localStorage.setItem(SongLibrary.STATS_KEY, JSON.stringify(stats));
        } catch { /* quota exceeded */ }
    }
}

// ─── MIDI Parser ────────────────────────────────────────────────────────────────

class MidiParser {
    /**
     * Parse a standard MIDI file (format 0 or 1).
     * @param {ArrayBuffer} buffer
     * @returns {{ format: number, numTracks: number, ticksPerBeat: number, tracks: Array, tempoEvents: Array }}
     */
    static parse(buffer) {
        const data = new DataView(buffer);
        let offset = 0;

        // --- Header ---
        const headerTag = MidiParser._readString(data, offset, 4);
        if (headerTag !== 'MThd') throw new Error('Not a valid MIDI file');
        offset += 4;
        const headerLen = data.getUint32(offset);
        offset += 4;
        const format = data.getUint16(offset);
        offset += 2;
        const numTracks = data.getUint16(offset);
        offset += 2;
        const division = data.getUint16(offset);
        offset += 2;

        if (format > 1) throw new Error('MIDI format 2 is not supported');
        if (division & 0x8000) throw new Error('SMPTE time division is not supported');
        const ticksPerBeat = division;

        // Skip any remaining header bytes
        offset = 8 + headerLen;

        // --- Tracks ---
        const tracks = [];
        const tempoEvents = [];
        let timeSignature = null;
        for (let t = 0; t < numTracks; t++) {
            const trackTag = MidiParser._readString(data, offset, 4);
            if (trackTag !== 'MTrk') throw new Error('Expected MTrk at offset ' + offset);
            offset += 4;
            const trackLen = data.getUint32(offset);
            offset += 4;
            const trackEnd = offset + trackLen;
            const events = [];
            let runningStatus = 0;
            let tickPos = 0;

            while (offset < trackEnd) {
                const { value: delta, bytesRead } = MidiParser._readVarLen(data, offset);
                offset += bytesRead;
                tickPos += delta;

                let statusByte = data.getUint8(offset);

                // Meta event
                if (statusByte === 0xFF) {
                    offset++;
                    const metaType = data.getUint8(offset);
                    offset++;
                    const { value: metaLen, bytesRead: lb } = MidiParser._readVarLen(data, offset);
                    offset += lb;

                    if (metaType === 0x51 && metaLen === 3) {
                        // Tempo: 3 bytes = microseconds per quarter note
                        const uspqn = (data.getUint8(offset) << 16) |
                                      (data.getUint8(offset + 1) << 8) |
                                       data.getUint8(offset + 2);
                        tempoEvents.push({ tick: tickPos, uspqn });
                    }
                    if (metaType === 0x58 && metaLen === 4) {
                        // Time signature: numerator, denominator (as power of 2), clocks per click, 32nds per quarter
                        if (!timeSignature) {
                            timeSignature = {
                                numerator: data.getUint8(offset),
                                denominator: Math.pow(2, data.getUint8(offset + 1))
                            };
                        }
                    }
                    offset += metaLen;
                    continue;
                }

                // SysEx
                if (statusByte === 0xF0 || statusByte === 0xF7) {
                    offset++;
                    const { value: sysLen, bytesRead: lb } = MidiParser._readVarLen(data, offset);
                    offset += lb + sysLen;
                    continue;
                }

                // Channel event
                if (statusByte & 0x80) {
                    runningStatus = statusByte;
                    offset++;
                } else {
                    statusByte = runningStatus;
                }

                const eventType = statusByte & 0xF0;
                const channel = statusByte & 0x0F;

                if (eventType === 0x90 || eventType === 0x80) {
                    const note = data.getUint8(offset);
                    offset++;
                    const velocity = data.getUint8(offset);
                    offset++;
                    const isNoteOn = eventType === 0x90 && velocity > 0;
                    events.push({
                        tick: tickPos,
                        type: isNoteOn ? 'note_on' : 'note_off',
                        channel,
                        note,
                        velocity: isNoteOn ? velocity : 0
                    });
                } else if (eventType === 0xA0 || eventType === 0xB0 || eventType === 0xE0) {
                    offset += 2; // two data bytes
                } else if (eventType === 0xC0 || eventType === 0xD0) {
                    offset += 1; // one data byte
                } else {
                    offset++; // skip unknown
                }
            }

            offset = trackEnd;
            tracks.push(events);
        }

        // Default tempo if none specified
        if (tempoEvents.length === 0) {
            tempoEvents.push({ tick: 0, uspqn: 500000 }); // 120 BPM
        }
        tempoEvents.sort((a, b) => a.tick - b.tick);

        return { format, numTracks, ticksPerBeat, tracks, tempoEvents, timeSignature: timeSignature || { numerator: 4, denominator: 4 } };
    }

    static _readString(dataView, offset, length) {
        let s = '';
        for (let i = 0; i < length; i++) s += String.fromCharCode(dataView.getUint8(offset + i));
        return s;
    }

    static _readVarLen(dataView, offset) {
        let value = 0;
        let bytesRead = 0;
        let b;
        do {
            b = dataView.getUint8(offset + bytesRead);
            value = (value << 7) | (b & 0x7F);
            bytesRead++;
        } while (b & 0x80);
        return { value, bytesRead };
    }
}

// ─── Note Processing ────────────────────────────────────────────────────────────

class NoteProcessor {
    /**
     * Convert parsed MIDI data into an array of note objects with absolute times in ms.
     * @param {{ ticksPerBeat: number, tracks: Array, tempoEvents: Array }} midi
     * @returns {Array<{ note: number, startMs: number, durationMs: number, channel: number, velocity: number }>}
     */
    static buildNotes(midi) {
        // Merge all tracks
        const allEvents = [];
        for (const track of midi.tracks) {
            for (const ev of track) {
                allEvents.push(ev);
            }
        }
        // When events share a tick, process note_off before note_on to close notes cleanly
        allEvents.sort((a, b) => a.tick - b.tick ||
            (a.type === 'note_off' ? -1 : (b.type === 'note_off' ? 1 : 0)));

        // Build tempo map for tick->ms conversion
        const tempoMap = midi.tempoEvents.slice();

        function tickToMs(tick) {
            let ms = 0;
            let prevTick = 0;
            let uspqn = 500000; // default 120 BPM
            for (const te of tempoMap) {
                if (te.tick > tick) break;
                ms += ((te.tick - prevTick) / midi.ticksPerBeat) * (uspqn / 1000);
                prevTick = te.tick;
                uspqn = te.uspqn;
            }
            ms += ((tick - prevTick) / midi.ticksPerBeat) * (uspqn / 1000);
            return ms;
        }

        // Pair note_on / note_off
        const openNotes = {}; // key: "ch-note" -> [{tick, velocity}]
        const notes = [];

        for (const ev of allEvents) {
            const key = ev.channel + '-' + ev.note;
            if (ev.type === 'note_on') {
                if (!openNotes[key]) openNotes[key] = [];
                openNotes[key].push({ tick: ev.tick, velocity: ev.velocity });
            } else if (ev.type === 'note_off') {
                if (openNotes[key] && openNotes[key].length > 0) {
                    const on = openNotes[key].shift();
                    const startMs = tickToMs(on.tick);
                    const endMs = tickToMs(ev.tick);
                    notes.push({
                        note: ev.note,
                        startMs,
                        durationMs: Math.max(endMs - startMs, 20), // min 20ms so short notes remain visible
                        channel: ev.channel,
                        velocity: on.velocity
                    });
                }
            }
        }

        notes.sort((a, b) => a.startMs - b.startMs);
        return notes;
    }

    /** Get the original BPM from the first tempo event */
    static getInitialBPM(tempoEvents) {
        if (!tempoEvents || tempoEvents.length === 0) return 120;
        return Math.round(60000000 / tempoEvents[0].uspqn);
    }
}

// ─── Color Helpers ──────────────────────────────────────────────────────────────

const NOTE_COLORS = [
    '#ff3366', // C  - pink
    '#ff6633', // C# - orange-red
    '#ffaa00', // D  - amber
    '#ffdd00', // D# - yellow
    '#66ff33', // E  - green
    '#00ffaa', // F  - teal
    '#00ddff', // F# - cyan
    '#3399ff', // G  - blue
    '#6633ff', // G# - indigo
    '#aa33ff', // A  - violet
    '#ff33cc', // A# - magenta
    '#ff3399', // B  - hot pink
];

// NOTE_NAMES is defined in training.js (loaded first)

function noteColor(midiNote) {
    return NOTE_COLORS[midiNote % 12];
}

function noteName(midiNote) {
    return NOTE_NAMES[midiNote % 12] + (Math.floor(midiNote / 12) - 1);
}

function isBlackKey(midiNote) {
    const n = midiNote % 12;
    return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
}

// ─── Chord Analysis ─────────────────────────────────────────────────────────────

class ChordAnalyzer {
    // Interval patterns: sorted semitone offsets from root (excluding root itself)
    static CHORD_TYPES = [
        // Triads
        { intervals: [4, 7],        name: 'Major',       abbr: '',     desc: 'Bright, stable, and resolved. The foundation of tonal harmony — conveys happiness, strength, and resolution.' },
        { intervals: [3, 7],        name: 'Minor',       abbr: 'm',    desc: 'Darker and more introspective than major. Conveys sadness, tension, or contemplation.' },
        { intervals: [3, 6],        name: 'Diminished',  abbr: 'dim',  desc: 'Tense and unstable. Often used as a passing chord or to create suspense before resolution.' },
        { intervals: [4, 8],        name: 'Augmented',   abbr: 'aug',  desc: 'Mysterious and unresolved. Creates a dreamlike quality, often used for chromatic motion.' },
        // Suspended
        { intervals: [5, 7],        name: 'Sus4',        abbr: 'sus4', desc: 'Neither major nor minor — creates anticipation. Wants to resolve down to the 3rd.' },
        { intervals: [2, 7],        name: 'Sus2',        abbr: 'sus2', desc: 'Open and ambiguous. Common in pop and rock for a spacious, modern sound.' },
        // Sevenths
        { intervals: [4, 7, 11],    name: 'Major 7th',   abbr: 'maj7', desc: 'Lush and jazzy. Adds sophistication to major chords — common in jazz, R&B, and bossa nova.' },
        { intervals: [4, 7, 10],    name: 'Dominant 7th', abbr: '7',   desc: 'Creates strong pull toward resolution (V→I). The engine of blues, jazz, and rock progressions.' },
        { intervals: [3, 7, 10],    name: 'Minor 7th',   abbr: 'm7',   desc: 'Smooth and mellow. A staple of jazz, neo-soul, and R&B — less tense than plain minor.' },
        { intervals: [3, 6, 10],    name: 'Half-Dim 7th', abbr: 'ø7',  desc: 'Also called "minor 7 flat 5." Used in jazz ii-V-i progressions in minor keys.' },
        { intervals: [3, 6, 9],     name: 'Diminished 7th', abbr: '°7', desc: 'Symmetrical and highly unstable. Can resolve in multiple directions — a dramatic transition tool.' },
        { intervals: [4, 8, 11],    name: 'Aug Maj 7th', abbr: 'aug(maj7)', desc: 'Exotic and colorful. Rare but effective for chromatic voice leading.' },
        // Extended (common)
        { intervals: [4, 7, 10, 14], name: 'Dominant 9th', abbr: '9',  desc: 'Fuller version of the dominant 7th. Adds color and is common in funk, jazz, and soul.' },
        { intervals: [3, 7, 10, 14], name: 'Minor 9th',   abbr: 'm9',  desc: 'Rich and sophisticated. Extends the minor 7th with added warmth.' },
        // Power chord (no third)
        { intervals: [7],           name: 'Power Chord', abbr: '5',    desc: 'Neither major nor minor — just root and fifth. The backbone of rock and metal.' },
    ];

    /**
     * Analyze a set of MIDI note numbers and return chord information.
     * @param {number[]} midiNotes - Active MIDI note numbers
     * @returns {{ root: string, name: string, abbr: string, fullName: string, type: string, desc: string, notes: string[], intervals: number[] } | null}
     */
    static analyze(midiNotes) {
        if (!midiNotes || midiNotes.length < 2) return null;

        // Get unique pitch classes sorted
        const pitchClasses = [...new Set(midiNotes.map(n => n % 12))].sort((a, b) => a - b);
        if (pitchClasses.length < 2) return null;

        let bestMatch = null;
        let bestScore = -1;

        const lowestNotePc = Math.min(...midiNotes) % 12;

        // Try each pitch class as potential root
        for (const root of pitchClasses) {
            // Build intervals from this root
            const intervals = pitchClasses
                .filter(pc => pc !== root)
                .map(pc => (pc - root + 12) % 12)
                .sort((a, b) => a - b);

            // Compare against known chord types
            for (const ct of ChordAnalyzer.CHORD_TYPES) {
                if (intervals.length < ct.intervals.length) continue;

                // Check if all chord intervals are present in our intervals
                let matched = 0;
                for (const ci of ct.intervals) {
                    if (intervals.includes(ci)) matched++;
                }

                if (matched === ct.intervals.length) {
                    // Score: prefer more intervals matched, prefer root being the bass note
                    const bassBonus = (root === midiNotes[0] % 12 || root === lowestNotePc) ? 2 : 0;
                    const score = matched * 3 + bassBonus + ct.intervals.length;
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = { root, chordType: ct };
                    }
                }
            }
        }

        if (!bestMatch) return null;

        const { root, chordType } = bestMatch;
        const rootName = NOTE_NAMES[root];
        const noteNames = midiNotes.map(n => noteName(n)).sort();

        return {
            root: rootName,
            name: chordType.name,
            abbr: chordType.abbr,
            fullName: rootName + chordType.abbr,
            type: chordType.name,
            desc: chordType.desc,
            notes: noteNames,
            intervals: chordType.intervals
        };
    }

    /**
     * Describe a single note interval from the key root.
     * @param {number} semitones - Interval in semitones from root
     * @returns {string} Interval name (e.g. "minor 3rd", "perfect 5th")
     */
    static intervalName(semitones) {
        const NAMES = [
            'unison', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd',
            'perfect 4th', 'tritone', 'perfect 5th', 'minor 6th', 'major 6th',
            'minor 7th', 'major 7th'
        ];
        return NAMES[((semitones % 12) + 12) % 12] || '?';
    }
}

// ─── Keyboard Mapping (Computer keyboard fallback) ──────────────────────────────

const KEYBOARD_MAP = {
    'KeyA': 60,  // C4
    'KeyW': 61,  // C#4
    'KeyS': 62,  // D4
    'KeyE': 63,  // D#4
    'KeyD': 64,  // E4
    'KeyF': 65,  // F4
    'KeyT': 66,  // F#4
    'KeyG': 67,  // G4
    'KeyY': 68,  // G#4
    'KeyH': 69,  // A4
    'KeyU': 70,  // A#4
    'KeyJ': 71,  // B4
    'KeyK': 72,  // C5
    'KeyO': 73,  // C#5
    'KeyL': 74,  // D5
};

// ─── Feedback Popup ─────────────────────────────────────────────────────────────

class FeedbackPopup {
    constructor(text, x, y, color) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.createdAt = performance.now();
        this.lifetime = 600; // ms
    }

    get alpha() {
        const age = performance.now() - this.createdAt;
        if (age > this.lifetime) return 0;
        return 1 - (age / this.lifetime);
    }

    get alive() {
        return this.alpha > 0;
    }

    draw(ctx) {
        const a = this.alpha;
        if (a <= 0) return;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        // Drift upward
        const drift = (1 - a) * 30;
        ctx.fillText(this.text, this.x, this.y - drift);
        ctx.restore();
    }
}

// ─── Main Game ──────────────────────────────────────────────────────────────────

class GuitarHeroGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // UI elements
        this.fileInput = document.getElementById('midi-file');
        this.btnStart = document.getElementById('btn-start');
        this.btnPause = document.getElementById('btn-pause');
        this.btnStop = document.getElementById('btn-stop');
        this.bpmSlider = document.getElementById('bpm-slider');
        this.bpmDisplay = document.getElementById('bpm-display');
        this.scoreDisplay = document.getElementById('score-display');
        this.comboDisplay = document.getElementById('combo-display');
        this.midiStatusEl = document.getElementById('midi-status');
        this.noFileMsg = document.getElementById('no-file-message');
        this.modeSelect = document.getElementById('mode-select');
        this.bpmGroup = document.getElementById('bpm-group');

        // State
        this.notes = [];          // processed note objects
        this.midiData = null;     // raw parsed MIDI
        this.originalBPM = 120;
        this.bpm = 120;
        this.playing = false;
        this.paused = false;
        this.startTime = 0;       // performance.now() when play started
        this.pauseTime = 0;       // accumulated pause duration
        this.pauseStart = 0;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;

        // Practice (step sequencer) mode
        this.practiceMode = false;
        this.readingMode = false;     // sheet-music-only mode
        this.stepGroups = [];     // groups of note indices that share the same start time
        this.stepIndex = 0;       // current group index
        this.stepHits = new Set(); // note indices hit in current group

        // Chord analysis
        this.lastChord = null;        // last analyzed chord result
        this.lastChordTime = 0;       // when the chord was last detected

        // Countdown state
        this.countingDown = false;
        this.countdownStart = 0;
        this.countdownBeats = 4;  // beats in countdown (from time signature)
        this.countdownBeatMs = 500; // ms per countdown beat (from BPM)
        this.timeSignature = { numerator: 4, denominator: 4 };
        this.lastCountdownBeat = -1; // track which beat was last sounded

        // Metronome
        this.metronomeEnabled = false;
        this.audioCtx = null;    // created on first user interaction
        this.lastMetronomeBeat = -1; // track beat number to avoid double-clicks

        // Note range for keyboard display
        this.minNote = 21;  // A0
        this.maxNote = 108; // C8
        this.keyboardHeight = 80;
        this.hitLineY = 0;

        // Active keys (currently pressed)
        this.activeKeys = new Set();

        // Hit tracking per note index
        this.noteHits = new Map(); // index -> 'perfect'|'good'|'early'|'late'|'miss'

        // Feedback popups
        this.feedbacks = [];

        // MIDI input
        this.midiAccess = null;
        this.midiInputs = [];

        // Speed multiplier derived from BPM adjustment
        this.speedMultiplier = 1;

        // Octave shift — shifts all notes by this many semitones (multiples of 12)
        this.noteShift = 0;
        this.octaveShiftDisplay = document.getElementById('octave-shift-display');
        this.btnOctaveUp = document.getElementById('btn-octave-up');
        this.btnOctaveDown = document.getElementById('btn-octave-down');

        // Per-note remap — maps original MIDI note number → shifted note number
        this.noteRemaps = new Map();     // originalNote -> targetNote
        this.distinctNotes = [];         // sorted list of distinct note values in loaded file
        this.btnNoteRemap = document.getElementById('btn-note-remap');
        this.remapOverlay = document.getElementById('remap-overlay');
        this.remapSourceSel = document.getElementById('remap-source');
        this.remapTargetSel = document.getElementById('remap-target');
        this.remapListEl = document.getElementById('remap-list');

        // Sheet music panel
        this.sheetCanvas = document.getElementById('sheet-canvas');
        this.sheetCtx = this.sheetCanvas.getContext('2d');
        this.sheetVisible = false;

        // Timeline scrubber
        this.controlsPanel = document.getElementById('controls-panel');
        this.timelineCanvas = document.getElementById('timeline-canvas');
        this.timelineCtx = this.timelineCanvas.getContext('2d');
        this.timelinePanel = document.getElementById('timeline-panel');
        this.timelinePosEl = document.getElementById('timeline-pos');
        this.timelineDurEl = document.getElementById('timeline-dur');
        this.timelineStepEl = document.getElementById('timeline-step');
        this.songDurationMs = 0;       // total song length in original ms
        this.seekOffsetMs = 0;         // offset applied when user seeks (normal mode)
        this.timelineDragging = false;

        // Loop points (A-B repeat)
        this.loopStartMs = -1;         // -1 = no loop start set
        this.loopEndMs = -1;           // -1 = no loop end set

        // Reaction time tracking (practice mode)
        this.lastStepCompleteTime = 0;   // performance.now() when last step was completed
        this.lastReactionMs = 0;         // reaction time for last transition
        this.reactionTimes = [];         // all reaction times
        this.bestReactionMs = Infinity;
        this.avgReactionMs = 0;

        // Audio playback — synthesize MIDI notes as sound
        this.audioPlayback = false;
        this.audioVolume = 0.5;
        this.activeOscillators = new Map(); // midiNote -> { osc, gain }

        // Song library tracking
        this.currentFileName = '';
        this.currentFingerprint = '';
        this.sessionStartTime = 0;

        // Stats panel
        this.statsPanel = document.getElementById('stats-overlay');
        this.libraryPanel = document.getElementById('library-overlay');

        // Microphone input (acoustic piano)
        this.micEnabled = false;
        this.micStream = null;
        this.micSource = null;
        this.pitchDetector = null;
        this.micDetectionInterval = null;
        this.lastMicNote = -1;       // last detected note (debounce)
        this.micCalibrating = false;
        this.micCalibrationNote = 69; // A4 default calibration note
        this.micStatusEl = document.getElementById('mic-status');

        // Load persisted settings
        this._loadSettings();

        this._setupEvents();
        this._setupMIDI();
        this._resize();
        this._animate = this._animate.bind(this);
        requestAnimationFrame(this._animate);
    }

    // ── Settings Persistence ────────────────────────────────────────────────

    _loadSettings() {
        const s = SettingsManager.load();
        this.bpm = s.bpm;
        this.bpmSlider.value = s.bpm;
        this.bpmDisplay.textContent = s.bpm;
        this.practiceMode = s.mode === 'practice';
        this.readingMode = s.mode === 'reading';
        this.modeSelect.value = s.mode;
        this.bpmGroup.classList.toggle('hidden', this.practiceMode || this.readingMode);
        this.metronomeEnabled = s.metronome;
        document.getElementById('metronome-toggle').checked = s.metronome;
        this.sheetVisible = s.sheetMusic;
        document.getElementById('sheet-music-toggle').checked = s.sheetMusic;
        if (s.sheetMusic) {
            this.sheetCanvas.classList.remove('hidden');
            document.body.classList.add('sheet-visible');
        }
        // In reading mode, force sheet music on
        if (this.readingMode) {
            this.sheetVisible = true;
            document.getElementById('sheet-music-toggle').checked = true;
            this.sheetCanvas.classList.remove('hidden');
            document.body.classList.add('sheet-visible');
            document.body.classList.add('reading-mode');
        }
        this.timeSignature = { numerator: s.tsNumerator, denominator: s.tsDenominator };
        document.getElementById('ts-numerator').value = s.tsNumerator;
        document.getElementById('ts-denominator').value = s.tsDenominator;
        this.audioPlayback = s.audioPlayback;
        this.audioVolume = s.audioVolume;
        const apToggle = document.getElementById('audio-playback-toggle');
        if (apToggle) apToggle.checked = s.audioPlayback;
        const volSlider = document.getElementById('audio-volume');
        if (volSlider) volSlider.value = s.audioVolume;
    }

    _saveSettings() {
        let mode = 'normal';
        if (this.practiceMode) mode = 'practice';
        else if (this.readingMode) mode = 'reading';
        SettingsManager.save({
            bpm: this.bpm,
            mode,
            metronome: this.metronomeEnabled,
            sheetMusic: this.sheetVisible,
            tsNumerator: this.timeSignature.numerator,
            tsDenominator: this.timeSignature.denominator,
            audioPlayback: this.audioPlayback,
            audioVolume: this.audioVolume
        });
    }

    // ── Setup ────────────────────────────────────────────────────────────────

    _setupEvents() {
        window.addEventListener('resize', () => this._resize());

        this.fileInput.addEventListener('change', (e) => this._loadFile(e));
        this.btnStart.addEventListener('click', () => this._start());
        this.btnPause.addEventListener('click', () => this._togglePause());
        this.btnStop.addEventListener('click', () => this._stop());

        // Octave shift
        this.btnOctaveUp.addEventListener('click', () => this._shiftOctave(1));
        this.btnOctaveDown.addEventListener('click', () => this._shiftOctave(-1));

        // Note remap panel
        this.btnNoteRemap.addEventListener('click', () => this._openRemapPanel());
        document.getElementById('btn-remap-add').addEventListener('click', () => this._addRemap());
        document.getElementById('btn-remap-clear').addEventListener('click', () => this._clearRemaps());
        document.getElementById('btn-remap-close').addEventListener('click', () => this._closeRemapPanel());
        this.remapOverlay.addEventListener('click', (e) => {
            if (e.target === this.remapOverlay) this._closeRemapPanel();
        });
        this.remapSourceSel.addEventListener('change', () => this._updateRemapTarget());

        // Sheet music toggle
        document.getElementById('sheet-music-toggle').addEventListener('change', (e) => {
            this.sheetVisible = e.target.checked;
            this.sheetCanvas.classList.toggle('hidden', !this.sheetVisible);
            document.body.classList.toggle('sheet-visible', this.sheetVisible);
            this._resize();
            this._saveSettings();
        });

        this.modeSelect.addEventListener('change', (e) => {
            const mode = e.target.value;
            this.practiceMode = mode === 'practice';
            this.readingMode = mode === 'reading';
            this.bpmGroup.classList.toggle('hidden', this.practiceMode || this.readingMode);

            // Reading mode forces sheet music visible and hides game canvas
            if (this.readingMode) {
                this.sheetVisible = true;
                document.getElementById('sheet-music-toggle').checked = true;
                this.sheetCanvas.classList.remove('hidden');
                document.body.classList.add('sheet-visible');
                document.body.classList.add('reading-mode');
            } else {
                document.body.classList.remove('reading-mode');
            }
            this._resize();
            if (this.playing) this._stop();
            this._saveSettings();
        });

        this.bpmSlider.addEventListener('input', (e) => {
            this.bpm = parseInt(e.target.value, 10);
            this.bpmDisplay.textContent = this.bpm;
            if (this.originalBPM > 0) {
                this.speedMultiplier = this.bpm / this.originalBPM;
            }
        });
        this.bpmSlider.addEventListener('change', () => this._saveSettings());

        // Metronome toggle
        const metToggle = document.getElementById('metronome-toggle');
        metToggle.addEventListener('change', (e) => {
            this.metronomeEnabled = e.target.checked;
            this._saveSettings();
        });

        // Time signature controls
        const tsNum = document.getElementById('ts-numerator');
        const tsDen = document.getElementById('ts-denominator');
        tsNum.addEventListener('change', (e) => {
            const v = parseInt(e.target.value, 10);
            if (v >= 1 && v <= 16) this.timeSignature.numerator = v;
            this._saveSettings();
        });
        tsDen.addEventListener('change', (e) => {
            this.timeSignature.denominator = parseInt(e.target.value, 10);
            this._saveSettings();
        });

        // Audio playback toggle
        const apToggle = document.getElementById('audio-playback-toggle');
        if (apToggle) {
            apToggle.addEventListener('change', (e) => {
                this.audioPlayback = e.target.checked;
                this._saveSettings();
            });
        }
        const volSlider = document.getElementById('audio-volume');
        if (volSlider) {
            volSlider.addEventListener('input', (e) => {
                this.audioVolume = parseFloat(e.target.value);
            });
            volSlider.addEventListener('change', () => this._saveSettings());
        }

        // Library and Stats panel buttons
        const btnLibrary = document.getElementById('btn-library');
        if (btnLibrary) btnLibrary.addEventListener('click', () => this._openLibrary());
        const btnStats = document.getElementById('btn-stats');
        if (btnStats) btnStats.addEventListener('click', () => this._openStats());

        // Training Center
        this.trainingCenter = (typeof TrainingCenter !== 'undefined') ? new TrainingCenter(this) : null;
        const btnTraining = document.getElementById('btn-training');
        if (btnTraining) btnTraining.addEventListener('click', () => {
            if (this.trainingCenter) this.trainingCenter.show();
        });

        // Microphone input
        const btnMic = document.getElementById('btn-mic-toggle');
        if (btnMic) btnMic.addEventListener('click', () => this._toggleMic());
        const btnCalibrate = document.getElementById('btn-mic-calibrate');
        if (btnCalibrate) btnCalibrate.addEventListener('click', () => this._startCalibration());

        // Calibration overlay
        const calOverlay = document.getElementById('calibration-overlay');
        if (calOverlay) {
            calOverlay.addEventListener('click', (e) => {
                if (e.target === calOverlay) this._cancelCalibration();
            });
        }

        // Timeline scrubber
        this.timelineCanvas.addEventListener('mousedown', (e) => this._timelineMouseDown(e));
        this.timelineCanvas.addEventListener('mousemove', (e) => this._timelineMouseMove(e));
        window.addEventListener('mouseup', () => { this.timelineDragging = false; });

        // Right-click on timeline to set loop points
        this.timelineCanvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._timelineSetLoopPoint(e);
        });

        // Loop controls
        const btnLoopA = document.getElementById('btn-loop-a');
        const btnLoopB = document.getElementById('btn-loop-b');
        const btnLoopClear = document.getElementById('btn-loop-clear');
        if (btnLoopA) btnLoopA.addEventListener('click', () => this._setLoopA());
        if (btnLoopB) btnLoopB.addEventListener('click', () => this._setLoopB());
        if (btnLoopClear) btnLoopClear.addEventListener('click', () => this._clearLoop());

        // Computer keyboard — note input and shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;

            // Keyboard shortcuts (only when not typing in an input)
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
                if (e.code === 'Space') {
                    e.preventDefault();
                    if (this.playing || this.countingDown) {
                        this._togglePause();
                    } else if (this.notes.length > 0) {
                        this._start();
                    }
                    return;
                }
                if (e.code === 'Escape') {
                    e.preventDefault();
                    // Close Training Center if open
                    if (this.trainingCenter && this.trainingCenter.active) {
                        if (this.trainingCenter.currentMode) {
                            this.trainingCenter._backToMenu();
                        } else {
                            this.trainingCenter.hide();
                        }
                        return;
                    }
                    // Close any open overlay first
                    const calOvl = document.getElementById('calibration-overlay');
                    if (calOvl && !calOvl.classList.contains('hidden')) {
                        this._cancelCalibration();
                    } else if (!this.remapOverlay.classList.contains('hidden')) {
                        this._closeRemapPanel();
                    } else if (this.statsPanel && !this.statsPanel.classList.contains('hidden')) {
                        this.statsPanel.classList.add('hidden');
                    } else if (this.libraryPanel && !this.libraryPanel.classList.contains('hidden')) {
                        this.libraryPanel.classList.add('hidden');
                    } else if (this.playing || this.countingDown) {
                        this._stop();
                    }
                    return;
                }
            }

            const note = KEYBOARD_MAP[e.code];
            if (note !== undefined) {
                e.preventDefault();
                this._onNoteOn(note);
            }
        });
        window.addEventListener('keyup', (e) => {
            const note = KEYBOARD_MAP[e.code];
            if (note !== undefined) {
                e.preventDefault();
                this._onNoteOff(note);
            }
        });
    }

    async _setupMIDI() {
        if (!navigator.requestMIDIAccess) {
            this.midiStatusEl.textContent = 'MIDI: Not supported';
            return;
        }
        try {
            this.midiAccess = await navigator.requestMIDIAccess();
            this._onMIDIStateChange();
            this.midiAccess.onstatechange = () => this._onMIDIStateChange();
        } catch {
            this.midiStatusEl.textContent = 'MIDI: Access denied';
        }
    }

    _onMIDIStateChange() {
        this.midiInputs = [];
        for (const input of this.midiAccess.inputs.values()) {
            this.midiInputs.push(input);
            input.onmidimessage = (msg) => this._handleMIDIMessage(msg);
        }
        if (this.midiInputs.length > 0) {
            const name = this.midiInputs[0].name || 'Unknown';
            this.midiStatusEl.textContent = 'MIDI: ' + name;
            this.midiStatusEl.className = 'status-connected';
        } else {
            this.midiStatusEl.textContent = 'MIDI: No device';
            this.midiStatusEl.className = 'status-disconnected';
        }
    }

    _handleMIDIMessage(msg) {
        const [status, note, velocity] = msg.data;
        const type = status & 0xF0;
        if (type === 0x90 && velocity > 0) {
            this._onNoteOn(note);
        } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
            this._onNoteOff(note);
        }
    }

    _resize() {
        const sheetW = this.sheetVisible ? (this.readingMode ? 480 : 280) : 0;
        this.canvas.width = window.innerWidth - sheetW;
        this.canvas.height = window.innerHeight;
        this.keyboardHeight = Math.max(60, Math.floor(this.canvas.height * 0.1));
        this.hitLineY = this.canvas.height - this.keyboardHeight - 10;

        // Position timeline panel below the controls panel (which may wrap to multiple rows)
        const controlsH = this.controlsPanel.getBoundingClientRect().height;
        this.timelinePanel.style.top = controlsH + 'px';

        // Sheet music canvas
        if (this.sheetVisible) {
            const dpr = window.devicePixelRatio || 1;
            const logicalW = this.readingMode ? 480 : 280;
            this.sheetCanvas.width = logicalW * dpr;
            this.sheetCanvas.height = window.innerHeight * dpr;
            this.sheetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
    }

    // ── File Loading ─────────────────────────────────────────────────────────

    _loadFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                this.midiData = MidiParser.parse(ev.target.result);
                this.notes = NoteProcessor.buildNotes(this.midiData);
                this.originalBPM = NoteProcessor.getInitialBPM(this.midiData.tempoEvents);
                this.bpm = this.originalBPM;
                this.speedMultiplier = 1;
                this.bpmSlider.value = this.bpm;
                this.bpmDisplay.textContent = this.bpm;
                this.timeSignature = this.midiData.timeSignature;

                // Reset octave shift
                this.noteShift = 0;
                this.octaveShiftDisplay.textContent = '0';

                // Reset note remaps
                this.noteRemaps = new Map();

                // Reset loop points
                this._clearLoop();

                // Sync time signature UI
                document.getElementById('ts-numerator').value = this.timeSignature.numerator;
                document.getElementById('ts-denominator').value = this.timeSignature.denominator;

                // Build step groups for practice mode
                this._buildStepGroups();

                // Compute note range
                this._recalcNoteRange();

                this.noFileMsg.style.display = 'none';
                this.btnStart.disabled = false;
                this.btnNoteRemap.disabled = false;

                // Track song identity for library
                this.currentFileName = file.name;
                this.currentFingerprint = SongLibrary.songFingerprint(this.notes);

                // Compute song duration and show timeline
                if (this.notes.length > 0) {
                    const last = this.notes[this.notes.length - 1];
                    this.songDurationMs = last.startMs + last.durationMs;
                    this.timelineDurEl.textContent = this._formatTime(this.songDurationMs);
                }
                this.timelinePanel.classList.add('visible');
                this._drawTimeline();

                this._stop(); // reset state
            } catch (err) {
                alert('Error parsing MIDI file: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // ── Step Group Building ────────────────────────────────────────────────

    _buildStepGroups() {
        // Group note indices by start time (notes within CHORD_THRESHOLD ms form a chord)
        const CHORD_THRESHOLD = 10;
        this.stepGroups = [];
        if (this.notes.length === 0) return;

        let group = [0];
        for (let i = 1; i < this.notes.length; i++) {
            if (this.notes[i].startMs - this.notes[group[0]].startMs < CHORD_THRESHOLD) {
                group.push(i);
            } else {
                this.stepGroups.push(group);
                group = [i];
            }
        }
        this.stepGroups.push(group);
    }

    // ── Octave Shift ────────────────────────────────────────────────────────

    /** Shift all notes by the given number of octaves (+1 = up, -1 = down) */
    _shiftOctave(direction) {
        if (this.notes.length === 0) return;

        const semitones = direction * 12;
        const newShift = this.noteShift + semitones;

        // Check that shifted notes stay within valid MIDI range (0–127)
        for (const n of this.notes) {
            const shifted = n.note + semitones;
            if (shifted < 0 || shifted > 127) return;
        }

        // Apply shift to all notes
        for (const n of this.notes) {
            n.note += semitones;
        }
        this.noteShift = newShift;
        const octaves = newShift / 12;
        this.octaveShiftDisplay.textContent = octaves > 0 ? '+' + octaves : String(octaves);

        // Recalculate keyboard display range
        this._recalcNoteRange();

        // Rebuild step groups (note indices stay the same, but display updates)
        this._buildStepGroups();

        // Redraw timeline
        this._drawTimeline();
    }

    /** Recalculate minNote/maxNote from current notes array */
    _recalcNoteRange() {
        if (this.notes.length === 0) return;
        let lo = 127, hi = 0;
        for (const n of this.notes) {
            if (n.note < lo) lo = n.note;
            if (n.note > hi) hi = n.note;
        }
        this.minNote = Math.max(21, Math.floor(lo / 12) * 12);
        this.maxNote = Math.min(108, Math.ceil((hi + 1) / 12) * 12);
        if (this.maxNote - this.minNote < 24) {
            const mid = Math.floor((lo + hi) / 2);
            this.minNote = Math.max(21, mid - 12);
            this.maxNote = Math.min(108, mid + 12);
        }
    }

    // ── Per-Note Remap ──────────────────────────────────────────────────────

    /** Collect distinct note values from the current notes array */
    _collectDistinctNotes() {
        const set = new Set();
        for (const n of this.notes) set.add(n.note);
        this.distinctNotes = Array.from(set).sort((a, b) => a - b);
    }

    /** Open the remap panel and populate the source dropdown */
    _openRemapPanel() {
        this._collectDistinctNotes();

        // Populate source dropdown with notes currently in the song
        this.remapSourceSel.innerHTML = '';
        for (const n of this.distinctNotes) {
            const opt = document.createElement('option');
            opt.value = n;
            opt.textContent = noteName(n) + '  (' + n + ')';
            this.remapSourceSel.appendChild(opt);
        }

        this._updateRemapTarget();
        this._renderRemapList();
        this.remapOverlay.classList.remove('hidden');
    }

    /** Update target dropdown based on the selected source note (offer octave shifts) */
    _updateRemapTarget() {
        const src = parseInt(this.remapSourceSel.value, 10);
        this.remapTargetSel.innerHTML = '';
        if (isNaN(src)) return;

        // Offer every octave of the same pitch class that fits in MIDI range
        const pitchClass = src % 12;
        for (let oct = -1; oct <= 9; oct++) {
            const target = pitchClass + (oct + 1) * 12;
            if (target < 0 || target > 127 || target === src) continue;
            const opt = document.createElement('option');
            opt.value = target;
            opt.textContent = noteName(target) + '  (' + target + ')';
            this.remapTargetSel.appendChild(opt);
        }
    }

    /** Add a remap from the selected source → target */
    _addRemap() {
        const src = parseInt(this.remapSourceSel.value, 10);
        const tgt = parseInt(this.remapTargetSel.value, 10);
        if (isNaN(src) || isNaN(tgt) || src === tgt) return;

        // Prevent chained remaps: don't remap a note that is already a remap target
        for (const [, existingTgt] of this.noteRemaps) {
            if (existingTgt === src) return;
        }

        // Apply to notes array
        for (const n of this.notes) {
            if (n.note === src) n.note = tgt;
        }
        this.noteRemaps.set(src, tgt);

        this._afterRemapChange();
        this._openRemapPanel(); // refresh dropdowns
    }

    /** Remove a single remap and revert those notes safely */
    _removeRemap(originalNote) {
        if (!this.noteRemaps.has(originalNote)) return;
        this.noteRemaps.delete(originalNote);

        // Rebuild notes from MIDI data and re-apply remaining remaps to avoid chain issues
        this.notes = NoteProcessor.buildNotes(this.midiData);
        if (this.noteShift !== 0) {
            for (const n of this.notes) n.note += this.noteShift;
        }
        for (const [src, tgt] of this.noteRemaps) {
            for (const n of this.notes) {
                if (n.note === src) n.note = tgt;
            }
        }

        this._afterRemapChange();
        this._openRemapPanel();
    }

    /** Clear all remaps by reloading notes from scratch */
    _clearRemaps() {
        if (this.noteRemaps.size === 0) return;

        // Rebuild notes from MIDI data to undo all remaps
        this.notes = NoteProcessor.buildNotes(this.midiData);
        this.noteRemaps = new Map();

        // Re-apply global octave shift if any
        if (this.noteShift !== 0) {
            for (const n of this.notes) n.note += this.noteShift;
        }

        this._afterRemapChange();
        this._renderRemapList();
        this._collectDistinctNotes();
        this._openRemapPanel();
    }

    _closeRemapPanel() {
        this.remapOverlay.classList.add('hidden');
    }

    /** Render the list of active remaps */
    _renderRemapList() {
        this.remapListEl.innerHTML = '';
        if (this.noteRemaps.size === 0) {
            this.remapListEl.innerHTML = '<p style="color:#666;font-size:12px;padding:4px 0;">No remaps active</p>';
            return;
        }
        for (const [src, tgt] of this.noteRemaps) {
            const row = document.createElement('div');
            row.className = 'remap-entry';
            row.innerHTML =
                '<span class="remap-from">' + noteName(src) + '</span>' +
                '<span class="remap-arrow">→</span>' +
                '<span class="remap-to">' + noteName(tgt) + '</span>';
            const btn = document.createElement('button');
            btn.textContent = '✕';
            btn.title = 'Remove this remap';
            btn.addEventListener('click', () => this._removeRemap(src));
            row.appendChild(btn);
            this.remapListEl.appendChild(row);
        }
    }

    /** Common updates after any remap change */
    _afterRemapChange() {
        this._recalcNoteRange();
        this._buildStepGroups();
        this._drawTimeline();
    }

    // ── Playback Controls ────────────────────────────────────────────────────

    _start() {
        // If loop is active and no seek position set, start from loop start
        if (this.loopStartMs >= 0 && this.seekOffsetMs === 0) {
            this.seekOffsetMs = this.loopStartMs;
        }
        if (this.practiceMode || this.readingMode) {
            this._startPractice();
        } else {
            this._startNormal();
        }
    }

    _startNormal() {
        // Begin countdown, then play
        this.countdownBeats = this.timeSignature.numerator;
        this.countdownBeatMs = 60000 / this.bpm;
        this.countingDown = true;
        this.countdownStart = performance.now();
        this.lastCountdownBeat = -1;
        this.lastMetronomeBeat = -1;
        this.playing = false;
        this.paused = false;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.noteHits = new Map();
        this.feedbacks = [];
        this.scoreDisplay.textContent = '0';
        this.comboDisplay.textContent = '0';
        this.sessionStartTime = performance.now();

        // Mark notes before seek position as skipped
        for (let i = 0; i < this.notes.length; i++) {
            if (this.notes[i].startMs + this.notes[i].durationMs < this.seekOffsetMs) {
                this.noteHits.set(i, 'miss');
            }
        }

        // Ensure AudioContext is ready
        this._ensureAudioCtx();

        this.btnStart.disabled = true;
        this.btnPause.disabled = true;
        this.btnStop.disabled = false;
    }

    _startPractice() {
        this.playing = true;
        this.paused = false;
        this.sessionStartTime = performance.now();

        // Find the step group closest to the seek position
        this.stepIndex = 0;
        if (this.seekOffsetMs > 0 && this.stepGroups.length > 0) {
            this.stepIndex = this.stepGroups.length - 1;
            for (let g = 0; g < this.stepGroups.length; g++) {
                const firstNoteIdx = this.stepGroups[g][0];
                if (this.notes[firstNoteIdx].startMs >= this.seekOffsetMs) {
                    this.stepIndex = g;
                    break;
                }
            }
        }

        this.stepHits = new Set();
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.noteHits = new Map();
        this.feedbacks = [];
        this.scoreDisplay.textContent = '0';
        this.comboDisplay.textContent = '0';

        // Reset reaction timer
        this.lastStepCompleteTime = performance.now();
        this.lastReactionMs = 0;
        this.reactionTimes = [];
        this.bestReactionMs = Infinity;
        this.avgReactionMs = 0;

        this.btnStart.disabled = true;
        this.btnPause.disabled = false;
        this.btnStop.disabled = false;
    }

    _finishCountdown() {
        this.countingDown = false;
        this.playing = true;
        this.startTime = performance.now();
        this.pauseTime = 0;
        this.lastMetronomeBeat = -1;

        this.btnPause.disabled = false;
    }

    _togglePause() {
        if (!this.playing) return;
        if (this.paused) {
            this.pauseTime += performance.now() - this.pauseStart;
            this.paused = false;
            this.btnPause.textContent = 'Pause';
        } else {
            this.pauseStart = performance.now();
            this.paused = true;
            this.btnPause.textContent = 'Resume';
        }
    }

    _stop() {
        // Record session to library before resetting state
        if (this.sessionStartTime > 0 && this.currentFingerprint && this.noteHits.size > 0) {
            const durationMs = performance.now() - this.sessionStartTime;
            const totalNotes = this.notes.length;
            const hitCount = [...this.noteHits.values()].filter(
                g => g === 'perfect' || g === 'good' || g === 'early' || g === 'late'
            ).length;
            const accuracy = totalNotes > 0 ? (hitCount / totalNotes) * 100 : 0;
            SongLibrary.recordSession(
                this.currentFileName,
                this.currentFingerprint,
                this.score,
                this.maxCombo,
                totalNotes,
                accuracy,
                durationMs
            );
        }

        // Stop any active audio playback oscillators
        this._stopAllNotes();

        this.playing = false;
        this.paused = false;
        this.countingDown = false;
        this.stepIndex = 0;
        this.stepHits = new Set();
        this.lastMetronomeBeat = -1;
        this.lastCountdownBeat = -1;
        this.seekOffsetMs = 0;
        this.lastStepCompleteTime = 0;
        this.lastReactionMs = 0;
        this.reactionTimes = [];
        this.bestReactionMs = Infinity;
        this.avgReactionMs = 0;
        this.sessionStartTime = 0;
        this.btnStart.disabled = this.notes.length === 0;
        this.btnPause.disabled = true;
        this.btnPause.textContent = 'Pause';
        this.btnStop.disabled = true;
    }

    /** Whether the game is in a step-based mode (practice or reading) */
    _isStepMode() { return this.practiceMode || this.readingMode; }

    /** Current playback time in original-BPM milliseconds */
    _currentTimeMs() {
        if (!this.playing) return this.seekOffsetMs;
        const wall = performance.now() - this.startTime - this.pauseTime;
        return wall * this.speedMultiplier + this.seekOffsetMs;
    }

    // ── Note Input & Hit Detection ──────────────────────────────────────────

    _onNoteOn(note) {
        this.activeKeys.add(note);
        this._updateChordAnalysis();
        // Forward to Training Center when active
        if (this.trainingCenter && this.trainingCenter.active) {
            this.trainingCenter.onNoteOn(note);
            return;
        }
        if (this.countingDown) return;
        if (!this.playing || this.paused) return;
        if (this.readingMode) {
            this._checkStepHit(note); // Reading mode uses step-based advancement
        } else if (this.practiceMode) {
            this._checkStepHit(note);
        } else {
            this._checkHit(note);
        }
    }

    _onNoteOff(note) {
        this.activeKeys.delete(note);
        this._updateChordAnalysis();
        // Forward to Training Center when active
        if (this.trainingCenter && this.trainingCenter.active) {
            this.trainingCenter.onNoteOff(note);
        }
    }

    /** Analyze currently pressed keys and update chord display */
    _updateChordAnalysis() {
        const notes = [...this.activeKeys];
        if (notes.length >= 2) {
            this.lastChord = ChordAnalyzer.analyze(notes);
            this.lastChordTime = performance.now();
        } else if (notes.length === 0) {
            // Keep showing last chord briefly (it fades in render)
        } else {
            this.lastChord = null;
        }
    }

    _checkHit(pressedNote) {
        const now = this._currentTimeMs();
        const PERFECT = 50;
        const GOOD = 100;
        const WINDOW = 200;

        let bestIdx = -1;
        let bestDiff = Infinity;

        for (let i = 0; i < this.notes.length; i++) {
            if (this.noteHits.has(i)) continue; // already judged
            const n = this.notes[i];
            if (n.note !== pressedNote) continue;
            const diff = now - n.startMs;
            // Only consider notes within window range
            if (diff < -WINDOW) continue;
            if (diff > WINDOW + n.durationMs) continue;
            const absDiff = Math.abs(diff);
            if (absDiff < bestDiff) {
                bestDiff = absDiff;
                bestIdx = i;
            }
        }

        const keyX = this._noteToX(pressedNote);

        if (bestIdx === -1) {
            // Wrong key or no matching note nearby
            this.combo = 0;
            this.comboDisplay.textContent = '0';
            this.feedbacks.push(new FeedbackPopup('✗', keyX, this.hitLineY - 30, '#ff3333'));
            return;
        }

        let grade, points, text, color;
        if (bestDiff <= PERFECT) {
            grade = 'perfect'; points = 100; text = '⭐ Perfect'; color = '#ffdd00';
        } else if (bestDiff <= GOOD) {
            grade = 'good'; points = 50; text = '✓ Good'; color = '#66ff33';
        } else {
            const diff = this._currentTimeMs() - this.notes[bestIdx].startMs;
            if (diff < 0) {
                grade = 'early'; points = 25; text = 'Early'; color = '#ffaa00';
            } else {
                grade = 'late'; points = 25; text = 'Late'; color = '#ff8800';
            }
        }

        this.noteHits.set(bestIdx, grade);
        this.score += points;
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        this.scoreDisplay.textContent = this.score;
        this.comboDisplay.textContent = this.combo;

        this._playNoteSound(pressedNote);
        this.feedbacks.push(new FeedbackPopup(text, keyX, this.hitLineY - 30, color));
    }

    _checkStepHit(pressedNote) {
        if (this.stepIndex >= this.stepGroups.length) return;

        const group = this.stepGroups[this.stepIndex];
        const keyX = this._noteToX(pressedNote);

        // Check if the pressed note matches any note in the current group
        let matched = false;
        for (const idx of group) {
            if (this.notes[idx].note === pressedNote && !this.stepHits.has(idx)) {
                this.stepHits.add(idx);
                this.noteHits.set(idx, 'perfect');
                this.score += 100;
                this.combo++;
                if (this.combo > this.maxCombo) this.maxCombo = this.combo;
                this.scoreDisplay.textContent = this.score;
                this.comboDisplay.textContent = this.combo;
                this._playNoteSound(pressedNote);
                this.feedbacks.push(new FeedbackPopup('✓', keyX, this.hitLineY - 30, '#66ff33'));
                matched = true;
                break;
            }
        }

        if (!matched) {
            this.combo = 0;
            this.comboDisplay.textContent = '0';
            this.feedbacks.push(new FeedbackPopup('✗', keyX, this.hitLineY - 30, '#ff3333'));
            return;
        }

        // If all notes in the group have been hit, advance to next group
        if (this.stepHits.size >= group.length) {
            // Track reaction time
            const now = performance.now();
            if (this.lastStepCompleteTime > 0) {
                this.lastReactionMs = now - this.lastStepCompleteTime;
                this.reactionTimes.push(this.lastReactionMs);
                if (this.lastReactionMs < this.bestReactionMs) {
                    this.bestReactionMs = this.lastReactionMs;
                }
                const sum = this.reactionTimes.reduce((a, b) => a + b, 0);
                this.avgReactionMs = sum / this.reactionTimes.length;
            }
            this.lastStepCompleteTime = now;

            this.stepIndex++;
            this.stepHits = new Set();

            // Check if we've passed the loop end point — wrap to loop start
            if (this.loopStartMs >= 0 && this.loopEndMs >= 0 &&
                this.stepIndex < this.stepGroups.length) {
                const nextStart = this.notes[this.stepGroups[this.stepIndex][0]].startMs;
                if (nextStart > this.loopEndMs) {
                    this._seekToStepGroup(this.loopStartMs);
                    return;
                }
            }

            // Check if song is complete
            if (this.stepIndex >= this.stepGroups.length) {
                // If loop is active, wrap around instead of stopping
                if (this.loopStartMs >= 0 && this.loopEndMs >= 0) {
                    this._seekToStepGroup(this.loopStartMs);
                } else {
                    this._stop();
                }
            }
        }
    }

    // ── Coordinate Helpers ──────────────────────────────────────────────────

    /** Compute the list of white keys in the current range */
    _whiteKeysInRange() {
        const keys = [];
        for (let n = this.minNote; n <= this.maxNote; n++) {
            if (!isBlackKey(n)) keys.push(n);
        }
        return keys;
    }

    /** Get the x-center of a note's column on the canvas */
    _noteToX(midiNote) {
        const whiteKeys = this._whiteKeysInRange();
        const whiteKeyWidth = this.canvas.width / whiteKeys.length;

        if (!isBlackKey(midiNote)) {
            const idx = whiteKeys.indexOf(midiNote);
            if (idx < 0) return -100; // out of range
            return idx * whiteKeyWidth + whiteKeyWidth / 2;
        } else {
            // Black key sits between two white keys. Find the white key just below.
            const lowerWhite = midiNote - 1;
            const idx = whiteKeys.indexOf(lowerWhite);
            if (idx < 0) return -100;
            return idx * whiteKeyWidth + whiteKeyWidth;
        }
    }

    /** Get the width for a note column */
    _noteWidth(midiNote) {
        const whiteKeys = this._whiteKeysInRange();
        const whiteKeyWidth = this.canvas.width / whiteKeys.length;
        return isBlackKey(midiNote) ? whiteKeyWidth * 0.6 : whiteKeyWidth;
    }

    // ── Rendering ───────────────────────────────────────────────────────────

    _animate() {
        requestAnimationFrame(this._animate);
        this._render();
    }

    _render() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;
        ctx.clearRect(0, 0, W, H);

        // Background
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, W, H);

        if (this.readingMode) {
            // Reading mode: only show keyboard and chord analysis (sheet music is on left panel)
            this._drawKeyboard(ctx, W, H);
            this._drawChordAnalysis(ctx, W, H);

            // In reading mode, advance step groups just like practice mode
            if ((this.practiceMode || this.readingMode) && this.playing) {
                // Step info
                ctx.save();
                ctx.font = '14px sans-serif';
                ctx.fillStyle = '#0ff';
                ctx.textAlign = 'left';
                const stepY = H - this.keyboardHeight - 30;
                ctx.fillText('Step: ' + (this.stepIndex + 1) + ' / ' + this.stepGroups.length, 10, stepY);
                ctx.restore();
            }

            // Sheet music panel (always shown in reading mode)
            if (this.notes.length > 0) {
                this._drawSheetMusic();
            }

            // Draw feedbacks
            this.feedbacks = this.feedbacks.filter(f => f.alive);
            for (const f of this.feedbacks) f.draw(ctx);

            // Check loop boundary
            if (this.playing && !this.paused) {
                this._checkLoopBoundary();
            }

            // Timeline update
            if (this.songDurationMs > 0) {
                const curMs = this.playing && this.stepIndex < this.stepGroups.length
                    ? this.notes[this.stepGroups[this.stepIndex][0]].startMs
                    : this._currentTimeMs();
                this.timelinePosEl.textContent = this._formatTime(curMs);
                this._drawTimelinePlayhead(curMs);
            }
            return;
        }

        // Normal / Practice mode rendering (original flow)

        // Draw lane lines (faint vertical guides for white keys)
        this._drawLanes(ctx, W, H);

        // Hit line
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, this.hitLineY);
        ctx.lineTo(W, this.hitLineY);
        ctx.stroke();

        // Glow on hit line
        const grad = ctx.createLinearGradient(0, this.hitLineY - 8, 0, this.hitLineY + 8);
        grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
        grad.addColorStop(0.5, 'rgba(0, 255, 255, 0.12)');
        grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, this.hitLineY - 8, W, 16);

        // Draw falling notes
        if (this.notes.length > 0) {
            if (this.practiceMode && this.playing) {
                this._drawStepNotes(ctx);
            } else {
                this._drawNotes(ctx);
            }
        }

        // Draw keyboard
        this._drawKeyboard(ctx, W, H);

        // Draw feedbacks
        this.feedbacks = this.feedbacks.filter(f => f.alive);
        for (const f of this.feedbacks) f.draw(ctx);

        // Check for missed notes (normal mode only)
        if (this.playing && !this.paused && !this.practiceMode) {
            this._checkMisses();
            this._tickMetronome();
        }

        // Check loop boundary (both modes)
        if (this.playing && !this.paused) {
            this._checkLoopBoundary();
        }

        // Draw countdown overlay
        if (this.countingDown) {
            this._updateCountdown(ctx, W, H);
        }

        // Draw step progress and reaction times in practice mode
        if (this.practiceMode && this.playing) {
            ctx.save();
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#0ff';
            ctx.textAlign = 'left';
            const stepY = H - this.keyboardHeight - 30;
            ctx.fillText('Step: ' + (this.stepIndex + 1) + ' / ' + this.stepGroups.length, 10, stepY);

            // Reaction time stats
            ctx.font = '13px sans-serif';
            ctx.fillStyle = '#aaa';
            const rxY = stepY - 22;
            if (this.lastReactionMs > 0) {
                ctx.fillStyle = '#0ff';
                ctx.fillText('Last: ' + this.lastReactionMs.toFixed(0) + ' ms', 10, rxY);
                ctx.fillStyle = '#66ff33';
                const bestStr = this.bestReactionMs < Infinity ? this.bestReactionMs.toFixed(0) + ' ms' : '—';
                ctx.fillText('Best: ' + bestStr, 140, rxY);
                ctx.fillStyle = '#ffaa00';
                ctx.fillText('Avg: ' + this.avgReactionMs.toFixed(0) + ' ms', 260, rxY);
            }
            ctx.restore();
        }

        // Update timeline position display
        if (this.songDurationMs > 0) {
            const curMs = this.practiceMode && this.playing && this.stepIndex < this.stepGroups.length
                ? this.notes[this.stepGroups[this.stepIndex][0]].startMs
                : this._currentTimeMs();
            this.timelinePosEl.textContent = this._formatTime(curMs);
            this._drawTimelinePlayhead(curMs);

            if (this.practiceMode && this.playing) {
                this.timelineStepEl.textContent = 'Step ' + (this.stepIndex + 1) + '/' + this.stepGroups.length;
                this.timelineStepEl.classList.remove('hidden');
            } else {
                this.timelineStepEl.classList.add('hidden');
            }
        }

        // Draw sheet music panel
        if (this.sheetVisible && this.notes.length > 0) {
            this._drawSheetMusic();
        }

        // Draw chord analysis panel
        this._drawChordAnalysis(ctx, W, H);
    }

    /** Draw the chord analysis panel on the game canvas */
    _drawChordAnalysis(ctx, W, H) {
        const chord = this.lastChord;
        const age = performance.now() - this.lastChordTime;
        const FADE_AFTER = 3000; // start fading after 3 seconds
        const FADE_DUR = 1500;

        if (!chord && age > FADE_AFTER + FADE_DUR) return;

        let alpha = 1;
        if (this.activeKeys.size === 0 && age > FADE_AFTER) {
            alpha = Math.max(0, 1 - (age - FADE_AFTER) / FADE_DUR);
        }
        if (alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Position: top-right of canvas
        const panelW = 240;
        const px = W - panelW - 12;
        const py = 12;

        if (chord) {
            // Pre-compute description line count for dynamic height
            ctx.font = '10px sans-serif';
            const maxDescW = panelW - 24;
            const words = chord.desc.split(' ');
            let descLines = [];
            let line = '';
            for (const word of words) {
                const test = line + (line ? ' ' : '') + word;
                if (ctx.measureText(test).width > maxDescW && line) {
                    descLines.push(line);
                    line = word;
                } else {
                    line = test;
                }
            }
            if (line) descLines.push(line);

            const panelH = 68 + descLines.length * 12 + 8;

            // Background
            ctx.fillStyle = 'rgba(10, 10, 20, 0.85)';
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            const r = 6;
            ctx.beginPath();
            ctx.moveTo(px + r, py);
            ctx.lineTo(px + panelW - r, py);
            ctx.quadraticCurveTo(px + panelW, py, px + panelW, py + r);
            ctx.lineTo(px + panelW, py + panelH - r);
            ctx.quadraticCurveTo(px + panelW, py + panelH, px + panelW - r, py + panelH);
            ctx.lineTo(px + r, py + panelH);
            ctx.quadraticCurveTo(px, py + panelH, px, py + panelH - r);
            ctx.lineTo(px, py + r);
            ctx.quadraticCurveTo(px, py, px + r, py);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Chord name (highlighted)
            ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = '#0ff';
            ctx.textAlign = 'left';
            ctx.shadowColor = '#0ff';
            ctx.shadowBlur = 6;
            ctx.fillText(chord.fullName, px + 12, py + 26);
            ctx.shadowBlur = 0;

            // Chord type
            ctx.font = 'bold 13px sans-serif';
            ctx.fillStyle = '#ffaa00';
            ctx.fillText(chord.type, px + 12, py + 44);

            // Notes
            ctx.font = '11px sans-serif';
            ctx.fillStyle = '#888';
            ctx.fillText(chord.notes.join(' · '), px + 12, py + 60);

            // Description lines
            ctx.font = '10px sans-serif';
            ctx.fillStyle = '#666';
            let lineY = py + 76;
            for (const dl of descLines) {
                ctx.fillText(dl, px + 12, lineY);
                lineY += 12;
            }
        }

        ctx.restore();
    }

    _drawLanes(ctx, W, H) {
        const whiteKeys = this._whiteKeysInRange();
        const whiteKeyWidth = W / whiteKeys.length;
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let i = 1; i < whiteKeys.length; i++) {
            const x = i * whiteKeyWidth;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.hitLineY);
            ctx.stroke();
        }
    }

    _drawNotes(ctx) {
        const now = this._currentTimeMs();
        // Pixels the notes travel per ms (in original time).
        // At the default the visible window is ~2 seconds before the hit line.
        const visibleWindowMs = 2000;
        const pixelsPerMs = this.hitLineY / visibleWindowMs;

        for (let i = 0; i < this.notes.length; i++) {
            const n = this.notes[i];
            const relStart = n.startMs - now; // ms until this note should be hit
            const relEnd = relStart + n.durationMs;

            // Position: hitLineY when relStart=0, above when relStart>0
            const yBottom = this.hitLineY - relStart * pixelsPerMs;
            const yTop = this.hitLineY - relEnd * pixelsPerMs;

            // Skip if fully off-screen
            if (yBottom < -10) continue;
            if (yTop > this.canvas.height + 10) continue;

            const x = this._noteToX(n.note);
            const w = this._noteWidth(n.note);
            const h = Math.max(yBottom - yTop, 4);

            // Determine visual state
            const hit = this.noteHits.get(i);
            let color = noteColor(n.note);
            let alpha = 0.9;

            if (hit === 'perfect') { color = '#ffdd00'; alpha = 0.5; }
            else if (hit === 'good') { color = '#66ff33'; alpha = 0.5; }
            else if (hit === 'early' || hit === 'late') { color = '#ff8800'; alpha = 0.4; }
            else if (hit === 'miss') { color = '#ff0000'; alpha = 0.25; }

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;

            // Rounded rect
            const r = Math.min(4, w / 4);
            ctx.beginPath();
            ctx.moveTo(x - w / 2 + r, yTop);
            ctx.lineTo(x + w / 2 - r, yTop);
            ctx.quadraticCurveTo(x + w / 2, yTop, x + w / 2, yTop + r);
            ctx.lineTo(x + w / 2, yBottom - r);
            ctx.quadraticCurveTo(x + w / 2, yBottom, x + w / 2 - r, yBottom);
            ctx.lineTo(x - w / 2 + r, yBottom);
            ctx.quadraticCurveTo(x - w / 2, yBottom, x - w / 2, yBottom - r);
            ctx.lineTo(x - w / 2, yTop + r);
            ctx.quadraticCurveTo(x - w / 2, yTop, x - w / 2 + r, yTop);
            ctx.closePath();
            ctx.fill();

            // Glow
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.fill();

            // Note label on large enough notes
            if (h > 18 && w > 16) {
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = '#000';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(noteName(n.note), x, (yTop + yBottom) / 2);
            }

            ctx.restore();
        }
    }

    _drawKeyboard(ctx, W, H) {
        const kbY = H - this.keyboardHeight;
        const whiteKeys = this._whiteKeysInRange();
        const whiteKeyWidth = W / whiteKeys.length;

        // White keys
        for (let i = 0; i < whiteKeys.length; i++) {
            const n = whiteKeys[i];
            const x = i * whiteKeyWidth;
            const pressed = this.activeKeys.has(n);

            ctx.fillStyle = pressed ? '#aaddff' : '#e8e8e8';
            ctx.fillRect(x + 1, kbY, whiteKeyWidth - 2, this.keyboardHeight - 2);

            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 1, kbY, whiteKeyWidth - 2, this.keyboardHeight - 2);

            // Label on C notes
            if (n % 12 === 0) {
                ctx.fillStyle = '#666';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(noteName(n), x + whiteKeyWidth / 2, kbY + this.keyboardHeight - 8);
            }
        }

        // Black keys
        const blackKeyWidth = whiteKeyWidth * 0.6;
        const blackKeyHeight = this.keyboardHeight * 0.6;
        for (let n = this.minNote; n <= this.maxNote; n++) {
            if (!isBlackKey(n)) continue;
            const x = this._noteToX(n);
            const pressed = this.activeKeys.has(n);

            ctx.fillStyle = pressed ? '#6699cc' : '#222';
            ctx.fillRect(x - blackKeyWidth / 2, kbY, blackKeyWidth, blackKeyHeight);

            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeRect(x - blackKeyWidth / 2, kbY, blackKeyWidth, blackKeyHeight);
        }
    }

    // ── Timeline Scrubber ───────────────────────────────────────────────────

    /** Format milliseconds as M:SS */
    _formatTime(ms) {
        const totalSec = Math.max(0, Math.floor(ms / 1000));
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return m + ':' + String(s).padStart(2, '0');
    }

    /** Draw the note-density minimap on the timeline canvas */
    _drawTimeline() {
        const tc = this.timelineCanvas;
        const rect = tc.getBoundingClientRect();
        tc.width = rect.width * window.devicePixelRatio;
        tc.height = rect.height * window.devicePixelRatio;
        const ctx = this.timelineCtx;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        const W = rect.width;
        const H = rect.height;

        ctx.clearRect(0, 0, W, H);

        // Background
        ctx.fillStyle = '#111118';
        ctx.fillRect(0, 0, W, H);

        if (this.songDurationMs <= 0 || this.notes.length === 0) return;

        // Build density bins
        const NUM_BINS = Math.min(Math.floor(W), 200);
        const bins = new Array(NUM_BINS).fill(0);
        for (const n of this.notes) {
            const bin = Math.min(NUM_BINS - 1, Math.floor((n.startMs / this.songDurationMs) * NUM_BINS));
            bins[bin]++;
        }
        const maxBin = Math.max(1, ...bins);

        // Draw density bars
        const binW = W / NUM_BINS;
        for (let i = 0; i < NUM_BINS; i++) {
            if (bins[i] === 0) continue;
            const barH = (bins[i] / maxBin) * (H - 4);
            ctx.fillStyle = 'rgba(0, 255, 255, 0.35)';
            ctx.fillRect(i * binW, H - 2 - barH, Math.max(binW - 1, 1), barH);
        }

        // Cache the base image for fast playhead redraws
        this._timelineBaseImage = ctx.getImageData(0, 0, tc.width, tc.height);
    }

    /** Draw the playhead line on the timeline (uses cached base image) */
    _drawTimelinePlayhead(currentMs) {
        const tc = this.timelineCanvas;
        const rect = tc.getBoundingClientRect();
        const ctx = this.timelineCtx;
        const W = rect.width;
        const H = rect.height;

        // Restore cached base image instead of redrawing
        if (this._timelineBaseImage) {
            ctx.putImageData(this._timelineBaseImage, 0, 0);
        }

        if (this.songDurationMs <= 0) return;

        // Draw loop region overlay
        if (this.loopStartMs >= 0 || this.loopEndMs >= 0) {
            const loopA = this.loopStartMs >= 0 ? (this.loopStartMs / this.songDurationMs) * W : 0;
            const loopB = this.loopEndMs >= 0 ? (this.loopEndMs / this.songDurationMs) * W : W;

            // Shaded region
            if (this.loopStartMs >= 0 && this.loopEndMs >= 0) {
                ctx.fillStyle = 'rgba(0, 255, 100, 0.08)';
                ctx.fillRect(loopA, 0, loopB - loopA, H);
            }

            // Loop A marker (green)
            if (this.loopStartMs >= 0) {
                ctx.strokeStyle = '#00ff66';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(loopA, 0);
                ctx.lineTo(loopA, H);
                ctx.stroke();
                // "A" label
                ctx.fillStyle = '#00ff66';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('A', loopA + 2, H - 2);
            }

            // Loop B marker (orange)
            if (this.loopEndMs >= 0) {
                ctx.strokeStyle = '#ff8800';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(loopB, 0);
                ctx.lineTo(loopB, H);
                ctx.stroke();
                // "B" label
                ctx.fillStyle = '#ff8800';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText('B', loopB - 2, H - 2);
            }
        }

        const x = Math.max(0, Math.min(W, (currentMs / this.songDurationMs) * W));

        // Playhead line
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();

        // Small triangle at top
        ctx.fillStyle = '#ff3366';
        ctx.beginPath();
        ctx.moveTo(x - 4, 0);
        ctx.lineTo(x + 4, 0);
        ctx.lineTo(x, 5);
        ctx.closePath();
        ctx.fill();
    }

    /** Handle mouse click on timeline to seek */
    _timelineMouseDown(e) {
        this.timelineDragging = true;
        this._timelineSeek(e);
    }

    _timelineMouseMove(e) {
        if (!this.timelineDragging) return;
        this._timelineSeek(e);
    }

    _timelineSeek(e) {
        if (this.songDurationMs <= 0) return;
        const rect = this.timelineCanvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const seekMs = x * this.songDurationMs;

        if (this.playing && !this._isStepMode()) {
            // In normal mode during playback: adjust startTime so _currentTimeMs matches
            this.seekOffsetMs = seekMs;
            this.startTime = performance.now();
            this.pauseTime = 0;
            // Clear hit states for notes in the new region
            this.noteHits = new Map();
            for (let i = 0; i < this.notes.length; i++) {
                if (this.notes[i].startMs + this.notes[i].durationMs < seekMs) {
                    this.noteHits.set(i, 'miss');
                }
            }
        } else if (this.playing && this._isStepMode()) {
            // In step mode (practice/reading): jump to nearest step group
            this._seekToStepGroup(seekMs);
        } else {
            // Not playing: just set the seek offset for when start is pressed
            this.seekOffsetMs = seekMs;
            // In step mode, also update step index preview
            if (this._isStepMode()) {
                this._seekToStepGroup(seekMs);
            }
        }
    }

    _seekToStepGroup(seekMs) {
        let bestGroup = this.stepGroups.length > 0 ? this.stepGroups.length - 1 : 0;
        for (let g = 0; g < this.stepGroups.length; g++) {
            const firstNoteIdx = this.stepGroups[g][0];
            if (this.notes[firstNoteIdx].startMs >= seekMs) {
                bestGroup = g;
                break;
            }
        }
        this.stepIndex = bestGroup;
        this.stepHits = new Set();
        this.noteHits = new Map();
        this.lastStepCompleteTime = performance.now();
        this.lastReactionMs = 0;
        this.seekOffsetMs = seekMs;
    }

    // ── Loop Points (A-B Repeat) ────────────────────────────────────────────

    /** Set loop start (A) to current playback position or seek position */
    _setLoopA() {
        const curMs = this._getLoopCursorMs();
        this.loopStartMs = curMs;
        // If loop end is before loop start, clear it
        if (this.loopEndMs >= 0 && this.loopEndMs <= this.loopStartMs) {
            this.loopEndMs = -1;
        }
        this._updateLoopDisplay();
        this._drawTimeline();
    }

    /** Set loop end (B) to current playback position or seek position */
    _setLoopB() {
        const curMs = this._getLoopCursorMs();
        this.loopEndMs = curMs;
        // If loop start is after loop end, clear it
        if (this.loopStartMs >= 0 && this.loopStartMs >= this.loopEndMs) {
            this.loopStartMs = -1;
        }
        this._updateLoopDisplay();
        this._drawTimeline();
    }

    /** Clear both loop points */
    _clearLoop() {
        this.loopStartMs = -1;
        this.loopEndMs = -1;
        this._updateLoopDisplay();
        this._drawTimeline();
    }

    /** Get the current position for setting loop points */
    _getLoopCursorMs() {
        if (this.playing && !this._isStepMode()) {
            return this._currentTimeMs();
        }
        if (this._isStepMode() && this.playing && this.stepIndex < this.stepGroups.length) {
            return this.notes[this.stepGroups[this.stepIndex][0]].startMs;
        }
        return this.seekOffsetMs;
    }

    /** Right-click on timeline sets alternating A/B points */
    _timelineSetLoopPoint(e) {
        if (this.songDurationMs <= 0) return;
        const rect = this.timelineCanvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const ms = x * this.songDurationMs;

        // If no A set, set A. If A set but no B, set B. If both set, reset A.
        if (this.loopStartMs < 0) {
            this.loopStartMs = ms;
        } else if (this.loopEndMs < 0) {
            if (ms > this.loopStartMs) {
                this.loopEndMs = ms;
            } else {
                // Clicked before A — swap: new click becomes A, old A becomes B
                this.loopEndMs = this.loopStartMs;
                this.loopStartMs = ms;
            }
        } else {
            // Both set — start fresh
            this.loopStartMs = ms;
            this.loopEndMs = -1;
        }
        this._updateLoopDisplay();
        this._drawTimeline();
    }

    /** Update the loop info display */
    _updateLoopDisplay() {
        const loopInfo = document.getElementById('loop-info');
        if (!loopInfo) return;
        if (this.loopStartMs >= 0 && this.loopEndMs >= 0) {
            loopInfo.textContent = 'Loop: ' + this._formatTime(this.loopStartMs) + ' → ' + this._formatTime(this.loopEndMs);
            loopInfo.classList.remove('hidden');
        } else if (this.loopStartMs >= 0) {
            loopInfo.textContent = 'Loop A: ' + this._formatTime(this.loopStartMs) + ' (right-click timeline for B)';
            loopInfo.classList.remove('hidden');
        } else {
            loopInfo.classList.add('hidden');
        }
    }

    /** Check if we've passed the loop end and need to jump back to loop start */
    _checkLoopBoundary() {
        if (this.loopStartMs < 0 || this.loopEndMs < 0) return;

        if (this._isStepMode()) {
            // In step mode (practice/reading): check if the current step is past loop end
            if (this.stepIndex < this.stepGroups.length) {
                const firstIdx = this.stepGroups[this.stepIndex][0];
                if (this.notes[firstIdx].startMs > this.loopEndMs) {
                    this._seekToStepGroup(this.loopStartMs);
                }
            }
        } else {
            // In normal mode: check if current time is past loop end
            const now = this._currentTimeMs();
            if (now > this.loopEndMs) {
                // Jump back to loop start
                this.seekOffsetMs = this.loopStartMs;
                this.startTime = performance.now();
                this.pauseTime = 0;
                this.lastMetronomeBeat = -1;
                // Re-mark notes: clear hits and mark notes before loop start as miss
                this.noteHits = new Map();
                for (let i = 0; i < this.notes.length; i++) {
                    if (this.notes[i].startMs + this.notes[i].durationMs < this.loopStartMs) {
                        this.noteHits.set(i, 'miss');
                    }
                }
            }
        }
    }

    // ── Audio / Metronome ───────────────────────────────────────────────────

    _ensureAudioCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    /** Play a short click sound. accent=true for beat 1 (higher pitch). */
    _playClick(accent) {
        if (!this.audioCtx) return;
        const CLICK_HI_FREQ = 1200;
        const CLICK_LO_FREQ = 800;
        const CLICK_HI_GAIN = 0.5;
        const CLICK_LO_GAIN = 0.3;
        const CLICK_DURATION = 0.06; // seconds

        const ctx = this.audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.value = accent ? CLICK_HI_FREQ : CLICK_LO_FREQ;
        gain.gain.setValueAtTime(accent ? CLICK_HI_GAIN : CLICK_LO_GAIN, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + CLICK_DURATION);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + CLICK_DURATION);
    }

    /** Tick the metronome during normal-mode playback (called each frame). */
    _tickMetronome() {
        if (!this.metronomeEnabled || !this.playing || this.paused) return;
        const now = this._currentTimeMs();
        const beatMs = 60000 / this.bpm;
        const beatNum = Math.floor(now / beatMs);
        if (beatNum !== this.lastMetronomeBeat) {
            this.lastMetronomeBeat = beatNum;
            this._ensureAudioCtx();
            const posInMeasure = beatNum % this.timeSignature.numerator;
            this._playClick(posInMeasure === 0);
        }
    }

    // ── Microphone Input (Acoustic Piano) ──────────────────────────────────

    async _toggleMic() {
        if (this.micEnabled) {
            this._stopMic();
            return;
        }

        this._ensureAudioCtx();

        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.micSource = this.audioCtx.createMediaStreamSource(this.micStream);
            this.pitchDetector = new PitchDetector(this.audioCtx, this.audioCtx.sampleRate);
            this.pitchDetector.connectSource(this.micSource);

            this.micEnabled = true;
            this.lastMicNote = -1;

            const btnMic = document.getElementById('btn-mic-toggle');
            if (btnMic) {
                btnMic.textContent = '🎤 Mic: ON';
                btnMic.classList.add('mic-active');
            }
            if (this.micStatusEl) {
                this.micStatusEl.textContent = 'Mic: Listening';
                this.micStatusEl.className = 'status-connected';
            }

            // Enable calibrate button
            const btnCal = document.getElementById('btn-mic-calibrate');
            if (btnCal) btnCal.disabled = false;

            // Start pitch detection loop (~60 Hz)
            this.micDetectionInterval = setInterval(() => this._detectMicPitch(), 16);
        } catch (err) {
            if (this.micStatusEl) {
                this.micStatusEl.textContent = 'Mic: ' + (err.name === 'NotAllowedError' ? 'Denied' : 'Error');
                this.micStatusEl.className = 'status-disconnected';
            }
        }
    }

    _stopMic() {
        if (this.micDetectionInterval) {
            clearInterval(this.micDetectionInterval);
            this.micDetectionInterval = null;
        }
        if (this.micSource) {
            this.micSource.disconnect();
            this.micSource = null;
        }
        if (this.micStream) {
            for (const track of this.micStream.getTracks()) track.stop();
            this.micStream = null;
        }
        this.pitchDetector = null;
        this.micEnabled = false;
        this.lastMicNote = -1;

        const btnMic = document.getElementById('btn-mic-toggle');
        if (btnMic) {
            btnMic.textContent = '🎤 Mic';
            btnMic.classList.remove('mic-active');
        }
        if (this.micStatusEl) {
            this.micStatusEl.textContent = 'Mic: Off';
            this.micStatusEl.className = 'status-disconnected';
        }
        const btnCal = document.getElementById('btn-mic-calibrate');
        if (btnCal) btnCal.disabled = true;
    }

    _detectMicPitch() {
        if (!this.pitchDetector) return;
        const result = this.pitchDetector.detect();

        if (this.micCalibrating) {
            this._handleCalibrationDetection(result);
            return;
        }

        if (!result) {
            // Silence — release the last detected note
            if (this.lastMicNote >= 0) {
                this._onNoteOff(this.lastMicNote);
                this.lastMicNote = -1;
            }
            return;
        }

        const note = result.midiNote;

        // Debounce: only trigger if the note changed
        if (note !== this.lastMicNote) {
            // Release old note
            if (this.lastMicNote >= 0) {
                this._onNoteOff(this.lastMicNote);
            }
            this.lastMicNote = note;
            this._onNoteOn(note);
        }
    }

    // ── Microphone Calibration ──────────────────────────────────────────────

    _startCalibration() {
        if (!this.micEnabled) return;

        this.micCalibrating = true;
        this._calibrationSamples = [];

        const overlay = document.getElementById('calibration-overlay');
        if (overlay) overlay.classList.remove('hidden');

        // Update the calibration note select with the current value
        const calNoteSelect = document.getElementById('cal-note-select');
        if (calNoteSelect) calNoteSelect.value = String(this.micCalibrationNote);

        const calStatus = document.getElementById('cal-status');
        if (calStatus) calStatus.textContent = 'Play the selected note on your piano...';

        const calProgress = document.getElementById('cal-progress');
        if (calProgress) calProgress.style.width = '0%';
    }

    _cancelCalibration() {
        this.micCalibrating = false;
        this._calibrationSamples = [];
        const overlay = document.getElementById('calibration-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    _handleCalibrationDetection(result) {
        const calStatus = document.getElementById('cal-status');
        const calProgress = document.getElementById('cal-progress');

        if (!result) return;

        // Update calibration note from selector
        const calNoteSelect = document.getElementById('cal-note-select');
        if (calNoteSelect) this.micCalibrationNote = parseInt(calNoteSelect.value, 10);

        const TARGET_SAMPLES = 30; // collect ~0.5 seconds of consistent pitch

        this._calibrationSamples.push(result.frequency);

        if (calProgress) {
            calProgress.style.width = Math.min(100, (this._calibrationSamples.length / TARGET_SAMPLES) * 100) + '%';
        }

        if (calStatus) {
            calStatus.textContent = 'Detecting... ' + result.frequency.toFixed(1) + ' Hz (confidence: ' + (result.confidence * 100).toFixed(0) + '%)';
        }

        if (this._calibrationSamples.length >= TARGET_SAMPLES) {
            // Average the samples
            const avgFreq = this._calibrationSamples.reduce((a, b) => a + b, 0) / this._calibrationSamples.length;

            // Calibrate the detector
            this.pitchDetector.calibrate(avgFreq, this.micCalibrationNote);

            if (calStatus) {
                const expectedFreq = 440 * Math.pow(2, (this.micCalibrationNote - 69) / 12);
                calStatus.textContent = 'Calibrated! Detected ' + avgFreq.toFixed(1) + ' Hz → ' +
                    noteName(this.micCalibrationNote) + ' (' + expectedFreq.toFixed(1) + ' Hz). Offset: ' +
                    this.pitchDetector.calibrationOffset.toFixed(1) + ' cents';
            }

            this.micCalibrating = false;
            this._calibrationSamples = [];

            // Auto-close after a moment
            setTimeout(() => {
                const overlay = document.getElementById('calibration-overlay');
                if (overlay) overlay.classList.add('hidden');
            }, 2000);
        }
    }

    // ── Audio Note Playback ────────────────────────────────────────────────

    /** Convert MIDI note number to frequency in Hz (A4 = 440 Hz) */
    _midiToFreq(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    /** Play a synthesized note when the player hits a correct key (if audio playback enabled) */
    _playNoteSound(midiNote) {
        if (!this.audioPlayback || !this.audioCtx) return;
        this._ensureAudioCtx();

        // Stop any existing oscillator for this note
        this._stopNoteSound(midiNote);

        const ctx = this.audioCtx;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = this._midiToFreq(midiNote);
        gainNode.gain.setValueAtTime(this.audioVolume * 0.4, ctx.currentTime);
        // Gentle envelope: attack + sustain for 0.3s then decay
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
        this.activeOscillators.set(midiNote, { osc, gain: gainNode });

        osc.onended = () => {
            this.activeOscillators.delete(midiNote);
        };
    }

    /** Stop a specific note's oscillator */
    _stopNoteSound(midiNote) {
        const existing = this.activeOscillators.get(midiNote);
        if (existing) {
            try { existing.osc.stop(); } catch { /* already stopped */ }
            this.activeOscillators.delete(midiNote);
        }
    }

    /** Stop all active note oscillators */
    _stopAllNotes() {
        for (const [, entry] of this.activeOscillators) {
            try { entry.osc.stop(); } catch { /* already stopped */ }
        }
        this.activeOscillators.clear();
    }

    // ── Song Library Panel ──────────────────────────────────────────────────

    _openLibrary() {
        if (!this.libraryPanel) return;
        const lib = SongLibrary.loadLibrary();
        const listEl = document.getElementById('library-list');
        if (!listEl) return;

        if (lib.length === 0) {
            listEl.innerHTML = '<p class="empty-msg">No songs played yet. Load a MIDI file and play to start tracking!</p>';
        } else {
            // Sort by last played (most recent first)
            lib.sort((a, b) => (b.lastPlayed || '').localeCompare(a.lastPlayed || ''));
            listEl.innerHTML = lib.map(entry => {
                const dur = this._formatTime(entry.totalPracticeMs);
                const lastDate = entry.lastPlayed ? new Date(entry.lastPlayed).toLocaleDateString() : '—';
                return '<div class="library-entry">' +
                    '<div class="lib-name">' + this._escHtml(entry.fileName) + '</div>' +
                    '<div class="lib-stats">' +
                    '<span>Plays: <strong>' + entry.playCount + '</strong></span>' +
                    '<span>High Score: <strong>' + entry.highScore + '</strong></span>' +
                    '<span>Best Combo: <strong>' + entry.bestCombo + '</strong></span>' +
                    '<span>Best Accuracy: <strong>' + entry.bestAccuracy.toFixed(1) + '%</strong></span>' +
                    '<span>Practice Time: <strong>' + dur + '</strong></span>' +
                    '<span>Last Played: <strong>' + lastDate + '</strong></span>' +
                    '</div></div>';
            }).join('');
        }

        this.libraryPanel.classList.remove('hidden');
    }

    // ── Stats Dashboard Panel ───────────────────────────────────────────────

    _openStats() {
        if (!this.statsPanel) return;
        const stats = SongLibrary.loadStats();
        const lib = SongLibrary.loadLibrary();

        const contentEl = document.getElementById('stats-content');
        if (!contentEl) return;

        const totalSongs = lib.length;
        const totalPlays = lib.reduce((sum, e) => sum + e.playCount, 0);
        const totalTime = this._formatTimeLong(stats.totalPracticeMs);
        const avgAccuracy = lib.length > 0
            ? (lib.reduce((sum, e) => sum + e.bestAccuracy, 0) / lib.length).toFixed(1)
            : '0.0';
        const topScore = lib.reduce((max, e) => Math.max(max, e.highScore), 0);
        const lastDate = stats.lastSessionDate
            ? new Date(stats.lastSessionDate).toLocaleDateString()
            : '—';

        contentEl.innerHTML =
            '<div class="stats-grid">' +
            '<div class="stat-card"><div class="stat-value">' + totalSongs + '</div><div class="stat-label">Songs Practiced</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + totalPlays + '</div><div class="stat-label">Total Sessions</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + totalTime + '</div><div class="stat-label">Practice Time</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + avgAccuracy + '%</div><div class="stat-label">Avg Best Accuracy</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + topScore + '</div><div class="stat-label">All-Time High Score</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + lastDate + '</div><div class="stat-label">Last Session</div></div>' +
            '</div>';

        this.statsPanel.classList.remove('hidden');
    }

    /** Format ms as "Xh Ym" or "Xm Ys" */
    _formatTimeLong(ms) {
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (h > 0) return h + 'h ' + m + 'm';
        if (m > 0) return m + 'm ' + s + 's';
        return s + 's';
    }

    /** Escape HTML to prevent XSS */
    _escHtml(str) {
        if (!this._escDiv) this._escDiv = document.createElement('div');
        this._escDiv.textContent = str;
        return this._escDiv.innerHTML;
    }

    // ── Countdown ───────────────────────────────────────────────────────────

    _updateCountdown(ctx, W, H) {
        const elapsed = performance.now() - this.countdownStart;
        const beatIndex = Math.floor(elapsed / this.countdownBeatMs); // 0-based beat

        // Sound the click for each countdown beat
        if (beatIndex !== this.lastCountdownBeat && beatIndex < this.countdownBeats) {
            this.lastCountdownBeat = beatIndex;
            this._ensureAudioCtx();
            this._playClick(beatIndex === 0);
        }

        if (beatIndex >= this.countdownBeats) {
            this._finishCountdown();
            return;
        }

        // Display number: count down from N to 1
        const displayNum = this.countdownBeats - beatIndex;
        const beatFrac = (elapsed % this.countdownBeatMs) / this.countdownBeatMs;

        ctx.save();
        // Dim background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, W, H);

        // Pulsing number
        const scale = 1 + (1 - beatFrac) * 0.5; // shrink from 1.5x to 1x
        const alpha = 1 - beatFrac * 0.3;

        ctx.globalAlpha = alpha;
        ctx.font = `bold ${Math.round(120 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0ff';
        ctx.shadowColor = '#0ff';
        ctx.shadowBlur = 30;
        ctx.fillText(String(displayNum), W / 2, H / 2);

        // Time signature label
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.6;
        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText(
            this.timeSignature.numerator + '/' + this.timeSignature.denominator,
            W / 2, H / 2 + 90
        );
        ctx.restore();
    }

    // ── Sheet Music Rendering ─────────────────────────────────────────────

    /**
     * Map MIDI note number to a staff position.
     * Position 0 = middle C (C4, MIDI 60). Each position = one staff step (half a line spacing).
     * Positive = higher on staff, negative = lower.
     * Uses sharp-based spelling (e.g. C# not Db) for simplicity.
     * Lookup: C=0, C#=0, D=1, D#=1, E=2, F=3, F#=3, G=4, G#=4, A=5, A#=5, B=6.
     * Sharps share the same staff position as their natural counterpart.
     */
    _midiToStaffPos(midiNote) {
        const PITCH_OFFSETS = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
        const octave = Math.floor(midiNote / 12) - 1;
        const pitchClass = midiNote % 12;
        const stepsFromC = PITCH_OFFSETS[pitchClass];
        return (octave - 4) * 7 + stepsFromC;
    }

    /** Return the accidental for a MIDI note: '♯' for sharps, '' for naturals.
     *  Always uses sharp spelling for simplicity (no key signature awareness). */
    _midiAccidental(midiNote) {
        const IS_SHARP = [false, true, false, true, false, false, true, false, true, false, true, false];
        return IS_SHARP[midiNote % 12] ? '♯' : '';
    }

    /** Determine which note indices are "active" (should be highlighted) right now */
    _getActiveNoteIndices() {
        if (this._isStepMode() && this.playing) {
            // In step mode (practice/reading), the current step group notes are active
            if (this.stepIndex < this.stepGroups.length) {
                return new Set(this.stepGroups[this.stepIndex]);
            }
            return new Set();
        }
        // In normal mode, notes near the hit line (within ±150ms) are active
        const now = this._currentTimeMs();
        const WINDOW = 150;
        const active = new Set();
        for (let i = 0; i < this.notes.length; i++) {
            if (this.noteHits.has(i)) continue;
            const n = this.notes[i];
            const diff = now - n.startMs;
            if (diff >= -WINDOW && diff <= WINDOW) {
                active.add(i);
            }
        }
        return active;
    }

    /** Draw the sheet music panel on the left-side canvas */
    _drawSheetMusic() {
        const ctx = this.sheetCtx;
        const W = this.readingMode ? 480 : 280; // logical width (wider in reading mode)
        const H = window.innerHeight;

        ctx.clearRect(0, 0, W, H);

        // Background
        ctx.fillStyle = '#0c0c14';
        ctx.fillRect(0, 0, W, H);

        // Layout constants
        const STAFF_LEFT = 45;       // left margin for clef + accidentals
        const STAFF_RIGHT = W - 12;  // right margin
        const LINE_SP = 10;          // spacing between staff lines (half = one step)
        const HALF_SP = LINE_SP / 2; // one staff step

        // Grand staff: treble (5 lines) + gap + bass (5 lines)
        // Treble: lines for E5, G5 are at top; bottom line = E4
        // Bass: top line = A3; bottom line = G2
        // We'll center the grand staff vertically and make it scroll

        // Reference: middle C (pos=0) sits on one ledger line below treble staff
        // Treble staff bottom line (E4) = pos 2
        // Bass staff top line (A3) = pos -2

        const staffCenterY = H * 0.35; // vertical center for the gap between staves
        const trebleBottomY = staffCenterY - LINE_SP * 1.5; // bottom line of treble staff
        const bassTopY = staffCenterY + LINE_SP * 1.5;      // top line of bass staff

        // Computed boundaries of the full grand staff area
        const trebleTopY = trebleBottomY - 4 * LINE_SP;
        const bassBottomY = bassTopY + 4 * LINE_SP;

        // Draw treble staff (5 lines, bottom to top)
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = trebleBottomY - i * LINE_SP;
            ctx.beginPath();
            ctx.moveTo(STAFF_LEFT - 5, y);
            ctx.lineTo(STAFF_RIGHT, y);
            ctx.stroke();
        }

        // Draw bass staff (5 lines, top to bottom)
        for (let i = 0; i < 5; i++) {
            const y = bassTopY + i * LINE_SP;
            ctx.beginPath();
            ctx.moveTo(STAFF_LEFT - 5, y);
            ctx.lineTo(STAFF_RIGHT, y);
            ctx.stroke();
        }

        // Draw treble clef symbol
        ctx.save();
        ctx.font = '42px serif';
        ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        // Treble clef sits around the G line (second from bottom of treble staff)
        ctx.fillText('𝄞', 6, trebleBottomY - LINE_SP);
        ctx.restore();

        // Draw bass clef symbol
        ctx.save();
        ctx.font = '30px serif';
        ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('𝄢', 8, bassTopY + LINE_SP);
        ctx.restore();

        // Determine which notes to show — a window around the current position
        const activeSet = this._getActiveNoteIndices();

        // Find the current center index
        // Find the current center index (the note closest to playback position)
        let centerIdx = 0;
        if (this._isStepMode() && this.playing && this.stepIndex < this.stepGroups.length) {
            centerIdx = this.stepGroups[this.stepIndex][0];
        } else if (this.playing || this.seekOffsetMs > 0) {
            const now = this._currentTimeMs();
            centerIdx = this.notes.length - 1; // default to end if all notes are past
            for (let i = 0; i < this.notes.length; i++) {
                if (this.notes[i].startMs >= now) { centerIdx = i; break; }
            }
        }

        // Show notes in groups — render step groups for better readability
        const NOTE_COL_SPACING = 30; // horizontal px between note columns
        const startX = STAFF_LEFT + 15;

        // Determine groups to render: we use stepGroups for grouping
        if (this.stepGroups.length === 0) return;

        // Find the step group containing or nearest to centerIdx
        let centerGroup = this.stepGroups.length - 1;
        for (let g = 0; g < this.stepGroups.length; g++) {
            if (this.stepGroups[g][0] >= centerIdx) {
                centerGroup = g;
                break;
            }
        }

        // How many groups fit
        const maxCols = Math.floor((STAFF_RIGHT - startX) / NOTE_COL_SPACING);
        const halfCols = Math.floor(maxCols / 3); // show a few before, more ahead
        const startGroup = Math.max(0, centerGroup - halfCols);
        const endGroup = Math.min(this.stepGroups.length, startGroup + maxCols);

        // Title
        ctx.save();
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#0ff';
        ctx.textAlign = 'center';
        ctx.fillText('Sheet Music', W / 2, 70);
        ctx.restore();

        // Draw notes for each visible group
        for (let g = startGroup; g < endGroup; g++) {
            const colIdx = g - startGroup;
            const x = startX + colIdx * NOTE_COL_SPACING;
            const group = this.stepGroups[g];

            // Check if this group is the active one
            const isActiveGroup = group.some(idx => activeSet.has(idx));

            for (const idx of group) {
                const n = this.notes[idx];
                const staffPos = this._midiToStaffPos(n.note);
                const accidental = this._midiAccidental(n.note);

                // Calculate Y position on staff
                // Middle C (staffPos=0): one ledger line below treble staff
                // trebleBottomY = position for E4 (staffPos=2)
                // So y = trebleBottomY - (staffPos - 2) * HALF_SP
                const y = trebleBottomY - (staffPos - 2) * HALF_SP;

                const isActive = activeSet.has(idx);
                const isHit = this.noteHits.has(idx);

                // Draw ledger lines if needed
                ctx.strokeStyle = isActive ? 'rgba(0, 255, 255, 0.5)' : 'rgba(200, 200, 200, 0.25)';
                ctx.lineWidth = 1;
                const ledgerHalfW = 8;

                // Ledger lines above treble staff
                if (y < trebleTopY) {
                    for (let ly = trebleTopY - LINE_SP; ly >= y - HALF_SP; ly -= LINE_SP) {
                        ctx.beginPath();
                        ctx.moveTo(x - ledgerHalfW, ly);
                        ctx.lineTo(x + ledgerHalfW, ly);
                        ctx.stroke();
                    }
                }

                // Ledger line for middle C (between staves)
                if (staffPos === 0) {
                    ctx.beginPath();
                    ctx.moveTo(x - ledgerHalfW, y);
                    ctx.lineTo(x + ledgerHalfW, y);
                    ctx.stroke();
                }

                // Ledger lines below bass staff
                if (y > bassBottomY) {
                    for (let ly = bassBottomY + LINE_SP; ly <= y + HALF_SP; ly += LINE_SP) {
                        ctx.beginPath();
                        ctx.moveTo(x - ledgerHalfW, ly);
                        ctx.lineTo(x + ledgerHalfW, ly);
                        ctx.stroke();
                    }
                }

                // Draw notehead
                ctx.save();
                if (isActive) {
                    ctx.fillStyle = '#0ff';
                    ctx.shadowColor = '#0ff';
                    ctx.shadowBlur = 10;
                } else if (isHit) {
                    const hitGrade = this.noteHits.get(idx);
                    ctx.fillStyle = hitGrade === 'miss' ? 'rgba(255,50,50,0.3)' : 'rgba(100,255,50,0.4)';
                    ctx.shadowBlur = 0;
                } else {
                    ctx.fillStyle = 'rgba(200, 200, 200, 0.6)';
                    ctx.shadowBlur = 0;
                }

                // Oval notehead
                ctx.beginPath();
                ctx.ellipse(x, y, 5, 3.5, -0.3, 0, Math.PI * 2);
                ctx.fill();

                // Stem (middle C as reference: stem down for notes at or above middle C, stem up below)
                ctx.strokeStyle = ctx.fillStyle;
                ctx.shadowBlur = 0;
                ctx.lineWidth = 1.2;
                if (staffPos >= 0) {
                    ctx.beginPath();
                    ctx.moveTo(x - 4.5, y);
                    ctx.lineTo(x - 4.5, y + 22);
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.moveTo(x + 4.5, y);
                    ctx.lineTo(x + 4.5, y - 22);
                    ctx.stroke();
                }

                // Draw accidental
                if (accidental) {
                    ctx.font = '11px serif';
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(accidental, x - 7, y);
                }

                ctx.restore();
            }

            // Draw a subtle column highlight for active group
            if (isActiveGroup) {
                ctx.save();
                ctx.fillStyle = 'rgba(0, 255, 255, 0.06)';
                const highlightTop = trebleTopY - 10;
                const highlightBottom = bassBottomY + 10;
                ctx.fillRect(x - NOTE_COL_SPACING / 2, highlightTop,
                             NOTE_COL_SPACING, highlightBottom - highlightTop);
                ctx.restore();
            }
        }

        // Draw a bracket/brace on the left connecting both staves
        ctx.save();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
        ctx.lineWidth = 2;
        const braceX = STAFF_LEFT - 7;
        ctx.beginPath();
        ctx.moveTo(braceX, trebleTopY);
        ctx.lineTo(braceX, bassBottomY);
        ctx.stroke();
        ctx.restore();
    }

    // ── Step-Mode Note Rendering ────────────────────────────────────────────

    _drawStepNotes(ctx) {
        if (this.stepGroups.length === 0) return;

        // In practice mode we position notes relative to the current step group.
        // Current group sits at the hit line; future groups scroll above it.
        const GROUP_SPACING = 120; // px between groups
        const STEP_NOTE_MIN_H = 30;
        const STEP_NOTE_MAX_H = 50;
        const lookahead = Math.ceil(this.hitLineY / GROUP_SPACING) + 1;

        for (let g = this.stepIndex; g < Math.min(this.stepIndex + lookahead, this.stepGroups.length); g++) {
            const group = this.stepGroups[g];
            const offsetFromCurrent = g - this.stepIndex;
            const groupY = this.hitLineY - offsetFromCurrent * GROUP_SPACING;

            for (const idx of group) {
                const n = this.notes[idx];
                const x = this._noteToX(n.note);
                const w = this._noteWidth(n.note);
                const h = Math.max(STEP_NOTE_MIN_H, Math.min(GROUP_SPACING - 10, STEP_NOTE_MAX_H));
                const yTop = groupY - h;
                const yBottom = groupY;

                if (yBottom < -10 || yTop > this.canvas.height + 10) continue;

                const hit = this.noteHits.get(idx);
                let color = noteColor(n.note);
                let alpha = g === this.stepIndex ? 1.0 : 0.5; // current group brighter

                if (hit === 'perfect') { color = '#66ff33'; alpha = 0.4; }

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = color;

                // Rounded rect
                const r = Math.min(4, w / 4);
                ctx.beginPath();
                ctx.moveTo(x - w / 2 + r, yTop);
                ctx.lineTo(x + w / 2 - r, yTop);
                ctx.quadraticCurveTo(x + w / 2, yTop, x + w / 2, yTop + r);
                ctx.lineTo(x + w / 2, yBottom - r);
                ctx.quadraticCurveTo(x + w / 2, yBottom, x + w / 2 - r, yBottom);
                ctx.lineTo(x - w / 2 + r, yBottom);
                ctx.quadraticCurveTo(x - w / 2, yBottom, x - w / 2, yBottom - r);
                ctx.lineTo(x - w / 2, yTop + r);
                ctx.quadraticCurveTo(x - w / 2, yTop, x - w / 2 + r, yTop);
                ctx.closePath();
                ctx.fill();

                if (g === this.stepIndex && !hit) {
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 12;
                    ctx.fill();
                }

                // Note label
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 0.85;
                ctx.fillStyle = '#000';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(noteName(n.note), x, (yTop + yBottom) / 2);

                ctx.restore();
            }
        }
    }

    // ── Miss Detection ──────────────────────────────────────────────────────

    _checkMisses() {
        const now = this._currentTimeMs();
        const MISS_THRESHOLD = 250; // ms past the note start to declare miss

        for (let i = 0; i < this.notes.length; i++) {
            if (this.noteHits.has(i)) continue;
            const n = this.notes[i];
            if (now - n.startMs > MISS_THRESHOLD) {
                this.noteHits.set(i, 'miss');
                this.combo = 0;
                this.comboDisplay.textContent = '0';
                const x = this._noteToX(n.note);
                this.feedbacks.push(new FeedbackPopup('Miss', x, this.hitLineY - 30, '#ff3333'));
            }
        }

        // Auto-stop when all notes are done
        if (this.notes.length > 0) {
            const last = this.notes[this.notes.length - 1];
            if (now > last.startMs + last.durationMs + 2000) {
                this._stop();
            }
        }
    }
}

// ─── Pitch Detection (Microphone Input) ─────────────────────────────────────────

class PitchDetector {
    /**
     * Autocorrelation-based pitch detector.
     * @param {AudioContext} audioCtx
     * @param {number} sampleRate
     */
    constructor(audioCtx, sampleRate) {
        this.audioCtx = audioCtx;
        this.sampleRate = sampleRate;
        this.analyser = audioCtx.createAnalyser();
        this.analyser.fftSize = 4096;
        this.buffer = new Float32Array(this.analyser.fftSize);
        this.corrBuffer = new Float32Array(this.analyser.fftSize);
        this.calibrationOffset = 0; // cents offset from A4=440
    }

    /** Connect a MediaStreamSource to the analyser */
    connectSource(source) {
        source.connect(this.analyser);
    }

    /**
     * Detect the current pitch using autocorrelation.
     * @returns {{ frequency: number, midiNote: number, confidence: number } | null}
     */
    detect() {
        this.analyser.getFloatTimeDomainData(this.buffer);
        const buf = this.buffer;
        const n = buf.length;

        // Check if there's enough signal (RMS threshold)
        let rms = 0;
        for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / n);
        if (rms < 0.01) return null; // too quiet

        // Autocorrelation
        const corrBuf = this.corrBuffer;
        for (let lag = 0; lag < n; lag++) {
            let sum = 0;
            for (let i = 0; i < n - lag; i++) {
                sum += buf[i] * buf[i + lag];
            }
            corrBuf[lag] = sum;
        }

        // Find the first dip then the next peak (fundamental period)
        // Skip lag 0 (self-correlation peak)
        let foundDip = false;
        let bestLag = -1;
        let bestCorr = 0;
        const minLag = Math.floor(this.sampleRate / 2000); // max freq ~2000 Hz
        const maxLag = Math.floor(this.sampleRate / 50);   // min freq ~50 Hz

        for (let lag = minLag; lag < Math.min(maxLag, n); lag++) {
            if (!foundDip && corrBuf[lag] < corrBuf[lag - 1]) {
                foundDip = true;
            }
            if (foundDip && corrBuf[lag] > bestCorr) {
                bestCorr = corrBuf[lag];
                bestLag = lag;
            }
            if (foundDip && corrBuf[lag] < bestCorr * 0.8) {
                break; // past the peak
            }
        }

        if (bestLag < 0 || bestCorr <= 0) return null;

        const confidence = bestCorr / corrBuf[0]; // 0-1
        if (confidence < 0.5) return null;

        // Parabolic interpolation for sub-sample accuracy
        const y0 = corrBuf[bestLag - 1] || 0;
        const y1 = corrBuf[bestLag];
        const y2 = corrBuf[bestLag + 1] || 0;
        const denom = 2 * (2 * y1 - y0 - y2);
        const shift = denom !== 0 ? (y0 - y2) / denom : 0;
        const refinedLag = bestLag + shift;

        const frequency = this.sampleRate / refinedLag;

        // Apply calibration offset (in cents)
        const calibratedFreq = frequency * Math.pow(2, this.calibrationOffset / 1200);

        // Convert to MIDI note
        const midiFloat = 69 + 12 * Math.log2(calibratedFreq / 440);
        const midiNote = Math.round(midiFloat);

        // Only accept if within half a semitone
        if (Math.abs(midiFloat - midiNote) > 0.5) return null;

        return { frequency: calibratedFreq, midiNote, confidence };
    }

    /**
     * Set calibration offset. User plays a known note, we compare detected
     * frequency to the expected frequency.
     * @param {number} detectedFreq
     * @param {number} expectedMidiNote
     */
    calibrate(detectedFreq, expectedMidiNote) {
        const expectedFreq = 440 * Math.pow(2, (expectedMidiNote - 69) / 12);
        this.calibrationOffset = 1200 * Math.log2(expectedFreq / detectedFreq);
    }
}

// ─── Bootstrap ──────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    new GuitarHeroGame();
});
