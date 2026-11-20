export function validEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 190 && /^\S+@\S+\.\S+$/.test(email) ? email : null;
}

export function overlaps(existingStart, existingEnd, requestedStart, requestedEnd) {
  return existingStart < requestedEnd && existingEnd > requestedStart;
}

export function chooseTables(tables, partySize) {
  const ordered = [...tables].sort((a, b) => a.capacity - b.capacity || a.table_id - b.table_id);
  const table = ordered.find(candidate => Number(candidate.capacity) >= partySize);
  return table ? [table] : [];
}

export function validInterval(start, end, opening, closing) {
  return end > start && start >= opening && end <= closing;
}
