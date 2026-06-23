const assert = require('node:assert');
const createMockServer = require('@app-core/mock-server');
const { MockModelStubs } = require('@app/mock-models');

function clone(value) {
  return structuredClone(value);
}

function setupCreatorCardStubs() {
  const store = new Map();
  const stubFactory = MockModelStubs.CreatorCard.configureStubs;
  const activeDecorators = [
    stubFactory({
      method: 'create',
      overrideFn(data) {
        const entry = clone(data);
        const existing = store.get(entry.slug);

        if (existing?.deleted === 0) {
          const duplicateError = new Error('Duplicate slug');
          duplicateError.code = '11000';
          duplicateError.keyPattern = { slug: 1 };
          throw duplicateError;
        }

        entry.deleted = entry.deleted || 0;
        store.set(entry.slug, entry);

        return clone(entry);
      },
    }),
    stubFactory({
      method: 'findOne',
      overrideFn(data) {
        const stored = store.get(data.query.slug);

        if (!stored) {
          return null;
        }

        if (Object.hasOwn(data.query, 'deleted') && stored.deleted !== data.query.deleted) {
          return null;
        }

        return clone(stored);
      },
    }),
    stubFactory({
      method: 'deleteOne',
      overrideFn(data) {
        const stored = store.get(data.query.slug);

        if (!stored) {
          return { deletedCount: 0 };
        }

        if (Object.hasOwn(data.query, 'deleted') && stored.deleted !== data.query.deleted) {
          return { deletedCount: 0 };
        }

        stored.deleted = Date.now();
        store.set(data.query.slug, stored);

        return { deletedCount: 1 };
      },
    }),
  ];

  return {
    teardown() {
      activeDecorators.forEach((decorator) => decorator.revert());
    },
  };
}

