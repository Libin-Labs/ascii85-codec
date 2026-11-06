import {
  encodeAscii85,
  decodeAscii85,
  Ascii85Error,
  type Ascii85EncodeOptions,
} from '@lp-labs/ascii85-codec';
const options: Ascii85EncodeOptions = { adobe: true, zeroCompression: false };
const text: string = encodeAscii85(new Uint8Array(), options);
const bytes: Uint8Array = decodeAscii85(text, { adobe: true });
const code: 'invalid' | 'limit' | 'truncated' = new Ascii85Error('invalid', 'x').code;
void bytes;
void code;
// @ts-expect-error Binary bytes required
encodeAscii85('x');
