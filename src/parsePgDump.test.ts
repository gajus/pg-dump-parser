import { parsePgDump } from './parsePgDump';
import multiline from 'multiline-ts';
import { expect, test } from 'vitest';

const dump = multiline`
--
-- PostgreSQL database dump
--

-- Dumped from database version 16.2 (Debian 16.2-1.pgdg120+2)
-- Dumped by pg_dump version 16.2 (Debian 16.2-1.pgdg120+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: quux; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA quux;


ALTER SCHEMA quux OWNER TO postgres;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner:
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.status AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public.status OWNER TO postgres;

--
-- Name: CAST (text AS integer); Type: CAST; Schema: -; Owner: -
--

CREATE CAST (text AS integer) WITH INOUT AS IMPLICIT;


--
-- Name: add_two_numbers(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.add_two_numbers(a integer, b integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN a + b;
END;
$$;


ALTER FUNCTION public.add_two_numbers(a integer, b integer) OWNER TO postgres;

--
-- Name: notify_foo_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_foo_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE NOTICE 'A new row was inserted into the foo table with id: %', NEW.id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_foo_insert() OWNER TO postgres;

--
-- Name: say_hello(character varying); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.say_hello(IN name_param character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE NOTICE 'Hello, %!', name_param;
END;
$$;


ALTER PROCEDURE public.say_hello(IN name_param character varying) OWNER TO postgres;

--
-- Name: my_sum(integer); Type: AGGREGATE; Schema: public; Owner: postgres
--

CREATE AGGREGATE public.my_sum(integer) (
    SFUNC = public.add_two_numbers,
    STYPE = integer
);


ALTER AGGREGATE public.my_sum(integer) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bar; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bar (
    id integer NOT NULL,
    uid text NOT NULL,
    foo_id integer
);


ALTER TABLE public.bar OWNER TO postgres;

--
-- Name: bar_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.bar ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.bar_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: baz; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.baz AS
 SELECT id,
    uid AS name
   FROM public.bar;


ALTER VIEW public.baz OWNER TO postgres;

--
-- Name: corge; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.corge (
    id integer,
    name text
);


ALTER TABLE public.corge OWNER TO postgres;

--
-- Name: corge_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.corge_id_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.corge_id_seq OWNER TO postgres;

--
-- Name: corge_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.corge_id_seq OWNED BY public.corge.id;


--
-- Name: foo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.foo (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.foo OWNER TO postgres;

--
-- Name: TABLE foo; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.foo IS 'Table comment x';


--
-- Name: COLUMN foo.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.foo.id IS 'Column comment x';


--
-- Name: foo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.foo ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.foo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: SEQUENCE foo_id_seq; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON SEQUENCE public.foo_id_seq IS 'Sequence comment x';


--
-- Name: qux; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.qux AS
 SELECT id,
    uid AS name
   FROM public.bar
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.qux OWNER TO postgres;

--
-- Name: corge id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corge ALTER COLUMN id SET DEFAULT nextval('public.corge_id_seq'::regclass);


--
-- Name: bar bar_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bar
    ADD CONSTRAINT bar_pkey PRIMARY KEY (id);


--
-- Name: foo foo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.foo
    ADD CONSTRAINT foo_pkey PRIMARY KEY (id);


--
-- Name: bar_uid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX bar_uid_idx ON public.bar USING btree (uid);


--
-- Name: INDEX foo_pkey; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.foo_pkey IS 'Index comment x';


--
-- Name: foo foo_insert_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER foo_insert_trigger AFTER INSERT ON public.foo FOR EACH ROW EXECUTE FUNCTION public.notify_foo_insert();


--
-- Name: bar bar_foo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bar
    ADD CONSTRAINT bar_foo_id_fkey FOREIGN KEY (foo_id) REFERENCES public.foo(id) ON DELETE CASCADE;


--
-- Name: foo_publication; Type: PUBLICATION; Schema: -; Owner: postgres
--

CREATE PUBLICATION foo_publication FOR ALL TABLES WITH (publish = 'insert, update, delete');


ALTER PUBLICATION foo_publication OWNER TO postgres;

--
-- Name: COLUMN foo.name; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(name) ON TABLE public.foo TO postgres;


--
-- PostgreSQL database dump complete
--
`;

test('extracts SEQUENCE', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'bar_id_seq',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'SEQUENCE',
    },
    sql: multiline`
      ALTER TABLE public.bar ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
          SEQUENCE NAME public.bar_id_seq
          START WITH 1
          INCREMENT BY 1
          NO MINVALUE
          NO MAXVALUE
          CACHE 1
      );
    `,
  });
});

test('extracts TABLE', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'foo',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'TABLE',
    },
    sql: multiline`
      CREATE TABLE public.foo (
          id integer NOT NULL,
          name text NOT NULL
      );
    `,
  });
});

test('extracts CONSTRAINT', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'foo foo_pkey',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'CONSTRAINT',
    },
    sql: multiline`
      ALTER TABLE ONLY public.foo
          ADD CONSTRAINT foo_pkey PRIMARY KEY (id);
    `,
  });
});

test('extracts COMMENT on TABLE', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'TABLE foo',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'COMMENT',
    },
    sql: multiline`
      COMMENT ON TABLE public.foo IS 'Table comment x';
    `,
  });
});

