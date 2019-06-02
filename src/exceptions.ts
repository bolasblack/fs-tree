export class FileDoesNotExistException extends Error {
  constructor(public path: string) {
    super(`Path "${path}" does not exist.`)
  }
}

export class FileAlreadyExistException extends Error {
  constructor(public path: string) {
    super(`Path "${path}" already exist.`)
  }
}

export class PathIsDirectoryException extends Error {
  constructor(public path: string) {
    super(`Path "${path}" is a directory.`)
  }
}

export class PathIsFileException extends Error {
  constructor(public path: string) {
    super(`Path "${path}" is a file.`)
  }
}

export class MergeConflictException extends Error {
  constructor(path: string) {
    super(`A merge conflicted on path "${path}".`)
  }
}
