const { createHandler } = require('@app-core/server');
const deleteCreatorCard = require('@app/services/creator-cards/delete-creator-card');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'delete',
  middlewares: [],
  async handler(rc, helpers) {
    const response = await deleteCreatorCard({
      ...rc.body,
      slug: rc.params.slug,
    });

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: 'Creator Card Deleted Successfully.',
      data: response,
    };
  },
});