test('extracts COMMENT on COLUMN', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'COLUMN foo.id',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'COMMENT',
    },
    sql: multiline`
      COMMENT ON COLUMN public.foo.id IS 'Column comment x';
    `,
  });
});

test('extracts COMMENT on INDEX', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'INDEX foo_pkey',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'COMMENT',
    },
    sql: multiline`
      COMMENT ON INDEX public.foo_pkey IS 'Index comment x';
    `,
  });
});

test('extracts COMMENT on SEQUENCE', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'SEQUENCE foo_id_seq',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'COMMENT',
    },
    sql: multiline`
      COMMENT ON SEQUENCE public.foo_id_seq IS 'Sequence comment x';
    `,
  });
});

test('extracts PUBLICATION', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'foo_publication',
      Owner: 'postgres',
      Schema: null,
      Type: 'PUBLICATION',
    },
    sql: multiline`
      CREATE PUBLICATION foo_publication FOR ALL TABLES WITH (publish = 'insert, update, delete');
    `,
  });
});

test('extracts SCHEMA', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'quux',
      Owner: 'postgres',
      Schema: null,
      Type: 'SCHEMA',
    },
    sql: multiline`
      CREATE SCHEMA quux;
    `,
  });
});

test('extracts VIEW', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'baz',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'VIEW',
    },
    sql: multiline`
      CREATE VIEW public.baz AS
       SELECT id,
          uid AS name
         FROM public.bar;
    `,
  });
});

test('extracts MATERIALIZED VIEW', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'qux',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'MATERIALIZED VIEW',
    },
    sql: multiline`
      CREATE MATERIALIZED VIEW public.qux AS
       SELECT id,
          uid AS name
         FROM public.bar
        WITH NO DATA;
    `,
  });
});

test('extracts FUNCTION', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'add_two_numbers(integer, integer)',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'FUNCTION',
    },
    sql: multiline`
      CREATE FUNCTION public.add_two_numbers(a integer, b integer) RETURNS integer
          LANGUAGE plpgsql
          AS $$
      BEGIN
          RETURN a + b;
      END;
      $$;
    `,
  });
});

test('extracts PROCEDURE', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'say_hello(character varying)',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'PROCEDURE',
    },
    sql: multiline`
      CREATE PROCEDURE public.say_hello(IN name_param character varying)
          LANGUAGE plpgsql
          AS $$
      BEGIN
          RAISE NOTICE 'Hello, %!', name_param;
      END;
      $$;
    `,
  });
});

test('extracts TRIGGER', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'foo foo_insert_trigger',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'TRIGGER',
    },
    sql: multiline`
      CREATE TRIGGER foo_insert_trigger AFTER INSERT ON public.foo FOR EACH ROW EXECUTE FUNCTION public.notify_foo_insert();
    `,
  });
});

test('extracts TYPE', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'status',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'TYPE',
    },
    sql: multiline`
      CREATE TYPE public.status AS ENUM (
          'ACTIVE',
          'INACTIVE'
      );
    `,
  });
});

test('extracts AGGREGATE', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'my_sum(integer)',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'AGGREGATE',
    },
    sql: multiline`
      CREATE AGGREGATE public.my_sum(integer) (
          SFUNC = public.add_two_numbers,
          STYPE = integer
      );
    `,
  });
});

test('extracts FK CONSTRAINT', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'bar bar_foo_id_fkey',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'FK CONSTRAINT',
    },
    sql: multiline`
      ALTER TABLE ONLY public.bar
          ADD CONSTRAINT bar_foo_id_fkey FOREIGN KEY (foo_id) REFERENCES public.foo(id) ON DELETE CASCADE;
    `,
  });
});

test('extracts INDEX', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'bar_uid_idx',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'INDEX',
    },
    sql: multiline`
      CREATE UNIQUE INDEX bar_uid_idx ON public.bar USING btree (uid);
    `,
  });
});

test('extracts CAST', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'CAST (text AS integer)',
      Owner: null,
      Schema: null,
      Type: 'CAST',
    },
    sql: multiline`
      CREATE CAST (text AS integer) WITH INOUT AS IMPLICIT;
    `,
  });
});

test('extracts EXTENSION', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'pgcrypto',
      Owner: null,
      Schema: null,
      Type: 'EXTENSION',
    },
    sql: multiline`
      CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
    `,
  });
});

test('extracts ACL', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'COLUMN foo.name',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'ACL',
    },
    sql: multiline`
      GRANT SELECT(name) ON TABLE public.foo TO postgres;
    `,
  });
});

test('extracts DEFAULT', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'corge id',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'DEFAULT',
    },
    sql: multiline`
      ALTER TABLE ONLY public.corge ALTER COLUMN id SET DEFAULT nextval('public.corge_id_seq'::regclass);
    `,
  });
});

test('extracts SEQUENCE OWNED BY', async () => {
  const schemaObjects = parsePgDump(dump);

  expect(schemaObjects).toContainEqual({
    header: {
      Name: 'corge_id_seq',
      Owner: 'postgres',
      Schema: 'public',
      Type: 'SEQUENCE OWNED BY',
    },
    sql: multiline`
      ALTER SEQUENCE public.corge_id_seq OWNED BY public.corge.id;
    `,
  });
});