describe('Creator Cards Endpoints', () => {
  const mockedServer = createMockServer(['endpoints/creator-cards']);

  const defaultCardPayload = {
    title: 'George Cooks',
    description: 'George Cooks is a weekly cooking podcast by Chef George AmadiObi',
    slug: 'george-cooks',
    creator_reference: 'crt_8f2k1m9x4p7w3q5z',
    links: [
      { title: 'YouTube Channel', url: 'https://youtube.com/@georgecooks' },
      { title: 'Instagram', url: 'https://instagram.com/georgecooks' },
    ],
    service_rates: {
      currency: 'NGN',
      rates: [
        {
          name: 'IG Story Post',
          description: 'One Instagram story mention',
          amount: 5000000,
        },
      ],
    },
    status: 'published',
    access_type: 'public',
  };

  let stubSession;

  beforeEach(() => {
    stubSession = setupCreatorCardStubs();
  });

  afterEach(() => {
    stubSession.teardown();
  });

  it('creates a creator card and serializes _id as id', async () => {
    const response = await mockedServer.post('/creator-cards', {
      body: clone(defaultCardPayload),
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.data.status, 'success');
    assert.strictEqual(response.data.message, 'Creator Card Created Successfully.');
    assert.ok(response.data.data.id);
    assert.strictEqual(Object.hasOwn(response.data.data, '_id'), false);
    assert.strictEqual(response.data.data.access_code, null);
  });

  it('returns AC01 when access_type is private without access_code', async () => {
    const response = await mockedServer.post('/creator-cards', {
      body: {
        ...clone(defaultCardPayload),
        slug: 'private-card',
        access_type: 'private',
      },
    });

    assert.strictEqual(response.statusCode, 400);
    assert.strictEqual(response.data.status, 'error');
    assert.strictEqual(response.data.code, 'AC01');
  });

  it('returns SL02 for duplicate client-provided slug', async () => {
    await mockedServer.post('/creator-cards', {
      body: clone(defaultCardPayload),
    });

    const duplicateResponse = await mockedServer.post('/creator-cards', {
      body: clone(defaultCardPayload),
    });

    assert.strictEqual(duplicateResponse.statusCode, 400);
    assert.strictEqual(duplicateResponse.data.code, 'SL02');
  });

  it('applies private retrieval rules in order and omits access_code on success', async () => {
    await mockedServer.post('/creator-cards', {
      body: {
        ...clone(defaultCardPayload),
        slug: 'private-published',
        access_type: 'private',
        access_code: 'A1B2C3',
      },
    });

    const noAccessCodeResponse = await mockedServer.get('/creator-cards/private-published');
    assert.strictEqual(noAccessCodeResponse.statusCode, 403);
    assert.strictEqual(noAccessCodeResponse.data.code, 'AC03');

    const wrongAccessCodeResponse = await mockedServer.get(
      '/creator-cards/private-published?access_code=ZZZZZZ'
    );
    assert.strictEqual(wrongAccessCodeResponse.statusCode, 403);
    assert.strictEqual(wrongAccessCodeResponse.data.code, 'AC04');

    const successResponse = await mockedServer.get(
      '/creator-cards/private-published?access_code=A1B2C3'
    );
    assert.strictEqual(successResponse.statusCode, 200);
    assert.strictEqual(Object.hasOwn(successResponse.data.data, 'access_code'), false);
  });

  it('returns NF02 for drafts, then supports delete and NF01 after delete', async () => {
    await mockedServer.post('/creator-cards', {
      body: {
        ...clone(defaultCardPayload),
        slug: 'draft-card',
        status: 'draft',
      },
    });

    const draftResponse = await mockedServer.get('/creator-cards/draft-card');
    assert.strictEqual(draftResponse.statusCode, 404);
    assert.strictEqual(draftResponse.data.code, 'NF02');

    await mockedServer.post('/creator-cards', {
      body: {
        ...clone(defaultCardPayload),
        slug: 'delete-card',
      },
    });

    const deleteResponse = await mockedServer.delete('/creator-cards/delete-card', {
      body: { creator_reference: 'crt_8f2k1m9x4p7w3q5z' },
    });

    assert.strictEqual(deleteResponse.statusCode, 200);
    assert.strictEqual(deleteResponse.data.data.slug, 'delete-card');
    assert.ok(deleteResponse.data.data.deleted);

    const notFoundAfterDelete = await mockedServer.get('/creator-cards/delete-card');
    assert.strictEqual(notFoundAfterDelete.statusCode, 404);
    assert.strictEqual(notFoundAfterDelete.data.code, 'NF01');
  });

  it('passes the provided 16-case assessment matrix in sequence', async () => {
    // Test Case 1 - Full creation
    const tc1 = await mockedServer.post('/creator-cards', {
      body: {
        title: 'George Cooks',
        description: 'Weekly cooking podcast',
        slug: 'george-cooks',
        creator_reference: 'crt_8f2k1m9x4p7w3q5z',
        links: [{ title: 'YouTube', url: 'https://youtube.com/@georgecooks' }],
        service_rates: {
          currency: 'NGN',
          rates: [{ name: 'IG Story Post', description: 'One story mention', amount: 5000000 }],
        },
        status: 'published',
      },
    });
    assert.strictEqual(tc1.statusCode, 200);
    assert.strictEqual(tc1.data.data.access_type, 'public');
    assert.ok(tc1.data.data.id);
    assert.strictEqual(Object.hasOwn(tc1.data.data, '_id'), false);

    // Test Case 2 - Slug auto-generation
    const tc2 = await mockedServer.post('/creator-cards', {
      body: {
        title: 'Ada Designs Things',
        creator_reference: 'crt_a1b2c3d4e5f6g7h8',
        status: 'published',
      },
    });
    assert.strictEqual(tc2.statusCode, 200);
    assert.strictEqual(tc2.data.data.slug, 'ada-designs-things');

    // Test Case 3 - Private card creation
    const tc3 = await mockedServer.post('/creator-cards', {
      body: {
        title: 'VIP Rate Card',
        creator_reference: 'crt_x9y8z7w6v5u4t3s2',
        status: 'published',
        access_type: 'private',
        access_code: 'A1B2C3',
      },
    });
    assert.strictEqual(tc3.statusCode, 200);
    assert.strictEqual(tc3.data.data.access_code, 'A1B2C3');

    // Test Case 4 - Retrieving a public published card
    const tc4 = await mockedServer.get('/creator-cards/george-cooks');
    assert.strictEqual(tc4.statusCode, 200);
    assert.ok(tc4.data.data.id);
    assert.strictEqual(Object.hasOwn(tc4.data.data, 'access_code'), false);

    // Test Case 5 - Retrieving a private card with correct pin
    const tc5 = await mockedServer.get('/creator-cards/vip-rate-card?access_code=A1B2C3');
    assert.strictEqual(tc5.statusCode, 200);
    assert.strictEqual(Object.hasOwn(tc5.data.data, 'access_code'), false);

    // Test Case 6 - Deleting a card
    const tc6 = await mockedServer.delete('/creator-cards/ada-designs-things', {
      body: {
        creator_reference: 'crt_a1b2c3d4e5f6g7h8',
      },
    });
    assert.strictEqual(tc6.statusCode, 200);
    assert.ok(typeof tc6.data.data.deleted === 'number' && tc6.data.data.deleted > 0);

    // Test Case 7 - Duplicate slug
    const tc7 = await mockedServer.post('/creator-cards', {
      body: {
        title: 'Another George',
        slug: 'george-cooks',
        creator_reference: 'crt_m1n2b3v4c5x6z7l8',
        status: 'published',
      },
    });
    assert.strictEqual(tc7.statusCode, 400);
    assert.strictEqual(tc7.data.code, 'SL02');

    // Test Case 8 - Missing access_code on private card
    const tc8 = await mockedServer.post('/creator-cards', {
      body: {
        title: 'Secret Card',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
        status: 'published',
        access_type: 'private',
      },
    });
    assert.strictEqual(tc8.statusCode, 400);
    assert.strictEqual(tc8.data.code, 'AC01');

    // Test Case 9 - access_code on a public card
    const tc9 = await mockedServer.post('/creator-cards', {
      body: {
        title: 'Public Card',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
        status: 'published',
        access_type: 'public',
        access_code: 'A1B2C3',
      },
    });
    assert.strictEqual(tc9.statusCode, 400);
    assert.strictEqual(tc9.data.code, 'AC05');

    // Test Case 10 - Framework validation failure
    const tc10 = await mockedServer.post('/creator-cards', {
      body: {
        title: 'Bad Status Card',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
        status: 'archived',
      },
    });
    assert.strictEqual(tc10.statusCode, 400);

    // Test Case 11 - Retrieving a non-existent card
    const tc11 = await mockedServer.get('/creator-cards/does-not-exist-123');
    assert.strictEqual(tc11.statusCode, 404);
    assert.strictEqual(tc11.data.code, 'NF01');

    // Setup for Test Case 12
    await mockedServer.post('/creator-cards', {
      body: {
        title: 'My Draft Card',
        slug: 'my-draft-card',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
        status: 'draft',
      },
    });

    // Test Case 12 - Retrieving a draft card
    const tc12 = await mockedServer.get('/creator-cards/my-draft-card');
    assert.strictEqual(tc12.statusCode, 404);
    assert.strictEqual(tc12.data.code, 'NF02');

    // Test Case 13 - Retrieving a private card without pin
    const tc13 = await mockedServer.get('/creator-cards/vip-rate-card');
    assert.strictEqual(tc13.statusCode, 403);
    assert.strictEqual(tc13.data.code, 'AC03');

    // Test Case 14 - Retrieving a private card with wrong pin
    const tc14 = await mockedServer.get('/creator-cards/vip-rate-card?access_code=WRONG1');
    assert.strictEqual(tc14.statusCode, 403);
    assert.strictEqual(tc14.data.code, 'AC04');

    // Test Case 15 - Deleting a non-existent card
    const tc15 = await mockedServer.delete('/creator-cards/does-not-exist-123', {
      body: {
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
      },
    });
    assert.strictEqual(tc15.statusCode, 404);
    assert.strictEqual(tc15.data.code, 'NF01');

    // Test Case 16 - Retrieving a deleted card
    const tc16 = await mockedServer.get('/creator-cards/ada-designs-things');
    assert.strictEqual(tc16.statusCode, 404);
    assert.strictEqual(tc16.data.code, 'NF01');
  });
});
