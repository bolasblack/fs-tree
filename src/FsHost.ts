import fs from 'fs'
import { FileSystemHostBase } from './FileSystemHostBase'

export class FsHost extends FileSystemHostBase {
  constructor() {
    super(fs)
  }
}
