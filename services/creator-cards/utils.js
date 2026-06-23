const { throwAppError } = require('@app-core/errors');

const SLUG_REGEX = /^[a-zA-Z0-9_-]+$/;
const ACCESS_CODE_REGEX = /^[a-zA-Z0-9]{6}$/;
const URL_REGEX = /^https?:\/\//i;
const ALPHANUMERIC_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomAlphaNumeric(length = 6) {
  let result = '';

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * ALPHANUMERIC_CHARS.length);
    result += ALPHANUMERIC_CHARS[randomIndex];
  }

  return result;
}

function slugifyTitle(title) {
  const sanitized = String(title || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!sanitized) {
    return 'card';
  }

  return sanitized.slice(0, 50).replace(/-+$/g, '') || 'card';
}

function withSlugSuffix(baseSlug) {
  const normalizedBase = String(baseSlug || 'card').replace(/-+$/g, '') || 'card';
  const truncatedBase = normalizedBase.slice(0, 43).replace(/-+$/g, '') || 'card';

  return `${truncatedBase}-${randomAlphaNumeric(6)}`;
}

function ensureValidSlugCharacters(slug) {
  if (!SLUG_REGEX.test(slug)) {
    throwAppError(
      'slug can only contain letters, numbers, hyphens, and underscores',
      'SPCL_VALIDATION'
    );
  }
}

function ensureValidAccessCode(accessCode) {
  if (!ACCESS_CODE_REGEX.test(accessCode)) {
    throwAppError('access_code must be exactly 6 alphanumeric characters', 'SPCL_VALIDATION');
  }
}

function ensureValidLinks(links) {
  if (!Array.isArray(links)) {
    return;
  }

  links.forEach((link, index) => {
    if (!URL_REGEX.test(link.url)) {
      throwAppError(`links[${index}].url must start with http:// or https://`, 'SPCL_VALIDATION');
    }
  });
}

function ensureValidServiceRates(serviceRates) {
  if (!serviceRates || !Array.isArray(serviceRates.rates)) {
    return;
  }

  serviceRates.rates.forEach((rate, index) => {
    if (!Number.isInteger(rate.amount) || rate.amount < 1) {
      throwAppError(
        `service_rates.rates[${index}].amount must be a positive integer`,
        'SPCL_VALIDATION'
      );
    }
  });
}

function normalizeDeleted(deleted) {
  if (!deleted) {
    return null;
  }

  return deleted;
}

function serializeCreatorCard(card, options = {}) {
  if (!card) {
    return null;
  }

  const includeAccessCode = !!options.includeAccessCode;
  const deleted =
    typeof options.deletedOverride === 'number'
      ? options.deletedOverride
      : normalizeDeleted(card.deleted);

  const response = {
    id: card._id,
    title: card.title,
    description: card.description || null,
    slug: card.slug,
    creator_reference: card.creator_reference,
    links: Array.isArray(card.links) ? card.links : [],
    service_rates: card.service_rates || null,
    status: card.status,
    access_type: card.access_type || 'public',
    created: card.created,
    updated: card.updated,
    deleted,
  };

  if (includeAccessCode) {
    response.access_code = card.access_code || null;
  }

  return response;
}

module.exports = {
  ACCESS_CODE_REGEX,
  ensureValidAccessCode,
  ensureValidLinks,
  ensureValidServiceRates,
  ensureValidSlugCharacters,
  serializeCreatorCard,
  slugifyTitle,
  withSlugSuffix,
};
