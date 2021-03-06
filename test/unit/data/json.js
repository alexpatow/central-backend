const appRoot = require('app-root-path');
const { getFormSchema, schemaAsLookup, stripNamespacesFromSchema } = require(appRoot + '/lib/data/schema');
const { submissionToOData } = require(appRoot + '/lib/data/json');
const testData = require(appRoot + '/test/integration/data');

const __system = {
  submissionDate: '2017-09-20T17:10:43Z',
  submitterId: '5',
  submitterName: 'Alice'
};
const mockSubmission = (instanceId, xml) => ({
  instanceId,
  xml,
  createdAt: '2017-09-20T17:10:43Z',
  submitter: {
    id: 5,
    displayName: 'Alice'
  }
});

describe('submissionToOData', () => {
  it('should parse and transform a basic submission', () => {
    return getFormSchema({ xml: testData.forms.simple }).then((schema) => {
      const fields = schemaAsLookup(schema);
      const submission = mockSubmission('one', testData.instances.simple.one);
      return submissionToOData(fields, 'Submissions', submission).then((result) => {
        result.should.eql([{
          __id: 'one',
          __system,
          meta: { instanceID: 'one' },
          name: 'Alice',
          age: 30
        }]);
      });
    });
  });

  // this is sort of repeatedly tested in all the other tests, but it's good to
  // have one for explicity this purpose in case things change.
  it('should include submission metadata on the root output', () => {
    const submission = mockSubmission('test', testData.instances.simple.one);
    return submissionToOData({}, 'Submissions', submission).then((result) => {
      result.should.eql([{ __id: 'test', __system }]);
    });
  });

  it('should handle all primitive output types correctly', () => {
    const fields = {
      int: { name: 'int', type: 'int' },
      decimal: { name: 'decimal', type: 'decimal' },
      geopoint: { name: 'geopoint', type: 'geopoint' },
      geopointNoAlt: { name: 'geopointNoAlt', type: 'geopoint' },
      text: { name: 'text', type: 'text' },
      other: { name: 'other', type: 'other' }
    };
    const submission = mockSubmission('types', `<data>
        <int>42</int>
        <decimal>3.14</decimal>
        <geopoint>4.8 15.16 23.42</geopoint>
        <geopointNoAlt>11.38 -11.38</geopointNoAlt>
        <text>hello</text>
        <other>what could it be?</other>
      </data>`);
    return submissionToOData(fields, 'Submissions', submission).then((result) => {
      result.should.eql([{
        __id: 'types',
        __system,
        int: 42,
        decimal: 3.14,
        geopoint: { type: 'Point', coordinates: [ 15.16, 4.8, 23.42 ] },
        geopointNoAlt: { type: 'Point', coordinates: [ -11.38, 11.38 ] },
        text: 'hello',
        other: 'what could it be?'
      }]);
    });
  });

  it('should decode xml entities for output', () => {
    const fields = { text: { name: 'text', type: 'text' } };
    const submission = mockSubmission('entities', `<data>
        <text>&#171;hello&#187;</text>
      </data>`);
    return submissionToOData(fields, 'Submissions', submission).then((result) => {
      result.should.eql([{
        __id: 'entities',
        __system,
        text: '\xABhello\xBB'
      }]);
    });
  });

  it('should not attempt to provide broken geospatial values', () => {
    const fields = {
      geopointNoLon: { name: 'geopointNoLon', type: 'geopoint' },
      geopointNonsense: { name: 'geopointNonsense', type: 'geopoint' }
    };
    const submission = mockSubmission('geo', `<data>
        <geopointNoLon>100</geopointNoLon>
        <geopointNonsense>this is nonsensical</geopointNonsense>
      </data>`);
    return submissionToOData(fields, 'Submissions', submission).then((result) => {
      result.should.eql([{
        __id: 'geo',
        __system
      }]);
    });
  });

  it('should format geospatial values as WKT if requested', () => {
    const fields = {
      geopoint: { name: 'geopoint', type: 'geopoint' },
      geopointNoAlt: { name: 'geopointNoAlt', type: 'geopoint' }
    };
    const submission = mockSubmission('wkt', `<data>
        <geopoint>4.8 15.16 23.42</geopoint>
        <geopointNoAlt>11.38 -11.38</geopointNoAlt>
      </data>`);
    return submissionToOData(fields, 'Submissions', submission, { wkt: true }).then((result) => {
      result.should.eql([{
        __id: 'wkt',
        __system,
        geopoint: 'POINT (15.16 4.8 23.42)',
        geopointNoAlt: 'POINT (-11.38 11.38)'
      }]);
    });
  });

  // we omit meta here to exercise the fact that it is a structure containing a field,
  // all of which should be skipped successfully over.
  it('should ignore xml structures not in the schema', () => {
    const fields = { name: { name: 'name', type: 'string' }, age: { name: 'age', type: 'int' } };
    const submission = mockSubmission('one', testData.instances.simple.one);
    return submissionToOData(fields, 'Submissions', submission).then((result) => {
      result.should.eql([{
        __id: 'one',
        __system,
        name: 'Alice',
        age: 30
      }]);
    });
  });

  it('should apply nested values to the appropriate structure', () => {
    const fields = {
      group: { name: 'group', type: 'structure', children: {
        one: { name: 'one', type: 'string' },
        two: { name: 'two', type: 'string' },
        three: { name: 'three', type: 'string' }
      } }
    };
    const submission = mockSubmission('nesting', `<data>
        <group>
          <one>uno</one>
          <two>dos</two>
        </group>
        <group>
          <three>tres</three>
        </group>
      </data>`);
    return submissionToOData(fields, 'Submissions', submission).then((result) => {
      result.should.eql([{
        __id: 'nesting',
        __system,
        group: { one: 'uno', two: 'dos', three: 'tres' }
      }]);
    });
  });

  /* TODO: commented out pending issue #82.
  it('should provide navigation links for repeats', () => {
    return getFormSchema({ xml: testData.forms.withrepeat }).then((schema) => {
      const fields = schemaAsLookup(schema);
      const submission = { instanceId: 'two', xml: testData.instances.withrepeat.two };
      return submissionToOData(fields, 'Submissions', submission).then((result) => {
        result.should.eql([{
          __id: 'two',
          __system,
          meta: { instanceID: 'two' },
          name: 'Bob',
          age: 34,
          children: {
            'child@odata.navigationLink': "Submissions('two')/children/child"
          }
        }]);
      });
    });
  });*/

  // TODO: remove this test once #82 is resolved.
  it('should ignore repeats in data output', () => {
    return getFormSchema({ xml: testData.forms.withrepeat }).then((schema) => {
      const fields = schemaAsLookup(stripNamespacesFromSchema(schema));
      const submission = mockSubmission('two', testData.instances.withrepeat.two);
      return submissionToOData(fields, 'Submissions', submission).then((result) => {
        result.should.eql([{
          __id: 'two',
          __system,
          meta: { instanceID: 'two' },
          name: 'Bob',
          age: 34,
          children: {}
        }]);
      });
    });
  });

  it('should extract subtable rows within repeats', () => {
    return getFormSchema({ xml: testData.forms.withrepeat }).then((schema) => {
      const fields = schemaAsLookup(schema);
      const submission = { instanceId: 'two', xml: testData.instances.withrepeat.two };
      return submissionToOData(fields, 'Submissions.children.child', submission).then((result) => {
        result.should.eql([{
          '__Submissions-id': 'two',
          __id: 'cf9a1b5cc83c6d6270c1eb98860d294eac5d526d',
          age: 4,
          name: 'Billy'
        }, {
          '__Submissions-id': 'two',
          __id: 'c76d0ccc6d5da236be7b93b985a80413d2e3e172',
          age: 6,
          name: 'Blaine'
        }]);
      });
    });
  });

  /* TODO: commented out pending issue #82.
  it('should return navigation links to repeats within a subtable result set', () => {
    return getFormSchema({ xml: testData.forms.doubleRepeat }).then((schema) => {
      const fields = schemaAsLookup(schema);
      const submission = { instanceId: 'double', xml: testData.instances.doubleRepeat.double };
      return submissionToOData(fields, 'Submissions.children.child', submission).then((result) => {
        result.should.eql([{
          __id: '46ebf42ee83ddec5028c42b2c054402d1e700208',
          '__Submissions-id': 'double',
          name: 'Alice'
        }, {
          __id: 'b6e93a81a53eed0566e65e472d4a4b9ae383ee6d',
          '__Submissions-id': 'double',
          name: 'Bob',
          toys: {
            'toy@odata.navigationLink': "Submissions('double')/children/child('b6e93a81a53eed0566e65e472d4a4b9ae383ee6d')/toys/toy"
          }
        }, {
          __id: '8954b393f82c1833abb19be08a3d6cb382171f54',
          '__Submissions-id': 'double',
          name: 'Chelsea',
          toys: {
            'toy@odata.navigationLink': "Submissions('double')/children/child('8954b393f82c1833abb19be08a3d6cb382171f54')/toys/toy"
          }
        }]);
      });
    });
  });*/

  it('should return second-order subtable results', () => {
    return getFormSchema({ xml: testData.forms.doubleRepeat }).then((schema) => {
      const fields = schemaAsLookup(schema);
      const submission = { instanceId: 'double', xml: testData.instances.doubleRepeat.double };
      return submissionToOData(fields, 'Submissions.children.child.toys.toy', submission).then((result) => {
        result.should.eql([{
          __id: 'a9058d7b2ed9557205ae53f5b1dc4224043eca2a',
          '__Submissions-children-child-id': 'b6e93a81a53eed0566e65e472d4a4b9ae383ee6d',
          name: 'Twilight Sparkle'
        }, {
          __id: '8d2dc7bd3e97a690c0813e646658e51038eb4144',
          '__Submissions-children-child-id': 'b6e93a81a53eed0566e65e472d4a4b9ae383ee6d',
          name: 'Pinkie Pie'
        }, {
          __id: 'b716dd8b79a4c9369d6b1e7a9c9d55ac18da1319',
          '__Submissions-children-child-id': 'b6e93a81a53eed0566e65e472d4a4b9ae383ee6d',
          name: 'Applejack'
        }, {
          __id: '52fbd613acc151ee1187026890f6246b35f69144',
          '__Submissions-children-child-id': 'b6e93a81a53eed0566e65e472d4a4b9ae383ee6d',
          name: 'Spike'
        }, {
          __id: '4a4a05249c8f992b0b3cc7dbe690b57cf18e8ea9',
          '__Submissions-children-child-id': '8954b393f82c1833abb19be08a3d6cb382171f54',
          name: 'Rainbow Dash'
        }, {
          __id: '00ae97cddc4804157e3a0b13ff9e30d86cfd1547',
          '__Submissions-children-child-id': '8954b393f82c1833abb19be08a3d6cb382171f54',
          name: 'Rarity'
        }, {
          __id: 'ecc1d831ae487ceef09ab7ccc0a021d3cab48988',
          '__Submissions-children-child-id': '8954b393f82c1833abb19be08a3d6cb382171f54',
          name: 'Fluttershy'
        }, {
          __id: 'd6539297765d97b951c6a63d7f70cafeb1741f8d',
          '__Submissions-children-child-id': '8954b393f82c1833abb19be08a3d6cb382171f54',
          name: 'Princess Luna'
        }]);
      });
    });
  });
});

