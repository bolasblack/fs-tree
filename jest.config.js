module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  snapshotSerializers: ['./utils/errorSnapshotSerializer'],
  setupFilesAfterEnv: ['./utils/extendedToEqual'],
}
