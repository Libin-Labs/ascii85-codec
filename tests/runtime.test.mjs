import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAscii85, decodeAscii85, Ascii85Error } from '../dist/esm/index.js';
const encode = (text) => new TextEncoder().encode(text);
test('known ASCII85 example bytes and Adobe framing match exactly', () => {
  const wire = '87cURD]j7BEbo80';
  assert.equal(encodeAscii85(encode('Hello world!')), wire);
  assert.deepEqual(decodeAscii85(wire), encode('Hello world!'));
  assert.equal(encodeAscii85(encode('Hello world!'), { adobe: true }), '<~' + wire + '~>');
  assert.deepEqual(decodeAscii85('<~' + wire + '~>', { adobe: true }), encode('Hello world!'));
});
test('zero abbreviation applies only to entire four-byte groups', () => {
  assert.equal(encodeAscii85(new Uint8Array(4)), 'z');
  assert.equal(encodeAscii85(new Uint8Array(8)), 'zz');
  assert.equal(encodeAscii85(new Uint8Array(3)), '!!!!');
  assert.equal(encodeAscii85(new Uint8Array(4), { zeroCompression: false }), '!!!!!');
  assert.deepEqual(decodeAscii85('z'), new Uint8Array(4));
  assert.throws(() => decodeAscii85('!z'), { code: 'invalid' });
});
test('all partial tails and maximum byte values remain exact', () => {
  for (let length = 0; length < 80; length++) {
    for (const fill of [0, 1, 127, 255]) {
      const bytes = new Uint8Array(length).fill(fill),
        wire = encodeAscii85(bytes);
      assert.deepEqual(decodeAscii85(wire), bytes);
      assert.deepEqual(
        decodeAscii85(encodeAscii85(bytes, { adobe: true }), { adobe: true }),
        bytes,
      );
    }
  }
});
test('explicit whitespace policy permits only declared ASCII whitespace', () => {
  assert.deepEqual(decodeAscii85(' \n87cUR\tD]j7B\rEbo80\f'), encode('Hello world!'));
  assert.throws(() => decodeAscii85(' \n87cUR', { whitespace: 'reject' }), Ascii85Error);
  assert.throws(() => decodeAscii85('\0z'), Ascii85Error);
  assert.throws(() => decodeAscii85('\vz'), Ascii85Error);
});
test('framing, overflow, one-digit tails and unsupported variants reject', () => {
  assert.throws(() => decodeAscii85('!'), { code: 'truncated' });
  for (const text of ['uuuuu', 'uuuu', 'y', '~', 'é', '<~z~>'])
    assert.throws(() => decodeAscii85(text), Ascii85Error);
  for (const text of ['z', '<~z', '<~z~> ', ' <~z~>', '<~~>junk'])
    assert.throws(() => decodeAscii85(text, { adobe: true }), Ascii85Error);
});
test('canonical tails reject alternate low-order data unless explicitly relaxed', () => {
  // Both digit pairs decode to the same leading zero byte; only !! is emitted.
  assert.deepEqual(decodeAscii85('!!'), Uint8Array.of(0));
  assert.throws(() => decodeAscii85('!"'), { code: 'invalid' });
  assert.deepEqual(decodeAscii85('!"', { canonicalTail: false }), Uint8Array.of(0));
});
test('output/input budgets enforce exact lengths including Adobe framing', () => {
  const bytes = encode('Hello world!'),
    wire = encodeAscii85(bytes);
  assert.equal(encodeAscii85(bytes, { maxBytes: bytes.length, maxCharacters: wire.length }), wire);
  assert.deepEqual(
    decodeAscii85(wire, { maxBytes: bytes.length, maxCharacters: wire.length }),
    bytes,
  );
  for (const options of [{ maxBytes: bytes.length - 1 }, { maxCharacters: wire.length - 1 }]) {
    assert.throws(() => encodeAscii85(bytes, options), { code: 'limit' });
    assert.throws(() => decodeAscii85(wire, options), { code: 'limit' });
  }
  assert.throws(() => encodeAscii85(new Uint8Array(), { adobe: true, maxCharacters: 3 }), {
    code: 'limit',
  });
  assert.throws(() => decodeAscii85('z', { maxBytes: 3 }), { code: 'limit' });
  assert.equal(encodeAscii85(new Uint8Array(), { maxBytes: 0, maxCharacters: 0 }), '');
});
test('seeded round trips preserve arbitrary byte arrays with independent arithmetic oracle', () => {
  let state = 17;
  for (let length = 0; length < 200; length++) {
    const bytes = Uint8Array.from({ length }, () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state >>> 24;
    });
    const wire = encodeAscii85(bytes, { zeroCompression: false });
    let expected = '';
    for (let index = 0; index < length; index += 4) {
      const count = Math.min(4, length - index);
      const bits = [...bytes.slice(index, index + count)]
        .map((value) => value.toString(2).padStart(8, '0'))
        .join('')
        .padEnd(32, '0');
      const value = parseInt(bits, 2);
      let group = '';
      for (let power = 4; power >= 0; power--)
        group += String.fromCharCode((Math.floor(value / 85 ** power) % 85) + 33);
      expected += group.slice(0, count + 1);
    }
    assert.equal(wire, expected);
    assert.deepEqual(decodeAscii85(wire), bytes);
  }
});
test('type guards, option guards and ownership are explicit', () => {
  const bytes = Uint8Array.of(1, 2, 3),
    before = bytes.slice(),
    text = encodeAscii85(bytes);
  decodeAscii85(text).fill(0);
  assert.deepEqual(bytes, before);
  assert.deepEqual(decodeAscii85(text), before);
  assert.throws(() => encodeAscii85('x'), Ascii85Error);
  assert.throws(() => decodeAscii85(new Uint8Array()), Ascii85Error);
  for (const options of [{ adobe: 'yes' }, { maxBytes: -1 }, { maxCharacters: NaN }])
    assert.throws(() => encodeAscii85(bytes, options), Ascii85Error);
  assert.throws(() => encodeAscii85(bytes, { zeroCompression: 1 }), Ascii85Error);
  assert.throws(() => decodeAscii85(text, { whitespace: 'all' }), Ascii85Error);
  assert.throws(() => decodeAscii85(text, { canonicalTail: 1 }), Ascii85Error);
});
