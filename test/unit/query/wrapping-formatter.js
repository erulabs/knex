const { expect } = require('chai');
const Formatter = require('../../../lib/formatter');
const Client = require('../../../lib/client');

describe('wrappingFormatter', () => {
  const queryContext = () => ({});
  const client = new Client({ client: 'generic' });
  const formatter = new Formatter(client, { queryContext });

  describe('wrapString (via formatter.wrap)', () => {
    // --- Simple identifiers ---
    it('wraps a simple column name', () => {
      expect(formatter.wrap('id')).to.equal('"id"');
    });

    it('wraps a column name with underscores', () => {
      expect(formatter.wrap('created_at')).to.equal('"created_at"');
    });

    it('passes through wildcard *', () => {
      expect(formatter.wrap('*')).to.equal('*');
    });

    // --- Dotted identifiers ---
    it('wraps a dotted identifier (table.column)', () => {
      expect(formatter.wrap('users.id')).to.equal('"users"."id"');
    });

    it('wraps a triple-dotted identifier (schema.table.column)', () => {
      expect(formatter.wrap('public.users.id')).to.equal(
        '"public"."users"."id"'
      );
    });

    it('wraps dotted identifier with wildcard', () => {
      expect(formatter.wrap('users.*')).to.equal('"users".*');
    });

    // --- Aliases ---
    it('wraps an aliased column', () => {
      expect(formatter.wrap('name as n')).to.equal('"name" as "n"');
    });

    it('wraps an aliased dotted column', () => {
      expect(formatter.wrap('users.name as user_name')).to.equal(
        '"users"."name" as "user_name"'
      );
    });

    it('handles case-insensitive AS keyword', () => {
      expect(formatter.wrap('name AS n')).to.equal('"name" as "n"');
    });

    // --- Numbers pass through ---
    it('passes through numeric values', () => {
      expect(formatter.wrap(42)).to.equal(42);
    });
  });

  describe('columnize', () => {
    it('wraps a single column', () => {
      expect(formatter.columnize('id')).to.equal('"id"');
    });

    it('wraps multiple columns', () => {
      expect(formatter.columnize(['id', 'name', 'email'])).to.equal(
        '"id", "name", "email"'
      );
    });

    it('wraps dotted columns in a list', () => {
      expect(formatter.columnize(['users.id', 'users.name'])).to.equal(
        '"users"."id", "users"."name"'
      );
    });

    it('handles mixed simple and dotted columns', () => {
      expect(formatter.columnize(['id', 'users.name', '*'])).to.equal(
        '"id", "users"."name", *'
      );
    });
  });
});
