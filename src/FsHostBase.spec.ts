import { Volume } from 'memfs'
import { FsHostBase } from './FsHostBase'

describe('FsHostBase', () => {
  describe('#read', () => {
    it('read file content', async () => {
      const [, host] = createHost({ '/a/b': 'content' })
      const resp = await host.read('/a/b')
      expect(resp).toEqual(Buffer.from('content'))
    })
  })

  describe('#readStat', () => {
    it('read stat', async () => {
      const [fs, host] = createHost({ '/a/b': 'content' })
      fs.chmodSync('/a/b', 0o400)
      const resp = await host.readStat('/a/b')
      expect(resp).toEqual(
        expect.customChecker(stat => (stat.mode & 0o777) === 0o400),
      )
    })
  })

  describe('#readDir', () => {
    it('read and organize folder structure', async () => {
      const [, host] = createHost({
        '/a/b': 'content',
        '/c': 'content',
        '/a/d/e': 'content',
      })

      await expect(host.readDir('/')).resolves.toEqual({
        files: ['/c'],
        dirs: ['/a'],
      })

      await expect(host.readDir('/a')).resolves.toEqual({
        files: ['/a/b'],
        dirs: ['/a/d'],
      })
    })
  })

  describe('#overwrite', () => {
    it('throw error if target not exists', async () => {
      const [, host] = createHost({})
      await expect(
        host.overwrite('/file/not/exists', Buffer.from('new content')),
      ).rejects.toMatchSnapshot()
    })

    it('throw error if target is directory', async () => {
      const dirPath = '/some/path/to'
      const [, host] = createHost({ [dirPath + '/file']: 'content' })
      await expect(
        host.overwrite(dirPath, Buffer.from('new content')),
      ).rejects.toMatchSnapshot()
    })

    it('overwrite file content', async () => {
      const filePath = '/some/path/to/file'
      const [fs, host] = createHost({ [filePath]: 'content' })
      await host.overwrite(filePath, Buffer.from('content1'))
      expect(fs.readFileSync(filePath).toString()).toBe('content1')
    })

    it('overwrite file stat', async () => {
      const filePath = '/some/path/to/file'
      const [fs, host] = createHost({ [filePath]: 'content' })

      const fileModeBefore = fs.statSync(filePath).mode
      expect(fileModeBefore & 0o777).toBe(0o666)

      await host.overwrite(filePath, undefined, {
        mode: 0o733,
      })
      const fileModeAfter = fs.statSync(filePath).mode
      expect(fileModeAfter & 0o777).toBe(0o733)
    })

    it('overwrite file with empty content', async () => {
      const filePath = '/some/path/to/file'
      const [fs, host] = createHost({ [filePath]: 'content' })
      await host.overwrite(filePath, Buffer.from(''))
      expect(fs.readFileSync(filePath).toString()).toBe('')
    })
  })

  describe('#create', () => {
    it('throw error if target already exists', async () => {
      const filePath = '/some/path/to/file'
      const [, host] = createHost({ [filePath]: 'content' })
      await expect(
        host.create(filePath, Buffer.from('content1')),
      ).rejects.toMatchSnapshot()
    })

    it('throw error if target is directory', async () => {
      const dirPath = '/some/path/to'
      const [, host] = createHost({ [dirPath + '/file']: 'content' })
      await expect(
        host.create(dirPath, Buffer.from('content')),
      ).rejects.toMatchSnapshot()
    })

    it('create file', async () => {
      const filePath = '/some/path/to/file'
      const [fs, host] = createHost({ '/some/path/other/file': 'content1' })
      await host.create(filePath, Buffer.from('content'))
      expect(fs.readFileSync(filePath).toString()).toBe('content')
    })

    it('create file with stat', async () => {
      const filePath = '/some/path/to/file'
      const [fs, host] = createHost({ '/some/path/other/file': 'content1' })
      await host.create(filePath, Buffer.from('content'), {
        mode: 0o733,
      })
      const fileMode = fs.statSync(filePath).mode
      expect(fileMode & 0o777).toBe(0o733)
    })

    it('create file with empty content', async () => {
      const filePath = '/some/path/to/file'
      const [fs, host] = createHost({ '/some/path/other/file': 'content1' })
      await host.create(filePath, Buffer.from(''))
      expect(fs.readFileSync(filePath).toString()).toBe('')
    })
  })

  describe('#delete', () => {
    it('throw error if target is directory', async () => {
      const dirPath = '/some/path/to'
      const [, host] = createHost({ [dirPath + '/file']: 'content' })
      await expect(host.delete(dirPath)).rejects.toMatchSnapshot()
    })

    it('throw error if target not exists', async () => {
      const [, host] = createHost({})
      await expect(host.delete('/not/existed/path')).rejects.toMatchSnapshot()
    })

    it('delete file', async () => {
      const filePath = '/some/path/to/file'
      const [fs, host] = createHost({ [filePath]: 'content' })
      await host.delete(filePath)
      expect(fs.existsSync(filePath)).toBe(false)
    })
  })

  describe('#move', () => {
    it('throw error if source not exists', async () => {
      const [, host] = createHost({})
      await expect(
        host.move('/not/existed/path', '/not/existed/path1'),
      ).rejects.toMatchSnapshot()
    })

    it('throw error if target is existed', async () => {
      const filePath = '/some/path/to/file'
      const [, host] = createHost({
        [`${filePath}1`]: 'content',
        [`${filePath}2`]: 'content',
      })
      await expect(
        host.move(`${filePath}1`, `${filePath}2`),
      ).rejects.toMatchSnapshot()
    })

    it('move file from source to target', async () => {
      const filePath = '/some/path/to/file'
      const [fs, host] = createHost({ [filePath]: 'content' })
      await host.move(filePath, `${filePath}1`)
      expect(fs.existsSync(filePath)).toBe(false)
      expect(fs.existsSync(filePath + '1')).toBe(true)
    })
  })
})

function createHost(fileStruct: { [path: string]: any } = {}) {
  const fs = Volume.fromJSON(fileStruct)
  const host = new FsHostBase(fs as any)
  return [fs, host] as [typeof fs, FsHostBase]
}
