import { Action } from './Action'

export type FileVisitor = (
  file: File,
) => boolean | void | Promise<boolean | void>

export interface StatsModifyOptions {
  mode?: number
}

export interface File {
  readonly path: string
  readonly content: Promise<Buffer>
  readonly stats: Promise<File.Stats>
}

export namespace File {
  export interface Stats {
    mode: number

    isFile(): boolean

    isDirectory(): boolean
  }
}

export interface Directory {
  readonly path: string

  dir(name: string): Promise<Directory>

  file(name: string): Promise<File | null>

  visit(visitor: FileVisitor): Promise<void>
}

// prettier-ignore
export enum MergeStrategy {
  // Uses the default strategy.
  Default                = 0b0000,
  // Error out if 2 files have the same path. It is useful to have a different value than
  // Default in this case as the tooling Default might differ.
  Error                  = 0b0001,
  AllowOverwriteConflict = 0b0010,
  AllowCreationConflict  = 0b0100,
  AllowDeleteConflict    = 0b1000,

  // Only content conflicts are overwritten.
  ContentOnly = AllowOverwriteConflict,

  // Overwrite everything with the latest change.
  Overwrite = AllowOverwriteConflict
            + AllowCreationConflict
            + AllowDeleteConflict,
}

export interface Tree {
  branch(): Promise<Tree>
  merge(other: Tree, strategy: MergeStrategy): Promise<void>
  exportActions(): Promise<Action[]>

  // Read
  get(path: string): Promise<File | null>
  getDir(path: string): Promise<Directory>

  // Change file
  overwrite(
    path: string,
    content: Buffer | string,
    stat?: StatsModifyOptions,
  ): void

  // Structural changes
  create(
    path: string,
    content: Buffer | string,
    stat?: StatsModifyOptions,
  ): void
  delete(path: string): void
  move(from: string, to: string): void
}

export interface Host {
  read(path: string): Buffer | Promise<Buffer>

  readDir(path: string): Host.readDir.Resp | Promise<Host.readDir.Resp>

  readStat(path: string): File.Stats | Promise<File.Stats>

  overwrite(
    path: string,
    content?: Buffer,
    options?: Host.overwrite.Options,
  ): void | Promise<void>

  create(
    path: string,
    content: Buffer,
    options?: Host.create.Options,
  ): void | Promise<void>

  move(from: string, to: string): void | Promise<void>

  delete(path: string): void | Promise<void>
}

export namespace Host {
  export namespace readDir {
    export interface Resp {
      files: string[]
      dirs: string[]
    }
  }

  export namespace overwrite {
    export type Options = StatsModifyOptions
  }

  export namespace create {
    export type Options = StatsModifyOptions
  }
}
