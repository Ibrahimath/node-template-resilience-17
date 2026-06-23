const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const CreatorCard = require('@app/repository/creator-card');
const { serializeCreatorCard } = require('./utils');

const deleteCreatorCardSpec = `root {
  creator_reference string<trim|length:20>
  slug string<trim|minLength:5|maxLength:50>
}`;

const parsedDeleteCreatorCardSpec = validator.parse(deleteCreatorCardSpec);

async function deleteCreatorCard(serviceData) {
  const validatedData = validator.validate(serviceData, parsedDeleteCreatorCardSpec);

  const creatorCard = await CreatorCard.findOne({
    query: { slug: validatedData.slug, deleted: 0 },
  });

  if (!creatorCard) {
    throwAppError('Creator card not found', 'NF01');
  }

  const deletedAt = Date.now();

  const deletionResult = await CreatorCard.deleteOne({
    query: { slug: validatedData.slug, deleted: 0 },
  });

  if (!deletionResult?.deletedCount) {
    throwAppError('Creator card not found', 'NF01');
  }

  return serializeCreatorCard(creatorCard, {
    includeAccessCode: true,
    deletedOverride: deletedAt,
  });
}

module.exports = deleteCreatorCard;
