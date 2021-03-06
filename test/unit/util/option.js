const Should = require('should');
const Option = require('../../../lib/util/option');

describe('(libs/FP) Option type', () => {
  it("Can be obtained from a value", () => {
    Option.of(33).should.be.instanceOf(Option);
  });

  it("Can be obtained from another Option and its value gets flatmapped", () => {
    Option.of(Option.of(33)).should.deepEqual(Option.of(33));
  });

  it("Can be obtained from null", () => {
    Option.of(null).should.be.instanceOf(Option);
  });

  it("A None can be obtained directly", () => {
    Option.none().should.be.instanceOf(Option);
  });

  context("Holding something", () => {
    const o = Option.of(33);

    it("Can be mapped over", () => {
      o.map(n => n + n).should.deepEqual(Option.of(66));
    });
    it("Can be filtered to something", () => {
      o.filter(x => x === 33).should.deepEqual(Option.of(33));
    });
    it("Can be filtered to nothing", () => {
      o.filter(_ => false).should.equal(Option.of(null));
    });
    describe("Getting its value", () => {
      it("get() returns its value", () => {
        o.get().should.equal(33);
      });
      it("orNull() returns its value", () => {
        o.orNull().should.equal(33);
      });
      it("orElse(defaultValue) returns its value", () => {
        o.orElse(44).should.equal(33);
      });
      it("orElseGet(provider) returns its value", () => {
        o.orElseGet(() => 44).should.equal(33);
      });
      it("orThrow(msg) returns its value and won't throw", () => {
        o.orThrow("you shouldn't see this error").should.equal(33);
      });
    });
    it("Calls a consumer ifDefined", (done) => {
      o.ifDefined((x) => {
        x.should.equal(33);
        done();
      });
    });
    it("It is not empty / It is defined", () => {
      o.isDefined().should.be.true();
      o.isEmpty().should.be.false();
    });
  });

  context("Holding nothing", () => {
    const o = Option.none();
    it("All None are referentially equal", () => {
      o.should.equal(Option.of(null));
    });
    it("Mapping over it has no effect", () => {
      o.map(n => n + n).should.deepEqual(o);
    });
    it("Can only be filtered to nothing", () => {
      o.filter(_ => true).should.equal(Option.of(null));
    });
    describe("Getting its value", () => {
      it("get() throws error", () => {
        (() => o.get()).should.throw(/Option value not present on get/);
      });
      it("orNull() returns null", () => {
        Should(o.orNull()).be.null();
      });
      it("orElse(defaultValue) returns the given default value", () => {
        o.orElse(44).should.equal(44);
      });
      it("orElseGet(provider) returns the value returned by the provider fn", () => {
        o.orElseGet(() => 44).should.equal(44);
      });
      it("orThrow(msg) throws", () => {
        (() => o.orThrow("you shouldn't see this error")).should.throw("you shouldn't see this error");
      });
    });
    it("Does nothing ifDefined", () => {
      let called = false;
      o.ifDefined((x) => { called = true; });
      called.should.equal(false);
    });
    it("It is not empty / It is defined", () => {
      o.isDefined().should.be.false();
      o.isEmpty().should.be.true();
    });
  })
});
