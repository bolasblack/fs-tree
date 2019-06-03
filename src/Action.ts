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
  protected _filesToMove = new Map<string, string>()
  protected _filesToMoveRevert = new Map<string, string>()
  protected _filesToDelete = new Set<string>()

  constructor(private _options: ActionCollector.ConstructOptions) {}

  clone(constructOptions: ActionCollector.ConstructOptions) {
    const collector = new ActionCollector(constructOptions)
    collector._filesToOverwrite = new Set(this._filesToOverwrite)
    collector._filesToCreate = new Set(this._filesToCreate)
    collector._filesToMove = new Map(this._filesToMove)
    collector._filesToMoveRevert = new Map(this._filesToMoveRevert)
    collector._filesToDelete = new Set(this._filesToDelete)
    return collector
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
    if (from === to) return

    // If we're renaming a file that's been created, shortcircuit to creating the `to` path.
    if (this._filesToCreate.has(from)) {
      this._filesToCreate.delete(from)
      this._filesToCreate.add(to)
      return
    }

    if (this._filesToOverwrite.has(from)) {
      this._filesToOverwrite.delete(from)

      // Recursively call this function. This is so we don't repeat the bottom logic. This
      // if will be by-passed because we just deleted the `from` path from files to overwrite.
      this.move(from, to)

      this._filesToOverwrite.add(to)
      return
    }

    if (this._filesToDelete.has(to)) {
      this._filesToDelete.delete(to)
      this._filesToDelete.add(from)
      this._filesToOverwrite.add(to)
      return
    }

    const previousMoveFrom = this._filesToMoveRevert.get(from)
    if (previousMoveFrom) {
      // We already renamed to this file (A => from), let's rename the former to the new
      // path (A => to).
      this._filesToMove.delete(previousMoveFrom)
      this._filesToMoveRevert.delete(from)
      from = previousMoveFrom

      // We already renamed to this file (A<from1> => B<to1>), and now we are trying move
      // back (B<from2> => A<to2>), let's simplize it: (A<from1> => A<to2>), so we need to
      // do nothing
      if (from === to) return
    }

    this._filesToMove.set(from, to)
    this._filesToMoveRevert.set(to, from)
  }

  delete(path: string) {
    if (this._filesToCreate.has(path)) {
      this._filesToCreate.delete(path)
    } else if (this._filesToOverwrite.has(path)) {
      this._filesToOverwrite.delete(path)
      this._filesToDelete.add(path)
    } else if (this._filesToMoveRevert.has(path)) {
      const source = this._filesToMoveRevert.get(path)
      this._filesToMoveRevert.delete(path)
      this._filesToMove.delete(source!)
      this._filesToDelete.add(source!)
    } else {
      this._filesToDelete.add(path)
    }
  }

  async toActions(): Promise<Action[]> {
    const deleteActions: DeleteAction[] = [...this._filesToDelete.values()].map(
      deleteAction,
    )

    const moveActions: MoveAction[] = [...this._filesToMove.entries()].map(
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

  willCreate(path: string) {
    return this._filesToCreate.has(path)
  }
  willOverwrite(path: string) {
    return this._filesToOverwrite.has(path)
  }
  willDelete(path: string) {
    return this._filesToDelete.has(path)
  }
  willMove(path: string) {
    return this._filesToMove.has(path)
  }
  willMoveTo(path: string, to: string) {
    return this._filesToMove.get(path) === to
  }
}

export namespace ActionCollector {
  export interface ConstructOptions {
    readContent(path: string): Buffer | Promise<Buffer>
    readStat(path: string): IFile.Stats | Promise<IFile.Stats>
  }
}
