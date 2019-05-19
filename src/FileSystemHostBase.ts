import { Host as IHost } from './interfaces'
import {
  mkdirp,
  FsImplementation as MkdirpFsImplementation,
} from './mkdirp-then'
import { groupBy, zipObj, mergeRight, compose } from 'ramda'
import { promisify } from 'util'
import sysPath from 'path'
import fs from 'fs'

type NativeFS = typeof fs

export interface FSImpl extends MkdirpFsImplementation {
  readFile: NativeFS['readFile']
  readdir: NativeFS['readdir']
  stat: NativeFS['stat']
  writeFile: NativeFS['writeFile']
  chmod: NativeFS['chmod']
  rename: NativeFS['rename']
  unlink: NativeFS['unlink']
}

export class FileSystemHostBase implements IHost {
  constructor(private _fs: FSImpl) {}

  readFile(path: string) {
    return promisify(this._fs.readFile.bind(this._fs))(path)
  }

  async readDir(path: string) {
    const entries = await promisify(this._fs.readdir.bind(this._fs))(path)
    const paths = entries.map(entry => sysPath.resolve(path, entry))

    const types = await Promise.all(
      paths.map(async entryPath => {
        return (await this.readStat(entryPath)).isDirectory() ? 'dirs' : 'files'
      }),
    )
    const typeMap = zipObj(paths, types)

    return compose(
      mergeRight({ files: [], dirs: [] }),
      groupBy((path: string) => typeMap[path]),
    )(paths) as {
      files: string[]
      dirs: string[]
    }
  }

  readStat(path: string) {
    return promisify(this._fs.stat.bind(this._fs))(path)
  }

  async writeFile(
    path: string,
    content?: Buffer,
    options?: IHost.writeFile.Options,
  ) {
    const parentPath = sysPath.resolve(path, '../')
    try {
      await this.mkdirp(parentPath)
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
    }

    if (content != null) {
      await promisify(this._fs.writeFile.bind(this._fs))(path, content, options)
    }

    // memfs.writeFile not support assign file mode
    if (options && options.mode != null) {
      await promisify(this._fs.chmod.bind(this._fs))(path, options.mode)
    }
  }

  moveFile(from: string, to: string) {
    return promisify(this._fs.rename.bind(this._fs))(from, to)
  }

  deleteFile(path: string) {
    return promisify(this._fs.unlink.bind(this._fs))(path)
  }

  async mkdirp(path: string) {
    await mkdirp(path, { fs: this._fs })
  }
}
