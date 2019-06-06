import {
  Host as IHost,
  Tree as ITree,
  File as IFile,
  Directory as IDirectory,
  StatsModifyOptions,
} from './interfaces'
import { File } from './File'
import { Directory } from './Directory'
import {
  PathIsDirectoryException,
  PathIsFileException,
  FileDoesNotExistException,
  MergeConflictException,
} from './exceptions'
import {
  ActionCollector,
  CreateAction,
  OverwriteAction,
  MoveAction,
  DeleteAction,
} from './Action'
import { statsEquals } from './utils/statsEquals'
import { createSafeReadStat } from './utils/safeReadStat'

enum MergeStrategy {
  AllowOverwriteConflict = 1 << 1,
  AllowCreationConflict = 1 << 2,
  AllowDeleteConflict = 1 << 3,

  // Uses the default strategy.
  Default = 0,

  // Error out if 2 files have the same path. It is useful to have a different value than
  // Default in this case as the tooling Default might differ.
  Error = 1 << 0,

  // Only content conflicts are overwritten.
  ContentOnly = AllowOverwriteConflict,

  // Overwrite everything with the latest change.
  Overwrite = AllowOverwriteConflict +
    AllowCreationConflict +
    AllowDeleteConflict,
}

export class Tree implements ITree {
  static MergeStrategy = MergeStrategy

  private _actionCollector: ActionCollector

  private _getHost: () => Promise<IHost>

  private _hostRead = async (path: string) => {
    return (await this._getHost()).read(path)
  }

  private _hostReadStat = async (path: string) => {
    return (await this._getHost()).readStat(path)
  }

  private _safeReadStat = createSafeReadStat(this._hostReadStat)

  constructor(private _createHost: () => IHost | Promise<IHost>) {
    let hostP: Promise<IHost> | null = null

    this._getHost = () => {
      if (hostP) return hostP
      return (hostP = Promise.resolve(_createHost()))
    }

    this._actionCollector = new ActionCollector({
      readContent: this._hostRead,
      readStat: this._hostReadStat,
    })
  }

  async branch() {
    const newTree = new Tree(this._createHost)
    newTree._actionCollector = this._actionCollector.clone({
      readContent: newTree._hostRead,
      readStat: newTree._hostReadStat,
    })
    return newTree
  }

  async merge(other: ITree, strategy: MergeStrategy = MergeStrategy.Default) {
    if (other === this) return

    const actions = await other.exportActions()

    for (let action of actions) {
      switch (action.type) {
        case 'overwrite':
          await this._mergeOverwriteAction(action, strategy)
          break
        case 'create':
          await this._mergeCreateAction(action, strategy)
          break
        case 'move':
          await this._mergeMoveAction(action)
          break
        case 'delete':
          await this._mergeDeleteAction(action, strategy)
          break
      }
    }
  }

  exportActions() {
    return this._actionCollector.toActions()
  }

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

  async overwrite(
    path: string,
    content?: Buffer | string,
    stat?: StatsModifyOptions,
  ) {
    const originStat = await this._safeReadStat(path)

    if (!originStat) {
      throw new FileDoesNotExistException(path)
    }

    stat = this._createStat(originStat, stat || {})

    const host = await this._getHost()

    await host.overwrite(
      path,
      content != null ? this._ensureBuffer(content) : undefined,
      stat,
    )

    this._actionCollector.overwrite(path)
  }

  async create(
    path: string,
    content: Buffer | string,
    stat?: StatsModifyOptions,
  ) {
    const host = await this._getHost()

    await host.create(
      path,
      this._ensureBuffer(content),
      this._createStat(stat || {}),
    )

    this._actionCollector.create(path)
  }

  async delete(path: string) {
    await (await this._getHost()).delete(path)

    this._actionCollector.delete(path)
  }

  async move(from: string, to: string) {
    await (await this._getHost()).move(from, to)

    this._actionCollector.move(from, to)
  }

  private _createStat(
    ...stats: Partial<StatsModifyOptions>[]
  ): StatsModifyOptions {
    return Object.assign({}, ...stats)
  }

