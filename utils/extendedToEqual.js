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

class ExpectCustomEqualityChecker {
  constructor(checker) {
    this.checker = checker
  }
}
expect.customChecker = fn => {
  if (typeof fn !== 'function') {
    throw new TypeError('[expect.customChecker] argument must be a function')
  }

  return new ExpectCustomEqualityChecker(fn)
}
const customCheckerEquality = (a, b) => {
  if (a instanceof ExpectCustomEqualityChecker) {
    return a.checker(b)
  }

  if (b instanceof ExpectCustomEqualityChecker) {
    return b.checker(a)
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
      customCheckerEquality,
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
