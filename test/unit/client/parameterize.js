const { expect } = require('chai');
const Knex = require('../../../knex');

describe('Client.parameterize', () => {
  const knex = Knex({
    client: 'sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  });
  const knexMySQL = Knex({ client: 'mysql', connection: {} });

  after(async () => {
    await Promise.allSettled([knex.destroy(), knexMySQL.destroy()]);
  });

  // Helper: compile a query and return { sql, bindings }
  function compile(builder) {
    return builder.toSQL();
  }

  describe('whereIn with primitive values', () => {
    it('handles a single numeric value', () => {
      const result = compile(knex('t').whereIn('id', [42]));
      expect(result.sql).to.contain('in (?)');
      expect(result.bindings).to.deep.equal([42]);
    });

    it('handles multiple numeric values', () => {
      const result = compile(knex('t').whereIn('id', [1, 2, 3]));
      expect(result.sql).to.contain('in (?, ?, ?)');
      expect(result.bindings).to.deep.equal([1, 2, 3]);
    });

    it('handles string values', () => {
      const result = compile(
        knex('t').whereIn('email', ['a@b.com', 'c@d.com'])
      );
      expect(result.sql).to.contain('in (?, ?)');
      expect(result.bindings).to.deep.equal(['a@b.com', 'c@d.com']);
    });

    it('handles mixed primitive types', () => {
      const result = compile(knex('t').whereIn('x', [1, 'two', true, null]));
      expect(result.sql).to.contain('in (?, ?, ?, ?)');
      expect(result.bindings).to.deep.equal([1, 'two', true, null]);
    });

    it('handles a large array of numbers', () => {
      const ids = Array.from({ length: 5000 }, (_, i) => i);
      const result = compile(knex('t').whereIn('id', ids));
      const expectedPlaceholders = ids.map(() => '?').join(', ');
      expect(result.sql).to.contain(`in (${expectedPlaceholders})`);
      expect(result.bindings).to.deep.equal(ids);
    });
  });

  describe('insert with parameterize', () => {
    it('inserts a single row', () => {
      const result = compile(knex('t').insert({ name: 'alice', age: 30 }));
      expect(result.sql).to.match(
        /insert into `t` \(`age`, `name`\) values \(\?, \?\)/
      );
      expect(result.bindings).to.deep.equal([30, 'alice']);
    });

    it('inserts multiple rows', () => {
      const result = compile(
        knex('t').insert([
          { name: 'alice', age: 30 },
          { name: 'bob', age: 25 },
        ])
      );
      // sqlite3 uses select ... union all select ... for multi-row inserts
      expect(result.sql).to.contain('select');
      expect(result.bindings).to.deep.equal([30, 'alice', 25, 'bob']);
    });

    it('inserts rows with null values', () => {
      const result = compile(
        knex('t').insert([
          { name: 'alice', age: null },
          { name: null, age: 25 },
        ])
      );
      expect(result.bindings).to.deep.equal([null, 'alice', 25, null]);
    });

    it('handles rows with missing keys via useNullAsDefault', () => {
      const result = compile(
        knex('t').insert([
          { name: 'alice', age: 30 },
          { name: 'bob' },
        ])
      );
      expect(result.sql).to.contain('select');
      expect(result.bindings).to.deep.equal([30, 'alice', null, 'bob']);
    });
  });

  describe('insert with undefined and raw DEFAULT', () => {
    it('uses DEFAULT for undefined fields when useNullAsDefault is false', () => {
      const result = compile(
        knexMySQL('t').insert([
          { name: 'alice', age: 30 },
          { name: 'bob' }, // age is undefined → should become DEFAULT
        ])
      );
      expect(result.sql).to.contain('DEFAULT');
      expect(result.sql).to.contain('values (?, ?), (DEFAULT, ?)');
    });
  });

  describe('whereIn with non-primitive values (slow path)', () => {
    it('handles raw expressions in whereIn', () => {
      const result = compile(
        knex('t').whereIn('id', [knex.raw('SELECT id FROM other')])
      );
      expect(result.sql).to.contain('SELECT id FROM other');
    });

    it('handles subquery in whereIn', () => {
      const result = compile(
        knex('t').whereIn('id', knex.select('id').from('other'))
      );
      expect(result.sql).to.contain('select `id` from `other`');
    });
  });
});
