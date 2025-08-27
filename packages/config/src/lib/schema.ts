import Joi from 'joi';

const ArgValueSchema = Joi.alternatives().try(
  Joi.string(),
  Joi.array().items(Joi.string()),
  Joi.number(),
  Joi.boolean(),
);

const CommandTypeSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  action: Joi.function().required(),
  args: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        description: Joi.string().required(),
        default: ArgValueSchema.optional(),
      }),
    )
    .optional(),
  options: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        description: Joi.string().required(),
        default: ArgValueSchema.optional(),
        parse: Joi.function().optional(),
      }),
    )
    .optional(),
}).unknown(false);

const ConfigTypeSchema = Joi.object({
  root: Joi.string().optional(),
  reactNativeVersion: Joi.string().optional(),
  reactNativePath: Joi.string().optional(),
  bundler: Joi.function().optional(),
  plugins: Joi.array().items(Joi.function()).optional(),
  platforms: Joi.object().pattern(Joi.string(), Joi.function()).optional(),
  commands: Joi.array().items(CommandTypeSchema).optional(),
  remoteCacheProvider: Joi.alternatives()
    .try(
      Joi.string().valid('github-actions'),
      Joi.function(),
      Joi.any().valid(null),
    )
    .optional(),
  fingerprint: Joi.object({
    extraSources: Joi.array().items(Joi.string()).default([]),
    ignorePaths: Joi.array().items(Joi.string()).default([]),
    env: Joi.array().items(Joi.string()).optional(),
  })
    .default({
      extraSources: [],
      ignorePaths: [],
    })
    .optional(),
}).unknown(false);

export { ConfigTypeSchema };
