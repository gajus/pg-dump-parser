import { parsePgDump } from './parsePgDump';
import {
  groupAndSortSchemaObjects,
  sortSchemaObjects,
  sortSchemaObjectsByScope,
} from './sortSchemaObjects';
import multiline from 'multiline-ts';
import { describe, expect, test } from 'vitest';

describe('sortSchemaObjects', () => {
  test('sorts schema objects by type order', () => {
    const dump = multiline`
      --
      -- Name: foo; Type: TABLE; Schema: public; Owner: postgres
      --
      
      CREATE TABLE public.foo (
          id integer NOT NULL,
          name text NOT NULL
      );
      
      
      --
      -- Name: bar; Type: INDEX; Schema: public; Owner: postgres
      --
      
      CREATE INDEX bar ON public.foo USING btree (name);
      
      
      --
      -- Name: baz; Type: EXTENSION; Schema: -; Owner: -
      --
      
      CREATE EXTENSION IF NOT EXISTS baz;
      
      
      --
      -- Name: qux; Type: CONSTRAINT; Schema: public; Owner: postgres
      --
      
      ALTER TABLE ONLY public.foo
          ADD CONSTRAINT qux PRIMARY KEY (id);
    `;

    const schemaObjects = parsePgDump(dump);
    const sorted = sortSchemaObjects(schemaObjects);

    // Extension should come first
    expect(sorted[0].header).toMatchObject({ Name: 'baz', Type: 'EXTENSION' });
    // Then table
    expect(sorted[1].header).toMatchObject({ Name: 'foo', Type: 'TABLE' });
    // Then constraint
    expect(sorted[2].header).toMatchObject({ Name: 'qux', Type: 'CONSTRAINT' });
    // Finally index
    expect(sorted[3].header).toMatchObject({ Name: 'bar', Type: 'INDEX' });
  });

  test('sorts constraints by type (PRIMARY, UNIQUE, FOREIGN, CHECK)', () => {
    const dump = multiline`
      --
      -- Name: foo foo_check; Type: CONSTRAINT; Schema: public; Owner: postgres
      --
      
      ALTER TABLE ONLY public.foo
          ADD CONSTRAINT foo_check CHECK (id > 0);
      
      
      --
      -- Name: foo foo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
      --
      
      ALTER TABLE ONLY public.foo
          ADD CONSTRAINT foo_fkey FOREIGN KEY (bar_id) REFERENCES public.bar(id);
      
      
      --
      -- Name: foo foo_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
      --
      
      ALTER TABLE ONLY public.foo
          ADD CONSTRAINT foo_unique UNIQUE (name);
      
      
      --
      -- Name: foo foo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
      --
      
      ALTER TABLE ONLY public.foo
          ADD CONSTRAINT foo_pkey PRIMARY KEY (id);
    `;

    const schemaObjects = parsePgDump(dump);
    const sorted = sortSchemaObjects(schemaObjects);

    // Primary key should come first
    expect(sorted[0].sql).toContain('PRIMARY KEY');
    // Then unique
    expect(sorted[1].sql).toContain('UNIQUE');
    // Then check
    expect(sorted[2].sql).toContain('CHECK');
    // Finally foreign key
    expect(sorted[3].sql).toContain('FOREIGN KEY');
  });

  test('sorts indexes alphabetically within the same table', () => {
    const dump = multiline`
      --
      -- Name: foo; Type: TABLE; Schema: public; Owner: postgres
      --
      
      CREATE TABLE public.foo (
          id integer NOT NULL,
          name text NOT NULL,
          email text
      );
      
      
      --
      -- Name: foo_name_idx; Type: INDEX; Schema: public; Owner: postgres
      --
      
      CREATE INDEX foo_name_idx ON public.foo USING btree (name);
      
      
      --
      -- Name: foo_email_idx; Type: INDEX; Schema: public; Owner: postgres
      --
      
      CREATE INDEX foo_email_idx ON public.foo USING btree (email);
      
      
      --
      -- Name: foo_id_idx; Type: INDEX; Schema: public; Owner: postgres
      --
      
      CREATE INDEX foo_id_idx ON public.foo USING btree (id);
    `;

    const schemaObjects = parsePgDump(dump);
    const sorted = sortSchemaObjects(schemaObjects);

    const indexes = sorted.filter(
      (object) => 'Type' in object.header && object.header.Type === 'INDEX',
    );

    expect(indexes[0].header).toMatchObject({ Name: 'foo_email_idx' });
    expect(indexes[1].header).toMatchObject({ Name: 'foo_id_idx' });
    expect(indexes[2].header).toMatchObject({ Name: 'foo_name_idx' });
  });

  test('sorts comments by type and target', () => {
    const dump = multiline`
      --
      -- Name: COLUMN foo.name; Type: COMMENT; Schema: public; Owner: postgres
      --
      
      COMMENT ON COLUMN public.foo.name IS 'Name column';
      
      
      --
      -- Name: TABLE foo; Type: COMMENT; Schema: public; Owner: postgres
      --
      
      COMMENT ON TABLE public.foo IS 'Foo table';
      
      
      --
      -- Name: COLUMN foo.id; Type: COMMENT; Schema: public; Owner: postgres
      --
      
      COMMENT ON COLUMN public.foo.id IS 'ID column';
      
      
      --
      -- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
      --
      
      COMMENT ON EXTENSION pgcrypto IS 'Crypto extension';
    `;

    const schemaObjects = parsePgDump(dump);
    const sorted = sortSchemaObjects(schemaObjects);

    const comments = sorted.filter(
      (object) => 'Type' in object.header && object.header.Type === 'COMMENT',
    );

    // Extension comment first
    expect(comments[0].header).toMatchObject({ Name: 'EXTENSION pgcrypto' });
    // Then table comment
    expect(comments[1].header).toMatchObject({ Name: 'TABLE foo' });
    // Then column comments sorted by name
    expect(comments[2].header).toMatchObject({ Name: 'COLUMN foo.id' });
    expect(comments[3].header).toMatchObject({ Name: 'COLUMN foo.name' });
  });

  test('groups and sorts schema objects by scope', () => {
    const dump = multiline`
      --
      -- Name: foo; Type: TABLE; Schema: public; Owner: postgres
      --
      
      CREATE TABLE public.foo (
          id integer NOT NULL,
          name text NOT NULL
      );
      
      
      --
      -- Name: foo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
      --
      
      ALTER TABLE ONLY public.foo
          ADD CONSTRAINT foo_pkey PRIMARY KEY (id);
      
      
      --
      -- Name: foo_name_idx; Type: INDEX; Schema: public; Owner: postgres
      --
      
      CREATE INDEX foo_name_idx ON public.foo USING btree (name);
      
      
      --
      -- Name: bar; Type: TABLE; Schema: public; Owner: postgres
      --
      
      CREATE TABLE public.bar (
          id integer NOT NULL,
          foo_id integer
      );
      
      
      --
      -- Name: bar_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
      --
      
      ALTER TABLE ONLY public.bar
          ADD CONSTRAINT bar_pkey PRIMARY KEY (id);
      
      
      --
      -- Name: bar_foo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
      --
      
      ALTER TABLE ONLY public.bar
          ADD CONSTRAINT bar_foo_id_fkey FOREIGN KEY (foo_id) REFERENCES public.foo(id);
    `;

    const schemaObjects = parsePgDump(dump);
    const grouped = groupAndSortSchemaObjects(schemaObjects);

    // Should have two groups for the two tables
    const tableGroups = Array.from(grouped.keys()).filter((key) =>
      key.includes('TABLE:'),
    );
    expect(tableGroups).toHaveLength(2);

    // Each group should be sorted internally
    for (const [key, objects] of grouped.entries()) {
      if (key.includes('TABLE:public:foo')) {
        // foo table group should have table, constraint, and index
        expect(objects).toHaveLength(3);
        expect(objects[0].header).toMatchObject({ Type: 'TABLE' });
        expect(objects[1].header).toMatchObject({ Type: 'CONSTRAINT' });
        expect(objects[2].header).toMatchObject({ Type: 'INDEX' });
      } else if (key.includes('TABLE:public:bar')) {
        // bar table group should have table and two constraints
        expect(objects).toHaveLength(3);
        expect(objects[0].header).toMatchObject({ Type: 'TABLE' });
        expect(objects[1].header).toMatchObject({ Type: 'CONSTRAINT' });
        expect(objects[2].header).toMatchObject({ Type: 'FK CONSTRAINT' });
      }
    }
  });

  test('sortSchemaObjectsByScope returns flat sorted array', () => {
    const dump = multiline`
      --
      -- Name: foo; Type: TABLE; Schema: public; Owner: postgres
      --
      
      CREATE TABLE public.foo (
          id integer NOT NULL
      );
      
      
      --
      -- Name: foo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
      --
      
      ALTER TABLE ONLY public.foo
          ADD CONSTRAINT foo_pkey PRIMARY KEY (id);
      
      
      --
      -- Name: bar; Type: TABLE; Schema: public; Owner: postgres
      --
      
      CREATE TABLE public.bar (
          id integer NOT NULL
      );
      
      
      --
      -- Name: bar_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
      --
      
      ALTER TABLE ONLY public.bar
          ADD CONSTRAINT bar_pkey PRIMARY KEY (id);
    `;

    const schemaObjects = parsePgDump(dump);
    const sorted = sortSchemaObjectsByScope(schemaObjects);

    expect(sorted).toHaveLength(4);

    // Objects should be grouped by table
    // First bar table and its constraint
    expect(sorted[0].header).toMatchObject({ Name: 'bar', Type: 'TABLE' });
    expect(sorted[1].header).toMatchObject({
      Name: 'bar_pkey',
      Type: 'CONSTRAINT',
    });

    // Then foo table and its constraint
    expect(sorted[2].header).toMatchObject({ Name: 'foo', Type: 'TABLE' });
    expect(sorted[3].header).toMatchObject({
      Name: 'foo_pkey',
      Type: 'CONSTRAINT',
    });
  });

  test('handles schemas correctly in sorting', () => {
    const dump = multiline`
      --
      -- Name: foo; Type: TABLE; Schema: custom; Owner: postgres
      --
      
      CREATE TABLE custom.foo (
          id integer NOT NULL
      );
      
      
      --
      -- Name: foo; Type: TABLE; Schema: public; Owner: postgres
      --
      
      CREATE TABLE public.foo (
          id integer NOT NULL
      );
      
      
      --
      -- Name: bar; Type: TABLE; Schema: -; Owner: postgres
      --
      
      CREATE TABLE bar (
          id integer NOT NULL
      );
    `;

    const schemaObjects = parsePgDump(dump);
    const sorted = sortSchemaObjects(schemaObjects);

    // Tables with null schema should come first
    expect(sorted[0].header).toMatchObject({ Name: 'bar', Schema: null });
    // Then sorted by schema name
    expect(sorted[1].header).toMatchObject({ Name: 'foo', Schema: 'custom' });
    expect(sorted[2].header).toMatchObject({ Name: 'foo', Schema: 'public' });
  });
});
