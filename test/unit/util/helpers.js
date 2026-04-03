const { expect } = require('chai');
const {
  containsUndefined,
  getUndefinedIndices,
} = require('../../../lib/util/helpers');

describe('helpers', () => {
  describe('containsUndefined', () => {
    // --- Primitive scalars ---
    it('returns true for undefined', () => {
      expect(containsUndefined(undefined)).to.equal(true);
    });

    it('returns false for null', () => {
      expect(containsUndefined(null)).to.equal(false);
    });

    it('returns false for numbers', () => {
      expect(containsUndefined(0)).to.equal(false);
      expect(containsUndefined(1)).to.equal(false);
      expect(containsUndefined(-1)).to.equal(false);
      expect(containsUndefined(NaN)).to.equal(false);
      expect(containsUndefined(Infinity)).to.equal(false);
    });

    it('returns false for strings', () => {
      expect(containsUndefined('')).to.equal(false);
      expect(containsUndefined('hello')).to.equal(false);
    });

    it('returns false for booleans', () => {
      expect(containsUndefined(true)).to.equal(false);
      expect(containsUndefined(false)).to.equal(false);
    });

    // --- Flat arrays ---
    it('returns false for an empty array', () => {
      expect(containsUndefined([])).to.equal(false);
    });

    it('returns false for array of numbers', () => {
      expect(containsUndefined([1, 2, 3])).to.equal(false);
    });

    it('returns false for array of strings', () => {
      expect(containsUndefined(['a', 'b', 'c'])).to.equal(false);
    });

    it('returns false for array of mixed primitives', () => {
      expect(containsUndefined([1, 'two', true, null, 0, ''])).to.equal(false);
    });

    it('returns true for array containing undefined', () => {
      expect(containsUndefined([1, undefined, 3])).to.equal(true);
    });

    it('returns true for array containing undefined at the end', () => {
      expect(containsUndefined([1, 2, undefined])).to.equal(true);
    });

    it('returns true for array containing only undefined', () => {
      expect(containsUndefined([undefined])).to.equal(true);
    });

    // --- Nested arrays ---
    it('returns true for nested array containing undefined', () => {
      expect(containsUndefined([[1, undefined], [3]])).to.equal(true);
    });

    it('returns false for nested array without undefined', () => {
      expect(
        containsUndefined([
          [1, 2],
          [3, 4],
        ])
      ).to.equal(false);
    });

    // --- Plain objects ---
    it('returns false for empty object', () => {
      expect(containsUndefined({})).to.equal(false);
    });

    it('returns false for object with defined values', () => {
      expect(containsUndefined({ a: 1, b: 'two', c: null })).to.equal(false);
    });

    it('returns true for object with undefined value', () => {
      expect(containsUndefined({ a: 1, b: undefined })).to.equal(true);
    });

    it('returns true for deeply nested undefined', () => {
      expect(containsUndefined({ a: { b: [undefined] } })).to.equal(true);
    });

    // --- Objects with toSQL (QueryBuilder / Raw stand-ins) ---
    it('returns false for objects with toSQL method', () => {
      const rawLike = { toSQL: () => ({ sql: 'SELECT 1', bindings: [] }) };
      expect(containsUndefined(rawLike)).to.equal(false);
    });

    it('returns false for array containing objects with toSQL', () => {
      const rawLike = { toSQL: () => ({ sql: 'SELECT 1', bindings: [] }) };
      expect(containsUndefined([rawLike, 1, 'a'])).to.equal(false);
    });

    // --- Typed arrays ---
    it('returns false for typed arrays', () => {
      expect(containsUndefined(new Uint8Array([1, 2, 3]))).to.equal(false);
      expect(containsUndefined(new Int32Array([]))).to.equal(false);
    });

    // --- Large arrays (the performance-critical case) ---
    it('returns false for large array of numbers', () => {
      const arr = new Array(10000);
      for (let i = 0; i < arr.length; i++) arr[i] = i;
      expect(containsUndefined(arr)).to.equal(false);
    });

    it('returns true when undefined is at the end of a large array', () => {
      const arr = new Array(10000);
      for (let i = 0; i < arr.length - 1; i++) arr[i] = i;
      arr[arr.length - 1] = undefined;
      expect(containsUndefined(arr)).to.equal(true);
    });
  });

  describe('getUndefinedIndices', () => {
    it('returns indices of undefined values in an array', () => {
      expect(getUndefinedIndices([1, undefined, 3, undefined])).to.deep.equal([
        1, 3,
      ]);
    });

    it('returns keys of undefined values in an object', () => {
      expect(getUndefinedIndices({ a: 1, b: undefined, c: 3 })).to.deep.equal([
        'b',
      ]);
    });

    it('returns [0] for a bare undefined', () => {
      expect(getUndefinedIndices(undefined)).to.deep.equal([0]);
    });

    it('returns empty array when nothing is undefined', () => {
      expect(getUndefinedIndices([1, 2, 3])).to.deep.equal([]);
    });
  });
});
