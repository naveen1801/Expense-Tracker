import Joi from 'joi';

export const schemas = {
  registerBody: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().max(150).required(),
    password: Joi.string().min(6).max(200).required(),
  }),

  loginBody: Joi.object({
    email: Joi.string().email().max(150).required(),
    password: Joi.string().min(1).max(200).required(),
  }),

  expenseCreateBody: Joi.object({
    amount: Joi.number().precision(2).positive().required(),
    category: Joi.string().min(1).max(100).required(),
    date: Joi.date().iso().required(),
    note: Joi.string().max(255).allow('').optional(),
  }),

  expenseQuery: Joi.object({
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional(),
    category: Joi.string().min(1).max(100).optional(),
    minAmount: Joi.number().precision(2).min(0).optional(),
    maxAmount: Joi.number().precision(2).min(0).optional(),
    q: Joi.string().max(255).optional(),
  }),

  budgetUpsertBody: Joi.object({
    yearMonth: Joi.string()
      .pattern(/^\d{4}-\d{2}$/)
      .required(),
    monthlyLimit: Joi.number().precision(2).positive().required(),
  }),
};

export function validate(schema, data) {
  const result = schema.validate(data, {
    abortEarly: false,
    convert: true,
    stripUnknown: true,
  });
  if (result.error) {
    const details = result.error.details?.map((d) => d.message).join('; ');
    const err = new Error(details || 'Validation error');
    err.status = 400;
    throw err;
  }
  return result.value;
}

