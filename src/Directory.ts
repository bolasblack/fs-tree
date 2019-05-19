import {
  Tree as ITree,
  File as IFile,
  Directory as IDirectory,
  FileVisitor,
} from './interfaces'
import { resolve } from 'path'

export interface ConstructOptions {
  tree: ITree
  listChildren: () => Promise<{
    files: IFile[]
    dirs: IDirectory[]
  }>
}

export class Directory implements IDirectory {
  constructor(readonly path: string, private _options: ConstructOptions) {}

  dir(name: string) {
    return this._options.tree.getDir(resolve(this.path, name))
  }

  file(name: string) {
    return this._options.tree.get(resolve(this.path, name))
  }

  async visit(visitor: FileVisitor) {
    const entries = await this._options.listChildren()

    for (const file of entries.files) {
      await visitor(file)
    }

    for (const dir of entries.dirs) {
      await dir.visit(visitor)
    }
  }
}
