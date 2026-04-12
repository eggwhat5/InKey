/* ===================================================================
   Training Center — Interactive ear training, arpeggios, chords,
   and music theory lessons for piano practice.
   =================================================================== */

/* ---------- Constants ---------- */

const MIDI_C2 = 36;
const MIDI_C3 = 48;
const MIDI_C4 = 60;
const MIDI_B4 = 71;
const MIDI_C5 = 72;
const MIDI_B5 = 83;

/* ---------- Music Theory Data ---------- */

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTE_NAMES_FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

function midiToNoteName(midi) {
  const oct = Math.floor(midi / 12) - 1;
  return NOTE_NAMES[midi % 12] + oct;
}

function noteNameToMidi(name) {
  const match = name.match(/^([A-G][#b]?)(-?\d)$/);
  if (!match) return -1;
  let note = match[1];
  const oct = parseInt(match[2], 10);
  let idx = NOTE_NAMES.indexOf(note);
  if (idx === -1) idx = NOTE_NAMES_FLAT.indexOf(note);
  if (idx === -1) return -1;
  return (oct + 1) * 12 + idx;
}

/* Intervals */
const INTERVAL_NAMES = {
  0: 'Unison', 1: 'Minor 2nd', 2: 'Major 2nd', 3: 'Minor 3rd',
  4: 'Major 3rd', 5: 'Perfect 4th', 6: 'Tritone', 7: 'Perfect 5th',
  8: 'Minor 6th', 9: 'Major 6th', 10: 'Minor 7th', 11: 'Major 7th', 12: 'Octave'
};

/* Chord definitions with descriptions */
const CHORD_TYPES = {
  major:      { intervals: [0,4,7],     symbol: '',     name: 'Major',
    desc: 'Bright, happy, and stable. The foundation of Western harmony, used in virtually every genre as a tonic or resolution chord.' },
  minor:      { intervals: [0,3,7],     symbol: 'm',    name: 'Minor',
    desc: 'Dark, sad, or introspective. Common in emotional passages, ballads, and as the vi chord in major keys.' },
  dim:        { intervals: [0,3,6],     symbol: 'dim',  name: 'Diminished',
    desc: 'Tense and unstable, craving resolution. Often used as a passing chord or vii° chord leading to the tonic.' },
  aug:        { intervals: [0,4,8],     symbol: 'aug',  name: 'Augmented',
    desc: 'Mysterious and dreamlike. Used for chromatic voice leading, common in jazz and impressionist music.' },
  sus2:       { intervals: [0,2,7],     symbol: 'sus2', name: 'Suspended 2nd',
    desc: 'Open and airy. Creates ambiguity between major/minor, popular in pop, rock, and ambient music.' },
  sus4:       { intervals: [0,5,7],     symbol: 'sus4', name: 'Suspended 4th',
    desc: 'Creates anticipation wanting to resolve to major or minor. Very common in rock, pop, and hymn-style music.' },
  maj7:       { intervals: [0,4,7,11],  symbol: 'maj7', name: 'Major 7th',
    desc: 'Smooth and jazzy with a lush quality. The "dreamy" jazz chord, common in bossa nova, R&B, and neo-soul.' },
  dom7:       { intervals: [0,4,7,10],  symbol: '7',    name: 'Dominant 7th',
    desc: 'Bluesy tension that wants to resolve down a 5th. The engine of jazz harmony, blues, and rock \'n\' roll.' },
  min7:       { intervals: [0,3,7,10],  symbol: 'm7',   name: 'Minor 7th',
    desc: 'Mellow and soulful. Staple of jazz, R&B, and funk. Often used as the ii chord in ii-V-I progressions.' },
  halfdim7:   { intervals: [0,3,6,10],  symbol: 'ø7',   name: 'Half-Diminished 7th',
    desc: 'Bittersweet tension. The ii chord in minor keys, essential for minor ii-V-i jazz progressions.' },
  dim7:       { intervals: [0,3,6,9],   symbol: '°7',   name: 'Diminished 7th',
    desc: 'Highly symmetrical and maximally tense. Used as a dramatic passing chord, common in classical and film music.' },
  augmaj7:    { intervals: [0,4,8,11],  symbol: 'augM7', name: 'Augmented Major 7th',
    desc: 'Exotic and colorful. Rare but striking, used in jazz for its unique floating quality.' },
  dom9:       { intervals: [0,4,7,10,14], symbol: '9',  name: 'Dominant 9th',
    desc: 'Rich and funky. Adds color to dominant chords, staple of funk, soul, and jazz fusion.' },
  min9:       { intervals: [0,3,7,10,14], symbol: 'm9', name: 'Minor 9th',
    desc: 'Sophisticated and warm. Common in jazz ballads, neo-soul, and lo-fi hip-hop progressions.' },
  add9:       { intervals: [0,4,7,14],  symbol: 'add9', name: 'Add 9',
    desc: 'Bright with extra sparkle. Popular in pop and rock for adding interest without the jazz feel of a full 9th.' },
  '6':        { intervals: [0,4,7,9],   symbol: '6',    name: 'Major 6th',
    desc: 'Cheerful and vintage. Common in jazz standards, swing era music, and country.' },
  min6:       { intervals: [0,3,7,9],   symbol: 'm6',   name: 'Minor 6th',
    desc: 'Nostalgic and slightly dark. Used in jazz and bossa nova, often as a tonic minor chord.' },
  power:      { intervals: [0,7],       symbol: '5',    name: 'Power Chord',
    desc: 'Neither major nor minor — pure power. The backbone of rock, punk, and metal guitar riffs.' },
};

/* Scale definitions */
const SCALE_TYPES = {
  major:          { intervals: [0,2,4,5,7,9,11],   name: 'Major (Ionian)',
    desc: 'The most common scale in Western music. Happy, bright, resolved. Think "Do Re Mi".' },
  natural_minor:  { intervals: [0,2,3,5,7,8,10],   name: 'Natural Minor (Aeolian)',
    desc: 'The relative minor of the major scale. Sad, dark, reflective. Basis for minor key music.' },
  harmonic_minor: { intervals: [0,2,3,5,7,8,11],   name: 'Harmonic Minor',
    desc: 'Natural minor with a raised 7th. Creates a dramatic leading tone. Common in classical and Middle-Eastern music.' },
  melodic_minor:  { intervals: [0,2,3,5,7,9,11],   name: 'Melodic Minor (ascending)',
    desc: 'Minor with raised 6th and 7th going up. Smooth and jazz-flavored. Basis for many jazz modes.' },
  dorian:         { intervals: [0,2,3,5,7,9,10],   name: 'Dorian',
    desc: 'Minor with a bright 6th. The "jazzy minor" sound. Santana, Miles Davis, and Daft Punk use it.' },
  mixolydian:     { intervals: [0,2,4,5,7,9,10],   name: 'Mixolydian',
    desc: 'Major with a flat 7th. Bluesy and rock-flavored. Used in blues, rock, funk, and folk.' },
  phrygian:       { intervals: [0,1,3,5,7,8,10],   name: 'Phrygian',
    desc: 'Dark and exotic with its distinctive flat 2nd. Flamenco, metal, and Middle-Eastern music.' },
  lydian:         { intervals: [0,2,4,6,7,9,11],   name: 'Lydian',
    desc: 'Major with a raised 4th. Dreamy and floating. Used in film scores and progressive music.' },
  pentatonic_maj: { intervals: [0,2,4,7,9],         name: 'Major Pentatonic',
    desc: 'Five-note scale, universally pleasant. Used in folk, country, pop, and as a safe improvisational tool.' },
  pentatonic_min: { intervals: [0,3,5,7,10],        name: 'Minor Pentatonic',
    desc: 'The blues/rock soloing scale. Five notes, no wrong notes. Foundation of blues, rock, and pop solos.' },
  blues:          { intervals: [0,3,5,6,7,10],      name: 'Blues',
    desc: 'Minor pentatonic with the "blue note" (flat 5th). The soul of blues, rock, and jazz improvisation.' },
  chromatic:      { intervals: [0,1,2,3,4,5,6,7,8,9,10,11], name: 'Chromatic',
    desc: 'All 12 notes. Used for dramatic runs, tension building, and as a technical exercise.' },
  whole_tone:     { intervals: [0,2,4,6,8,10],      name: 'Whole Tone',
    desc: 'All whole steps, no half steps. Dreamy and ambiguous. Debussy loved this scale.' },
};

/* Arpeggio definitions */
const ARPEGGIO_TYPES = {
  major:     { intervals: [0,4,7,12],        name: 'Major Arpeggio',
    desc: 'Broken major triad spanning one octave. The most fundamental arpeggio pattern.' },
  minor:     { intervals: [0,3,7,12],        name: 'Minor Arpeggio',
    desc: 'Broken minor triad. Essential for minor key passages and accompaniment.' },
  dim:       { intervals: [0,3,6,12],        name: 'Diminished Arpeggio',
    desc: 'Tense and dramatic. Great for building tension in classical and jazz contexts.' },
  aug:       { intervals: [0,4,8,12],        name: 'Augmented Arpeggio',
    desc: 'Symmetrical and mysterious. Each note is 4 semitones apart.' },
  maj7:      { intervals: [0,4,7,11,12],     name: 'Major 7th Arpeggio',
    desc: 'Smooth jazz arpeggio. Beautiful cascading sound used in ballads and bossa nova.' },
  dom7:      { intervals: [0,4,7,10,12],     name: 'Dominant 7th Arpeggio',
    desc: 'Bluesy and driving. Essential for jazz improvisation over dominant chords.' },
  min7:      { intervals: [0,3,7,10,12],     name: 'Minor 7th Arpeggio',
    desc: 'Mellow and soulful. Staple jazz arpeggio for comping and soloing.' },
  dim7:      { intervals: [0,3,6,9,12],      name: 'Diminished 7th Arpeggio',
    desc: 'Fully symmetrical — repeats every 3 semitones. Creates maximum tension.' },
  two_oct_major: { intervals: [0,4,7,12,16,19,24], name: 'Two-Octave Major',
    desc: 'Extended major arpeggio spanning two octaves. Great for building speed and range.' },
  two_oct_minor: { intervals: [0,3,7,12,15,19,24], name: 'Two-Octave Minor',
    desc: 'Extended minor arpeggio. Develops finger independence across a wide range.' },
};

/* Common runs */
const RUN_TYPES = {
  major_scale_run:   { name: 'Major Scale Run',
    getIntervals: () => [0,2,4,5,7,9,11,12,11,9,7,5,4,2,0],
    desc: 'Up and down one octave of the major scale. The most fundamental technical exercise.' },
  minor_scale_run:   { name: 'Natural Minor Run',
    getIntervals: () => [0,2,3,5,7,8,10,12,10,8,7,5,3,2,0],
    desc: 'Up and down the natural minor scale. Builds fluency in minor keys.' },
  chromatic_run:     { name: 'Chromatic Run',
    getIntervals: () => [0,1,2,3,4,5,6,7,8,9,10,11,12],
    desc: 'All 12 semitones ascending. The ultimate finger independence exercise.' },
  thirds_run:        { name: 'Thirds Run (Major)',
    getIntervals: () => [0,4,2,5,4,7,5,9,7,11,9,12],
    desc: 'Alternating thirds up the major scale. Builds intervallic fluency and independence.' },
  alberti_bass:      { name: 'Alberti Bass Pattern',
    getIntervals: () => [0,7,4,7, 0,7,4,7],
    desc: 'Root-5th-3rd-5th repeating pattern. The classic Classical-era accompaniment figure (Mozart, Haydn).' },
};

/* Music theory lessons database */
const THEORY_LESSONS = {
  beginner: [
    {
      title: 'The Musical Alphabet',
      concept: 'Music uses 7 natural notes: C D E F G A B, then repeats. The distance from one C to the next C is called an "octave". Between some natural notes are sharps (#) and flats (b), giving us 12 unique pitches total.',
      exercise: 'play_notes',
      exerciseData: { notes: ['C4','D4','E4','F4','G4','A4','B4','C5'], prompt: 'Play each note of the musical alphabet from C4 to C5:' },
    },
    {
      title: 'Half Steps and Whole Steps',
      concept: 'A half step (semitone) is the smallest interval — one key to the very next key (including black keys). A whole step equals two half steps. Example: C to C# is a half step; C to D is a whole step. Notice: E-F and B-C are natural half steps (no black key between them).',
      exercise: 'play_notes',
      exerciseData: { notes: ['C4','C#4','D4','D#4','E4','F4'], prompt: 'Play these notes to hear half steps and whole steps:' },
    },
    {
      title: 'The Major Scale Formula',
      concept: 'A major scale follows the pattern: Whole-Whole-Half-Whole-Whole-Whole-Half (W W H W W W H). Starting from C: C(W)D(W)E(H)F(W)G(W)A(W)B(H)C. This pattern works from ANY starting note to build a major scale.',
      exercise: 'play_scale',
      exerciseData: { root: 'C4', scaleType: 'major', prompt: 'Play the C Major scale using the W-W-H-W-W-W-H pattern:' },
    },
    {
      title: 'The Natural Minor Scale',
      concept: 'The natural minor scale follows: W-H-W-W-H-W-W. Starting from A: A(W)B(H)C(W)D(W)E(H)F(W)G(W)A. It shares the same notes as C major but starts on A — they are "relatives".',
      exercise: 'play_scale',
      exerciseData: { root: 'A3', scaleType: 'natural_minor', prompt: 'Play the A Natural Minor scale (W-H-W-W-H-W-W):' },
    },
    {
      title: 'Major and Minor Triads',
      concept: 'A triad is a 3-note chord. Major triad = root + major 3rd + perfect 5th (4 + 3 semitones). Minor triad = root + minor 3rd + perfect 5th (3 + 4 semitones). The 3rd determines the chord\'s mood: major = happy, minor = sad.',
      exercise: 'play_chord',
      exerciseData: { chords: [
        { notes: ['C4','E4','G4'], name: 'C Major' },
        { notes: ['A3','C4','E4'], name: 'A Minor' },
      ], prompt: 'Play these triads to hear the difference:' },
    },
    {
      title: 'Intervals: The Building Blocks',
      concept: 'An interval is the distance between two notes. Key intervals: Minor 2nd (1 semitone, "Jaws" theme), Major 2nd (2, "Happy Birthday"), Minor 3rd (3, "Greensleeves"), Major 3rd (4, "Kumbaya"), Perfect 4th (5, "Here Comes the Bride"), Perfect 5th (7, "Star Wars"), Octave (12, "Somewhere Over the Rainbow").',
      exercise: 'play_intervals',
      exerciseData: { root: 'C4', intervals: [3, 4, 5, 7, 12], prompt: 'Play C4 then each of these intervals above C4:' },
    },
  ],
  intermediate: [
    {
      title: 'Seventh Chords',
      concept: 'Adding a 7th note on top of a triad creates a seventh chord. Major 7th (maj7): warm, dreamy. Dominant 7th (7): bluesy, wants to resolve. Minor 7th (m7): mellow, soulful. These are the core of jazz and pop harmony.',
      exercise: 'play_chord',
      exerciseData: { chords: [
        { notes: ['C4','E4','G4','B4'], name: 'Cmaj7' },
        { notes: ['G3','B3','D4','F4'], name: 'G7' },
        { notes: ['D4','F4','A4','C5'], name: 'Dm7' },
      ], prompt: 'Play these seventh chords:' },
    },
    {
      title: 'The ii-V-I Progression',
      concept: 'The ii-V-I is the most important chord progression in jazz and pop. In C major: Dm7 → G7 → Cmaj7. The ii (minor) creates gentle tension, the V (dominant) builds stronger tension, and the I (major) resolves everything. Nearly every jazz standard uses this.',
      exercise: 'play_chord',
      exerciseData: { chords: [
        { notes: ['D4','F4','A4','C5'], name: 'Dm7 (ii)' },
        { notes: ['G3','B3','D4','F4'], name: 'G7 (V)' },
        { notes: ['C4','E4','G4','B4'], name: 'Cmaj7 (I)' },
      ], prompt: 'Play the ii-V-I progression in C major:' },
    },
    {
      title: 'Relative Major and Minor',
      concept: 'Every major key has a relative minor that shares the same notes. The relative minor starts on the 6th degree of the major scale. C major ↔ A minor, G major ↔ E minor, F major ↔ D minor. Switching between them creates emotional contrast.',
      exercise: 'play_scale',
      exerciseData: { root: 'C4', scaleType: 'major', prompt: 'Play C Major, then play A Minor (same notes, start on A):' },
    },
    {
      title: 'The Circle of Fifths',
      concept: 'Moving up by perfect 5ths cycles through all 12 keys: C→G→D→A→E→B→F#→Db→Ab→Eb→Bb→F→C. Each step adds one sharp (going right) or one flat (going left). Adjacent keys on the circle share the most notes and sound the most natural together.',
      exercise: 'play_notes',
      exerciseData: { notes: ['C4','G4','D5','A4','E5','B4'], prompt: 'Play the first 6 notes of the circle of fifths:' },
    },
    {
      title: 'Chord Inversions',
      concept: 'An inversion rearranges which note is on the bottom. Root position: C-E-G. 1st inversion: E-G-C. 2nd inversion: G-C-E. Inversions create smoother voice leading between chords and are essential for good piano accompaniment.',
      exercise: 'play_chord',
      exerciseData: { chords: [
        { notes: ['C4','E4','G4'], name: 'C Root Position' },
        { notes: ['E4','G4','C5'], name: 'C 1st Inversion' },
        { notes: ['G3','C4','E4'], name: 'C 2nd Inversion' },
      ], prompt: 'Play all three inversions of C major:' },
    },
    {
      title: 'Modes: Dorian and Mixolydian',
      concept: 'Modes are scales built on different degrees of the major scale. Dorian (2nd degree): minor with a bright 6th — jazzy, funky (think "So What" by Miles Davis). Mixolydian (5th degree): major with a flat 7th — bluesy, rock (think "Norwegian Wood").',
      exercise: 'play_scale',
      exerciseData: { root: 'D4', scaleType: 'dorian', prompt: 'Play D Dorian (D E F G A B C D — like C major starting on D):' },
    },
  ],
  advanced: [
    {
      title: 'Diminished & Augmented Chords',
      concept: 'Diminished chord (°): built on stacked minor 3rds (0-3-6). Very tense. Diminished 7th (°7): 0-3-6-9, completely symmetrical — only 3 unique dim7 chords exist! Augmented (+): stacked major 3rds (0-4-8), dreamlike. Augmented = only 4 unique ones exist.',
      exercise: 'play_chord',
      exerciseData: { chords: [
        { notes: ['B3','D4','F4'], name: 'B dim' },
        { notes: ['B3','D4','F4','G#4'], name: 'B dim7' },
        { notes: ['C4','E4','G#4'], name: 'C aug' },
      ], prompt: 'Play these symmetrical chords:' },
    },
    {
      title: 'Secondary Dominants',
      concept: 'A secondary dominant is a dominant 7th chord that resolves to a chord other than the tonic. In C major, D7→G is V/V→V (the "five of five"). It borrows F# from G major to create tension. Any diatonic chord can be "tonicized" this way.',
      exercise: 'play_chord',
      exerciseData: { chords: [
        { notes: ['D4','F#4','A4','C5'], name: 'D7 (V/V)' },
        { notes: ['G3','B3','D4','F4'], name: 'G7 (V)' },
        { notes: ['C4','E4','G4','B4'], name: 'Cmaj7 (I)' },
      ], prompt: 'Play the secondary dominant chain: V/V → V → I:' },
    },
    {
      title: 'The Harmonic Minor Scale',
      concept: 'The harmonic minor raises the 7th of natural minor, creating a leading tone (1 semitone below tonic). This gives the V chord a major quality in minor keys. The interval between b6 and #7 (an augmented 2nd, 3 semitones) gives it a distinctive "exotic" sound.',
      exercise: 'play_scale',
      exerciseData: { root: 'A3', scaleType: 'harmonic_minor', prompt: 'Play A Harmonic Minor (note the augmented 2nd between F and G#):' },
    },
    {
      title: 'Tritone Substitution',
      concept: 'A tritone sub replaces a dominant 7th chord with another dominant 7th a tritone (6 semitones) away. G7 → Db7, both sharing the same tritone interval (B↔F = Cb↔F). The bass moves by half step instead of a 5th: Db7 → Cmaj7. Extremely common in jazz.',
      exercise: 'play_chord',
      exerciseData: { chords: [
        { notes: ['D4','F4','A4','C5'], name: 'Dm7 (ii)' },
        { notes: ['Db4','F4','Ab4','B4'], name: 'Db7 (tritone sub of G7)' },
        { notes: ['C4','E4','G4','B4'], name: 'Cmaj7 (I)' },
      ], prompt: 'Play ii → bII7 → I (tritone substitution):' },
    },
    {
      title: 'Altered Dominants',
      concept: 'An altered dominant raises or lowers the 5th and 9th: b5, #5, b9, #9. The "altered scale" (7th mode of melodic minor) contains all these alterations. It creates maximum tension before resolution. The "#9" is the famous "Hendrix chord" (E7#9).',
      exercise: 'play_chord',
      exerciseData: { chords: [
        { notes: ['G3','B3','Db4','F4'], name: 'G7b5' },
        { notes: ['E3','G#3','D4','G4'], name: 'E7#9 (Hendrix chord)' },
      ], prompt: 'Play these altered dominant voicings:' },
    },
    {
      title: 'Modal Interchange (Borrowed Chords)',
      concept: 'Modal interchange borrows chords from a parallel mode. In C major, borrowing from C minor gives us: bVII (Bb major), bVI (Ab major), bIII (Eb major), iv (F minor). These add emotional depth. The bVI-bVII-I progression is iconic in rock music.',
      exercise: 'play_chord',
      exerciseData: { chords: [
        { notes: ['Ab3','C4','Eb4'], name: 'Ab (bVI, borrowed)' },
        { notes: ['Bb3','D4','F4'], name: 'Bb (bVII, borrowed)' },
        { notes: ['C4','E4','G4'], name: 'C (I)' },
      ], prompt: 'Play the bVI-bVII-I rock progression in C:' },
    },
  ],
};


/* =================================================================
   TrainingCenter class
   ================================================================= */
class TrainingCenter {

  constructor(game) {
    this.game = game; // reference to GuitarHeroGame for audio/input

    /* state */
    this.active = false;
    this.currentMode = null; // 'ear_note','ear_chord','arpeggios','chords','theory'
    this.difficulty = 'easy'; // easy, medium, hard
    this.skillLevel = 'beginner'; // beginner, intermediate, advanced

    /* ear training state */
    this.targetNotes = [];      // MIDI notes the player must guess
    this.targetChordInfo = null; // chord analysis for display
    this.guessedCorrectly = false;
    this.revealAnswer = false;
    this.streakCount = 0;
    this.totalAttempts = 0;
    this.correctAttempts = 0;

    /* arpeggio/run state */
    this.arpeggioSequence = [];  // array of MIDI notes to play in order
    this.arpeggioIndex = 0;      // current note index
    this.arpeggioName = '';
    this.arpeggioDesc = '';
    this.arpeggioComplete = false;

    /* chord training state */
    this.targetChord = null;     // { notes: [midi...], name, desc }
    this.chordHeld = [];         // notes currently pressed

    /* theory lesson state */
    this.currentLesson = null;
    this.lessonExerciseIdx = 0;
    this.lessonComplete = false;
    this.lessonNotesPlayed = [];
    this.usedLessons = new Set(); // track shown lessons to avoid repeats

    /* audio context for playing sounds */
    this.audioCtx = null;
    this.activeOscillators = new Map();

    /* input tracking */
    this.pressedNotes = new Set();

    /* DOM */
    this._buildUI();
  }

  /* ---------- Audio ---------- */

  _ensureAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
  }

  _midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  _playNote(midi, duration = 0.8) {
    this._ensureAudio();
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = this._midiToFreq(midi);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  _playChord(midiNotes, duration = 1.2) {
    for (const n of midiNotes) this._playNote(n, duration);
  }

  _playSequence(midiNotes, intervalMs = 300, callback) {
    midiNotes.forEach((n, i) => {
      setTimeout(() => {
        this._playNote(n, 0.5);
        if (callback) callback(n, i);
      }, i * intervalMs);
    });
  }

  /* ---------- UI Construction ---------- */

  _buildUI() {
    /* Main overlay */
    this.overlay = document.createElement('div');
    this.overlay.id = 'training-overlay';
    this.overlay.className = 'training-overlay';
    this.overlay.style.display = 'none';
    this.overlay.innerHTML = this._mainMenuHTML();
    document.body.appendChild(this.overlay);

    /* Exercise area (replaces main menu when in a mode) */
    this.exerciseArea = document.createElement('div');
    this.exerciseArea.id = 'training-exercise';
    this.exerciseArea.className = 'training-exercise';
    this.exerciseArea.style.display = 'none';
    document.body.appendChild(this.exerciseArea);
  }

  _mainMenuHTML() {
    return `
      <div class="training-panel">
        <div class="training-header">
          <h2>🎓 Training Center</h2>
          <button class="training-close" id="training-close">✕</button>
        </div>
        <div class="training-modes">
          <div class="training-card" data-mode="ear_note">
            <div class="training-card-icon">👂</div>
            <h3>Ear Training: Notes</h3>
            <p>Hear a note, guess it on your keyboard. Train your pitch recognition.</p>
          </div>
          <div class="training-card" data-mode="ear_chord">
            <div class="training-card-icon">🎵</div>
            <h3>Ear Training: Chords</h3>
            <p>Hear a chord, identify it. Learn chord types, names, and their uses.</p>
          </div>
          <div class="training-card" data-mode="arpeggios">
            <div class="training-card-icon">🎹</div>
            <h3>Arpeggios &amp; Runs</h3>
            <p>Practice common arpeggios, scale runs, and patterns interactively.</p>
          </div>
          <div class="training-card" data-mode="chords">
            <div class="training-card-icon">🎶</div>
            <h3>Chord Training</h3>
            <p>Learn chord shapes, inversions, and progressions hands-on.</p>
          </div>
          <div class="training-card" data-mode="theory">
            <div class="training-card-icon">📖</div>
            <h3>Music Theory Lessons</h3>
            <p>Interactive lessons on intervals, scales, chords, progressions, and more.</p>
          </div>
        </div>
        <div class="training-settings">
          <label>Skill Level:
            <select id="training-skill">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
        </div>
      </div>`;
  }

  /* ---------- Show / Hide ---------- */

  show() {
    this.active = true;
    this.currentMode = null;
    this.overlay.style.display = 'flex';
    this.exerciseArea.style.display = 'none';
    this._bindMenuEvents();
  }

  hide() {
    this.active = false;
    this.currentMode = null;
    this.overlay.style.display = 'none';
    this.exerciseArea.style.display = 'none';
    this.pressedNotes.clear();
  }

  _bindMenuEvents() {
    const close = this.overlay.querySelector('#training-close');
    if (close) close.onclick = () => this.hide();

    const cards = this.overlay.querySelectorAll('.training-card');
    cards.forEach(c => {
      c.onclick = () => {
        const mode = c.getAttribute('data-mode');
        const skillSel = this.overlay.querySelector('#training-skill');
        this.skillLevel = skillSel ? skillSel.value : 'beginner';
        this._startMode(mode);
      };
    });
  }

  /* ---------- Mode Launcher ---------- */

  _startMode(mode) {
    this.currentMode = mode;
    this.overlay.style.display = 'none';
    this.exerciseArea.style.display = 'flex';
    this.streakCount = 0;
    this.totalAttempts = 0;
    this.correctAttempts = 0;
    this.pressedNotes.clear();

    switch (mode) {
      case 'ear_note':   this._initEarNote(); break;
      case 'ear_chord':  this._initEarChord(); break;
      case 'arpeggios':  this._initArpeggios(); break;
      case 'chords':     this._initChords(); break;
      case 'theory':     this._initTheory(); break;
    }
  }

  _backToMenu() {
    this.exerciseArea.style.display = 'none';
    this.currentMode = null;
    this.show();
  }

  /* ---------- Header/Footer for exercise panels ---------- */

  _exerciseHeaderHTML(title, showDifficulty = true) {
    const diffOptions = showDifficulty ? `
      <label>Difficulty:
        <select id="ex-difficulty">
          <option value="easy" ${this.difficulty==='easy'?'selected':''}>Easy</option>
          <option value="medium" ${this.difficulty==='medium'?'selected':''}>Medium</option>
          <option value="hard" ${this.difficulty==='hard'?'selected':''}>Hard</option>
        </select>
      </label>` : '';
    return `
      <div class="ex-header">
        <button class="ex-back" id="ex-back">← Back</button>
        <h2>${title}</h2>
        ${diffOptions}
        <div class="ex-stats">
          <span id="ex-streak">🔥 0</span>
          <span id="ex-score">✓ 0 / 0</span>
        </div>
      </div>`;
  }

  _bindExerciseHeader() {
    const back = this.exerciseArea.querySelector('#ex-back');
    if (back) back.onclick = () => this._backToMenu();

    const diff = this.exerciseArea.querySelector('#ex-difficulty');
    if (diff) {
      diff.onchange = () => {
        this.difficulty = diff.value;
        this._startMode(this.currentMode); // restart with new difficulty
      };
    }
  }

  _updateStats() {
    const streak = this.exerciseArea.querySelector('#ex-streak');
    const score = this.exerciseArea.querySelector('#ex-score');
    if (streak) streak.textContent = '🔥 ' + this.streakCount;
    if (score) score.textContent = '✓ ' + this.correctAttempts + ' / ' + this.totalAttempts;
  }

  /* =================================================================
     EAR TRAINING: SINGLE NOTES
     ================================================================= */

  _earNoteRange() {
    // Easy=1 octave (C4-B4), Medium=2 octaves (C3-B4), Hard=4 octaves (C2-B5)
    switch (this.difficulty) {
      case 'easy':   return { low: MIDI_C4, high: MIDI_B4 };
      case 'medium': return { low: MIDI_C3, high: MIDI_B4 };
      case 'hard':   return { low: MIDI_C2, high: MIDI_B5 };
      default:       return { low: MIDI_C4, high: MIDI_B4 };
    }
  }

  _initEarNote() {
    this.guessedCorrectly = false;
    this.revealAnswer = false;
    this._generateEarNote();
    this._renderEarNote();
  }

  _generateEarNote() {
    const range = this._earNoteRange();
    const midi = range.low + Math.floor(Math.random() * (range.high - range.low + 1));
    this.targetNotes = [midi];
    this.guessedCorrectly = false;
    this.revealAnswer = false;
  }

  _renderEarNote() {
    const range = this._earNoteRange();
    this.exerciseArea.innerHTML = `
      ${this._exerciseHeaderHTML('👂 Ear Training: Single Notes')}
      <div class="ex-body">
        <div class="ex-instruction">
          <p>A note will play. Press the matching key on your MIDI keyboard (or computer keyboard).</p>
          <p class="ex-range">Range: ${midiToNoteName(range.low)} — ${midiToNoteName(range.high)}</p>
        </div>
        <div class="ex-play-area">
          <button class="ex-play-btn" id="ex-play-note">🔊 Play Note</button>
          <button class="ex-play-btn ex-secondary" id="ex-replay-note">🔁 Replay</button>
          <button class="ex-play-btn ex-secondary" id="ex-reveal-note">👁 Reveal</button>
        </div>
        <div class="ex-feedback" id="ex-feedback"></div>
        <div class="ex-info-box" id="ex-note-info" style="display:none"></div>
        <button class="ex-play-btn ex-next" id="ex-next" style="display:none">Next →</button>
      </div>`;
    this._bindExerciseHeader();

    const playBtn = this.exerciseArea.querySelector('#ex-play-note');
    const replayBtn = this.exerciseArea.querySelector('#ex-replay-note');
    const revealBtn = this.exerciseArea.querySelector('#ex-reveal-note');
    const nextBtn = this.exerciseArea.querySelector('#ex-next');

    playBtn.onclick = () => this._playNote(this.targetNotes[0]);
    replayBtn.onclick = () => this._playNote(this.targetNotes[0]);
    revealBtn.onclick = () => {
      this.revealAnswer = true;
      this._showNoteResult(this.targetNotes[0], null, true);
    };
    nextBtn.onclick = () => {
      this._generateEarNote();
      this._renderEarNote();
      setTimeout(() => this._playNote(this.targetNotes[0]), 300);
    };

    // Auto-play the first note
    setTimeout(() => this._playNote(this.targetNotes[0]), 400);
  }

  _showNoteResult(target, guessed, isReveal) {
    const fb = this.exerciseArea.querySelector('#ex-feedback');
    const info = this.exerciseArea.querySelector('#ex-note-info');
    const next = this.exerciseArea.querySelector('#ex-next');
    if (!fb || !info || !next) return;

    const targetName = midiToNoteName(target);
    const pitchClass = NOTE_NAMES[target % 12];
    const octave = Math.floor(target / 12) - 1;

    if (isReveal) {
      fb.innerHTML = `<span class="ex-reveal">The note was: <strong>${targetName}</strong></span>`;
    } else if (guessed === target) {
      fb.innerHTML = `<span class="ex-correct">✓ Correct! <strong>${targetName}</strong></span>`;
    } else if (guessed % 12 === target % 12) {
      fb.innerHTML = `<span class="ex-close">~ Right note, wrong octave! It was <strong>${targetName}</strong>, you played ${midiToNoteName(guessed)}</span>`;
    } else {
      fb.innerHTML = `<span class="ex-wrong">✗ It was <strong>${targetName}</strong>, you played ${midiToNoteName(guessed)}</span>`;
    }

    // Show note info
    const enharmonic = NOTE_NAMES_FLAT[target % 12] !== pitchClass ? ` (also called ${NOTE_NAMES_FLAT[target % 12]}${octave})` : '';
    info.style.display = 'block';
    info.innerHTML = `
      <h4>${pitchClass} — ${this._noteDescription(pitchClass)}</h4>
      <p>MIDI number: ${target} | Frequency: ${this._midiToFreq(target).toFixed(1)} Hz${enharmonic}</p>
      <p>Octave ${octave} — ${this._octaveDescription(octave)}</p>`;
    next.style.display = 'inline-block';
  }

  _noteDescription(pc) {
    const descs = {
      'C': 'The "home base" of Western music. C major has no sharps or flats.',
      'C#': 'Also Db. An important key in jazz and romantic music.',
      'D': 'A bright, ringing key. Popular for violin music and folk songs.',
      'D#': 'Also Eb. A warm key common in jazz, R&B, and brass music.',
      'E': 'A naturally resonant key on guitar and piano. Common in rock.',
      'F': 'A warm, pastoral key. One flat in its major scale (Bb).',
      'F#': 'Also Gb. An exotic, distant key often used for contrast.',
      'G': 'A popular key for folk, country, and rock. Bright and accessible.',
      'G#': 'Also Ab. A romantic, expressive key loved by Chopin and Beethoven.',
      'A': 'The tuning reference (A4 = 440 Hz). Central to orchestral music.',
      'A#': 'Also Bb. The key of many jazz standards and trumpet music.',
      'B': 'A sharp, crystalline key. Less common but distinctive.',
    };
    return descs[pc] || '';
  }

  _octaveDescription(oct) {
    const descs = {
      0: 'Sub-bass range. The lowest piano keys — more felt than heard.',
      1: 'Deep bass range. Low rumbling, organ pedal tones.',
      2: 'Bass range. Left hand bass notes, cello territory.',
      3: 'Tenor range. Left hand melodies, viola, and tenor voice.',
      4: 'Middle range (contains Middle C). The center of the piano.',
      5: 'Treble range. Right hand melodies, violin, soprano voice.',
      6: 'High treble. Bright, sparkling. Upper piano register.',
      7: 'Highest range. Delicate, bell-like tones. Top of the piano.',
    };
    return descs[oct] || 'Extended range.';
  }

  /* =================================================================
     EAR TRAINING: CHORDS
     ================================================================= */

  _earChordTypes() {
    switch (this.difficulty) {
      case 'easy':
        return ['major', 'minor', 'dim', 'aug', 'sus4', 'power'];
      case 'medium':
        return ['major', 'minor', 'dim', 'aug', 'sus2', 'sus4', 'maj7', 'dom7', 'min7', 'power'];
      case 'hard':
        return Object.keys(CHORD_TYPES);
      default:
        return ['major', 'minor'];
    }
  }

  _initEarChord() {
    this.guessedCorrectly = false;
    this.revealAnswer = false;
    this._generateEarChord();
    this._renderEarChord();
  }

  _generateEarChord() {
    const types = this._earChordTypes();
    const typeKey = types[Math.floor(Math.random() * types.length)];
    const chordDef = CHORD_TYPES[typeKey];

    // Random root in comfortable range (C3-C5)
    const rootRange = this.difficulty === 'hard' ? { low: MIDI_C2, high: MIDI_C5 } : { low: MIDI_C3, high: MIDI_C5 };
    const root = rootRange.low + Math.floor(Math.random() * (rootRange.high - rootRange.low + 1));

    const notes = chordDef.intervals.map(i => root + i);
    this.targetNotes = notes;
    this.targetChordInfo = {
      root,
      rootName: NOTE_NAMES[root % 12],
      typeKey,
      type: chordDef,
      fullName: NOTE_NAMES[root % 12] + chordDef.symbol,
      notes,
    };
    this.guessedCorrectly = false;
    this.revealAnswer = false;
  }

  _renderEarChord() {
    const types = this._earChordTypes();
    this.exerciseArea.innerHTML = `
      ${this._exerciseHeaderHTML('🎵 Ear Training: Chords')}
      <div class="ex-body">
        <div class="ex-instruction">
          <p>A chord will play. Try to identify it by playing the same notes, or press a button below.</p>
          <p class="ex-range">Chord types (${this.difficulty}): ${types.map(t => CHORD_TYPES[t].name).join(', ')}</p>
        </div>
        <div class="ex-play-area">
          <button class="ex-play-btn" id="ex-play-chord">🔊 Play Chord</button>
          <button class="ex-play-btn ex-secondary" id="ex-replay-chord">🔁 Replay</button>
          <button class="ex-play-btn ex-secondary" id="ex-arpeggiate">🎶 Arpeggiate</button>
          <button class="ex-play-btn ex-secondary" id="ex-reveal-chord">👁 Reveal</button>
        </div>
        <div class="ex-chord-buttons" id="ex-chord-buttons">
          ${types.map(t => `<button class="ex-chord-guess" data-type="${t}">${CHORD_TYPES[t].name}</button>`).join('')}
        </div>
        <div class="ex-feedback" id="ex-feedback"></div>
        <div class="ex-info-box" id="ex-chord-info" style="display:none"></div>
        <button class="ex-play-btn ex-next" id="ex-next" style="display:none">Next →</button>
      </div>`;
    this._bindExerciseHeader();

    const playBtn = this.exerciseArea.querySelector('#ex-play-chord');
    const replayBtn = this.exerciseArea.querySelector('#ex-replay-chord');
    const arpBtn = this.exerciseArea.querySelector('#ex-arpeggiate');
    const revealBtn = this.exerciseArea.querySelector('#ex-reveal-chord');
    const nextBtn = this.exerciseArea.querySelector('#ex-next');

    playBtn.onclick = () => this._playChord(this.targetNotes);
    replayBtn.onclick = () => this._playChord(this.targetNotes);
    arpBtn.onclick = () => this._playSequence(this.targetNotes, 250);
    revealBtn.onclick = () => {
      this.revealAnswer = true;
      this._showChordResult(null, true);
    };
    nextBtn.onclick = () => {
      this._generateEarChord();
      this._renderEarChord();
      setTimeout(() => this._playChord(this.targetNotes), 300);
    };

    // Chord type guess buttons
    const guessButtons = this.exerciseArea.querySelectorAll('.ex-chord-guess');
    guessButtons.forEach(btn => {
      btn.onclick = () => {
        if (this.guessedCorrectly || this.revealAnswer) return;
        const guessType = btn.getAttribute('data-type');
        this.totalAttempts++;
        if (guessType === this.targetChordInfo.typeKey) {
          this.guessedCorrectly = true;
          this.correctAttempts++;
          this.streakCount++;
          this._showChordResult(guessType, false);
        } else {
          this.streakCount = 0;
          this._showChordResult(guessType, false);
        }
        this._updateStats();
      };
    });

    setTimeout(() => this._playChord(this.targetNotes), 400);
  }

  _showChordResult(guessType, isReveal) {
    const fb = this.exerciseArea.querySelector('#ex-feedback');
    const info = this.exerciseArea.querySelector('#ex-chord-info');
    const next = this.exerciseArea.querySelector('#ex-next');
    if (!fb || !info || !next) return;

    const ci = this.targetChordInfo;
    if (isReveal) {
      fb.innerHTML = `<span class="ex-reveal">The chord was: <strong>${ci.fullName}</strong> (${ci.type.name})</span>`;
    } else if (guessType === ci.typeKey) {
      fb.innerHTML = `<span class="ex-correct">✓ Correct! <strong>${ci.fullName}</strong></span>`;
    } else {
      const guessedName = CHORD_TYPES[guessType] ? CHORD_TYPES[guessType].name : guessType;
      fb.innerHTML = `<span class="ex-wrong">✗ Not ${guessedName}. It was <strong>${ci.fullName}</strong> (${ci.type.name})</span>`;
    }

    info.style.display = 'block';
    const notesList = ci.notes.map(n => midiToNoteName(n)).join(', ');
    const intervalsList = ci.type.intervals.map(i => INTERVAL_NAMES[i] || (i + ' semitones')).join(', ');
    info.innerHTML = `
      <h4>${ci.fullName} — ${ci.type.name}</h4>
      <p><strong>Notes:</strong> ${notesList}</p>
      <p><strong>Intervals:</strong> ${intervalsList}</p>
      <p><strong>Structure:</strong> ${ci.type.intervals.join('-')} semitones from root</p>
      <p class="ex-desc">${ci.type.desc}</p>`;
    next.style.display = 'inline-block';
  }

  /* =================================================================
     ARPEGGIOS & RUNS
     ================================================================= */

  _initArpeggios() {
    this._generateArpeggio();
    this._renderArpeggio();
  }

  _getArpeggioList() {
    switch (this.difficulty) {
      case 'easy':
        return { arps: ['major','minor'], runs: ['major_scale_run'] };
      case 'medium':
        return { arps: ['major','minor','dim','aug','maj7','dom7','min7'], runs: ['major_scale_run','minor_scale_run','thirds_run'] };
      case 'hard':
        return { arps: Object.keys(ARPEGGIO_TYPES), runs: Object.keys(RUN_TYPES) };
      default:
        return { arps: ['major','minor'], runs: [] };
    }
  }

  _generateArpeggio() {
    const list = this._getArpeggioList();
    const allKeys = [...list.arps.map(k => ({type:'arp', key:k})), ...list.runs.map(k => ({type:'run', key:k}))];
    const choice = allKeys[Math.floor(Math.random() * allKeys.length)];

    // Random root C3-C5
    const root = MIDI_C3 + Math.floor(Math.random() * (MIDI_C5 - MIDI_C3 + 1));

    let intervals, name, desc;
    if (choice.type === 'arp') {
      const arp = ARPEGGIO_TYPES[choice.key];
      intervals = arp.intervals;
      name = NOTE_NAMES[root % 12] + ' ' + arp.name;
      desc = arp.desc;
    } else {
      const run = RUN_TYPES[choice.key];
      intervals = run.getIntervals();
      name = NOTE_NAMES[root % 12] + ' ' + run.name;
      desc = run.desc;
    }

    this.arpeggioSequence = intervals.map(i => root + i);
    this.arpeggioName = name;
    this.arpeggioDesc = desc;
    this.arpeggioIndex = 0;
    this.arpeggioComplete = false;
  }

  _renderArpeggio() {
    this.exerciseArea.innerHTML = `
      ${this._exerciseHeaderHTML('🎹 Arpeggios & Runs')}
      <div class="ex-body">
        <div class="ex-instruction">
          <p>Play the highlighted notes in sequence. Listen first, then try it yourself!</p>
        </div>
        <div class="ex-play-area">
          <button class="ex-play-btn" id="ex-demo-arp">🔊 Listen</button>
          <button class="ex-play-btn ex-secondary" id="ex-restart-arp">🔄 Restart</button>
        </div>
        <div class="ex-arp-name"><h3>${this.arpeggioName}</h3><p class="ex-desc">${this.arpeggioDesc}</p></div>
        <div class="ex-note-track" id="ex-note-track"></div>
        <div class="ex-feedback" id="ex-feedback"></div>
        <button class="ex-play-btn ex-next" id="ex-next" style="display:none">Next Pattern →</button>
      </div>`;
    this._bindExerciseHeader();
    this._renderArpNotes();

    const demoBtn = this.exerciseArea.querySelector('#ex-demo-arp');
    const restartBtn = this.exerciseArea.querySelector('#ex-restart-arp');
    const nextBtn = this.exerciseArea.querySelector('#ex-next');

    demoBtn.onclick = () => this._playSequence(this.arpeggioSequence, 300);
    restartBtn.onclick = () => {
      this.arpeggioIndex = 0;
      this.arpeggioComplete = false;
      this._renderArpNotes();
      const fb = this.exerciseArea.querySelector('#ex-feedback');
      if (fb) fb.innerHTML = '';
      const nx = this.exerciseArea.querySelector('#ex-next');
      if (nx) nx.style.display = 'none';
    };
    nextBtn.onclick = () => {
      this._generateArpeggio();
      this._renderArpeggio();
    };
  }

  _renderArpNotes() {
    const track = this.exerciseArea.querySelector('#ex-note-track');
    if (!track) return;
    track.innerHTML = this.arpeggioSequence.map((n, i) => {
      let cls = 'arp-note';
      if (i < this.arpeggioIndex) cls += ' arp-done';
      else if (i === this.arpeggioIndex) cls += ' arp-active';
      return `<div class="${cls}"><span class="arp-note-name">${midiToNoteName(n)}</span></div>`;
    }).join('<span class="arp-arrow">→</span>');
  }

  /* =================================================================
     CHORD TRAINING
     ================================================================= */

  _initChords() {
    this._generateChordExercise();
    this._renderChordExercise();
  }

  _getChordTrainingTypes() {
    switch (this.difficulty) {
      case 'easy':
        return ['major','minor','sus4','power'];
      case 'medium':
        return ['major','minor','dim','aug','sus2','sus4','maj7','dom7','min7'];
      case 'hard':
        return Object.keys(CHORD_TYPES);
      default:
        return ['major','minor'];
    }
  }

  _generateChordExercise() {
    const types = this._getChordTrainingTypes();
    const typeKey = types[Math.floor(Math.random() * types.length)];
    const chordDef = CHORD_TYPES[typeKey];
    const root = MIDI_C3 + Math.floor(Math.random() * (MIDI_C5 - MIDI_C3 + 1)); // C3-C5

    const notes = chordDef.intervals.map(i => root + i);
    this.targetChord = {
      root,
      rootName: NOTE_NAMES[root % 12],
      typeKey,
      type: chordDef,
      fullName: NOTE_NAMES[root % 12] + chordDef.symbol,
      notes,
    };
    this.chordHeld = [];
    this.guessedCorrectly = false;
  }

  _renderChordExercise() {
    const tc = this.targetChord;
    const notesList = tc.notes.map(n => midiToNoteName(n)).join(', ');
    this.exerciseArea.innerHTML = `
      ${this._exerciseHeaderHTML('🎶 Chord Training')}
      <div class="ex-body">
        <div class="ex-instruction">
          <p>Play the following chord on your keyboard:</p>
        </div>
        <div class="ex-chord-display">
          <div class="ex-chord-name">${tc.fullName}</div>
          <div class="ex-chord-type">${tc.type.name}</div>
          <div class="ex-chord-notes">Notes: ${notesList}</div>
        </div>
        <div class="ex-play-area">
          <button class="ex-play-btn" id="ex-hear-chord">🔊 Hear It</button>
          <button class="ex-play-btn ex-secondary" id="ex-arp-chord">🎶 Arpeggiate</button>
        </div>
        <div class="ex-info-box">
          <p class="ex-desc">${tc.type.desc}</p>
          <p><strong>Intervals:</strong> ${tc.type.intervals.map(i => INTERVAL_NAMES[i] || (i + ' semitones')).join(', ')}</p>
        </div>
        <div class="ex-feedback" id="ex-feedback">
          <p class="ex-hint">Hold all notes simultaneously...</p>
        </div>
        <button class="ex-play-btn ex-next" id="ex-next" style="display:none">Next Chord →</button>
      </div>`;
    this._bindExerciseHeader();

    this.exerciseArea.querySelector('#ex-hear-chord').onclick = () => this._playChord(tc.notes);
    this.exerciseArea.querySelector('#ex-arp-chord').onclick = () => this._playSequence(tc.notes, 250);
    this.exerciseArea.querySelector('#ex-next').onclick = () => {
      this._generateChordExercise();
      this._renderChordExercise();
    };
  }

  /* =================================================================
     MUSIC THEORY LESSONS
     ================================================================= */

  _initTheory() {
    this.lessonComplete = false;
    this.lessonExerciseIdx = 0;
    this.lessonNotesPlayed = [];
    this._generateLesson();
    this._renderLesson();
  }

  _generateLesson() {
    const pool = THEORY_LESSONS[this.skillLevel] || THEORY_LESSONS.beginner;
    // Find a lesson we haven't shown yet
    let available = pool.filter((_, i) => !this.usedLessons.has(this.skillLevel + '_' + i));
    if (available.length === 0) {
      // Reset if all used
      const keysToDelete = [...this.usedLessons].filter(key => key.startsWith(this.skillLevel + '_'));
      keysToDelete.forEach(key => this.usedLessons.delete(key));
      available = pool;
    }
    const idx = pool.indexOf(available[Math.floor(Math.random() * available.length)]);
    this.usedLessons.add(this.skillLevel + '_' + idx);
    this.currentLesson = pool[idx];
    this.lessonComplete = false;
    this.lessonExerciseIdx = 0;
    this.lessonNotesPlayed = [];
  }

  _renderLesson() {
    const lesson = this.currentLesson;
    if (!lesson) return;

    let exerciseHTML = '';
    const ed = lesson.exerciseData;
    if (lesson.exercise === 'play_notes') {
      exerciseHTML = `
        <div class="ex-lesson-exercise">
          <p class="ex-prompt">${ed.prompt}</p>
          <div class="ex-note-track" id="ex-note-track">
            ${ed.notes.map((n, i) => `<div class="arp-note${i === 0 ? ' arp-active' : ''}"><span class="arp-note-name">${n}</span></div>`).join('<span class="arp-arrow">→</span>')}
          </div>
        </div>`;
    } else if (lesson.exercise === 'play_scale') {
      const scale = SCALE_TYPES[ed.scaleType];
      const rootMidi = noteNameToMidi(ed.root);
      const scaleNotes = scale.intervals.map(i => midiToNoteName(rootMidi + i));
      exerciseHTML = `
        <div class="ex-lesson-exercise">
          <p class="ex-prompt">${ed.prompt}</p>
          <p class="ex-scale-info"><strong>${NOTE_NAMES[rootMidi%12]} ${scale.name}</strong>: ${scale.desc}</p>
          <div class="ex-note-track" id="ex-note-track">
            ${scaleNotes.map((n, i) => `<div class="arp-note${i === 0 ? ' arp-active' : ''}"><span class="arp-note-name">${n}</span></div>`).join('<span class="arp-arrow">→</span>')}
          </div>
          <button class="ex-play-btn ex-secondary" id="ex-hear-scale">🔊 Hear Scale</button>
        </div>`;
    } else if (lesson.exercise === 'play_chord') {
      exerciseHTML = `
        <div class="ex-lesson-exercise">
          <p class="ex-prompt">${ed.prompt}</p>
          <div id="ex-chord-sequence">
            ${ed.chords.map((c, i) => `
              <div class="ex-lesson-chord${i === 0 ? ' chord-active' : ''}" data-idx="${i}">
                <div class="ex-chord-name">${c.name}</div>
                <div class="ex-chord-notes">${c.notes.join(', ')}</div>
              </div>
            `).join('')}
          </div>
          <button class="ex-play-btn ex-secondary" id="ex-hear-progression">🔊 Hear Progression</button>
        </div>`;
    } else if (lesson.exercise === 'play_intervals') {
      const rootMidi = noteNameToMidi(ed.root);
      const intervalNotes = ed.intervals.map(i => midiToNoteName(rootMidi + i));
      exerciseHTML = `
        <div class="ex-lesson-exercise">
          <p class="ex-prompt">${ed.prompt}</p>
          <div class="ex-note-track" id="ex-note-track">
            <div class="arp-note arp-done"><span class="arp-note-name">${ed.root}</span></div>
            <span class="arp-arrow">then</span>
            ${intervalNotes.map((n, i) => `<div class="arp-note${i === 0 ? ' arp-active' : ''}"><span class="arp-note-name">${n}</span><span class="arp-interval-label">${INTERVAL_NAMES[ed.intervals[i]]}</span></div>`).join('<span class="arp-arrow">→</span>')}
          </div>
        </div>`;
    }

    this.exerciseArea.innerHTML = `
      ${this._exerciseHeaderHTML('📖 Music Theory', false)}
      <div class="ex-body">
        <div class="ex-lesson">
          <h3 class="ex-lesson-title">${lesson.title}</h3>
          <div class="ex-lesson-concept">${lesson.concept}</div>
          ${exerciseHTML}
        </div>
        <div class="ex-feedback" id="ex-feedback"></div>
        <button class="ex-play-btn ex-next" id="ex-next" style="display:none">Next Lesson →</button>
      </div>`;
    this._bindExerciseHeader();

    // Bind hear buttons
    const hearScale = this.exerciseArea.querySelector('#ex-hear-scale');
    if (hearScale && lesson.exerciseData) {
      const rootMidi = noteNameToMidi(lesson.exerciseData.root);
      const scale = SCALE_TYPES[lesson.exerciseData.scaleType];
      if (scale) {
        hearScale.onclick = () => this._playSequence(scale.intervals.map(i => rootMidi + i), 300);
      }
    }

    const hearProg = this.exerciseArea.querySelector('#ex-hear-progression');
    if (hearProg && lesson.exerciseData && lesson.exerciseData.chords) {
      hearProg.onclick = () => {
        const chords = lesson.exerciseData.chords;
        chords.forEach((c, i) => {
          setTimeout(() => {
            const midiNotes = c.notes.map(n => noteNameToMidi(n));
            this._playChord(midiNotes, 1.0);
          }, i * 1200);
        });
      };
    }

    const nextBtn = this.exerciseArea.querySelector('#ex-next');
    if (nextBtn) {
      nextBtn.onclick = () => {
        this._generateLesson();
        this._renderLesson();
      };
    }
  }

  /* =================================================================
     INPUT HANDLING — called by GuitarHeroGame on note on/off
     ================================================================= */

  onNoteOn(midi) {
    if (!this.active || !this.currentMode) return;
    this.pressedNotes.add(midi);

    switch (this.currentMode) {
      case 'ear_note':   this._handleEarNoteInput(midi); break;
      case 'ear_chord':  this._handleEarChordInput(midi); break;
      case 'arpeggios':  this._handleArpeggioInput(midi); break;
      case 'chords':     this._handleChordInput(); break;
      case 'theory':     this._handleTheoryInput(midi); break;
    }
  }

  onNoteOff(midi) {
    if (!this.active) return;
    this.pressedNotes.delete(midi);
  }

  /* --- Ear Note input --- */
  _handleEarNoteInput(midi) {
    if (this.guessedCorrectly || this.revealAnswer) return;
    this.totalAttempts++;
    const target = this.targetNotes[0];
    if (midi === target) {
      this.guessedCorrectly = true;
      this.correctAttempts++;
      this.streakCount++;
    } else {
      this.streakCount = 0;
    }
    this._updateStats();
    this._showNoteResult(target, midi, false);
  }

  /* --- Ear Chord input (via keyboard: detect chord from pressed keys) --- */
  _handleEarChordInput() {
    if (this.guessedCorrectly || this.revealAnswer) return;
    // Need at least as many notes as the chord
    if (this.pressedNotes.size < this.targetChordInfo.notes.length) return;

    // Check if pressed notes match chord pitch classes
    const targetPCs = new Set(this.targetNotes.map(n => n % 12));
    const pressedPCs = new Set([...this.pressedNotes].map(n => n % 12));

    if (targetPCs.size === pressedPCs.size && [...targetPCs].every(pc => pressedPCs.has(pc))) {
      this.guessedCorrectly = true;
      this.totalAttempts++;
      this.correctAttempts++;
      this.streakCount++;
      this._updateStats();
      this._showChordResult(this.targetChordInfo.typeKey, false);
    }
  }

  /* --- Arpeggio input --- */
  _handleArpeggioInput(midi) {
    if (this.arpeggioComplete) return;
    const expected = this.arpeggioSequence[this.arpeggioIndex];
    const fb = this.exerciseArea.querySelector('#ex-feedback');

    if (midi === expected) {
      this.arpeggioIndex++;
      this._renderArpNotes();
      if (this.arpeggioIndex >= this.arpeggioSequence.length) {
        this.arpeggioComplete = true;
        this.correctAttempts++;
        this.totalAttempts++;
        this.streakCount++;
        this._updateStats();
        if (fb) fb.innerHTML = '<span class="ex-correct">✓ Pattern complete! Well done!</span>';
        const next = this.exerciseArea.querySelector('#ex-next');
        if (next) next.style.display = 'inline-block';
      } else {
        if (fb) fb.innerHTML = `<span class="ex-correct">✓ ${midiToNoteName(midi)}</span>`;
      }
    } else {
      this.streakCount = 0;
      if (fb) fb.innerHTML = `<span class="ex-wrong">✗ Expected ${midiToNoteName(expected)}, got ${midiToNoteName(midi)}</span>`;
    }
  }

  /* --- Chord Training input --- */
  _handleChordInput() {
    if (this.guessedCorrectly) return;
    const tc = this.targetChord;

    // Check if all target notes are held (by pitch class + octave)
    const targetSet = new Set(tc.notes);
    const pressedArr = [...this.pressedNotes];
    const allHeld = tc.notes.every(n => pressedArr.includes(n));

    const fb = this.exerciseArea.querySelector('#ex-feedback');
    if (allHeld) {
      this.guessedCorrectly = true;
      this.correctAttempts++;
      this.totalAttempts++;
      this.streakCount++;
      this._updateStats();
      if (fb) fb.innerHTML = '<span class="ex-correct">✓ Perfect! You played the chord correctly!</span>';
      const next = this.exerciseArea.querySelector('#ex-next');
      if (next) next.style.display = 'inline-block';
    } else {
      // Show what they're pressing
      const heldNames = pressedArr.sort((a,b)=>a-b).map(n => midiToNoteName(n)).join(', ');
      if (fb) fb.innerHTML = `<span class="ex-hint">Holding: ${heldNames} — need all notes simultaneously</span>`;
    }
  }

  /* --- Theory lesson input --- */
  _handleTheoryInput(midi) {
    if (this.lessonComplete) return;
    const lesson = this.currentLesson;
    if (!lesson) return;

    const ed = lesson.exerciseData;
    if (lesson.exercise === 'play_notes' || lesson.exercise === 'play_intervals') {
      this._handleTheorySequenceInput(midi, ed.notes || ed.intervals.map(i => midiToNoteName(noteNameToMidi(ed.root) + i)));
    } else if (lesson.exercise === 'play_scale') {
      const rootMidi = noteNameToMidi(ed.root);
      const scale = SCALE_TYPES[ed.scaleType];
      const scaleNotes = scale.intervals.map(i => midiToNoteName(rootMidi + i));
      this._handleTheorySequenceInput(midi, scaleNotes);
    } else if (lesson.exercise === 'play_chord') {
      this._handleTheoryChordInput(midi);
    }
  }

  _handleTheorySequenceInput(midi, noteNames) {
    const expected = noteNames[this.lessonExerciseIdx];
    const expectedMidi = noteNameToMidi(expected);
    const fb = this.exerciseArea.querySelector('#ex-feedback');

    if (midi === expectedMidi) {
      this.lessonExerciseIdx++;
      // Update note track visual
      const track = this.exerciseArea.querySelector('#ex-note-track');
      if (track) {
        const noteEls = track.querySelectorAll('.arp-note');
        noteEls.forEach((el, i) => {
          el.classList.remove('arp-active', 'arp-done');
          if (i < this.lessonExerciseIdx) el.classList.add('arp-done');
          else if (i === this.lessonExerciseIdx) el.classList.add('arp-active');
        });
      }

      if (this.lessonExerciseIdx >= noteNames.length) {
        this.lessonComplete = true;
        if (fb) fb.innerHTML = '<span class="ex-correct">✓ Excellent! Exercise complete!</span>';
        const next = this.exerciseArea.querySelector('#ex-next');
        if (next) next.style.display = 'inline-block';
      } else {
        if (fb) fb.innerHTML = `<span class="ex-correct">✓ ${midiToNoteName(midi)}</span>`;
      }
    } else {
      if (fb) fb.innerHTML = `<span class="ex-wrong">✗ Expected ${expected}, got ${midiToNoteName(midi)}</span>`;
    }
  }

  _handleTheoryChordInput(midi) {
    const lesson = this.currentLesson;
    const chords = lesson.exerciseData.chords;
    const currentChord = chords[this.lessonExerciseIdx];
    if (!currentChord) return;

    const targetMidis = currentChord.notes.map(n => noteNameToMidi(n));
    const allHeld = targetMidis.every(n => this.pressedNotes.has(n));

    const fb = this.exerciseArea.querySelector('#ex-feedback');
    if (allHeld) {
      this.lessonExerciseIdx++;
      // Update chord sequence visual
      const chordEls = this.exerciseArea.querySelectorAll('.ex-lesson-chord');
      chordEls.forEach((el, i) => {
        el.classList.remove('chord-active', 'chord-done');
        if (i < this.lessonExerciseIdx) el.classList.add('chord-done');
        else if (i === this.lessonExerciseIdx) el.classList.add('chord-active');
      });

      if (this.lessonExerciseIdx >= chords.length) {
        this.lessonComplete = true;
        if (fb) fb.innerHTML = '<span class="ex-correct">✓ Progression complete! Well done!</span>';
        const next = this.exerciseArea.querySelector('#ex-next');
        if (next) next.style.display = 'inline-block';
      } else {
        if (fb) fb.innerHTML = `<span class="ex-correct">✓ ${currentChord.name} — correct!</span>`;
      }
    } else {
      const heldNames = [...this.pressedNotes].sort((a,b)=>a-b).map(n => midiToNoteName(n)).join(', ');
      if (fb && this.pressedNotes.size > 0) {
        fb.innerHTML = `<span class="ex-hint">Holding: ${heldNames}</span>`;
      }
    }
  }
}

/* Export for use in guitar_hero.js */
if (typeof window !== 'undefined') {
  window.TrainingCenter = TrainingCenter;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TrainingCenter, CHORD_TYPES, SCALE_TYPES, ARPEGGIO_TYPES, RUN_TYPES, THEORY_LESSONS, INTERVAL_NAMES, NOTE_NAMES, NOTE_NAMES_FLAT, midiToNoteName, noteNameToMidi };
}
