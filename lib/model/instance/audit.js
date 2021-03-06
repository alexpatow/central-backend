// Copyright 2017 ODK Central Developers
// See the NOTICE file at the top-level directory of this distribution and at
// https://github.com/opendatakit/central-backend/blob/master/NOTICE.
// This file is part of ODK Central. It is subject to the license terms in
// the LICENSE file found in the top-level directory of this distribution and at
// https://www.apache.org/licenses/LICENSE-2.0. No part of ODK Central,
// including this file, may be copied, modified, propagated, or distributed
// except according to the terms contained in the LICENSE file.
//
// Currently, we write audit logs to the database. This makes it easy to use them
// in determining, for example, the most recent login by a User. To log an audit
// record, use Audit.log().

const Instance = require('./instance');
const Option = require('../../util/option');

module.exports = Instance('audits', {
  all: [ 'actorId', 'action', 'acteeId', 'details', 'loggedAt' ],
  readable: [ 'actorId', 'action', 'acteeId', 'details', 'loggedAt' ]
})(({ audits, Audit, simply }) => class {
  forCreate() { return this.with({ loggedAt: new Date() }); }

  create() { return simply.create('audits', this); }

  // actor may be Actor? or Option[Actor]; actee may be Actee? or Option[Actee];
  // details are Object?.
  static log(actor, action, actee, details) {
    return (new Audit({
      actorId: Option.of(actor).map((x) => x.id).orNull(),
      action,
      acteeId: Option.of(actee).map((x) => x.acteeId).orNull(),
      details
    })).create();
  }

  static getLatestByAction(action) { return audits.getLatestWhere({ action }); }
  static getLatestWhere(condition) { return audits.getLatestWhere(condition); }

  static getRecentByAction(action, duration) { return audits.getRecentWhere({ action }, duration); }
});

