import { describe, expect, it } from 'vitest';
import { extractTokenRefs } from './entities';

describe('NEAR token references', () => {
  it('extracts named and implicit NEAR token contracts', () => {
    const hex = 'a'.repeat(64);
    expect(extractTokenRefs('trade $ZORB on token.near or ' + hex)).toEqual([
      { kind: 'CONTRACT', value: 'token.near' },
      { kind: 'CONTRACT', value: hex },
      { kind: 'CASHTAG', value: 'ZORB' },
    ]);
  });
  it('ignores URL hosts, decimals and unrelated dotted text', () => {
    expect(extractTokenRefs('at 31.7% and t.co/u.s and example.com')).toEqual([]);
  });
  it('ignores reference assets and keeps each reference once', () => {
    expect(extractTokenRefs('wrap.near $NEAR token.near token.near')).toEqual([
      { kind: 'CONTRACT', value: 'token.near' },
    ]);
  });
});
