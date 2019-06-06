import {
  ActionCollector,
  overwriteAction,
  createAction,
  deleteAction,
  moveAction,
} from './Action'
import { File as IFile } from './interfaces'

describe('ActionCollector', () => {
  const fakePath = '/fake/path'
  const fakePath1 = '/fake/path1'

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

  describe('#clone', () => {
    it('clone ActionCollector', async () => {
      collector.overwrite(fakePath + 'a')
      collector.create(fakePath + 'b')
      collector.move(fakePath, fakePath1)
      collector.delete(fakePath + 'c')

      const newCollector = collector.clone({
        readContent,
        readStat,
      })

      expect(newCollector).not.toBe(collector)
      expect(await newCollector.toActions()).toEqual(
        await collector.toActions(),
      )

      newCollector.delete(fakePath + 'd')
      expect(await newCollector.toActions()).not.toEqual(
        await collector.toActions(),
      )
    })
  })

  describe('#overwrite', () => {
    it('record overwrite log', async () => {
      collector.overwrite(fakePath)
      expect(collector.willOverwrite(fakePath)).toBe(true)
      await expect(collector.toActions()).resolves.toEqual([
        overwriteAction(fakePath, readContentResp, { mode: readStatResp.mode }),
      ])
    })

    it('do nothing if create log existent', async () => {
      collector.create(fakePath)
      collector.overwrite(fakePath)
      expect(collector.willCreate(fakePath)).toBe(true)
      expect(collector.willOverwrite(fakePath)).toBe(false)
      await expect(collector.toActions()).resolves.toEqual([
        createAction(fakePath, readContentResp, { mode: readStatResp.mode }),
      ])
    })
  })

  describe('#create', () => {
    it('record create log', async () => {
      collector.create(fakePath)
      expect(collector.willCreate(fakePath)).toBe(true)
      await expect(collector.toActions()).resolves.toEqual([
        createAction(fakePath, readContentResp, { mode: readStatResp.mode }),
      ])
    })

    it('optmize delete log', async () => {
      const filePath = '/fake/path'
      collector.delete(filePath)
      collector.create(filePath)
      expect(collector.willCreate(filePath)).toBe(false)
      expect(collector.willOverwrite(filePath)).toBe(true)
      await expect(collector.toActions()).resolves.toEqual([
        overwriteAction(fakePath, readContentResp, { mode: readStatResp.mode }),
      ])
    })
  })

  describe('#move', () => {
    it('record move log', async () => {
      collector.move(fakePath, fakePath1)
      expect(collector.willMove(fakePath)).toBe(true)
      expect(collector.willMoveTo(fakePath, fakePath1)).toBe(true)
      await expect(collector.toActions()).resolves.toEqual([
        moveAction(fakePath, fakePath1),
      ])
    })

    it('do nothing if source and destination is same', async () => {
      collector.move(fakePath, fakePath)
      expect(collector.willMove(fakePath)).toBe(false)
      expect(collector.willMoveTo(fakePath, fakePath)).toBe(false)
      await expect(collector.toActions()).resolves.toEqual([])
    })

    it('optmize create log', async () => {
      collector.create(fakePath)
      collector.move(fakePath, fakePath1)
      expect(collector.willCreate(fakePath)).toBe(false)
      expect(collector.willCreate(fakePath1)).toBe(true)
      expect(collector.willMove(fakePath)).toBe(false)
      expect(collector.willMoveTo(fakePath, fakePath1)).toBe(false)
      await expect(collector.toActions()).resolves.toEqual([
        createAction(fakePath1, readContentResp, { mode: readStatResp.mode }),
      ])
    })

    it('optmize overwrite log', async () => {
      collector.overwrite(fakePath)
      collector.move(fakePath, fakePath1)
      expect(collector.willOverwrite(fakePath)).toBe(false)
      expect(collector.willMove(fakePath)).toBe(true)
      expect(collector.willMoveTo(fakePath, fakePath1)).toBe(true)
      await expect(collector.toActions()).resolves.toEqual([
        moveAction(fakePath, fakePath1),
        overwriteAction(fakePath1, readContentResp, {
          mode: readStatResp.mode,
        }),
      ])
    })

    it('optmize delete log', async () => {
      collector.delete(fakePath1)
      collector.move(fakePath, fakePath1)
      expect(collector.willDelete(fakePath)).toBe(true)
      expect(collector.willDelete(fakePath1)).toBe(false)
      expect(collector.willOverwrite(fakePath1)).toBe(true)
      await expect(collector.toActions()).resolves.toEqual([
        deleteAction(fakePath),
        overwriteAction(fakePath1, readContentResp, {
          mode: readStatResp.mode,
        }),
      ])
    })

    describe('optmize previous move log', () => {
      it('update previous move destination', async () => {
        collector.move(fakePath, fakePath1)
        collector.move(fakePath1, fakePath + '2')
        expect(collector.willMove(fakePath)).toBe(true)
        expect(collector.willMoveTo(fakePath, fakePath1)).toBe(false)
        expect(collector.willMove(fakePath1)).toBe(false)
        expect(collector.willMoveTo(fakePath1, fakePath + '2')).toBe(false)
        expect(collector.willMoveTo(fakePath, fakePath + '2')).toBe(true)
        await expect(collector.toActions()).resolves.toEqual([
          moveAction(fakePath, fakePath + '2'),
        ])
      })

      it('omit move log', async () => {
        collector.move(fakePath, fakePath1)
        collector.overwrite(fakePath1)
        collector.move(fakePath1, fakePath)
        expect(collector.willMove(fakePath)).toBe(false)
        expect(collector.willMoveTo(fakePath, fakePath1)).toBe(false)
        expect(collector.willMove(fakePath1)).toBe(false)
        expect(collector.willMoveTo(fakePath1, fakePath)).toBe(false)
        expect(collector.willOverwrite(fakePath)).toBe(true)
        expect(collector.willOverwrite(fakePath1)).toBe(false)
        await expect(collector.toActions()).resolves.toEqual([
          overwriteAction(fakePath, readContentResp, {
            mode: readStatResp.mode,
          }),
        ])
      })
    })
  })

  describe('#delete', () => {
    it('record delete log', async () => {
      collector.delete(fakePath)
      expect(collector.willDelete(fakePath)).toBe(true)
      await expect(collector.toActions()).resolves.toEqual([
        deleteAction(fakePath),
      ])
    })

    it('clean create log', async () => {
      collector.create(fakePath)
      collector.delete(fakePath)
      expect(collector.willCreate(fakePath)).toBe(false)
      expect(collector.willDelete(fakePath)).toBe(false)
      await expect(collector.toActions()).resolves.toEqual([])
    })

    it('omit overwrite log', async () => {
      collector.overwrite(fakePath)
      collector.delete(fakePath)
      expect(collector.willOverwrite(fakePath)).toBe(false)
      expect(collector.willDelete(fakePath)).toBe(true)
      await expect(collector.toActions()).resolves.toEqual([
        deleteAction(fakePath),
      ])
    })

    it('optmize move log', async () => {
      collector.move(fakePath, fakePath1)
      collector.delete(fakePath1)
      expect(collector.willMove(fakePath)).toBe(false)
      expect(collector.willMoveTo(fakePath, fakePath1)).toBe(false)
      expect(collector.willDelete(fakePath)).toBe(true)
      expect(collector.willDelete(fakePath1)).toBe(false)
      await expect(collector.toActions()).resolves.toEqual([
        deleteAction(fakePath),
      ])
    })
  })

  describe('#toActions', () => {
    it('already tested', () => {})
  })

  describe('#toCreate', () => {
    it('already tested', () => {})
  })

  describe('#toOverwrite', () => {
    it('already tested', () => {})
  })

  describe('#toDelete', () => {
    it('already tested', () => {})
  })

  describe('#toMove', () => {
    it('already tested', () => {})
  })

  describe('#toMoveTo', () => {
    it('already tested', () => {})
  })
})
