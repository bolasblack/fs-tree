import { Volume } from 'memfs'
import { Union } from 'unionfs'
import fs from 'fs'
import { FsHostBase } from './FsHostBase'

export class MemoryFsHost extends FsHostBase {
  constructor(vol = Volume.fromJSON({})) {
    super(new Union().use(vol).use(fs))
  }
}
