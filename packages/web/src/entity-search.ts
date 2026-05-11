export function normalizeEntitySearch(value: string): string {
  return value.trim().toLocaleLowerCase()
}

export function entityMatchesSearch(
  query: string,
  entityId: string,
  friendlyName: string,
): boolean {
  const normalized = normalizeEntitySearch(query)
  if (normalized === '') return true

  return (
    entityId.toLocaleLowerCase().includes(normalized) ||
    friendlyName.toLocaleLowerCase().includes(normalized)
  )
}
