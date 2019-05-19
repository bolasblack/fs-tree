export type FileVisitor = (
  file: File,
) => boolean | void | Promise<boolean | void>

export interface File {
  readonly path: string
  readonly content: Promise<Buffer>
  readonly stats: Promise<File.Stats>
}

export namespace File {
  export interface Stats {
    mode: number
  }
}

export interface Directory {
  readonly path: string

  dir(name: string): Promise<Directory>

  file(name: string): Promise<File | null>

  visit(visitor: FileVisitor): Promise<void>
}

export interface Tree {
  // Read
  get(path: string): Promise<File | null>
  getDir(path: string): Promise<Directory>

  // Change file
  overwrite(path: string, content: Buffer | string, stat?: File.Stats): void

  // Structural changes
  create(path: string, content: Buffer | string, stat?: File.Stats): void
  delete(path: string): void
  move(from: string, to: string): void
}

export namespace Tree {
  export type Action =
    | OverwriteAction
    | CreateAction
    | DeleteAction
    | MoveAction

  export interface OverwriteAction {
    type: 'overwrite'
    path: string
    content?: Buffer
    stat?: File.Stats
  }

  export interface CreateAction {
    type: 'create'
    path: string
    content: Buffer
    stat?: File.Stats
  }

  export interface DeleteAction {
    type: 'delete'
    path: string
  }

  export interface MoveAction {
    type: 'move'
    from: string
    to: string
  }
}

export interface Host {
  readFile(path: string): Buffer | Promise<Buffer>

  readDir(path: string): Host.readDir.Resp | Promise<Host.readDir.Resp>

  readStat(path: string): Host.Stats | Promise<Host.Stats>

  writeFile(
    path: string,
    content?: Buffer,
    options?: Host.writeFile.Options,
  ): void | Promise<void>

  moveFile(from: string, to: string): void | Promise<void>

  deleteFile(path: string): void | Promise<void>

  mkdirp(path: string): void | Promise<void>
}

export namespace Host {
  export interface Stats extends File.Stats {
    isFile(): boolean

    isDirectory(): boolean
  }

  export namespace readDir {
    export interface Resp {
      files: string[]
      dirs: string[]
    }
  }

  export namespace writeFile {
    export interface Options {
      mode: number
    }
  }
}
