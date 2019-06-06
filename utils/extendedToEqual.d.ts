declare namespace jest {
  interface ExpectCustomEqualityChecker {
    checker(actual: any): boolean | undefined
  }

  interface Expect {
    customChecker(
      checker: ExpectCustomEqualityChecker['checker'],
    ): ExpectCustomEqualityChecker
  }
}
