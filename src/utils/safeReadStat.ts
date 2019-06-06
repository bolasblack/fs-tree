export function createSafeReadStat<S>(readStat: (path: string) => Promise<S>) {
  return async function _safeReadStat(path: string) {
    try {
      return await readStat(path)
    } catch (err) {
      // istanbul ignore else
      if (err.code === 'ENOENT') return null
      // istanbul ignore next
      throw err
    }
  }
}
