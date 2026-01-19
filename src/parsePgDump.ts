/* eslint-disable no-console */
import { z } from 'zod';

// These are the attribute less headers, e.g.
// --
// -- PostgreSQL database dump
// --
const TitleHeaderZodSchema = z.object({
  Title: z.string(),
});

// These are the objects with attributes, e.g.
// --
// -- Name: citext; Type: EXTENSION; Schema: -; Owner: -
// --
const AttributedHeaderZodSchema = z.object({
  Name: z.string(),
  Owner: z.string().nullable(),
  Schema: z.string().nullable(),
  Type: z.enum([
    'ACL',
    'AGGREGATE',
    'CAST',
    'COMMENT',
    'CONSTRAINT',
    'DEFAULT ACL',
    'DEFAULT',
    'DOMAIN',
    'EXTENSION',
    'FK CONSTRAINT',
    'FUNCTION',
    'INDEX',
    'MATERIALIZED VIEW',
    'PROCEDURE',
    'PUBLICATION',
    'SCHEMA',
    'SEQUENCE OWNED BY',
    'SEQUENCE',
    'TABLE ATTACH',
    'TABLE',
    'TEXT SEARCH CONFIGURATION',
    'TEXT SEARCH DICTIONARY',
    'TRIGGER',
    'TYPE',
    'VIEW',
  ]),
});

const HeaderZodSchema = z.union([
  TitleHeaderZodSchema,
  AttributedHeaderZodSchema,
]);

export type AttributedHeader = z.infer<typeof AttributedHeaderZodSchema>;
export type Header = z.infer<typeof HeaderZodSchema>;
export type TitleHeader = z.infer<typeof TitleHeaderZodSchema>;

const isHeader = (fragment: string): boolean => {
  return fragment.startsWith('--\n--');
};

const parseValue = (value: string) => {
  if (value === '-' || value === '' || value === undefined) {
    return null;
  }

  return value;
};

const parseAttribute = (attribute: string): [string, null | string] => {
  const [name, value] = attribute.split(':');

  return [name, parseValue(value.trim())];
};

// --
// -- Name: TABLE user_survey; Type: ACL; Schema: public; Owner: postgres
// --

const parseHeader = (fragment: string) => {
  try {
    const lines = fragment.split('\n');

    if (lines.length !== 3) {
      throw new Error('Invalid header');
    }

    const contentLine = lines[1].slice(3);

    if (
      contentLine === 'PostgreSQL database dump' ||
      contentLine === 'PostgreSQL database dump complete'
    ) {
      return HeaderZodSchema.parse({
        Title: contentLine,
      });
    }

    const content = Object.fromEntries(
      contentLine.split('; ').map((attribute) => {
        return parseAttribute(attribute);
      }),
    );

    const result = HeaderZodSchema.safeParse(content);

    if (!result.success) {
      throw new Error('Invalid header');
    }

    return result.data;
  } catch (error) {
    console.warn('[pg-dump-parser] failing fragment');
    console.warn(fragment);

    throw error;
  }
};

export type SchemaObject = {
  header: Header;
  sql: string;
};

export const parsePgDump = (dump: string) => {
  const schemaObjects: SchemaObject[] = [];

  const fragments = dump.trim().split(/(--\n-- .*\n--)/u);

  let lastHeader: Header | null = null;

  for (const fragment of fragments.map((chunk) => chunk.trim())) {
    if (fragment === '') {
      continue;
    }

    if (isHeader(fragment)) {
      lastHeader = parseHeader(fragment);
    } else if (lastHeader) {
      const subFragments = fragment.split('\n\n\n');

      for (const subFragment of subFragments) {
        schemaObjects.push({
          header: lastHeader,
          sql: subFragment,
        });
      }
    } else {
      throw new Error('No header');
    }
  }

  return schemaObjects;
};
