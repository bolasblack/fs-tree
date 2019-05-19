import { File as IFile } from './interfaces'

export interface ConstructOptions {
  stat: () => Promise<IFile.Stats>
  content: () => Promise<Buffer>
}

export class File implements IFile {
  constructor(
    public readonly path: IFile['path'],
    private _options: ConstructOptions,
  ) {}

  get content() {
    return this._options.content()
  }

  get stats() {
    return this._options.stat()
  }
}
