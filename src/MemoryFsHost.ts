import { Volume } from 'memfs'
import { Union } from 'unionfs'
import fs from 'fs'
import { FsHostBase } from './FsHostBase'

/**
 * TODO: 用 unionfs 合并 memfs 和 builtinfs 以后存在一个问题，如果要删除的文件在
 *       builtinfs 里，那么要删除文件时修改的不会是 memfs ，而是 builtinfs ，这
 *       是不应该的，所以需要在 MemoryFsHost 里做一些这方面的工作
 */
export class MemoryFsHost extends FsHostBase {
  constructor(vol = Volume.fromJSON({})) {
    super(new Union().use(vol).use(fs))
  }
}
