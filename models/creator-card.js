const { ModelSchema, SchemaTypes, DatabaseModel } = require('@app-core/mongoose');

const modelName = 'creator_cards';

const schemaConfig = {
  _id: { type: SchemaTypes.ULID },
  title: { type: SchemaTypes.String },
  description: { type: SchemaTypes.String },
  slug: { type: SchemaTypes.String, unique: true, index: true },
  creator_reference: { type: SchemaTypes.String, index: true },
  links: { type: SchemaTypes.Array },
  service_rates: { type: SchemaTypes.Mixed },
  status: { type: SchemaTypes.String, index: true },
  access_type: { type: SchemaTypes.String },
  access_code: { type: SchemaTypes.String },
  created: { type: SchemaTypes.Number },
  updated: { type: SchemaTypes.Number },
  deleted: { type: SchemaTypes.Number, default: 0, index: true },
};

const modelSchema = new ModelSchema(schemaConfig, { collection: modelName });

module.exports = DatabaseModel.model(modelName, modelSchema, { paranoid: true });
