function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function normalizeTransaction(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw invalid("Transação inválida.");
  }
  const id = String(input.id || "");
  const type = input.type;
  const rawValue = Number(input.value);
  const date = String(input.date || "");
  if (!id || id.length > 128 || !["earning", "expense"].includes(type)) {
    throw invalid("Transação inválida.");
  }
  if (!Number.isFinite(rawValue) || rawValue <= 0 || rawValue > 1_000_000_000) {
    throw invalid("O valor da transação é inválido.");
  }

  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T12:00:00.000Z`)
    : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw invalid("A data da transação é inválida.");
  }

  const numberOrZero = (entry) => {
    const parsed = Number(entry || 0);
    return Number.isFinite(parsed) && parsed >= 0 && parsed < 1_000_000
      ? Math.round(parsed * 100) / 100
      : 0;
  };
  const rawTime = typeof input.time === "string" ? input.time : "";
  const time = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(rawTime)
    ? rawTime.slice(0, 8)
    : "";

  return {
    id,
    type,
    value: Math.round(rawValue * 100) / 100,
    date,
    time,
    category: typeof input.category === "string" ? input.category.slice(0, 64) : "",
    km: numberOrZero(input.km),
    hours: numberOrZero(input.hours),
    description: typeof input.description === "string" ? input.description.slice(0, 500) : "",
    created_at: input.createdAt && !Number.isNaN(Date.parse(input.createdAt))
      ? new Date(input.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

export function normalizeTransactionBatch(input) {
  if (!Array.isArray(input) || input.length > 2500) {
    throw invalid("Lista de transações inválida.");
  }
  const transactions = input.map(normalizeTransaction);
  if (new Set(transactions.map(({ id }) => id)).size !== transactions.length) {
    throw invalid("A lista contém transações duplicadas.");
  }
  return transactions;
}
