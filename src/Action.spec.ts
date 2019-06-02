import { ActionCollector, overwriteAction, createAction } from './Action'
import { File as IFile } from './interfaces'

describe('ActionCollector', () => {
  let isFile = () => true
  let isDirectory = () => false

  let readContentResp = Buffer.from('fake content')
  let readContent = jest.fn((path: string) => readContentResp)

  let readStatResp: IFile.Stats = {
    mode: 0o755,
    isFile,
    isDirectory,
  }
  let readStat = jest.fn((path: string) => readStatResp)

  let collector = new ActionCollector({
    readContent,
    readStat,
  })

  beforeEach(() => {
    readContent = jest.fn((path: string) => Buffer.from('fake content'))

    readStat = jest.fn((path: string) => ({
      mode: 0o755,
      isFile,
      isDirectory,
    }))

    collector = new ActionCollector({
      readContent,
      readStat,
    })
  })

  describe('.overwrite', () => {
    it('log overwrite action', async () => {
      collector.overwrite('/fake/path')

      await expect(collector.toActions()).resolves.toEqual([
        overwriteAction('/fake/path', readContentResp, {
          mode: readStatResp.mode,
        }),
      ])
    })

    it('do nothing if create log existent', async () => {
      collector.create('/fake/path')
      collector.overwrite('/fake/path')

      await expect(collector.toActions()).resolves.toEqual([
        createAction('/fake/path', readContentResp, {
          mode: readStatResp.mode,
        }),
      ])
    })
  })
})
