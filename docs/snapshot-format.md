# Miracle Snapshot Format (Version 1)

Miracle saves the machine's state as a JSON file with the extension `.json`: **Save as...** writes one and **Load from...** reads one. Small values stay readable JSON numbers and booleans; the byte arrays (RAM, VRAM, palette) are base64 strings of a fixed, known length. The code is in `src/snapshot.js` (the format and its validation) and `src/state-ui.js` (the buttons). The same text is also kept in the browser's storage so that each game carries on where you left off; see [Browser storage](#browser-storage).

A file is named `miracle-<ROM name>-<CRC-32>-<timestamp>.json`, for example `miracle-AlexKidd-1a2b3c4d-20261114T130500Z.json`. The name is only a convenience; it is never read back. The ROM part is the ROM's name with any directory (anything up to the last `/` or `\`) and its last extension removed, every run of characters outside `A-Za-z0-9._-` replaced by a single `_`, leading and trailing `.` and `_` trimmed, and the result cut to 40 characters; if nothing is left it is `rom`. The CRC-32 is 8 lower-case hex digits and the timestamp is the save time in UTC as `YYYYMMDDTHHMMSSZ`.

## Top-level structure

```json
{
  "format": "miracle-snapshot",
  "version": 1,
  "emulator": { "name": "miracle" },
  "timestamp": "2026-11-14T13:05:00.000Z",
  "timing": { "linesPerFrame": 313, "cpuHz": 3580000 },
  "rom": { "name": "AlexKidd.sms", "size": 131072, "crc32": "0x1a2b3c4d" },
  "state": { "z80": {}, "bus": {}, "vdp": {}, "sound": {} }
}
```

| Field                  | Type   | Description                                                                                                                                 |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`               | string | Always `"miracle-snapshot"`                                                                                                                 |
| `version`              | number | Format version, an integer of 1 or more (currently `1`)                                                                                     |
| `emulator`             | object | Informational (`name`); never read back                                                                                                     |
| `timestamp`            | string | When the state was saved: ISO 8601 in UTC, as `YYYY-MM-DDTHH:MM:SS[.f...]Z` with any number of fraction digits, at most 64 chars; see below |
| `timing.linesPerFrame` | number | Scanlines per frame of the machine that saved it (`SMS.SCAN_LINES_PER_FRAME`, 313); must match                                              |
| `timing.cpuHz`         | number | Z80 clock of the machine that saved it (`SMS.CPU_HZ`, 3580000); must match                                                                  |
| `rom.name`             | string | The ROM's name when it was saved, at most 255 characters. A label only: it is not compared                                                  |
| `rom.size`             | number | Size in bytes of the ROM as loaded, before any padding. A non-negative integer; must match                                                  |
| `rom.crc32`            | string | CRC-32 of those bytes as `0x` and 8 hex digits (either case is read); must match                                                            |
| `state`                | object | The machine's state (see below)                                                                                                             |

Unknown extra fields, at any level, are ignored.

The `timestamp` is checked against that pattern and then with `Date.parse`, whose leniency is not tightened: a day that does not exist in its month (`2026-02-31`) is accepted. It is only shown to the user ("Loaded state from ...").

## ROM identity

A state is only loaded into the ROM it was saved from. The identity is the CRC-32 (the usual CRC-32/ISO-HDLC) and the byte size, computed once when the ROM is loaded over exactly the bytes handed to `SMS.loadRom`. Both must match; the name is only a label, so a renamed copy of the same ROM matches.

The ROM itself is never in the file. A ROM with and without a 512-byte copier header has different bytes, so counts as a different ROM.

## State object

`state` has four components, each the output of the matching `snapshotState()` with byte arrays written as base64. Every field is required unless noted. A range is inclusive. "Byte" means an integer from 0 to 255 and "word" an integer from 0 to 65535. Numbers must be finite; where an integer is wanted, `1.5` and `"1"` are refused.

### Z80 (`state.z80`)

| Field                                          | Type    | Range / meaning                                                                                         |
| ---------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `a`, `b`, `c`, `d`, `e`, `h`, `l`              | number  | Main register set (byte)                                                                                |
| `f`                                            | number  | Flags register (byte)                                                                                   |
| `a_`, `b_`, `c_`, `d_`, `e_`, `h_`, `l_`, `f_` | number  | Shadow register set (byte)                                                                              |
| `ixh`, `ixl`, `iyh`, `iyl`                     | number  | Index registers, high and low halves (byte)                                                             |
| `i`                                            | number  | Interrupt vector register (byte)                                                                        |
| `r`                                            | number  | Low 7 bits of the refresh register (0 to 127)                                                           |
| `r7`                                           | number  | The refresh register's high bit as the emulator keeps it (byte; deliberately permissive, only 0 occurs) |
| `sp`, `pc`                                     | number  | Stack pointer and program counter (word)                                                                |
| `iff1`, `iff2`                                 | number  | Interrupt flip-flops (0 or 1; booleans are refused)                                                     |
| `im`                                           | number  | Interrupt mode (0 to 2)                                                                                 |
| `halted`                                       | boolean | The CPU is in `HALT`                                                                                    |
| `irqPending`                                   | boolean | The VDP's interrupt line is asserted (a level, recomputed at the end of every scanline)                 |
| `irqSuppress`                                  | boolean | The one-instruction delay after `EI`                                                                    |
| `tstates`                                      | number  | Cycles carried over the line boundary (integer, -4096 to 4096; deliberately permissive)                 |

There is no pending-NMI state; an NMI acts immediately. `tstates` is the overshoot of the last instruction past the end of the scanline, so saving it raw is exact. Real values are a few hundred at most either way; the limit only has to keep a corrupt file from making the next scanline run for ages.

### Bus (`state.bus`)

| Field          | Type               | Range / meaning                                                                                                                                                  |
| -------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ramSelect`    | number             | The cartridge RAM select register, `0xFFFC` (byte)                                                                                                               |
| `pages`        | array of 3 numbers | The mapper pages, registers `0xFFFD` to `0xFFFF`. Each is an integer from 0 to the running ROM's page mask (its bank count minus one)                            |
| `joystick`     | number             | Both controller ports, active low (word). Bits 14 and 15 are driven by the program through port `0x3F`; the rest are the host's keyboard and gamepad (see below) |
| `ram`          | base64             | The 8 KB of system RAM: exactly 8192 bytes                                                                                                                       |
| `cartridgeRam` | base64 or `null`   | The 32 KB of cartridge RAM: exactly 32768 bytes, or `null` when every byte is zero                                                                               |

The bus drops writes to cartridge RAM today (issue #91), so it is usually `null`; it is in the format because it is part of the machine.

The page mask is read from the machine (`SMS.pageMask`, from `Bus.pageMask`), not from the file, so a state cannot point a page at a bank that does not exist. These two getters are the only new public surface on the machine for the format, alongside `romIdentity`.

### VDP (`state.vdp`)

| Field           | Type                | Range / meaning                                                                                                |
| --------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `regs`          | array of 16 numbers | The VDP registers (each a byte)                                                                                |
| `addrState`     | number              | 0 for the first byte of a control word, 1 for the second                                                       |
| `modeSelect`    | number              | 0 for VRAM access, 1 for palette access                                                                        |
| `addrLatch`     | number              | The first byte of the control word (byte)                                                                      |
| `addr`          | number              | The VRAM or palette address (0 to 16383)                                                                       |
| `currentLine`   | number              | The scanline being drawn (0 to 312, one less than `timing.linesPerFrame`)                                      |
| `status`        | number              | The status register (byte; deliberately permissive, the emulator only ever sets the top three bits)            |
| `pendingHblank` | boolean             | A line interrupt has been raised and not yet acknowledged                                                      |
| `hblankCounter` | number              | The line interrupt countdown (byte, as it is reloaded from register 10)                                        |
| `vram`          | base64              | Video RAM: exactly 16384 bytes                                                                                 |
| `cram`          | base64              | The 32 palette entries as written (exactly 32 bytes; each is a full byte, though only the low six bits matter) |

What is rebuilt on restore rather than saved: the decoded tile cache (a function of `vram`), the colour tables (of `cram`) and the border colour.

### Sound (`state.sound`)

`sound` is `null` when the machine had no sound chip attached; a state with a `null` `sound` leaves the running machine's chip exactly as it is, so whatever the chip was doing before the load carries on (this is intended; sound is best-effort), and a state with sound restores nothing if the machine has no chip.

| Field            | Type               | Range / meaning                                                                                                                                                                                                                    |
| ---------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registers`      | array of 4 numbers | The tone period of channels 0 to 2 (0 to 1023) and the noise control of channel 3 (0 to 15)                                                                                                                                        |
| `counter`        | array of 4 numbers | Each channel's countdown, a float. Any finite number (deliberately permissive; the float has no fixed range, and a crafted value can make a channel buzz or fall silent until the next reset, but cannot hang or corrupt anything) |
| `outputBit`      | array of 4 numbers | Each channel's square wave output (0 or 1)                                                                                                                                                                                         |
| `volumeIndex`    | array of 4 numbers | Each channel's attenuation step (0 for loudest to 15 for silent); the volume is rebuilt from it                                                                                                                                    |
| `lfsr`           | number             | The noise shift register (1 to 65535; it is never 0, as the generator cannot reach it. Any other value is accepted, so a crafted file can make the noise sound odd until reset, but nothing worse)                                 |
| `whiteNoise`     | boolean            | White (true) or periodic noise                                                                                                                                                                                                     |
| `latchedChannel` | number             | The channel the next data byte applies to (0 to 3)                                                                                                                                                                                 |
| `residual`       | number             | The fraction of a sample carried between renders: a float from 0 up to but not including 1                                                                                                                                         |

## Base64 conventions

Byte arrays are standard base64 (alphabet `A-Z a-z 0-9 + /`, with `=` padding), with the canonical encoding of exactly the right number of bytes. The decoder works out how many bytes a string holds from its length and padding before it allocates anything, so a string that is the wrong size is refused for its size (`wrong-length`). A string whose length is not a multiple of 4, or that has characters outside the alphabet or more than two `=`, is `corrupt` instead, as it has no size. It then requires that re-encoding the decoded bytes gives the same string, so whitespace, a wrong alphabet, extra padding and non-zero trailing bits are all refused. The file is not compressed: deflate would take a state of about 34 KB (more with cartridge RAM) down to roughly a quarter, which is not worth a library or an asynchronous API. An `encoding` field could be added later without a version bump.

## Validation

Loading validates the whole file before the machine is touched. `decode` in `src/snapshot.js` is a pure function of the text and the running ROM's identity and page mask; it is never given the machine. It returns a state, built only from the known fields (so a `__proto__` or `constructor` key in the file has nowhere to go), or throws a `SnapshotError`, which has a stable `code`, a `path` such as `vdp.vram` and a message for the user. It throws no other kind of error for bad input. If it returns, `SMS.restoreState` with the result does not throw; if it throws, nothing has changed, and the machine stays exactly as it was.

| Case                                                                           | `code`                                    | `path`    | Message                                                   |
| ------------------------------------------------------------------------------ | ----------------------------------------- | --------- | --------------------------------------------------------- |
| More than 1 MiB (1,048,576) of text; not JSON; not an object; wrong `format`   | `too-large`, `not-json`, `not-a-snapshot` | (empty)   | `That file isn't a Miracle save state.`                   |
| `version` is not an integer of 1 or more                                       | `corrupt`                                 | `version` | `Corrupt state: version`                                  |
| `version` newer than 1                                                         | `newer-version`                           | `version` | `Saved by a newer Miracle (v2). Update to load it.`       |
| `timing` differs from this build's                                             | `timing-mismatch`                         | `timing`  | `Saved for a different video timing.`                     |
| `rom.crc32` or `rom.size` differs from the running ROM                         | `rom-mismatch`                            | `rom`     | `This state is for X (CRC 0x1a2b3c4d), but Y is running.` |
| A field is missing, the wrong type, not finite, not an integer or out of range | `corrupt`                                 | the field | `Corrupt state: vdp.regs[3]`                              |
| An array has the wrong length, or a base64 string the wrong number of bytes    | `wrong-length`                            | the array | `Corrupt state: vdp.vram is 100 bytes, expected 16384`    |

The checks run in this order, and the first failure is the one reported: size and parse, `format`, `version`, `timestamp`, `timing`, `rom`, then `state` (in the order of the fields in the tables above). So a file for the wrong ROM says so rather than complaining about its mapper pages, and a bad `timestamp` is reported before a ROM mismatch. `X` and `Y` are the saved and running ROMs' names. Text over 1 MiB (1,048,576 characters) is refused from its length alone before it is parsed; the Load button checks the file's size in bytes before it reads it.

`decode(input, { rom, pageMask })` returns just the state. `decodeSnapshot` takes the same arguments and returns `{ state, timestamp, rom }`, the state plus when it was saved and the ROM it was saved from; the UI uses it to report the time. `decode` also accepts an already-parsed object instead of text; the size limit applies to text only. A fallback turns any other error raised while checking (such as a hostile object with a throwing getter) into a `corrupt` `SnapshotError` with an empty path and the message `Corrupt state`, so no other kind of error escapes.

The UI adds a few messages of its own, none of them a `SnapshotError`: `No ROM is loaded, so there is nothing to save.` (Save with no ROM), `Load a ROM before loading a state.` (Load with no ROM), `That file couldn't be read.` (the file could not be read), `Saved <file name>` and `Loaded state from <timestamp>`. A message is shown in a status line that clears itself after 10 seconds; a newer message restarts the wait. A message that carries a button (the notices under [Browser storage](#browser-storage)) does not clear itself, so that the button stays until another message replaces it. A leading UTF-8 byte order mark is not handled by `decode`: text that starts with one is refused as not JSON. The Load button reads the file with `File.text()`, which strips a leading byte order mark, so such a file loads normally from the UI.

The envelope's own fields (`timestamp`, `timing.*`, `rom.*`, `state`) are also checked, and are `corrupt` with their own path (for example `rom.crc32`) when missing or the wrong type.

Where the ranges are deliberately permissive they are noted in the field tables: `z80.r7`, `z80.tstates`, `vdp.status`, `vdp.cram` and `sound.counter`. Every other range is exactly what the emulator can produce.

## Versioning

`version` is an integer. A change that only adds fields does not bump it, because unknown fields are ignored and a reader that does not know a new field loses nothing it needs; a new field must therefore be optional or have a sensible default. A change that removes, renames or reinterprets a field, or changes a range, bumps `version`. A file with a newer `version` is refused rather than guessed at, and a version below 1 is corrupt.

### Version history

- **v1**: Initial release. Z80, bus (RAM and cartridge RAM, mapper, joystick), VDP (registers, VRAM, palette, address and line state) and sound chip.

## Not saved

| What                                                                          | Why                                                                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| The framebuffer                                                               | It is rebuilt every frame; see the caveat below                                                                                 |
| The ROM                                                                       | It is large, commercial and already on the player's machine; the file holds its CRC-32 and size so the right one can be checked |
| The sound buffer and pending cycles                                           | They are audio waiting to be played; they are dropped on restore                                                                |
| The Z80's `eventNextEvent`, `bus` and `instructionHook`                       | The first is reassigned every scanline; the others are wiring                                                                   |
| The VDP's tile and colour caches, current frame counter and sprite debug flag | Caches are rebuilt; the counter and flag affect nothing the machine does                                                        |
| Whether the sound is muted, and the sample rate                               | They belong to the host                                                                                                         |
| A hit breakpoint                                                              | It is transient: restoring clears it                                                                                            |

## Loading

Loading stops the machine, restores the state, starts it, and so a good file always ends with the machine running, which closes the debugger if it was open. This includes a machine that was paused or stopped in the debugger: it resumes, by design, so that what you see is the state you loaded. A file that is refused leaves the machine exactly as it was: running stays running and paused or stopped stays so. If a second file is chosen while the first is still being read, only the second is loaded; the first never touches the machine or the status line. The joystick in a state includes the host's keyboard and gamepad bits as they were when it was saved, so right after a restore the control bits (`0x103F`: directions, both fire buttons and reset) are recomputed from the keys and gamepad buttons held now, by the same merge the main loop applies on every frame.

### Caveats

- **The screen is partly blank for up to one frame.** The framebuffer is not part of the state, so the rows already drawn for the frame in progress are empty when the state is restored; the next complete frame is exact. The state is saved on a scanline boundary, so this is at most about 20 ms of picture.
- **Sound is best-effort.** The sound chip only advances when it is rendered and the audio that was buffered is discarded, so the waveform's phase is not exact across a save. The registers, volumes and noise settings are.
- **CPU, RAM, VRAM and video are exact**, which the tests check by running a restored machine alongside the original and comparing everything frame by frame.
- **Narrow screens.** The menu is 800 px wide, so on a viewport narrower than that the right-hand buttons (Open ROM was already affected; Save as..., Load from... and About now are too) are cut off. This is a known limitation.
- **Keyboard access.** While a game is running, Enter and Space are its fire keys, as before, so the Save as... and Load from... buttons, and the Start over button in the status line, can only be used with the mouse or touch unless the game is paused first (with the Pause button) or focus is moved. Keyboard access to the menu is a known limitation, deferred to a follow-up (issue #94).
- Cartridge RAM is part of the state, but this is a snapshot of the whole machine at one instant, not a game's own battery save, and it will not load into a different ROM.

## Browser storage

Besides the file, Miracle keeps each game's latest state in the browser's `localStorage`, so that opening the same game again carries on where you left off. It is the same envelope as the file, written with the same `encode` and `stringify` and read back with the same `decodeSnapshot`, so everything above (the fields, the validation, the messages) applies to a stored entry exactly as it does to a file. The code is in `src/state-store.js` (the storage), `src/autosave.js` (when to save and resume) and the small changes to `src/main.js` and `src/miracle.js` that call them.

### Keys

| Key                                     | Holds                              |
| --------------------------------------- | ---------------------------------- |
| `miracle.state.<crc32>-<size>`          | The latest state for that ROM      |
| `miracle.state.<crc32>-<size>.previous` | The one state before it, see below |

`<crc32>` is the ROM's CRC-32 as 8 lower-case hex digits and `<size>` its size in bytes (the [ROM identity](#rom-identity)), for example `miracle.state.1a2b3c4d-131072`. The `miracle.` prefix keeps these apart from the other keys the page uses. The ROM's name is not part of the key, so the same game opened from the list, from the Open ROM button or from a `?b64sms=` link shares one entry, and two ROMs that differ in either number never share one. A ROM with and without a copier header counts as two.

### Size

An entry is about 34 KB of text (34,811 characters for the AlexKidd ROM after 700 frames), and about 78 KB if the game uses its cartridge RAM. `localStorage` limits are typically 5 to 10 MB per site, counted in characters or in bytes at two per character, so with the previous copy each game takes roughly 70 to 160 KB and a few dozen games fit. The text is stored as `stringify` writes it, with indentation, rather than as compact JSON: compact JSON was measured at 33,885 characters, only 2.7 percent smaller, because nearly all of the size is base64, and keeping the text identical to a file means a stored entry can be saved to a file and loaded. There is no compression, for the reasons given in the design (issue #2): the saving is small against the quota and the browser's compression API is asynchronous, while a save on page close has to be synchronous. Building and writing an entry takes a few milliseconds.

### When progress is saved

| Trigger                                      | Notes                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| The machine stops                            | The Pause button, a breakpoint or the debugger's stop, and the stop that begins any load of a state |
| The page becomes hidden (`visibilitychange`) | Switching tab or minimising                                                                         |
| `pagehide`                                   | Closing or leaving the page                                                                         |
| Just before a ROM is replaced                | Saved under the old ROM's identity, before the machine is reset and the new ROM is loaded           |
| Every 30 seconds                             | Only while the page is visible and the machine is running                                           |

Every save is synchronous (`localStorage.setItem`), because a `pagehide` handler cannot wait for anything. Nothing is saved when no ROM is loaded, or until at least 50 frames (about one second) have run since the machine was last reset, had a state restored (by resuming or by Load from...) or was given a ROM. So reloading the page, choosing Start over or loading a file and leaving at once never replaces good progress with an almost empty one. Saving only reads the machine's state; it never changes it.

### Resuming

When a ROM has been loaded, by whichever route (the page's default, `?load=`, `?b64sms=`, the list or the Open ROM button), its entry is looked up. If there is one, it is validated with `decodeSnapshot` against the loaded ROM, as a file is, and then restored by the same code that Load from... uses (`applyState` in `src/state-ui.js`): stop, restore, merge in the keys and gamepad buttons now held, start. The status line then reads `Resumed from <date and time> [Start over]`, with the time the entry was saved, in the browser's local format. It stays until another message replaces it. When a ROM is replaced, the notice is taken down, but a different message that has replaced it (such as `Saved ...` or `Loaded state from ...`) is left alone.

Nothing in saving or resuming throws. An entry that fails validation (not JSON, over 1 MiB, wrong ROM size or CRC, wrong timing, a field that is missing or out of range), or that makes restoring throw for any other reason, is removed, and the status line says `Saved progress for this game was damaged, so it was discarded.` once (`Saved progress for this game was damaged, and this browser would not let it be discarded.` if the removal itself fails). If the failure came from the restore itself the machine may be half restored, so it is hard reset; a validation failure happens before the machine is touched, so it is not reset, and either way the ROM boots normally.

An entry from a newer version of Miracle is neither used nor removed, and autosave is switched off for that ROM until the ROM is changed, so nothing overwrites it. The status line reads `Saved by a newer Miracle (v2). Autosave is off for this game so it is not overwritten.` (with the entry's own version). Loading a file, Save as... and every other part of the page work as usual, and other ROMs autosave as usual.

### Start over and the previous copy

Start over resets the machine, as the Reset button does, and deletes the ROM's entry. It does not save anything first. The status line then reads `Started over.` If the browser refuses to remove the entry, it reads `Started over, but this browser would not let the saved progress go, so it may come back next time.` (as an error), because reopening the game would then resume the old progress. The Reset button itself is unchanged: it resets the machine and nothing else, and the next autosave overwrites the entry as any other would.

The previous copy, `miracle.state.<crc32>-<size>.previous`, is a safety net and has no button. When the first save of a run (a run starts at a reset, a restore or a ROM load) replaces an existing entry, the entry it replaces is copied there; later saves in the same run replace only the entry, because otherwise the copy would soon be a copy of the entry and no use after a mistaken Reset. So it is the last state of the run before this one. It is written after the entry, and only if the entry was written; a failure to write it is ignored. Start over and removal of a damaged entry leave it alone. It can be reached only through the browser's developer tools: copy the text of the `.previous` value, save it as a `.json` file and use Load from..., or paste it over the entry's value and reload.

### When storage is unavailable

Storage can be blocked (privacy settings, a sandboxed frame; merely reading `window.localStorage` can throw), can be full, or can fail in other ways. `StateStore` takes a function that returns the storage and calls it inside a `try` every time, and never throws: a method that cannot do its job returns `{ ok: false, reason }` with `full`, `unavailable` or `failed`, and a slot that cannot be read reads as empty. The emulator carries on regardless. The first failed save shows `Couldn't save progress in this browser: its storage is full.` (or `storage is unavailable.`, or just `Couldn't save progress in this browser.`) in the status line, and no further failure is shown for the rest of the page's life, so the 30 second saves never nag.

A save writes the entry first, so a failed save leaves the old entry exactly as it was (and the previous copy too). If the Resumed notice is showing when the failure is reported, the message is shown beside it, in the same line, and the Start over button stays. If the failure is the message showing when the next Resumed notice appears (a ROM switch whose save failed), the failure is shown beside that notice too. A failure that something else has already replaced, or whose own ten second timeout has cleared it, is not shown again. With storage blocked, resuming simply boots the ROM normally.

### Privacy

States stay in this browser: nothing is sent anywhere. They do not contain the ROM, only its name, size and CRC-32, and the machine's memory and registers, which for a game is its screen and whatever it keeps in RAM. They persist until removed, so on a shared computer anyone who opens the same page in the same browser profile resumes your game.

To clear them, use the browser's "clear site data" for the page, or delete the keys that start with `miracle.state.` in the developer tools (Application or Storage, then Local Storage). Start over removes one game's entry but leaves the previous copy, so delete that key too.

### Two tabs

Last writer wins. If the same game is open in two tabs, each saves to the same entry on its own schedule, and whichever saved last is what the next open resumes. The 30 second save only runs in a visible tab, which keeps a tab left in the background from overwriting the one being played, but there is no locking and the page does not listen to the `storage` event, so a tab does not notice that another has saved. A tab opened later starts from the entry as it was when it opened.
