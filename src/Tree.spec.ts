import fs from 'fs'
import path from 'path'
import { Volume } from 'memfs'
import { omit } from 'ramda'
import { MemoryFsHost } from './MemoryFsHost'
import { Tree } from './Tree'
import { File } from './File'
import { Directory } from './Directory'

describe('Tree', () => {
  describe('#get', () => {
    it('throw error if target is directory', async () => {
      const filePath = '/some/path/to/file'
      const tree = createTree({ [filePath]: 'content' })
      const getPromise = tree.get(path.resolve(filePath, '../'))
      await expect(getPromise).rejects.toMatchSnapshot()
    })

    it('return null instance if target not exists', async () => {
      const filePath = '/some/path/to/file'
      const tree = createTree()
      const file = await tree.get(filePath)
      expect(file).toBe(null)
    })

    it('return File instance if target exists', async () => {
      const filePath = '/some/path/to/file'
      const tree = createTree({ [filePath]: 'content' })
      const file = await tree.get(filePath)
      expect(file).toBeInstanceOf(File)
      expect(file!.path).toBe(filePath)
      expect((await file!.content).toString()).toBe('content')
    })

    it('support read file content', async () => {
      const filePath = '/some/path/to/file'
      const tree = createTree({ [filePath]: 'content' })
      const file = await tree.get(filePath)
      expect(file).toBeInstanceOf(File)
      expect((await file!.content).toString()).toBe('content')
    })

    it('support read file stat', async () => {
      const filePath = '/some/path/to/file'
      const tree = createTree({ [filePath]: 'content' })
      const file = await tree.get(filePath)
      expect(file).toBeInstanceOf(File)
      expect(await file!.stats).toMatchObject({
        mode: 0o100666,
        blksize: 4096,
        blocks: 1,
      })
    })
  })

  describe('#getDir', () => {
    it('throw error if target is file', async () => {
      const dirPath = '/some/path/to'
      const tree = createTree({ [dirPath + '/file']: 'content' })
      const getPromise = tree.getDir(dirPath + '/file')
      await expect(getPromise).rejects.toMatchSnapshot()
    })

    it('return Directory instance if target exists', async () => {
      const dirPath = '/some/path/to'
      const tree = createTree({ [dirPath + '/file']: 'content' })
      const dir = await tree.getDir(dirPath)
      expect(dir).toBeInstanceOf(Directory)
      expect(dir!.path).toBe(dirPath)
    })

    it('return Directory instance if target not exists', async () => {
      const dirPath = '/some/path/to'
      const tree = createTree()
      const dir = await tree.getDir(dirPath)
      expect(dir).toBeInstanceOf(Directory)
      expect(dir!.path).toBe(dirPath)
    })

    it('support read dir', async () => {
      const fsData = {
        '/some1': '/some1 content',
        '/some/file': '/some/file content',
        '/some/path/file': '/some/path/file content',
      }
      const tree = createTree(fsData)
      const dir = await tree.getDir('/some')
      const visitContent: { [path: string]: string } = {}
      await dir.visit(async entry => {
        visitContent[entry.path] = (await entry.content).toString()
      })
      expect(visitContent).toEqual(omit(['/some1'], fsData))
    })
  })

  describe('#overwrite', () => {
    it('throw error if target not exists', async () => {
      const tree = createTree({})
      await expect(
        tree.overwrite('/file/not/exists', 'new content'),
      ).rejects.toMatchSnapshot()
    })

    it('throw error if target is directory', async () => {
      const dirPath = '/some/path/to'
      const tree = createTree({ [dirPath + '/file']: 'content' })
      await expect(
        tree.overwrite(dirPath, 'new content'),
      ).rejects.toMatchSnapshot()
    })

    it('overwrite file content in OverlayHost', async () => {
      const filePath = '/some/path/to/file'
      const tree = createTree({ [filePath]: 'content' })
      const ofs = await getOverlayFs(tree)
      await tree.overwrite(filePath, 'content1')
      expect(ofs.readFileSync(filePath).toString()).toBe('content1')
      await tree.overwrite(filePath, Buffer.from('content2'))
      expect(ofs.readFileSync(filePath).toString()).toBe('content2')
    })

    it('overwrite file stat in OverlayHost', async () => {
      const filePath = '/some/path/to/file'
      const tree = createTree({ [filePath]: 'content' })
      const ofs = await getOverlayFs(tree)

      const fileModeBefore = ofs.statSync(filePath).mode
      expect(fileModeBefore & fs.constants.S_IRWXU).toBeTruthy()
      expect(fileModeBefore & fs.constants.S_IRGRP).toBeTruthy()
      expect(fileModeBefore & fs.constants.S_IROTH).toBeTruthy()

      await tree.overwrite(filePath, undefined, {
        mode: 0o733,
      })
      const fileModeAfter = ofs.statSync(filePath).mode
      expect(fileModeAfter & fs.constants.S_IFREG).toBeTruthy()
      expect(fileModeAfter & fs.constants.S_IRWXU).toBeTruthy()
      expect(fileModeAfter & fs.constants.S_IRGRP).toBeFalsy()
      expect(fileModeAfter & fs.constants.S_IROTH).toBeFalsy()
    })
  })

  describe('#create', () => {
    it('throw error if target already exists', async () => {
      const filePath = '/some/path/to/file'
      const tree = createTree({ [filePath]: 'content' })
      await expect(tree.create(filePath, 'content1')).rejects.toMatchSnapshot()
    })

    it('throw error if target is directory', async () => {
      const dirPath = '/some/path/to'
      const tree = createTree({ [dirPath + '/file']: 'content' })
      await expect(tree.create(dirPath, 'content')).rejects.toMatchSnapshot()
    })

    it('create file in OverlayHost', async () => {
      const filePath = '/some/path/to/file'
      const tree = createTree({ '/some/path/other/file': 'content1' })
      const ofs = await getOverlayFs(tree)
      await tree.create(filePath, 'content')
      expect(ofs.readFileSync(filePath).toString()).toBe('content')
      await tree.create(filePath + '1', Buffer.from('content'))
      expect(ofs.readFileSync(filePath + '1').toString()).toBe('content')
    })

    it('create file with stat in OverlayHost', async () => {
      const filePath = '/some/path/to/file'
      const tree = createTree({ '/some/path/other/file': 'content1' })
      const ofs = await getOverlayFs(tree)
      await tree.create(filePath, 'content', {
        mode: 0o733,
      })
      const fileMode = ofs.statSync(filePath).mode
      expect(fileMode & fs.constants.S_IFREG).toBeTruthy()
      expect(fileMode & fs.constants.S_IRWXU).toBeTruthy()
      expect(fileMode & fs.constants.S_IRGRP).toBeFalsy()
      expect(fileMode & fs.constants.S_IROTH).toBeFalsy()
    })
  })

  describe('#delete', () => {
    it('throw error if target is directory', async () => {
      const dirPath = '/some/path/to'
      const tree = createTree({ [dirPath + '/file']: 'content' })
      await expect(tree.delete(dirPath)).rejects.toMatchSnapshot()
    })

    it('throw error if target not exists', async () => {
      const tree = createTree({})
      await expect(tree.delete('/not/existed/path')).rejects.toMatchSnapshot()
    })

    it('delete file in OverlayHost', async () => {
      const filePath = '/some/path/to/file'
      const tree = createTree({ [filePath]: 'content' })
      const ofs = await getOverlayFs(tree)
      await tree.delete(filePath)
      expect(ofs.existsSync(filePath)).toBe(false)
    })
  })

  describe('#move', () => {
    it('throw error if source not exists', async () => {
      const tree = createTree({})
      await expect(
        tree.move('/not/existed/path', '/not/existed/path1'),
      ).rejects.toMatchSnapshot()
    })

    it('throw error if target is existed', async () => {
      const filePath = '/some/path/to/file'
      const tree = createTree({
        [`${filePath}1`]: 'content',
        [`${filePath}2`]: 'content',
      })
      await expect(
        tree.move(`${filePath}1`, `${filePath}2`),
      ).rejects.toMatchSnapshot()
    })

    it('move file from source to target in OverlayHost', async () => {
      const filePath = '/some/path/to/file'
      const tree = createTree({ [filePath]: 'content' })
      const ofs = await getOverlayFs(tree)
      await tree.move(filePath, `${filePath}1`)
      expect(ofs.existsSync(filePath)).toBe(false)
      expect(ofs.existsSync(filePath + '1')).toBe(true)
    })
  })
})

async function getOverlayFs(tree: Tree) {
  const host = await tree['_getHost']()
  return host['_fs']['fss'][0] as typeof fs
}

function createTree(fileStruct: { [path: string]: any } = {}) {
  return new Tree(() => new MemoryFsHost(Volume.fromJSON(fileStruct)))
}
