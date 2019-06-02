import { StatsModifyOptions, File as IFile } from './interfaces'

// prettier-ignore
export type Action =
  | OverwriteAction
  | CreateAction
  | DeleteAction
  | MoveAction

export interface ActionBase {
  path: string
}

export interface OverwriteAction extends ActionBase {
  type: 'overwrite'
  content?: Buffer
  stat?: StatsModifyOptions
}

export const overwriteAction = (
  path: string,
  content?: Buffer,
  stat?: StatsModifyOptions,
): OverwriteAction => ({
  type: 'overwrite',
  path,
  content,
  stat,
})

export interface CreateAction extends ActionBase {
  type: 'create'
  content: Buffer
  stat?: StatsModifyOptions
}

export const createAction = (
  path: string,
  content: Buffer,
  stat?: StatsModifyOptions,
): CreateAction => ({
  type: 'create',
  path,
  content,
  stat,
})

export interface DeleteAction extends ActionBase {
  type: 'delete'
}

export const deleteAction = (path: string): DeleteAction => ({
  type: 'delete',
  path,
})

export interface MoveAction extends ActionBase {
  type: 'move'
  to: string
}

export const moveAction = (from: string, to: string): MoveAction => ({
  type: 'move',
  path: from,
  to,
})

export class ActionCollector {
  protected _filesToOverwrite = new Set<string>()
  protected _filesToCreate = new Set<string>()
  protected _filesToRename = new Map<string, string>()
  protected _filesToRenameRevert = new Map<string, string>()
  protected _filesToDelete = new Set<string>()

  constructor(private _options: ActionCollector.ConstructOptions) {}

  willCreate(path: string) {
    return this._filesToCreate.has(path)
  }
  willOverwrite(path: string) {
    return this._filesToOverwrite.has(path)
  }
  willDelete(path: string) {
    return this._filesToDelete.has(path)
  }
  willRename(path: string) {
    return this._filesToRename.has(path)
  }
  willRenameTo(path: string, to: string) {
    return this._filesToRename.get(path) === to
  }

  overwrite(path: string) {
    if (!this._filesToCreate.has(path)) {
      this._filesToOverwrite.add(path)
    }
  }

  create(path: string) {
    if (this._filesToDelete.has(path)) {
      this._filesToDelete.delete(path)
      this._filesToOverwrite.add(path)
    } else {
      this._filesToCreate.add(path)
    }
  }

  move(from: string, to: string) {
    // If we're renaming a file that's been created, shortcircuit to creating the `to` path.
    if (this._filesToCreate.has(from)) {
      this._filesToCreate.delete(from)
      this._filesToCreate.add(to)
    }
    if (this._filesToOverwrite.has(from)) {
      this._filesToOverwrite.delete(from)
      this._filesToOverwrite.add(to)
    }
    if (this._filesToDelete.has(to)) {
      this._filesToDelete.delete(to)
      this._filesToDelete.add(from)
      this._filesToOverwrite.add(to)
    }

    const maybeTo1 = this._filesToRenameRevert.get(from)
    if (maybeTo1) {
      // We already renamed to this file (A => from), let's rename the former to the new
      // path (A => to).
      this._filesToRename.delete(maybeTo1)
      this._filesToRenameRevert.delete(from)
      from = maybeTo1
    }

    this._filesToRename.set(from, to)
    this._filesToRenameRevert.set(to, from)
  }

  delete(path: string) {
    if (this._filesToCreate.has(path)) {
      this._filesToCreate.delete(path)
    } else if (this._filesToOverwrite.has(path)) {
      this._filesToOverwrite.delete(path)
      this._filesToDelete.add(path)
    } else if (this._filesToRenameRevert.has(path)) {
      const source = this._filesToRenameRevert.get(path)
      this._filesToRenameRevert.delete(path)
      this._filesToRename.delete(source!)
      this._filesToDelete.add(source!)
    } else {
      this._filesToDelete.add(path)
    }
  }

  clone(constructOptions: ActionCollector.ConstructOptions) {
    const collector = new ActionCollector(constructOptions)
    collector._filesToOverwrite = new Set(this._filesToOverwrite)
    collector._filesToCreate = new Set(this._filesToCreate)
    collector._filesToRename = new Map(this._filesToRename)
    collector._filesToRenameRevert = new Map(this._filesToRenameRevert)
    collector._filesToDelete = new Set(this._filesToDelete)
    return collector
  }

  async toActions(): Promise<Action[]> {
    const deleteActions: DeleteAction[] = [...this._filesToDelete.values()].map(
      deleteAction,
    )

    const moveActions: MoveAction[] = [...this._filesToRename.entries()].map(
      ([from, to]) => moveAction(from, to),
    )

    const createActions = Promise.all(
      [...this._filesToCreate.values()].map(async path => {
        const [content, stat] = await Promise.all([
          this._options.readContent(path),
          this._options.readStat(path),
        ])

        return createAction(path, content, { mode: stat.mode })
      }),
    )

    const overwriteActions = Promise.all(
      [...this._filesToOverwrite.values()].map(async path => {
        const [content, stat] = await Promise.all([
          this._options.readContent(path),
          this._options.readStat(path),
        ])

        return overwriteAction(path, content, { mode: stat.mode })
      }),
    )

    await Promise.all([createActions, overwriteActions])

    return [
      ...deleteActions,
      ...moveActions,
      ...(await createActions),
      ...(await overwriteActions),
    ]
  }
}

export namespace ActionCollector {
  export interface ConstructOptions {
    readContent(path: string): Buffer | Promise<Buffer>
    readStat(path: string): IFile.Stats | Promise<IFile.Stats>
  }
}
