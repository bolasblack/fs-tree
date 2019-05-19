import _mkdirp from 'mkdirp'

export type FsImplementation = _mkdirp.FsImplementation

export function mkdirp(path: string, options?: Parameters<typeof _mkdirp>[1]) {
  return new Promise<_mkdirp.Made>((resolve, reject) => {
    _mkdirp(path, options || {}, (err, made) => {
      if (err) {
        reject(err)
      } else {
        resolve(made)
      }
    })
  })
}
