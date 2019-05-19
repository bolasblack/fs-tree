import { Volume } from 'memfs'
import { Union } from 'unionfs'
import { FileSystemHostBase } from './FileSystemHostBase'

export class MemoryHost extends FileSystemHostBase {
  constructor(vol = Volume.fromJSON({})) {
    super(new Union().use(vol))
  }
}
