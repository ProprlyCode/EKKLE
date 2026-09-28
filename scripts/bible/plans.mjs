// Builds the SQL for Ekklē's starter reading plans (migration 0038) from the
// Bible text in public/bible/bsb: John in 21 days, the Gospels in 90 days,
// Psalms & Proverbs in 30 days, and the Bible in a year.
//
// A reading is "BOOK.CHAPTER" or "BOOK.CHAPTER:FROM-TO" (verses).
// Usage: node scripts/bible/plans.mjs > /tmp/plans.sql
import { readFileSync } from 'node:fs';

const books = [...readFileSync(new URL('../../src/bible/books.ts', import.meta.url), 'utf8')
  .matchAll(/B\('([1-3A-Z]{3})', '([^']+)', (\d+),/g)].map((m) => ({ id: m[1], name: m[2], chapters: +m[3] }));
if (books.length !== 66) throw new Error('expected 66 books');
const byId = Object.fromEntries(books.map((b) => [b.id, b]));
const verses = (id, ch) => JSON.parse(readFileSync(new URL(`../../public/bible/bsb/${id}.json`, import.meta.url), 'utf8'))[ch - 1].length;
const chapters = (...ids) => ids.flatMap((id) => Array.from({ length: byId[id].chapters }, (_, i) => `${id}.${i + 1}`));

// Spread a list of readings over n days as evenly as possible, in order.
function spread(list, n) {
  const days = [];
  for (let d = 0; d < n; d++) days.push(list.slice(Math.round((d * list.length) / n), Math.round(((d + 1) * list.length) / n)));
  return days;
}

const plans = [];

plans.push({
  title: 'John in 21 days',
  description: 'The Gospel of John, a chapter a day — a good place to begin.',
  days: chapters('JHN').map((r) => [r]),
});

// 89 chapters over 90 days: Luke 1 (the longest) is read over two days.
const lk1 = verses('LUK', 1);
const gospels = chapters('MAT', 'MRK', 'LUK', 'JHN').flatMap((r) =>
  r === 'LUK.1' ? [[`LUK.1:1-38`], [`LUK.1:39-${lk1}`]] : [[r]],
);
plans.push({
  title: 'The Gospels in 90 days',
  description: 'Matthew, Mark, Luke and John — the life of Jesus, about a chapter a day.',
  days: gospels,
});

const ps = chapters('PSA');
const pr = chapters('PRO');
plans.push({
  title: 'Psalms & Proverbs in 30 days',
  description: 'Five psalms and a chapter of Proverbs each day.',
  days: Array.from({ length: 30 }, (_, d) => [...ps.slice(d * 5, d * 5 + 5), ...(d < 29 ? [pr[d]] : pr.slice(29))]),
});

plans.push({
  title: 'The Bible in a year',
  description: 'All of Scripture, Genesis to Revelation, in 365 days — about three chapters a day.',
  days: spread(chapters(...books.map((b) => b.id)), 365),
});

const q = (s) => `'${s.replace(/'/g, "''")}'`;
let sql = '';
plans.forEach((p, i) => {
  sql += `\nwith p as (\n  insert into reading_plans (org_id, title, description, position, status)\n  values (null, ${q(p.title)}, ${q(p.description)}, ${i + 1}, 'published')\n  returning id\n)\ninsert into reading_plan_days (plan_id, day, readings)\nselect p.id, d.day, d.readings from p, (values\n`;
  sql += p.days.map((r, d) => `  (${d + 1}, array[${r.map(q).join(', ')}]::text[])`).join(',\n');
  sql += `\n) as d(day, readings);\n`;
  const count = p.days.flat().length;
  process.stderr.write(`${p.title}: ${p.days.length} days, ${count} readings\n`);
});
process.stdout.write(sql);
