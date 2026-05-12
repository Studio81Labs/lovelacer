export function normalizeEntitySearch(value: string): string {
  return value.trim().toLowerCase()
}

export function entityMatchesSearch(
  query: string,
  entityId: string,
  friendlyName: string,
): boolean {
  const normalized = normalizeEntitySearch(query)
  if (normalized === '') return true

  return (
    entityId.toLowerCase().includes(normalized) || friendlyName.toLowerCase().includes(normalized)
  )
}
