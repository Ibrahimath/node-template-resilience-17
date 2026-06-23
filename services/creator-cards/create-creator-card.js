const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { ulid } = require('@app-core/randomness');
const CreatorCard = require('@app/repository/creator-card');
const {
  ensureValidAccessCode,
  ensureValidLinks,
  ensureValidServiceRates,
  ensureValidSlugCharacters,
  serializeCreatorCard,
  slugifyTitle,
  withSlugSuffix,
} = require('./utils');

const createCreatorCardSpec = `root {
  title string<trim|minLength:3|maxLength:100>
  description? string<trim|maxLength:500>
  slug? string<trim|minLength:5|maxLength:50>
  creator_reference string<trim|length:20>
  links[]? {
    title string<trim|minLength:1|maxLength:100>
    url string<trim|maxLength:200>
  }
  service_rates? {
    currency string(NGN|USD|GBP|GHS)
    rates[] {
      name string<trim|minLength:3|maxLength:100>
      description string<trim|maxLength:250>
      amount number<min:1>
    }
  }
  status string(draft|published)
  access_type? string(public|private)
  access_code? string<trim|length:6>
}`;

const parsedCreateCreatorCardSpec = validator.parse(createCreatorCardSpec);

async function slugExists(slug) {
  const existingCard = await CreatorCard.findOne({
    query: { slug, deleted: 0 },
  });

  return !!existingCard;
}

async function generateAutoSlug(title) {
  const baseSlug = slugifyTitle(title);
  const shouldForceSuffix = baseSlug.length < 5;

  if (!shouldForceSuffix && !(await slugExists(baseSlug))) {
    return baseSlug;
  }

  const generateUniqueSlug = async () => {
    const generatedSlug = withSlugSuffix(baseSlug);

    if (await slugExists(generatedSlug)) {
      return generateUniqueSlug();
    }

    return generatedSlug;
  };

  return generateUniqueSlug();
}

async function createCreatorCard(serviceData) {
  const validatedData = validator.validate(serviceData, parsedCreateCreatorCardSpec);

  ensureValidLinks(validatedData.links);
  ensureValidServiceRates(validatedData.service_rates);

  const accessType = validatedData.access_type || 'public';

  if (accessType === 'private' && !validatedData.access_code) {
    throwAppError('access_code is required when access_type is private', 'AC01');
  }

  if (accessType === 'public' && validatedData.access_code !== undefined) {
    throwAppError('access_code can only be set on private cards', 'AC05');
  }

  if (accessType === 'private') {
    ensureValidAccessCode(validatedData.access_code);
  }

  let resolvedSlug = validatedData.slug;

  if (resolvedSlug) {
    ensureValidSlugCharacters(resolvedSlug);

    if (await slugExists(resolvedSlug)) {
      throwAppError('Slug is already taken', 'SL02');
    }
  } else {
    resolvedSlug = await generateAutoSlug(validatedData.title);
  }

  try {
    const createdCard = await CreatorCard.create({
      _id: ulid(),
      title: validatedData.title,
      description: validatedData.description || null,
      slug: resolvedSlug,
      creator_reference: validatedData.creator_reference,
      links: validatedData.links || [],
      service_rates: validatedData.service_rates || null,
      status: validatedData.status,
      access_type: accessType,
      access_code: accessType === 'private' ? validatedData.access_code : null,
    });

    return serializeCreatorCard(createdCard, { includeAccessCode: true });
  } catch (error) {
    if (error?.isApplicationError && error.errorCode === ERROR_CODE.DUPLRCRD) {
      throwAppError('Slug is already taken', 'SL02');
    }

    throw error;
  }
}

module.exports = createCreatorCard;
