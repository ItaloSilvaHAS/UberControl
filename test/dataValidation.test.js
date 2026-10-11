import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTransaction, normalizeTransactionBatch } from "../server/dataValidation.js";

test("normalizes accepted transaction fields and currency precision", () => {
  const transaction = normalizeTransaction({
    id: "tx-1",
    type: "earning",
    value: 142.349,
    date: "2026-10-10",
    time: "08:35",
    category: "uber",
    km: 12.258,
    hours: 2,
    description: "<script>not rendered as markup</script>",
    createdAt: "2026-10-10T12:00:00.000Z",
  });

  assert.equal(transaction.value, 142.35);
  assert.equal(transaction.km, 12.26);
  assert.equal(transaction.time, "08:35");
  assert.equal(transaction.description, "<script>not rendered as markup</script>");
});

test("rejects invalid types, impossible calendar dates, and non-positive amounts", () => {
  const valid = { id: "tx", type: "earning", value: 1, date: "2026-10-10" };
  assert.throws(() => normalizeTransaction({ ...valid, type: "refund" }), { status: 400 });
  assert.throws(() => normalizeTransaction({ ...valid, date: "2026-02-30" }), { status: 400 });
  assert.throws(() => normalizeTransaction({ ...valid, value: 0 }), { status: 400 });
});

test("rejects oversized and duplicate transaction batches", () => {
  const valid = { id: "tx", type: "expense", value: 45.5, date: "2026-10-10" };
  assert.throws(() => normalizeTransactionBatch([valid, valid]), /duplicadas/);
  assert.throws(() => normalizeTransactionBatch(new Array(2501).fill(valid)), /inválida/);
});

test("ignores invalid optional time and bounds imported text", () => {
  const transaction = normalizeTransaction({
    id: "tx-2",
    type: "expense",
    value: 12,
    date: "2026-10-10",
    time: "99:99",
    category: "x".repeat(100),
    description: "d".repeat(900),
  });
  assert.equal(transaction.time, "");
  assert.equal(transaction.category.length, 64);
  assert.equal(transaction.description.length, 500);
});