  private _ensureBuffer(content: Buffer | string) {
    if (typeof content === 'string') {
      return Buffer.from(content)
    }

    return content
  }

  private _getFile(path: string) {
    return new File(path, {
      content: () => this._hostRead(path),
      stat: () => this._hostReadStat(path),
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
      const _host = await this._getHost()
      const dirInfo = await _host.readDir(path)

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

  private async _mergeDeleteAction(
    action: DeleteAction,
    strategy: MergeStrategy,
  ) {
    const deleteConflictAllowed =
      (strategy & MergeStrategy.AllowOverwriteConflict) ==
      MergeStrategy.AllowDeleteConflict

    const { path } = action

    if (this._willDelete(path)) {
      // TODO: (schematic) This should technically check the content (e.g., hash on delete)
      //   But I have no idea how to implement it, so let's wait for schematic :P
      // Identical outcome; no action required
      return
    }

    if (!(await this._exists(path)) && !deleteConflictAllowed) {
      throw new MergeConflictException(path)
    }

    await this.delete(path)
  }

  private async _mergeMoveAction(action: MoveAction) {
    const { path, to } = action

    if (this._willDelete(path)) {
      throw new MergeConflictException(path)
    }

    if (this._willMove(path)) {
      if (this._willMoveTo(path, to)) {
        // Identical outcome; no action required
        return
      }

      // No override possible for renaming.
      throw new MergeConflictException(path)
    }

    await this.move(path, to)
  }

  private async _mergeOverwriteAction(
    action: OverwriteAction,
    strategy: MergeStrategy,
  ) {
    const overwriteConflictAllowed =
      (strategy & MergeStrategy.AllowOverwriteConflict) ==
      MergeStrategy.AllowOverwriteConflict

    const { path, content, stat } = action

    if (this._willDelete(path) && !overwriteConflictAllowed) {
      throw new MergeConflictException(path)
    }

    if (this._willOverwrite(path)) {
      const [existingContent, existingStat] = await Promise.all([
        this._hostRead(path),
        this._hostReadStat(path),
      ])

      // Ignore if content is the same (considered the same change).
      if (
        // prettier-ignore
        (!content || (existingContent && content.equals(existingContent))) &&
        (!stat || (existingStat && statsEquals(existingStat, stat)))
      ) {
        // Identical outcome; no action required
        return
      }

      if (!overwriteConflictAllowed) {
        throw new MergeConflictException(path)
      }
    }

    // We use write here as merge validation has already been done, and we want to let
    // the CordHost do its job.
    await this.overwrite(path, content, stat)
  }

  private async _mergeCreateAction(
    action: CreateAction,
    strategy: MergeStrategy,
  ) {
    const creationConflictAllowed =
      (strategy & MergeStrategy.AllowCreationConflict) ==
      MergeStrategy.AllowCreationConflict

    const { path, content, stat } = action

    if (this._willCreate(path) || this._willOverwrite(path)) {
      const [existingContent, existingStat] = await Promise.all([
        this._hostRead(path),
        this._hostReadStat(path),
      ])

      if (
        // prettier-ignore
        (existingContent && content.equals(existingContent)) &&
        (!stat || (existingStat && statsEquals(existingStat, stat)))
      ) {
        // Identical outcome; no action required
        return
      }

      if (!creationConflictAllowed) {
        throw new MergeConflictException(path)
      }

      await this.overwrite(path, content, stat)
    } else {
      await this.create(path, content, stat)
    }
  }

  protected _willCreate(path: string) {
    return this._actionCollector.willCreate(path)
  }

  protected _willOverwrite(path: string) {
    return this._actionCollector.willOverwrite(path)
  }

  protected _willDelete(path: string) {
    return this._actionCollector.willDelete(path)
  }

  protected _willMove(path: string) {
    return this._actionCollector.willMove(path)
  }

  protected _willMoveTo(path: string, to: string) {
    return this._actionCollector.willMoveTo(path, to)
  }
}
