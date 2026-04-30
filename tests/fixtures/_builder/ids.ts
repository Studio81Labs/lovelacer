/**
 * Convert a free-form name into a HA-friendly identifier:
 * lowercase, ASCII alphanumerics + underscores, no leading/trailing separators.
 */
export function slug(input: string): string {
  const result = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[''']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (result.length === 0) {
    throw new Error(`cannot slug ${JSON.stringify(input)} — produces empty string`)
  }
  return result
}

export function uniqueIdFor(fixtureName: string, entityId: string): string {
  return `${fixtureName}__${entityId}`
}
