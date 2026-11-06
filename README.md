# @lp-labs/ascii85-codec

Strict Adobe/raw ASCII85 binary codec with zero runs, canonical partial groups and bounded byte/text allocation.

Original MIT TypeScript with **zero runtime or peer dependencies**. ESM/CommonJS with separate declarations. Node18+ and compatible ES2022 browsers. No network/filesystem/global services accessed on import. TypeScript/Prettier are development-only.

## Install

```sh
npm install @lp-labs/ascii85-codec
```

## Working example

```js
import { encodeAscii85, decodeAscii85, Ascii85Error } from '@lp-labs/ascii85-codec';
const bytes = new TextEncoder().encode('Hello world!');
const wire = encodeAscii85(bytes, { adobe: true });
if (wire !== '<~87cURD]j7BEbo80~>') throw new Error('Bad ASCII85');
if (new TextDecoder().decode(decodeAscii85(wire, { adobe: true })) !== 'Hello world!')
  throw new Error('Bad decode');
if (encodeAscii85(new Uint8Array(4)) !== 'z') throw new Error('Bad zero abbreviation');
if (!(new Ascii85Error('invalid', 'example') instanceof Error)) throw new Error('Error API');
```

CommonJS: `const api = require('@lp-labs/ascii85-codec')`.

## Behavior, customization, errors and performance

Actual ASCII85 4-byte big-endian unsigned groups ->5 base85 digits ASCII33(!)..117(u), with short final group n bytes ->n+1 digits. No RFC1924 base85/Z85, btoa y/foldspaces, arbitrary punctuation alphabet, checksums or encryption. zeroCompression defaulttrue uses z for exactly FOUR zero bytes at group boundaries, never partial groups; false outputs !!!!!. Decoder accepts z with either encoding policy because it is a standard abbreviation. Full5-digit overflow beyond0xffffffff rejects.

adobe defaults false (raw payload); true requires/emits exact <~ and ~> enclosing delimiters. Decoder does NOT guess framing and rejects leading/trailing whitespace outside Adobe delimiters. Payload whitespace defaults allow for ASCII tab/LF/formfeed/CR/space only; whitespace:'reject' rejects them. NUL, vertical tab, Unicode whitespace and all other invalid symbols reject. A one-digit tail throws truncated. Invalid mid-group z and trailing payload/framing reject.

canonicalTail defaulttrue rejects alternate partial-digit tails that decode the same output bytes but differ from encoder's zero-padded canonical prefix. Set false deliberately to interoperate with a producer using Adobe's broader equivalent-tail space. Short groups are padded with u during decoding; width overflow is invalid in both modes. Decode is all-or-error; no partial success result. Any decoded binary format remains untrusted; this codec does not sanitize PDF/PostScript or execute contents.

Both APIs accept maxBytes (default16MiB, allowed0..64MiB), maxCharacters (default32MiB, allowed0..128MiB) nonnegative safe integer budgets. Actual encoded bytes/characters are counted, so all-zero compressed data may fit a smaller text limit than the worst-case5/4 ratio. Adobe's4 framing characters count. Decode checks wire length first, validates/counts output before allocation, then repeats decoding into the exact buffer. Output is fresh; no retained aliases to input. Encode buffers chunks, not individual character arrays. O(input+output) time/space with a constant32-bit numeric group accumulator (uses exact JS numbers up to85^5) and a second validation pass for decode. Ascii85Error.code invalid for malformed data/options, limit for resources, truncated for one-digit final groups. No imports, Buffer/DOM globals, hidden workers, network or runtime dependencies; Node18+/ES2022 browsers supported. Hostile proxies/getters are outside contract.

## Complete public API

Configure through these exported interfaces; no internal source edits are necessary.

```ts
export interface Ascii85Options {
  adobe?: boolean;
  maxBytes?: number;
  maxCharacters?: number;
}
export interface Ascii85EncodeOptions extends Ascii85Options {
  zeroCompression?: boolean;
}
export interface Ascii85DecodeOptions extends Ascii85Options {
  whitespace?: 'allow' | 'reject';
  canonicalTail?: boolean;
}
export declare class Ascii85Error extends Error {
  readonly code: 'invalid' | 'limit' | 'truncated';
  constructor(code: 'invalid' | 'limit' | 'truncated', message: string);
}
export declare function encodeAscii85(input: Uint8Array, options?: Ascii85EncodeOptions): string;
export declare function decodeAscii85(text: string, options?: Ascii85DecodeOptions): Uint8Array;
```

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
