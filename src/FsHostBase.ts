import { Host as IHost, StatsModifyOptions } from './interfaces'
import {
  mkdirp,
  FsImplementation as MkdirpFsImplementation,
} from './mkdirp-then'
import { groupBy, zipObj, mergeRight, compose } from 'ramda'
import { promisify } from 'util'
import sysPath from 'path'
import fs from 'fs'
import {
  FileAlreadyExistException,
  FileDoesNotExistException,
  PathIsDirectoryException,
} from './exceptions'

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

export class FsHostBase implements IHost {
  constructor(private _fs: FSImpl) {}

  read(path: string) {
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

  async overwrite(
    path: string,
    content?: Buffer,
    options?: IHost.create.Options,
  ) {
    const originStat = await this._safeReadStat(path)

    if (!originStat) {
      throw new FileDoesNotExistException(path)
    }

    if (originStat.isDirectory()) {
      throw new PathIsDirectoryException(path)
    }

    await this._write(path, content, options)
  }

  async create(path: string, content: Buffer, options?: IHost.create.Options) {
    if (await this._safeReadStat(path)) {
      throw new FileAlreadyExistException(path)
    }

    await this._write(path, content, options)
  }

  async move(from: string, to: string) {
    const [sourcePathStat, targetPathStat] = await Promise.all([
      this._safeReadStat(from),
      this._safeReadStat(to),
    ])

    if (!sourcePathStat) {
      throw new FileDoesNotExistException(from)
    }

    if (from === to) return

    if (targetPathStat) {
      throw new FileAlreadyExistException(to)
    }

    await this._mkdirToParent(to)
    await promisify(this._fs.rename.bind(this._fs))(from, to)
  }

  async delete(path: string) {
    const stat = await this._safeReadStat(path)

    if (!stat) {
      throw new FileDoesNotExistException(path)
    }

    if (stat.isDirectory()) {
      throw new PathIsDirectoryException(path)
    }

    await promisify(this._fs.unlink.bind(this._fs))(path)
  }

  private async _mkdirToParent(path: string) {
    const parentPath = sysPath.resolve(path, '../')

    try {
      await mkdirp(parentPath, { fs: this._fs })
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
    }
  }

  private async _write(
    path: string,
    content?: Buffer,
    options?: StatsModifyOptions,
  ) {
    await this._mkdirToParent(path)

    if (content != null) {
      await promisify(this._fs.writeFile.bind(this._fs))(path, content, options)
    }

    // memfs.writeFile not support assign file mode
    if (options && options.mode != null) {
      await promisify(this._fs.chmod.bind(this._fs))(path, options.mode)
    }
  }

  private async _safeReadStat(path: string) {
    try {
      return await this.readStat(path)
    } catch (err) {
      if (err.code === 'ENOENT') return null
      throw err
    }
  }
}
