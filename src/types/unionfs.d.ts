declare module 'unionfs' {
  import { Volume } from 'memfs'

  export interface Union extends IFS {
    use(fs: IFS | ReturnType<typeof Volume.fromJSON>): this
  }

  export class Union implements Union {}

  export const ufs: Union

  import { Writable, Readable } from 'stream'
  import * as fs from 'fs'

  type FSMethods =
    | 'readFileSync'
    | 'renameSync'
    | 'ftruncateSync'
    | 'truncateSync'
    | 'chownSync'
    | 'fchownSync'
    | 'lchownSync'
    | 'chmodSync'
    | 'fchmodSync'
    | 'lchmodSync'
    | 'statSync'
    | 'lstatSync'
    | 'fstatSync'
    | 'linkSync'
    | 'symlinkSync'
    | 'readlinkSync'
    | 'realpathSync'
    | 'unlinkSync'
    | 'rmdirSync'
    | 'mkdirSync'
    | 'readdirSync'
    | 'closeSync'
    | 'openSync'
    | 'utimesSync'
    | 'futimesSync'
    | 'fsyncSync'
    | 'writeSync'
    | 'readSync'
    | 'readFileSync'
    | 'writeFileSync'
    | 'appendFileSync'
    | 'existsSync'
    | 'accessSync'
    | 'createReadStream'
    | 'createWriteStream'
    | 'watchFile'
    | 'unwatchFile'
    | 'watch'
    | 'rename'
    | 'ftruncate'
    | 'truncate'
    | 'chown'
    | 'fchown'
    | 'lchown'
    | 'chmod'
    | 'fchmod'
    | 'lchmod'
    | 'stat'
    | 'lstat'
    | 'fstat'
    | 'link'
    | 'symlink'
    | 'readlink'
    | 'realpath'
    | 'unlink'
    | 'rmdir'
    | 'mkdir'
    | 'readdir'
    | 'readdir'
    | 'close'
    | 'open'
    | 'utimes'
    | 'futimes'
    | 'fsync'
    | 'write'
    | 'read'
    | 'readFile'
    | 'writeFile'
    | 'appendFile'
    | 'exists'
    | 'access'

  type FS = Pick<typeof fs, FSMethods>

  interface IFS extends FS {
    WriteStream: typeof Writable
    ReadStream: typeof Readable
  }
}
