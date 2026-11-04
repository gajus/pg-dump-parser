import { parsePgDump } from './parsePgDump';
import { scopeSchemaObject } from './scopeSchemaObject';
import {
  groupAndSortSchemaObjects,
  sortSchemaObjects,
} from './sortSchemaObjects';
import { expect, test } from 'vitest';

test.each([
  {
    name: 'files',
    quotedName: 'files',
    schema: 'public',
    target: 'public.files',
  },
  {
    name: 'project "files.on"',
    quotedName: '"project ""files.on"""',
    schema: 'catalog.data',
    target: '"catalog.data"."project ""files.on"""',
  },
])(
  'scopes row security and policies to $target',
  ({ name, quotedName, schema, target }) => {
    const dump = `--
-- Name: ${name}; Type: TABLE; Schema: ${schema}; Owner: postgres
--

CREATE TABLE ${target} (project_id integer);

ALTER TABLE ONLY ${target} FORCE ROW LEVEL SECURITY;


ALTER TABLE ${target} OWNER TO postgres;


--
-- Name: ${name}; Type: ROW SECURITY; Schema: ${schema}; Owner: postgres
--

ALTER TABLE ${target} ENABLE ROW LEVEL SECURITY;

--
-- Name: ${name} project access; Type: POLICY; Schema: ${schema}; Owner: postgres
--

CREATE POLICY "project access" ON ${target} AS RESTRICTIVE TO reader USING ((project_id = 1)) WITH CHECK ((project_id = 1));

--
-- Name: POLICY "project access" ON ${quotedName}; Type: COMMENT; Schema: ${schema}; Owner: postgres
--

COMMENT ON POLICY "project access" ON ${target} IS 'Project access';
`;
    const objects = parsePgDump(dump);
    expect(objects).toHaveLength(5);
    for (const object of objects) {
      expect(scopeSchemaObject(objects, object)).toEqual({
        name,
        schema,
        type: 'TABLE',
      });
    }

    expect(objects[0].sql).toContain(
      `ALTER TABLE ONLY ${target} FORCE ROW LEVEL SECURITY;`,
    );
    const sorted = sortSchemaObjects(objects.toReversed());
    const types = sorted.map(
      (object) => 'Type' in object.header && object.header.Type,
    );
    expect(types).toEqual([
      'TABLE',
      'TABLE',
      'ROW SECURITY',
      'POLICY',
      'COMMENT',
    ]);
    const groups = groupAndSortSchemaObjects(objects);
    expect([...groups.keys()]).toEqual([`TABLE:${schema}:${name}`]);
    expect([...groups.values()][0]).toHaveLength(5);
  },
);

test('does not attach a policy to an identically named table in another schema', () => {
  const objects = parsePgDump(`--
-- Name: files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.files (project_id integer);

--
-- Name: files access; Type: POLICY; Schema: catalog; Owner: postgres
--

CREATE POLICY access ON catalog.files FOR SELECT USING (true);
`);
  expect(scopeSchemaObject(objects, objects[1])).toBeNull();
});
