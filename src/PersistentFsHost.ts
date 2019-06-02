import fs from 'fs'
import { FsHostBase } from './FsHostBase'

export class PersistentFsHost extends FsHostBase {
  constructor() {
    super(fs)
  }
}
