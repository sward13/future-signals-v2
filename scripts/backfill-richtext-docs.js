#!/usr/bin/env node
// Backfill rich-text `<field>_doc` jsonb columns from the legacy text columns,
// using the SAME textToDoc wrapper the app uses (blank lines → separate
// paragraphs, soft newlines → hardBreak) — never a single-paragraph wrap.
//
// Idempotent: only fills rows where <field>_doc IS NULL and the text column is
// non-empty. Safe to re-run. Per-entity so it can run right after each batch's
// migration; a table whose _doc columns don't exist yet is skipped with a note.
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (bare names — see CLAUDE.md).
//   node --env-file=.env.local scripts/backfill-richtext-docs.js [table ...]
// With no table args, processes every table below.
//
// Run against staging first, then production at merge time.

import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { textToDoc } from '../src/lib/richtextDoc.js';

const TARGETS = {
  analyses:          ['description', 'key_dynamics', 'implications'],
  preferred_futures: ['description', 'desired_outcomes'],
  scenarios:         ['description', 'narrative'],
  strategic_options: ['description', 'intended_outcome', 'actions', 'implications', 'dependencies', 'risks'],
};

const { positionals } = parseArgs({ allowPositionals: true });
const tables = positionals.length ? positionals : Object.keys(TARGETS);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PAGE = 500;

async function backfillField(table, field) {
  const docCol = `${field}_doc`;
  let filled = 0;
  // Page through rows needing a doc. We re-query from the start each loop
  // because updated rows drop out of the `is null` filter.
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(`id, ${field}`)
      .is(docCol, null)
      .not(field, 'is', null)
      .neq(field, '')
      .limit(PAGE);
    if (error) {
      if (/column .* does not exist/i.test(error.message)) {
        console.log(`  - ${table}.${docCol}: column missing (batch not migrated yet) — skipped`);
        return null;
      }
      throw new Error(`[${table}.${field}] select failed: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const doc = textToDoc(row[field]);
      const { error: upErr } = await supabase.from(table).update({ [docCol]: doc }).eq('id', row.id);
      if (upErr) throw new Error(`[${table}.${field}] update ${row.id} failed: ${upErr.message}`);
      filled++;
    }
    if (data.length < PAGE) break;
  }
  console.log(`  - ${table}.${field} → ${docCol}: ${filled} row(s) backfilled`);
  return filled;
}

(async () => {
  for (const table of tables) {
    const fields = TARGETS[table];
    if (!fields) { console.log(`(unknown table "${table}" — skipped)`); continue; }
    console.log(`\n${table}:`);
    for (const field of fields) await backfillField(table, field);
  }
  console.log('\nDone.');
})().catch((e) => { console.error(e); process.exit(1); });
