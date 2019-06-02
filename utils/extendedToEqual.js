const jestExpectPrint = require('expect/build/print')
const jestExpectUtils = require('expect/build/utils')
const jestMatcherUtils = require('jest-matcher-utils')

const EXPECTED_LABEL = 'Expected'
const RECEIVED_LABEL = 'Received'

const bufferEquality = (a, b) => {
  if (a instanceof Buffer && b instanceof Buffer) {
    return a.equals(b)
  }
}

expect.extend({
  toEqual(received, expected, customEqualityCheckers = []) {
    const matcherName = 'toEqual'
    const options = {
      comment: 'deep equality',
      isNot: this.isNot,
      promise: this.promise,
    }

    const pass = this.equals(received, expected, [
      bufferEquality,
      jestExpectUtils.iterableEquality,
      ...customEqualityCheckers,
    ])

    // from node_modules/expect/build/matchers.js
    const message = pass
      ? () =>
          jestMatcherUtils.matcherHint(
            matcherName,
            undefined,
            undefined,
            options,
          ) +
          '\n\n' +
          `Expected: not ${jestMatcherUtils.printExpected(expected)}\n` +
          (jestMatcherUtils.stringify(expected) !==
          jestMatcherUtils.stringify(received)
            ? `Received:     ${jestMatcherUtils.printReceived(received)}`
            : '')
      : () =>
          jestMatcherUtils.matcherHint(
            matcherName,
            undefined,
            undefined,
            options,
          ) +
          '\n\n' +
          jestExpectPrint.printDiffOrStringify(
            expected,
            received,
            EXPECTED_LABEL,
            RECEIVED_LABEL,
            this.expand,
          )

    return {
      actual: received,
      expected,
      message,
      name: matcherName,
      pass,
    }
  },
})
