const { throwAppError } = require('@app-core/errors');
const CreatorCard = require('@app/repository/creator-card');
const { serializeCreatorCard } = require('./utils');

async function getCreatorCard(serviceData) {
  const { slug, access_code: accessCode } = serviceData;

  const creatorCard = await CreatorCard.findOne({
    query: { slug, deleted: 0 },
  });

  if (!creatorCard) {
    throwAppError('Creator card not found', 'NF01');
  }

  if (creatorCard.status === 'draft') {
    throwAppError('Creator card not found', 'NF02');
  }

  if (creatorCard.access_type === 'private' && !accessCode) {
    throwAppError('This card is private. An access code is required', 'AC03');
  }

  if (creatorCard.access_type === 'private' && creatorCard.access_code !== accessCode) {
    throwAppError('Invalid access code', 'AC04');
  }

  return serializeCreatorCard(creatorCard, { includeAccessCode: false });
}

module.exports = getCreatorCard;
