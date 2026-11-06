import { decodeAscii85, type Ascii85DecodeOptions } from '@lp-labs/ascii85-codec';
const options: Ascii85DecodeOptions = { whitespace: 'reject' };
const bytes: Uint8Array = decodeAscii85('', options);
void bytes;
// @ts-expect-error Explicit policies only
decodeAscii85('', { whitespace: true });
