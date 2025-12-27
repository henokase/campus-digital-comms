const test = require('node:test');
const assert = require('node:assert/strict');

const { buildEnvelope } = require('../../../services/announcement-service/src/publisher');

test('announcement-service unit: publisher buildEnvelope shape', async () => {
  const envelope = buildEnvelope({
    eventType: 'announcement.published',
    data: { announcementId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
  });

  assert.equal(typeof envelope.eventId, 'string');
  assert.ok(envelope.eventId.length > 10);

  assert.equal(envelope.eventType, 'announcement.published');
  assert.equal(envelope.producer, 'announcement-service');
  assert.equal(typeof envelope.occurredAt, 'string');

  assert.deepEqual(envelope.data, { announcementId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
});
