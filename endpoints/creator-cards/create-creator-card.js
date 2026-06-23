const { createHandler } = require('@app-core/server');
const createCreatorCard = require('@app/services/creator-cards/create-creator-card');

module.exports = createHandler({
  path: '/creator-cards',
  method: 'post',
  middlewares: [],
  async handler(rc, helpers) {
    const response = await createCreatorCard(rc.body);

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: 'Creator Card Created Successfully.',
      data: response,
    };
  },
});
