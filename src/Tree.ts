import {
  Host as IHost,
  Tree as ITree,
  File as IFile,
  Directory as IDirectory,
} from './interfaces'
import { File } from './File'
import { Directory } from './Directory'
import {
  PathIsDirectoryException,
  PathIsFileException,
  FileDoesNotExistException,
  FileAlreadyExistException,
} from './exceptions'

export class Tree implements ITree {
  constructor(private _host: IHost) {}

  async get(path: string): Promise<IFile | null> {
    if (await this._isDirectory(path)) {
      throw new PathIsDirectoryException(path)
    }

    if (!(await this._exists(path))) return null

    return this._getFile(path)
  }

  async getDir(path: string): Promise<IDirectory> {
    if (await this._isFile(path)) {
      throw new PathIsFileException(path)
    }

    return this._getDir(path)
  }

  async overwrite(path: string, content?: Buffer | string, stat?: IFile.Stats) {
    const originStat = await this._safeReadStat(path)

    if (!originStat) {
      throw new FileDoesNotExistException(path)
    }

    if (originStat.isDirectory()) {
      throw new PathIsDirectoryException(path)
    }

    stat = this._createStat(originStat, stat || {})

    await this._host.writeFile(
      path,
      content ? this._ensureBuffer(content) : undefined,
      stat,
    )
  }

  async create(path: string, content: Buffer | string, stat?: IFile.Stats) {
    if (await this._exists(path)) {
      throw new FileAlreadyExistException(path)
    }

    stat = this._createStat(stat || {})

    await this._host.writeFile(path, this._ensureBuffer(content), stat)
  }

  async delete(path: string) {
    const stat = await this._safeReadStat(path)

    if (!stat) return

    if (stat.isDirectory()) {
      throw new PathIsDirectoryException(path)
    }

    await this._host.deleteFile(path)
  }

  async move(from: string, to: string) {
    const [sourcePathStat, targetPathStat] = await Promise.all([
      this._safeReadStat(from),
      this._safeReadStat(to),
    ])

    if (!sourcePathStat) {
      throw new FileDoesNotExistException(from)
    }

    if (targetPathStat) {
      throw new FileAlreadyExistException(to)
    }

    await this._host.mkdirp(to)
    await this._host.moveFile(from, to)
  }

  private _createStat(...stats: Partial<IFile.Stats>[]) {
    return <IFile.Stats>Object.assign({}, ...stats)
  }

  private _ensureBuffer(content: Buffer | string) {
    if (typeof content === 'string') {
      return Buffer.from(content)
    }

    return content
  }

  private _getFile(path: string) {
    return new File(path, {
      content: () => Promise.resolve(this._host.readFile(path)),
      stat: () => Promise.resolve(this._host.readStat(path)),
    })
  }

  private _getDir(path: string): Directory {
    return new Directory(path, {
      tree: this,
      listChildren: this._listChildren(path),
    })
  }

  private _listChildren(path: string) {
    return async () => {
      const dirInfo = await this._host.readDir(path)

      return {
        dirs: dirInfo.dirs.map(this._getDir.bind(this)),
        files: dirInfo.files.map(this._getFile.bind(this)),
      }
    }
  }

  private async _isFile(path: string) {
    const stat = await this._safeReadStat(path)
    if (!stat) return false
    return stat.isFile()
  }

  private async _isDirectory(path: string) {
    const stat = await this._safeReadStat(path)
    if (!stat) return false
    return stat.isDirectory()
  }

  private async _exists(path: string) {
    return Boolean(await this._safeReadStat(path))
  }

  private async _safeReadStat(path: string) {
    try {
      return await this._host.readStat(path)
    } catch (err) {
      if (err.code === 'ENOENT') return null
      throw err
    }
  }
}
