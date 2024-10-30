# pg-dump-parser

Parses PostgreSQL dump files into an array of schema objects.

## Motivation

This allows to submit a PostgreSQL schema dump to version control in a way that enables easy diffing.

## Usage

```ts
import { parsePgDump } from 'pg-dump-parser';

const dump = await readFile('dump.sql', 'utf8');

const schemaObjects = parsePgDump(dump);

for (const schemaObject of schemaObjects) {
  console.log(schemaObject);
}
```

> [!NOTE]
> The expected input is a PostgreSQL dump file created with `pg_dump --schema-only`.

The output is an array of objects, each representing a schema object in the dump file and the corresponding header, e.g.,

```json
[
  {
      "header": {
          "Name": "bar",
          "Owner": "postgres",
          "Schema": "public",
          "Type": "TABLE"
      },
      "sql": "CREATE TABLE public.bar (\n    id integer NOT NULL,\n    uid text NOT NULL,\n    foo_id integer\n);"
  },
  {
      "header": {
          "Name": "bar",
          "Owner": "postgres",
          "Schema": "public",
          "Type": "TABLE"
      },
      "sql": "ALTER TABLE public.bar OWNER TO postgres;"
  },
  {
      "header": {
          "Name": "bar_id_seq",
          "Owner": "postgres",
          "Schema": "public",
          "Type": "SEQUENCE"
      },
      "sql": "ALTER TABLE public.bar ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (\n    SEQUENCE NAME public.bar_id_seq\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1\n);"
  }
]
```

## Alternatives

* https://github.com/omniti-labs/pg_extractor
  * Prior to writing pg-dump-parser, I used this tool to extract the schema. It works well, but it's slow. It was taking a whole minute to parse our dump file. We needed something that implements equivalent functionality, but is faster. `pg-dump-parser` processes the same dump with in a few seconds.